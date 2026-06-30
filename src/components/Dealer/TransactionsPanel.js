import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { log } from './utils/logger';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import { TbRefresh, TbChartLine, TbArrowRight, TbTrendingUp, TbTrendingDown, TbCoin, TbWallet, TbArrowsExchange, TbChevronDown, TbChevronUp, TbDownload } from 'react-icons/tb';
import { ManagerBadge } from './SourceBadge';
import {
  formatTxTimestamp,
  profitClass,
  formatAmount,
  categoryBadgeVariant,
  CATEGORY_FILTER_OPTIONS,
} from './utils/transactionFormat';

const SATS = 1e8;

// Cache de estado do histórico — persiste entre trocas de aba (módulo-level, por sessão)
// Chave: `${pid ?? 'all'}|${period}` — valor: { hash, total, syncedAt }
const _txSyncCache = {};
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos entre bgSyncs automáticos

function _cacheKey(pid, period) {
  return `${pid ?? 'all'}|${period ?? ''}`;
}
function _isCacheFresh(pid, period, serverHash, serverTotal) {
  const c = _txSyncCache[_cacheKey(pid, period)];
  if (!c) return false;
  const hashMatch = c.hash === serverHash && c.total === serverTotal;
  const recent = Date.now() - c.syncedAt < SYNC_COOLDOWN_MS;
  return hashMatch && recent;
}
function _updateCache(pid, period, hash, total) {
  _txSyncCache[_cacheKey(pid, period)] = { hash, total, syncedAt: Date.now() };
}

function fmtAsset(asset, value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  if (asset === 'L-BTC') {
    if (Math.abs(n) < 0.01) return `${Math.round(n * SATS).toLocaleString('pt-BR')} sats`;
    return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} L-BTC`;
  }
  if (asset === 'USDt') return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDt`;
  if (asset === 'DePix') return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DePix`;
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} ${asset || ''}`;
}

function fmtPct(v) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  const n = Number(v);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

const PERIOD_OPTIONS = [
  { value: '', label: 'Tudo' },
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
];

function periodToSince(period) {
  if (!period) return null;
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (period === '7d') {
    return new Date(now - 7 * 86400 * 1000).toISOString();
  }
  if (period === '30d') {
    return new Date(now - 30 * 86400 * 1000).toISOString();
  }
  return null;
}

/* ── KPI card ── */
function KpiCard({ icon: Icon, label, value, sub, trend, kind, loading }) {
  const kindClass = kind === 'lucro' ? 'kpi-lucro' : kind === 'perda' ? 'kpi-perda' : kind === 'info' ? 'kpi-info' : '';
  const trendClass = trend > 0 ? 'dealer-kpi-trend-up' : trend < 0 ? 'dealer-kpi-trend-down' : 'dealer-kpi-trend-neutral';
  return (
    <div className={`dealer-kpi-card ${kindClass}`}>
      <div className="dealer-kpi-icon"><Icon size={18} /></div>
      <div className="dealer-kpi-label">{label}</div>
      <div className={`dealer-kpi-value${loading ? ' dealer-kpi-loading' : ''}`}>{loading ? '—' : value}</div>
      {trend != null && !loading && (
        <div className={`dealer-kpi-trend ${trendClass}`}>
          {trend > 0 ? '▲' : trend < 0 ? '▼' : '—'}
          {trend !== 0 && ` ${Math.abs(trend).toFixed(2)}%`}
        </div>
      )}
      {sub && <div className="dealer-kpi-sub">{sub}</div>}
    </div>
  );
}

/* ── Flow card (DePix → USDt) ── */
function FlowCard({ pl, assetSummary, loading }) {
  const depixIn = pl?.total_deposited?.DePix || 0;
  const depixNet = assetSummary?.DePix?.net_flow;
  const usdtWithdrawn = pl?.total_withdrawn?.USDt || 0;
  const usdtNet = assetSummary?.USDt?.net_flow;
  const swaps = assetSummary?.USDt?.swap_count || 0;

  return (
    <div className="dealer-flow-card">
      <div className="dealer-flow-title">Fluxo operacional</div>
      <div className="dealer-flow-row">
        <div className="dealer-flow-step">
          <div className="dealer-flow-step-label">DePix entrado</div>
          <div className="dealer-flow-step-value depix">
            {loading ? '…' : fmtAsset('DePix', depixIn)}
          </div>
          {depixNet != null && (
            <div className="dealer-flow-step-net">
              saldo líquido {fmtAsset('DePix', depixNet)}
            </div>
          )}
        </div>

        <div className="dealer-flow-arrow">
          <TbArrowRight />
          <span>{swaps} swap{swaps !== 1 ? 's' : ''}</span>
        </div>

        <div className="dealer-flow-step">
          <div className="dealer-flow-step-label">USDt realizado</div>
          <div className={`dealer-flow-step-value usdt${usdtWithdrawn > 0 ? ' lucro' : ''}`}>
            {loading ? '…' : fmtAsset('USDt', usdtWithdrawn)}
          </div>
          {usdtNet != null && (
            <div className="dealer-flow-step-net">
              saldo líquido {fmtAsset('USDt', usdtNet)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Asset P&L row ── */
function AssetPLCard({ asset, row, loading }) {
  if (!row) return null;
  const avg = row.profit_percent_avg;
  const kind = avg == null ? null : avg > 0.01 ? 'lucro' : avg < -0.01 ? 'perda' : 'neutro';
  return (
    <div className={`dealer-asset-pl-card${kind ? ` ${kind}` : ''}`}>
      <div className="dealer-asset-pl-name">
        <span className={`dealer-asset-badge ${asset === 'L-BTC' ? 'btc' : 'stable'}`}>{asset}</span>
      </div>
      <div className="dealer-asset-pl-stats">
        {row.deposit_total > 0 && (
          <span className="dealer-asset-pl-stat">
            <span className="dealer-asset-pl-stat-label">entrada</span>
            <span className="dealer-asset-pl-stat-value">{loading ? '…' : fmtAsset(asset, row.deposit_total)}</span>
          </span>
        )}
        {row.withdrawal_total > 0 && (
          <span className="dealer-asset-pl-stat">
            <span className="dealer-asset-pl-stat-label">saída</span>
            <span className="dealer-asset-pl-stat-value">{loading ? '…' : fmtAsset(asset, row.withdrawal_total)}</span>
          </span>
        )}
        {row.swap_count > 0 && (
          <span className="dealer-asset-pl-stat">
            <span className="dealer-asset-pl-stat-label">swaps</span>
            <span className="dealer-asset-pl-stat-value">{row.swap_count}</span>
          </span>
        )}
        {row.lucro_count + row.perda_count > 0 && (
          <span className="dealer-asset-pl-stat">
            <span className="dealer-asset-pl-stat-label dealer-tx-lucro">{row.lucro_count}L</span>
            {' / '}
            <span className="dealer-asset-pl-stat-label dealer-tx-perda">{row.perda_count}P</span>
          </span>
        )}
        {avg != null && (
          <span className={`dealer-asset-pl-avg ${kind}`}>{fmtPct(avg)}</span>
        )}
      </div>
    </div>
  );
}

/* ── Transaction row ── */
function TxRow({ tx }) {
  const [open, setOpen] = useState(false);
  const isSwap = tx.type === 'swap';
  const isDeposit = tx.category === 'external_deposit';
  const isWithdrawal = tx.category === 'external_withdrawal';
  const hasDetail = tx.reference_price || tx.txid || tx.related_order_id || tx.related_pair;

  return (
    <>
      <tr
        className={`dealer-tx-row ${profitClass(tx.profit_kind)}${hasDetail ? ' dealer-tx-row-expandable' : ''}`}
        data-category={tx.category}
        onClick={hasDetail ? () => setOpen((v) => !v) : undefined}
      >
        <td className="dealer-tx-ts">{formatTxTimestamp(tx.timestamp)}</td>
        <td>
          <Badge bg={categoryBadgeVariant(tx.category)} className="dealer-tx-type">
            {tx.category_label || tx.type_label}
          </Badge>
          {tx.status_label && (
            <span className="dealer-tx-status">{tx.status_label}</span>
          )}
        </td>
        <td>
          <span className="dealer-tx-pair">{tx.pair}</span>
          {tx.dealer_wallet && (
            <span className="dealer-tx-wallet">{tx.dealer_wallet}</span>
          )}
        </td>
        <td>
          {isSwap ? (
            <span>
              {tx.trade_dir} {tx.base}/{tx.quote}
              {tx.executed_price != null && (
                <span className="dealer-tx-price"> @ {formatAmount(null, tx.executed_price)}</span>
              )}
            </span>
          ) : isDeposit ? (
            <span className="dealer-tx-flow-hint">recebimento externo</span>
          ) : isWithdrawal ? (
            <span className="dealer-tx-flow-hint">saída de fundos</span>
          ) : (
            <span className="dealer-tx-flow-hint">
              {tx.flow_role === 'settlement' ? 'liquidação swap' : tx.profit_label || tx.flow_role}
            </span>
          )}
        </td>
        <td className="dealer-tx-amounts">
          {isSwap ? (
            <>
              {tx.filled_base != null && <div>{fmtAsset(tx.base, tx.filled_base)}</div>}
              {tx.filled_quote != null && <div>{fmtAsset(tx.quote, tx.filled_quote)}</div>}
            </>
          ) : (isDeposit || isWithdrawal) ? (
            <div className={`dealer-tx-flow-amount${isDeposit ? ' deposit' : ' withdrawal'}`}>
              {tx.profit_label || '—'}
            </div>
          ) : (
            <>
              {tx.filled_base != null && <div>{fmtAsset(tx.base, tx.filled_base)}</div>}
              {tx.filled_quote != null && (
                <div>{fmtAsset(tx.quote ?? tx.base, tx.filled_quote)}</div>
              )}
            </>
          )}
        </td>
        <td>
          {isSwap ? (
            <span className={`dealer-tx-profit ${tx.profit_kind}`}>
              {tx.profit_label || '—'}
              {tx.profit_source && (
                <span className="dealer-tx-profit-src" title="Fonte do cálculo de lucro">
                  {' '}{tx.profit_source === 'spread' ? '(spread)' : tx.profit_source === 'market' ? '(mercado)' : ''}
                </span>
              )}
            </span>
          ) : isDeposit ? (
            <span className="dealer-tx-received-label">recebimento</span>
          ) : isWithdrawal ? (
            <span className="dealer-tx-withdrawal-label">saque</span>
          ) : tx.category?.startsWith('trade_settlement') && tx.profit_kind && tx.profit_kind !== 'flow' ? (
            <span className={`dealer-tx-profit ${tx.profit_kind}`}>
              {tx.profit_label || '—'}
              {tx.profit_source && (
                <span className="dealer-tx-profit-src">
                  {' '}{tx.profit_source === 'spread' ? '(spread)' : tx.profit_source === 'market' ? '(mercado)' : ''}
                </span>
              )}
            </span>
          ) : (
            <span className="dealer-tx-flow-role">
              {tx.flow_role === 'settlement' ? 'perna swap' : tx.flow_role === 'external' ? 'externo' : ''}
            </span>
          )}
        </td>
        {hasDetail && (
          <td className="dealer-tx-expand-col">
            {open ? <TbChevronUp /> : <TbChevronDown />}
          </td>
        )}
        {!hasDetail && <td />}
      </tr>
      {open && hasDetail && (
        <tr className="dealer-tx-detail-row">
          <td colSpan={7}>
            <div className="dealer-tx-detail">
              {tx.order_id && <span><strong>Order ID:</strong> <code>{tx.order_id}</code></span>}
              {tx.related_order_id && <span><strong>Ordem ref:</strong> <code>{tx.related_order_id}</code></span>}
              {tx.related_pair && <span><strong>Par ref:</strong> {tx.related_pair}</span>}
              {tx.reference_price != null && (
                <span><strong>Preço ref:</strong> {formatAmount(null, tx.reference_price)}</span>
              )}
              {tx.profit_source && <span><strong>Fonte P&L:</strong> {tx.profit_source}</span>}
              {tx.txid && <span><strong>TXID:</strong> <code className="dealer-tx-txid">{tx.txid}</code></span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Progresso de sync por dealer ── */
function SyncProgressList({ progress, loading }) {
  // Sem dados de progresso ainda: mostra spinner genérico se loading
  if (!progress.length) {
    if (!loading) return null;
    return (
      <div className="dealer-sync-progress">
        <div className="dealer-sync-progress-header">
          <span>Sincronizando histórico…</span>
          <span className="dealer-sync-progress-overall dealer-spin-text">⋯</span>
        </div>
        <div className="dealer-sync-progress-bar-wrap">
          <div className="dealer-sync-progress-bar dealer-sync-indeterminate" />
        </div>
      </div>
    );
  }

  const total = progress[0]?.dealer_total || progress.length;
  const done = progress.filter((p) => p.done).length;
  const overallPct = total > 0 ? Math.round(done / total * 100) : 0;
  const allDone = done === total;

  return (
    <div className="dealer-sync-progress">
      <div className="dealer-sync-progress-header">
        <span>
          {allDone ? 'Sync concluído —' : 'Sincronizando histórico…'}
          {' '}{done}/{total} dealer{total !== 1 ? 's' : ''}
        </span>
        <span className="dealer-sync-progress-overall">{overallPct}%</span>
      </div>
      <div className="dealer-sync-progress-bar-wrap">
        <div className="dealer-sync-progress-bar" style={{ width: `${overallPct}%` }} />
      </div>
      {progress.map((p) => (
        <div key={p.pid} className={`dealer-sync-dealer-row${p.done ? ' done' : ' pending'}`}>
          <span className="dealer-sync-dealer-name">
            {p.done ? '✓' : '⋯'} {p.wallet || `PID ${p.pid}`}
          </span>
          {p.done ? (
            <span className="dealer-sync-dealer-stats">
              {p.imported > 0 && <span className="dealer-sync-new">{p.imported} novos</span>}
              {p.updated > 0 && <span className="dealer-sync-upd">{p.updated} atualiz.</span>}
              {p.skipped > 0 && <span className="dealer-sync-skip">{p.skipped} existentes</span>}
              {p.total_checked > 0 && (
                <span className="dealer-sync-pct">
                  {p.pct_new.toFixed(0)}% novo
                  <span className="dealer-sync-mini-bar-wrap">
                    <span className="dealer-sync-mini-bar" style={{ width: `${p.pct_new}%` }} />
                  </span>
                </span>
              )}
            </span>
          ) : (
            <span className="dealer-sync-dealer-stats dealer-sync-waiting">aguardando…</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function TransactionsPanel({
  dealer,
  dealers = [],
  sendCommand,
  wsStatus,
  syncOnSelect = true,
  wsEvents = [],
  txSummarySig = '',
}) {
  // pages: { [offset]: { rows: [], hash: string } }
  // reportMeta: total, has_more, next_offset, profit_loss, asset_summary, category_summary, sync
  const [loading, setLoading] = useState(false);
  const [bgSyncing, setBgSyncing] = useState(false); // sync em background após load rápido
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [pages, setPages] = useState({});
  const [reportMeta, setReportMeta] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [period, setPeriod] = useState(''); // padrão Tudo — usuário filtra se quiser
  const [lastSync, setLastSync] = useState(null);
  const [autoRefreshNote, setAutoRefreshNote] = useState('');
  // syncProgress: [{ pid, wallet, dealer_index, dealer_total, progress_pct, done, imported, updated, skipped, total_checked, pct_new }]
  const [syncProgress, setSyncProgress] = useState([]);
  const loadRef = useRef(null);
  const bgSyncRunningRef = useRef(false); // previne sync duplo em background
  const txSummarySigRef = useRef('');
  const autoRefreshTimerRef = useRef(null);
  // armazena hash da página 0 para comparação em refreshes silenciosos
  const page0HashRef = useRef('');
  // evita bgSync duplo quando período muda internamente (ex: auto-switch para Tudo)
  const skipNextBgSyncRef = useRef(false);

  const PAGE_SIZE = 50;

  const isMulti = !dealer && dealers.length > 0;
  const targetPid = dealer?.pid ?? null;
  const wsOk = wsStatus === 'connected';

  // Aplica dados de get_transactions na state (reutilizado pelas duas fases)
  const _applyTxData = useCallback((data, source) => {
    setPages({ 0: { rows: data.transactions || [], hash: data.page_hash || '' } });
    page0HashRef.current = data.page_hash || '';
    setReportMeta({
      total: data.total,
      has_more: data.has_more,
      next_offset: data.next_offset,
      profit_loss: data.profit_loss,
      asset_summary: data.asset_summary,
      category_summary: data.category_summary,
      sync: data.sync,
    });
    setLastSync(new Date().toLocaleTimeString('pt-BR'));
    if (source !== 'manual') {
      const imported = data.sync?.imported || 0;
      setAutoRefreshNote(
        imported > 0
          ? `${imported} trade(s) importado(s) do SideSwap.`
          : 'Histórico atualizado.',
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fase 2: sync em background — nunca bloqueia a UI principal
  const runBgSync = useCallback(async (source) => {
    if (bgSyncRunningRef.current) return;
    bgSyncRunningRef.current = true;
    setBgSyncing(true);
    setSyncProgress([]);
    try {
      const result = await sendCommand('get_transactions', {
        pid: targetPid,
        limit: PAGE_SIZE,
        offset: 0,
        sync: true,
        since: periodToSince(period) ?? undefined,
      }, 120000);
      if (result?.ok && result.data && !result.data.error) {
        const data = result.data;
        const totalChecked = data.sync?.total_checked || 0;
        log.debug('bg sync OK', 'total:', data.total, 'sync:', data.sync, 'source:', source);
        _applyTxData(data, source);
        // Salva no cache: próximas visitas comparam este hash antes de re-sincronizar
        _updateCache(targetPid, period, data.page_hash || '', data.total);
        // Se período atual não tem dados mas o sync encontrou histórico, muda para Tudo
        if (data.total === 0 && totalChecked > 0) {
          log.debug('bg sync: dados históricos em outros períodos — exibindo Tudo');
          skipNextBgSyncRef.current = true;
          setPeriod('');
        }
      } else {
        log.warn('bg sync falhou', result?.data?.error, 'pid:', targetPid);
      }
    } catch (err) {
      log.warn('bg sync exceção (ignorado)', err.message, 'pid:', targetPid);
    } finally {
      bgSyncRunningRef.current = false;
      setBgSyncing(false);
      setTimeout(() => setSyncProgress([]), 4000);
    }
  }, [targetPid, sendCommand, period, _applyTxData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega a página 0 (reset completo do painel)
  // Fase 1: load rápido sem sync → mostra dados existentes imediatamente
  // Fase 2: bgSync apenas se cache expirou OU hash mudou (evita re-sync desnecessário)
  const load = useCallback(async (sync = true, source = 'manual') => {
    if (!wsOk || !sendCommand) return;
    setLoading(true);
    setError(null);
    let needsSync = sync;
    try {
      const result = await sendCommand('get_transactions', {
        pid: targetPid,
        limit: PAGE_SIZE,
        offset: 0,
        sync: false, // fase 1 é sempre rápida
        since: periodToSince(period) ?? undefined,
      });
      if (result?.ok && result.data && !result.data.error) {
        const data = result.data;
        _applyTxData(data, source);
        // Verifica se é necessário bgSync: pula se hash igual E sync recente
        if (sync && source !== 'manual') {
          const fresh = _isCacheFresh(targetPid, period, data.page_hash || '', data.total);
          if (fresh) {
            log.debug('bgSync pulado — hash igual + sync recente', 'pid:', targetPid, 'period:', period);
            needsSync = false;
          }
        }
        log.debug('fast load OK', 'total:', data.total, 'needsSync:', needsSync, 'source:', source);
      } else {
        const errMsg = result?.data?.error || result?.data?.message || 'Falha ao carregar transações';
        log.error('get_transactions falhou', errMsg, 'pid:', targetPid);
        setError(errMsg);
        needsSync = false;
      }
    } catch (err) {
      log.error('get_transactions exceção', err, 'pid:', targetPid);
      setError(err.message);
      needsSync = false;
    } finally {
      setLoading(false);
    }
    if (needsSync) {
      runBgSync(source);
    }
  }, [targetPid, sendCommand, wsOk, period, runBgSync, _applyTxData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega a próxima página (append)
  const loadMore = useCallback(async () => {
    if (!wsOk || !sendCommand || !reportMeta?.has_more || loadingMore) return;
    const offset = reportMeta.next_offset;
    setLoadingMore(true);
    try {
      const result = await sendCommand('get_transactions', {
        pid: targetPid,
        limit: PAGE_SIZE,
        offset,
        sync: false, // páginas seguintes são leitura pura
        since: periodToSince(period) ?? undefined,
      });
      if (result?.ok && result.data && !result.data.error) {
        const data = result.data;
        setPages((prev) => ({
          ...prev,
          [offset]: { rows: data.transactions || [], hash: data.page_hash || '' },
        }));
        setReportMeta((prev) => ({
          ...prev,
          has_more: data.has_more,
          next_offset: data.next_offset,
          total: data.total,
        }));
      }
    } catch (err) {
      log.error('loadMore exceção', err, 'pid:', targetPid, 'offset:', offset);
    } finally {
      setLoadingMore(false);
    }
  }, [wsOk, sendCommand, targetPid, period, reportMeta, loadingMore]);

  // Refresh silencioso da página 0: só atualiza se o hash mudou
  const refreshPage0 = useCallback(async (source) => {
    if (!wsOk || !sendCommand) return;
    try {
      const result = await sendCommand('get_transactions', {
        pid: targetPid,
        limit: PAGE_SIZE,
        offset: 0,
        sync: true,
        since: periodToSince(period) ?? undefined,
      });
      if (!result?.ok || !result.data || result.data.error) return;
      const data = result.data;
      const newHash = data.page_hash || '';
      const hashChanged = newHash !== page0HashRef.current;
      const totalChanged = data.total !== reportMeta?.total;

      if (!hashChanged && !totalChanged) return; // nenhuma mudança — não re-renderiza

      page0HashRef.current = newHash;
      setPages((prev) => ({ ...prev, 0: { rows: data.transactions || [], hash: newHash } }));
      setReportMeta((prev) => ({
        ...prev,
        total: data.total,
        has_more: data.has_more,
        next_offset: data.next_offset,
        profit_loss: data.profit_loss,
        asset_summary: data.asset_summary,
        category_summary: data.category_summary,
        sync: data.sync,
      }));
      setLastSync(new Date().toLocaleTimeString('pt-BR'));
      if (source !== 'manual') {
        const imported = data.sync?.imported || 0;
        if (imported > 0 || hashChanged) {
          setAutoRefreshNote(
            imported > 0
              ? `${imported} trade(s) importado(s) do SideSwap.`
              : 'Nova transação detectada.',
          );
        }
      }
    } catch (err) {
      log.warn('refreshPage0 exceção', err, 'pid:', targetPid);
    }
  }, [wsOk, sendCommand, targetPid, period, reportMeta?.total]);

  loadRef.current = load;
  const refreshPage0Ref = useRef(refreshPage0);
  refreshPage0Ref.current = refreshPage0;

  const scheduleAutoReload = useCallback((source) => {
    if (autoRefreshTimerRef.current) clearTimeout(autoRefreshTimerRef.current);
    autoRefreshTimerRef.current = setTimeout(() => {
      // Se já temos dados, usa refresh silencioso com comparação de hash
      if (page0HashRef.current) {
        refreshPage0Ref.current(source);
      } else {
        loadRef.current?.(true, source);
      }
    }, 400);
  }, []);

  useEffect(() => () => {
    if (autoRefreshTimerRef.current) clearTimeout(autoRefreshTimerRef.current);
  }, []);

  useEffect(() => {
    if (!autoRefreshNote) return undefined;
    const t = setTimeout(() => setAutoRefreshNote(''), 6000);
    return () => clearTimeout(t);
  }, [autoRefreshNote]);

  useEffect(() => {
    if (wsOk && (dealer?.pid || isMulti)) load(syncOnSelect, 'mount');
    // Reset ao trocar de dealer ou remontar
    setPages({});
    setReportMeta(null);
    setSyncProgress([]);
    page0HashRef.current = '';
  }, [dealer?.pid, isMulti, wsOk]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!wsOk || (!dealer?.pid && !isMulti)) return;
    if (skipNextBgSyncRef.current) {
      // Mudança de período foi interna (auto-switch Tudo após bgSync vazio) — só fast load
      skipNextBgSyncRef.current = false;
      load(false, 'period-auto');
    } else {
      load(true, 'period');
    }
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!wsEvents.length) return;
    const last = wsEvents[wsEvents.length - 1];
    if (last?.event === 'history_sync_progress') {
      // Ignora eventos stale: só processa se bgSync está ativo neste componente
      if (!bgSyncRunningRef.current) return;
      const d = last.data;
      setSyncProgress((prev) => {
        const idx = prev.findIndex((p) => p.pid === d.pid);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = d;
          return next;
        }
        return [...prev, d];
      });
      return;
    }
    if (last?.event !== 'transaction_event') return;
    const tx = last?.data?.transaction;
    if (!tx) return;
    if (targetPid != null && tx.dealer_pid !== targetPid) return;
    scheduleAutoReload('transaction_event');
  }, [wsEvents, targetPid, scheduleAutoReload]);

  useEffect(() => {
    if (!txSummarySig || !wsOk || (!dealer?.pid && !isMulti)) return;
    if (!txSummarySigRef.current) {
      txSummarySigRef.current = txSummarySig;
      return;
    }
    if (txSummarySigRef.current === txSummarySig) return;
    txSummarySigRef.current = txSummarySig;
    scheduleAutoReload('summary');
  }, [txSummarySig, wsOk, dealer?.pid, isMulti, scheduleAutoReload]);

  // Flatten de todas as páginas em ordem de offset
  const allTx = useMemo(() => {
    return Object.entries(pages)
      .sort(([a], [b]) => Number(a) - Number(b))
      .flatMap(([, page]) => page.rows);
  }, [pages]);

  const assetSummary = reportMeta?.asset_summary || {};
  const pl = reportMeta?.profit_loss || {};
  const categorySummary = reportMeta?.category_summary?.by_category || {};

  const filteredTx = useMemo(
    () => (categoryFilter ? allTx.filter((tx) => tx.category === categoryFilter) : allTx),
    [allTx, categoryFilter],
  );

  /* KPI derived values */
  const swapCount = pl.swap_count || 0;
  const avgPct = useMemo(() => {
    const assets = ['L-BTC', 'USDt', 'DePix'];
    let sum = 0; let cnt = 0;
    for (const a of assets) {
      const avg = assetSummary[a]?.profit_percent_avg;
      if (avg != null) { sum += avg; cnt++; }
    }
    return cnt > 0 ? sum / cnt : null;
  }, [assetSummary]);

  const lucroTotal = useMemo(() => {
    let n = 0;
    for (const a of Object.values(assetSummary)) n += (a.lucro_count || 0);
    return n;
  }, [assetSummary]);
  const perdaTotal = useMemo(() => {
    let n = 0;
    for (const a of Object.values(assetSummary)) n += (a.perda_count || 0);
    return n;
  }, [assetSummary]);

  const handleExportCsv = useCallback(() => {
    const rows = allTx.length > 0 ? allTx : [];
    if (!rows.length) return;

    const headers = [
      'timestamp', 'tipo', 'categoria', 'par', 'trade_dir',
      'base', 'quantidade_base', 'quote', 'quantidade_quote',
      'preco_executado', 'preco_referencia', 'lucro_pct', 'lucro_label',
      'carteira', 'order_id', 'txid',
    ];

    const escape = (v) => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const csvRows = [
      headers.join(','),
      ...rows.map((tx) => [
        tx.timestamp,
        tx.type_label || tx.type,
        tx.category_label || tx.category,
        tx.pair,
        tx.trade_dir || '',
        tx.base || '',
        tx.filled_base ?? '',
        tx.quote || '',
        tx.filled_quote ?? '',
        tx.executed_price ?? '',
        tx.reference_price ?? '',
        tx.profit_percent ?? '',
        tx.profit_label || '',
        tx.dealer_wallet || '',
        tx.order_id || '',
        tx.txid || '',
      ].map(escape).join(',')),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `transacoes_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [allTx]);

  const titleLabel = dealer
    ? `PID ${dealer.pid} · ${dealer.wallet_name || '—'}`
    : isMulti
      ? `${dealers.length} carteiras`
      : null;

  const hasData = allTx.length > 0 || reportMeta != null;

  return (
    <section className="dealer-transactions-panel">

      {/* ── Header ── */}
      <div className="dealer-transactions-header">
        <h3>
          <TbChartLine /> Histórico &amp; Lucro
          <ManagerBadge title="Transações via get_transactions do manager_dealer" />
          {titleLabel && <span className="dealer-assets-sub">{titleLabel}</span>}
          {reportMeta?.total != null && <span className="dealer-assets-sub">{reportMeta.total} registros</span>}
        </h3>
        <div className="dealer-tx-header-actions">
          {lastSync && <span className="dealer-tx-last-sync">sync {lastSync}</span>}
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={handleExportCsv}
            disabled={!allTx.length}
            className="dealer-tx-refresh"
            title="Exportar transações como CSV"
          >
            <TbDownload /> CSV
          </Button>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => bgSyncRunningRef.current ? null : runBgSync('manual')}
            disabled={bgSyncing || loading || (!dealer && !isMulti) || !wsOk}
            className="dealer-tx-refresh"
            title="Importar trades do SideSwap e recarregar"
          >
            <TbRefresh className={bgSyncing ? 'dealer-spin' : ''} />
            {bgSyncing ? '…' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {/* ── Sem dealer / WS offline ── */}
      {!dealer && !isMulti ? (
        <p className="dealer-empty">Selecione um dealer ou aguarde dealers carregarem para ver o histórico.</p>
      ) : !wsOk ? (
        <p className="dealer-empty">WebSocket offline — histórico indisponível.</p>
      ) : (
        <>
          {error && <p className="dealer-placement-error">{error}</p>}

          {autoRefreshNote && (
            <p className="dealer-hint dealer-tx-auto-refresh-note">{autoRefreshNote}</p>
          )}

          {/* ── Progresso de sync em background ── */}
          {(bgSyncing || syncProgress.length > 0) && (
            <SyncProgressList progress={syncProgress} loading={bgSyncing} />
          )}

          {reportMeta?.sync && (reportMeta.sync.imported > 0 || reportMeta.sync.updated > 0) && (
            <p className="dealer-hint">
              Sync SideSwap:
              {reportMeta.sync.imported > 0 && ` ${reportMeta.sync.imported} trade(s) importado(s).`}
              {reportMeta.sync.updated > 0 && ` ${reportMeta.sync.updated} trade(s) atualizado(s).`}
              {Array.isArray(reportMeta.sync.dealers) && reportMeta.sync.dealers.some((d) => d.error) && (
                <span className="dealer-tx-sync-warn">
                  {' '}Alguns PIDs falharam no sync — verifique se o dealer está online.
                </span>
              )}
            </p>
          )}

          {/* ── Filtro de período ── */}
          <div className="dealer-tx-period-bar">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`dealer-tx-period-btn${period === opt.value ? ' active' : ''}`}
                onClick={() => setPeriod(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {hasData && (
            <>
              {/* ── KPIs ── */}
              <div className="dealer-kpi-row">
                <KpiCard
                  icon={TbCoin}
                  label="Capital DePix entrado"
                  value={fmtAsset('DePix', pl.total_deposited?.DePix)}
                  sub={`${pl.deposit_count || 0} depósito(s)`}
                  loading={loading}
                />
                <KpiCard
                  icon={TbWallet}
                  label="USDt sacado"
                  value={fmtAsset('USDt', pl.total_withdrawn?.USDt)}
                  sub={`${pl.withdrawal_count || 0} saque(s)`}
                  kind={(pl.total_withdrawn?.USDt || 0) > 0 ? 'lucro' : undefined}
                  loading={loading}
                />
                <KpiCard
                  icon={TbArrowsExchange}
                  label="Swaps executados"
                  value={String(swapCount)}
                  sub={`${lucroTotal} lucro · ${perdaTotal} perda`}
                  trend={swapCount > 0 ? ((lucroTotal - perdaTotal) / swapCount * 100) : null}
                  kind={lucroTotal >= perdaTotal && swapCount > 0 ? 'lucro' : swapCount > 0 ? 'perda' : undefined}
                  loading={loading}
                />
                <KpiCard
                  icon={avgPct != null && avgPct >= 0 ? TbTrendingUp : TbTrendingDown}
                  label="Lucro médio (swaps)"
                  value={fmtPct(avgPct) ?? '—'}
                  sub="vs original_price"
                  trend={avgPct != null ? avgPct * 100 : null}
                  kind={avgPct == null ? undefined : avgPct > 0.01 ? 'lucro' : avgPct < -0.01 ? 'perda' : undefined}
                  loading={loading}
                />
              </div>

              {/* ── Fluxo operacional ── */}
              <FlowCard pl={pl} assetSummary={assetSummary} loading={loading} />

              {/* ── P&L por asset ── */}
              <div className="dealer-asset-pl-row">
                {['DePix', 'USDt', 'L-BTC'].map((a) => (
                  <AssetPLCard key={a} asset={a} row={assetSummary[a]} loading={loading} />
                ))}
              </div>

              {/* ── P&L por carteira (multi-mode) ── */}
              {isMulti && dealers.length > 1 && (
                <div className="dealer-pnl-wallet-section">
                  <div className="dealer-pnl-wallet-title">P&amp;L por carteira</div>
                  <div className="dealer-pnl-wallet-grid">
                    {dealers.map((d) => {
                      const summary = d.transactions_summary || {};
                      const pct = summary.total_profit_percent;
                      const kind = pct == null ? '' : pct > 0.005 ? 'lucro' : pct < -0.005 ? 'perda' : '';
                      return (
                        <div key={d.pid} className={`dealer-pnl-wallet-card ${kind}`}>
                          <div className="dealer-pnl-wallet-name">
                            {d.wallet_name || `PID ${d.pid}`}
                          </div>
                          <div className={`dealer-pnl-wallet-pct dealer-tx-${kind || 'flow'}`}>
                            {pct != null
                              ? `${pct >= 0 ? '+' : ''}${(pct * 100).toFixed(2)}%`
                              : '—'}
                          </div>
                          <div className="dealer-pnl-wallet-swaps">
                            {summary.swap_count ?? 0} swap{summary.swap_count !== 1 ? 's' : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Contadores de categoria ── */}
              <div className="dealer-tx-cat-counts">
                {CATEGORY_FILTER_OPTIONS.filter((o) => o.value).map((opt) => {
                  const n = categorySummary[opt.value] ?? 0;
                  if (!n) return null;
                  return (
                    <span key={opt.value} className="dealer-tx-cat-chip">
                      <Badge bg={categoryBadgeVariant(opt.value)} className="dealer-tx-type">
                        {opt.label}
                      </Badge>
                      {n}
                    </span>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Filtro de categoria ── */}
          <div className="dealer-tx-filters">
            <span className="dealer-tx-filter-label">Filtrar:</span>
            {CATEGORY_FILTER_OPTIONS.map((opt) => {
              const n = opt.value ? (categorySummary[opt.value] ?? 0) : allTx.length;
              return (
                <button
                  key={opt.value || 'all'}
                  className={`dealer-tx-filter-btn${categoryFilter === opt.value ? ' active' : ''}`}
                  onClick={() => setCategoryFilter(opt.value)}
                >
                  {opt.label}
                  {n > 0 && <span className="dealer-tx-filter-count">{n}</span>}
                </button>
              );
            })}
          </div>

          {/* ── Tabela ── */}
          {!allTx.length && !loading ? (
            <p className="dealer-empty">
              Nenhuma transação neste período. Clique em <strong>Atualizar</strong> para importar
              trades do SideSwap (load_history). O app DePix mostra movimentos da carteira; aqui
              aparecem como <strong>Troca dealer</strong> após o sync do manager.
            </p>
          ) : !filteredTx.length && !loading ? (
            <p className="dealer-empty">Nenhuma transação neste filtro.</p>
          ) : (
            <div className="dealer-tx-table-wrap">
              <table className="dealer-tx-table">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Tipo</th>
                    <th>Par / Carteira</th>
                    <th>Operação</th>
                    <th>Quantidade</th>
                    <th>Lucro / Valor</th>
                    <th className="dealer-tx-expand-col" />
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.map((tx) => (
                    <TxRow key={tx.transaction_id} tx={tx} />
                  ))}
                </tbody>
              </table>
              {/* ── Paginação: carregar mais ── */}
              {reportMeta?.has_more && !categoryFilter && (
                <div className="dealer-tx-load-more">
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? '…' : `Carregar mais (${reportMeta.total - allTx.length} restantes)`}
                  </Button>
                </div>
              )}
              {reportMeta?.total != null && (
                <p className="dealer-tx-limit-note">
                  {allTx.length} de {reportMeta.total} transações carregadas.
                  {categoryFilter && reportMeta.total > allTx.length && ' Use "Tudo" no filtro para ver o total.'}
                </p>
              )}
            </div>
          )}

          <p className="dealer-tx-footnote">
            <strong>Troca dealer</strong> = ordem executada no book — aqui está o lucro real do dealer.
            {' '}<strong>Entrada/Saída (swap)</strong> = perna on-chain de um swap atômico (mesmo txid).
            {' '}<strong>Capital / entrada</strong> = recebimento externo não correlacionado a swap.
            {' '}<strong>Saque</strong> = saída de fundos não correlacionada a swap.
            {' '}Use <strong>Atualizar</strong> para importar ordens executadas do SideSwap e melhorar a correlação.
          </p>
        </>
      )}
    </section>
  );
}
