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

export const NETWORKS = [...new Set(DELIVERY_ASSETS.flatMap((item) => item.networks))];

export function normalizeHops(hops) {
  if (!Array.isArray(hops)) return [];
  return hops
    .map((hop) => ({
      network: String(hop?.network || '').trim(),
      address: String(hop?.address || '').trim(),
    }))
    .filter((hop) => hop.network || hop.address);
}

export const MONEY = {
  BRL: { code: 'BRL', symbol: 'R$' },
  DEPIX: { code: 'DEPIX', symbol: 'Depix' },
  USDT: { code: 'USDT', symbol: '₮' },
  USD: { code: 'USD', symbol: 'US$' },
  BTC: { code: 'BTC', symbol: '₿' },
  ETH: { code: 'ETH', symbol: 'Ξ' },
};

/** O que pode entrar na conta. Depix vale 1 real. Outra usa o par da Binance em BRL. */
export const RECEIVE_PRESETS = [
  { id: 'BRL', label: 'Reais' },
  { id: 'USD', label: 'Dólar' },
  { id: 'DEPIX', label: 'Depix' },
  { id: 'USDT', label: 'USDT' },
  { id: 'BTC', label: 'BTC' },
  { id: 'ETH', label: 'ETH' },
  { id: 'OUTRA', label: 'Outra' },
];

export function isBrlPeg(code) {
  const name = String(code || '').trim().toUpperCase();
  return name === 'BRL' || name === 'DEPIX';
}

/** Dólar entra pelo par USDT/BRL. As outras moedas usam o próprio par em reais. */
export function receiveBinanceSymbol(code) {
  const name = String(code || '').trim().toUpperCase();
  if (name === 'USD' || name === 'USDT') return 'USDTBRL';
  return `${name}BRL`;
}

export function receiveCode(choice, custom) {
  if (choice === 'OUTRA') return String(custom || '').trim().toUpperCase();
  return String(choice || 'BRL').trim().toUpperCase() || 'BRL';
}

export function receiveCurrencyOf(quote) {
  return String(quote?.receiveCurrency || 'BRL').trim().toUpperCase() || 'BRL';
}

/** Valor que entrou, na moeda em que foi recebido. Ordens antigas são reais. */
export function receivedOf(quote) {
  const code = receiveCurrencyOf(quote);
  const raw = quote?.receiveAmount != null && quote.receiveAmount !== ''
    ? quote.receiveAmount
    : quote?.brlAmount;
  const amount = Number(raw);
  return { code, amount: Number.isFinite(amount) ? amount : null };
}

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
  if (!s || s === ',') return NaN;
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s);
}

/** Casas da máscara. Real, DePix e stablecoins ficam em centavos. */
export function decimalPlaces(code) {
  const name = String(code || '').trim().toUpperCase();
  if (name === 'BTC' || name === 'ETH' || name === 'LBTC') return 8;
  return 2;
}

/**
 * Pontuação brasileira enquanto digita: 50002,35 vira 50.002,35.
 * O ponto é milhar; a vírgula abre os centavos.
 */
export function maskDecimalInput(raw, maxDecimals = 2) {
  let s = String(raw ?? '').replace(/\s/g, '');
  if (!s) return '';
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '');
    else s = s.replace(/,/g, '').replace(/\./g, ',');
  } else if (hasDot) {
    const parts = s.split('.');
    const last = parts[parts.length - 1];
    const head = parts.slice(0, -1);
    const headIsThousands = head.length >= 1
      && head[0].length >= 1
      && head[0].length <= 3
      && head.slice(1).every((part) => /^\d{3}$/.test(part));
    const completeThousands = headIsThousands && /^\d{3}$/.test(last);
    // "5.000" + mais um dígito vira "5.0000". O ponto ainda é milhar, não centavos.
    const extendedThousands = headIsThousands && last.length > 3;
    if (!completeThousands && !extendedThousands) {
      const dec = parts.pop();
      s = `${parts.join('')},${dec}`;
    }
  }
  s = s.replace(/[^\d,]/g, '');
  const endsComma = maxDecimals > 0 && s.endsWith(',');
  const [intRaw, ...rest] = s.split(',');
  let intPart = (intRaw || '').replace(/^0+(?=\d)/, '');
  if (!intPart && (rest.length || endsComma)) intPart = '0';
  if (!intPart) return '';
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (!rest.length && !endsComma) return grouped;
  const dec = rest.join('').replace(/\D/g, '').slice(0, maxDecimals);
  if (!dec) return endsComma ? `${grouped},` : grouped;
  return `${grouped},${dec}`;
}

export function formatDecimalInput(n, maxDecimals = 2) {
  if (!Number.isFinite(n)) return '';
  const places = Math.max(0, maxDecimals);
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: Math.min(2, places),
    maximumFractionDigits: places,
  });
}

export function isTerceiroParty(party) {
  if (party?.terceiro === true) return true;
  if (party?.terceiro === false) return false;
  return /^terceiro$/i.test(String(party?.name || '').trim());
}

/** Cotação John (cliente) <> Luiz + terceiro + Rodolfo. O nome Dealer fica de fora. Sem nome, some da linha. */
export function quoteRelation(quote) {
  const client = String(quote?.clientName || '').trim() || 'Cliente';
  const side = (quote?.parties || [])
    .map((party) => {
      const name = String(party?.name || '').trim();
      if (!name || name.toLowerCase() === 'dealer') return '';
      return isTerceiroParty(party) ? 'terceiro' : name;
    })
    .filter(Boolean);
  return `Cotação ${client} (cliente) <> ${side.join(' + ') || 'mesa'}`;
}

/** Reais por USDT travados na hora da ordem. Na entrega em USDT, é o próprio preço. */
export function dollarRateOf(quote) {
  const asset = quote?.asset || 'USDT';
  const px = asset === 'USDT' ? Number(quote?.rate) : Number(quote?.usdtRate);
  return Number.isFinite(px) && px > 0 ? px : null;
}

function roundPartyPct(n) {
  return Math.round(n * 10000) / 10000;
}

function withMine(parties) {
  if (!parties.length || parties.some((party) => party.mine)) return parties;
  return parties.map((party, index) => ({ ...party, mine: index === 0 }));
}

/** As partes marcadas viram uma só: a porcentagem soma e o nome junta quem tinha nome. */
export function mergePartyRows(parties, indexes) {
  const pick = new Set(indexes);
  const list = parties || [];
  const chosen = list.filter((_, index) => pick.has(index));
  if (chosen.length < 2) return null;
  const names = [];
  chosen.forEach((party) => {
    const name = String(party?.name || '').trim();
    if (name && !names.some((item) => item.toLowerCase() === name.toLowerCase())) names.push(name);
  });
  const merged = {
    name: names.join(' + '),
    pct: roundPartyPct(chosen.reduce((sum, party) => sum + partyPct(party), 0)),
    mine: chosen.some((party) => party.mine),
    terceiro: chosen.every((party) => isTerceiroParty(party)),
    paid: chosen.every((party) => party.paid === true),
  };
  const next = [];
  let placed = false;
  list.forEach((party, index) => {
    if (!pick.has(index)) next.push(party);
    else if (!placed) {
      next.push(merged);
      placed = true;
    }
  });
  return withMine(next);
}

/** Quem não foi marcado perde o nome e continua na ordem. */
export function blankOtherPartyNames(parties, indexes) {
  const keep = new Set(indexes);
  const list = parties || [];
  if (!keep.size || keep.size >= list.length) return null;
  return list.map((party, index) => (keep.has(index) ? party : { ...party, name: '' }));
}

/** Tira as partes marcadas da mesa. A porcentagem da mesa cai o que era delas. */
export function partiesWithoutTotal(parties, mesaPct, indexes) {
  const drop = new Set(indexes);
  const list = parties || [];
  const next = list.filter((_, index) => !drop.has(index));
  if (!next.length || next.length === list.length) return null;
  const removed = list
    .filter((_, index) => drop.has(index))
    .reduce((sum, party) => sum + partyPct(party), 0);
  return {
    parties: withMine(next),
    mesaPct: roundPartyPct(Math.max(0, partyPct({ pct: mesaPct }) - removed)),
  };
}

/** Mesa sem o terceiro: a porcentagem cai o que era dele (3% vira 2,5%). */
export function quoteWithoutTerceiro(quote) {
  const parties = (quote?.parties || []).filter((party) => !isTerceiroParty(party));
  if (!parties.length) return quote;
  const mesaPct = parties.reduce((sum, party) => sum + partyPct(party), 0);
  return { ...quote, parties, mesaPct };
}

export function partyPct(party) {
  if (typeof party?.pct === 'number') return Number.isFinite(party.pct) ? party.pct : 0;
  const n = parseBrlInput(party?.pct);
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
export function computeQuote({ brlAmount, rate, parties, mesaPct, asset, usdtRate }) {
  const brl = Number(brlAmount);
  const px = Number(rate);
  if (!Number.isFinite(brl) || brl <= 0 || !Number.isFinite(px) || px <= 0) return null;

  const gross = brl / px;
  const code = asset || 'USDT';
  const pxUsdt = code === 'USDT' ? px : Number(usdtRate);
  const usdtPx = Number.isFinite(pxUsdt) && pxUsdt > 0 ? pxUsdt : null;
  const rows = (parties || []).map((p) => {
    const pct = partyPct(p);
    const partBrl = brl * pct / 100;
    return {
      name: String(p?.name || '').trim() || 'Sem nome',
      pct,
      mine: !!p?.mine,
      asset: gross * pct / 100,
      brl: partBrl,
      usdt: usdtPx ? partBrl / usdtPx : null,
    };
  });
  const fromParts = rows.reduce((sum, row) => sum + row.pct, 0);
  const explicit = Number(mesaPct);
  const feePct = Number.isFinite(explicit) ? explicit : fromParts;
  const feeBrl = brl * feePct / 100;
  const fee = gross * feePct / 100;
  return {
    brl,
    rate: px,
    usdtRate: usdtPx,
    gross,
    grossUsdt: usdtPx ? brl / usdtPx : null,
    feePct,
    fee,
    feeBrl,
    feeUsdt: usdtPx ? feeBrl / usdtPx : null,
    client: gross - fee,
    clientUsdt: usdtPx ? (brl - feeBrl) / usdtPx : null,
    splits: rows,
    partsPct: fromParts,
  };
}

/** Moeda em que a mesa divide o lucro. Sem escolha gravada, vale a moeda paga ao cliente. */
export function profitCurrencyOf(quote) {
  const code = quote?.profitCurrency;
  if (code && MONEY[code]) return code;
  return quote?.asset || 'USDT';
}

export function profitCurrencyChoices(asset) {
  const client = asset || 'USDT';
  const choices = [{ id: 'BRL', label: 'Reais' }];
  if (client !== 'USDT') choices.push({ id: 'USDT', label: 'USDT' });
  choices.push({
    id: client,
    label: client === 'USDT' ? 'USDT · moeda do cliente' : `${client} · moeda do cliente`,
  });
  ['BTC', 'ETH'].forEach((other) => {
    if (other !== client && other !== 'USDT') choices.push({ id: other, label: other });
  });
  return choices;
}

/**
 * Percentual da mesa que produz esse valor na moeda da divisão.
 * O valor é sempre uma fração dos reais da ordem.
 */
export function pctFromAmount(amount, quote) {
  const brl = Number(quote?.brlAmount);
  const value = Number(amount);
  if (!Number.isFinite(brl) || brl <= 0 || !Number.isFinite(value) || value < 0) return null;
  const currency = profitCurrencyOf(quote);
  const asset = quote?.asset || 'USDT';
  let partBrl = null;
  if (currency === 'BRL') {
    partBrl = value;
  } else if (currency === 'USDT') {
    const px = Number(quote?.usdtRate || (asset === 'USDT' ? quote?.rate : NaN));
    if (Number.isFinite(px) && px > 0) partBrl = value * px;
  } else if (currency === asset) {
    const px = Number(quote?.rate);
    if (Number.isFinite(px) && px > 0) partBrl = value * px;
  } else {
    const px = Number(quote?.profitRate);
    if (Number.isFinite(px) && px > 0) partBrl = value * px;
  }
  if (!Number.isFinite(partBrl)) return null;
  return roundPct((partBrl / brl) * 100);
}

/** Valor da parte na moeda escolhida para dividir o lucro. */
export function settlementOf(split, quote) {
  const currency = profitCurrencyOf(quote);
  if (!split) return { code: currency, amount: null };
  if (currency === 'BRL') return { code: 'BRL', amount: split.brl };
  if (currency === 'USDT') return { code: 'USDT', amount: split.usdt };
  if (currency === (quote?.asset || 'USDT')) return { code: currency, amount: split.asset };
  const px = Number(quote?.profitRate);
  if (Number.isFinite(px) && px > 0 && Number.isFinite(split.brl)) {
    return { code: currency, amount: split.brl / px };
  }
  return { code: currency, amount: null };
}

/** Pago nesta ordem. Se a ordem inteira já foi efetivada, cada parte conta como paga. */
export function partyPaid(party, quote) {
  if (party?.paid === true) return true;
  if (party?.paid === false) return false;
  return quote?.payoutStatus === 'efetivada';
}

export function payoutOf(quote) {
  const parties = quote?.parties || [];
  if (!parties.length) {
    return quote?.payoutStatus === 'efetivada' ? 'efetivada' : 'a_pagar';
  }
  const paid = parties.map((party) => partyPaid(party, quote));
  if (paid.every(Boolean)) return 'efetivada';
  if (paid.some(Boolean)) return 'parcial';
  return 'a_pagar';
}

export function payoutLabel(state) {
  if (state === 'efetivada') return 'Efetivada';
  if (state === 'parcial') return 'Parcial';
  return 'A pagar';
}

/** USDT, reais e, se a entrega for outra, essa moeda também. */
export function snapshotAmounts(split, asset) {
  const parts = [];
  if (split?.usdt != null) parts.push({ code: 'USDT', amount: split.usdt });
  if (split?.brl != null) parts.push({ code: 'BRL', amount: split.brl });
  if (asset && asset !== 'USDT' && asset !== 'BRL') {
    parts.push({ code: asset, amount: split.asset });
  }
  return parts;
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

function addAsset(bucket, code, amount) {
  if (!code || code === 'USDT' || code === 'BRL' || !Number.isFinite(amount)) return;
  bucket[code] = (bucket[code] || 0) + amount;
}

/** Lucro das cotações realizadas, uma linha por nome de parte. */
export function partyProfit(quotes) {
  const rows = new Map();
  for (const quote of quotes || []) {
    if (quote.status !== 'realizada') continue;
    const calc = computeQuote(quote);
    if (!calc) continue;
    const asset = quote.asset || 'USDT';
    for (const split of calc.splits) {
      const name = split.name || 'Sem nome';
      const row = rows.get(name) || { name, brl: 0, usdt: 0, byAsset: {}, mine: false };
      row.brl += split.brl;
      if (split.usdt != null) row.usdt += split.usdt;
      addAsset(row.byAsset, asset, split.asset);
      if (split.mine) row.mine = true;
      rows.set(name, row);
    }
  }
  return [...rows.values()];
}

/** Seu lucro realizado, separado entre o que ainda está a pagar e o que já foi efetivado. */
export function payoutProfit(quotes) {
  const buckets = {
    a_pagar: { brl: 0, usdt: 0, byAsset: {} },
    efetivada: { brl: 0, usdt: 0, byAsset: {} },
  };
  for (const quote of quotes || []) {
    if (quote.status !== 'realizada') continue;
    const calc = computeQuote(quote);
    if (!calc) continue;
    const asset = quote.asset || 'USDT';
    calc.splits.forEach((split, index) => {
      if (!split.mine) return;
      const bucket = buckets[partyPaid(quote.parties?.[index], quote) ? 'efetivada' : 'a_pagar'];
      bucket.brl += split.brl;
      if (split.usdt != null) bucket.usdt += split.usdt;
      addAsset(bucket.byAsset, asset, split.asset);
    });
  }
  return buckets;
}

/** Lucro das cotações marcadas como realizadas, só nas linhas "meu". */
export function accumulatedProfit(quotes) {
  const byAsset = {};
  let brl = 0;
  let usdt = 0;
  for (const quote of quotes || []) {
    if (quote.status !== 'realizada') continue;
    const calc = computeQuote(quote);
    if (!calc) continue;
    const asset = quote.asset || 'USDT';
    for (const split of calc.splits) {
      if (!split.mine) continue;
      addAsset(byAsset, asset, split.asset);
      brl += split.brl;
      if (split.usdt != null) usdt += split.usdt;
    }
  }
  return { brl, usdt, byAsset };
}
