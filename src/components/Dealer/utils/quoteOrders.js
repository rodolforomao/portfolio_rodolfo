/** Cotações BRL → cripto. O preço trava na hora da ordem e vale 1 hora. */

export const QUOTE_TTL_MS = 60 * 60 * 1000;
const STORAGE_KEY = 'dealer_quote_orders_v1';

export const DELIVERY_ASSETS = [
  {
    asset: 'USDT',
    symbol: 'USDTBRL',
    networks: ['Polygon', 'TRC20', 'ERC20', 'BEP20', 'Liquid', 'Solana'],
  },
  {
    asset: 'BTC',
    symbol: 'BTCBRL',
    networks: ['Liquid', 'Bitcoin', 'Lightning'],
  },
  {
    asset: 'ETH',
    symbol: 'ETHBRL',
    networks: ['ERC20', 'Arbitrum', 'Base'],
  },
];

export const MONEY = {
  BRL: { code: 'BRL', symbol: 'R$' },
  USDT: { code: 'USDT', symbol: '₮' },
  BTC: { code: 'BTC', symbol: '₿' },
  ETH: { code: 'ETH', symbol: 'Ξ' },
};

export function moneyMeta(code) {
  return MONEY[code] || { code: code || '', symbol: code || '' };
}

export function formatMoney(amount, code) {
  if (!Number.isFinite(Number(amount))) return '—';
  const meta = moneyMeta(code);
  const digits = code === 'BTC' || code === 'ETH' ? 6 : 2;
  const num = Number(amount).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
  return `${meta.symbol} ${num}`;
}

/** Símbolo e código, para a cripto não ficar ambígua. O real já é R$. */
export function formatMoneyLabeled(amount, code) {
  const base = formatMoney(amount, code);
  if (base === '—' || code === 'BRL') return base;
  return `${base} ${code}`;
}

export function assetMeta(asset) {
  return DELIVERY_ASSETS.find((a) => a.asset === asset) || DELIVERY_ASSETS[0];
}

export function fetchBinancePrice(symbol) {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`;
  return fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Binance ${res.status}`);
      return res.json();
    })
    .then((data) => {
      const price = Number(data?.price);
      if (!Number.isFinite(price) || price <= 0) throw new Error('Preço Binance inválido');
      return { symbol, price, fetchedAt: Date.now() };
    });
}

/** Aceita 100000, 100.000 e 100.000,50. */
export function parseBrlInput(input) {
  const s = String(input || '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s);
}

export function partyPct(party) {
  const n = typeof party?.pct === 'number'
    ? party.pct
    : Number(String(party?.pct ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function roundPct(n) {
  return Math.round(n * 10000) / 10000;
}

export function pctToField(n) {
  if (!Number.isFinite(n)) return '';
  return String(roundPct(n)).replace('.', ',');
}

/**
 * Reparte a porcentagem da mesa. Quem está travado (locked) fica com o
 * percentual digitado; o restante se divide entre os outros.
 */
export function splitMesa(parties, mesaPct) {
  const mesa = Number(mesaPct);
  const list = parties || [];
  if (!Number.isFinite(mesa) || !list.length) return list;

  const openIdx = [];
  let lockedSum = 0;
  list.forEach((p, i) => {
    if (p.locked) lockedSum += partyPct(p);
    else openIdx.push(i);
  });
  if (!openIdx.length) return list;

  const rest = Math.max(0, mesa - lockedSum);
  const next = list.map((p) => ({ ...p }));
  let assigned = 0;
  openIdx.forEach((idx, n) => {
    const isLast = n === openIdx.length - 1;
    const slice = isLast ? roundPct(rest - assigned) : roundPct(rest / openIdx.length);
    if (!isLast) assigned = roundPct(assigned + slice);
    next[idx] = { ...next[idx], pct: pctToField(slice) };
  });
  return next;
}

/**
 * Converte o BRL no preço travado.
 * A porcentagem da mesa é o que sai do bruto; cada participante leva o seu percentual.
 */
export function computeQuote({ brlAmount, rate, parties, mesaPct }) {
  const brl = Number(brlAmount);
  const px = Number(rate);
  if (!Number.isFinite(brl) || brl <= 0 || !Number.isFinite(px) || px <= 0) return null;

  const gross = brl / px;
  const rows = (parties || []).map((p) => {
    const pct = partyPct(p);
    return {
      name: String(p?.name || '').trim() || 'Sem nome',
      pct,
      mine: !!p?.mine,
      asset: gross * pct / 100,
      brl: brl * pct / 100,
    };
  });
  const fromParts = rows.reduce((sum, row) => sum + row.pct, 0);
  const explicit = Number(mesaPct);
  const feePct = Number.isFinite(explicit) ? explicit : fromParts;
  const fee = gross * feePct / 100;
  return {
    brl,
    rate: px,
    gross,
    feePct,
    fee,
    client: gross - fee,
    splits: rows,
    partsPct: fromParts,
  };
}

const API_URL = '/api/quote-orders';

export function loadLocalQuotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function fetchQuotes() {
  const res = await fetch(API_URL);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Base de cotações indisponível');
  }
  const data = await res.json();
  return Array.isArray(data.quotes) ? data.quotes : [];
}

export async function saveQuotes(quotes) {
  const res = await fetch(API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quotes }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Não foi possível gravar as cotações');
  }
  const data = await res.json();
  return Array.isArray(data.quotes) ? data.quotes : quotes;
}

export function effectiveStatus(quote, now = Date.now()) {
  if (!quote) return 'aberta';
  if (quote.status === 'aberta' && now >= Number(quote.expiresAt)) return 'expirada';
  return quote.status || 'aberta';
}

/** Lucro das cotações marcadas como realizadas, só nas linhas "meu". */
export function accumulatedProfit(quotes) {
  const byAsset = {};
  let brl = 0;
  for (const quote of quotes || []) {
    if (quote.status !== 'realizada') continue;
    const calc = computeQuote(quote);
    if (!calc) continue;
    for (const split of calc.splits) {
      if (!split.mine) continue;
      const asset = quote.asset || 'USDT';
      byAsset[asset] = (byAsset[asset] || 0) + split.asset;
      brl += split.brl;
    }
  }
  return { brl, byAsset };
}
