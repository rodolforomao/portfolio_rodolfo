import { canonicalAssetName } from './dealerFormat';

export const SIDESWAP_WS_URL = 'wss://api.sideswap.io/json-rpc-ws';

/** Mercados públicos SideSwap (orientação canônica — igual ao manager_dealer). */
export const SIDESWAP_CANONICAL_PAIRS = [
  { base: 'L-BTC', quote: 'DePix' },
  { base: 'L-BTC', quote: 'USDt' },
  { base: 'USDt', quote: 'DePix' },
];

function matchesAssetPair(base, quote, catalogBase, catalogQuote) {
  return canonicalAssetName(base) === canonicalAssetName(catalogBase)
    && canonicalAssetName(quote) === canonicalAssetName(catalogQuote);
}

/**
 * SideSwap só expõe um sentido por mercado (ex.: L-BTC/USDt, nunca USDt/L-BTC).
 * Mapeia o par do dealer para a orientação do livro público.
 */
export function resolveSideswapMarketPair(base, quote, combinations = []) {
  const dealerBase = canonicalAssetName(base);
  const dealerQuote = canonicalAssetName(quote);
  const catalog = combinations?.length ? combinations : SIDESWAP_CANONICAL_PAIRS;

  const direct = catalog.find((c) => matchesAssetPair(dealerBase, dealerQuote, c.base, c.quote));
  if (direct) {
    return {
      marketBase: canonicalAssetName(direct.base),
      marketQuote: canonicalAssetName(direct.quote),
      inverted: false,
    };
  }

  const swapped = catalog.find((c) => matchesAssetPair(dealerQuote, dealerBase, c.base, c.quote));
  if (swapped) {
    return {
      marketBase: canonicalAssetName(swapped.base),
      marketQuote: canonicalAssetName(swapped.quote),
      inverted: true,
    };
  }

  return { marketBase: dealerBase, marketQuote: dealerQuote, inverted: false };
}

export function marketPairKeyFromNames(base, quote, assets, combinations = []) {
  const { marketBase, marketQuote } = resolveSideswapMarketPair(base, quote, combinations);
  const baseId = assetIdForName(marketBase, assets);
  const quoteId = assetIdForName(marketQuote, assets);
  if (!baseId || !quoteId) return null;
  return pairKeyFromIds(baseId, quoteId);
}

/**
 * Mesma regra do manager_dealer (order_market_normalize.py):
 * USDt/L-BTC Buy → L-BTC/USDt Sell no livro público.
 */
export function normalizeMarketOrder(base, quote, tradeDir, combinations = []) {
  const dealerBase = canonicalAssetName(base);
  const dealerQuote = canonicalAssetName(quote);
  const dealerTradeDir = tradeDir || 'Buy';
  const resolved = resolveSideswapMarketPair(base, quote, combinations);

  if (!resolved.inverted) {
    return {
      ...resolved,
      dealerBase,
      dealerQuote,
      dealerTradeDir,
      marketTradeDir: dealerTradeDir,
    };
  }

  const dir = String(dealerTradeDir).toLowerCase();
  const marketTradeDir = dir === 'buy' ? 'Sell' : 'Buy';
  return {
    ...resolved,
    dealerBase,
    dealerQuote,
    dealerTradeDir,
    marketTradeDir,
  };
}

export function describeMarketNormalize(base, quote, tradeDir, combinations = []) {
  const m = normalizeMarketOrder(base, quote, tradeDir, combinations);
  if (!m.inverted) return `${m.dealerBase}/${m.dealerQuote} ${m.dealerTradeDir}`;
  return (
    `${m.dealerBase}/${m.dealerQuote} ${m.dealerTradeDir} → `
    + `${m.marketBase}/${m.marketQuote} ${m.marketTradeDir} (SideSwap)`
  );
}

export function assetIdForName(name, assets = []) {
  const canon = canonicalAssetName(name);
  const hit = (assets || []).find((a) => canonicalAssetName(a.name || a) === canon);
  return hit?.id || null;
}

export function pairKeyFromIds(baseId, quoteId) {
  return `${baseId}|${quoteId}`;
}

export function sideswapMarketUrl(baseId, quoteId) {
  return `https://sideswap.io/swap-market/?base=${encodeURIComponent(baseId)}&quote=${encodeURIComponent(quoteId)}`;
}

export function sortBookSide(orders, tradeDir) {
  const side = (orders || []).filter((o) => o.trade_dir === tradeDir);
  if (tradeDir === 'Sell') {
    return [...side].sort((a, b) => (a.price || 0) - (b.price || 0));
  }
  return [...side].sort((a, b) => (b.price || 0) - (a.price || 0));
}

/** Posição da nossa ordem no livro público (mesma lógica do manager_dealer). */
export function computePlacement(bookOrders, ownOrder) {
  const tradeDir = ownOrder?.trade_dir;
  const orderId = ownOrder?.order_id;
  const empty = {
    position: null,
    total: 0,
    found: false,
    label: '-',
    sideOrders: [],
  };
  if (!tradeDir || orderId == null) return empty;

  const lista = sortBookSide(bookOrders, tradeDir);
  const target = String(orderId);
  let position = null;
  lista.forEach((item, idx) => {
    if (String(item.order_id) === target) position = idx + 1;
  });

  const total = lista.length;
  let label = '-';
  if (position) label = `${position}/${total}`;
  else if (total) label = `?/${total}`;

  return {
    position,
    total,
    found: position !== null,
    label,
    sideOrders: lista,
  };
}

export function formatBookPrice(price) {
  const n = Number(price);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 8 });
}

export function formatBookAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e6) return `${(n / 1e8).toFixed(4)} L-BTC`;
  return n.toLocaleString('pt-BR');
}

function upsertOrder(list, order) {
  const id = String(order.order_id);
  const idx = list.findIndex((o) => String(o.order_id) === id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], ...order };
    return next;
  }
  return [...list, order];
}

function removeOrder(list, orderId) {
  const id = String(orderId);
  return list.filter((o) => String(o.order_id) !== id);
}

export function applySideswapMessage(bookOrders, message) {
  const params = message?.params;
  const result = message?.result;

  if (result?.subscribe?.orders) {
    return [...result.subscribe.orders];
  }

  if (params?.public_order_created?.order) {
    return upsertOrder(bookOrders, params.public_order_created.order);
  }

  if (params?.public_order_removed?.order_id != null) {
    return removeOrder(bookOrders, params.public_order_removed.order_id);
  }

  return bookOrders;
}

export function buildPairSubscriptions(ownOrders, assets, combinations = []) {
  const byKey = new Map();

  (ownOrders || []).forEach((order) => {
    const { marketBase, marketQuote, inverted } = resolveSideswapMarketPair(
      order.base,
      order.quote,
      combinations,
    );
    const baseId = assetIdForName(marketBase, assets);
    const quoteId = assetIdForName(marketQuote, assets);
    if (!baseId || !quoteId) return;

    const key = pairKeyFromIds(baseId, quoteId);
    const dealerLabel = `${canonicalAssetName(order.base)}/${canonicalAssetName(order.quote)}`;

    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        base: marketBase,
        quote: marketQuote,
        baseId,
        quoteId,
        marketUrl: sideswapMarketUrl(baseId, quoteId),
        dealerLabels: new Set(),
        hasInverted: false,
      });
    }

    const entry = byKey.get(key);
    entry.dealerLabels.add(dealerLabel);
    if (inverted) entry.hasInverted = true;
  });

  return [...byKey.values()].map((pair) => ({
    ...pair,
    dealerLabels: [...pair.dealerLabels].sort(),
  }));
}

/** Chave estável — evita reconectar quando só a referência do array muda. */
export function buildSubscriptionKey(ownOrders, assets, combinations = []) {
  const orders = (ownOrders || [])
    .map((o) => `${o.order_id}|${o.base}|${o.quote}|${o.trade_dir}`)
    .sort()
    .join(';');
  const marketKeys = [...new Set(
    (ownOrders || [])
      .map((o) => marketPairKeyFromNames(o.base, o.quote, assets, combinations))
      .filter(Boolean),
  )].sort().join(';');
  const ids = (assets || [])
    .map((a) => `${a.name || ''}:${a.id || ''}`)
    .sort()
    .join(';');
  return `${orders}||${marketKeys}||${ids}`;
}
