export function getMarketFromState(state, apiMarket = {}) {
  const assets = state?.assets?.length
    ? state.assets
    : (apiMarket.assets || []);
  const combinations = state?.combinations?.length
    ? state.combinations
    : (apiMarket.combinations || []);
  return { assets, combinations };
}

/** Ativos disponíveis nos selects de par (base e quote). */
export const TRADE_ASSET_OPTIONS = ['DePix', 'USDt', 'L-BTC'];

export function uniqueBases(combinations) {
  return [...new Set(combinations.map((c) => c.base))].sort();
}

export function quotesForBase(combinations, base) {
  return [...new Set(
    combinations.filter((c) => c.base === base).map((c) => c.quote),
  )].sort();
}

export function tradeDirsForPair(combinations, base, quote) {
  return combinations
    .filter((c) => c.base === base && c.quote === quote)
    .map((c) => c.trade_dir);
}

export function isValidCombination(combinations, base, quote, tradeDir) {
  return combinations.some(
    (c) => c.base === base && c.quote === quote && c.trade_dir === tradeDir,
  );
}

/** Interpretação humana: Buy = compra base pagando com quote. */
export function describeTrade(base, quote, tradeDir = 'Buy') {
  const dir = String(tradeDir).toLowerCase();
  const pair = `${base}/${quote}`;

  if (dir === 'buy') {
    return {
      pairLabel: `BUY ${pair}`,
      headline: `Comprando ${base} com ${quote}`,
      flow: `Entrega ${quote} → recebe ${base}`,
      baseLabel: 'Comprando (recebe)',
      quoteLabel: 'Pagando com',
    };
  }

  return {
    pairLabel: `SELL ${pair}`,
    headline: `Vendendo ${base} por ${quote}`,
    flow: `Entrega ${base} → recebe ${quote}`,
    baseLabel: 'Vendendo (entrega)',
    quoteLabel: 'Recebendo',
  };
}

export function tradeDirOptionLabel(base, quote, tradeDir) {
  const d = describeTrade(base, quote, tradeDir);
  return `${tradeDir} — ${d.headline}`;
}
