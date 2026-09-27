import { sortBookSide } from './sideswapBook';

/**
 * Modelo de 3 camadas para "Spread Opportunity" (arbitragem triangular
 * L-BTC / USDt / DePix no livro público SideSwap).
 *
 * Convenção de sinal (ágio/deságio), do ponto de vista do market maker dono
 * da posição:
 *   ágio   (+) → o MM está lucrando (spread normal, não é oportunidade)
 *   deságio (-) → o MM está pagando para trocar (perdendo margem — é aqui
 *                 que está a oportunidade para quem está do outro lado)
 *
 * Camada A — Leg Scanner: ágio/deságio de cada uma das 6 pernas (3 pares × lado).
 * Camada B — Route Finder: combina 2 pernas via ativo-ponte comum; oportunidade
 *            quando o combinado é deságio (negativo) e passa ROUTE_MIN_PCT.
 * Camada C — Standalone: uma perna sozinha já é oportunidade quando o deságio
 *            está entre STANDALONE_MIN_PCT e STANDALONE_MAX_PCT (sinal de
 *            desespero para vender — fora dessa faixa é spread normal ou
 *            ordem podre/parada).
 */

export const STANDALONE_MIN_PCT = 6;
export const STANDALONE_MAX_PCT = 20;
export const ROUTE_MIN_PCT = 0.5;

function bestBidAsk(book) {
  const buys = sortBookSide(book, 'Buy');
  const sells = sortBookSide(book, 'Sell');
  return {
    bestBid: buys[0]?.price ?? null,
    bestAsk: sells[0]?.price ?? null,
  };
}

/** Camada A: ágio/deságio de cada perna disponível (até 2 por par: Buy e Sell). */
export function computeLegs(pairs, books, indPrices) {
  const legs = [];
  for (const pair of pairs || []) {
    const book = books?.[pair.key] || [];
    const ind = indPrices?.[pair.key]?.indPrice;
    if (!ind || !Number.isFinite(ind) || ind <= 0) continue;
    const { bestBid, bestAsk } = bestBidAsk(book);

    if (bestBid != null) {
      // Ordem Buy: MM compra a base pagando a quote. Ágio se pagou menos que o justo.
      legs.push({
        id: `${pair.key}:Buy`,
        pairKey: pair.key,
        base: pair.base,
        quote: pair.quote,
        side: 'Buy',
        label: `Buy ${pair.base}/${pair.quote}`,
        price: bestBid,
        indPrice: ind,
        mmPct: ((ind - bestBid) / ind) * 100,
        give: pair.base,
        get: pair.quote,
        rate: bestBid,
        fairRate: ind,
        marketUrl: pair.marketUrl,
      });
    }
    if (bestAsk != null) {
      // Ordem Sell: MM vende a base recebendo a quote. Ágio se vendeu acima do justo.
      legs.push({
        id: `${pair.key}:Sell`,
        pairKey: pair.key,
        base: pair.base,
        quote: pair.quote,
        side: 'Sell',
        label: `Sell ${pair.base}/${pair.quote}`,
        price: bestAsk,
        indPrice: ind,
        mmPct: ((bestAsk - ind) / ind) * 100,
        give: pair.quote,
        get: pair.base,
        rate: 1 / bestAsk,
        fairRate: 1 / ind,
        marketUrl: pair.marketUrl,
      });
    }
  }
  return legs;
}

/** Camada C: perna isolada com deságio entre 6% e 20% (sinal de desespero). */
export function findStandaloneOpportunities(legs) {
  return (legs || []).filter(
    (l) => l.mmPct <= -STANDALONE_MIN_PCT && l.mmPct >= -STANDALONE_MAX_PCT,
  );
}

/**
 * Nomeia a rota pela posição de mercado equivalente (mesma convenção das
 * pernas, pelo lado do maker): dar `start` e receber `end` produz o mesmo
 * resultado que bater na melhor posição Buy ou Sell de um dos 3 pares
 * canônicos — a rota só existe porque ela faz melhor que essa posição direta.
 */
export function equivalentPositionLabel(start, end, canonicalPairs) {
  for (const { base, quote } of canonicalPairs) {
    if (base === start && quote === end) return `Buy ${base}/${quote}`;
    if (base === end && quote === start) return `Sell ${base}/${quote}`;
  }
  return null;
}

/** Camada B: combina 2 pernas via ativo-ponte comum (leg1.get === leg2.give). */
export function findRouteOpportunities(legs, { minPct = ROUTE_MIN_PCT, canonicalPairs = [] } = {}) {
  const routes = [];
  for (const leg1 of legs || []) {
    for (const leg2 of legs || []) {
      if (leg2.give !== leg1.get) continue;
      if (leg2.get === leg1.give) continue; // não fecha o ciclo voltando pro mesmo ativo direto
      if (leg2.pairKey === leg1.pairKey) continue;

      const achievedRate = leg1.rate * leg2.rate;
      const fairRate = leg1.fairRate * leg2.fairRate;
      if (!fairRate) continue;
      const combinedMmPct = ((fairRate - achievedRate) / fairRate) * 100;

      if (combinedMmPct <= -minPct) {
        const start = leg1.give;
        const mid = leg1.get;
        const end = leg2.get;
        const equivalentLabel = equivalentPositionLabel(start, end, canonicalPairs) || `${start}/${end}`;
        routes.push({
          id: `route:${start}>${mid}>${end}`,
          start,
          mid,
          end,
          legs: [leg1, leg2],
          combinedMmPct,
          equivalentLabel,
          label: `Spread Opportunity — ${equivalentLabel} (${combinedMmPct.toFixed(2)}%)`,
        });
      }
    }
  }
  return routes.sort((a, b) => a.combinedMmPct - b.combinedMmPct);
}

/** Agrega as 3 camadas de uma vez a partir dos dados do useMarketScan. */
export function computeSpreadOpportunities(pairs, books, indPrices, options = {}) {
  const legs = computeLegs(pairs, books, indPrices);
  const standalone = findStandaloneOpportunities(legs);
  const routes = findRouteOpportunities(legs, { ...options, canonicalPairs: pairs || [] });
  return { legs, standalone, routes, total: standalone.length + routes.length };
}
