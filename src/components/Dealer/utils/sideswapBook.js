import { canonicalAssetName } from './dealerFormat';

export const SIDESWAP_WS_URL = 'wss://api.sideswap.io/json-rpc-ws';

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

export function buildPairSubscriptions(ownOrders, assets) {
  const seen = new Set();
  const pairs = [];

  (ownOrders || []).forEach((order) => {
    const baseId = assetIdForName(order.base, assets);
    const quoteId = assetIdForName(order.quote, assets);
    if (!baseId || !quoteId) return;
    const key = pairKeyFromIds(baseId, quoteId);
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({
      key,
      base: order.base,
      quote: order.quote,
      baseId,
      quoteId,
      marketUrl: sideswapMarketUrl(baseId, quoteId),
    });
  });

  return pairs;
}

/** Chave estável — evita reconectar quando só a referência do array muda. */
export function buildSubscriptionKey(ownOrders, assets) {
  const orders = (ownOrders || [])
    .map((o) => `${o.order_id}|${o.base}|${o.quote}|${o.trade_dir}`)
    .sort()
    .join(';');
  const ids = (assets || [])
    .map((a) => `${a.name || ''}:${a.id || ''}`)
    .sort()
    .join(';');
  return `${orders}||${ids}`;
}
