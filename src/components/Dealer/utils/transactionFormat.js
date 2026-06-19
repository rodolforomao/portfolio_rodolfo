export function formatTxTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function profitClass(kind) {
  if (kind === 'lucro') return 'dealer-tx-lucro';
  if (kind === 'perda') return 'dealer-tx-perda';
  if (kind === 'flow') return 'dealer-tx-flow';
  return 'dealer-tx-neutral';
}

export function formatAmount(asset, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1) return n.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
  return n.toFixed(8).replace(/\.?0+$/, '');
}

export function formatAssetSummaryRow(row) {
  if (!row) return null;
  const avg = row.profit_percent_avg;
  const avgLabel = avg != null ? `${avg >= 0 ? '+' : ''}${avg.toFixed(2)}% médio` : 'sem trades';
  return {
    ...row,
    avgLabel,
    netLabel: `${row.net_flow >= 0 ? '+' : ''}${formatAmount(row.asset, row.net_flow)}`,
  };
}

const CATEGORY_BADGE = {
  dealer_trade: 'primary',
  trade_settlement_in: 'info',
  trade_settlement_out: 'warning',
  external_deposit: 'success',
  external_withdrawal: 'danger',
};

export function categoryBadgeVariant(category) {
  return CATEGORY_BADGE[category] || 'secondary';
}

export const CATEGORY_FILTER_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'dealer_trade', label: 'Troca dealer' },
  { value: 'trade_settlement_in', label: 'Entrada (swap)' },
  { value: 'trade_settlement_out', label: 'Saída (swap)' },
  { value: 'external_deposit', label: 'Capital / entrada' },
  { value: 'external_withdrawal', label: 'Saque' },
];
