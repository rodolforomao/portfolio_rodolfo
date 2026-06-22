import { useCallback, useEffect, useRef, useState } from 'react';
import { log } from './utils/logger';

const STATUS = {
  idle: 'idle',
  connecting: 'connecting',
  connected: 'connected',
  error: 'error',
};

/** Estado vazio após reset de sessão (troca local → produção). */
export const EMPTY_DEALER_STATE = {
  dealers: [],
  messages: [],
  ts: null,
  services: null,
};

export default function useDealerWs(wsUrl, token, enabled) {
  const wsRef = useRef(null);
  const reqIdRef = useRef(1);
  const pendingRef = useRef(new Map());
  const reconnectRef = useRef(null);
  const agentSessionRef = useRef(null);

  // Diagnóstico: quando chegou o último state_update e quais dealers estavam vivos
  const lastStateUpdateRef = useRef(null);
  const lastDealerSnapshotRef = useRef(null);
  const heartbeatRef = useRef(null);

  const [status, setStatus] = useState(STATUS.idle);
  const [agentConnected, setAgentConnected] = useState(false);
  const [agentMeta, setAgentMeta] = useState(null);
  const [state, setState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [events, setEvents] = useState([]);
  const [lastError, setLastError] = useState(null);

  const clearAgentState = useCallback((reason) => {
    agentSessionRef.current = null;
    setAgentConnected(false);
    setAgentMeta(null);
    setState({ ...EMPTY_DEALER_STATE, resetReason: reason, ts: new Date().toISOString() });
  }, []);

  const addLog = useCallback((text) => {
    setMessages((prev) => [...prev.slice(-199), { text, ts: Date.now() }]);
  }, []);

  const applyAgentMeta = useCallback((msg) => {
    const sid = msg.session_id ?? msg.agent_session_id ?? null;
    if (sid != null && sid !== agentSessionRef.current) {
      agentSessionRef.current = sid;
      setState({ ...EMPTY_DEALER_STATE, ts: msg.ts || new Date().toISOString() });
      addLog(`[system] Nova sessão do manager (#${sid}${msg.hostname ? ` · ${msg.hostname}` : ''})`);
    }
    if (msg.hostname || sid != null) {
      setAgentMeta({
        sessionId: sid,
        hostname: msg.hostname || null,
        connectedAt: msg.ts || null,
      });
    }
  }, [addLog]);

  const handleMessage = useCallback((raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const { type } = msg;

    if (type === 'state_reset') {
      clearAgentState(msg.reason || 'state_reset');
      addLog(`[system] Cache limpo (${msg.reason || 'reset'})`);
      return;
    }

    if (type === 'state_update') {
      const data = msg.data || msg;
      const sid = data.agent_session_id ?? data.session_id;
      if (sid != null && sid !== agentSessionRef.current) {
        agentSessionRef.current = sid;
        addLog(`[system] state_update de nova sessão (${data.agent_hostname || sid})`);
      }

      // ── Diagnóstico: dealer snapshot ──────────────────────────────────────
      const now = Date.now();
      const dealers = data.dealers || [];
      const dealerSummary = dealers.map((d) => ({
        pid: d.pid,
        wallet: d.wallet_name,
        orders: (d.orders || []).length,
        hasBalances: d.balances && Object.keys(d.balances).length > 0,
      }));
      const dealerPids = dealers.map((d) => d.pid).sort().join(',');

      // Detecta mudança na lista de dealers (dealer sumiu ou apareceu)
      const prevSnapshot = lastDealerSnapshotRef.current;
      if (prevSnapshot != null && prevSnapshot !== dealerPids) {
        log.warn(
          'DIAGNÓSTICO: dealers mudaram no state_update',
          'antes:', prevSnapshot || '(vazio)',
          '→ agora:', dealerPids || '(vazio)',
          'dealers:', dealerSummary,
        );
      }
      lastDealerSnapshotRef.current = dealerPids;
      lastStateUpdateRef.current = now;

      // Log diagnóstico a cada state_update com resumo dos dealers
      log.debug(
        'state_update recebido',
        'dealers:', dealerSummary,
        'log_summary:', data.log_summary || null,
        'ts:', data.ts,
      );
      // ─────────────────────────────────────────────────────────────────────

      setState(data);
      setAgentConnected(true);
      if (data.agent_hostname || sid != null) {
        setAgentMeta({
          sessionId: sid ?? agentSessionRef.current,
          hostname: data.agent_hostname || null,
          connectedAt: data.ts || null,
        });
      }
      return;
    }

    if (type === 'agent_status') {
      if (msg.connected) {
        applyAgentMeta(msg);
        setAgentConnected(true);
        addLog(
          `[${msg.ts || ''}] Agente conectado`
          + (msg.hostname ? ` (${msg.hostname})` : '')
          + (msg.session_id != null ? ` #${msg.session_id}` : ''),
        );
      } else {
        clearAgentState('agent_disconnected');
        addLog(`[${msg.ts || ''}] Agente desconectado`);
      }
      return;
    }

    if (type === 'command_result') {
      const reqKey = String(msg.req_id);
      const resolver = pendingRef.current.get(reqKey);
      if (resolver) {
        pendingRef.current.delete(reqKey);
        resolver(msg);
      }
      if (msg.ok) {
        setAgentConnected(true);
      } else {
        log.warn('Comando falhou', msg.action, msg.data);
      }
      addLog(`[result] ${msg.action} → ${msg.ok ? 'OK' : 'ERRO'}: ${JSON.stringify(msg.data)}`);
      return;
    }

    if (type === 'event') {
      setEvents((prev) => [...prev.slice(-49), msg]);
      addLog(`[event] ${msg.event}: ${JSON.stringify(msg.data)}`);
      return;
    }

    if (type === 'error') {
      const errMsg = msg.message || 'Erro desconhecido';
      log.error('Erro do relay', errMsg, 'ação:', msg.action, 'req_id:', msg.req_id);
      setLastError(errMsg);
      if (/agent/i.test(errMsg)) {
        setAgentConnected(false);
      }
      addLog(`[error] ${errMsg}`);
      const reqKey = String(msg.req_id);
      const resolver = pendingRef.current.get(reqKey);
      if (resolver) {
        pendingRef.current.delete(reqKey);
        resolver({ ok: false, data: { error: errMsg }, action: msg.action });
      }
    }
  }, [addLog, applyAgentMeta, clearAgentState]);

  const connect = useCallback(() => {
    if (!enabled || !wsUrl || !token) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus(STATUS.connecting);
    setLastError(null);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      log.info('WS aberto', wsUrl);
      ws.send(JSON.stringify({ type: 'auth', role: 'browser', token }));
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (msg.type === 'auth_ok') {
        setStatus(STATUS.connected);
        log.info('Auth OK', wsUrl);
        addLog('[system] Autenticado com sucesso');
        return;
      }

      if (msg.type === 'auth_fail') {
        setStatus(STATUS.error);
        setLastError(msg.message || 'Token inválido');
        log.error('Auth FALHOU', msg.message, 'url:', wsUrl);
        ws.close();
        return;
      }

      handleMessage(ev.data);
    };

    ws.onerror = (ev) => {
      log.error('WS erro de conexão', 'url:', wsUrl, ev);
      setStatus(STATUS.error);
      setLastError('Falha na conexão WebSocket');
    };

    ws.onclose = (ev) => {
      log.warn('WS fechado', 'code:', ev.code, 'reason:', ev.reason || '(sem motivo)', 'url:', wsUrl);
      wsRef.current = null;
      setStatus((prev) => (prev === STATUS.error ? prev : STATUS.idle));
      clearAgentState('browser_disconnected');
      const pending = pendingRef.current.size;
      if (pending > 0) {
        log.warn('WS fechado com', pending, 'comando(s) pendente(s) — cancelando');
      }
      pendingRef.current.forEach((resolve) => {
        resolve({ ok: false, data: { error: 'Conexão encerrada' } });
      });
      pendingRef.current.clear();

      if (enabled) {
        log.info('Reconectando em 5s…');
        reconnectRef.current = setTimeout(connect, 5000);
      }
    };
  }, [enabled, wsUrl, token, addLog, handleMessage, clearAgentState]);

  const disconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus(STATUS.idle);
    clearAgentState('manual_disconnect');
  }, [clearAgentState]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, wsUrl, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Watchdog: alerta se state_update parar de chegar (bridge/manager caiu) ──
  useEffect(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (!enabled) return undefined;

    heartbeatRef.current = setInterval(() => {
      const last = lastStateUpdateRef.current;
      if (!last) return; // ainda não conectou, ignora
      const staleSec = Math.round((Date.now() - last) / 1000);
      if (staleSec >= 15) {
        log.warn(
          `DIAGNÓSTICO: sem state_update há ${staleSec}s`,
          '— bridge ou manager pode estar caído.',
          'WS readyState:', wsRef.current?.readyState,
          'URL:', wsUrl,
        );
      }
    }, 10000); // checa a cada 10s

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [enabled, wsUrl]);

  const sendCommand = useCallback((action, params = {}, timeoutMs = 30000) => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        log.warn('sendCommand bloqueado — WS não aberto', 'action:', action, 'readyState:', wsRef.current?.readyState);
        reject(new Error('WebSocket não conectado'));
        return;
      }

      const req_id = reqIdRef.current++;
      const reqKey = String(req_id);
      const payload = { type: 'command', action, params, req_id };
      const sentAt = Date.now();

      const timer = setTimeout(() => {
        if (pendingRef.current.has(reqKey)) {
          pendingRef.current.delete(reqKey);
          const staleSec = lastStateUpdateRef.current
            ? Math.round((Date.now() - lastStateUpdateRef.current) / 1000)
            : null;
          log.error(
            'DIAGNÓSTICO: Timeout de comando',
            action,
            `pid: ${params?.pid ?? 'n/a'}`,
            `(${timeoutMs}ms) req_id: ${reqKey}`,
            `último state_update: ${staleSec != null ? staleSec + 's atrás' : 'desconhecido'}`,
            `dealers no último snapshot: ${lastDealerSnapshotRef.current || '(nenhum)'}`,
            `WS readyState: ${wsRef.current?.readyState}`,
          );
          reject(new Error(`Timeout aguardando resposta de ${action}`));
        }
      }, timeoutMs);

      pendingRef.current.set(reqKey, (result) => {
        clearTimeout(timer);
        const ms = Date.now() - sentAt;
        if (ms > 5000) {
          log.warn('Comando lento', action, `${ms}ms`, 'pid:', params?.pid ?? 'n/a');
        }
        resolve(result);
      });

      wsRef.current.send(JSON.stringify(payload));
      addLog(`[cmd] ${action} ${JSON.stringify(params)}`);
    });
  }, [addLog]);

  return {
    status,
    agentConnected,
    agentMeta,
    state,
    messages,
    events,
    lastError,
    sendCommand,
    disconnect,
    reconnect: connect,
    lastStateUpdateRef, // expõe para diagnóstico externo (ex.: SystemStatusBar)
  };
}
