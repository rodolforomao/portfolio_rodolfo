import { SIDESWAP_WS_URL } from './sideswapBook';

/** Converte ws:// ou wss:// em host, porta e label legível. */
export function parseWsEndpoint(wsUrl) {
  if (!wsUrl) return null;
  try {
    const normalized = wsUrl.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
    const u = new URL(normalized);
    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
    const path = u.pathname && u.pathname !== '/' ? u.pathname : '';
    return {
      host: u.hostname,
      port,
      path,
      display: `${u.hostname}:${port}${path}`,
      secure: /^wss:/i.test(wsUrl),
    };
  } catch {
    return { host: wsUrl, port: '', path: '', display: wsUrl, secure: false };
  }
}

export function productionSiteHost() {
  const prod = process.env.REACT_APP_DEALER_WS_URL_PROD;
  if (prod) {
    const parsed = parseWsEndpoint(prod);
    if (parsed?.host) return parsed.host;
  }
  return 'rodolforomao.com.br';
}

export function isLocalDevHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

export function browserEndpoint() {
  if (typeof window === 'undefined') return { host: '—', display: '—' };
  return {
    host: window.location.hostname,
    display: window.location.host,
    protocol: window.location.protocol,
  };
}

export function sideswapEndpoint() {
  return parseWsEndpoint(SIDESWAP_WS_URL) || {
    host: 'api.sideswap.io',
    port: '443',
    display: 'api.sideswap.io:443',
    secure: true,
  };
}

export function statusKind(status, { okValues = ['connected'], warnValues = ['connecting', 'reconnecting'] } = {}) {
  if (okValues.includes(status)) return 'ok';
  if (warnValues.includes(status)) return 'warn';
  if (status === 'idle') return 'idle';
  return 'off';
}

export function formatTs(ts) {
  if (!ts) return null;
  try {
    const d = ts instanceof Date ? ts : new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return String(ts);
  }
}

/** IP legível para um host (localhost, IPv4 literal ou IP conhecido da VPS). */
export function resolveDisplayIp(host, vpsIp = '') {
  if (!host) return vpsIp || '—';
  if (host === 'localhost' || host === '127.0.0.1') return '127.0.0.1';
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
  const prodHost = productionSiteHost();
  if (vpsIp && (host === prodHost || host.endsWith(`.${prodHost}`))) return vpsIp;
  return '—';
}
