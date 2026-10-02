import { bookAmountHuman, sortBookSide } from './sideswapBook';

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

function bestOrder(book, tradeDir) {
  return sortBookSide(book, tradeDir)[0] || null;
}

/** Camada A: ágio/deságio de cada perna disponível (até 2 por par: Buy e Sell). */
export function computeLegs(pairs, books, indPrices) {
  const legs = [];
  for (const pair of pairs || []) {
    const book = books?.[pair.key] || [];
    const ind = indPrices?.[pair.key]?.indPrice;
    if (!ind || !Number.isFinite(ind) || ind <= 0) continue;
    const bestBid = bestOrder(book, 'Buy');
    const bestAsk = bestOrder(book, 'Sell');

    if (bestBid?.price != null) {
      // Ordem Buy: MM compra a base pagando a quote. Ágio se pagou menos que o justo.
      legs.push({
        id: `${pair.key}:Buy`,
        pairKey: pair.key,
        base: pair.base,
        quote: pair.quote,
        side: 'Buy',
        label: `Buy ${pair.base}/${pair.quote}`,
        price: bestBid.price,
        amount: bestBid.amount ?? null,
        indPrice: ind,
        mmPct: ((ind - bestBid.price) / ind) * 100,
        give: pair.base,
        get: pair.quote,
        rate: bestBid.price,
        fairRate: ind,
        marketUrl: pair.marketUrl,
      });
    }
    if (bestAsk?.price != null) {
      // Ordem Sell: MM vende a base recebendo a quote. Ágio se vendeu acima do justo.
      legs.push({
        id: `${pair.key}:Sell`,
        pairKey: pair.key,
        base: pair.base,
        quote: pair.quote,
        side: 'Sell',
        label: `Sell ${pair.base}/${pair.quote}`,
        price: bestAsk.price,
        amount: bestAsk.amount ?? null,
        indPrice: ind,
        mmPct: ((bestAsk.price - ind) / ind) * 100,
        give: pair.quote,
        get: pair.base,
        rate: 1 / bestAsk.price,
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
        const route = {
          id: `route:${start}>${mid}>${end}`,
          start,
          mid,
          end,
          legs: [leg1, leg2],
          combinedMmPct,
          equivalentLabel,
          label: `Spread Opportunity — ${equivalentLabel} (${combinedMmPct.toFixed(2)}%)`,
        };
        route.execution = routeExecution(route);
        routes.push(route);
      }
    }
  }
  return routes.sort((a, b) => a.combinedMmPct - b.combinedMmPct);
}

/**
 * Capacidade da melhor ordem para quem toma o outro lado.
 * O amount do livro SideSwap é sempre na base do par.
 * Buy: taker entrega base e recebe quote.
 * Sell: taker entrega quote e recebe base.
 */
export function legCapacity(leg) {
  const unlimited = Number(leg?.amount) === 999999;
  const baseAmount = bookAmountHuman(leg?.amount);
  const price = Number(leg?.price);
  const priceOk = Number.isFinite(price) && price > 0;
  if (baseAmount == null) {
    return { baseAmount: null, giveAmount: null, getAmount: null, unlimited };
  }
  if (leg.side === 'Buy') {
    return {
      baseAmount,
      giveAmount: baseAmount,
      getAmount: priceOk ? baseAmount * price : null,
      unlimited: false,
    };
  }
  return {
    baseAmount,
    giveAmount: priceOk ? baseAmount * price : null,
    getAmount: baseAmount,
    unlimited: false,
  };
}

/**
 * Quanto a rota inteira comporta (limitado pela perna mais rasa) e o ganho
 * absoluto no ativo final, acima do preço justo, se executar esse amount.
 */
export function routeExecution(route) {
  const [leg1, leg2] = route?.legs || [];
  if (!leg1 || !leg2 || !leg1.rate || !leg2.rate) return null;

  const caps = [legCapacity(leg1), legCapacity(leg2)];
  const startFromLeg1 = caps[0].giveAmount;
  const startFromLeg2 = caps[1].giveAmount != null ? caps[1].giveAmount / leg1.rate : null;

  let startAmount = null;
  let limitedBy = null;
  if (startFromLeg1 != null && startFromLeg2 != null) {
    if (startFromLeg1 <= startFromLeg2) {
      startAmount = startFromLeg1;
      limitedBy = 0;
    } else {
      startAmount = startFromLeg2;
      limitedBy = 1;
    }
  } else if (startFromLeg1 != null) {
    startAmount = startFromLeg1;
    limitedBy = 0;
  } else if (startFromLeg2 != null) {
    startAmount = startFromLeg2;
    limitedBy = 1;
  }

  const achievedRate = leg1.rate * leg2.rate;
  const fairRate = leg1.fairRate * leg2.fairRate;
  const profitPerStart = fairRate != null ? achievedRate - fairRate : null;

  const sized = startAmount != null && profitPerStart != null;
  return {
    startAmount,
    midAmount: sized ? startAmount * leg1.rate : null,
    endAmount: sized ? startAmount * achievedRate : null,
    profitAmount: sized ? startAmount * profitPerStart : null,
    profitPerStart,
    startAsset: route.start,
    midAsset: route.mid,
    profitAsset: route.end,
    unlimited: startAmount == null && (caps[0].unlimited || caps[1].unlimited),
    limitedBy,
    caps,
  };
}

/**
 * Perna isolada: amount que cabe na ordem e ganho (ou economia) em quote
 * se executar esse amount.
 */
export function standaloneExecution(leg) {
  const cap = legCapacity(leg);
  const price = Number(leg?.price);
  const ind = Number(leg?.indPrice);
  const edgePerBase = Number.isFinite(price) && Number.isFinite(ind)
    ? Math.abs(price - ind)
    : null;
  const sized = cap.baseAmount != null && edgePerBase != null;
  return {
    inputAmount: cap.giveAmount,
    inputAsset: leg?.give ?? null,
    outputAmount: cap.getAmount,
    outputAsset: leg?.get ?? null,
    profitAmount: sized ? cap.baseAmount * edgePerBase : null,
    profitAsset: leg?.quote ?? null,
    baseAmount: cap.baseAmount,
    unlimited: cap.unlimited,
  };
}

/** Agrega as 3 camadas de uma vez a partir dos dados do useMarketScan. */
export function computeSpreadOpportunities(pairs, books, indPrices, options = {}) {
  const legs = computeLegs(pairs, books, indPrices);
  const standalone = findStandaloneOpportunities(legs);
  const routes = findRouteOpportunities(legs, { ...options, canonicalPairs: pairs || [] });
  return { legs, standalone, routes, total: standalone.length + routes.length };
}
