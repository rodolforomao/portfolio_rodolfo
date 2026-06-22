import { formatBookPrice } from './sideswapBook';

export const SIDESWAP_RATE_SOURCE = 'SideSwap · ind_price (mercado público)';

function formatBrlRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function findPairQuote(indPrices, pairs, base, quote) {
  const hit = (pairs || []).find((p) => p.base === base && p.quote === quote);
  if (!hit) return null;
  const pd = indPrices?.[hit.key];
  const indPrice = pd?.indPrice != null ? Number(pd.indPrice) : null;
  if (indPrice == null || !Number.isFinite(indPrice)) return null;
  return {
    indPrice,
    lastPrice: pd?.lastPrice != null ? Number(pd.lastPrice) : null,
    pairKey: hit.key,
    marketUrl: hit.marketUrl,
    base,
    quote,
  };
}

export function buildMarketRates(indPrices = {}, pairs = []) {
  const lbtcUsdt = findPairQuote(indPrices, pairs, 'L-BTC', 'USDt');
  const usdtDepix = findPairQuote(indPrices, pairs, 'USDt', 'DePix');
  const lbtcDepix = findPairQuote(indPrices, pairs, 'L-BTC', 'DePix');

  const btcUsdt = lbtcUsdt ? {
    id: 'btc-usdt',
    label: 'BTC / USDT',
    shortLabel: 'BTC/USDT',
    value: lbtcUsdt.indPrice,
    formatted: `$ ${formatBookPrice(lbtcUsdt.indPrice)}`,
    unit: 'USDT por 1 L-BTC',
    source: SIDESWAP_RATE_SOURCE,
    pair: 'L-BTC/USDt',
    marketUrl: lbtcUsdt.marketUrl,
  } : null;

  const usdtBrl = usdtDepix ? {
    id: 'usdt-brl',
    label: 'USDT / BRL',
    shortLabel: 'USDT/BRL',
    value: usdtDepix.indPrice,
    formatted: `R$ ${formatBrlRate(usdtDepix.indPrice)}`,
    unit: 'DePix por 1 USDT (proxy BRL)',
    source: SIDESWAP_RATE_SOURCE,
    pair: 'USDt/DePix',
    marketUrl: usdtDepix.marketUrl,
    brlNote: 'DePix ≈ Real (BRL)',
  } : null;

  let btcBrl = null;
  if (lbtcDepix) {
    btcBrl = {
      id: 'btc-brl',
      label: 'BTC / BRL',
      shortLabel: 'BTC/BRL',
      value: lbtcDepix.indPrice,
      formatted: `R$ ${formatBrlRate(lbtcDepix.indPrice)}`,
      unit: 'DePix por 1 L-BTC (proxy BRL)',
      source: SIDESWAP_RATE_SOURCE,
      pair: 'L-BTC/DePix',
      marketUrl: lbtcDepix.marketUrl,
      derived: false,
      brlNote: 'DePix ≈ Real (BRL)',
    };
  } else if (btcUsdt && usdtBrl) {
    const derived = btcUsdt.value * usdtBrl.value;
    btcBrl = {
      id: 'btc-brl',
      label: 'BTC / BRL',
      shortLabel: 'BTC/BRL',
      value: derived,
      formatted: `R$ ${formatBrlRate(derived)}`,
      unit: 'DePix por 1 L-BTC (proxy BRL)',
      source: `${SIDESWAP_RATE_SOURCE} · derivado`,
      pair: 'L-BTC/USDt × USDt/DePix',
      derived: true,
      brlNote: 'DePix ≈ Real (BRL)',
    };
  }

  return {
    rates: [btcUsdt, usdtBrl, btcBrl].filter(Boolean),
    btcUsdt,
    usdtBrl,
    btcBrl,
  };
}
