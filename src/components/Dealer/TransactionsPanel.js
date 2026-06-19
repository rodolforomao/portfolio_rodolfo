import React, { useCallback, useEffect, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import { TbRefresh, TbChartLine } from 'react-icons/tb';
import {
  formatTxTimestamp,
  profitClass,
  formatAmount,
  formatAssetSummaryRow,
  categoryBadgeVariant,
  CATEGORY_FILTER_OPTIONS,
} from './utils/transactionFormat';

function ProfitBadge({ kind, label }) {
  const bg = kind === 'lucro' ? 'success' : kind === 'perda' ? 'danger' : 'secondary';
  return <Badge bg={bg} className={`dealer-tx-badge ${profitClass(kind)}`}>{label}</Badge>;
}

export default function TransactionsPanel({
  dealer,
  sendCommand,
  wsStatus,
  syncOnSelect = true,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lastSync, setLastSync] = useState(null);

  const load = useCallback(async (sync = true) => {
    if (wsStatus !== 'connected' || !sendCommand) return;
    setLoading(true);
    setError(null);
    try {
      const result = await sendCommand('get_transactions', {
        pid: dealer?.pid ?? null,
        limit: 150,
        sync,
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
  }, [dealer?.pid, sendCommand, wsStatus]);

  useEffect(() => {
    if (dealer?.pid) load(syncOnSelect);
  }, [dealer?.pid, load, syncOnSelect]);

  const assets = report?.assets_tracked || ['L-BTC', 'USDt', 'DePix'];
  const summary = report?.asset_summary || {};
  const pl = report?.profit_loss;
  const categorySummary = report?.category_summary?.by_category || {};
  const allTransactions = report?.transactions || [];
  const filteredTransactions = categoryFilter
    ? allTransactions.filter((tx) => tx.category === categoryFilter)
    : allTransactions;

  return (
    <section className="dealer-transactions-panel">
      <div className="dealer-transactions-header">
        <h3>
          <TbChartLine /> Histórico &amp; lucro
          {dealer && (
            <span className="dealer-assets-sub">
              PID {dealer.pid} · {report?.total ?? 0} registros
            </span>
          )}
        </h3>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => load(true)}
          disabled={loading || !dealer || wsStatus !== 'connected'}
          className="dealer-tx-refresh"
          title="Importar trades do SideSwap e recarregar histórico"
        >
          <TbRefresh className={loading ? 'dealer-spin' : ''} />
          {loading ? 'Atualizando…' : 'Atualizar'}
        </Button>
      </div>

      {!dealer ? (
        <p className="dealer-empty">Selecione um dealer para ver o histórico de transações.</p>
      ) : wsStatus !== 'connected' ? (
        <p className="dealer-empty">WebSocket offline — histórico indisponível.</p>
      ) : (
        <>
          {error && <p className="dealer-placement-error">{error}</p>}

          {report?.sync?.imported > 0 && (
            <p className="dealer-hint">
              {report.sync.imported} trade(s) importado(s) do histórico SideSwap deste PID.
            </p>
          )}

          {lastSync && (
            <p className="dealer-assets-ts">Última sync: {lastSync}</p>
          )}

          <div className="dealer-tx-summary-grid">
            {assets.map((asset) => {
              const row = formatAssetSummaryRow(summary[asset]);
              if (!row) return null;
              return (
                <div key={asset} className="dealer-tx-summary-card">
                  <div className="dealer-tx-summary-asset">{asset}</div>
                  <div className="dealer-tx-summary-net">{row.netLabel}</div>
                  <div className="dealer-tx-summary-meta">
                    {row.swap_count} trade{row.swap_count !== 1 ? 's' : ''}
                    {' · '}
                    <span className={row.lucro_count >= row.perda_count ? 'dealer-tx-lucro' : 'dealer-tx-perda'}>
                      {row.lucro_count} lucro / {row.perda_count} perda
                    </span>
                  </div>
                  <div className="dealer-tx-summary-avg">{row.avgLabel}</div>
                </div>
              );
            })}
          </div>

          {pl && (
            <div className="dealer-tx-totals">
              <span>Trocas: <strong>{categorySummary.dealer_trade ?? pl.swap_count ?? 0}</strong></span>
              <span>Saques: <strong>{categorySummary.external_withdrawal ?? pl.withdrawal_count ?? 0}</strong></span>
              <span>Capital: <strong>{categorySummary.external_deposit ?? pl.deposit_count ?? 0}</strong></span>
              {(categorySummary.trade_settlement_in > 0 || categorySummary.trade_settlement_out > 0) && (
                <span>
                  Pernas swap:{' '}
                  <strong>
                    +{categorySummary.trade_settlement_in || 0} / −{categorySummary.trade_settlement_out || 0}
                  </strong>
                </span>
              )}
              {pl.total_profit_percent != null && pl.swap_count > 0 && (
                <span>
                  Lucro médio (swaps):{' '}
                  <strong className={pl.total_profit_percent >= 0 ? 'dealer-tx-lucro' : 'dealer-tx-perda'}>
                    {pl.total_profit_percent >= 0 ? '+' : ''}{pl.total_profit_percent.toFixed(2)}%
                  </strong>
                </span>
              )}
            </div>
          )}

          <div className="dealer-tx-filters">
            <label htmlFor="dealer-tx-category-filter">Filtrar:</label>
            <select
              id="dealer-tx-category-filter"
              className="dealer-tx-filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {CATEGORY_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                  {opt.value && categorySummary[opt.value] != null
                    ? ` (${categorySummary[opt.value]})`
                    : ''}
                </option>
              ))}
            </select>
          </div>

          {!allTransactions.length && !loading ? (
            <p className="dealer-empty">
              Nenhuma transação registrada ainda. Trades executados aparecem após sync com o histórico do dealer.
            </p>
          ) : !filteredTransactions.length && !loading ? (
            <p className="dealer-empty">Nenhuma transação neste filtro.</p>
          ) : (
            <div className="dealer-tx-table-wrap">
              <table className="dealer-tx-table">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Categoria</th>
                    <th>Par / Ativo</th>
                    <th>Operação</th>
                    <th>Quantidade</th>
                    <th>Lucro dealer</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.transaction_id} className={profitClass(tx.profit_kind)}>
                      <td>{formatTxTimestamp(tx.timestamp)}</td>
                      <td>
                        <Badge
                          bg={categoryBadgeVariant(tx.category)}
                          className="dealer-tx-type"
                        >
                          {tx.category_label || tx.type_label}
                        </Badge>
                        {tx.status_label && (
                          <span className="dealer-tx-status">{tx.status_label}</span>
                        )}
                      </td>
                      <td>
                        <span className="dealer-tx-pair">{tx.pair}</span>
                        {(tx.order_id || tx.related_order_id) && (
                          <code className="dealer-tx-order-id">
                            {tx.order_id ? `#${tx.order_id}` : ''}
                            {tx.related_order_id ? ` ← ordem ${tx.related_order_id}` : ''}
                          </code>
                        )}
                        {tx.related_pair && (
                          <span className="dealer-tx-related-pair">{tx.related_pair}</span>
                        )}
                      </td>
                      <td>
                        {tx.type === 'swap' ? (
                          <>
                            {tx.trade_dir} {tx.base}/{tx.quote}
                            {tx.executed_price != null && (
                              <span className="dealer-tx-price"> @ {formatAmount(null, tx.executed_price)}</span>
                            )}
                          </>
                        ) : (
                          tx.profit_label
                        )}
                      </td>
                      <td className="dealer-tx-amounts">
                        {tx.filled_base != null && (
                          <span>{formatAmount(tx.base, tx.filled_base)} {tx.base}</span>
                        )}
                        {tx.filled_quote != null && (
                          <span>{formatAmount(tx.quote, tx.filled_quote)} {tx.quote || 'quote'}</span>
                        )}
                      </td>
                      <td>
                        {tx.type === 'swap' ? (
                          <ProfitBadge kind={tx.profit_kind} label={tx.profit_label} />
                        ) : (
                          <span className="dealer-tx-flow-hint">
                            {tx.flow_role === 'settlement' ? 'liquidação' : 'saldo'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="dealer-tx-footnote">
            Troca dealer = ordem executada no book. Entrada/Saída (swap) = movimento on-chain ligado ao trade.
            Saque / Capital = movimento externo não correlacionado. Atualize para importar histórico SideSwap.
          </p>
        </>
      )}
    </section>
  );
}
