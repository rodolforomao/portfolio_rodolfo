/**
 * Mapeamento de comportamento do concorrente — lógica pura (sem React).
 *
 * Rastreia, por escopo `pairKey|tradeDir`, o histórico de preço do concorrente
 * que disputa posição conosco no livro público, para inferir um "piso provável"
 * dele (preço mínimo que ele está disposto a aceitar) e o quão confiável é essa
 * inferência. Somente leitura/visualização — não decide nem envia ordens.
 */

// Distância nossa↔concorrente abaixo da qual conta como "estamos perto o suficiente
// pra provocar reação". Calibrado a partir do corte de 0.4% já usado como "margem
// significativa" em orderMargin.js — 0.15% é perto o bastante pra ser pressão de
// posição real, sem confundir com o ruído normal de espaçamento entre vizinhos do book.
export const APPROACH_THRESHOLD_PCT = 0.15;

// Tempo que aguardamos, após uma aproximação, para classificar a reação do
// concorrente. SideSwap não tem "edit" nativo — reprecificar implica remove+create;
// 90s cobre a latência típica de reprecificação sem deixar a janela aberta por
// múltiplos ciclos de mercado.
export const REACTION_WINDOW_MS = 90_000;

// Queda mínima no preço do concorrente dentro da REACTION_WINDOW_MS para contar
// como "ele desceu por causa da gente" e não ruído de arredondamento.
export const REACTION_DROP_THRESHOLD_PCT = 0.05;

// Nº de aproximações sem reação para elevar confiança baixa→média.
export const HOLD_CONFIRM_COUNT = 3;

// Nº de aproximações sem reação (com pelo menos 2 streaks temporais distintos)
// para elevar confiança média→alta.
export const HOLD_CONFIRM_COUNT_HIGH = 6;

// Separação mínima entre o fim de uma janela de aproximação e o início da
// próxima para contar como tentativas independentes (evita inflar confiança
// com várias amostras do mesmo evento de mercado).
export const STREAK_GAP_MS = 5 * 60_000;

// Tolerância entre o order_id sumir do book e ser classificado como saída real
// (cancelou) em vez de só um tick perdido de WS/edit com id novo.
export const COMPETITOR_LOST_GRACE_MS = 20_000;

// Ao perder o order_id monitorado, se um order_id novo aparecer no mesmo lado
// dentro da janela de graça com preço a essa distância do último visto, tratamos
// como o mesmo concorrente (id trocou por reprecificação) — preserva a série.
export const REPLACEMENT_PRICE_TOLERANCE_PCT = 0.3;

// Cap de memória por escopo — a série é só para desenhar o gráfico da modal.
export const SERIES_MAX_POINTS = 600;
export const SERIES_SAMPLE_INTERVAL_MS = 2_000;
export const EVENTS_MAX_AGE_MS = 6 * 60 * 60_000;
export const EVENTS_MAX_COUNT = 200;

function pctDistance(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return Math.abs((a - b) / b) * 100;
}

/** true se `price` é mais agressivo (melhor colocado) que `otherPrice` no lado `tradeDir`. */
function isMoreAggressive(price, otherPrice, tradeDir) {
  if (!Number.isFinite(price) || !Number.isFinite(otherPrice)) return false;
  return tradeDir === 'Sell' ? price < otherPrice : price > otherPrice;
}

export function makeEmptyScopeState(scope) {
  return {
    scope,
    competitorOrderId: null,
    series: [],
    events: [],
    approachWindow: null,
    inferredFloor: null,
    confidence: 'baixa',
    status: 'no_competitor',
    lastSeenAt: null,
    lastSampleAt: null,
    lastCompetitorPrice: null,
    wasAheadOfCompetitor: null,
  };
}

/**
 * Escolhe o concorrente-alvo do escopo:
 * 1) ourOrder.follow_ref_order_id, se ainda presente no book;
 * 2) vizinho imediato mais bem colocado, se nossa ordem está no book;
 * 3) null (sem concorrente à frente / ordem fora do book).
 */
export function resolveCompetitorTarget(bookOrdersSorted, ourOrder, ourPlacement) {
  const list = bookOrdersSorted || [];
  const ourId = ourOrder?.order_id != null ? String(ourOrder.order_id) : null;

  const followRefId = ourOrder?.follow_ref_order_id != null
    ? String(ourOrder.follow_ref_order_id)
    : null;
  if (followRefId) {
    const pinned = list.find((o) => String(o.order_id) === followRefId && String(o.order_id) !== ourId);
    if (pinned) {
      return { competitorOrderId: followRefId, competitorPrice: Number(pinned.price), reason: 'follow_ref' };
    }
  }

  if (ourPlacement?.found && ourPlacement.position > 1) {
    const neighbor = list[ourPlacement.position - 2];
    if (neighbor && String(neighbor.order_id) !== ourId) {
      return {
        competitorOrderId: String(neighbor.order_id),
        competitorPrice: Number(neighbor.price),
        reason: 'neighbor',
      };
    }
  }

  return { competitorOrderId: null, competitorPrice: null, reason: 'none' };
}

/** Distância percentual com sinal + flag de aproximação. */
export function detectApproachEvent(ourPrice, competitorPrice, tradeDir, thresholdPct = APPROACH_THRESHOLD_PCT) {
  const distancePct = pctDistance(ourPrice, competitorPrice);
  if (distancePct == null) return { distancePct: null, isApproach: false };
  return { distancePct, isApproach: distancePct <= thresholdPct };
}

function pruneOld(list, now, maxAgeMs, maxCount) {
  const cutoff = now - maxAgeMs;
  const fresh = list.filter((e) => e.ts > cutoff);
  return fresh.length > maxCount ? fresh.slice(fresh.length - maxCount) : fresh;
}

/**
 * Piso provável + confiança a partir dos eventos 'reaction_hold'/'reaction_drop'.
 * Piso = menor competitorPrice visto em reaction_hold POSTERIOR ao último
 * reaction_drop (um reaction_drop invalida um candidato a piso anterior, pois
 * prova que o concorrente ainda tinha margem pra cair).
 */
export function inferCompetitorFloor(state) {
  const events = state?.events || [];
  let lastDropIdx = -1;
  events.forEach((e, idx) => {
    if (e.type === 'reaction_drop') lastDropIdx = idx;
  });

  const holdsAfterDrop = events
    .slice(lastDropIdx + 1)
    .filter((e) => e.type === 'reaction_hold' && Number.isFinite(e.competitorPrice));

  if (!holdsAfterDrop.length) {
    return { inferredFloor: null, confidence: 'baixa' };
  }

  const inferredFloor = holdsAfterDrop.reduce(
    (min, e) => (min == null || e.competitorPrice < min ? e.competitorPrice : min),
    null,
  );

  let streaks = 0;
  let prevTs = null;
  holdsAfterDrop.forEach((e) => {
    if (prevTs == null || e.ts - prevTs > STREAK_GAP_MS) streaks += 1;
    prevTs = e.ts;
  });

  let confidence = 'baixa';
  if (holdsAfterDrop.length >= HOLD_CONFIRM_COUNT_HIGH && streaks >= 2) {
    confidence = 'alta';
  } else if (holdsAfterDrop.length >= HOLD_CONFIRM_COUNT) {
    confidence = 'media';
  }

  return { inferredFloor, confidence };
}

/**
 * Atualiza (MUTA e retorna o mesmo objeto, por performance — quem chama gerencia
 * isso via useRef) o TrackingScopeState de um escopo a partir de um novo snapshot
 * de book. Só deve ser chamado quando a conexão do book está 'connected' — quem
 * chama filtra isso antes.
 */
export function updateCompetitorScope(prevState, {
  scope, tradeDir, bookOrdersSorted, ourOrder, ourPlacement, now = Date.now(),
}) {
  const state = prevState || makeEmptyScopeState(scope);
  const eventsCountAtStart = state.events.length;
  const ourPrice = Number(ourOrder?.price);
  const target = resolveCompetitorTarget(bookOrdersSorted, ourOrder, ourPlacement);

  // Ordem própria não está no book — sem referência pra medir distância.
  if (!ourPlacement?.found || !Number.isFinite(ourPrice)) {
    state.status = 'no_competitor';
    return state;
  }

  // Já somos 1º — sem concorrente à frente.
  if (!target.competitorOrderId && ourPlacement.position === 1) {
    state.status = 'we_lead';
    state.approachWindow = null;
    return state;
  }

  if (!target.competitorOrderId) {
    state.status = 'no_competitor';
    state.approachWindow = null;
    return state;
  }

  // Troca de order_id monitorado.
  if (state.competitorOrderId && state.competitorOrderId !== target.competitorOrderId) {
    const withinGrace = state.lastSeenAt != null && (now - state.lastSeenAt) <= COMPETITOR_LOST_GRACE_MS;
    const priceDist = pctDistance(target.competitorPrice, state.lastCompetitorPrice);
    const plausibleContinuation = withinGrace
      && priceDist != null
      && priceDist <= REPLACEMENT_PRICE_TOLERANCE_PCT;

    if (!plausibleContinuation) {
      state.events.push({
        ts: now,
        type: 'competitor_lost',
        ourPrice,
        competitorPrice: state.lastCompetitorPrice,
        competitorOrderId: state.competitorOrderId,
        deltaPct: null,
      });
      state.approachWindow = null;
    }
    state.competitorOrderId = target.competitorOrderId;
  } else if (!state.competitorOrderId) {
    state.competitorOrderId = target.competitorOrderId;
  }

  const competitorPrice = target.competitorPrice;
  state.lastSeenAt = now;
  state.status = 'tracking';

  const { distancePct, isApproach } = detectApproachEvent(ourPrice, competitorPrice, tradeDir);

  if (isApproach && !state.approachWindow) {
    state.approachWindow = {
      startedAt: now,
      ourPriceAtApproach: ourPrice,
      competitorPriceAtApproach: competitorPrice,
      competitorOrderId: target.competitorOrderId,
    };
    state.events.push({
      ts: now,
      type: 'approach',
      ourPrice,
      competitorPrice,
      competitorOrderId: target.competitorOrderId,
      deltaPct: distancePct,
    });
  }

  if (state.approachWindow) {
    const elapsed = now - state.approachWindow.startedAt;
    if (elapsed > REACTION_WINDOW_MS) {
      const before = state.approachWindow.competitorPriceAtApproach;
      const movedAway = !isMoreAggressive(competitorPrice, before, tradeDir)
        ? 0
        : pctDistance(before, competitorPrice);
      const dropPct = movedAway || 0;
      const reacted = dropPct >= REACTION_DROP_THRESHOLD_PCT;
      state.events.push({
        ts: now,
        type: reacted ? 'reaction_drop' : 'reaction_hold',
        ourPrice,
        competitorPrice,
        competitorOrderId: state.approachWindow.competitorOrderId,
        deltaPct: dropPct,
      });
      state.approachWindow = null;
    }
  }

  // "Overtaken": o concorrente passou de "pior que nós" para "melhor que nós"
  // neste tick (cruzamento de posição, não só proximidade).
  const competitorIsAheadNow = isMoreAggressive(competitorPrice, ourPrice, tradeDir);
  if (competitorIsAheadNow && state.wasAheadOfCompetitor === false) {
    state.events.push({
      ts: now, type: 'overtaken', ourPrice, competitorPrice, competitorOrderId: target.competitorOrderId, deltaPct: null,
    });
  }
  state.wasAheadOfCompetitor = !competitorIsAheadNow;

  state.lastCompetitorPrice = competitorPrice;

  // Amostra no máx a cada SERIES_SAMPLE_INTERVAL_MS, mas sempre força um ponto
  // extra quando um evento foi empilhado neste tick (não perder o instante exato
  // de aproximação/reação no gráfico).
  const eventJustHappened = state.events.length > eventsCountAtStart;
  const dueForSample = state.lastSampleAt == null || (now - state.lastSampleAt) >= SERIES_SAMPLE_INTERVAL_MS;
  if (dueForSample || eventJustHappened) {
    state.series.push({ ts: now, ourPrice, competitorPrice });
    state.lastSampleAt = now;
    if (state.series.length > SERIES_MAX_POINTS) {
      state.series = state.series.slice(state.series.length - SERIES_MAX_POINTS);
    }
  }

  state.events = pruneOld(state.events, now, EVENTS_MAX_AGE_MS, EVENTS_MAX_COUNT);

  const { inferredFloor, confidence } = inferCompetitorFloor(state);
  state.inferredFloor = inferredFloor;
  state.confidence = confidence;

  return state;
}
