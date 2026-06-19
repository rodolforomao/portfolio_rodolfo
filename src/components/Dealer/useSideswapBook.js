import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SIDESWAP_WS_URL,
  applySideswapMessage,
  buildPairSubscriptions,
  buildSubscriptionKey,
  computePlacement,
  pairKeyFromIds,
  assetIdForName,
} from './utils/sideswapBook';

const RECONNECT_BASE_MS = 12000;
const RECONNECT_MAX_MS = 60000;

export default function useSideswapBook(ownOrders, assets, enabled = true) {
  const [books, setBooks] = useState({});
  const [indPrices, setIndPrices] = useState({});
  const [status, setStatus] = useState('idle');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const reqIdRef = useRef(1);
  const reconnectRef = useRef(null);
  const reconnectDelayRef = useRef(RECONNECT_BASE_MS);
  const intentionalCloseRef = useRef(false);
  const enabledRef = useRef(enabled);
  const pairsRef = useRef([]);
  const pendingSubsRef = useRef(new Map());
  const hadDataRef = useRef(false);

  enabledRef.current = enabled;

  const subscriptionKey = useMemo(() => {
    if (!enabled || !(ownOrders?.length)) return '';
    return buildSubscriptionKey(ownOrders, assets);
  }, [enabled, ownOrders, assets]);

  const pairs = useMemo(
    () => (subscriptionKey ? buildPairSubscriptions(ownOrders, assets) : []),
    [subscriptionKey, ownOrders, assets],
  );

  const updateBook = useCallback((pairKey, updater) => {
    setBooks((prev) => ({
      ...prev,
      [pairKey]: updater(prev[pairKey] || []),
    }));
    setLastUpdate(new Date());
    hadDataRef.current = true;
  }, []);

  const placements = useMemo(() => (ownOrders || []).map((order) => {
    const baseId = assetIdForName(order.base, assets);
    const quoteId = assetIdForName(order.quote, assets);
    const key = baseId && quoteId ? pairKeyFromIds(baseId, quoteId) : null;
    const book = key ? (books[key] || []) : [];
    const placement = computePlacement(book, order);
    const pairMeta = pairs.find((p) => p.key === key);
    return {
      order,
      pairKey: key,
      marketUrl: pairMeta?.marketUrl || null,
      backendLabel: order.book_label || null,
      backendFound: order.book_found,
      ...placement,
    };
  }), [ownOrders, assets, books, pairs]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
  }, []);

  const closeSocket = useCallback((intentional) => {
    intentionalCloseRef.current = intentional;
    clearReconnectTimer();
    const ws = wsRef.current;
    wsRef.current = null;
    if (!ws) return;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  }, [clearReconnectTimer]);

  const scheduleReconnect = useCallback(() => {
    if (!enabledRef.current || intentionalCloseRef.current) return;
    if (reconnectRef.current) return;

    const delay = reconnectDelayRef.current;
    reconnectRef.current = setTimeout(() => {
      reconnectRef.current = null;
      if (!enabledRef.current || !pairsRef.current.length) return;
      openConnection();
    }, delay);

    reconnectDelayRef.current = Math.min(delay * 1.5, RECONNECT_MAX_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openConnection = useCallback(() => {
    if (!enabledRef.current || !pairsRef.current.length) return;
    if (wsRef.current?.readyState === WebSocket.OPEN
      || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    closeSocket(true);

    setStatus((prev) => (prev === 'connected' && hadDataRef.current ? 'reconnecting' : 'connecting'));
    setError(null);

    const ws = new WebSocket(SIDESWAP_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      setStatus('connected');
      setError(null);
      reconnectDelayRef.current = RECONNECT_BASE_MS;
      pendingSubsRef.current.clear();

      pairsRef.current.forEach((pair) => {
        const id = reqIdRef.current++;
        pendingSubsRef.current.set(id, pair.key);
        ws.send(JSON.stringify({
          id,
          method: 'market',
          params: {
            subscribe: {
              asset_pair: { base: pair.baseId, quote: pair.quoteId },
            },
          },
        }));
      });
    };

    ws.onmessage = (ev) => {
      if (wsRef.current !== ws) return;
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (msg?.result?.subscribe) {
        const key = pendingSubsRef.current.get(msg.id);
        if (key) {
          pendingSubsRef.current.delete(msg.id);
          updateBook(key, () => applySideswapMessage([], msg));
        }
        return;
      }

      if (msg?.params?.market_price) {
        const mp = msg.params.market_price;
        const ap = mp?.asset_pair;
        if (ap?.base && ap?.quote) {
          const key = pairKeyFromIds(ap.base, ap.quote);
          if (pairsRef.current.some((p) => p.key === key)) {
            setIndPrices((prev) => ({
              ...prev,
              [key]: {
                indPrice: mp.ind_price,
                lastPrice: mp.last_price,
              },
            }));
          }
        }
        return;
      }

      const assetPair = msg?.params?.public_order_created?.order?.asset_pair
        || msg?.params?.public_order_removed?.asset_pair;

      if (!assetPair?.base || !assetPair?.quote) return;

      const key = pairKeyFromIds(assetPair.base, assetPair.quote);
      if (!pairsRef.current.some((p) => p.key === key)) return;

      updateBook(key, (current) => applySideswapMessage(current, msg));
    };

    ws.onerror = () => {
      if (wsRef.current !== ws || intentionalCloseRef.current) return;
      if (!hadDataRef.current) {
        setError('Falha ao conectar na SideSwap pública');
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
      if (intentionalCloseRef.current) {
        intentionalCloseRef.current = false;
        return;
      }
      if (!enabledRef.current) return;

      setStatus(hadDataRef.current ? 'reconnecting' : 'error');
      if (!hadDataRef.current) {
        setError('Falha ao conectar na SideSwap pública');
      }
      scheduleReconnect();
    };
  }, [closeSocket, updateBook, scheduleReconnect]);

  const manualReconnect = useCallback(() => {
    reconnectDelayRef.current = RECONNECT_BASE_MS;
    hadDataRef.current = false;
    setBooks({});
    setIndPrices({});
    closeSocket(true);
    openConnection();
  }, [closeSocket, openConnection]);

  useEffect(() => {
    pairsRef.current = pairs;

    if (!subscriptionKey || !pairs.length) {
      closeSocket(true);
      setBooks({});
      setIndPrices({});
      setStatus('idle');
      setError(null);
      hadDataRef.current = false;
      reconnectDelayRef.current = RECONNECT_BASE_MS;
      return undefined;
    }

    openConnection();

    return () => closeSocket(true);
  }, [subscriptionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    error,
    lastUpdate,
    pairs,
    books,
    indPrices,
    placements,
    reconnect: manualReconnect,
  };
}
