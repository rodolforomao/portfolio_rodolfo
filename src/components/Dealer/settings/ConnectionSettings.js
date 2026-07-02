import React, { useEffect, useState } from 'react';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import { TbRefresh } from 'react-icons/tb';
import { resolveWsUrl } from '../config';

const UPDATE_RESTART_STATUS_LABEL = {
  error: 'Falhou',
  up_to_date: 'Nada para atualizar',
  restarting: 'Atualizado — reiniciando',
};

function StatusRow({ label, ok, detail }) {
  return (
    <div className="dealer-settings-row">
      <span className="dealer-settings-row-label">{label}</span>
      <span className="dealer-settings-row-value">
        <Badge bg={ok ? 'success' : 'secondary'}>{ok ? 'OK' : '—'}</Badge>
        {detail && <span className="dealer-settings-row-detail">{detail}</span>}
      </span>
    </div>
  );
}

export default function ConnectionSettings({
  sendCommand,
  wsStatus,
  agentConnected,
  agentMeta,
  wsUrl,
  settings,
  updateRestartResult,
  onDismissUpdateRestartResult,
}) {
  const vaultApi = process.env.REACT_APP_VAULT_API_URL || '(same-origin / proxy dev)';

  const [busy, setBusy] = useState(false);
  const [updateRestartArmed, setUpdateRestartArmed] = useState(false);
  const [updateRestartPending, setUpdateRestartPending] = useState(false);
  const [gitpassToken, setGitpassToken] = useState('');
  const [savingGitpass, setSavingGitpass] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (updateRestartResult) setUpdateRestartPending(false);
  }, [updateRestartResult]);

  const run = async (action, params) => {
    if (wsStatus !== 'connected' || !sendCommand) {
      setLocalError('WebSocket não conectado ao relay.');
      return { ok: false };
    }
    setBusy(true);
    setLocalError(null);
    try {
      return await sendCommand(action, params);
    } catch (err) {
      setLocalError(err.message);
      return { ok: false };
    } finally {
      setBusy(false);
    }
  };

  // Roda git pull + reinício do manager_dealer.py em produção. Ação acionada
  // pelo usuário (não pela IA) — a conexão WS cai e reconecta sozinha em
  // seguida, o cliente relay/bridge já trata isso.
  const runUpdateAndRestart = async () => {
    onDismissUpdateRestartResult?.();
    const result = await run('update_and_restart', { confirm: true });
    if (result?.ok) setUpdateRestartPending(true);
  };

  const handleUpdateAndRestart = async () => {
    if (!updateRestartArmed) { setUpdateRestartArmed(true); return; }
    setUpdateRestartArmed(false);
    await runUpdateAndRestart();
  };

  // Provisiona ~/gitpass remotamente quando update_and_restart falha por
  // credencial ausente/inválida — token só vive no estado local até o
  // envio, nunca é logado (ver redactSensitiveParams em useDealerWs.js).
  const handleSaveGitpass = async () => {
    const token = gitpassToken;
    if (!token.trim()) return;
    setGitpassToken('');
    setSavingGitpass(true);
    try {
      const result = await run('set_git_credentials', { token, confirm: true });
      if (result?.ok) await runUpdateAndRestart();
    } finally {
      setSavingGitpass(false);
    }
  };

  const updateRestartErrorText = `${updateRestartResult?.message || ''} ${updateRestartResult?.stderr || ''}`;
  const gitCredentialError = updateRestartResult?.status === 'error'
    && /gitpass|authentication failed|invalid username or token|password authentication/i.test(updateRestartErrorText);
  const gitpassSaveDisabled = savingGitpass || !gitpassToken.trim();
  const gitpassSaveLabel = savingGitpass ? 'Salvando…' : 'Salvar e tentar de novo';

  // PID do manager_dealer.py em si (processo que roda o update_and_restart)
  // — diferente do PID de cada dealer individual, mostrado nos cards do
  // dashboard, não aqui.
  const managerPidParts = [
    agentMeta?.pid ? `PID do manager_dealer.py: ${agentMeta.pid}` : 'PID do manager_dealer.py: desconhecido (agentMeta ainda não chegou)',
    agentMeta?.sessionId != null ? `sessão #${agentMeta.sessionId}` : null,
  ];
  const managerPidLabel = managerPidParts.filter(Boolean).join(' · ');

  return (
    <div className="dealer-settings-section">
      <h4>Conexão</h4>
      <p className="dealer-settings-desc">
        <strong>Relay</strong> = conexão deste browser com o ws_relay_server.{' '}
        <strong>Manager</strong> = processo manager_dealer no relay (comandos e sync).{' '}
        <strong>Dealers</strong> = processos SideSwap individuais (PIDs) — status separado na barra do dashboard.
      </p>

      <div className="dealer-settings-card">
        <StatusRow
          label="WebSocket relay"
          ok={wsStatus === 'connected'}
          detail={wsStatus === 'connected' ? 'browser ↔ relay' : wsStatus}
        />
        <StatusRow
          label="Manager no relay"
          ok={agentConnected}
          detail={agentConnected ? 'manager_dealer conectado' : 'backend ausente'}
        />
        <div className="dealer-settings-row">
          <span className="dealer-settings-row-label">URL do relay</span>
          <code className="dealer-settings-code">{wsUrl || resolveWsUrl()}</code>
        </div>
        <div className="dealer-settings-row">
          <span className="dealer-settings-row-label">API Vault (site)</span>
          <code className="dealer-settings-code">{vaultApi}</code>
        </div>
      </div>

      {settings && (
        <div className="dealer-settings-card mt-3">
          <h5 className="dealer-settings-subtitle">Backend (manager)</h5>
          <StatusRow
            label="WS_RELAY_URL"
            ok={settings.ws_bridge?.relay_configured}
          />
          <StatusRow
            label="Vault mode"
            ok={settings.vault?.mode_enabled}
            detail={settings.vault?.mode_enabled ? 'VAULT_MODE=true' : 'desligado'}
          />
          <StatusRow
            label="Histórico API"
            ok={settings.history?.api_configured}
          />
          <StatusRow
            label="Histórico SSH"
            ok={settings.history?.ssh_configured}
          />
        </div>
      )}

      <div className="dealer-settings-card mt-3">
        <h5 className="dealer-settings-subtitle">Manutenção do manager</h5>
        <p className="dealer-clear-toml-hint">
          Roda <code>git pull</code> em produção e reinicia o <code>manager_dealer.py</code>{' '}
          (mantém o mesmo PID via <code>os.execv</code> — dealers já rodando não são
          derrubados, e cada um tem seu próprio PID, diferente do PID abaixo). A conexão
          cai e reconecta sozinha em alguns segundos.
        </p>
        <p className="dealer-clear-toml-hint dealer-manager-pid-label">
          <code>{managerPidLabel}</code>
        </p>
        {localError && <p className="dealer-clear-toml-hint mb-1">{localError}</p>}
        <Button
          size="sm"
          variant={updateRestartArmed ? 'danger' : 'outline-danger'}
          disabled={busy || wsStatus !== 'connected'}
          onClick={handleUpdateAndRestart}
        >
          <TbRefresh /> {updateRestartArmed ? 'Confirmar — atualizar e reiniciar agora' : 'Atualizar e reiniciar manager'}
        </Button>
        {updateRestartArmed && (
          <Button
            size="sm"
            variant="outline-secondary"
            className="ms-2"
            disabled={busy}
            onClick={() => setUpdateRestartArmed(false)}
          >
            Cancelar
          </Button>
        )}
        {updateRestartPending && !updateRestartResult && (
          <p className="dealer-clear-toml-hint mt-2 mb-0">
            <span className="dealer-spin">⏳</span> Aguardando resultado real do backend
            (evento <code>update_and_restart_result</code>)…
          </p>
        )}
        {updateRestartResult && (
          <div className={`dealer-update-restart-result dealer-update-restart-${updateRestartResult.status}`}>
            <strong>{UPDATE_RESTART_STATUS_LABEL[updateRestartResult.status]}</strong>
            <p className="mb-0">{updateRestartResult.message}</p>
            <pre className="dealer-update-restart-stderr">{updateRestartResult.stderr}</pre>
            <button
              type="button"
              className="dealer-pair-default-delete"
              onClick={onDismissUpdateRestartResult}
            >
              Dispensar
            </button>
          </div>
        )}
        {gitCredentialError && (
          <div className="dealer-gitpass-form">
            <p className="dealer-clear-toml-hint mb-1">
              Falta ou está inválido o token do GitHub (<code>~/gitpass</code>) no
              ambiente do manager — o GitHub não aceita mais usuário/senha, só
              token (PAT). Cole um token válido abaixo para salvar/substituir —
              não é exibido nem gravado em nenhum log.
            </p>
            <div className="dealer-gitpass-form-row">
              <input
                type="password"
                autoComplete="off"
                className="dealer-gitpass-input"
                placeholder="Token do GitHub (PAT)"
                value={gitpassToken}
                onChange={(e) => setGitpassToken(e.target.value)}
                disabled={savingGitpass}
              />
              <Button
                size="sm"
                variant="outline-primary"
                disabled={gitpassSaveDisabled}
                onClick={handleSaveGitpass}
              >
                {gitpassSaveLabel}
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="dealer-settings-hint">
        Token e credenciais ficam no <code>.env</code> do site e do manager — não são exibidos aqui.
      </p>
    </div>
  );
}
