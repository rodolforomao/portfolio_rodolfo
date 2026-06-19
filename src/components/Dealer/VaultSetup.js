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

// Em dev, o CRA proxy (package.json "proxy") encaminha para http://localhost:8766
// Em produção, nginx faz o proxy das rotas /api/vault/ e /admin/vault/
const VAULT_API = process.env.REACT_APP_VAULT_API_URL || '';

async function apiFetch(path, opts = {}) {
  try {
    const res = await fetch(`${VAULT_API}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: err.message } };
  }
}

function StatusBadge({ status }) {
  if (status === 'ready') {
    return <Badge bg="success" className="ms-2">pronto</Badge>;
  }
  if (status === 'registered') {
    return <Badge bg="warning" text="dark" className="ms-2">aguardando passphrase</Badge>;
  }
  return <Badge bg="secondary" className="ms-2">{status}</Badge>;
}

const MIN_LEN = 12;

export default function VaultSetup({ embedded = false }) {
  const [dealers, setDealers] = useState([]);
  const [loadingDealers, setLoadingDealers] = useState(false);
  const [dealerLoadErr, setDealerLoadErr] = useState('');

  const [dealerId, setDealerId] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // null | { ok, msg }

  const loadDealers = useCallback(async () => {
    setLoadingDealers(true);
    setDealerLoadErr('');
    const r = await apiFetch('/api/vault/dealers');
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
  const canSubmit = !busy && dealerId.trim() && passphrase.length >= MIN_LEN && passphrase === confirm;

  const handleRegister = async () => {
    setResult(null);
    setBusy(true);
    try {
      const id = dealerId.trim();

      // 1. Busca pk_m do backend do website (armazenada quando manager rodou vault_setup.py)
      const pkRes = await apiFetch(`/api/vault/pubkey/${encodeURIComponent(id)}`);
      if (!pkRes.ok) {
        setResult({
          ok: false,
          msg: pkRes.data?.error
            || `dealer_id '${id}' não encontrado. O manager precisa rodar vault_setup.py e registrar as chaves públicas primeiro.`,
        });
        return;
      }

      // 2. Cifra INTEIRAMENTE no browser — passphrase nunca sai em plaintext
      const { enc_p, sealed_r } = await encryptPassphrase(passphrase, pkRes.data.pk_m);

      // 3. Envia apenas o ciphertext para o backend armazenar
      const regRes = await apiFetch('/api/vault/passphrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealer_id: id, enc_p, sealed_r }),
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
          {' '}Registre a passphrase após rodar <code>vault_setup.py</code> no manager.
        </p>
      )}
      {embedded && (
        <>
          <h4><TbLock /> Vault</h4>
          <p className="dealer-settings-desc">
            Split-key 2-of-2 — cifração <strong>no browser</strong>. Registre a passphrase após{' '}
            <code>vault_setup.py</code> no manager.
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
          <p className="dealer-empty mb-0">
            {loadingDealers ? 'Carregando…' : 'Nenhum dealer. Rode vault_setup.py no manager e certifique-se de que vault_server.py está rodando.'}
          </p>
        )}
        {dealers.map((d) => (
          <button
            key={d.dealer_id}
            type="button"
            className={`dealer-cancel-item dealer-vault-dealer-item ${dealerId === d.dealer_id ? 'selected' : ''}`}
            onClick={() => setDealerId(d.dealer_id)}
            disabled={busy}
          >
            <span className="dealer-vault-dealer-id">{d.dealer_id}</span>
            <StatusBadge status={d.status} />
          </button>
        ))}
      </div>

      {/* dealer_id input (preenchido pelo clique acima ou manual) */}
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

      <p className="dealer-vault-warning mt-3">
        Após o registro, a passphrase não pode ser recuperada — apenas re-registrada.
        O manager (vault_setup.py) deve ter sido executado antes deste passo.
      </p>
    </div>
  );
}
