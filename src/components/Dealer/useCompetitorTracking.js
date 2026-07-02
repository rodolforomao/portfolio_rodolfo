import { useCallback, useEffect, useRef, useState } from 'react';
import { makeEmptyScopeState, updateCompetitorScope } from './utils/competitorTracking';

/**
 * Rastreia, por escopo `pairKey|tradeDir`, o histórico de preço do concorrente
 * que disputa posição com cada ordem própria — para a modal de mapeamento de
 * comportamento do concorrente. Reaproveita `placements` (já calculado por
 * `useSideswapBook`, mesma fonte da tabela "Top Sell/Buy") em vez de recalcular
 * posição/ordenação do book.
 *
 * Só atualiza quando `bookStatus === 'connected'` — evita gerar falsos eventos
 * de "concorrente sumiu" durante reconexões do WebSocket.
 */
export default function useCompetitorTracking(books, placements, bookStatus) {
  const storeRef = useRef(new Map());
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (bookStatus && bookStatus !== 'connected') return;

    const now = Date.now();
    const seenScopes = new Set();

    (placements || []).forEach((item) => {
      const { order, market, pairKey } = item;
      if (!pairKey || order?.order_id == null) return;

      const tradeDir = market?.marketTradeDir || order.trade_dir;
      const scope = `${pairKey}|${tradeDir}`;
      seenScopes.add(scope);

      const ourOrder = market?.inverted ? { ...order, trade_dir: tradeDir } : order;
      const ourPlacement = { position: item.position, total: item.total, found: item.found };

      const prev = storeRef.current.get(scope) || makeEmptyScopeState(scope);
      const next = updateCompetitorScope(prev, {
        scope,
        tradeDir,
        bookOrdersSorted: item.sideOrders || [],
        ourOrder,
        ourPlacement,
        now,
      });
      storeRef.current.set(scope, next);
    });

    // Poda escopos cujo pairKey não existe mais em `books` (dealer trocado / ordem removida).
    for (const key of storeRef.current.keys()) {
      const [pairKey] = key.split('|');
      if (!(pairKey in (books || {})) || !seenScopes.has(key)) {
        storeRef.current.delete(key);
      }
    }

    forceRender((n) => n + 1);
  }, [books, placements, bookStatus]);

  const getCompetitorMap = useCallback((pairKey, tradeDir) => {
    const scope = `${pairKey}|${tradeDir}`;
    const state = storeRef.current.get(scope);
    if (!state) return null;
    return {
      competitorOrderId: state.competitorOrderId,
      series: state.series,
      inferredFloor: state.inferredFloor,
      confidence: state.confidence,
      events: state.events,
      status: state.status,
    };
  }, []);

  return { getCompetitorMap };
}
