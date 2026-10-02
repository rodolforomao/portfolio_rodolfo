import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Button from 'react-bootstrap/Button';
import {
  TbRefresh, TbPlus, TbTrash, TbCheck, TbX, TbReceipt, TbShare,
  TbChevronDown, TbChevronRight,
} from 'react-icons/tb';
import {
  DELIVERY_ASSETS,
  QUOTE_TTL_MS,
  accumulatedProfit,
  assetMeta,
  computeQuote,
  effectiveStatus,
  isTerceiroParty,
  quoteWithoutTerceiro,
  fetchBinancePrice,
  fetchQuotes,
  formatMoney,
  formatMoneyLabeled,
  loadLocalQuotes,
  moneyMeta,
  parseBrlInput,
  partyPct,
  partyProfit,
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

function PartyNameField({ value, onCommit, ariaLabel, title }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      className="dealer-quote-name"
      aria-label={ariaLabel}
      title={title}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const next = text.trim();
        if (next && next !== value) onCommit(next);
        else setText(value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

function moneyLine(amounts) {
  return amounts
    .filter((part) => part.amount != null && Number.isFinite(part.amount))
    .map((part) => (part.code === 'BRL' ? formatBrl(part.amount) : formatAsset(part.amount, part.code)))
    .join(' · ');
}

function formatSettlement(settlement) {
  if (!settlement || settlement.amount == null || !Number.isFinite(settlement.amount)) return '—';
  return settlement.code === 'BRL'
    ? formatBrl(settlement.amount)
    : formatAsset(settlement.amount, settlement.code);
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
  const [brlInput, setBrlInput] = useState('');
  const [clientName, setClientName] = useState('');
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
  const brlAmount = parseBrlInput(brlInput);
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
  });

  const handleCreate = async (event) => {
    event?.preventDefault();
    setFormError('');
    if (!Number.isFinite(brlAmount) || brlAmount <= 0) {
      setFormError('Informe o valor em reais que entra na conta.');
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
      let profitRate = null;
      if (profitCurrency !== 'BRL' && profitCurrency !== 'USDT' && profitCurrency !== asset) {
        profitRate = (await fetchBinancePrice(`${profitCurrency}BRL`)).price;
      }
      const quote = buildSnapshot(fresh.price, {
        brlAmount, asset, network, clientName, mesaPct, parties,
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
      const next = buildSnapshot(fresh.price, {
        brlAmount: quote.brlAmount,
        asset: quote.asset,
        network: quote.network,
        clientName: quote.clientName || '',
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

  const setPartyPct = (id, index, pct) => {
    persist(quotes.map((q) => {
      if (q.id !== id) return q;
      return {
        ...q,
        parties: (q.parties || []).map((p, i) => (i === index ? { ...p, pct } : p)),
      };
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

  return (
    <div className="dealer-quote">
      <div className="dealer-quote-head">
        <h4 className="dealer-opp-title">
          <TbReceipt /> Cotações
        </h4>
        <div className="dealer-quote-rate">
          <span>
            {moneyMeta(asset).symbol} {asset}/{moneyMeta('BRL').symbol} {rate ? formatRate(rate.price) : '—'}
          </span>
          <span className="dealer-quote-rate-meta">
            {rateLoading ? 'lendo Binance…' : rate ? `Binance ${formatWhen(rate.fetchedAt)}` : 'sem preço'}
          </span>
          <button
            type="button"
            className="dealer-quote-icon-btn"
            onClick={() => loadRate(meta.symbol).catch(() => {})}
            title="Atualizar cotação Binance"
          >
            <TbRefresh />
          </button>
        </div>
      </div>

      <p className="dealer-opp-intro">
        A porcentagem da mesa sai do valor convertido na Binance. Os participantes entram e
        saem, e o que sobra se reparte entre eles. A ordem trava o preço por 1 hora. Na ordem
        aberta, um clique gera a imagem da proposta para o cliente ou para a mesa.
      </p>

      {(rateError || formError) && (
        <p className="dealer-placement-error">{formError || rateError}</p>
      )}

      <form className="dealer-quote-form" onSubmit={handleCreate}>
        <div className="dealer-quote-fields">
          <label>
            Reais na conta
            <input
              inputMode="decimal"
              value={brlInput}
              onChange={(e) => setBrlInput(e.target.value)}
              placeholder="100000"
            />
          </label>
            <label>
              Entregar
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
            </label>
          <label>
            Rede
            <select value={network} onChange={(e) => setNetwork(e.target.value)}>
              {meta.networks.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Cliente
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="opcional"
            />
          </label>
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
            <select value={profitCurrency} onChange={(e) => setProfitCurrency(e.target.value)}>
              {profitCurrencyChoices(asset).map((choice) => (
                <option key={choice.id} value={choice.id}>{choice.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className="dealer-quote-add" onClick={splitEvenly}>
            Repartir igualmente
          </button>
          <span className={mesaMatches ? 'dealer-quote-mesa-ok' : 'dealer-quote-mesa-bad'}>
            Participantes {formatPct(partsSum)}
            {mesaMatches ? '' : ` · falta fechar ${formatPct(mesaPct)}`}
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
                aria-label={`Percentual de ${party.name || index + 1}`}
                inputMode="decimal"
                value={party.pct}
                onChange={(e) => changePartyPct(index, e.target.value)}
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
                className="dealer-quote-icon-btn"
                title="Retirar da mesa"
                onClick={() => removeParty(index)}
                disabled={parties.length <= 1}
              >
                <TbTrash />
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
          rateLabel={rate ? `${formatRate(rate.price)} BRL` : 'aguardando Binance'}
        />

        <div className="dealer-quote-submit">
          <Button type="submit" size="sm" disabled={creating || rateLoading || !quotesReady}>
            {creating ? 'Travando preço…' : 'Criar cotação'}
          </Button>
          {preview && (
            <span className="dealer-quote-submit-note">
              Mesa {formatPct(preview.feePct)} do bruto. Vale por 1 hora.
            </span>
          )}
        </div>
      </form>

      <div className="dealer-quote-profit">
        <span>Lucro das partes realizadas</span>
        {partiesProfit.length === 0 ? (
          <strong>{formatBrl(0)}</strong>
        ) : (
          <table className="dealer-quote-table">
            <thead>
              <tr>
                <td>Parte</td>
                <td>Snapshot</td>
              </tr>
            </thead>
            <tbody>
              {partiesProfit.map((row) => {
                const extra = Object.entries(row.byAsset)
                  .map(([code, amount]) => formatAsset(amount, code))
                  .join(' · ');
                const snap = moneyLine(snapshotAmounts({ usdt: row.usdt, brl: row.brl }, null));
                return (
                  <tr key={row.name} className={row.mine ? 'mine' : ''}>
                    <td>
                      <PartyNameField
                        value={row.name}
                        ariaLabel={`Nome da parte ${row.name}`}
                        title="Vale para todas as ordens com este nome"
                        onCommit={(name) => renamePartyEverywhere(row.name, name)}
                      />
                    </td>
                    <td>{extra ? `${snap} · ${extra}` : snap}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <span className="dealer-quote-profit-assets">
          Seu lucro {moneyLine(mineBits)}
          {Object.entries(profit.byAsset).map(([code, amount]) => ` · ${formatAsset(amount, code)}`)}
        </span>
        <span className="dealer-quote-profit-assets">
          A pagar {moneyLine(snapshotAmounts(payouts.a_pagar, null))}
          {Object.entries(payouts.a_pagar.byAsset).map(([code, amount]) => ` · ${formatAsset(amount, code)}`)}
          {' · '}
          Efetivado {moneyLine(snapshotAmounts(payouts.efetivada, null))}
          {Object.entries(payouts.efetivada.byAsset).map(([code, amount]) => ` · ${formatAsset(amount, code)}`)}
        </span>
        <span className="dealer-quote-profit-assets">
          Mesa das realizadas {moneyLine(mesaBits)}
          {Object.entries(mesaDone.byAsset).map(([code, amount]) => ` · ${formatAsset(amount, code)}`)}
        </span>
      </div>

      <div className="dealer-quote-filters">
        {[
          ['abertas', 'Abertas'],
          ['realizadas', 'Realizadas'],
          ['todas', 'Todas'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`dealer-opp-view-tab${filter === id ? ' active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="dealer-empty">Nenhuma cotação nesta lista.</p>
      ) : (
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
              onPayout={(status) => patchQuote(quote.id, { payoutStatus: status })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuoteMath({ calc, asset, network, rateLabel }) {
  if (!calc) {
    return (
      <p className="dealer-quote-preview-empty">
        Informe o valor em reais para ver quanto o cliente recebe e quanto fica para cada um.
      </p>
    );
  }
  const other = asset !== 'USDT';
  return (
    <div className="dealer-quote-preview">
      <div className="dealer-quote-preview-hero">
        <span>Cliente recebe</span>
        <strong>{formatAsset(calc.client, asset)}</strong>
        <span>rede {network} · 1 {moneyMeta(asset).symbol} = {rateLabel}</span>
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
              <td>{split.name} {formatPct(split.pct)}{split.mine ? ' · seu' : ''}</td>
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

function shareMessage(result, who) {
  if (result === 'shared') return `Escolha onde enviar a imagem ${who}.`;
  if (result === 'copied') return `Imagem ${who} copiada. Cole na conversa.`;
  return `Imagem ${who} baixada. Envie o arquivo.`;
}

function QuoteRow({
  number, quote, now, busy, onRealize, onDecline, onUndo, onRenew, onRemove, onRename,
  onPartyPct, onMesaPct, onProfitCurrency, onPayout, onPartyTerceiro,
}) {
  const status = effectiveStatus(quote, now);
  const calc = computeQuote(quote);
  const open = status === 'aberta' || status === 'expirada';
  const decided = status === 'realizada' || status === 'nao_realizada';
  const [expanded, setExpanded] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [sharing, setSharing] = useState(false);
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
  return (
    <article className={`dealer-quote-row status-${status}${expanded ? ' open' : ''}`}>
      <button
        type="button"
        className="dealer-quote-summary"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="dealer-quote-num">#{number}</span>
        {quote.clientName && <strong>{quote.clientName}</strong>}
        <span className="dealer-quote-summary-item">
          Total <strong>{formatBrl(quote.brlAmount)}</strong>
        </span>
        <span className="dealer-quote-summary-item">
          Mesa <strong>{calc ? formatBrl(calc.feeBrl) : '—'}</strong>
          {calc ? ` ${formatPct(calc.feePct)}` : ''}
        </span>
        <span className="dealer-quote-summary-item">
          Lucro <strong>{formatSettlement(mesaProfit)}</strong>
        </span>
        <span className={`dealer-quote-status status-${status}`}>{STATUS_LABEL[status]}</span>
        {status === 'realizada' && (
          <span className={`dealer-quote-status status-${payoutOf(quote) === 'efetivada' ? 'realizada' : 'aberta'}`}>
            {payoutOf(quote) === 'efetivada' ? 'Efetivada' : 'A pagar'}
          </span>
        )}
        {expanded ? <TbChevronDown /> : <TbChevronRight />}
      </button>
      {expanded && (
      <>
      {calc && (
        <p className="dealer-quote-row-delivery">
          Entregar <strong>{formatAsset(calc.client, quote.asset)}</strong> na rede {quote.network || 'não informada'}.
          {' '}Snapshot ₮/R$ {formatRate(calc.usdtRate || quote.rate)}
          {quote.asset !== 'USDT' ? ` · ${moneyMeta(quote.asset).symbol}/R$ ${formatRate(quote.rate)}` : ''}.
          {' '}Mesa {formatPct(calc.feePct)}.
        </p>
      )}
      {quote.note && <p className="dealer-quote-row-time">{quote.note}</p>}
      {calc && (
        <div className="dealer-quote-xrays">
          <section className="dealer-quote-xray">
            <h5>Raio-x do cliente</h5>
            <p>Envia <strong>{formatBrl(calc.brl)}</strong></p>
            <p>
              Recebe <strong>{formatAsset(calc.client, quote.asset)}</strong>
              {' '}na rede {quote.network || 'não informada'}
            </p>
            <p className="dealer-quote-row-time">
              Snapshot ₮/R$ {formatRate(calc.usdtRate || quote.rate)}
              {quote.asset !== 'USDT' ? ` · ${moneyMeta(quote.asset).symbol}/R$ ${formatRate(quote.rate)}` : ''}
            </p>
          </section>
          <section className="dealer-quote-xray">
            <h5>Raio-x da divisão</h5>
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
              {status === 'realizada' && (
                payoutOf(quote) === 'efetivada' ? (
                  <Button size="sm" variant="outline-secondary" onClick={() => onPayout('a_pagar')}>
                    Deixar a pagar
                  </Button>
                ) : (
                  <Button size="sm" variant="success" onClick={() => onPayout('efetivada')}>
                    <TbCheck /> Efetivar distribuição
                  </Button>
                )
              )}
              <span className={`dealer-quote-status status-${payoutOf(quote) === 'efetivada' ? 'realizada' : 'aberta'}`}>
                {payoutOf(quote) === 'efetivada' ? 'Efetivada' : 'A pagar'}
              </span>
            </div>
          </section>
          {calc.splits.map((split, index) => {
            const settlement = settlementOf(split, quote);
            const others = snapshotAmounts(split, quote.asset)
              .filter((part) => part.code !== settlement.code);
            return (
              <section
                key={`${quote.id}-x-${index}`}
                className={`dealer-quote-xray${split.mine ? ' mine' : ''}`}
              >
                <h5>Raio-x da parte</h5>
                <div className="dealer-quote-xray-party">
                  <PartyNameField
                    value={split.name}
                    ariaLabel={`Parte ${index + 1} de ${quote.clientName || 'cotação'}`}
                    title="Nome só desta ordem"
                    onCommit={(name) => onRename(index, name)}
                  />
                  <PctField
                    value={split.pct}
                    ariaLabel={`Percentual de ${split.name}`}
                    onCommit={(pct) => onPartyPct(index, pct)}
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
                </div>
                <p>
                  <strong>{formatSettlement(settlement)}</strong>
                  {others.length > 0 && (
                    <span className="dealer-quote-row-time"> · {moneyLine(others)}</span>
                  )}
                </p>
              </section>
            );
          })}
        </div>
      )}
      <div className="dealer-quote-row-actions">
        {calc && (
          <>
            <Button size="sm" variant="outline-primary" onClick={() => sendImage('client')} disabled={sharing}>
              <TbShare /> Cotação do cliente
            </Button>
            <Button size="sm" variant="outline-primary" onClick={() => sendImage('mesa')} disabled={sharing}>
              <TbShare /> Cotação da mesa
            </Button>
            <Button size="sm" variant="outline-primary" onClick={() => sendImage('terceiro')} disabled={sharing}>
              <TbShare /> Cotação terceiro
            </Button>
          </>
        )}
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
        <button type="button" className="dealer-quote-icon-btn" title="Apagar cotação" onClick={onRemove}>
          <TbTrash />
        </button>
      </div>
      {shareNote && <p className="dealer-quote-share-note">{shareNote}</p>}
      </>
      )}
    </article>
  );
}
