import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SIDESWAP_WS_URL,
  SIDESWAP_CANONICAL_PAIRS,
  applySideswapMessage,
  assetIdForName,
  pairKeyFromIds,
  sideswapMarketUrl,
} from './utils/sideswapBook';
import { canonicalAssetName } from './utils/dealerFormat';

const RECONNECT_BASE_MS = 15000;
const RECONNECT_MAX_MS = 90000;

/** Assina TODOS os pares canônicos para varredura de mercado (sem precisar de ownOrders). */
export default function useMarketScan(assets, enabled = true) {
  const [books, setBooks] = useState({});
  const [indPrices, setIndPrices] = useState({});
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const wsRef = useRef(null);
  const reqIdRef = useRef(1);
  const reconnectRef = useRef(null);
  const reconnectDelayRef = useRef(RECONNECT_BASE_MS);
  const intentionalCloseRef = useRef(false);
  const enabledRef = useRef(enabled);
  const pendingSubsRef = useRef(new Map());
  const hadDataRef = useRef(false);

  enabledRef.current = enabled;

  /* Chave estável: só muda quando os IDs dos assets realmente mudam.
     Impede que o state_update de 3s (nova referência de array) feche/reabra o WS. */
  const assetsKey = useMemo(
    () => (assets?.length ? [...assets].map((a) => a.id).sort().join(',') : ''),
    [assets],
  );

  /* Resolve pares canônicos com asset IDs */
  const buildPairs = useCallback(() => {
    if (!assets?.length) return [];
    return SIDESWAP_CANONICAL_PAIRS.flatMap(({ base, quote }) => {
      const baseId = assetIdForName(canonicalAssetName(base), assets);
      const quoteId = assetIdForName(canonicalAssetName(quote), assets);
      if (!baseId || !quoteId) return [];
      const key = pairKeyFromIds(baseId, quoteId);
      return [{
        key,
        base: canonicalAssetName(base),
        quote: canonicalAssetName(quote),
        baseId,
        quoteId,
        marketUrl: sideswapMarketUrl(baseId, quoteId),
      }];
    });
  }, [assets]);

  const clearTimer = useCallback(() => {
    if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
  }, []);

  const closeSocket = useCallback((intentional) => {
    intentionalCloseRef.current = intentional;
    clearTimer();
    const ws = wsRef.current;
    wsRef.current = null;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
  }, [clearTimer]);

  const scheduleReconnect = useCallback((pairs) => {
    if (!enabledRef.current || intentionalCloseRef.current || reconnectRef.current) return;
    const delay = reconnectDelayRef.current;
    reconnectRef.current = setTimeout(() => {
      reconnectRef.current = null;
      if (!enabledRef.current) return;
      openSocket(pairs); // eslint-disable-line no-use-before-define
    }, delay);
    reconnectDelayRef.current = Math.min(delay * 1.5, RECONNECT_MAX_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openSocket = useCallback((pairs) => {
    if (!pairs?.length || !enabledRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN
      || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    closeSocket(true);
    setStatus(hadDataRef.current ? 'reconnecting' : 'connecting');
    setError(null);

    const ws = new WebSocket(SIDESWAP_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      setStatus('connected');
      reconnectDelayRef.current = RECONNECT_BASE_MS;
      pendingSubsRef.current.clear();

      pairs.forEach((pair) => {
        const id = reqIdRef.current++;
        pendingSubsRef.current.set(id, pair.key);
        ws.send(JSON.stringify({
          id,
          method: 'market',
          params: { subscribe: { asset_pair: { base: pair.baseId, quote: pair.quoteId } } },
        }));
      });
    };

    ws.onmessage = (ev) => {
      if (wsRef.current !== ws) return;
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }

      if (msg?.result?.subscribe) {
        const key = pendingSubsRef.current.get(msg.id);
        if (key) {
          pendingSubsRef.current.delete(msg.id);
          setBooks((prev) => ({ ...prev, [key]: applySideswapMessage([], msg) }));
          setLastUpdate(new Date());
          hadDataRef.current = true;
        }
        return;
      }

      if (msg?.params?.market_price) {
        const mp = msg.params.market_price;
        const ap = mp?.asset_pair;
        if (ap?.base && ap?.quote) {
          const key = pairKeyFromIds(ap.base, ap.quote);
          if (pairs.some((p) => p.key === key)) {
            setIndPrices((prev) => ({
              ...prev,
              [key]: { indPrice: mp.ind_price, lastPrice: mp.last_price },
            }));
          }
        }
        return;
      }

      const assetPair = msg?.params?.public_order_created?.order?.asset_pair
        || msg?.params?.public_order_removed?.asset_pair;
      if (!assetPair?.base || !assetPair?.quote) return;
      const key = pairKeyFromIds(assetPair.base, assetPair.quote);
      if (!pairs.some((p) => p.key === key)) return;
      setBooks((prev) => ({ ...prev, [key]: applySideswapMessage(prev[key] || [], msg) }));
      setLastUpdate(new Date());
      hadDataRef.current = true;
    };

    ws.onerror = () => {
      if (wsRef.current !== ws || intentionalCloseRef.current) return;
      if (!hadDataRef.current) setError('Falha ao conectar na SideSwap');
    };

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
      if (intentionalCloseRef.current) { intentionalCloseRef.current = false; return; }
      if (!enabledRef.current) return;
      setStatus(hadDataRef.current ? 'reconnecting' : 'error');
      if (!hadDataRef.current) setError('Falha ao conectar na SideSwap');
      scheduleReconnect(pairs);
    };
  }, [closeSocket, scheduleReconnect]);

  const manualReconnect = useCallback(() => {
    reconnectDelayRef.current = RECONNECT_BASE_MS;
    hadDataRef.current = false;
    setBooks({});
    setIndPrices({});
    const pairs = buildPairs();
    closeSocket(true);
    openSocket(pairs);
  }, [buildPairs, closeSocket, openSocket]);

  useEffect(() => {
    if (!enabled || !assetsKey) {
      closeSocket(true);
      setBooks({});
      setIndPrices({});
      setStatus('idle');
      setError(null);
      hadDataRef.current = false;
      return undefined;
    }
    const pairs = buildPairs();
    openSocket(pairs);
    return () => closeSocket(true);
  }, [enabled, assetsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    error,
    lastUpdate,
    pairs: buildPairs(),
    books,
    indPrices,
    reconnect: manualReconnect,
  };
}
