import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Button from 'react-bootstrap/Button';
import {
  TbRefresh, TbPlus, TbTrash, TbCheck, TbX, TbReceipt, TbShare,
} from 'react-icons/tb';
import {
  DELIVERY_ASSETS,
  QUOTE_TTL_MS,
  accumulatedProfit,
  assetMeta,
  computeQuote,
  effectiveStatus,
  fetchBinancePrice,
  fetchQuotes,
  formatMoney,
  formatMoneyLabeled,
  loadLocalQuotes,
  moneyMeta,
  parseBrlInput,
  partyPct,
  saveQuotes,
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

export default function QuoteOrdersPanel() {
  const [asset, setAsset] = useState('USDT');
  const [network, setNetwork] = useState(DELIVERY_ASSETS[0].networks[0]);
  const [brlInput, setBrlInput] = useState('');
  const [clientName, setClientName] = useState('');
  const [mesaInput, setMesaInput] = useState('3');
  const [parties, setParties] = useState(() => [{ ...newParty(true), pct: '3' }]);
  const [rate, setRate] = useState(null);
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
  const preview = useMemo(
    () => computeQuote({ brlAmount, rate: rate?.price, parties, mesaPct }),
    [brlAmount, rate, parties, mesaPct],
  );
  const hasMine = parties.some((p) => p.mine);
  const profit = useMemo(() => accumulatedProfit(quotes), [quotes]);
  const mesaDone = useMemo(() => {
    let brl = 0;
    const byAsset = {};
    for (const quote of quotes) {
      if (quote.status !== 'realizada') continue;
      const calc = computeQuote(quote);
      if (!calc) continue;
      brl += calc.brl * calc.feePct / 100;
      const name = quote.asset || 'USDT';
      byAsset[name] = (byAsset[name] || 0) + calc.fee;
    }
    return { brl, byAsset };
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
    clientName: source.clientName.trim(),
    mesaPct: source.mesaPct,
    parties: source.parties.map((p) => ({
      name: String(p.name || '').trim() || 'Sem nome',
      pct: partyPct(p),
      mine: !!p.mine,
    })),
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
      const quote = buildSnapshot(fresh.price, {
        brlAmount, asset, network, clientName, mesaPct, parties,
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
      const next = buildSnapshot(fresh.price, {
        brlAmount: quote.brlAmount,
        asset: quote.asset,
        network: quote.network,
        clientName: quote.clientName || '',
        mesaPct: quote.mesaPct,
        parties: quote.parties,
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

  const visible = quotes.filter((q) => {
    const status = effectiveStatus(q, now);
    if (filter === 'abertas') return status === 'aberta' || status === 'expirada';
    if (filter === 'realizadas') return status === 'realizada';
    return true;
  });

  const profitBits = Object.entries(profit.byAsset);

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
        <span>Lucro acumulado realizado</span>
        <strong>{formatBrl(profit.brl)}</strong>
        {profitBits.length > 0 && (
          <span className="dealer-quote-profit-assets">
            {profitBits.map(([name, amount]) => formatAsset(amount, name)).join(' · ')}
          </span>
        )}
        <span className="dealer-quote-profit-assets">
          Mesa das realizadas {formatBrl(mesaDone.brl)}
          {Object.entries(mesaDone.byAsset).map(([name, amount]) => ` · ${formatAsset(amount, name)}`)}
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
              quote={quote}
              now={now}
              busy={creating}
              onRealize={() => setStatus(quote.id, 'realizada')}
              onDecline={() => setStatus(quote.id, 'nao_realizada')}
              onUndo={() => setStatus(quote.id, 'aberta')}
              onRenew={() => handleRenew(quote)}
              onRemove={() => handleRemove(quote.id)}
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
  return (
    <div className="dealer-quote-preview">
      <div className="dealer-quote-preview-hero">
        <span>Cliente recebe</span>
        <strong>{formatAsset(calc.client, asset)}</strong>
        <span>rede {network} · 1 {moneyMeta(asset).symbol} = {rateLabel}</span>
      </div>
      <table className="dealer-quote-table">
        <tbody>
          <tr>
            <td>Bruto na Binance</td>
            <td>{formatAsset(calc.gross, asset)}</td>
            <td>{formatBrl(calc.brl)}</td>
          </tr>
          <tr>
            <td>Mesa {formatPct(calc.feePct)}</td>
            <td>{formatAsset(calc.fee, asset)}</td>
            <td>{formatBrl(calc.brl * calc.feePct / 100)}</td>
          </tr>
          {calc.splits.map((split, index) => (
            <tr key={`${split.name}-${index}`} className={split.mine ? 'mine' : ''}>
              <td>{split.name} {formatPct(split.pct)}{split.mine ? ' · seu' : ''}</td>
              <td>{formatAsset(split.asset, asset)}</td>
              <td>{formatBrl(split.brl)}</td>
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

function QuoteRow({ quote, now, busy, onRealize, onDecline, onUndo, onRenew, onRemove }) {
  const status = effectiveStatus(quote, now);
  const calc = computeQuote(quote);
  const open = status === 'aberta' || status === 'expirada';
  const decided = status === 'realizada' || status === 'nao_realizada';
  const [shareNote, setShareNote] = useState('');
  const [sharing, setSharing] = useState(false);

  const sendImage = async (kind) => {
    if (!calc) return;
    setSharing(true);
    setShareNote('');
    try {
      const canvas = kind === 'client' ? drawClientSlip(quote, calc) : drawMesaSlip(quote, calc);
      const file = kind === 'client' ? 'proposta-cliente.png' : 'proposta-mesa.png';
      const result = await shareCanvas(canvas, file);
      setShareNote(shareMessage(result, kind === 'client' ? 'do cliente' : 'da mesa'));
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setShareNote(err?.message || 'Não foi possível gerar a imagem.');
    } finally {
      setSharing(false);
    }
  };
  return (
    <article className={`dealer-quote-row status-${status}`}>
      <header>
        <strong>
          {quote.clientName ? `${quote.clientName} · ` : ''}
          {formatBrl(quote.brlAmount)}
        </strong>
        {quote.sourceFile && (
          <span className="dealer-quote-row-time">
            {quote.sourceFile}{quote.sourceSheet ? ` · ${quote.sourceSheet}` : ''}
          </span>
        )}
        <span className={`dealer-quote-status status-${status}`}>{STATUS_LABEL[status]}</span>
        <span className="dealer-quote-row-time">
          {formatWhen(quote.createdAt)}
          {status === 'aberta' ? ` · expira em ${formatRemaining(quote.expiresAt, now)}` : ''}
          {status === 'expirada' ? ' · passou de 1h' : ''}
        </span>
      </header>
      {calc && (
        <p className="dealer-quote-row-delivery">
          Entregar <strong>{formatAsset(calc.client, quote.asset)}</strong> na rede {quote.network || 'não informada'}.
          Snapshot {moneyMeta(quote.asset).symbol}/{moneyMeta('BRL').symbol} {formatRate(quote.rate)}. Mesa {formatPct(calc.feePct)}.
        </p>
      )}
      {quote.note && <p className="dealer-quote-row-time">{quote.note}</p>}
      {calc && (
        <ul className="dealer-quote-row-splits">
          {calc.splits.map((split, index) => (
            <li key={`${split.name}-${index}`} className={split.mine ? 'mine' : ''}>
              {split.name} {formatPct(split.pct)}: {formatAsset(split.asset, quote.asset)}
              {split.mine ? ' (seu)' : ''}
            </li>
          ))}
        </ul>
      )}
      <div className="dealer-quote-row-actions">
        {calc && (
          <>
            <Button size="sm" variant="outline-primary" onClick={() => sendImage('client')} disabled={sharing}>
              <TbShare /> Imagem do cliente
            </Button>
            <Button size="sm" variant="outline-primary" onClick={() => sendImage('mesa')} disabled={sharing}>
              <TbShare /> Imagem da mesa
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
    </article>
  );
}
