// Usa proxy PHP para evitar CORS
const PROXY_BASE = '/proxy.php';
const CACHE_PREFIX = 'cg_cache_';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getCached(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) { localStorage.removeItem(CACHE_PREFIX + key); return null; }
    return data;
  } catch { return null; }
}
function setCache(key, data) {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

function parseCgError(data, status) {
  if (data?.status?.error_message) return `CoinGecko: ${data.status.error_message} (code ${data.status.error_code})`;
  if (data?.error) return `CoinGecko: ${typeof data.error === 'object' ? JSON.stringify(data.error) : data.error}`;
  if (status === 429) return 'CoinGecko: rate limit reached — wait a moment and retry';
  if (status === 401 || status === 403) return 'CoinGecko: acesso negado (API key necessária?)';
  return `CoinGecko: HTTP ${status}`;
}

async function cgFetch(path) {
  const cacheKey = path.replace(/[/?=&]/g, '_');
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const proxyUrl = `${PROXY_BASE}?source=coingecko&path=${encodeURIComponent(path)}`;
  const res = await fetch(proxyUrl);
  let data;
  try { data = await res.json(); } catch { throw new Error(`CoinGecko: resposta inválida (HTTP ${res.status})`); }
  if (!res.ok || data?.status?.error_code || data?.error) {
    throw new Error(parseCgError(data, res.status));
  }
  setCache(cacheKey, data);
  return data;
}

export async function fetchBitcoinPrice(days = 365) {
  const data = await cgFetch(`/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`);
  return data.prices.map((p, i) => ({
    date: new Date(p[0]).toISOString().slice(0, 10),
    price: p[1],
    volume: data.total_volumes[i]?.[1] || 0,
    marketCap: data.market_caps[i]?.[1] || 0,
  }));
}

export async function fetchBitcoinInfo() {
  const data = await cgFetch('/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false');
  return {
    price: data.market_data.current_price.usd,
    marketCap: data.market_data.market_cap.usd,
    volume: data.market_data.total_volume.usd,
    change24h: data.market_data.price_change_percentage_24h,
    change7d: data.market_data.price_change_percentage_7d,
    change30d: data.market_data.price_change_percentage_30d,
    dominance: null,
    ath: data.market_data.ath.usd,
    athDate: data.market_data.ath_date.usd,
  };
}

export async function fetchGlobalData() {
  const data = await cgFetch('/global');
  return {
    totalMarketCap: data.data.total_market_cap.usd,
    totalVolume: data.data.total_volume.usd,
    btcDominance: data.data.market_cap_percentage.btc,
    ethDominance: data.data.market_cap_percentage.eth,
    activeCurrencies: data.data.active_cryptocurrencies,
  };
}

export async function fetchCoinPrice(coinId, days = 365) {
  const data = await cgFetch(`/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`);
  return data.prices.map(p => ({
    date: new Date(p[0]).toISOString().slice(0, 10),
    price: p[1],
  }));
}
