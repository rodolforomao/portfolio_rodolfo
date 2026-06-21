import React, { useState, useEffect, useCallback } from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import InputGroup from 'react-bootstrap/InputGroup';
import {
  TbLock, TbEye, TbEyeOff, TbShieldCheck, TbRefresh,
} from 'react-icons/tb';
import { encryptPassphrase } from './vault/vaultCrypto';
import {
  vaultFetch,
  fetchVaultDealers,
  createVaultDealer,
  deleteVaultDealer,
  resetVaultDealer,
} from './vault/vaultApi';

function StatusBadge({ status }) {
  if (status === 'ready') {
    return <Badge bg="success" className="ms-2">pronto</Badge>;
  }
  if (status === 'registered') {
    return <Badge bg="warning" text="dark" className="ms-2">aguardando passphrase</Badge>;
  }
  if (status === 'pending') {
    return <Badge bg="info" className="ms-2">aguardando manager</Badge>;
  }
  return <Badge bg="secondary" className="ms-2">{status}</Badge>;
}

const MIN_LEN = 12;

export default function VaultSetup({ embedded = false, onVaultReset, onRequestKeySync }) {
  const [dealers, setDealers] = useState([]);
  const [loadingDealers, setLoadingDealers] = useState(false);
  const [dealerLoadErr, setDealerLoadErr] = useState('');

  const [dealerId, setDealerId] = useState('');
  const [walletName, setWalletName] = useState('');
  const [newDealerId, setNewDealerId] = useState('');
  const [newWalletName, setNewWalletName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // null | { ok, msg }

  const loadDealers = useCallback(async () => {
    setLoadingDealers(true);
    setDealerLoadErr('');
    const r = await fetchVaultDealers();
    setLoadingDealers(false);
    if (r.ok) {
      setDealers(r.data.dealers || []);
    } else {
      setDealerLoadErr(r.data?.error || `HTTP ${r.status} — vault_server.py está rodando?`);
    }
  }, []);

  useEffect(() => { loadDealers(); }, [loadDealers]);

  const mismatch = confirm.length > 0 && passphrase !== confirm;
  const tooShort = passphrase.length > 0 && passphrase.length < MIN_LEN;
  const canSubmit = !busy && dealerId.trim() && walletName.trim()
    && passphrase.length >= MIN_LEN && passphrase === confirm;
  const canCreateDealer = !busy && newDealerId.trim() && newWalletName.trim();

  const handleCreateDealer = async () => {
    setResult(null);
    setBusy(true);
    try {
      const id = newDealerId.trim();
      const wn = newWalletName.trim();
      const r = await createVaultDealer(id, wn);
      if (!r.ok) {
        setResult({ ok: false, msg: r.data?.error || 'Falha ao criar dealer.' });
        return;
      }
      setResult({ ok: true, msg: `Dealer '${id}' (${wn}) cadastrado. Inicie o manager para registrar chaves.` });
      setDealerId(id);
      setWalletName(wn);
      setNewDealerId('');
      setNewWalletName('');
      loadDealers();
    } finally {
      setBusy(false);
    }
  };

  const handleResetDealer = async () => {
    const id = dealerId.trim();
    if (!id) return;
    const wn = walletName.trim() || id;
    if (!window.confirm(
      `Redefinir vault de '${id}' (${wn})?\n\n`
      + 'Remove chaves antigas e a passphrase cifrada. '
      + 'O manager no celular registrará chaves novas; depois cadastre a passphrase aqui de novo.',
    )) return;
    setResult(null);
    setBusy(true);
    try {
      const r = await resetVaultDealer(id);
      if (!r.ok) {
        setResult({ ok: false, msg: r.data?.error || r.data?.message || 'Falha ao redefinir vault.' });
        return;
      }
      if (onVaultReset) onVaultReset(id);
      if (onRequestKeySync) {
        try { await onRequestKeySync(); } catch { /* manager offline */ }
      }
      setResult({
        ok: true,
        msg: r.data?.message
          || `Vault de '${id}' redefinido. Aguarde o manager registrar chaves e cadastre a passphrase.`,
      });
      setPassphrase('');
      setConfirm('');
      loadDealers();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDealer = async () => {
    const id = dealerId.trim();
    if (!id) return;
    if (!window.confirm(`Remover '${id}' do Vault? Será necessário cadastrar de novo.`)) return;
    setResult(null);
    setBusy(true);
    try {
      const r = await deleteVaultDealer(id);
      if (!r.ok) {
        setResult({ ok: false, msg: r.data?.error || 'Falha ao remover dealer.' });
        return;
      }
      setResult({ ok: true, msg: `Dealer '${id}' removido. Crie novamente abaixo.` });
      setDealerId('');
      setWalletName('');
      setPassphrase('');
      setConfirm('');
      loadDealers();
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    setResult(null);
    setBusy(true);
    try {
      const id = dealerId.trim();
      const wn = walletName.trim();

      // 1. Busca pk_m do backend (manager registra chaves ao conectar)
      const pkRes = await vaultFetch(`/api/vault/pubkey/${encodeURIComponent(id)}`);
      if (!pkRes.ok) {
        setResult({
          ok: false,
          msg: pkRes.data?.error
            || `Dealer '${id}' sem chaves — inicie o manager_dealer para registrar pk_m.`,
        });
        return;
      }

      // 2. Cifra INTEIRAMENTE no browser — passphrase nunca sai em plaintext
      const { enc_p, sealed_r } = await encryptPassphrase(passphrase, pkRes.data.pk_m);

      // 3. Envia apenas o ciphertext para o backend armazenar
      const regRes = await vaultFetch('/api/vault/passphrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealer_id: id, wallet_name: wn, enc_p, sealed_r }),
      });

      if (!regRes.ok) {
        setResult({ ok: false, msg: regRes.data?.error || 'Falha ao salvar vault.' });
        return;
      }

      setResult({
        ok: true,
        msg: `Vault de '${id}' registrado. Passphrase cifrada no browser (nunca trafegou em plaintext).`,
      });
      setPassphrase('');
      setConfirm('');
      loadDealers();
    } catch (err) {
      setResult({ ok: false, msg: `Erro de criptografia: ${err.message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={embedded ? 'dealer-settings-section' : 'dealer-form-block'}>
      {!embedded && (
        <p className="dealer-vault-desc">
          <TbLock /> Split-key vault 2-of-2 — cifração <strong>no browser</strong> (X25519 + ChaCha20-Poly1305 + HKDF-SHA256).
          {' '}O manager no celular gera chaves automaticamente; use <strong>Redefinir vault</strong> ao trocar de aparelho.
        </p>
      )}
      {embedded && (
        <>
          <h4><TbLock /> Vault</h4>
          <p className="dealer-settings-desc">
            Fonte de verdade dos dealers — cadastre <strong>dealer_id</strong> e <strong>wallet_name</strong> aqui.
            Passphrase cifrada no browser; o manager só busca o vault pronto.
          </p>
        </>
      )}

      {/* Lista de dealers com status */}
      <div className="dealer-vault-dealers mb-3">
        <div className="dealer-vault-dealers-head">
          <span>Dealers registrados</span>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={loadDealers}
            disabled={loadingDealers}
          >
            <TbRefresh className={loadingDealers ? 'dealer-spin' : ''} />
          </Button>
        </div>
        {dealerLoadErr && (
          <p className="dealer-vault-warning mt-1 mb-1" style={{ color: '#f85149' }}>
            {dealerLoadErr}
          </p>
        )}
        {!dealerLoadErr && dealers.length === 0 && (
          <Alert variant="info" className="mb-2 py-2 dealer-vault-alert">
            Catálogo vazio. Crie <strong>dealer_id</strong> + <strong>wallet_name</strong> abaixo.
            O manager no celular não guarda nomes — tudo fica aqui no Vault.
          </Alert>
        )}
        {dealers.map((d) => (
          <button
            key={d.dealer_id}
            type="button"
            className={`dealer-cancel-item dealer-vault-dealer-item ${dealerId === d.dealer_id ? 'selected' : ''}`}
            onClick={() => {
              setDealerId(d.dealer_id);
              setWalletName(d.wallet_name || '');
            }}
            disabled={busy}
          >
            <span className="dealer-vault-dealer-id">{d.dealer_id}</span>
            {d.wallet_name && (
              <span className="dealer-vault-dealer-wallet ms-2">{d.wallet_name}</span>
            )}
            <StatusBadge status={d.status} />
          </button>
        ))}
      </div>

      <div className="dealer-vault-dealers mb-3">
        <div className="dealer-vault-dealers-head">
          <span>Novo dealer</span>
        </div>
        <Form.Group className="mb-2">
          <Form.Label className="mb-1">Dealer ID</Form.Label>
          <Form.Control
            size="sm"
            value={newDealerId}
            onChange={(e) => setNewDealerId(e.target.value)}
            placeholder="dealer_3"
            disabled={busy}
          />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label className="mb-1">Wallet name</Form.Label>
          <Form.Control
            size="sm"
            value={newWalletName}
            onChange={(e) => setNewWalletName(e.target.value)}
            placeholder="depix_pool"
            disabled={busy}
          />
        </Form.Group>
        <Button
          size="sm"
          variant="outline-primary"
          disabled={!canCreateDealer}
          onClick={handleCreateDealer}
        >
          Criar dealer
        </Button>
      </div>

      {/* dealer_id + wallet_name */}
      <Form.Group className="mb-3">
        <Form.Label>Dealer ID</Form.Label>
        <Form.Control
          size="sm"
          value={dealerId}
          onChange={(e) => setDealerId(e.target.value)}
          placeholder="dealer_1"
          disabled={busy}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Wallet name</Form.Label>
        <Form.Control
          size="sm"
          value={walletName}
          onChange={(e) => setWalletName(e.target.value)}
          placeholder="depix_pool"
          disabled={busy}
        />
      </Form.Group>

      {result?.ok && (
        <Alert variant="success" className="mb-3 dealer-vault-alert">
          <TbShieldCheck className="me-2" />{result.msg}
        </Alert>
      )}
      {result && !result.ok && (
        <Alert variant="danger" className="mb-3 dealer-vault-alert">{result.msg}</Alert>
      )}

      <Form.Group className="mb-3">
        <Form.Label>Passphrase da carteira</Form.Label>
        <InputGroup>
          <Form.Control
            type={show ? 'text' : 'password'}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder={`Passphrase LWK / Elements (mín. ${MIN_LEN} chars)`}
            disabled={busy || !dealerId.trim()}
            autoComplete="new-password"
            isInvalid={tooShort}
          />
          <Button
            variant="outline-secondary"
            onClick={() => setShow((v) => !v)}
            tabIndex={-1}
          >
            {show ? <TbEyeOff /> : <TbEye />}
          </Button>
          {tooShort && (
            <Form.Control.Feedback type="invalid">
              Mínimo {MIN_LEN} caracteres.
            </Form.Control.Feedback>
          )}
        </InputGroup>
      </Form.Group>

      <Form.Group className="mb-4">
        <Form.Label>Confirmar passphrase</Form.Label>
        <Form.Control
          type={show ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repita a passphrase"
          disabled={busy || !dealerId.trim()}
          autoComplete="new-password"
          isInvalid={mismatch}
        />
        {mismatch && (
          <Form.Control.Feedback type="invalid">
            As passphrases não coincidem.
          </Form.Control.Feedback>
        )}
      </Form.Group>

      <Button
        className="dealer-btn-primary w-100"
        disabled={!canSubmit}
        onClick={handleRegister}
      >
        {busy
          ? <><TbRefresh className="dealer-spin me-1" /> Cifrando…</>
          : <><TbLock className="me-1" /> Registrar Vault{dealerId.trim() ? ` (${dealerId.trim()})` : ''}</>}
      </Button>

      {dealerId.trim() && (
        <>
          <Button
            variant="outline-warning"
            size="sm"
            className="w-100 mt-2"
            disabled={busy}
            onClick={handleResetDealer}
          >
            Redefinir vault (novo celular / chaves)
          </Button>
          <Button
            variant="outline-danger"
            size="sm"
            className="w-100 mt-2"
            disabled={busy}
            onClick={handleDeleteDealer}
          >
            Remover {dealerId.trim()} do Vault
          </Button>
        </>
      )}

      <p className="dealer-vault-warning mt-3">
        Fluxo: (1) criar dealer → (2) manager registra chaves → (3) cadastrar passphrase.
        Troca de celular: use <strong>Redefinir vault</strong>, reinicie o manager no Termux
        e cadastre a passphrase de novo (não precisa copiar arquivos do PC).
      </p>
    </div>
  );
}
