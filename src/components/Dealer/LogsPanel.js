import React, { useState, useCallback, useEffect, useRef } from 'react';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import { TbRefresh, TbTrash, TbBug, TbChevronDown, TbChevronUp } from 'react-icons/tb';

const LEVEL_ORDER = ['critical', 'error', 'warning', 'info', 'debug'];
const LEVEL_VARIANT = {
  critical: 'danger',
  error: 'danger',
  warning: 'warning',
  info: 'info',
  debug: 'secondary',
};
const SOURCE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'bridge.command', label: 'Comando' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'startup.vault', label: 'Vault startup' },
];

function levelIndex(level) {
  const i = LEVEL_ORDER.indexOf(level);
  return i >= 0 ? i : LEVEL_ORDER.length;
}

function LogRow({ entry }) {
  const [open, setOpen] = useState(false);
  const variant = LEVEL_VARIANT[entry.level] || 'secondary';
  const hasDetail = !!entry.detail;

  return (
    <>
      <tr
        className={`dealer-log-row dealer-log-row-${entry.level}${hasDetail ? ' dealer-log-row-expandable' : ''}`}
        onClick={() => hasDetail && setOpen((v) => !v)}
      >
        <td className="dealer-log-ts">
          {entry.ts ? new Date(entry.ts).toLocaleTimeString('pt-BR') : '—'}
        </td>
        <td>
          <Badge bg={variant} className="dealer-log-level-badge">{entry.level}</Badge>
        </td>
        <td className="dealer-log-source">{entry.source || '—'}</td>
        <td className="dealer-log-message">{entry.message}</td>
        <td className="dealer-log-expand-col">
          {hasDetail && (open ? <TbChevronUp /> : <TbChevronDown />)}
        </td>
      </tr>
      {open && hasDetail && (
        <tr className="dealer-log-detail-row">
          <td colSpan={5}>
            <pre className="dealer-log-detail">{entry.detail}</pre>
          </td>
        </tr>
      )}
    </>
  );
}

export default function LogsPanel({
  sendCommand,
  wsStatus,
  wsEvents = [],
  logSummary = null,
}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [levelFilter, setLevelFilter] = useState('warning');
  const [sourceFilter, setSourceFilter] = useState('');
  const wsOk = wsStatus === 'connected';
  const dedupeRef = useRef(new Set());

  const fetchLogs = useCallback(async () => {
    if (!wsOk || !sendCommand) return;
    setLoading(true);
    try {
      const result = await sendCommand('get_logs', {
        level: levelFilter || 'debug',
        ...(sourceFilter ? { source: sourceFilter } : {}),
        limit: 200,
      });
      if (result?.ok && result.data) {
        const entries = result.data.logs || [];
        setLogs(entries);
        setErrorCount(result.data.error_count || 0);
        dedupeRef.current = new Set(entries.map((e) => `${e.ts}|${e.message}`));
      }
    } catch {
      // silencioso — erro já logado no logger
    } finally {
      setLoading(false);
    }
  }, [wsOk, sendCommand, levelFilter, sourceFilter]);

  const clearLogs = useCallback(async () => {
    if (!wsOk || !sendCommand) return;
    await sendCommand('clear_logs', {});
    setLogs([]);
    setErrorCount(0);
    dedupeRef.current.clear();
  }, [wsOk, sendCommand]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Recebe log_event em tempo real e prepend na lista
  useEffect(() => {
    if (!wsEvents.length) return;
    const last = wsEvents[wsEvents.length - 1];
    if (last?.event !== 'log_event') return;
    const entry = last.data;
    if (!entry) return;

    // Aplica filtro de nível
    if (levelIndex(entry.level) > levelIndex(levelFilter || 'debug')) return;
    if (sourceFilter && entry.source !== sourceFilter) return;

    const key = `${entry.ts}|${entry.message}`;
    if (dedupeRef.current.has(key)) return;
    dedupeRef.current.add(key);

    setLogs((prev) => [entry, ...prev.slice(0, 299)]);
    if (entry.level === 'error' || entry.level === 'critical') {
      setErrorCount((n) => n + 1);
    }
  }, [wsEvents, levelFilter, sourceFilter]);

  // Sincroniza error_count do state_update
  useEffect(() => {
    if (logSummary?.error_count != null) {
      setErrorCount(logSummary.error_count);
    }
  }, [logSummary?.error_count]);

  return (
    <section className="dealer-logs-panel">
      <div className="dealer-logs-header">
        <h3>
          <TbBug /> Logs do Manager
          {errorCount > 0 && (
            <Badge bg="danger" className="ms-2">
              {errorCount} erro{errorCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </h3>
        <div className="dealer-logs-header-actions">
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={fetchLogs}
            disabled={loading || !wsOk}
            className="dealer-tx-refresh"
          >
            <TbRefresh className={loading ? 'dealer-spin' : ''} />
            {loading ? '…' : 'Atualizar'}
          </Button>
          <Button
            size="sm"
            variant="outline-danger"
            onClick={clearLogs}
            disabled={!wsOk}
            className="dealer-tx-refresh"
          >
            <TbTrash /> Limpar
          </Button>
        </div>
      </div>

      {/* Último erro em destaque */}
      {logSummary?.last_error && (
        <div className="dealer-logs-last-error">
          <Badge bg={LEVEL_VARIANT[logSummary.last_error.level] || 'secondary'}>
            {logSummary.last_error.level}
          </Badge>
          {' '}
          <span className="dealer-logs-last-error-source">{logSummary.last_error.source}</span>
          {' — '}
          <span className="dealer-logs-last-error-msg">{logSummary.last_error.message}</span>
          <span className="dealer-logs-last-error-ts">
            {logSummary.last_error.ts
              ? new Date(logSummary.last_error.ts).toLocaleTimeString('pt-BR')
              : ''}
          </span>
        </div>
      )}

      {/* Filtros */}
      <div className="dealer-logs-filters">
        <div className="dealer-logs-filter-group">
          <span className="dealer-logs-filter-label">Nível:</span>
          {LEVEL_ORDER.map((lv) => (
            <button
              key={lv}
              className={`dealer-logs-filter-btn dealer-logs-level-${lv}${levelFilter === lv ? ' active' : ''}`}
              onClick={() => setLevelFilter(lv)}
            >
              {lv}
            </button>
          ))}
        </div>
        <div className="dealer-logs-filter-group">
          <span className="dealer-logs-filter-label">Origem:</span>
          {SOURCE_OPTIONS.map((s) => (
            <button
              key={s.value || 'all'}
              className={`dealer-logs-filter-btn${sourceFilter === s.value ? ' active' : ''}`}
              onClick={() => setSourceFilter(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      {!wsOk ? (
        <p className="dealer-empty">WebSocket offline — logs indisponíveis.</p>
      ) : logs.length === 0 && !loading ? (
        <p className="dealer-empty">
          Nenhum log com nível <strong>{levelFilter}</strong> ou superior.
          Clique em <strong>Atualizar</strong> para buscar.
        </p>
      ) : (
        <div className="dealer-logs-table-wrap">
          <table className="dealer-logs-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Nível</th>
                <th>Origem</th>
                <th>Mensagem</th>
                <th className="dealer-log-expand-col" />
              </tr>
            </thead>
            <tbody>
              {logs.map((entry, i) => (
                <LogRow key={`${entry.ts}-${i}`} entry={entry} />
              ))}
            </tbody>
          </table>
          <p className="dealer-tx-limit-note">{logs.length} entrada{logs.length !== 1 ? 's' : ''} carregada{logs.length !== 1 ? 's' : ''}.</p>
        </div>
      )}

      <p className="dealer-tx-footnote">
        Logs em memória no manager (até 500 entradas).{' '}
        <strong>Atualizar</strong> busca o buffer via <code>get_logs</code>.{' '}
        Novos erros chegam em tempo real via evento <code>log_event</code>.
      </p>
    </section>
  );
}
