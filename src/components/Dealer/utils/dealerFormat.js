import { prepareDealerOrders } from './orderMarketNormalize';

const LBTC_THRESHOLD = 0.01;
const SATS_PER_LBTC = 1e8;

export function canonicalAssetName(name) {
  const key = String(name || '').trim();
  const norm = key.toLowerCase().replace(/-/g, '');
  if (norm === 'lbtc') return 'L-BTC';
  if (norm === 'depix') return 'DePix';
  if (norm === 'usdt') return 'USDt';
  return key;
}

export function isLBTC(asset) {
  return canonicalAssetName(asset).toLowerCase().replace(/-/g, '') === 'lbtc';
}

function formatGenericAmount(n) {
  if (n === 0) return '0';
  if (Math.abs(n) >= 1) {
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 8 });
  }
  return n.toFixed(8).replace(/\.?0+$/, '').replace('.', ',');
}

/** @deprecated use formatAssetBalance */
export function formatBalance(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return '—';
  return formatGenericAmount(n);
}

/**
 * L-BTC: abaixo de 0,01 → satoshis (×10⁸); a partir de 0,01 → L-BTC.
 */
export function formatAssetBalance(asset, value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return '—';

  if (isLBTC(asset)) {
    if (Math.abs(n) < LBTC_THRESHOLD) {
      const sats = Math.round(n * SATS_PER_LBTC);
      return `${sats.toLocaleString('pt-BR')} sats`;
    }
    return `${formatGenericAmount(n)} L-BTC`;
  }

  return formatGenericAmount(n);
}

export function normalizeBalances(balances) {
  if (!balances || typeof balances !== 'object' || Array.isArray(balances)) return [];
  const merged = {};
  Object.entries(balances).forEach(([asset, value]) => {
    if (value === null || value === undefined || value === '') return;
    const canon = canonicalAssetName(asset);
    const n = typeof value === 'number' ? value : parseFloat(value) || 0;
    merged[canon] = (merged[canon] || 0) + n;
  });
  return Object.entries(merged)
    .map(([asset, value]) => ({ asset, value }))
    .sort((a, b) => a.asset.localeCompare(b.asset));
}

/** Une catálogo do backend (state.assets / get_assets) com saldos do dealer. */
export function mergeBalancesWithCatalog(balances, catalogAssets = []) {
  const byAsset = {};
  normalizeBalances(balances).forEach(({ asset, value }) => {
    byAsset[asset] = value;
  });

  const fromCatalog = (catalogAssets || []).map((a) => canonicalAssetName(a.name || a));
  const allNames = [...new Set([...fromCatalog, ...Object.keys(byAsset)])].sort();

  if (!allNames.length) return [];

  return allNames.map((asset) => ({
    asset,
    value: byAsset[asset] ?? 0,
  }));
}

export function mergeDealers(wsDealers = [], fetched = []) {
  if (!fetched.length) return wsDealers;
  if (!wsDealers.length) return fetched;
  const map = new Map(fetched.map((d) => [d.pid, d]));
  return wsDealers.map((d) => {
    const fresh = map.get(d.pid);
    if (!fresh) return d;
    const wsBal = normalizeBalances(d.balances);
    const freshBal = normalizeBalances(fresh.balances);
    return {
      ...d,
      ...fresh,
      balances: freshBal.length >= wsBal.length ? fresh.balances : d.balances,
      orders: (fresh.orders?.length ? fresh.orders : d.orders) || [],
    };
  });
}

/** Lista ordens para cancelamento — inclui pendentes (sem order_id). */
export function flattenDealerOrders(dealers = [], { pid = null, pendingOnly = false, sentOnly = false } = {}) {
  const items = [];
  (dealers || []).forEach((dealer) => {
    if (!dealer?.pid || dealer.dealerStatus === 'morto') return;
    if (pid != null && dealer.pid !== pid) return;

    const { orders } = prepareDealerOrders(dealer.orders || []);
    orders.forEach((order) => {
      const isPending = order.order_id == null || order.order_id === '';
      if (pendingOnly && !isPending) return;
      if (sentOnly && isPending) return;

      items.push({
        pid: dealer.pid,
        wallet_name: dealer.wallet_name,
        dealerStatus: dealer.dealerStatus,
        order,
        isPending,
        cancelKey: isPending
          ? `pending|${order.base}|${order.quote}|${order.trade_dir}`
          : String(order.order_id),
      });
    });
  });

  return items.sort((a, b) => {
    const pidDiff = a.pid - b.pid;
    if (pidDiff) return pidDiff;
    if (a.isPending !== b.isPending) return a.isPending ? 1 : -1;
    return String(a.cancelKey).localeCompare(String(b.cancelKey));
  });
}
