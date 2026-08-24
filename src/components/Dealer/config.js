const isBrowser = typeof window !== 'undefined';

function isLocalDevHost() {
  if (!isBrowser) return process.env.NODE_ENV !== 'production';
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/** Escolhe a URL do relay conforme ambiente (hostname do browser, não só .env). */
export function resolveWsUrl() {
  // Dev local — .env pode forçar ws://127.0.0.1:8765
  if (isLocalDevHost()) {
    return (
      process.env.REACT_APP_DEALER_WS_URL
      || process.env.REACT_APP_DEALER_WS_URL_LOCAL
      || 'ws://127.0.0.1:8765'
    );
  }
  // Produção HTTPS — WSS no mesmo domínio (nginx → relay)
  if (isBrowser && window.location.protocol === 'https:') {
    return (
      process.env.REACT_APP_DEALER_WS_URL_PROD
      || `wss://${window.location.host}/dealer-ws`
    );
  }
  return (
    process.env.REACT_APP_DEALER_WS_URL_PROD
    || 'wss://rodolforomao.com.br/dealer-ws'
  );
}

export const DEFAULT_WS_URL = resolveWsUrl();

export const DEALER_USER = process.env.REACT_APP_DEALER_USER || '';
export const DEALER_PASSWORD = process.env.REACT_APP_DEALER_PASSWORD || '';
export const DEALER_WS_TOKEN = process.env.REACT_APP_DEALER_WS_TOKEN || '';

/** IP da VPS (opcional) — exibido na aba Arquitetura; não expõe credenciais SSH. */
export const INFRA_VPS_IP = process.env.REACT_APP_VPS_IP || '';

export const SESSION_KEY = 'dealer_ws_session';

/** Embeds publicados em public/tools/* (npm run sync:tools). */
export const ANALYSES_EMBED_URL =
  process.env.REACT_APP_ANALYSES_URL || '/tools/analyses/';
export const LIQUID_TX_EMBED_URL =
  process.env.REACT_APP_LIQUID_TX_URL || '/tools/liquid-tx/';

export function validateCredentials(username, password) {
  if (!DEALER_USER || !DEALER_PASSWORD) {
    return { ok: false, error: 'Credenciais não configuradas no servidor (REACT_APP_DEALER_USER / REACT_APP_DEALER_PASSWORD).' };
  }
  if (!DEALER_WS_TOKEN) {
    return { ok: false, error: 'Token WebSocket não configurado (REACT_APP_DEALER_WS_TOKEN).' };
  }
  if (username !== DEALER_USER || password !== DEALER_PASSWORD) {
    return { ok: false, error: 'Usuário ou senha inválidos.' };
  }
  return { ok: true };
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const session = raw ? JSON.parse(raw) : null;
    if (session?.authenticated) {
      return { ...session, wsUrl: resolveWsUrl(), token: DEALER_WS_TOKEN || session.token };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSession() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    authenticated: true,
    token: DEALER_WS_TOKEN,
    wsUrl: resolveWsUrl(),
  }));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
