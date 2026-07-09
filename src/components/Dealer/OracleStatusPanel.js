import React, { useState, useCallback, useEffect } from 'react';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import Alert from 'react-bootstrap/Alert';
import { TbRefresh, TbGauge, TbAlertTriangle } from 'react-icons/tb';

const POLL_MS = 15000;

const LEVEL_VARIANT = {
  none: 'secondary',
  warning: 'warning',
  pause: 'warning',
  cancel: 'danger',
  lockdown: 'danger',
};

const LEVEL_LABEL = {
  none: 'normal',
  warning: 'aviso',
  pause: 'pausado',
  cancel: 'cancelado',
  lockdown: 'lockdown',
};

function formatPct(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${Number(v).toFixed(2)}%`;
}

function ThresholdRow({ label, cfg }) {
  if (!cfg) return null;
  return (
    <tr>
      <td>{label}</td>
      <td>{formatPct(cfg.drop_percent != null ? cfg.drop_percent * 100 : null)}</td>
      <td>{cfg.window != null ? `${cfg.window}s` : '—'}</td>
    </tr>
  );
}

export default function OracleStatusPanel({ sendCommand, wsStatus }) {
  const [oracle, setOracle] = useState(null);
  const [flashCrash, setFlashCrash] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const wsOk = wsStatus === 'connected';

  const fetchStatus = useCallback(async () => {
    if (!wsOk || !sendCommand) return;
    setLoading(true);
    setError(null);
    try {
      const [oracleRes, fcRes] = await Promise.all([
        sendCommand('get_oracle_status', {}),
        sendCommand('get_flash_crash_status', {}),
      ]);
      if (oracleRes?.ok && oracleRes.data) setOracle(oracleRes.data);
      if (fcRes?.ok && fcRes.data) setFlashCrash(fcRes.data);
      if ((!oracleRes?.ok && !fcRes?.ok)) {
        setError('Backend não respondeu a get_oracle_status/get_flash_crash_status.');
      }
    } catch {
      setError('Falha ao buscar status do oracle.');
    } finally {
      setLoading(false);
    }
  }, [wsOk, sendCommand]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!wsOk) return undefined;
    const id = setInterval(fetchStatus, POLL_MS);
    return () => clearInterval(id);
  }, [wsOk, fetchStatus]);

  const pairs = oracle?.pairs || [];
  const activeProtections = flashCrash?.active_protections || [];

  return (
    <section className="dealer-oracle-panel">
      <div className="dealer-oracle-header">
        <h3><TbGauge /> Oracle &amp; Flash Crash</h3>
        <Button
          size="sm"
          variant="outline-secondary"
          className="ms-auto"
          disabled={loading || !wsOk}
          onClick={fetchStatus}
        >
          <TbRefresh className={loading ? 'dealer-spin' : ''} /> {loading ? '…' : 'Atualizar'}
        </Button>
      </div>

      {!wsOk ? (
        <p className="dealer-empty">WebSocket offline — status indisponível.</p>
      ) : (
        <>
          {error && <Alert variant="danger" className="py-2"><TbAlertTriangle /> {error}</Alert>}

          <div className="dealer-oracle-summary">
            <Badge bg={flashCrash?.enabled ? 'success' : 'secondary'}>
              flash crash {flashCrash?.enabled ? 'ativo' : 'desativado'}
            </Badge>
            <Badge bg={flashCrash?.running ? 'success' : 'secondary'}>
              serviço {flashCrash?.running ? 'rodando' : 'parado'}
            </Badge>
            <Badge bg={flashCrash?.auto_cancel ? 'info' : 'secondary'}>
              auto-cancel {flashCrash?.auto_cancel ? 'on' : 'off'}
            </Badge>
            <Badge bg={flashCrash?.oracle_enabled ? 'info' : 'secondary'}>
              oracle {flashCrash?.oracle_enabled ? 'on' : 'off'}
            </Badge>
          </div>

          {activeProtections.length > 0 && (
            <Alert variant="danger" className="dealer-oracle-active-alert">
              <strong>Proteção ativa agora:</strong>
              <ul className="mb-0">
                {activeProtections.map((p) => (
                  <li key={p.pair}>
                    <code>{p.pair}</code> — nível <strong>{LEVEL_LABEL[p.level] || p.level}</strong>,
                    {' '}queda {formatPct(p.drop_percent)}
                    {p.is_oracle_anomaly ? ' (anomalia de oracle)' : ''}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          <p className="dealer-oracle-subtitle">
            Pares com ordem ativa ({oracle?.active_count ?? pairs.length})
          </p>
          {!pairs.length ? (
            <p className="dealer-empty">Nenhum par com ordem ativa no momento.</p>
          ) : (
            <div className="dealer-oracle-table-wrap">
              <table className="dealer-oracle-table">
                <thead>
                  <tr>
                    <th>Par</th>
                    <th>Preço SideSwap</th>
                    <th>Maior desvio</th>
                    <th>Exchange</th>
                    <th>Proteção</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((p) => {
                    const level = p.protection_level || 'none';
                    const deviation = p.max_deviation_pct;
                    const deviationHigh = deviation != null && Math.abs(deviation) >= 1;
                    return (
                      <tr key={p.pair}>
                        <td><code>{p.pair}</code></td>
                        <td>{p.sideswap_price ? p.sideswap_price.toLocaleString('pt-BR') : '—'}</td>
                        <td className={deviationHigh ? 'dealer-oracle-deviation-high' : ''}>
                          {formatPct(deviation)}
                        </td>
                        <td>{p.max_exchange || '—'}</td>
                        <td>
                          <Badge bg={LEVEL_VARIANT[level] || 'secondary'}>
                            {LEVEL_LABEL[level] || level}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {flashCrash?.thresholds && (
            <details className="dealer-oracle-thresholds">
              <summary>Limiares de proteção configurados</summary>
              <table className="dealer-oracle-table">
                <thead>
                  <tr>
                    <th>Nível</th>
                    <th>Queda</th>
                    <th>Janela</th>
                  </tr>
                </thead>
                <tbody>
                  <ThresholdRow label="Warning" cfg={flashCrash.thresholds.warning} />
                  <ThresholdRow label="Pause" cfg={flashCrash.thresholds.pause} />
                  <ThresholdRow label="Cancel" cfg={flashCrash.thresholds.cancel} />
                  <ThresholdRow label="Lockdown" cfg={flashCrash.thresholds.lockdown} />
                </tbody>
              </table>
            </details>
          )}

          <p className="dealer-tx-footnote">
            Dados via <code>get_oracle_status</code>/<code>get_flash_crash_status</code>,
            atualiza sozinho a cada {Math.round(POLL_MS / 1000)}s.
          </p>
        </>
      )}
    </section>
  );
}
