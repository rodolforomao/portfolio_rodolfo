import { useCallback, useEffect, useRef, useState } from 'react';

const STATUS = {
  idle: 'idle',
  connecting: 'connecting',
  connected: 'connected',
  error: 'error',
};

export default function useDealerWs(wsUrl, token, enabled) {
  const wsRef = useRef(null);
  const reqIdRef = useRef(1);
  const pendingRef = useRef(new Map());
  const reconnectRef = useRef(null);

  const [status, setStatus] = useState(STATUS.idle);
  const [agentConnected, setAgentConnected] = useState(false);
  const [state, setState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [events, setEvents] = useState([]);
  const [lastError, setLastError] = useState(null);

  const addLog = useCallback((text) => {
    setMessages((prev) => [...prev.slice(-199), { text, ts: Date.now() }]);
  }, []);

  const handleMessage = useCallback((raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const { type } = msg;

    if (type === 'state_update') {
      const data = msg.data || msg;
      setState(data);
      return;
    }

    if (type === 'agent_status') {
      setAgentConnected(!!msg.connected);
      addLog(`[${msg.ts || ''}] Agente ${msg.connected ? 'conectado' : 'desconectado'}`);
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
      if (errMsg.includes('agent') || errMsg.includes('Agent')) {
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
  }, [addLog]);

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
      setAgentConnected(false);
      pendingRef.current.forEach((resolve) => {
        resolve({ ok: false, data: { error: 'Conexão encerrada' } });
      });
      pendingRef.current.clear();

      if (enabled) {
        reconnectRef.current = setTimeout(connect, 5000);
      }
    };
  }, [enabled, wsUrl, token, addLog, handleMessage]);

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
    setAgentConnected(false);
  }, []);

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
    state,
    messages,
    events,
    lastError,
    sendCommand,
    disconnect,
    reconnect: connect,
  };
}
