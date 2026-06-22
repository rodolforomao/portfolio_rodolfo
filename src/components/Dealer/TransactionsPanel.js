import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import { TbRefresh, TbChartLine, TbArrowRight, TbTrendingUp, TbTrendingDown, TbCoin, TbWallet, TbArrowsExchange, TbChevronDown, TbChevronUp } from 'react-icons/tb';
import {
  formatTxTimestamp,
  profitClass,
  formatAmount,
  categoryBadgeVariant,
  CATEGORY_FILTER_OPTIONS,
} from './utils/transactionFormat';

const SATS = 1e8;

function fmtAsset(asset, value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  if (asset === 'L-BTC') {
    if (Math.abs(n) < 0.01) return `${Math.round(n * SATS).toLocaleString('pt-BR')} sats`;
    return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} L-BTC`;
  }
  if (asset === 'USDt') return `$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (asset === 'DePix') return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
function KpiCard({ icon: Icon, label, value, sub, kind, loading }) {
  const kindClass = kind === 'lucro' ? 'kpi-lucro' : kind === 'perda' ? 'kpi-perda' : kind === 'info' ? 'kpi-info' : '';
  return (
    <div className={`dealer-kpi-card ${kindClass}`}>
      <div className="dealer-kpi-icon"><Icon /></div>
      <div className="dealer-kpi-body">
        <div className="dealer-kpi-label">{label}</div>
        <div className={`dealer-kpi-value${loading ? ' dealer-kpi-loading' : ''}`}>{loading ? '…' : value}</div>
        {sub && <div className="dealer-kpi-sub">{sub}</div>}
      </div>
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
              {tx.filled_quote != null && <div>{fmtAsset(tx.quote, tx.filled_quote)}</div>}
            </>
          )}
        </td>
        <td>
          {isSwap ? (
            <span className={`dealer-tx-profit ${tx.profit_kind}`}>
              {tx.profit_label || '—'}
            </span>
          ) : isDeposit ? (
            <span className="dealer-tx-received-label">recebimento</span>
          ) : isWithdrawal ? (
            <span className="dealer-tx-withdrawal-label">saque</span>
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

export default function TransactionsPanel({
  dealer,
  dealers = [],
  sendCommand,
  wsStatus,
  syncOnSelect = true,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [period, setPeriod] = useState('');
  const [lastSync, setLastSync] = useState(null);

  const isMulti = !dealer && dealers.length > 0;
  const targetPid = dealer?.pid ?? null;
  const wsOk = wsStatus === 'connected';

  const load = useCallback(async (sync = true) => {
    if (!wsOk || !sendCommand) return;
    setLoading(true);
    setError(null);
    try {
      const result = await sendCommand('get_transactions', {
        pid: targetPid,
        limit: 200,
        sync,
        since: periodToSince(period) ?? undefined,
      });
      if (result?.ok && result.data && !result.data.error) {
        setReport(result.data);
        setLastSync(new Date().toLocaleTimeString('pt-BR'));
      } else {
        setError(result?.data?.error || result?.data?.message || 'Falha ao carregar transações');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetPid, sendCommand, wsOk, period]);

  useEffect(() => {
    if (wsOk && (dealer?.pid || isMulti)) load(syncOnSelect);
  }, [dealer?.pid, isMulti, load, syncOnSelect, wsOk]);

  useEffect(() => {
    if (wsOk && (dealer?.pid || isMulti)) load(false);
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const assetSummary = report?.asset_summary || {};
  const pl = report?.profit_loss || {};
  const categorySummary = report?.category_summary?.by_category || {};
  const allTx = report?.transactions || [];

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

  const titleLabel = dealer
    ? `PID ${dealer.pid} · ${dealer.wallet_name || '—'}`
    : isMulti
      ? `${dealers.length} carteiras`
      : null;

  const hasData = allTx.length > 0 || report != null;

  return (
    <section className="dealer-transactions-panel">

      {/* ── Header ── */}
      <div className="dealer-transactions-header">
        <h3>
          <TbChartLine /> Histórico &amp; Lucro
          {titleLabel && <span className="dealer-assets-sub">{titleLabel}</span>}
          {report?.total != null && <span className="dealer-assets-sub">{report.total} registros</span>}
        </h3>
        <div className="dealer-tx-header-actions">
          {lastSync && <span className="dealer-tx-last-sync">sync {lastSync}</span>}
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => load(true)}
            disabled={loading || (!dealer && !isMulti) || !wsOk}
            className="dealer-tx-refresh"
            title="Importar trades do SideSwap e recarregar"
          >
            <TbRefresh className={loading ? 'dealer-spin' : ''} />
            {loading ? '…' : 'Atualizar'}
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

          {report?.sync?.imported > 0 && (
            <p className="dealer-hint">
              {report.sync.imported} trade(s) importado(s) do histórico SideSwap.
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
                  sub={`${lucroTotal} lucro / ${perdaTotal} perda`}
                  kind={lucroTotal >= perdaTotal && swapCount > 0 ? 'lucro' : swapCount > 0 ? 'perda' : undefined}
                  loading={loading}
                />
                <KpiCard
                  icon={avgPct != null && avgPct >= 0 ? TbTrendingUp : TbTrendingDown}
                  label="Lucro médio (swaps)"
                  value={fmtPct(avgPct) ?? '—'}
                  sub="vs original_price"
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
              Nenhuma transação registrada. Trades executados aparecem após sync com o histórico.
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
              {report?.total > filteredTx.length && (
                <p className="dealer-tx-limit-note">
                  Mostrando {filteredTx.length} de {report.total} — use filtro de período para refinar.
                </p>
              )}
            </div>
          )}

          <p className="dealer-tx-footnote">
            <strong>Troca dealer</strong> = ordem executada no book — aqui está o lucro real do dealer.
            {' '}<strong>Capital / entrada</strong> = DePix recebido externamente (<em>não é lucro</em> — é capital operacional).
            {' '}<strong>Saque</strong> = saída de fundos da carteira.
            {' '}<strong>Liquidação swap</strong> = movimento on-chain correlacionado ao trade.
          </p>
        </>
      )}
    </section>
  );
}
