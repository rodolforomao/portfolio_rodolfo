// Usa proxy PHP para evitar CORS — o browser chama /proxy.php no mesmo domínio
const PROXY_BASE = '/proxy.php';
const API_KEY = process.env.REACT_APP_FRED_API_KEY || '';

const CACHE_PREFIX = 'fred_cache_';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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

export async function fetchFredSeries(seriesId, startDate = '2015-01-01') {
  if (!API_KEY || API_KEY === 'your_fred_api_key_here') {
    throw new Error('FRED API key not configured. Get a free key at fred.stlouisfed.org, set REACT_APP_FRED_API_KEY in .env and rebuild.');
  }
  const cacheKey = `${seriesId}_${startDate}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = `${PROXY_BASE}?source=fred&series_id=${encodeURIComponent(seriesId)}&api_key=${encodeURIComponent(API_KEY)}&observation_start=${encodeURIComponent(startDate)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Proxy HTTP ${res.status} para ${seriesId}. Verifique se proxy.php está acessível.`);
  const json = await res.json();
  if (json.error_code) {
    throw new Error(`FRED rejected request for ${seriesId}: "${json.error_message}". Verify your API key is correct.`);
  }
  if (!json.observations) throw new Error(`No observations returned for series ${seriesId}.`);
  const data = json.observations
    .filter(o => o.value !== '.' && o.value !== '')
    .map(o => ({ date: o.date, value: parseFloat(o.value) }));
  setCache(cacheKey, data);
  return data;
}

export async function fetchMultipleFredSeries(seriesIds, startDate = '2015-01-01') {
  const results = await Promise.allSettled(seriesIds.map(id => fetchFredSeries(id, startDate)));
  const out = {};
  let firstError = null;
  let successCount = 0;

  seriesIds.forEach((id, i) => {
    if (results[i].status === 'fulfilled' && results[i].value.length > 0) {
      out[id] = results[i].value;
      successCount++;
    } else {
      out[id] = [];
      if (!firstError) {
        firstError = results[i].status === 'rejected'
          ? results[i].reason
          : new Error(`Series ${id} returned empty data.`);
      }
    }
  });

  // If every single fetch failed, surface the error instead of returning silent empty arrays
  if (successCount === 0 && firstError) throw firstError;
  return out;
}
