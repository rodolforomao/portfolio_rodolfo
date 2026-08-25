import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import {
  TbSettings, TbArrowLeft, TbLogout, TbBrandTelegram, TbDeviceFloppy, TbSend,
} from 'react-icons/tb';
import { clearSession, loadSession } from './config';
import './Dealer.css';

async function api(path, init) {
  const res = await fetch(`/api/liquid-pots${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export default function DealerHubSettings() {
  const navigate = useNavigate();
  const session = loadSession();
  const [tgToken, setTgToken] = useState('');
  const [tgChat, setTgChat] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [apiOnline, setApiOnline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api('');
        if (cancelled) return;
        setApiOnline(true);
        setStatus(data.telegram || null);
        const chats = data.telegram?.chat_ids;
        if (Array.isArray(chats) && chats.length) {
          setTgChat(chats.join(', '));
        } else if (data.telegram?.chat_id) {
          setTgChat(data.telegram.chat_id);
        }
      } catch (e) {
        if (!cancelled) {
          setApiOnline(false);
          setErr(e.message || 'API de settings offline');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!session?.authenticated) {
    return <Navigate to="/dealer" replace />;
  }

  const handleLogout = () => {
    clearSession();
    navigate('/dealer', { replace: true });
  };

  const saveTelegram = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const token = tgToken.trim();
      const chat = tgChat.trim();
      if (!token || !chat) {
        throw new Error('Informe bot token e chat ID.');
      }
      const data = await api('/telegram', {
        method: 'PUT',
        body: JSON.stringify({ bot_token: token, chat_id: chat }),
      });
      setStatus(data.telegram || null);
      setTgToken('');
      setMsg('Settings salvos — Telegram disponível para todo o hub (Dealer / Analyses / Liquid TX).');
      setApiOnline(true);
    } catch (ex) {
      setErr(ex.message || 'Falha ao salvar');
    } finally {
      setBusy(false);
    }
  };

  const testTelegram = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      await api('/telegram/test', { method: 'POST', body: '{}' });
      setMsg('Mensagem de teste enviada no Telegram.');
    } catch (ex) {
      setErr(ex.message || 'Teste falhou');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dealer-root">
      <Container className="dealer-login-wrap">
        <div className="dealer-hub-card dealer-hub-settings-card">
          <div className="dealer-hub-settings-top">
            <Link to="/dealer/menu" className="dealer-tool-back">
              <TbArrowLeft /> Menu
            </Link>
            <Button variant="outline-danger" size="sm" onClick={handleLogout}>
              <TbLogout /> Sair
            </Button>
          </div>

          <div className="dealer-login-header">
            <TbSettings className="dealer-login-icon" />
            <h1>Settings</h1>
            <p>Configuração compartilhada do hub (/dealer).</p>
          </div>

          <div className="dealer-hub-settings-section">
            <h2 className="dealer-hub-settings-title">
              <TbBrandTelegram /> Telegram
            </h2>
            <p className="dealer-hub-settings-desc">
              Bot usado pelos alertas do projeto (ex.: potes do Liquid TX).
              Pode ser o mesmo bot do console Dealer.
            </p>

            <p className="dealer-hint mb-3">
              API:{' '}
              <span className={apiOnline ? 'text-success' : 'text-danger'}>
                {apiOnline ? 'online' : 'offline'}
              </span>
              {status?.configured
                ? ` · configurado (${status.source || 'settings'}${status.bot_token_masked ? ` · ${status.bot_token_masked}` : ''})`
                : ' · Telegram ainda não configurado'}
            </p>

            {msg && <Alert variant="success">{msg}</Alert>}
            {err && <Alert variant="danger">{err}</Alert>}

            <Form onSubmit={saveTelegram}>
              <Form.Group className="mb-3">
                <Form.Label>Bot token</Form.Label>
                <Form.Control
                  type="password"
                  autoComplete="off"
                  placeholder={
                    status?.bot_token_masked
                      ? `salvo: ${status.bot_token_masked}`
                      : '123456:ABC…'
                  }
                  value={tgToken}
                  onChange={(e) => setTgToken(e.target.value)}
                  disabled={busy || !apiOnline}
                />
              </Form.Group>
              <Form.Group className="mb-4">
                <Form.Label>Chat ID</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="-100… ou vários separados por vírgula"
                  value={tgChat}
                  onChange={(e) => setTgChat(e.target.value)}
                  disabled={busy || !apiOnline}
                />
              </Form.Group>
              <div className="dealer-hub-settings-actions">
                <Button
                  type="submit"
                  className="dealer-btn-primary"
                  disabled={busy || !apiOnline}
                >
                  <TbDeviceFloppy /> Salvar
                </Button>
                <Button
                  type="button"
                  variant="outline-secondary"
                  disabled={busy || !apiOnline || !status?.configured}
                  onClick={testTelegram}
                >
                  <TbSend /> Testar
                </Button>
              </div>
            </Form>
          </div>
        </div>
      </Container>
    </div>
  );
}
