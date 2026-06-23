import { canonicalAssetName, isLBTC, normalizeBalances } from './dealerFormat';
import { normalizeMarketOrder } from './sideswapBook';
import { getOrderStatus } from './orderStatus';

/** Saldo mínimo para a ordem aparecer ativa no livro público (por ativo). */
const MIN_FUNDING_BALANCE = {
  'L-BTC': 0.00001,
  'DePix': 0.01,
  'USDt': 0.01,
};

const DUST_DEFAULT = 0.000001;

/** Ativo que a ordem precisa ter para aparecer ativa no livro público. */
export function getOrderFundingAsset(order) {
  const dir = String(order?.trade_dir || '').toLowerCase();
  if (dir === 'sell') return canonicalAssetName(order?.base);
  if (dir === 'buy') return canonicalAssetName(order?.quote);
  return canonicalAssetName(order?.base);
}

export function getAssetBalance(balances, asset) {
  const canon = canonicalAssetName(asset);
  const row = normalizeBalances(balances).find(
    (b) => canonicalAssetName(b.asset) === canon,
  );
  if (!row) return 0;
  const n = typeof row.value === 'number' ? row.value : parseFloat(row.value);
  return Number.isFinite(n) ? n : 0;
}

export function getMinFundingBalance(asset) {
  const canon = canonicalAssetName(asset);
  if (MIN_FUNDING_BALANCE[canon] != null) return MIN_FUNDING_BALANCE[canon];
  if (isLBTC(canon)) return MIN_FUNDING_BALANCE['L-BTC'];
  return DUST_DEFAULT;
}

export function isInsufficientFunding(asset, balance) {
  if (!Number.isFinite(balance) || balance <= 0) return true;
  return balance < getMinFundingBalance(asset);
}

/**
 * Por que a ordem não aparece no livro público SideSwap.
 * @returns {{ key: 'found'|'sem_ativo'|'erro'|'unpublished'|'inverted', badgeLabel: string|null, publicLabel: string|null, variant: string, hint?: string, fundingAsset?: string, balance?: number, bookLabel?: string }}
 */
export function assessOrderBookPresence({
  order, balances, found, unpublished, invertedPair = false, bookLabel = null,
}) {
  if (unpublished) {
    return {
      key: 'unpublished',
      badgeLabel: 'não publicada',
      publicLabel: '—',
      variant: 'secondary',
      hint: 'Ordem ainda sem order_id no SideSwap.',
    };
  }

  if (found) {
    const label = bookLabel ? `no livro ${bookLabel}` : 'no livro';
    return {
      key: 'found',
      badgeLabel: label,
      publicLabel: bookLabel || 'no livro',
      bookLabel,
      variant: 'success',
      hint: bookLabel
        ? `Ordem visível no livro público SideSwap (${bookLabel}).`
        : 'Ordem visível no livro público SideSwap.',
    };
  }

  if (invertedPair) {
    return {
      key: 'inverted',
      badgeLabel: 'par invertido',
      publicLabel: 'n/d',
      variant: 'secondary',
      hint: 'Par local não existe na SideSwap — conferência de book indisponível.',
    };
  }

  const fundingAsset = getOrderFundingAsset(order);
  const balance = getAssetBalance(balances, fundingAsset);

  if (isInsufficientFunding(fundingAsset, balance)) {
    return {
      key: 'sem_ativo',
      badgeLabel: 'sem ativo',
      publicLabel: 'sem ativo',
      variant: 'warning',
      fundingAsset,
      balance,
      hint: (
        `Ordem configurada no dealer, mas sem ${fundingAsset} disponível `
        + '— por isso não entra no livro público SideSwap (active_amount = 0).'
      ),
    };
  }

  return {
    key: 'erro',
    badgeLabel: 'erro',
    publicLabel: 'erro',
    variant: 'danger',
    fundingAsset,
    balance,
    hint: (
      `Ordem #${order.order_id} com saldo de ${fundingAsset}, mas ausente do livro público SideSwap — investigar.`
    ),
  };
}

/** Resolve presença no book para uma ordem (placement do SideSwap WS ou fallback). */
export function resolveOrderBookPresence({
  order,
  balances,
  placement = null,
  combinations = [],
}) {
  if (!order) return null;

  const unpublished = !order.order_id;
  let invertedPair = false;
  let found = false;
  let bookLabel = null;

  if (placement) {
    invertedPair = !!placement.market?.inverted;
    found = !!placement.found;
    bookLabel = placement.found ? placement.label : null;
  } else if (!unpublished) {
    const market = normalizeMarketOrder(
      order.base,
      order.quote,
      order.trade_dir,
      combinations,
    );
    invertedPair = !!market?.inverted;
  }

  return assessOrderBookPresence({
    order,
    balances,
    found,
    unpublished,
    invertedPair,
    bookLabel,
  });
}

const CONFIG_SORT_RANK = {
  follow: 1200,
  calculating: 1300,
  pending: 1400,
  awaiting: 1500,
};

/** Menor = mais prioritário na lista do painel Ordens (no livro primeiro, sem ativo por último). */
export function dealerOrdersPanelSortRank(order, presence, placement) {
  if (presence?.key === 'found') {
    return placement?.position ?? 0;
  }
  if (presence?.key === 'erro') return 1000;
  if (presence?.key === 'inverted') return 1100;
  if (!order?.order_id) {
    const configKey = getOrderStatus(order).key;
    return CONFIG_SORT_RANK[configKey] ?? 1450;
  }
  if (presence?.key === 'unpublished') return 1600;
  if (presence?.key === 'sem_ativo') return 9000;
  return 5000;
}

export function sortDealerOrdersByBookPresence(orders, {
  placementByOrderId = new Map(),
  balances = [],
  combinations = [],
} = {}) {
  return [...orders].sort((a, b) => {
    const placementA = a.order_id ? placementByOrderId.get(String(a.order_id)) : null;
    const placementB = b.order_id ? placementByOrderId.get(String(b.order_id)) : null;
    const presenceA = resolveOrderBookPresence({
      order: a,
      balances,
      placement: placementA,
      combinations,
    });
    const presenceB = resolveOrderBookPresence({
      order: b,
      balances,
      placement: placementB,
      combinations,
    });
    const rankA = dealerOrdersPanelSortRank(a, presenceA, placementA);
    const rankB = dealerOrdersPanelSortRank(b, presenceB, placementB);
    if (rankA !== rankB) return rankA - rankB;
    const pairA = `${a.base}/${a.quote}`;
    const pairB = `${b.base}/${b.quote}`;
    return pairA.localeCompare(pairB) || String(a.trade_dir).localeCompare(String(b.trade_dir));
  });
}

/** Menor = mais prioritário na lista (no livro primeiro). */
export function historyEntryBookSortRank(entry, presence, placement) {
  if (!entry) return 99999;

  if (presence?.key === 'found') {
    const pos = placement?.position ?? 999;
    return pos;
  }
  if (presence?.key === 'erro') return 1000;
  if (presence?.key === 'sem_ativo') return 2000;
  if (presence?.key === 'inverted') return 2500;
  if (presence?.key === 'unpublished') return entry.isLive ? 3000 : 4000;
  return entry.isLive ? 3500 : 4500;
}

export function sortOrderHistoryByBook(entries, {
  placementByOrderId = new Map(),
  dealerByPid = new Map(),
  combinations = [],
} = {}) {
  return [...entries].sort((a, b) => {
    const orderA = {
      order_id: a.order_id,
      base: a.base,
      quote: a.quote,
      trade_dir: a.trade_dir,
      price: a.price,
      price_porc: a.price_porc,
      price_min: a.price_min,
      follow_target: a.follow_target,
    };
    const orderB = {
      order_id: b.order_id,
      base: b.base,
      quote: b.quote,
      trade_dir: b.trade_dir,
      price: b.price,
      price_porc: b.price_porc,
      price_min: b.price_min,
      follow_target: b.follow_target,
    };
    const placementA = a.order_id ? placementByOrderId.get(String(a.order_id)) : null;
    const placementB = b.order_id ? placementByOrderId.get(String(b.order_id)) : null;
    const presenceA = resolveOrderBookPresence({
      order: orderA,
      balances: dealerByPid.get(a.pid)?.balances,
      placement: placementA,
      combinations,
    });
    const presenceB = resolveOrderBookPresence({
      order: orderB,
      balances: dealerByPid.get(b.pid)?.balances,
      placement: placementB,
      combinations,
    });
    const rankA = historyEntryBookSortRank(a, presenceA, placementA);
    const rankB = historyEntryBookSortRank(b, presenceB, placementB);
    if (rankA !== rankB) return rankA - rankB;
    return String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || ''));
  });
}
