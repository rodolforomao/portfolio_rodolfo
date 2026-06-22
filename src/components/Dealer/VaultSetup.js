import React, { useState, useEffect, useCallback } from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import InputGroup from 'react-bootstrap/InputGroup';
import {
  TbLock, TbEye, TbEyeOff, TbShieldCheck, TbRefresh, TbPlus,
} from 'react-icons/tb';
import { encryptPassphrase } from './vault/vaultCrypto';
import {
  vaultFetch,
  fetchVaultDealers,
  createVaultWallet,
  deleteVaultDealer,
  resetVaultDealer,
  walletStatusLabel,
} from './vault/vaultApi';

function StatusBadge({ status }) {
  const label = walletStatusLabel({ status, ready: status === 'ready' });
  if (status === 'ready') return <Badge bg="success" className="ms-auto">{label}</Badge>;
  if (status === 'registered') return <Badge bg="warning" text="dark" className="ms-auto">{label}</Badge>;
  if (status === 'pending') return <Badge bg="info" className="ms-auto">{label}</Badge>;
  return <Badge bg="secondary" className="ms-auto">{label}</Badge>;
}

const MIN_LEN = 12;

export default function VaultSetup({ embedded = false, onRequestKeySync }) {
  const [dealers, setDealers] = useState([]);
  const [loadingDealers, setLoadingDealers] = useState(false);
  const [dealerLoadErr, setDealerLoadErr] = useState('');

  const [selectedId, setSelectedId] = useState('');
  const [newWalletName, setNewWalletName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const selected = dealers.find((d) => d.dealer_id === selectedId) || null;

  const loadDealers = useCallback(async () => {
    setLoadingDealers(true);
    setDealerLoadErr('');
    const r = await fetchVaultDealers();
    setLoadingDealers(false);
    if (r.ok) {
      const list = r.data.dealers || [];
      setDealers(list);
      setSelectedId((prev) => {
        if (prev && list.some((d) => d.dealer_id === prev)) return prev;
        return list[0]?.dealer_id || '';
      });
    } else {
      setDealerLoadErr(r.data?.error || `Vault indisponível (HTTP ${r.status})`);
    }
  }, []);

  useEffect(() => { loadDealers(); }, [loadDealers]);

  // Atualiza status enquanto aguarda chaves do manager
  useEffect(() => {
    if (!selected || selected.has_keys || selected.status === 'ready') return undefined;
    const timer = setInterval(loadDealers, 4000);
    return () => clearInterval(timer);
  }, [selected, loadDealers]);

  const handleSyncManager = async () => {
    setResult(null);
    setBusy(true);
    try {
      if (onRequestKeySync) {
        await onRequestKeySync();
      }
      await loadDealers();
      setResult({
        ok: true,
        msg: 'Status atualizado. Se o manager estiver online, as chaves aparecem em segundos.',
      });
    } catch (err) {
      setResult({
        ok: false,
        msg: err.message || 'Manager offline — inicie o manager_dealer no celular.',
      });
      await loadDealers();
    } finally {
      setBusy(false);
    }
  };

  const mismatch = confirm.length > 0 && passphrase !== confirm;
  const tooShort = passphrase.length > 0 && passphrase.length < MIN_LEN;
  const canRegister = !busy && selected
    && selected.has_keys
    && passphrase.length >= MIN_LEN
    && passphrase === confirm;
  const waitingKeys = selected && !selected.has_keys && selected.status !== 'ready';
  const canCreate = !busy && newWalletName.trim().length >= 2;

  const handleCreate = async () => {
    const name = newWalletName.trim();
    setResult(null);
    setBusy(true);
    try {
      const r = await createVaultWallet(name);
      if (!r.ok) {
        setResult({
          ok: false,
          msg: r.data?.error || `Falha ao criar carteira (HTTP ${r.status})`,
        });
        return;
      }
      setResult({
        ok: true,
        msg: `Carteira '${name}' criada. Inicie o manager no celular para registrar as chaves.`,
      });
      setNewWalletName('');
      await loadDealers();
      if (r.data?.dealer_id) setSelectedId(r.data.dealer_id);
      if (onRequestKeySync) {
        try { await onRequestKeySync(); } catch { /* manager offline */ }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!selected) return;
    const name = selected.wallet_name || selected.dealer_id;
    if (!window.confirm(
      `Redefinir vault de '${name}'?\n\n`
      + 'Apaga chaves e passphrase. O manager no celular registrará chaves novas; '
      + 'depois cadastre a passphrase aqui.',
    )) return;
    setResult(null);
    setBusy(true);
    try {
      const r = await resetVaultDealer(selected.dealer_id);
      if (!r.ok) {
        setResult({ ok: false, msg: r.data?.error || r.data?.message || 'Falha ao redefinir.' });
        return;
      }
      if (onRequestKeySync) {
        try { await onRequestKeySync(); } catch { /* offline */ }
      }
      setResult({ ok: true, msg: `Vault de '${name}' redefinido. Aguarde o manager e cadastre a passphrase.` });
      setPassphrase('');
      setConfirm('');
      loadDealers();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const name = selected.wallet_name || selected.dealer_id;
    if (!window.confirm(`Remover carteira '${name}' do Vault?`)) return;
    setResult(null);
    setBusy(true);
    try {
      const r = await deleteVaultDealer(selected.dealer_id);
      if (!r.ok) {
        setResult({ ok: false, msg: r.data?.error || 'Falha ao remover.' });
        return;
      }
      setResult({ ok: true, msg: `Carteira '${name}' removida.` });
      setSelectedId('');
      setPassphrase('');
      setConfirm('');
      loadDealers();
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    if (!selected) return;
    setResult(null);
    setBusy(true);
    try {
      const pkRes = await vaultFetch(`/api/vault/pubkey/${encodeURIComponent(selected.dealer_id)}`);
      if (!pkRes.ok) {
        setResult({
          ok: false,
          msg: pkRes.data?.error
            || 'Manager ainda não registrou chaves — inicie o manager no celular.',
        });
        return;
      }

      const { enc_p, sealed_r } = await encryptPassphrase(passphrase, pkRes.data.pk_m);

      const regRes = await vaultFetch('/api/vault/passphrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealer_id: selected.dealer_id,
          wallet_name: selected.wallet_name,
          enc_p,
          sealed_r,
        }),
      });

      if (!regRes.ok) {
        setResult({ ok: false, msg: regRes.data?.error || 'Falha ao salvar vault.' });
        return;
      }

      setResult({ ok: true, msg: `Carteira '${selected.wallet_name}' pronta. Pode usar Run no console.` });
      setPassphrase('');
      setConfirm('');
      loadDealers();
    } catch (err) {
      setResult({ ok: false, msg: `Erro: ${err.message}` });
    } finally {
      setBusy(false);
    }
  };

  const hintForSelected = () => {
    if (!selected) return null;
    if (selected.status === 'ready') {
      return 'Pronta — use a aba Run para iniciar o dealer.';
    }
    if (!selected.has_keys) {
      return 'Aguardando manager no celular — inicie o manager_dealer (ou clique Atualizar catálogo no Run).';
    }
    return 'Manager conectado — cadastre a passphrase abaixo (cifrada no browser, nunca sai em texto claro).';
  };

  return (
    <div className={embedded ? 'dealer-settings-section' : 'dealer-form-block'}>
      {embedded ? (
        <>
          <h4><TbLock /> Vault — Carteiras</h4>
          <p className="dealer-settings-desc">
            Cadastre o <strong>nome da carteira</strong> aqui. O manager no celular registra as chaves;
            você configura a passphrase uma vez. Nada de NAME_* no .env do Termux.
          </p>
        </>
      ) : (
        <p className="dealer-vault-desc">
          <TbLock /> Split-key 2-of-2 — passphrase cifrada no browser. Só o nome da carteira é necessário.
        </p>
      )}

      <div className="dealer-vault-dealers mb-3">
        <div className="dealer-vault-dealers-head">
          <span>Carteiras</span>
          <Button size="sm" variant="outline-secondary" onClick={loadDealers} disabled={loadingDealers}>
            <TbRefresh className={loadingDealers ? 'dealer-spin' : ''} />
          </Button>
        </div>

        {dealerLoadErr && (
          <p className="dealer-vault-warning mt-1 mb-1" style={{ color: '#f85149' }}>{dealerLoadErr}</p>
        )}

        {!dealerLoadErr && dealers.length === 0 && (
          <Alert variant="info" className="mb-2 py-2 dealer-vault-alert">
            Nenhuma carteira. Adicione abaixo (ex.: <code>depix_pool</code>, <code>amm_lbtc</code>).
          </Alert>
        )}

        {dealers.map((d) => (
          <button
            key={d.dealer_id}
            type="button"
            className={`dealer-cancel-item dealer-vault-dealer-item ${selectedId === d.dealer_id ? 'selected' : ''}`}
            onClick={() => setSelectedId(d.dealer_id)}
            disabled={busy}
          >
            <span className="dealer-vault-dealer-id">{d.wallet_name || d.dealer_id}</span>
            <StatusBadge status={d.status} />
          </button>
        ))}
      </div>

      <div className="dealer-vault-dealers mb-3">
        <div className="dealer-vault-dealers-head">
          <span>Adicionar carteira</span>
        </div>
        <InputGroup size="sm" className="mb-2">
          <Form.Control
            value={newWalletName}
            onChange={(e) => setNewWalletName(e.target.value)}
            placeholder="depix_pool"
            disabled={busy}
          />
          <Button variant="outline-primary" disabled={!canCreate} onClick={handleCreate}>
            <TbPlus className="me-1" /> Criar
          </Button>
        </InputGroup>
      </div>

      {selected && (
        <div className="dealer-vault-selected-actions mb-3">
          <span className="dealer-vault-selected-label">
            <strong>{selected.wallet_name || selected.dealer_id}</strong>
          </span>
          <div className="dealer-vault-selected-btns">
            <Button size="sm" variant="outline-secondary" disabled={busy} onClick={handleSyncManager}>
              <TbRefresh className="me-1" /> Sync manager
            </Button>
            <Button size="sm" variant="outline-warning" disabled={busy} onClick={handleReset}>
              Redefinir
            </Button>
            <Button size="sm" variant="outline-danger" disabled={busy} onClick={handleDelete}>
              Remover
            </Button>
          </div>
        </div>
      )}

      {waitingKeys && (
        <Alert variant="warning" className="mb-3 py-2 dealer-vault-alert">
          Aguardando chaves do manager. Clique <strong>Sync manager</strong> ou reinicie o
          manager no celular — depois disso você pode salvar a passphrase.
        </Alert>
      )}

      {result?.ok && (
        <Alert variant="success" className="mb-3 dealer-vault-alert">
          <TbShieldCheck className="me-2" />{result.msg}
        </Alert>
      )}
      {result && !result.ok && (
        <Alert variant="danger" className="mb-3 dealer-vault-alert">{result.msg}</Alert>
      )}

      {selected && (
        <>
          {hintForSelected() && (
            <p className="dealer-vault-warning mb-3">{hintForSelected()}</p>
          )}

          {selected.status !== 'ready' && (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Passphrase da carteira</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={show ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder={`Mínimo ${MIN_LEN} caracteres`}
                    disabled={busy}
                    autoComplete="new-password"
                    isInvalid={tooShort}
                  />
                  <Button variant="outline-secondary" onClick={() => setShow((v) => !v)} tabIndex={-1}>
                    {show ? <TbEyeOff /> : <TbEye />}
                  </Button>
                </InputGroup>
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label>Confirmar passphrase</Form.Label>
                <Form.Control
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={busy}
                  autoComplete="new-password"
                  isInvalid={mismatch}
                />
              </Form.Group>

              <Button
                className="dealer-btn-primary w-100"
                disabled={!canRegister}
                onClick={handleRegister}
                title={waitingKeys ? 'Aguardando chaves do manager' : undefined}
              >
                {busy
                  ? <><TbRefresh className="dealer-spin me-1" /> Cifrando…</>
                  : waitingKeys
                    ? <><TbLock className="me-1" /> Aguardando manager…</>
                    : <><TbLock className="me-1" /> Salvar passphrase</>}
              </Button>
            </>
          )}
        </>
      )}

      <p className="dealer-vault-warning mt-3">
        1) Criar carteira → 2) Manager no celular → 3) Salvar passphrase → 4) Run no console.
      </p>
    </div>
  );
}
