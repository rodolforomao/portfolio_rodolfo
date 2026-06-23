/**
 * Margem lucro/perda da ordem — mesma regra do terminal manager_dealer.
 * Usa o modo configurado; não trata preço do livro como preço fixo.
 */
import { getOrderPricingMode } from './orderPricing';
function buildMarginResult(marginPct, source, referencePrice = null) {
  if (marginPct == null || !Number.isFinite(marginPct)) {
    return { pct: null, kind: null, label: '—', shortLabel: '—', source, referencePrice };
  }

  const absPct = Math.abs(marginPct);
  const formatted = absPct.toFixed(2);
  let kind = 'neutro';
  if (marginPct > 0.004) kind = 'lucro';
  else if (marginPct < -0.004) kind = 'perda';

  const label = kind === 'neutro'
    ? `Neutro ${formatted}%`
    : `${kind === 'lucro' ? 'Lucro' : 'Perda'} ${formatted}%`;
  const shortLabel = kind === 'neutro'
    ? `±${formatted}%`
    : `${kind === 'lucro' ? '+' : '-'}${formatted}%`;

  return { pct: marginPct, kind, absPct, source, referencePrice, label, shortLabel };
}

export function marginFromPriceDiff(order, referencePrice, source = 'reference') {
  const tradeDir = String(order?.trade_dir || 'Buy');
  const price = parseFloat(order?.price);
  const ref = parseFloat(referencePrice);
  if (!Number.isFinite(price) || !Number.isFinite(ref) || ref === 0) {
    return buildMarginResult(null, source, referencePrice);
  }
  const rawPct = ((price - ref) / ref) * 100;
  const marginPct = tradeDir.toLowerCase() === 'buy' ? -rawPct : rawPct;
  return buildMarginResult(marginPct, source, ref);
}

/** Indica se a ordem seria enviada com prejuízo (mesma regra do manager_dealer). */
export function assessOrderLoss(order) {
  if (!order) return { hasLoss: false, label: null, pct: null };

  if (order.follow_target) {
    return { hasLoss: false, label: null, pct: null };
  }

  const margin = computeOrderMargin(order);
  if (margin.kind === 'perda') {
    return { hasLoss: true, label: margin.label, pct: margin.absPct };
  }

  const porc = Number(order.price_porc);
  if (Number.isFinite(porc) && porc < 0) {
    const pct = Math.abs(porc) * 100;
    return { hasLoss: true, label: `Perda ${pct.toFixed(2)}%`, pct };
  }

  const priceMin = Number(order.price_min);
  if (
    Number.isFinite(priceMin) && priceMin < 0
    && Number.isFinite(porc) && porc < 0
    && Math.abs(porc) >= Math.abs(priceMin) * 0.9
  ) {
    const pct = Math.abs(porc) * 100;
    return {
      hasLoss: true,
      label: `Perda ${pct.toFixed(2)}% (limite pm)`,
      pct,
    };
  }

  return { hasLoss: false, label: margin.label, pct: margin.pct };
}

export const LOSS_SEND_CONFIRM_STEPS = 2;

export function buildLossSendSignature(params) {
  return JSON.stringify({
    pid: params.pid,
    base: params.base,
    quote: params.quote,
    trade_dir: params.trade_dir,
    price: params.price ?? null,
    price_porc: params.price_porc ?? null,
    price_min: params.price_min ?? null,
    follow_target: params.follow_target ?? null,
    follow_target_order_id: params.follow_target_order_id ?? null,
    amount: params.amount ?? null,
  });
}

export function computeOrderMargin(order) {
  if (!order) {
    return { pct: null, kind: null, label: '—', shortLabel: '—', source: null };
  }

  const mode = getOrderPricingMode(order);

  if (mode === 'follow') {
    return buildMarginResult(null, 'follow', null);
  }

  if (mode === 'spread') {
    const porc = Number(order.price_porc);
    if (Number.isFinite(porc)) {
      return buildMarginResult(porc * 100, 'spread', null);
    }
  }

  if (mode === 'pm') {
    const pm = Number(order.price_min);
    if (Number.isFinite(pm)) {
      return buildMarginResult(pm * 100, 'pm', null);
    }
  }

  if (mode === 'fixed') {
    const price = parseFloat(order.price);
    const original = parseFloat(order.original_price);
    if (Number.isFinite(price) && Number.isFinite(original) && original !== 0) {
      return marginFromPriceDiff(order, original, 'dealer');
    }
    return buildMarginResult(null, 'fixed', price);
  }

  return buildMarginResult(null, null, null);
}

/** Conferência externa: nossa ordem vs ind_price público da SideSwap. */
export function computeExternalMargin(order, indPrice) {
  return marginFromPriceDiff(order, indPrice, 'sideswap');
}

/** Custo monetário estimado se a ordem subir ao 1º lugar (total × vs mercado do topo). */
export function computeTopPlaceCost(notional, topVsMarketPct) {
  const n = Number(notional);
  const pct = Number(topVsMarketPct);
  if (!Number.isFinite(n) || !Number.isFinite(pct)) return null;
  return n * (pct / 100);
}

/** Distância do topo do book no mesmo lado (Buy/Sell). */
export function computeVsBookTop(order, bookOrders = []) {
  const tradeDir = String(order?.trade_dir || 'Buy');
  const ourPrice = parseFloat(order?.price);
  if (!Number.isFinite(ourPrice)) return null;

  const side = (bookOrders || []).filter((o) => o.trade_dir === tradeDir);
  if (!side.length) return null;

  const sorted = tradeDir === 'Sell'
    ? [...side].sort((a, b) => (a.price || 0) - (b.price || 0))
    : [...side].sort((a, b) => (b.price || 0) - (a.price || 0));

  const top = sorted[0];
  const topPrice = parseFloat(top.price);
  if (!Number.isFinite(topPrice) || topPrice === 0) return null;

  const diffPct = ((ourPrice - topPrice) / topPrice) * 100;
  const isOurs = String(top.order_id) === String(order.order_id);

  return {
    topPrice,
    topOrderId: top.order_id,
    diffPct,
    isTop: isOurs,
    label: isOurs
      ? 'topo do book'
      : `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(3)}% vs topo ${tradeDir}`,
  };
}

export function formatPriceMin(order) {
  const pm = order?.price_min;
  if (pm == null || pm === '') return null;
  const n = Number(pm);
  if (!Number.isFinite(n)) return null;
  return `pm ${(n * 100).toFixed(2)}%`;
}
