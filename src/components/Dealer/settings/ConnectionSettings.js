import React from 'react';
import Badge from 'react-bootstrap/Badge';
import { resolveWsUrl } from '../config';

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
  wsStatus,
  agentConnected,
  wsUrl,
  settings,
}) {
  const vaultApi = process.env.REACT_APP_VAULT_API_URL || '(same-origin / proxy dev)';

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

      <p className="dealer-settings-hint">
        Token e credenciais ficam no <code>.env</code> do site e do manager — não são exibidos aqui.
      </p>
    </div>
  );
}
