import { useMemo } from 'react';
import {
  buildPairSubscriptions,
  computePlacement,
  marketPairKeyFromNames,
  normalizeMarketOrder,
} from './utils/sideswapBook';

/**
 * Posição das ordens próprias no livro público SideSwap.
 *
 * Não abre WebSocket próprio — deriva tudo de `scan` (retorno de
 * useMarketScan), que já assina os 3 pares canônicos na mesma conexão usada
 * pela aba Oportunidades. Evita duplicar a conexão com a SideSwap para os
 * mesmos pares (useSideswapBook e useMarketScan assinavam os mesmos 3
 * mercados em sockets separados).
 */
export default function useSideswapBook(ownOrders, assets, combinations = [], scan = {}) {
  const {
    books = {},
    indPrices = {},
    status = 'idle',
    error = null,
    lastUpdate = null,
    reconnect = null,
  } = scan || {};

  const pairs = useMemo(
    () => buildPairSubscriptions(ownOrders, assets, combinations),
    [ownOrders, assets, combinations],
  );

  const placements = useMemo(() => (ownOrders || []).map((order) => {
    const market = normalizeMarketOrder(
      order.base,
      order.quote,
      order.trade_dir,
      combinations,
    );
    const key = marketPairKeyFromNames(order.base, order.quote, assets, combinations);
    const book = key ? (books[key] || []) : [];
    const placement = computePlacement(
      book,
      market.inverted
        ? { ...order, trade_dir: market.marketTradeDir }
        : order,
    );
    const pairMeta = pairs.find((p) => p.key === key);
    return {
      order,
      market,
      pairKey: key,
      marketUrl: pairMeta?.marketUrl || null,
      backendLabel: order.book_label || null,
      backendFound: order.book_found,
      ...placement,
    };
  }), [ownOrders, assets, combinations, books, pairs]);

  return {
    status,
    error,
    lastUpdate,
    pairs,
    books,
    indPrices,
    placements,
    reconnect,
  };
}
