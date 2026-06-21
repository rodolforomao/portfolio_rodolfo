import { useCallback, useEffect, useRef, useState } from 'react';

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
      if (msg.ok) setAgentConnected(true);
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
        addLog('[system] Autenticado com sucesso');
        return;
      }

      if (msg.type === 'auth_fail') {
        setStatus(STATUS.error);
        setLastError(msg.message || 'Token inválido');
        ws.close();
        return;
      }

      handleMessage(ev.data);
    };

    ws.onerror = () => {
      setStatus(STATUS.error);
      setLastError('Falha na conexão WebSocket');
    };

    ws.onclose = () => {
      wsRef.current = null;
      setStatus((prev) => (prev === STATUS.error ? prev : STATUS.idle));
      clearAgentState('browser_disconnected');
      pendingRef.current.forEach((resolve) => {
        resolve({ ok: false, data: { error: 'Conexão encerrada' } });
      });
      pendingRef.current.clear();

      if (enabled) {
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

  const sendCommand = useCallback((action, params = {}, timeoutMs = 30000) => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket não conectado'));
        return;
      }

      const req_id = reqIdRef.current++;
      const reqKey = String(req_id);
      const payload = { type: 'command', action, params, req_id };

      const timer = setTimeout(() => {
        if (pendingRef.current.has(reqKey)) {
          pendingRef.current.delete(reqKey);
          reject(new Error(`Timeout aguardando resposta de ${action}`));
        }
      }, timeoutMs);

      pendingRef.current.set(reqKey, (result) => {
        clearTimeout(timer);
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
  };
}
