import React, { useState } from 'react';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import Alert from 'react-bootstrap/Alert';
import ProgressBar from 'react-bootstrap/ProgressBar';
import {
  TbRefresh, TbDeviceMobile, TbCpu, TbDatabase, TbServer,
  TbAlertTriangle, TbCircleCheck, TbCircleX, TbActivity, TbWifi,
} from 'react-icons/tb';

function formatBytes(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let x = v;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i += 1;
  }
  return `${x.toFixed(x >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatUptime(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return '—';
  const s = Math.floor(Number(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function usageVariant(pct) {
  if (pct == null) return 'secondary';
  if (pct >= 90) return 'danger';
  if (pct >= 75) return 'warning';
  return 'success';
}

function MetricCard({ icon: Icon, title, subtitle, children, kind = 'idle' }) {
  return (
    <article className={`dealer-termux-card dealer-termux-card-${kind}`}>
      <div className="dealer-termux-card-head">
        <span className="dealer-termux-card-icon"><Icon /></span>
        <div>
          <h4>{title}</h4>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div className="dealer-termux-card-body">{children}</div>
    </article>
  );
}

function UsageRow({ label, used, total, percent, detail }) {
  const pct = percent != null ? Number(percent) : null;
  return (
    <div className="dealer-termux-usage">
      <div className="dealer-termux-usage-head">
        <span>{label}</span>
        <span className="dealer-termux-mono">
          {used != null && total != null
            ? `${formatBytes(used)} / ${formatBytes(total)}`
            : (detail || '—')}
          {pct != null ? ` · ${pct.toFixed(1)}%` : ''}
        </span>
      </div>
      {pct != null && (
        <ProgressBar
          now={Math.min(100, Math.max(0, pct))}
          variant={usageVariant(pct)}
          className="dealer-termux-bar"
        />
      )}
    </div>
  );
}

/** Tamanhos esperados do bootstrap (mesmos defaults do termux_ws_agent). */
const EXPECTED_CHAIN_BYTES = {
  mainnet: 32 * 1024 ** 3,
  testnet: 6 * 1024 ** 3,
};

function ChainCard({ label, network, networkKey }) {
  if (!network) {
    return (
      <MetricCard icon={TbServer} title={label} subtitle="sem dados" kind="off">
        <p className="dealer-empty mb-0">Indisponível</p>
      </MetricCard>
    );
  }

  const online = !!network.online;
  const daemon = network.daemon || {};
  const info = network.info || {};
  const dataBytes = daemon.data_bytes;
  const hasChainData = Number.isFinite(Number(dataBytes)) && Number(dataBytes) > 64 * 1024 * 1024;
  const expected = EXPECTED_CHAIN_BYTES[networkKey];
  const copyPct = hasChainData && expected
    ? Math.min(100, (100 * Number(dataBytes)) / expected)
    : null;

  // Alinha com a UI do Termux: chain no disco ≠ IBD via RPC.
  // Rótulo explícito: syncing / running (sincronizado) / stopped (parado).
  let statusLabel = 'parado';
  let kind = 'off';
  let badge = 'danger';
  if (online && info.initialblockdownload) {
    statusLabel = 'syncing';
    kind = 'warn';
    badge = 'warning';
  } else if (online) {
    statusLabel = 'running';
    kind = 'ok';
    badge = 'success';
  } else if (daemon.running) {
    statusLabel = 'RPC falhou';
    kind = 'warn';
    badge = 'warning';
  } else if (hasChainData) {
    statusLabel = 'chain no disco';
    kind = 'warn';
    badge = 'warning';
  }

  const syncPct = info.verificationprogress_percent;
  const subtitle = online
    ? (info.chain || 'rpc ok')
    : daemon.running
      ? 'daemon up · RPC down'
      : hasChainData
        ? 'parado · dados presentes'
        : 'parado';

  const tunedParams = network.tuned_params || [];

  return (
    <MetricCard
      icon={TbServer}
      title={label}
      subtitle={subtitle}
      kind={kind}
    >
      <div className="dealer-termux-badges">
        <Badge bg={badge}>{statusLabel}</Badge>
        <Badge bg={daemon.running ? 'info' : 'secondary'}>
          pid {daemon.pid ?? '—'}
        </Badge>
      </div>

      {tunedParams.length > 0 && (
        <div className="dealer-termux-tuning">
          <p className="dealer-termux-tuning-title">Config fora do padrão (RAM)</p>
          <ul className="dealer-termux-tuning-list">
            {tunedParams.map((p) => (
              <li key={p.key}>
                <code>{p.key}={p.value}</code>
                <span className="dealer-termux-tuning-default"> · padrão {p.default}</span>
                {p.note && <span className="dealer-termux-tuning-note"> — {p.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {online ? (
        <>
          <UsageRow
            label="Sync"
            percent={syncPct}
            detail={syncPct != null ? `${syncPct.toFixed(2)}% verificado` : null}
          />
          <dl className="dealer-termux-meta">
            <div><dt>Blocos</dt><dd className="dealer-termux-mono">{info.blocks?.toLocaleString?.() ?? '—'}</dd></div>
            <div><dt>Headers</dt><dd className="dealer-termux-mono">{info.headers?.toLocaleString?.() ?? '—'}</dd></div>
            <div><dt>Gap</dt><dd className="dealer-termux-mono">{info.headers_gap ?? '—'}</dd></div>
            <div><dt>Disco chain</dt><dd className="dealer-termux-mono">{formatBytes(info.size_on_disk)}</dd></div>
            <div><dt>IBD</dt><dd>{info.initialblockdownload ? 'sim' : 'não'}</dd></div>
            <div>
              <dt>Best</dt>
              <dd className="dealer-termux-mono dealer-termux-hash">
                {info.bestblockhash ? `${info.bestblockhash.slice(0, 12)}…` : '—'}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <Alert variant="warning" className="py-2 mb-2 dealer-termux-alert">
            <TbAlertTriangle />{' '}
            {hasChainData
              ? 'elementsd não está rodando — a barra abaixo é cópia/bootstrap do datadir, não sync P2P.'
              : (network.error || 'Node offline')}
          </Alert>
          {hasChainData && (
            <UsageRow
              label="Datadir (bootstrap)"
              percent={copyPct}
              used={dataBytes}
              total={expected}
              detail={copyPct == null ? formatBytes(dataBytes) : null}
            />
          )}
          <dl className="dealer-termux-meta">
            <div><dt>Datadir</dt><dd className="dealer-termux-mono">{formatBytes(dataBytes)}</dd></div>
            {daemon.pid != null && !daemon.running && (
              <div><dt>PID file</dt><dd className="dealer-termux-mono">stale ({daemon.pid})</dd></div>
            )}
          </dl>
        </>
      )}
    </MetricCard>
  );
}

/**
 * Painel alimentado pelo WSS outbound do Termux (role termux_agent no relay).
 * Props vêm de useDealerWs — sem HTTP/SSH do browser.
 */
export default function TermuxSyncPanel({
  wsStatus,
  termuxConnected,
  termuxMeta,
  termuxStatus,
  requestTermuxRefresh,
}) {
  const [refreshing, setRefreshing] = useState(false);
  const wsOk = wsStatus === 'connected';
  const data = termuxStatus?.data || null;
  const cpu = data?.cpu;
  const memory = data?.memory;
  const disk = data?.disk;
  const processes = data?.processes || [];
  const chain = data?.blockchain || {};
  const reachable = !!termuxConnected;

  const handleRefresh = async () => {
    if (!requestTermuxRefresh || !reachable) return;
    setRefreshing(true);
    try {
      await requestTermuxRefresh();
    } catch {
      /* relay já mostra erro via messages se offline */
    } finally {
      setTimeout(() => setRefreshing(false), 800);
    }
  };

  return (
    <section className="dealer-termux-panel">
      <div className="dealer-termux-header">
        <h3><TbDeviceMobile /> Termux · Liquid Sync</h3>
        <div className="dealer-termux-header-meta">
          <Badge bg="secondary" title="Canal WSS outbound">
            <TbWifi /> WSS
          </Badge>
          {termuxMeta && (
            <span className="dealer-termux-conn dealer-termux-mono">
              {termuxMeta.hostname || 'termux'}
              {termuxMeta.ip ? `@${termuxMeta.ip}` : ''}
              {termuxMeta.device ? ` · ${termuxMeta.device}` : ''}
            </span>
          )}
          <Badge bg={!wsOk ? 'secondary' : reachable ? 'success' : 'danger'}>
            {!wsOk
              ? <><TbCircleX /> relay offline</>
              : reachable
                ? <><TbCircleCheck /> agent online</>
                : <><TbCircleX /> agent offline</>}
          </Badge>
          <Button
            size="sm"
            variant="outline-secondary"
            disabled={!wsOk || !reachable || refreshing}
            onClick={handleRefresh}
          >
            <TbRefresh className={refreshing ? 'dealer-spin' : ''} />
            {refreshing ? '…' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {!wsOk ? (
        <Alert variant="warning" className="py-2">
          <TbAlertTriangle /> WebSocket do dealer offline — reconecte para ver o Termux.
        </Alert>
      ) : !reachable ? (
        <Alert variant="warning" className="py-2">
          <TbAlertTriangle />{' '}
          Termux agent não conectado. No celular (rede residencial) o agent deve abrir
          WSS outbound para <code>wss://rodolforomao.com.br/dealer-ws</code> com role{' '}
          <code>termux_agent</code>.
        </Alert>
      ) : !data ? (
        <p className="dealer-empty">Agent online — aguardando primeiro <code>termux_status</code>…</p>
      ) : null}

      {data && (
        <>
          <div className="dealer-termux-grid dealer-termux-grid-chain">
            <ChainCard label="Liquid Mainnet" networkKey="mainnet" network={chain.mainnet} />
            <ChainCard label="Liquid Testnet" networkKey="testnet" network={chain.testnet} />
          </div>

          <h4 className="dealer-termux-section-title"><TbActivity /> Saúde do device</h4>
          <div className="dealer-termux-grid dealer-termux-grid-health">
            <MetricCard
              icon={TbCpu}
              title="Processador"
              subtitle={cpu?.hardware || `${cpu?.cores ?? '—'} núcleos`}
              kind="ok"
            >
              <dl className="dealer-termux-meta">
                <div><dt>Núcleos</dt><dd className="dealer-termux-mono">{cpu?.cores ?? '—'}</dd></div>
                <div>
                  <dt>Uso (est.)</dt>
                  <dd className="dealer-termux-mono">
                    {cpu?.usage_percent_estimate != null ? `${cpu.usage_percent_estimate}%` : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Load 1/5/15</dt>
                  <dd className="dealer-termux-mono">
                    {cpu?.load_average
                      ? `${cpu.load_average['1m']} / ${cpu.load_average['5m']} / ${cpu.load_average['15m']}`
                      : '—'}
                  </dd>
                </div>
                <div><dt>Uptime</dt><dd>{formatUptime(cpu?.uptime_seconds)}</dd></div>
              </dl>
              {cpu?.usage_percent_estimate != null && (
                <UsageRow label="Carga vs núcleos" percent={cpu.usage_percent_estimate} />
              )}
            </MetricCard>

            <MetricCard
              icon={TbDatabase}
              title="Memória RAM"
              subtitle={memory?.total_bytes != null ? formatBytes(memory.total_bytes) : '—'}
              kind={usageVariant(memory?.usage_percent) === 'danger' ? 'warn' : 'ok'}
            >
              <UsageRow
                label="RAM"
                used={memory?.used_bytes}
                total={memory?.total_bytes}
                percent={memory?.usage_percent}
              />
              <UsageRow
                label="Swap"
                used={memory?.swap_used_bytes}
                total={memory?.swap_total_bytes}
                percent={
                  memory?.swap_total_bytes
                    ? (100 * (memory.swap_used_bytes || 0)) / memory.swap_total_bytes
                    : null
                }
              />
              <dl className="dealer-termux-meta">
                <div><dt>Disponível</dt><dd className="dealer-termux-mono">{formatBytes(memory?.available_bytes)}</dd></div>
                <div><dt>Cache</dt><dd className="dealer-termux-mono">{formatBytes(memory?.cached_bytes)}</dd></div>
              </dl>
            </MetricCard>

            <MetricCard
              icon={TbServer}
              title="Armazenamento"
              subtitle={disk?.mount || 'home'}
              kind={usageVariant(disk?.usage_percent) === 'danger' ? 'warn' : 'ok'}
            >
              <UsageRow
                label="Disco"
                used={disk?.used_bytes}
                total={disk?.total_bytes}
                percent={disk?.usage_percent}
              />
              <dl className="dealer-termux-meta">
                <div><dt>Livre</dt><dd className="dealer-termux-mono">{formatBytes(disk?.available_bytes)}</dd></div>
                <div><dt>FS</dt><dd className="dealer-termux-mono">{disk?.filesystem || '—'}</dd></div>
              </dl>
            </MetricCard>
          </div>

          {processes.length > 0 && (
            <>
              <h4 className="dealer-termux-section-title">Top processos (CPU)</h4>
              <div className="dealer-termux-table-wrap">
                <table className="dealer-termux-table">
                  <thead>
                    <tr>
                      <th>PID</th>
                      <th>CPU %</th>
                      <th>MEM %</th>
                      <th>RSS</th>
                      <th>Comando</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processes.map((p) => (
                      <tr key={`${p.pid}-${p.command}`}>
                        <td className="dealer-termux-mono">{p.pid}</td>
                        <td className="dealer-termux-mono">{Number(p.cpu_percent).toFixed(1)}</td>
                        <td className="dealer-termux-mono">{Number(p.mem_percent).toFixed(1)}</td>
                        <td className="dealer-termux-mono">{formatBytes((p.rss_kb || 0) * 1024)}</td>
                        <td className="dealer-termux-cmd">{p.command}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <p className="dealer-termux-footer">
            Via WSS outbound
            {termuxStatus?.ts ? ` · ${new Date(termuxStatus.ts).toLocaleTimeString()}` : ''}
            {data?.ts ? ` · sample ${new Date(data.ts * 1000).toLocaleTimeString()}` : ''}
            {termuxMeta?.sessionId != null ? ` · sessão #${termuxMeta.sessionId}` : ''}
          </p>
        </>
      )}
    </section>
  );
}
