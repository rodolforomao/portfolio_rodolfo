import { canonicalAssetName } from './dealerFormat';

/** Pares não aceitos pelo SideSwap → orientação canônica (espelha order_market_normalize.py). */
const NON_CANONICAL = {
  'USDt|L-BTC': ['L-BTC', 'USDt'],
};

function pairKey(base, quote) {
  return `${canonicalAssetName(base)}|${canonicalAssetName(quote)}`;
}

export function needsMarketNormalize(base, quote) {
  if (!base || !quote) return false;
  return pairKey(base, quote) in NON_CANONICAL;
}

/**
 * Preserva intenção econômica invertendo base/quote e trade_dir.
 * USDt/L-BTC Buy → L-BTC/USDt Sell
 */
export function normalizeMarket(base, quote, tradeDir) {
  const canonical = NON_CANONICAL[pairKey(base, quote)];
  if (!canonical) {
    return {
      base: canonicalAssetName(base),
      quote: canonicalAssetName(quote),
      trade_dir: tradeDir,
      changed: false,
    };
  }

  const [newBase, newQuote] = canonical;
  const dir = String(tradeDir || '').trim().toLowerCase();
  const newDir = dir === 'buy' ? 'Sell' : 'Buy';

  return {
    base: newBase,
    quote: newQuote,
    trade_dir: newDir,
    changed: true,
  };
}

export function describeNormalize(base, quote, tradeDir) {
  const norm = normalizeMarket(base, quote, tradeDir);
  if (!norm.changed) return null;
  return (
    `${canonicalAssetName(base)}/${canonicalAssetName(quote)} ${tradeDir} → `
    + `${norm.base}/${norm.quote} ${norm.trade_dir} (par não aceito pelo SideSwap)`
  );
}

export function normalizeOrderMarket(order) {
  if (!order?.base || !order?.quote) return { order, changed: false, note: null };

  const norm = normalizeMarket(order.base, order.quote, order.trade_dir);
  if (!norm.changed) {
    return { order, changed: false, note: null };
  }

  const note = describeNormalize(order.base, order.quote, order.trade_dir);
  const next = {
    ...order,
    base: norm.base,
    quote: norm.quote,
    trade_dir: norm.trade_dir,
    _displayFrom: `${canonicalAssetName(order.base)}/${canonicalAssetName(order.quote)} ${order.trade_dir}`,
  };

  // Preço de referência do par antigo invalida margem (ex.: DePix vs USDt).
  if (!order.order_id) {
    next.price = order.price ?? null;
    next.original_price = null;
    next.last_original_price = null;
  }

  return { order: next, changed: true, note };
}

export function normalizeSendParams(params) {
  const norm = normalizeMarket(params.base, params.quote, params.trade_dir);
  const note = norm.changed
    ? describeNormalize(params.base, params.quote, params.trade_dir)
    : null;
  return {
    ...params,
    base: norm.base,
    quote: norm.quote,
    trade_dir: norm.trade_dir,
    normalizeNote: note,
  };
}

function orderIdentityKey(order) {
  const norm = normalizeMarket(order.base, order.quote, order.trade_dir);
  return `${norm.base}|${norm.quote}|${String(norm.trade_dir).toLowerCase()}`;
}

/**
 * Normaliza e deduplica ordens do dealer para exibição.
 * Se o backend ainda envia USDt/L-BTC e L-BTC/USDt equivalentes, mantém a com order_id.
 */
export function prepareDealerOrders(orders = []) {
  const byKey = new Map();
  const notes = [];

  (orders || []).forEach((raw) => {
    const { order, changed, note } = normalizeOrderMarket(raw);
    if (note) notes.push(note);

    const key = orderIdentityKey(order);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, {
        ...order,
        _normalized: changed,
        _sent: order.order_id != null && order.order_id !== '',
      });
      return;
    }

    const preferNew = (
      (order.order_id && !prev.order_id)
      || (order.price && !prev.price)
      || (order.original_price && !prev.original_price)
    );

    if (preferNew) {
      byKey.set(key, {
        ...prev,
        ...order,
        _normalized: prev._normalized || changed,
        _sent: order.order_id != null && order.order_id !== '',
      });
    }
  });

  return {
    orders: [...byKey.values()],
    normalizeNotes: [...new Set(notes)],
  };
}

/** Label compacto estilo terminal: usd-btc, btc-dx, etc. */
export function cleanPairName(base, quote) {
  const short = (asset) => {
    const c = canonicalAssetName(asset);
    if (c === 'L-BTC') return 'btc';
    if (c === 'USDt') return 'usd';
    if (c === 'DePix') return 'dx';
    return c.toLowerCase();
  };
  return `${short(base)}-${short(quote)}`;
}
