import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import {
  TbWorld, TbServer, TbBroadcast, TbDeviceMobile, TbArrowsExchange,
  TbRefresh, TbArrowRight, TbBrowser,
} from 'react-icons/tb';
import { fetchVaultDealers } from './vault/vaultApi';
import { INFRA_VPS_IP } from './config';
import { countDealersByStatus } from './utils/dealerStatus';
import {
  parseWsEndpoint,
  productionSiteHost,
  isLocalDevHost,
  browserEndpoint,
  sideswapEndpoint,
  statusKind,
  formatTs,
  resolveDisplayIp,
} from './utils/architectureInfo';
import { SIDESWAP_WS_URL } from './utils/sideswapBook';

function StatusDot({ kind }) {
  return <span className={`dealer-arch-dot dealer-arch-dot-${kind}`} aria-hidden="true" />;
}

function StatusBadge({ kind, label }) {
  const bg = kind === 'ok' ? 'success' : kind === 'warn' ? 'warning' : kind === 'idle' ? 'secondary' : 'danger';
  const text = kind === 'warn' ? 'dark' : undefined;
  return <Badge bg={bg} text={text} className="dealer-arch-badge">{label}</Badge>;
}

function ArchCard({ icon: Icon, title, subtitle, kind, statusLabel, rows, className = '' }) {
  return (
    <article className={`dealer-arch-card dealer-arch-card-${kind} ${className}`.trim()}>
      <div className="dealer-arch-card-head">
        <span className="dealer-arch-card-icon"><Icon /></span>
        <div className="dealer-arch-card-titles">
          <h4>{title}</h4>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <StatusBadge kind={kind} label={statusLabel} />
      </div>
      <dl className="dealer-arch-meta">
        {rows.map(({ label, value, mono }) => (
          <div key={label} className="dealer-arch-meta-row">
            <dt>{label}</dt>
            <dd className={mono ? 'dealer-arch-mono' : undefined}>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function FlowArrow({ label, vertical = false }) {
  return (
    <div className={`dealer-arch-arrow${vertical ? ' dealer-arch-arrow-v' : ''}`} aria-hidden="true">
      <TbArrowRight />
      {label && <span>{label}</span>}
    </div>
  );
}

function VpsBalloon({ label, host, ip, children }) {
  return (
    <div className="dealer-arch-vps-balloon">
      <div className="dealer-arch-vps-balloon-cap">
        <TbServer />
        <span className="dealer-arch-vps-balloon-title">{label}</span>
        {host && <span className="dealer-arch-vps-balloon-host">{host}</span>}
        {ip && ip !== '—' && <span className="dealer-arch-vps-balloon-ip">{ip}</span>}
      </div>
      <div className="dealer-arch-vps-balloon-body">{children}</div>
    </div>
  );
}

function ArchZone({ label, kind, children, className = '' }) {
  return (
    <div className={`dealer-arch-zone dealer-arch-zone-${kind} ${className}`.trim()}>
      <span className="dealer-arch-zone-label">{label}</span>
      {children}
    </div>
  );
}

function ArchSection({ icon: Icon, title, meta, children, className = '' }) {
  return (
    <section className={`dealer-arch-section ${className}`.trim()}>
      <header className="dealer-arch-section-head">
        <Icon />
        <div>
          <h4>{title}</h4>
          {meta && <p>{meta}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

export default function ArchitecturePanel({
  wsStatus,
  wsUrl,
  lastError,
  agentConnected,
  agentMeta,
  stateTs,
  sideswapStatus,
  sideswapError,
  sideswapLastUpdate,
  dealers = [],
  sendCommand,
}) {
  const [vaultOk, setVaultOk] = useState(null);
  const [vaultChecking, setVaultChecking] = useState(false);
  const [vaultDealerCount, setVaultDealerCount] = useState(null);
  const [backendSettings, setBackendSettings] = useState(null);

  const checkVault = useCallback(async () => {
    setVaultChecking(true);
    try {
      const r = await fetchVaultDealers();
      setVaultOk(r.ok);
      setVaultDealerCount(r.ok ? (r.data?.dealers?.length ?? 0) : null);
    } catch {
      setVaultOk(false);
      setVaultDealerCount(null);
    } finally {
      setVaultChecking(false);
    }
  }, []);

  useEffect(() => {
    checkVault();
    const t = setInterval(checkVault, 30000);
    return () => clearInterval(t);
  }, [checkVault]);

  useEffect(() => {
    if (!sendCommand || wsStatus !== 'connected' || !agentConnected) {
      setBackendSettings(null);
      return;
    }
    sendCommand('get_settings', {}).then((res) => {
      if (res?.ok && res.data) setBackendSettings(res.data);
    }).catch(() => {});
  }, [sendCommand, wsStatus, agentConnected]);

  const browser = browserEndpoint();
  const relay = parseWsEndpoint(wsUrl);
  const sideswap = sideswapEndpoint();
  const prodHost = productionSiteHost();
  const localDev = isLocalDevHost();
  const dealerCounts = useMemo(() => countDealersByStatus(dealers), [dealers]);
  const liveDealers = (dealerCounts.online || 0) + (dealerCounts.unused || 0);

  const relayKind = statusKind(wsStatus);
  const managerKind = agentConnected ? 'ok' : wsStatus === 'connected' ? 'warn' : 'off';
  const vaultKind = vaultOk === null ? 'idle' : vaultOk ? 'ok' : 'off';
  const sideswapKind = statusKind(sideswapStatus);

  const siteHost = localDev ? browser.host : (window.location.hostname || prodHost);
  const vpsIp = INFRA_VPS_IP;
  const relayIp = resolveDisplayIp(relay?.host, vpsIp);
  const siteIp = resolveDisplayIp(siteHost, vpsIp);
  const sideswapIp = resolveDisplayIp(sideswap.host, '');

  const vpsLabel = localDev ? 'Local (dev)' : 'VPS';
  const vpsCombinedKind = vaultKind === 'off' || relayKind === 'off'
    ? 'off'
    : vaultKind === 'warn' || relayKind === 'warn'
      ? 'warn'
      : vaultKind === 'idle' || relayKind === 'idle'
        ? 'idle'
        : 'ok';

  return (
    <div className="dealer-arch-panel">
      <div className="dealer-arch-header">
        <div>
          <h3><TbWorld /> Arquitetura</h3>
          <p className="dealer-arch-intro">
            Console e relay rodam na mesma VPS. Um único <strong>manager_dealer</strong> conecta ao relay
            (Termux/PC). O <strong>SideSwap</strong> é servidor externo — o manager fala com a API pública.
          </p>
        </div>
        <Button size="sm" variant="outline-secondary" onClick={checkVault} disabled={vaultChecking}>
          <TbRefresh className={vaultChecking ? 'dealer-spin' : ''} /> Atualizar
        </Button>
      </div>

      <div className="dealer-arch-flow" aria-label="Fluxo de conexão">
        <div className="dealer-arch-flow-row">
          <VpsBalloon label={vpsLabel} host={siteHost} ip={siteIp}>
            <span className="dealer-arch-flow-node"><TbBrowser /> Console</span>
            <span className="dealer-arch-flow-inner" aria-hidden="true">↔</span>
            <span className="dealer-arch-flow-node"><TbBroadcast /> Relay</span>
          </VpsBalloon>

          <FlowArrow label="WebSocket" />

          <ArchZone label="Device único" kind="device">
            <span className="dealer-arch-flow-node dealer-arch-flow-node-device">
              <TbDeviceMobile /> Manager
            </span>
          </ArchZone>

          <FlowArrow label="API SideSwap" />

          <ArchZone label="Servidor externo" kind="external">
            <span className="dealer-arch-flow-node dealer-arch-flow-node-external">
              <TbArrowsExchange /> SideSwap
            </span>
          </ArchZone>
        </div>
      </div>

      <ArchSection
        icon={TbServer}
        title={vpsLabel}
        meta={[siteHost, siteIp !== '—' ? siteIp : null, 'nginx · React · vault · relay'].filter(Boolean).join(' · ')}
        className="dealer-arch-section-vps"
      >
        <div className="dealer-arch-grid dealer-arch-grid-nested">
          <div className="dealer-arch-vps-summary">
            <StatusBadge kind={vpsCombinedKind} label={`VPS ${vpsCombinedKind === 'ok' ? 'operacional' : vpsCombinedKind === 'off' ? 'com falha' : 'parcial'}`} />
            <span className="dealer-arch-vps-summary-note">
              Console (browser) e relay compartilham a mesma máquina — conexão interna via nginx/WSS.
            </span>
          </div>

          <ArchCard
            icon={TbBrowser}
            title="Console (Browser)"
            subtitle="React servido pela VPS — você abre no navegador"
            kind={relayKind}
            statusLabel={relayKind === 'ok' ? 'Conectado ao relay' : wsStatus}
            rows={[
              { label: 'Host VPS', value: siteHost, mono: true },
              { label: 'IP VPS', value: siteIp, mono: true },
              { label: 'URL', value: browser.display, mono: true },
              { label: 'Ambiente', value: localDev ? 'Desenvolvimento local' : 'Produção HTTPS' },
            ]}
          />

          <ArchCard
            icon={TbServer}
            title="Site · Vault"
            subtitle="nginx + vault_server na VPS"
            kind={vaultKind}
            statusLabel={vaultOk === null ? '…' : vaultOk ? 'Vault OK' : 'Vault off'}
            rows={[
              { label: 'Domínio', value: prodHost, mono: true },
              { label: 'Vault API', value: '/api/vault/', mono: true },
              { label: 'Carteiras', value: vaultDealerCount != null ? String(vaultDealerCount) : '—' },
            ]}
          />

          <ArchCard
            icon={TbBroadcast}
            title="Relay"
            subtitle="ws_relay_server — mesma VPS que o console"
            kind={relayKind}
            statusLabel={
              wsStatus === 'connected' ? 'Online'
                : wsStatus === 'connecting' ? 'Conectando…'
                  : wsStatus === 'error' ? 'Erro'
                    : wsStatus
            }
            rows={[
              { label: 'Host', value: relay?.host || '—', mono: true },
              { label: 'IP', value: relayIp, mono: true },
              { label: 'Porta', value: relay?.port || '—', mono: true },
              { label: 'Endpoint', value: relay?.display || wsUrl || '—', mono: true },
              { label: 'TLS', value: relay?.secure ? 'wss (sim)' : 'ws (não)' },
              ...(lastError && wsStatus === 'error'
                ? [{ label: 'Erro', value: lastError }]
                : []),
            ]}
          />
        </div>
      </ArchSection>

      <ArchSection
        icon={TbDeviceMobile}
        title="Manager — device único"
        meta="Um agente por vez no relay (Termux, PC ou celular)"
        className="dealer-arch-section-device"
      >
        <div className="dealer-arch-grid dealer-arch-grid-single">
          <ArchCard
            icon={TbDeviceMobile}
            title="manager_dealer"
            subtitle="Agente exclusivo — substitui o anterior ao reconectar"
            kind={managerKind}
            statusLabel={agentConnected ? 'Online' : 'Offline'}
            rows={[
              {
                label: 'Device',
                value: agentMeta?.hostname || (agentConnected ? '—' : 'nenhum conectado'),
                mono: true,
              },
              { label: 'Tipo', value: 'Device único (1 sessão no relay)' },
              {
                label: 'Sessão relay',
                value: agentMeta?.sessionId != null ? `#${agentMeta.sessionId}` : '—',
              },
              { label: 'Dealers', value: `${liveDealers} / ${dealers.length} PID(s)` },
              { label: 'Último sync', value: formatTs(stateTs) || '—' },
              ...(backendSettings?.ws_bridge?.relay_configured != null
                ? [{
                  label: 'WS_RELAY_URL',
                  value: backendSettings.ws_bridge.relay_configured ? 'configurado' : 'ausente',
                }]
                : []),
            ]}
          />
        </div>
      </ArchSection>

      <ArchSection
        icon={TbArrowsExchange}
        title="SideSwap — servidor externo"
        meta="API pública · fora da sua VPS"
        className="dealer-arch-section-external"
      >
        <div className="dealer-arch-grid dealer-arch-grid-single">
          <ArchCard
            icon={TbArrowsExchange}
            title="SideSwap API"
            subtitle="Livro de ordens e ind_price — infraestrutura de terceiros"
            kind={sideswapKind}
            statusLabel={
              sideswapStatus === 'connected' ? 'Online'
                : sideswapStatus === 'connecting' ? 'Conectando…'
                  : sideswapStatus === 'reconnecting' ? 'Reconectando…'
                    : sideswapStatus === 'error' ? 'Erro'
                      : sideswapStatus === 'idle' ? 'Inativo'
                        : sideswapStatus
            }
            rows={[
              { label: 'Tipo', value: 'Servidor externo (SideSwap Ltd)' },
              { label: 'Host', value: sideswap.host, mono: true },
              { label: 'IP', value: sideswapIp, mono: true },
              { label: 'Porta', value: sideswap.port, mono: true },
              { label: 'WebSocket', value: SIDESWAP_WS_URL, mono: true },
              { label: 'Último dado', value: formatTs(sideswapLastUpdate) || '—' },
              ...(sideswapError ? [{ label: 'Erro', value: sideswapError }] : []),
            ]}
          />
        </div>
      </ArchSection>

      <p className="dealer-arch-footnote">
        <StatusDot kind="ok" /> online · <StatusDot kind="warn" /> parcial · <StatusDot kind="off" /> offline.
        {' '}Fluxo: VPS (console ↔ relay) → manager (device) → SideSwap (externo).
      </p>
    </div>
  );
}
