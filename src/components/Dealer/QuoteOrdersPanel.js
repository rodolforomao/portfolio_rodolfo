import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from 'react-bootstrap/Button';
import {
  TbRefresh, TbPlus, TbTrash, TbCheck, TbX, TbShare,
  TbChevronDown, TbChevronRight,
} from 'react-icons/tb';
import {
  DELIVERY_ASSETS,
  NETWORKS,
  QUOTE_TTL_MS,
  accumulatedProfit,
  assetMeta,
  computeQuote,
  effectiveStatus,
  isTerceiroParty,
  RECEIVE_PRESETS,
  isBrlPeg,
  receiveCode,
  receiveBinanceSymbol,
  receiveCurrencyOf,
  receivedOf,
  quoteRelation,
  dollarRateOf,
  mergePartyRows,
  blankOtherPartyNames,
  partiesWithoutTotal,
  quoteWithoutTerceiro,
  fetchBinancePrice,
  fetchQuotes,
  formatMoney,
  formatMoneyLabeled,
  loadLocalQuotes,
  moneyMeta,
  normalizeHops,
  parseBrlInput,
  partyPaid,
  partyPct,
  pctFromAmount,
  partyProfit,
  payoutLabel,
  payoutOf,
  payoutProfit,
  pctToField,
  profitCurrencyChoices,
  profitCurrencyOf,
  saveQuotes,
  settlementOf,
  snapshotAmounts,
  splitMesa,
} from './utils/quoteOrders';
import { paintAsset, paintPair } from './utils/quoteMarks';
import { drawClientSlip, drawMesaSlip, shareCanvas } from './utils/quoteSlip';

const STATUS_LABEL = {
  aberta: 'Aberta',
  realizada: 'Realizada',
  nao_realizada: 'Não realizada',
  expirada: 'Expirada',
  renovada: 'Renovada',
};

function formatBrl(n) {
  return formatMoney(n, 'BRL');
}

function formatAsset(n, asset) {
  return formatMoneyLabeled(n, asset);
}

function formatRate(n) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatPct(n) {
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

function formatWhen(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function formatRemaining(expiresAt, now) {
  const ms = Number(expiresAt) - now;
  if (ms <= 0) return 'expirada';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  return `${m}min ${String(s).padStart(2, '0')}s`;
}

function newParty(mine = false) {
  return { name: '', pct: '0', locked: false, mine };
}

function PartyNameField({ value, onCommit, ariaLabel, title, placeholder }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      className="dealer-quote-name"
      aria-label={ariaLabel}
      title={title}
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const next = text.trim();
        if (next !== String(value || '').trim()) onCommit(next);
        else setText(value || '');
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

function Mark({ code, network, size = 22, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const scale = 2;
    canvas.width = size * scale;
    canvas.height = size * scale;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, size, size);
    if (network) paintPair(ctx, code, network, 0, 0, size);
    else paintAsset(ctx, code, 0, 0, size);
  }, [code, network, size]);
  return (
    <canvas
      ref={ref}
      className="dealer-quote-mark"
      width={size}
      height={size}
      aria-hidden={label ? undefined : true}
      aria-label={label || undefined}
      title={label || undefined}
    />
  );
}

function moneyParts(amounts, extras = []) {
  const parts = [];
  for (const part of amounts || []) {
    if (part.amount == null || !Number.isFinite(part.amount)) continue;
    parts.push({
      code: part.code,
      text: part.code === 'BRL' ? formatBrl(part.amount) : formatAsset(part.amount, part.code),
    });
  }
  for (const [code, amount] of extras) {
    if (amount == null || !Number.isFinite(amount)) continue;
    parts.push({ code, text: formatAsset(amount, code) });
  }
  return parts;
}

function MoneyList({ amounts, extras, emphasize = false }) {
  const parts = moneyParts(amounts, extras);
  if (!parts.length) return <strong className="dealer-quote-zero">{formatBrl(0)}</strong>;
  const mark = emphasize ? 22 : 16;
  return (
    <span className={`dealer-quote-figures${emphasize ? ' is-mine' : ''}`}>
      {parts.map((part, index) => (
        <strong key={`${part.code}-${part.text}-${index}`}>
          <Mark code={part.code} size={mark} />
          {part.text}
        </strong>
      ))}
    </span>
  );
}

function formatSettlement(settlement) {
  if (!settlement || settlement.amount == null || !Number.isFinite(settlement.amount)) return '—';
  return settlement.code === 'BRL'
    ? formatBrl(settlement.amount)
    : formatAsset(settlement.amount, settlement.code);
}

function AddressField({ value, ariaLabel, placeholder, onCommit }) {
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  return (
    <input
      className="dealer-quote-address"
      spellCheck={false}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const next = text.trim();
        if (next !== String(value || '').trim()) onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

function MoneyField({ amount, code, ariaLabel, onCommit }) {
  const digits = code === 'BTC' || code === 'ETH' ? 6 : 2;
  const shown = Number.isFinite(Number(amount))
    ? Number(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: digits })
    : '';
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  return (
    <span className="dealer-quote-amount">
      <Mark code={code} size={22} label={moneyMeta(code).code || code} />
      <input
        inputMode="decimal"
        aria-label={ariaLabel}
        placeholder="Valor"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = parseBrlInput(text);
          if (Number.isFinite(n) && n >= 0) onCommit(n);
          else setText(shown);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </span>
  );
}

function PctField({ value, onCommit, ariaLabel }) {
  const [text, setText] = useState(pctToField(value));
  useEffect(() => setText(pctToField(value)), [value]);
  return (
    <input
      className="dealer-quote-pct"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = partyPct({ pct: text });
        if (n >= 0 && String(text).trim()) onCommit(n);
        else setText(pctToField(value));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

export default function QuoteOrdersPanel() {
  const [asset, setAsset] = useState('USDT');
  const [network, setNetwork] = useState(DELIVERY_ASSETS[0].networks[0]);
  const [receiveInput, setReceiveInput] = useState('');
  const [receiveChoice, setReceiveChoice] = useState('BRL');
  const [receiveCustom, setReceiveCustom] = useState('');
  const [receivePx, setReceivePx] = useState(1);
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [hops, setHops] = useState([]);
  const [mesaInput, setMesaInput] = useState('3');
  const [profitCurrency, setProfitCurrency] = useState('USDT');
  const [parties, setParties] = useState(() => [{ ...newParty(true), pct: '3' }]);
  const [rate, setRate] = useState(null);
  const [usdtRate, setUsdtRate] = useState(null);
  const [rateError, setRateError] = useState('');
  const [rateLoading, setRateLoading] = useState(false);
  const [quotes, setQuotes] = useState([]);
  const [quotesReady, setQuotesReady] = useState(false);
  const [filter, setFilter] = useState('todas');
  const [now, setNow] = useState(() => Date.now());
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const meta = assetMeta(asset);
  const incomingCode = receiveCode(receiveChoice, receiveCustom);
  const receiveAmount = parseBrlInput(receiveInput);
  const unitBrl = !incomingCode ? NaN : isBrlPeg(incomingCode) ? 1 : receivePx;
  const brlAmount = Number.isFinite(receiveAmount) && Number.isFinite(unitBrl)
    ? receiveAmount * unitBrl
    : NaN;
  const mesaPct = partyPct({ pct: mesaInput });
  const partsSum = parties.reduce((sum, p) => sum + partyPct(p), 0);
  const mesaMatches = Math.abs(partsSum - mesaPct) < 0.0001;
  const liveUsdt = asset === 'USDT' ? rate?.price : usdtRate?.price;
  const preview = useMemo(
    () => computeQuote({
      brlAmount, rate: rate?.price, parties, mesaPct, asset, usdtRate: liveUsdt,
    }),
    [brlAmount, rate, parties, mesaPct, asset, liveUsdt],
  );
  const hasMine = parties.some((p) => p.mine);
  const profit = useMemo(() => accumulatedProfit(quotes), [quotes]);
  const partiesProfit = useMemo(() => partyProfit(quotes), [quotes]);
  const payouts = useMemo(() => payoutProfit(quotes), [quotes]);
  const mesaDone = useMemo(() => {
    let brl = 0;
    let usdt = 0;
    const byAsset = {};
    for (const quote of quotes) {
      if (quote.status !== 'realizada') continue;
      const calc = computeQuote(quote);
      if (!calc) continue;
      brl += calc.feeBrl;
      if (calc.feeUsdt != null) usdt += calc.feeUsdt;
      const name = quote.asset || 'USDT';
      if (name !== 'USDT') byAsset[name] = (byAsset[name] || 0) + calc.fee;
    }
    return { brl, usdt, byAsset };
  }, [quotes]);

  const persist = useCallback((next) => {
    setQuotes(next);
    if (!quotesReady) return;
    saveQuotes(next).catch((err) => {
      setFormError(err?.message || 'Não foi possível gravar na base.');
    });
  }, [quotesReady]);

  useEffect(() => {
    let cancelled = false;
    fetchQuotes()
      .then((serverQuotes) => {
        if (cancelled) return;
        const local = loadLocalQuotes();
        const ids = new Set(serverQuotes.map((q) => q.id));
        const extra = local.filter((q) => q?.id && !ids.has(q.id));
        const merged = extra.length ? [...extra, ...serverQuotes] : serverQuotes;
        setQuotes(merged);
        setQuotesReady(true);
        if (extra.length) {
          saveQuotes(merged).catch((err) => {
            setFormError(err?.message || 'Não foi possível gravar as cotações locais na base.');
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setFormError(err?.message || 'Base de cotações indisponível.');
      });
    return () => { cancelled = true; };
  }, []);

  const loadRate = useCallback((symbol) => {
    setRateLoading(true);
    setRateError('');
    return fetchBinancePrice(symbol)
      .then((next) => {
        setRate(next);
        return next;
      })
      .catch((err) => {
        setRateError(err?.message || 'Falha ao ler a Binance');
        throw err;
      })
      .finally(() => setRateLoading(false));
  }, []);

  useEffect(() => {
    loadRate(meta.symbol).catch(() => {});
  }, [meta.symbol, loadRate]);

  useEffect(() => {
    const ids = profitCurrencyChoices(asset).map((choice) => choice.id);
    if (!ids.includes(profitCurrency)) setProfitCurrency(asset);
  }, [asset, profitCurrency]);

  useEffect(() => {
    if (!incomingCode || isBrlPeg(incomingCode)) {
      setReceivePx(1);
      return undefined;
    }
    let cancelled = false;
    fetchBinancePrice(receiveBinanceSymbol(incomingCode))
      .then((next) => {
        if (!cancelled) setReceivePx(next.price);
      })
      .catch(() => {
        if (!cancelled) setReceivePx(NaN);
      });
    return () => { cancelled = true; };
  }, [incomingCode]);

  useEffect(() => {
    if (asset === 'USDT') return undefined;
    let cancelled = false;
    fetchBinancePrice('USDTBRL')
      .then((next) => {
        if (!cancelled) setUsdtRate(next);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [asset]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      loadRate(meta.symbol).catch(() => {});
    }, 20000);
    return () => clearInterval(id);
  }, [meta.symbol, loadRate]);

  const changeMesa = (value) => {
    setMesaInput(value);
    setParties((prev) => splitMesa(prev, partyPct({ pct: value })));
  };

  const updateParty = (index, patch) => {
    setParties((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const changePartyPct = (index, value) => {
    setParties((prev) => {
      const locked = prev.map((p, i) => (
        i === index ? { ...p, pct: value, locked: true } : p
      ));
      return splitMesa(locked, mesaPct);
    });
  };

  const markMine = (index) => {
    setParties((prev) => prev.map((p, i) => ({ ...p, mine: i === index })));
  };

  const addParty = () => {
    setParties((prev) => splitMesa([...prev, newParty(false)], mesaPct));
  };

  const removeParty = (index) => {
    setParties((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length && !next.some((p) => p.mine)) next[0] = { ...next[0], mine: true };
      return splitMesa(next, mesaPct);
    });
  };

  const splitEvenly = () => {
    setParties((prev) => splitMesa(prev.map((p) => ({ ...p, locked: false })), mesaPct));
  };

  const buildSnapshot = (price, source) => ({
    id: `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    expiresAt: Date.now() + QUOTE_TTL_MS,
    status: 'aberta',
    brlAmount: source.brlAmount,
    receiveAmount: source.receiveAmount,
    receiveCurrency: source.receiveCurrency || 'BRL',
    receiveRate: source.receiveRate ?? 1,
    asset: source.asset,
    network: source.network,
    symbol: assetMeta(source.asset).symbol,
    rate: price,
    usdtRate: source.asset === 'USDT' ? price : source.usdtRate,
    clientName: source.clientName.trim(),
    mesaPct: source.mesaPct,
    parties: source.parties.map((p) => ({
      name: String(p.name || '').trim() || 'Sem nome',
      pct: partyPct(p),
      mine: !!p.mine,
      terceiro: isTerceiroParty(p),
    })),
    profitCurrency: source.profitCurrency || source.asset,
    profitRate: source.profitRate || null,
    payoutStatus: 'a_pagar',
    renewedFrom: source.renewedFrom || null,
    clientAddress: String(source.clientAddress || '').trim(),
    hops: normalizeHops(source.hops),
  });

  const handleCreate = async (event) => {
    event?.preventDefault();
    setFormError('');
    if (!incomingCode) {
      setFormError('Informe a moeda que entra na conta.');
      return;
    }
    if (!Number.isFinite(receiveAmount) || receiveAmount <= 0) {
      setFormError('Informe o valor que entra na conta.');
      return;
    }
    if (!isBrlPeg(incomingCode) && !(Number.isFinite(receivePx) && receivePx > 0)) {
      setFormError(`A Binance não tem o par ${incomingCode}BRL.`);
      return;
    }
    if (!(mesaPct > 0)) {
      setFormError('Informe a porcentagem da mesa.');
      return;
    }
    if (!parties.length || parties.some((p) => !String(p.name || '').trim() || partyPct(p) <= 0)) {
      setFormError('Cada participante precisa de nome e percentual.');
      return;
    }
    if (!mesaMatches) {
      setFormError('A soma dos participantes tem de fechar a porcentagem da mesa.');
      return;
    }
    if (!hasMine) {
      setFormError('Marque qual parte é o seu lucro.');
      return;
    }
    setCreating(true);
    try {
      const fresh = await loadRate(meta.symbol);
      let lockedUsdt = fresh.price;
      if (asset !== 'USDT') {
        const usdt = await fetchBinancePrice('USDTBRL');
        setUsdtRate(usdt);
        lockedUsdt = usdt.price;
      }
      const lockedReceive = isBrlPeg(incomingCode)
        ? 1
        : (await fetchBinancePrice(receiveBinanceSymbol(incomingCode))).price;
      let profitRate = null;
      if (profitCurrency !== 'BRL' && profitCurrency !== 'USDT' && profitCurrency !== asset) {
        profitRate = (await fetchBinancePrice(`${profitCurrency}BRL`)).price;
      }
      const quote = buildSnapshot(fresh.price, {
        brlAmount: receiveAmount * lockedReceive,
        receiveAmount,
        receiveCurrency: incomingCode,
        receiveRate: lockedReceive,
        asset, network, clientName, clientAddress, hops, mesaPct, parties,
        usdtRate: lockedUsdt, profitCurrency, profitRate,
      });
      persist([quote, ...quotes]);
    } catch (err) {
      setFormError(err?.message || 'Não foi possível travar o preço da Binance.');
    } finally {
      setCreating(false);
    }
  };

  const setStatus = (id, status) => {
    persist(quotes.map((q) => (
      q.id === id ? { ...q, status, decidedAt: Date.now() } : q
    )));
  };

  const handleRenew = async (quote) => {
    setFormError('');
    setCreating(true);
    try {
      const symbol = quote.symbol || assetMeta(quote.asset).symbol;
      const fresh = await fetchBinancePrice(symbol);
      let lockedUsdt = fresh.price;
      if ((quote.asset || 'USDT') !== 'USDT') {
        lockedUsdt = (await fetchBinancePrice('USDTBRL')).price;
      }
      const incoming = receiveCurrencyOf(quote);
      const amountIn = quote.receiveAmount != null ? Number(quote.receiveAmount) : Number(quote.brlAmount);
      const lockedReceive = isBrlPeg(incoming)
        ? 1
        : (await fetchBinancePrice(receiveBinanceSymbol(incoming))).price;
      const next = buildSnapshot(fresh.price, {
        brlAmount: amountIn * lockedReceive,
        receiveAmount: amountIn,
        receiveCurrency: incoming,
        receiveRate: lockedReceive,
        asset: quote.asset,
        network: quote.network,
        clientName: quote.clientName || '',
        clientAddress: quote.clientAddress || '',
        hops: quote.hops || [],
        mesaPct: quote.mesaPct,
        parties: quote.parties,
        usdtRate: lockedUsdt,
        profitCurrency: profitCurrencyOf(quote),
        profitRate: quote.profitRate || null,
        renewedFrom: quote.id,
      });
      persist([
        next,
        ...quotes.map((q) => (q.id === quote.id ? { ...q, status: 'renovada', renewedTo: next.id } : q)),
      ]);
    } catch (err) {
      setFormError(err?.message || 'Não foi possível renovar com a Binance.');
    } finally {
      setCreating(false);
    }
  };

  const handleRemove = (id) => {
    persist(quotes.filter((q) => q.id !== id));
  };

  const renamePartyOnQuote = (id, index, name) => {
    persist(quotes.map((q) => {
      if (q.id !== id) return q;
      return {
        ...q,
        parties: (q.parties || []).map((p, i) => (i === index ? { ...p, name } : p)),
      };
    }));
  };

  const patchQuote = (id, partial) => {
    persist(quotes.map((q) => (q.id === id ? { ...q, ...partial } : q)));
  };

  const replaceParties = (id, parties, extra = {}) => {
    persist(quotes.map((q) => {
      if (q.id !== id) return q;
      const flags = parties.map((party) => partyPaid(party, q));
      const payoutStatus = !flags.length || flags.every((paid) => !paid)
        ? 'a_pagar'
        : flags.every(Boolean) ? 'efetivada' : 'parcial';
      return { ...q, ...extra, parties, payoutStatus };
    }));
  };

  const addPartyToQuote = (id) => {
    const quote = quotes.find((q) => q.id === id);
    if (!quote || payoutOf(quote) === 'efetivada') return;
    const parties = quote.parties || [];
    const used = parties.reduce((sum, party) => sum + partyPct(party), 0);
    const rest = Math.max(0, Math.round((partyPct({ pct: quote.mesaPct }) - used) * 10000) / 10000);
    const hasTerceiro = parties.some((party) => isTerceiroParty(party));
    replaceParties(id, [
      ...parties,
      {
        name: hasTerceiro ? '' : 'Terceiro',
        pct: rest,
        mine: parties.length === 0,
        terceiro: !hasTerceiro,
        paid: false,
      },
    ]);
  };

  const mergePartiesOnQuote = (id, indexes) => {
    const quote = quotes.find((q) => q.id === id);
    if (!quote || payoutOf(quote) === 'efetivada') return;
    const parties = mergePartyRows(quote.parties, indexes);
    if (parties) replaceParties(id, parties);
  };

  const blankOthersOnQuote = (id, indexes) => {
    const quote = quotes.find((q) => q.id === id);
    if (!quote || payoutOf(quote) === 'efetivada') return;
    const parties = blankOtherPartyNames(quote.parties, indexes);
    if (parties) replaceParties(id, parties);
  };

  const dropPartiesFromTotal = (id, indexes) => {
    const quote = quotes.find((q) => q.id === id);
    if (!quote || payoutOf(quote) === 'efetivada') return;
    const next = partiesWithoutTotal(quote.parties, quote.mesaPct, indexes);
    if (next) replaceParties(id, next.parties, { mesaPct: next.mesaPct });
  };

  const setPartyPct = (id, index, pct) => {
    persist(quotes.map((q) => {
      if (q.id !== id) return q;
      return {
        ...q,
        parties: (q.parties || []).map((p, i) => (i === index ? { ...p, pct } : p)),
      };
    }));
  };

  const setPartyPaid = (id, index, paid) => {
    persist(quotes.map((q) => {
      if (q.id !== id) return q;
      const parties = (q.parties || []).map((party, i) => ({
        ...party,
        paid: i === index ? paid : partyPaid(party, q),
      }));
      const flags = parties.map((party) => party.paid);
      const payoutStatus = flags.every(Boolean)
        ? 'efetivada'
        : flags.some(Boolean) ? 'parcial' : 'a_pagar';
      return { ...q, parties, payoutStatus };
    }));
  };

  const setPartyTerceiro = (id, index, terceiro) => {
    persist(quotes.map((q) => {
      if (q.id !== id) return q;
      return {
        ...q,
        parties: (q.parties || []).map((p, i) => (i === index ? { ...p, terceiro } : p)),
      };
    }));
  };

  const chooseProfitCurrency = async (quote, currency) => {
    const delivery = quote.asset || 'USDT';
    let profitRate = null;
    if (currency !== 'BRL' && currency !== 'USDT' && currency !== delivery) {
      try {
        profitRate = (await fetchBinancePrice(`${currency}BRL`)).price;
      } catch (err) {
        setFormError(err?.message || 'Não foi possível travar a cotação dessa moeda.');
        return;
      }
    }
    patchQuote(quote.id, { profitCurrency: currency, profitRate });
  };

  const renamePartyEverywhere = (from, name) => {
    persist(quotes.map((q) => ({
      ...q,
      parties: (q.parties || []).map((p) => (
        String(p.name || '').trim() === from ? { ...p, name } : p
      )),
    })));
  };

  const quoteNumber = useMemo(() => {
    const ordered = [...quotes].sort((a, b) => (
      (a.createdAt || 0) - (b.createdAt || 0) || String(a.id).localeCompare(String(b.id))
    ));
    const map = new Map();
    ordered.forEach((q, index) => map.set(q.id, index + 1));
    return map;
  }, [quotes]);

  const visible = quotes.filter((q) => {
    const status = effectiveStatus(q, now);
    if (filter === 'abertas') return status === 'aberta' || status === 'expirada';
    if (filter === 'realizadas') return status === 'realizada';
    return true;
  });

  const mineBits = snapshotAmounts(
    { usdt: profit.usdt, brl: profit.brl, asset: null },
    null,
  );
  const mesaBits = snapshotAmounts(
    { usdt: mesaDone.usdt, brl: mesaDone.brl, asset: null },
    null,
  );
  const counts = { abertas: 0, realizadas: 0, todas: quotes.length };
  for (const quote of quotes) {
    const status = effectiveStatus(quote, now);
    if (status === 'aberta' || status === 'expirada') counts.abertas += 1;
    else if (status === 'realizada') counts.realizadas += 1;
  }
  const emptyCopy = filter === 'abertas'
    ? 'Nenhuma ordem aberta. Crie uma cotação para travar o preço.'
    : filter === 'realizadas'
      ? 'Nenhuma ordem realizada ainda.'
      : 'Nenhuma cotação gravada.';

  return (
    <div className="dealer-quote">
      <header className="dealer-quote-head">
        <div>
          <h4 className="dealer-quote-title">Cotações</h4>
          <p className="dealer-quote-lede">
            O preço da Binance fica travado por uma hora. A mesa se reparte entre quem entra na ordem.
          </p>
        </div>
        <div className="dealer-quote-ticker" aria-live="polite">
          <span className="dealer-quote-ticker-pair">
            {asset}/{moneyMeta('BRL').code || 'BRL'}
          </span>
          <strong>{rate ? formatRate(rate.price) : '—'}</strong>
          <span className="dealer-quote-rate-meta">
            {rateLoading ? 'Lendo a Binance' : rate ? `Binance, ${formatWhen(rate.fetchedAt)}` : 'Sem preço'}
          </span>
          <button
            type="button"
            className="dealer-quote-icon-btn"
            onClick={() => loadRate(meta.symbol).catch(() => {})}
            aria-label="Atualizar cotação da Binance"
            title="Atualizar cotação da Binance"
          >
            <TbRefresh />
          </button>
        </div>
      </header>

      {(rateError || formError) && (
        <p className="dealer-quote-alert" role="alert">{formError || rateError}</p>
      )}

      <div className="dealer-quote-workspace">
      <form className="dealer-quote-form" onSubmit={handleCreate}>
        <h5 className="dealer-quote-sheet-title">Nova ordem</h5>
        <div className="dealer-quote-fields">
          <label>
            Entra na conta
            <span className="dealer-quote-receive">
              <Mark code={incomingCode || 'BRL'} size={28} label={incomingCode || 'BRL'} />
              <input
                inputMode="decimal"
                value={receiveInput}
                onChange={(e) => setReceiveInput(e.target.value)}
                placeholder="100000"
              />
              <select
                aria-label="Moeda que entra"
                value={receiveChoice}
                onChange={(e) => setReceiveChoice(e.target.value)}
              >
                {RECEIVE_PRESETS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              {receiveChoice === 'OUTRA' && (
                <input
                  aria-label="Código da moeda"
                  value={receiveCustom}
                  onChange={(e) => setReceiveCustom(e.target.value.toUpperCase())}
                  placeholder="SOL"
                />
              )}
            </span>
          </label>
            <label>
              Entregar
              <span className="dealer-quote-receive">
                <Mark code={asset} size={28} label={asset} />
                <select
                value={asset}
                onChange={(e) => {
                  const next = e.target.value;
                  setAsset(next);
                  setNetwork(assetMeta(next).networks[0]);
                }}
              >
                {DELIVERY_ASSETS.map((a) => (
                  <option key={a.asset} value={a.asset}>
                    {moneyMeta(a.asset).symbol} {a.asset}
                  </option>
                ))}
              </select>
              </span>
            </label>
          <label>
            Rede
            <span className="dealer-quote-receive">
              <Mark code={asset} network={network} size={28} label={`${asset} na rede ${network}`} />
              <select value={network} onChange={(e) => setNetwork(e.target.value)}>
              {meta.networks.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            </span>
          </label>
          <label>
            Cliente
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nome do cliente"
            />
          </label>
        </div>

        <div className="dealer-quote-route-form">
          <label>
            Endereço de recebimento do cliente
            <input
              className="dealer-quote-address"
              spellCheck={false}
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              placeholder={`Endereço na rede ${network}`}
            />
          </label>
          <div className="dealer-quote-hops">
            <span>Endereços intermediários</span>
            <p>Na ordem da conversão. Exemplo: BEP20 e, em seguida, Polygon.</p>
            {hops.map((hop, index) => (
              <div key={index} className="dealer-quote-hop">
                <select
                  aria-label={`Rede intermediária ${index + 1}`}
                  value={hop.network}
                  onChange={(e) => setHops((prev) => prev.map((item, i) => (
                    i === index ? { ...item, network: e.target.value } : item
                  )))}
                >
                  {NETWORKS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <input
                  className="dealer-quote-address"
                  spellCheck={false}
                  aria-label={`Endereço intermediário ${index + 1}`}
                  value={hop.address}
                  placeholder="Endereço intermediário"
                  onChange={(e) => setHops((prev) => prev.map((item, i) => (
                    i === index ? { ...item, address: e.target.value } : item
                  )))}
                />
                <button
                  type="button"
                  className="dealer-quote-icon-btn"
                  title="Retirar endereço"
                  onClick={() => setHops((prev) => prev.filter((_, i) => i !== index))}
                >
                  <TbTrash />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="dealer-quote-add"
              onClick={() => setHops((prev) => [...prev, { network: prev.length ? 'Polygon' : 'BEP20', address: '' }])}
            >
              <TbPlus /> Endereço intermediário
            </button>
          </div>
        </div>

        <div className="dealer-quote-mesa">
          <label>
            Porcentagem da mesa
            <input
              inputMode="decimal"
              value={mesaInput}
              onChange={(e) => changeMesa(e.target.value)}
              placeholder="3"
            />
          </label>
          <label>
            Divisão do lucro
            <span className="dealer-quote-receive">
              <Mark code={profitCurrency} size={22} label={profitCurrency} />
              <select value={profitCurrency} onChange={(e) => setProfitCurrency(e.target.value)}>
              {profitCurrencyChoices(asset).map((choice) => (
                <option key={choice.id} value={choice.id}>{choice.label}</option>
              ))}
            </select>
            </span>
          </label>
          <button type="button" className="dealer-quote-add" onClick={splitEvenly}>
            Repartir igualmente
          </button>
          <span className={mesaMatches ? 'dealer-quote-mesa-ok' : 'dealer-quote-mesa-bad'}>
            {mesaMatches
              ? `Participantes em ${formatPct(partsSum)}`
              : `Participantes em ${formatPct(partsSum)}. Falta fechar ${formatPct(mesaPct)}.`}
          </span>
        </div>

        <div className="dealer-quote-parties">
          {parties.map((party, index) => (
            <div key={index} className="dealer-quote-party">
              <input
                aria-label={`Participante ${index + 1}`}
                value={party.name}
                onChange={(e) => updateParty(index, { name: e.target.value })}
                placeholder="Nome na mesa"
              />
              <input
                className="dealer-quote-pct"
                aria-label={`Percentual de ${party.name || index + 1}`}
                inputMode="decimal"
                value={party.pct}
                onChange={(e) => changePartyPct(index, e.target.value)}
              />
              <MoneyField
                amount={(() => {
                  const split = preview?.splits[index];
                  if (!split) return null;
                  return settlementOf(split, {
                    brlAmount, asset, rate: rate?.price, usdtRate: liveUsdt, profitCurrency,
                  }).amount;
                })()}
                code={profitCurrency}
                ariaLabel={`Valor de ${party.name || index + 1}`}
                onCommit={(amount) => {
                  const pct = pctFromAmount(amount, {
                    brlAmount, asset, rate: rate?.price, usdtRate: liveUsdt, profitCurrency,
                  });
                  if (pct == null) return;
                  changePartyPct(index, pct);
                }}
              />
              <label className="dealer-quote-mine">
                <input
                  type="radio"
                  name="quote-mine"
                  checked={!!party.mine}
                  onChange={() => markMine(index)}
                />
                meu lucro
              </label>
              <label className="dealer-quote-mine">
                <input
                  type="checkbox"
                  checked={isTerceiroParty(party)}
                  onChange={(e) => updateParty(index, { terceiro: e.target.checked })}
                />
                terceiro
              </label>
              <button
                type="button"
                className="dealer-quote-remove"
                aria-label="Excluir participante"
                title="Excluir participante"
                onClick={() => removeParty(index)}
                disabled={parties.length <= 1}
              >
                <TbX />
              </button>
            </div>
          ))}
          <button type="button" className="dealer-quote-add" onClick={addParty}>
            <TbPlus /> Colocar participante
          </button>
        </div>

        <QuoteMath
          calc={preview}
          asset={asset}
          network={network}
          received={Number.isFinite(receiveAmount) ? { code: incomingCode || 'BRL', amount: receiveAmount } : null}
          rateLabel={rate ? `${formatRate(rate.price)} BRL` : 'aguardando Binance'}
        />

        <div className="dealer-quote-submit">
          <button
            type="submit"
            className="dealer-quote-create"
            disabled={creating || rateLoading || !quotesReady}
          >
            {creating ? 'Travando preço…' : 'Criar cotação'}
          </button>
          {preview && (
            <span className="dealer-quote-submit-note">
              Mesa de {formatPct(preview.feePct)} sobre o bruto. Vale por 1 hora.
            </span>
          )}
        </div>
      </form>

      <aside className="dealer-quote-ledger" aria-label="Ordens realizadas">
        <h5>Realizadas</h5>
        <div className="dealer-quote-ledger-mine">
          <span>Seu lucro</span>
          <MoneyList amounts={mineBits} extras={Object.entries(profit.byAsset)} emphasize />
        </div>
        <dl>
          <div>
            <dt>A pagar</dt>
            <dd>
              <MoneyList
                amounts={snapshotAmounts(payouts.a_pagar, null)}
                extras={Object.entries(payouts.a_pagar.byAsset)}
              />
            </dd>
          </div>
          <div>
            <dt>Efetivado</dt>
            <dd>
              <MoneyList
                amounts={snapshotAmounts(payouts.efetivada, null)}
                extras={Object.entries(payouts.efetivada.byAsset)}
              />
            </dd>
          </div>
          <div>
            <dt>Mesa</dt>
            <dd>
              <MoneyList amounts={mesaBits} extras={Object.entries(mesaDone.byAsset)} />
            </dd>
          </div>
        </dl>
        {partiesProfit.length > 0 && (
          <table className="dealer-quote-table">
            <thead>
              <tr>
                <td>Parte</td>
                <td>Snapshot</td>
              </tr>
            </thead>
            <tbody>
              {partiesProfit.map((row) => (
                <tr key={row.name} className={row.mine ? 'mine' : ''}>
                  <td>
                    <PartyNameField
                      value={row.name}
                      ariaLabel={`Nome da parte ${row.name}`}
                      title="Vale para todas as ordens com este nome"
                      onCommit={(name) => renamePartyEverywhere(row.name, name)}
                    />
                  </td>
                  <td>
                    <MoneyList
                      amounts={snapshotAmounts({ usdt: row.usdt, brl: row.brl }, null)}
                      extras={Object.entries(row.byAsset)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </aside>
      </div>

      <div className="dealer-quote-orders-head">
        <h5>Ordens</h5>
        <div className="dealer-quote-filters" role="tablist" aria-label="Filtrar ordens">
          {[
            ['abertas', 'Abertas', counts.abertas],
            ['realizadas', 'Realizadas', counts.realizadas],
            ['todas', 'Todas', counts.todas],
          ].map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={filter === id ? 'active' : ''}
              onClick={() => setFilter(id)}
            >
              {label}
              <span className="dealer-quote-count">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="dealer-quote-empty">{emptyCopy}</p>
      ) : (
        <div className="dealer-quote-book">
          <div className="dealer-quote-book-head" aria-hidden="true">
            <span />
            <span>Cliente</span>
            <span>Entra</span>
            <span>Mesa</span>
            <span>Lucro</span>
            <span>Situação</span>
            <span />
          </div>
          <div className="dealer-quote-list">
          {visible.map((quote) => (
            <QuoteRow
              key={quote.id}
              number={quoteNumber.get(quote.id)}
              quote={quote}
              now={now}
              busy={creating}
              onRealize={() => setStatus(quote.id, 'realizada')}
              onDecline={() => setStatus(quote.id, 'nao_realizada')}
              onUndo={() => setStatus(quote.id, 'aberta')}
              onRenew={() => handleRenew(quote)}
              onRemove={() => handleRemove(quote.id)}
              onRename={(index, name) => renamePartyOnQuote(quote.id, index, name)}
              onPartyPct={(index, pct) => setPartyPct(quote.id, index, pct)}
              onPartyTerceiro={(index, terceiro) => setPartyTerceiro(quote.id, index, terceiro)}
              onMesaPct={(pct) => patchQuote(quote.id, { mesaPct: pct })}
              onProfitCurrency={(currency) => chooseProfitCurrency(quote, currency)}
              onPayout={(status) => {
                const paid = status === 'efetivada';
                patchQuote(quote.id, {
                  payoutStatus: paid ? 'efetivada' : 'a_pagar',
                  parties: (quote.parties || []).map((party) => ({ ...party, paid })),
                });
              }}
              onPartyPaid={(index, paid) => setPartyPaid(quote.id, index, paid)}
              onAddParty={() => addPartyToQuote(quote.id)}
              onClearName={(index) => renamePartyOnQuote(quote.id, index, '')}
              onMergeParties={(indexes) => mergePartiesOnQuote(quote.id, indexes)}
              onBlankOthers={(indexes) => blankOthersOnQuote(quote.id, indexes)}
              onDropFromTotal={(indexes) => dropPartiesFromTotal(quote.id, indexes)}
              onClientAddress={(address) => patchQuote(quote.id, { clientAddress: address })}
              onNetwork={(networkName) => patchQuote(quote.id, { network: networkName })}
              onHops={(nextHops) => patchQuote(quote.id, { hops: nextHops })}
            />
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuoteMath({ calc, asset, network, rateLabel, received }) {
  if (!calc) {
    return (
      <p className="dealer-quote-preview-empty">
        Informe o valor que entra na conta para ver quanto o cliente recebe e quanto fica para cada um.
      </p>
    );
  }
  const other = asset !== 'USDT';
  return (
    <div className="dealer-quote-preview">
      <div className="dealer-quote-preview-hero">
        <span>Cliente recebe</span>
        <strong>{formatAsset(calc.client, asset)}</strong>
        <span>
          {received ? `Entra ${formatMoney(received.amount, received.code)}. ` : ''}
          Rede {network}. 1 {moneyMeta(asset).symbol} = {rateLabel}
        </span>
      </div>
      <table className="dealer-quote-table">
        <thead>
          <tr>
            <td />
            <td>₮ USDT</td>
            <td>R$</td>
            {other && <td>{moneyMeta(asset).symbol} {asset}</td>}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Bruto na Binance</td>
            <td>{calc.grossUsdt != null ? formatAsset(calc.grossUsdt, 'USDT') : '—'}</td>
            <td>{formatBrl(calc.brl)}</td>
            {other && <td>{formatAsset(calc.gross, asset)}</td>}
          </tr>
          <tr>
            <td>Mesa {formatPct(calc.feePct)}</td>
            <td>{calc.feeUsdt != null ? formatAsset(calc.feeUsdt, 'USDT') : '—'}</td>
            <td>{formatBrl(calc.feeBrl)}</td>
            {other && <td>{formatAsset(calc.fee, asset)}</td>}
          </tr>
          {calc.splits.map((split, index) => (
            <tr key={`${split.name}-${index}`} className={split.mine ? 'mine' : ''}>
              <td>{split.name} {formatPct(split.pct)}{split.mine ? ', seu' : ''}</td>
              <td>{split.usdt != null ? formatAsset(split.usdt, 'USDT') : '—'}</td>
              <td>{formatBrl(split.brl)}</td>
              {other && <td>{formatAsset(split.asset, asset)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentRoute({ quote, onClientAddress, onNetwork, onHops }) {
  const hops = quote.hops || [];
  const delivery = assetMeta(quote.asset || 'USDT');
  const clientNetworks = delivery.networks.includes(quote.network) || !quote.network
    ? delivery.networks
    : [quote.network, ...delivery.networks];
  const setHop = (index, patch) => {
    onHops(hops.map((hop, i) => (i === index ? { ...hop, ...patch } : hop)));
  };
  return (
    <section className="dealer-quote-xray dealer-quote-route">
      <h5>Pagamento</h5>
      <p className="dealer-quote-row-time">
        O cliente recebe na rede da entrega. Os intermediários seguem a ordem da conversão, por exemplo de BEP20 para Polygon.
      </p>
      <div className="dealer-quote-hop">
        <select
          aria-label="Rede de recebimento do cliente"
          value={quote.network || clientNetworks[0]}
          onChange={(e) => onNetwork(e.target.value)}
        >
          {clientNetworks.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <AddressField
          value={quote.clientAddress}
          ariaLabel="Endereço de recebimento do cliente"
          placeholder="Endereço de recebimento do cliente"
          onCommit={onClientAddress}
        />
        <span />
      </div>
      {hops.map((hop, index) => {
        const hopNetworks = NETWORKS.includes(hop.network) || !hop.network
          ? NETWORKS
          : [hop.network, ...NETWORKS];
        return (
          <div key={`${quote.id}-hop-${index}`} className="dealer-quote-hop">
            <select
              aria-label={`Rede intermediária ${index + 1}`}
              value={hop.network || hopNetworks[0]}
              onChange={(e) => setHop(index, { network: e.target.value })}
            >
              {hopNetworks.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <AddressField
              value={hop.address}
              ariaLabel={`Endereço intermediário ${index + 1}`}
              placeholder="Endereço intermediário"
              onCommit={(address) => setHop(index, { address })}
            />
            <button
              type="button"
              className="dealer-quote-icon-btn"
              title="Retirar endereço"
              onClick={() => onHops(hops.filter((_, i) => i !== index))}
            >
              <TbTrash />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="dealer-quote-add"
        onClick={() => onHops([...hops, { network: hops.length ? 'Polygon' : 'BEP20', address: '' }])}
      >
        <TbPlus /> Endereço intermediário
      </button>
    </section>
  );
}

function shareMessage(result, who) {
  if (result === 'shared') return `Escolha onde enviar a imagem ${who}.`;
  if (result === 'copied') return `Imagem ${who} copiada. Cole na conversa.`;
  return `Imagem ${who} baixada. Envie o arquivo.`;
}

function QuoteRow({
  number, quote, now, busy, onRealize, onDecline, onUndo, onRenew, onRemove, onRename,
  onPartyPct, onMesaPct, onProfitCurrency, onPayout, onPartyTerceiro, onPartyPaid,
  onClientAddress, onNetwork, onHops, onAddParty, onClearName, onMergeParties,
  onBlankOthers, onDropFromTotal,
}) {
  const status = effectiveStatus(quote, now);
  const calc = computeQuote(quote);
  const partiesOpen = payoutOf(quote) !== 'efetivada';
  const open = status === 'aberta' || status === 'expirada';
  const decided = status === 'realizada' || status === 'nao_realizada';
  const [expanded, setExpanded] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [sharing, setSharing] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const partyCount = (quote.parties || []).length;
  useEffect(() => setPicked(new Set()), [quote.id, partyCount]);
  const mesaProfit = calc
    ? settlementOf({ brl: calc.feeBrl, usdt: calc.feeUsdt, asset: calc.fee }, quote)
    : null;

  const sendImage = async (kind) => {
    if (!calc) return;
    setSharing(true);
    setShareNote('');
    try {
      let canvas;
      let file;
      let who;
      if (kind === 'client') {
        canvas = drawClientSlip(quote, calc);
        file = 'cotacao-cliente.png';
        who = 'do cliente';
      } else if (kind === 'mesa') {
        const mesaQuote = quoteWithoutTerceiro(quote);
        canvas = drawMesaSlip(mesaQuote, computeQuote(mesaQuote), 'Cotação da mesa');
        file = 'cotacao-mesa.png';
        who = 'da mesa';
      } else {
        canvas = drawMesaSlip(quote, calc, 'Cotação terceiro');
        file = 'cotacao-terceiro.png';
        who = 'do terceiro';
      }
      const result = await shareCanvas(canvas, file);
      setShareNote(shareMessage(result, who));
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setShareNote(err?.message || 'Não foi possível gerar a imagem.');
    } finally {
      setSharing(false);
    }
  };
  const assetCode = quote.asset || 'USDT';
  const dollarPx = dollarRateOf(quote);
  const pickedList = [...picked];
  const togglePick = (index) => {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };
  return (
    <article className={`dealer-quote-row status-${status}${expanded ? ' open' : ''}`}>
      <button
        type="button"
        className="dealer-quote-summary"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="dealer-quote-num">#{number}</span>
        <span className="dealer-quote-who">
          <strong>{quoteRelation(quote)}</strong>
          <span className="dealer-quote-dollar">
            Dólar {dollarPx != null ? `R$ ${formatRate(dollarPx)}` : '—'}
          </span>
          <span>
            <Mark code={assetCode} network={quote.network} size={22} label={`${assetCode} na rede ${quote.network || ''}`} />
            {moneyMeta(assetCode).symbol} {assetCode}
            {quote.network ? `, ${quote.network}` : ''}
          </span>
        </span>
        <span className="dealer-quote-fig">
          <span className="dealer-quote-fig-label">Entra</span>
          <strong>{formatMoney(receivedOf(quote).amount, receivedOf(quote).code)}</strong>
          {receivedOf(quote).code !== 'BRL' && (
            <span className="dealer-quote-fig-sub">{formatBrl(quote.brlAmount)}</span>
          )}
        </span>
        <span className="dealer-quote-fig">
          <span className="dealer-quote-fig-label">Mesa</span>
          <strong>{calc ? formatBrl(calc.feeBrl) : '—'}</strong>
          {calc && <span className="dealer-quote-fig-sub">{formatPct(calc.feePct)}</span>}
        </span>
        <span className="dealer-quote-fig">
          <span className="dealer-quote-fig-label">Lucro</span>
          <strong>{formatSettlement(mesaProfit)}</strong>
        </span>
        <span className="dealer-quote-statuses">
          <span className={`dealer-quote-status status-${status}`}>{STATUS_LABEL[status]}</span>
          {status === 'aberta' && (
            <span className="dealer-quote-remain">{formatRemaining(quote.expiresAt, now)}</span>
          )}
          {status === 'realizada' && (
            <span className={`dealer-quote-status status-${payoutOf(quote) === 'efetivada' ? 'realizada' : 'aberta'}`}>
              {payoutLabel(payoutOf(quote))}
            </span>
          )}
        </span>
        {expanded ? <TbChevronDown /> : <TbChevronRight />}
      </button>
      {expanded && (
      <div className="dealer-quote-detail">
      {quote.note && <p className="dealer-quote-row-time">{quote.note}</p>}
      <PaymentRoute
        quote={quote}
        onClientAddress={onClientAddress}
        onNetwork={onNetwork}
        onHops={onHops}
      />
      {calc && (
        <div className="dealer-quote-xrays">
          <section className="dealer-quote-xray">
            <h5>Cliente</h5>
            <p>
              Envia <strong>{formatMoney(receivedOf(quote).amount, receivedOf(quote).code)}</strong>
              {receivedOf(quote).code !== 'BRL' && <> ({formatBrl(calc.brl)})</>}
            </p>
            <p>
              Recebe <strong>{formatAsset(calc.client, quote.asset)}</strong>
              {' '}na rede {quote.network || 'não informada'}
            </p>
            <p className="dealer-quote-row-time">
              Preço travado {formatRate(calc.usdtRate || quote.rate)} reais por USDT
              {quote.asset !== 'USDT' ? `, ${formatRate(quote.rate)} reais por ${quote.asset}` : ''}
            </p>
          </section>
          <section className="dealer-quote-xray">
            <h5>Divisão</h5>
            <div className="dealer-quote-xray-tools">
              <label>
                Dividir em
                <select
                  value={profitCurrencyOf(quote)}
                  onChange={(e) => onProfitCurrency(e.target.value)}
                >
                  {profitCurrencyChoices(quote.asset).map((choice) => (
                    <option key={choice.id} value={choice.id}>{choice.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Mesa
                <PctField
                  value={quote.mesaPct}
                  ariaLabel="Porcentagem da mesa"
                  onCommit={onMesaPct}
                />
              </label>
              <span className={Math.abs(calc.partsPct - calc.feePct) < 0.0001 ? 'dealer-quote-mesa-ok' : 'dealer-quote-mesa-bad'}>
                Partes {formatPct(calc.partsPct)}
              </span>
              {status === 'realizada' && payoutOf(quote) !== 'efetivada' && (
                <Button size="sm" variant="success" onClick={() => onPayout('efetivada')}>
                  <TbCheck /> Efetivar distribuição
                </Button>
              )}
              {status === 'realizada' && payoutOf(quote) === 'efetivada' && (
                <Button size="sm" variant="outline-secondary" onClick={() => onPayout('a_pagar')}>
                  Deixar a pagar
                </Button>
              )}
              <span className={`dealer-quote-status status-${payoutOf(quote) === 'efetivada' ? 'realizada' : 'aberta'}`}>
                {payoutLabel(payoutOf(quote))}
              </span>
            </div>
          </section>
          {partiesOpen && partyCount > 1 && (
            <div className="dealer-quote-party-tools">
              <Button
                size="sm"
                variant="outline-primary"
                disabled={picked.size < 2}
                title="Soma as partes marcadas numa só"
                onClick={() => onMergeParties(pickedList)}
              >
                Juntar
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={picked.size < 1 || picked.size >= partyCount}
                title="Quem não está marcado fica sem nome"
                onClick={() => onBlankOthers(pickedList)}
              >
                Deletar outros
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={picked.size < 1 || picked.size >= partyCount}
                title="Tira as partes marcadas da mesa"
                onClick={() => onDropFromTotal(pickedList)}
              >
                Retirar do total
              </Button>
            </div>
          )}
          {calc.splits.map((split, index) => {
            const settlement = settlementOf(split, quote);
            const party = quote.parties?.[index];
            const paid = partyPaid(party, quote);
            const partyName = String(party?.name || '').trim();
            const others = snapshotAmounts(split, quote.asset)
              .filter((part) => part.code !== settlement.code);
            return (
              <section
                key={`${quote.id}-x-${index}`}
                className={`dealer-quote-xray${split.mine ? ' mine' : ''}`}
              >
                <div className="dealer-quote-xray-party">
                  {partiesOpen && partyCount > 1 && (
                    <label className="dealer-quote-pick">
                      <input
                        type="checkbox"
                        checked={picked.has(index)}
                        aria-label={`Marcar ${partyName || 'sem nome'}`}
                        onChange={() => togglePick(index)}
                      />
                    </label>
                  )}
                  <PartyNameField
                    value={partyName}
                    placeholder="Sem nome"
                    ariaLabel={`Parte ${index + 1} de ${quote.clientName || 'cotação'}`}
                    title="Nome só desta ordem"
                    onCommit={(name) => onRename(index, name)}
                  />
                  <PctField
                    value={split.pct}
                    ariaLabel={`Percentual de ${split.name}`}
                    onCommit={(pct) => onPartyPct(index, pct)}
                  />
                  <MoneyField
                    amount={settlement.amount}
                    code={settlement.code}
                    ariaLabel={`Valor de ${split.name}`}
                    onCommit={(amount) => {
                      const pct = pctFromAmount(amount, quote);
                      if (pct == null) return;
                      onPartyPct(index, pct);
                    }}
                  />
                  <span>{split.mine ? 'seu' : ''}</span>
                  <label className="dealer-quote-mine">
                    <input
                      type="checkbox"
                      checked={isTerceiroParty(quote.parties?.[index])}
                      onChange={(e) => onPartyTerceiro(index, e.target.checked)}
                    />
                    terceiro
                  </label>
                  {partiesOpen && partyName && (
                    <button
                      type="button"
                      className="dealer-quote-remove"
                      title="Deletar o nome. A parte continua na ordem."
                      aria-label={`Deletar nome de ${partyName}`}
                      onClick={() => onClearName(index)}
                    >
                      <TbX />
                    </button>
                  )}
                </div>
                {others.length > 0 && (
                  <p className="dealer-quote-row-time">{moneyParts(others).map((part) => part.text).join(', ')}</p>
                )}
                {status === 'realizada' && (
                  <div className="dealer-quote-xray-party">
                    <span className={`dealer-quote-status status-${paid ? 'realizada' : 'aberta'}`}>
                      {paid ? 'Pago' : 'A pagar'}
                    </span>
                    <Button
                      size="sm"
                      variant={paid ? 'outline-secondary' : 'success'}
                      onClick={() => onPartyPaid(index, !paid)}
                    >
                      {paid ? 'Deixar a pagar' : 'Pagar'}
                    </Button>
                  </div>
                )}
              </section>
            );
          })}
          {partiesOpen && (
            <button type="button" className="dealer-quote-add" onClick={onAddParty}>
              <TbPlus /> Colocar parte
            </button>
          )}
        </div>
      )}
      <div className="dealer-quote-row-actions">
        {calc && (
          <div className="dealer-quote-action-set">
            <Button size="sm" variant="outline-primary" onClick={() => sendImage('client')} disabled={sharing}>
              <TbShare /> Cotação do cliente
            </Button>
            <Button size="sm" variant="outline-primary" onClick={() => sendImage('mesa')} disabled={sharing}>
              <TbShare /> Cotação da mesa
            </Button>
            <Button size="sm" variant="outline-primary" onClick={() => sendImage('terceiro')} disabled={sharing}>
              <TbShare /> Cotação terceiro
            </Button>
          </div>
        )}
        <div className="dealer-quote-action-set">
          {open && (
            <>
              <Button size="sm" variant="success" onClick={onRealize} disabled={busy}>
                <TbCheck /> Realizado
              </Button>
              <Button size="sm" variant="outline-secondary" onClick={onDecline} disabled={busy}>
                <TbX /> Não realizado
              </Button>
              <Button size="sm" variant="outline-primary" onClick={onRenew} disabled={busy}>
                <TbRefresh /> Renovar ordem
              </Button>
            </>
          )}
          {decided && (
            <Button size="sm" variant="outline-secondary" onClick={onUndo}>
              Desfazer
            </Button>
          )}
          {status === 'renovada' && (
            <span className="dealer-quote-renewed">Substituída por uma ordem nova.</span>
          )}
        </div>
        <button type="button" className="dealer-quote-icon-btn" aria-label="Apagar cotação" title="Apagar cotação" onClick={onRemove}>
          <TbTrash />
        </button>
      </div>
      {shareNote && <p className="dealer-quote-share-note">{shareNote}</p>}
      </div>
      )}
    </article>
  );
}
