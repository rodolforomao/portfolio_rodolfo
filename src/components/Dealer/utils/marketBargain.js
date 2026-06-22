import { sortBookSide } from './sideswapBook';

/** Ordens Sell abaixo do ind_price (desconto >= thresholdPct). */
export function findBelowMarketSells(book, indPrice, thresholdPct = 0.5) {
  if (indPrice == null || !Number.isFinite(indPrice) || indPrice <= 0) return [];

  const threshold = Math.max(0, Number(thresholdPct) || 0);
  const sells = sortBookSide(book, 'Sell');

  return sells
    .map((order) => {
      const price = Number(order.price);
      if (!Number.isFinite(price) || price <= 0) return null;
      const discountPct = ((indPrice - price) / indPrice) * 100;
      if (discountPct + 1e-9 < threshold) return null;
      return {
        order,
        price,
        indPrice,
        discountPct,
        orderId: order.order_id,
      };
    })
    .filter(Boolean);
}

export function bestBelowMarketHit(hits) {
  if (!hits?.length) return null;
  return [...hits].sort((a, b) => b.discountPct - a.discountPct)[0];
}

export const BELOW_MARKET_PAIR_OPTIONS = [
  'L-BTC/DePix',
  'L-BTC/USDt',
  'USDt/DePix',
];

export function normalizePairLabel(base, quote) {
  return `${base}/${quote}`;
}
