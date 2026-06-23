import React, { useState, useMemo, useRef, useEffect } from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Badge from 'react-bootstrap/Badge';
import {
  TbPlayerPlay, TbPlayerStop, TbTarget, TbCheck, TbAlertTriangle,
  TbRocket, TbSettings, TbLock, TbCalculator, TbArrowRight, TbWallet,
  TbListDetails, TbActivity, TbChartLine, TbFlask,
} from 'react-icons/tb';
import { parsePercentInput } from './PriceFields';
import { normalizeBalances, formatAssetBalance, canonicalAssetName } from './utils/dealerFormat';
import { prepareDealerOrders } from './utils/orderMarketNormalize';
import DealerStatusBadge from './DealerStatusBadge';
import { sortBookSide, formatBookPrice } from './utils/sideswapBook';

/* ─── Constantes ─────────────────────────────────────────────────────────── */

const CALC_ASSETS = ['L-BTC', 'USDt', 'DePix'];
const BOOK_ROWS = 6;

const CANONICAL_PAIRS_LABELS = [
  { base: 'L-BTC', quote: 'USDt' },
  { base: 'L-BTC', quote: 'DePix' },
  { base: 'USDt', quote: 'DePix' },
];

// Pares gerenciados pela estratégia (Motor 1 + Motor 3)
const STRATEGY_PAIR_KEYS = new Set(['L-BTC|USDt', 'USDt|DePix', 'L-BTC|DePix']);

const PHASES = [
  {
    id: 'fase0',
    label: 'Fase 0',
    subtitle: 'Piloto',
    capital: 'R$ 2–5k',
    priceMin: '0,50',
    objective: 'Calibrar, não lucrar. Coletar fills reais.',
    criteria: 'Avançar após 30 dias com P&L marcado a mercado positivo.',
    belowThreshold: '1,0–1,2%',
    color: '#8b949e',
  },
  {
    id: 'fase1',
    label: 'Fase 1',
    subtitle: 'Validada',
    capital: 'R$ 10k',
    priceMin: '0,40',
    objective: 'Escalar com dados reais. Adicionar below-market.',
    criteria: 'Avançar após 60 dias com drawdown mensal < 3%.',
    belowThreshold: '0,8–1,0%',
    color: '#c770f0',
  },
  {
    id: 'fase2',
    label: 'Fase 2',
    subtitle: 'Plena',
    capital: 'R$ 20k+',
    priceMin: '0,40',
    objective: 'Capital completo. Todos os motores ativos.',
    criteria: 'Multi-PID. Rebalanceamento via BTSE quando USDt > 65%.',
    belowThreshold: '0,8%',
    color: '#3fb950',
  },
];

/* ─── Utilitários ────────────────────────────────────────────────────────── */

function pairKey(base, quote) {
  return `${canonicalAssetName(base)}|${canonicalAssetName(quote)}`;
}

function isStrategyOrder(order) {
  return STRATEGY_PAIR_KEYS.has(pairKey(order.base, order.quote));
}

function classifyOrders(dealer) {
  const { orders } = prepareDealerOrders(dealer?.orders || []);

  const motor1 = orders.filter(
    (o) => canonicalAssetName(o.base) === 'L-BTC' && canonicalAssetName(o.quote) === 'USDt',
  );
  const motor3 = orders.filter(
    (o) => canonicalAssetName(o.quote) === 'DePix',
  );
  const other = orders.filter((o) => !isStrategyOrder(o));

  const motor1Buy = motor1.filter((o) => o.trade_dir === 'Buy');
  const motor1Sell = motor1.filter((o) => o.trade_dir === 'Sell');
  const motor1State = motor1Buy.length && motor1Sell.length
    ? 'both' : motor1Buy.length || motor1Sell.length
      ? 'partial' : 'none';

  const balances = normalizeBalances(dealer?.balances);
  const depix = balances.find((b) => b.asset === 'DePix')?.value || 0;
  const usdt = balances.find((b) => b.asset === 'USDt')?.value || 0;
  const lbtc = balances.find((b) => b.asset === 'L-BTC')?.value || 0;
  const hasDepixExit = motor3.length > 0;

  return {
    motor1, motor1Buy, motor1Sell, motor1State,
    motor3, other,
    depix, usdt, lbtc, hasDepixExit,
  };
}

/* ─── Utilitários Calculadora ────────────────────────────────────────────── */

function getIndPrice(scanPairs, scanIndPrices, base, quote) {
  if (!scanPairs?.length || !scanIndPrices) return null;
  const pair = scanPairs.find(
    (p) => canonicalAssetName(p.base) === canonicalAssetName(base)
      && canonicalAssetName(p.quote) === canonicalAssetName(quote),
  );
  if (!pair) return null;
  return scanIndPrices[pair.key]?.indPrice ?? null;
}

function convertAmount(amount, fromAsset, toAsset, scanPairs, scanIndPrices) {
  if (!amount || !Number.isFinite(amount) || amount <= 0) return null;
  if (fromAsset === toAsset) return amount;
  const direct = getIndPrice(scanPairs, scanIndPrices, fromAsset, toAsset);
  if (direct != null && direct > 0) return amount * direct;
  const inverted = getIndPrice(scanPairs, scanIndPrices, toAsset, fromAsset);
  if (inverted != null && inverted > 0) return amount / inverted;
  return null;
}

function formatCalcValue(asset, value) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (canonicalAssetName(asset) === 'L-BTC') {
    const sats = Math.round(value * 1e8);
    if (sats < 1000) return `${sats.toLocaleString('pt-BR')} sats`;
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })} L-BTC`;
  }
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRate(fromAsset, toAsset, scanPairs, scanIndPrices) {
  const direct = getIndPrice(scanPairs, scanIndPrices, fromAsset, toAsset);
  if (direct != null && direct > 0) return `1 ${fromAsset} = ${formatCalcValue(toAsset, direct)} ${toAsset}`;
  const inverted = getIndPrice(scanPairs, scanIndPrices, toAsset, fromAsset);
  if (inverted != null && inverted > 0) return `1 ${fromAsset} = ${formatCalcValue(toAsset, 1 / inverted)} ${toAsset}`;
  return null;
}

function parseCalcInput(raw) {
  if (!raw?.trim()) return null;
  const n = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ─── Utilitários Order Book ─────────────────────────────────────────────── */

function getPairBook(scanPairs, scanBooks, base, quote) {
  const pair = (scanPairs || []).find(
    (p) => canonicalAssetName(p.base) === canonicalAssetName(base)
      && canonicalAssetName(p.quote) === canonicalAssetName(quote),
  );
  return pair ? ((scanBooks || {})[pair.key] || []) : [];
}

function getPairIndPrice(scanPairs, scanIndPrices, base, quote) {
  const pair = (scanPairs || []).find(
    (p) => canonicalAssetName(p.base) === canonicalAssetName(base)
      && canonicalAssetName(p.quote) === canonicalAssetName(quote),
  );
  return pair ? ((scanIndPrices || {})[pair.key]?.indPrice ?? null) : null;
}

/* ─── Sub-componentes ────────────────────────────────────────────────────── */

function MotorDot({ status, size = 8 }) {
  return (
    <span
      className={`strategy-motor-dot strategy-motor-dot-${status}`}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

function DealerStrategyChip({ dealer, selected, activatedHere, onClick }) {
  return (
    <button
      type="button"
      className={`strategy-dealer-card${selected ? ' selected' : ''}${activatedHere ? ' running' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div className="strategy-dealer-card-head">
        <div className="strategy-dealer-card-id">
          <span
            className="strategy-dealer-card-indicator"
            style={{ background: activatedHere ? '#3fb950' : '#6e7681' }}
            title={activatedHere ? 'Ativado nesta sessão' : 'Não ativado'}
          />
          <strong>PID {dealer.pid}</strong>
          <span className="strategy-dealer-card-wallet">{dealer.wallet_name || '—'}</span>
        </div>
        <DealerStatusBadge dealer={dealer} />
      </div>
      {activatedHere && (
        <div className="strategy-dealer-card-selected-label">ativado nesta sessão</div>
      )}
      {selected && !activatedHere && (
        <div className="strategy-dealer-card-selected-label" style={{ color: '#c770f0' }}>selecionado</div>
      )}
    </button>
  );
}

function InventoryRow({ lbtc, usdt, depix }) {
  return (
    <div className="strategy-inventory">
      <span className="strategy-inv-label"><TbWallet size={12} /> Inventário</span>
      <div className="strategy-inv-chips">
        <span className="strategy-inv-chip lbtc">
          {formatAssetBalance('L-BTC', lbtc)}
        </span>
        <span className="strategy-inv-chip usdt">
          {usdt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDt
        </span>
        {depix > 0 && (
          <span className="strategy-inv-chip depix">
            {depix.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DePix
          </span>
        )}
      </div>
    </div>
  );
}

function OtherOrdersList({ orders }) {
  if (!orders.length) return null;
  return (
    <div className="strategy-other-orders">
      <div className="strategy-other-orders-title">
        <TbListDetails size={13} />
        {' '}Outras ordens ({orders.length})
        <span className="strategy-other-orders-hint"> — fora da estratégia, não gerenciadas</span>
      </div>
      <div className="strategy-other-orders-list">
        {orders.map((o, i) => (
          <div key={o.order_id || `other-${i}`} className="strategy-other-order-row">
            <span className={`strategy-other-order-dir ${o.trade_dir?.toLowerCase()}`}>
              {o.trade_dir === 'Buy' ? 'C' : 'V'}
            </span>
            <span className="strategy-other-order-pair">
              {canonicalAssetName(o.base)}/{canonicalAssetName(o.quote)}
            </span>
            {o.price != null && (
              <span className="strategy-other-order-price">{formatBookPrice(o.price)}</span>
            )}
            {o.order_id && (
              <code className="strategy-other-order-id">#{o.order_id}</code>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SwapCalculator({ scanPairs, scanIndPrices }) {
  const [fromAsset, setFromAsset] = useState('USDt');
  const [rawAmount, setRawAmount] = useState('');
  const amount = useMemo(() => parseCalcInput(rawAmount), [rawAmount]);
  const hasData = scanPairs?.length > 0 && scanIndPrices && Object.keys(scanIndPrices).length > 0;
  const targets = CALC_ASSETS.filter((a) => a !== fromAsset);

  return (
    <div className="strategy-calc">
      <div className="strategy-calc-title">
        <TbCalculator size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
        Calculadora de Conversão
      </div>
      <div className="strategy-calc-row">
        <div className="strategy-calc-asset-btns">
          {CALC_ASSETS.map((a) => (
            <button
              key={a}
              type="button"
              className={`strategy-calc-asset-btn${fromAsset === a ? ' active' : ''}`}
              onClick={() => setFromAsset(a)}
            >
              {a}
            </button>
          ))}
        </div>
        <Form.Control
          size="sm"
          className="strategy-calc-input"
          placeholder="0,00"
          value={rawAmount}
          onChange={(e) => setRawAmount(e.target.value)}
        />
      </div>
      {!hasData ? (
        <div className="strategy-calc-no-data">Aguardando dados SideSwap…</div>
      ) : (
        <div className="strategy-calc-results">
          {targets.map((to) => {
            const converted = convertAmount(amount, fromAsset, to, scanPairs, scanIndPrices);
            const rate = formatRate(fromAsset, to, scanPairs, scanIndPrices);
            return (
              <div key={to} className="strategy-calc-result-row">
                <div className="strategy-calc-result-label">
                  <span>{fromAsset}</span>
                  <TbArrowRight size={12} className="strategy-calc-result-arrow" />
                  <span>{to}</span>
                </div>
                <div>
                  <div className={`strategy-calc-result-value${amount == null ? ' loading' : ''}`}>
                    {amount == null ? '—' : formatCalcValue(to, converted)}
                  </div>
                  {rate && <div className="strategy-calc-rate">{rate}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function spreadPct(price, indPrice, side) {
  if (!price || !indPrice || indPrice <= 0) return null;
  return side === 'Sell'
    ? ((price - indPrice) / indPrice) * 100
    : ((indPrice - price) / indPrice) * 100;
}

function SpreadBadge({ pct }) {
  if (pct == null) return null;
  const cls = pct < 0.5 ? 'pct-tight' : pct >= 1 ? 'pct-wide' : 'pct-ok';
  return <span className={`strategy-book-pct ${cls}`}>{pct.toFixed(2)}%</span>;
}

function BookRow({ o, idx, side, myConfirmedIds, indPrice }) {
  const confirmed = myConfirmedIds.has(String(o.order_id));
  const pct = spreadPct(o.price, indPrice, side);
  const isSell = side === 'Sell';
  return (
    <div className={[
      'strategy-book-row',
      isSell ? 'sell' : 'buy',
      idx === 0 ? 'best' : '',
      confirmed ? 'mine confirmed' : '',
    ].filter(Boolean).join(' ')}>
      {isSell ? (
        <>
          <span className="strategy-book-rank">{confirmed ? '●' : `#${idx + 1}`}</span>
          <span className="strategy-book-price">{formatBookPrice(o.price)}</span>
          <SpreadBadge pct={pct} />
        </>
      ) : (
        <>
          <SpreadBadge pct={pct} />
          <span className="strategy-book-price">{formatBookPrice(o.price)}</span>
          <span className="strategy-book-rank">{confirmed ? '●' : `#${idx + 1}`}</span>
        </>
      )}
    </div>
  );
}

function PendingRow({ o, side, indPrice }) {
  const isSell = side === 'Sell';
  const priceLabel = o.price ? formatBookPrice(o.price) : 'follow';
  const pct = spreadPct(o.price, indPrice, side);
  const pctCls = pct == null ? 'pct-pending' : pct < 0.5 ? 'pct-tight' : pct >= 1 ? 'pct-wide' : 'pct-ok';
  const pctLabel = pct != null ? `${pct.toFixed(2)}%` : '···';
  return (
    <div className={`strategy-book-row ${isSell ? 'sell' : 'buy'} mine pending`}>
      {isSell ? (
        <>
          <span className="strategy-book-rank strategy-book-rank-pending">●</span>
          <span className="strategy-book-price">{priceLabel}</span>
          <span className={`strategy-book-pct ${pctCls}`}>{pctLabel}</span>
        </>
      ) : (
        <>
          <span className={`strategy-book-pct ${pctCls}`}>{pctLabel}</span>
          <span className="strategy-book-price">{priceLabel}</span>
          <span className="strategy-book-rank strategy-book-rank-pending">●</span>
        </>
      )}
    </div>
  );
}

// Insere pendentes na posição correta do livro ordenado.
// Sell side: ascending (menor = melhor). Buy side: descending (maior = melhor).
// Pendentes sem price ficam no topo (follow_target sem preço fixo ainda).
function mergePending(bookOrders, pendingOrders, tradeDir) {
  const isSell = tradeDir === 'Sell';
  // Pendentes com preço conhecido → inserir na posição correta
  // Pendentes sem preço → empilhar no topo
  const withPrice = pendingOrders.filter((o) => o.price != null && Number.isFinite(Number(o.price)));
  const withoutPrice = pendingOrders.filter((o) => !o.price || !Number.isFinite(Number(o.price)));

  // base já está ordenada (BOOK_ROWS itens)
  const base = [...bookOrders];

  withPrice.forEach((pending) => {
    const price = Number(pending.price);
    const entry = { ...pending, _pending: true };
    const idx = isSell
      ? base.findIndex((o) => !o._pending && Number(o.price) >= price)
      : base.findIndex((o) => !o._pending && Number(o.price) <= price);
    if (idx === -1) base.push(entry);
    else base.splice(idx, 0, entry);
  });

  // sem preço ficam no topo
  const noPriceEntries = withoutPrice.map((o) => ({ ...o, _pending: true }));
  return [...noPriceEntries, ...base];
}

function OrderBookSection({ scanPairs, scanBooks, scanIndPrices, allStrategyOrders = [] }) {
  const [activePair, setActivePair] = useState(0);
  const { base, quote } = CANONICAL_PAIRS_LABELS[activePair];

  const book = useMemo(
    () => getPairBook(scanPairs, scanBooks, base, quote),
    [scanPairs, scanBooks, base, quote],
  );
  const indPrice = useMemo(
    () => getPairIndPrice(scanPairs, scanIndPrices, base, quote),
    [scanPairs, scanIndPrices, base, quote],
  );

  const pairOrders = useMemo(
    () => allStrategyOrders.filter(
      (o) => canonicalAssetName(o.base) === canonicalAssetName(base)
        && canonicalAssetName(o.quote) === canonicalAssetName(quote),
    ),
    [allStrategyOrders, base, quote],
  );

  const myConfirmedIds = useMemo(
    () => new Set(pairOrders.filter((o) => o.order_id).map((o) => String(o.order_id))),
    [pairOrders],
  );

  const pendingSells = useMemo(
    () => pairOrders.filter((o) => !o.order_id && o.trade_dir === 'Sell'),
    [pairOrders],
  );
  const pendingBuys = useMemo(
    () => pairOrders.filter((o) => !o.order_id && o.trade_dir === 'Buy'),
    [pairOrders],
  );

  // Livro base ordenado (apenas confirmados)
  const rawSells = useMemo(() => sortBookSide(book, 'Sell').slice(0, BOOK_ROWS), [book]);
  const rawBuys = useMemo(() => sortBookSide(book, 'Buy').slice(0, BOOK_ROWS), [book]);

  // Merge: pendentes inseridos na posição correta pelo preço
  const sells = useMemo(() => mergePending(rawSells, pendingSells, 'Sell'), [rawSells, pendingSells]);
  const buys = useMemo(() => mergePending(rawBuys, pendingBuys, 'Buy'), [rawBuys, pendingBuys]);

  const topSpread = useMemo(() => {
    const bs = rawSells[0]?.price;
    const bb = rawBuys[0]?.price;
    if (!bs || !bb || bb <= 0) return null;
    return ((bs - bb) / bb) * 100;
  }, [rawSells, rawBuys]);

  const maxRange = useMemo(() => {
    const ws = rawSells[rawSells.length - 1]?.price;
    const wb = rawBuys[rawBuys.length - 1]?.price;
    if (!ws || !wb || wb <= 0) return null;
    return ((ws - wb) / wb) * 100;
  }, [rawSells, rawBuys]);

  const hasMine = myConfirmedIds.size > 0 || pendingBuys.length > 0 || pendingSells.length > 0;

  // Rank real: conta apenas ordens confirmadas (não pendentes) acima
  function realRank(mergedList, currentIdx) {
    let rank = 0;
    for (let i = 0; i <= currentIdx; i++) {
      if (!mergedList[i]._pending) rank++;
    }
    return rank;
  }

  return (
    <div className="strategy-book">
      <div className="strategy-book-header">
        <div className="strategy-book-title">Order Book</div>
        <div className="strategy-book-pair-tabs">
          {CANONICAL_PAIRS_LABELS.map((p, i) => (
            <button
              key={`${p.base}/${p.quote}`}
              type="button"
              className={`strategy-book-tab${activePair === i ? ' active' : ''}`}
              onClick={() => setActivePair(i)}
            >
              {p.base}/{p.quote}
            </button>
          ))}
        </div>
      </div>

      {book.length === 0 ? (
        <div className="strategy-book-nodata">Aguardando dados SideSwap…</div>
      ) : (
        <>
          <div className="strategy-book-grid">
            {/* Sell side */}
            <div className="strategy-book-col">
              <div className="strategy-book-col-header sell">
                <span>Venda</span>
                <span className="strategy-book-col-subhdr">spread</span>
              </div>
              {sells.length === 0
                ? <div className="strategy-book-empty">—</div>
                : sells.map((o, idx) => o._pending
                  ? <PendingRow key={`ps-${idx}`} o={o} side="Sell" indPrice={indPrice} />
                  : (
                    <BookRow
                      key={o.order_id}
                      o={o}
                      idx={realRank(sells, idx) - 1}
                      side="Sell"
                      myConfirmedIds={myConfirmedIds}
                      indPrice={indPrice}
                    />
                  ))}
            </div>

            {/* Buy side */}
            <div className="strategy-book-col">
              <div className="strategy-book-col-header buy">
                <span className="strategy-book-col-subhdr">spread</span>
                <span>Compra</span>
              </div>
              {buys.length === 0
                ? <div className="strategy-book-empty">—</div>
                : buys.map((o, idx) => o._pending
                  ? <PendingRow key={`pb-${idx}`} o={o} side="Buy" indPrice={indPrice} />
                  : (
                    <BookRow
                      key={o.order_id}
                      o={o}
                      idx={realRank(buys, idx) - 1}
                      side="Buy"
                      myConfirmedIds={myConfirmedIds}
                      indPrice={indPrice}
                    />
                  ))}
            </div>
          </div>

          <div className="strategy-book-footer">
            {indPrice != null && (
              <span className="strategy-book-ind">
                ind: <strong>{formatBookPrice(indPrice)}</strong>
              </span>
            )}
            {topSpread != null && (
              <span className={`strategy-book-spread${topSpread >= 1 ? ' spread-highlight' : ''}`}>
                spread topo: <strong>{topSpread.toFixed(2)}%</strong>
              </span>
            )}
            {maxRange != null && maxRange > (topSpread ?? 0) + 0.1 && (
              <span className="strategy-book-spread spread-range">
                range: <strong>{maxRange.toFixed(2)}%</strong>
              </span>
            )}
            {hasMine && (
              <span className="strategy-book-mine-legend">
                ● confirmada &nbsp;··· pendente
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Monitor + Simulador ─────────────────────────────────────────────────── */

// Rastreia adições/remoções do livro público e mudanças de last_price como proxy de fills.
function useBookActivity(scanBooks, scanIndPrices) {
  const prevBooksRef = useRef({});
  const prevLastPriceRef = useRef({});
  const eventsRef = useRef([]);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const now = Date.now();
    let changed = false;

    if (scanBooks && typeof scanBooks === 'object') {
      for (const [key, orders] of Object.entries(scanBooks)) {
        const prev = prevBooksRef.current[key] || [];
        const prevIds = new Set(prev.map((o) => String(o.order_id)));
        const currIds = new Set((orders || []).map((o) => String(o.order_id)));
        const adds = (orders || []).filter((o) => !prevIds.has(String(o.order_id))).length;
        const removes = prev.filter((o) => !currIds.has(String(o.order_id))).length;
        if (adds) { eventsRef.current.push({ ts: now, type: 'add', pair: key, n: adds }); changed = true; }
        if (removes) { eventsRef.current.push({ ts: now, type: 'rm', pair: key, n: removes }); changed = true; }
      }
      prevBooksRef.current = scanBooks;
    }

    if (scanIndPrices && typeof scanIndPrices === 'object') {
      for (const [key, data] of Object.entries(scanIndPrices)) {
        const prev = prevLastPriceRef.current[key];
        const cur = data?.lastPrice;
        if (prev !== undefined && cur != null && cur !== prev) {
          eventsRef.current.push({ ts: now, type: 'fill', pair: key, price: cur });
          changed = true;
        }
        prevLastPriceRef.current[key] = cur;
      }
    }

    const cutoff = now - 30 * 60 * 1000;
    eventsRef.current = eventsRef.current.filter((e) => e.ts > cutoff);
    if (changed) forceRender((n) => n + 1);
  }, [scanBooks, scanIndPrices]);

  function windowStats(windowMs = 5 * 60 * 1000) {
    const cutoff = Date.now() - windowMs;
    const recent = eventsRef.current.filter((e) => e.ts > cutoff);
    return {
      adds: recent.filter((e) => e.type === 'add').reduce((s, e) => s + e.n, 0),
      removes: recent.filter((e) => e.type === 'rm').reduce((s, e) => s + e.n, 0),
      fills: recent.filter((e) => e.type === 'fill').length,
    };
  }

  return { windowStats };
}

// Simula posição no livro para um dado price_min% e ind_price.
function simulatePosition(book, side, pricePct, indPrice) {
  if (!indPrice || indPrice <= 0 || pricePct == null) return null;
  const simPrice = side === 'Sell'
    ? indPrice * (1 + pricePct / 100)
    : indPrice * (1 - pricePct / 100);
  const sorted = sortBookSide(book, side);
  const betterCount = side === 'Sell'
    ? sorted.filter((o) => Number(o.price) < simPrice).length
    : sorted.filter((o) => Number(o.price) > simPrice).length;
  return { position: betterCount + 1, total: sorted.length, simPrice };
}

function PositionPill({ position, total, found }) {
  if (!found || position == null) return <span className="monitor-pos-pill unknown">—</span>;
  const cls = position === 1 ? 'top' : position <= 3 ? 'mid' : 'low';
  return (
    <span className={`monitor-pos-pill ${cls}`}>
      #{position}<span className="monitor-pos-of"> de {total}</span>
    </span>
  );
}

function MonitorSection({
  dealers, selectedPid, bookPlacements = [],
  scanPairs, scanBooks, scanIndPrices, currentPhasePm, activity,
}) {
  const dealer = dealers.find((d) => d.pid === selectedPid) || null;
  const txSummary = dealer?.transactions_summary || {};
  const swapCount = txSummary.swap_count ?? 0;
  const profitPct = txSummary.total_profit_percent;

  // Posições confirmadas Motor 1 (L-BTC/USDt)
  const m1Sell = useMemo(() => bookPlacements.find((p) => {
    const b = canonicalAssetName(p.order?.base);
    const q = canonicalAssetName(p.order?.quote);
    const dir = p.order?.trade_dir;
    return ((b === 'L-BTC' && q === 'USDt') || (b === 'USDt' && q === 'L-BTC'))
      && dir === 'Sell';
  }), [bookPlacements]);

  const m1Buy = useMemo(() => bookPlacements.find((p) => {
    const b = canonicalAssetName(p.order?.base);
    const q = canonicalAssetName(p.order?.quote);
    const dir = p.order?.trade_dir;
    return ((b === 'L-BTC' && q === 'USDt') || (b === 'USDt' && q === 'L-BTC'))
      && dir === 'Buy';
  }), [bookPlacements]);

  const lbtcBook = useMemo(() => getPairBook(scanPairs, scanBooks, 'L-BTC', 'USDt'), [scanPairs, scanBooks]);
  const lbtcInd = useMemo(() => getPairIndPrice(scanPairs, scanIndPrices, 'L-BTC', 'USDt'), [scanPairs, scanIndPrices]);

  const topSellSpread = useMemo(() => {
    const s = sortBookSide(lbtcBook, 'Sell');
    return s[0] && lbtcInd ? spreadPct(s[0].price, lbtcInd, 'Sell') : null;
  }, [lbtcBook, lbtcInd]);
  const topBuySpread = useMemo(() => {
    const b = sortBookSide(lbtcBook, 'Buy');
    return b[0] && lbtcInd ? spreadPct(b[0].price, lbtcInd, 'Buy') : null;
  }, [lbtcBook, lbtcInd]);

  const pmVal = parseFloat(String(currentPhasePm).replace(',', '.')) || 0;
  const sellBlocked = topSellSpread != null && pmVal > topSellSpread;
  const buyBlocked = topBuySpread != null && pmVal > topBuySpread;

  const stats = activity.windowStats(5 * 60 * 1000);

  const bothFound = m1Sell?.found && m1Buy?.found;
  const health = !dealer ? 'idle'
    : !bothFound ? 'warn'
    : (m1Sell?.position === 1 && m1Buy?.position === 1) ? 'good'
    : ((m1Sell?.position || 99) <= 3 && (m1Buy?.position || 99) <= 3) ? 'ok'
    : 'bad';

  const healthLabel = {
    good: '● posição #1',
    ok: '● no livro',
    warn: '⚠ fora do livro',
    bad: '⚠ posição ruim',
    idle: '○ sem dealer',
  }[health];

  return (
    <div className="strategy-monitor">
      <div className="strategy-monitor-header">
        <TbActivity size={15} />
        <span className="strategy-monitor-title">Monitoramento em tempo real</span>
        <span className={`strategy-monitor-health health-${health}`}>{healthLabel}</span>
      </div>

      <div className="strategy-monitor-grid">
        {/* Posição Motor 1 */}
        <div className="strategy-monitor-card">
          <div className="strategy-monitor-card-title">Motor 1 — posição no livro</div>
          <div className="strategy-monitor-row">
            <span className="monitor-label">Venda</span>
            <PositionPill position={m1Sell?.position} total={m1Sell?.total} found={m1Sell?.found} />
            {m1Sell?.order?.price && lbtcInd && (
              <SpreadBadge pct={spreadPct(m1Sell.order.price, lbtcInd, 'Sell')} />
            )}
          </div>
          <div className="strategy-monitor-row">
            <span className="monitor-label">Compra</span>
            <PositionPill position={m1Buy?.position} total={m1Buy?.total} found={m1Buy?.found} />
            {m1Buy?.order?.price && lbtcInd && (
              <SpreadBadge pct={spreadPct(m1Buy.order.price, lbtcInd, 'Buy')} />
            )}
          </div>
          {!bothFound && dealer && (
            <div className="monitor-note">Aguardando confirmação no livro…</div>
          )}
        </div>

        {/* Spread mercado vs price_min */}
        <div className="strategy-monitor-card">
          <div className="strategy-monitor-card-title">Spread mercado vs price_min</div>
          <div className="strategy-monitor-row">
            <span className="monitor-label">#1 venda</span>
            <span className={`monitor-val ${sellBlocked ? 'val-warn' : 'val-ok'}`}>
              {topSellSpread != null ? `${topSellSpread.toFixed(2)}%` : '—'}
            </span>
            {sellBlocked && (
              <span className="monitor-badge-warn">price_min {pmVal.toFixed(2)}% bloqueia</span>
            )}
          </div>
          <div className="strategy-monitor-row">
            <span className="monitor-label">#1 compra</span>
            <span className={`monitor-val ${buyBlocked ? 'val-warn' : 'val-ok'}`}>
              {topBuySpread != null ? `${topBuySpread.toFixed(2)}%` : '—'}
            </span>
            {buyBlocked && <span className="monitor-badge-warn">bloqueia</span>}
          </div>
          {(sellBlocked || buyBlocked) && (
            <div className="monitor-note warn">
              Para alcançar #1: reduzir price_min para ≤ {Math.min(topSellSpread ?? 99, topBuySpread ?? 99).toFixed(2)}%
            </div>
          )}
        </div>

        {/* Atividade SideSwap */}
        <div className="strategy-monitor-card">
          <div className="strategy-monitor-card-title">Atividade SideSwap (5 min)</div>
          <div className="strategy-monitor-row">
            <span className="monitor-label">Ordens adicionadas</span>
            <span className="monitor-val">{stats.adds}</span>
          </div>
          <div className="strategy-monitor-row">
            <span className="monitor-label">Ordens removidas</span>
            <span className="monitor-val">{stats.removes}</span>
          </div>
          <div className="strategy-monitor-row">
            <span className="monitor-label">Trades executados</span>
            <span className="monitor-val">{stats.fills}</span>
          </div>
          <div className="monitor-note">
            Ordens removidas = fills + cancelamentos. Trades = mudanças de last_price.
          </div>
        </div>

        {/* Nosso desempenho */}
        <div className="strategy-monitor-card">
          <div className="strategy-monitor-card-title">Nosso desempenho</div>
          <div className="strategy-monitor-row">
            <span className="monitor-label">Swaps executados</span>
            <span className="monitor-val highlight">{swapCount}</span>
          </div>
          {profitPct != null && (
            <div className="strategy-monitor-row">
              <span className="monitor-label">Lucro acumulado</span>
              <span className={`monitor-val ${profitPct >= 0 ? 'val-ok' : 'val-warn'}`}>
                {Number(profitPct).toFixed(2)}%
              </span>
            </div>
          )}
          {lbtcInd && (
            <div className="strategy-monitor-row">
              <span className="monitor-label">ind_price L-BTC</span>
              <span className="monitor-val">{formatBookPrice(lbtcInd)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StrategyTester({ scanPairs, scanBooks, scanIndPrices }) {
  const [testPairIdx, setTestPairIdx] = useState(0);
  const [testPm, setTestPm] = useState(0.50);

  const { base, quote } = CANONICAL_PAIRS_LABELS[testPairIdx];
  const book = useMemo(() => getPairBook(scanPairs, scanBooks, base, quote), [scanPairs, scanBooks, base, quote]);
  const indPrice = useMemo(() => getPairIndPrice(scanPairs, scanIndPrices, base, quote), [scanPairs, scanIndPrices, base, quote]);

  const simSell = useMemo(() => simulatePosition(book, 'Sell', testPm, indPrice), [book, testPm, indPrice]);
  const simBuy = useMemo(() => simulatePosition(book, 'Buy', testPm, indPrice), [book, testPm, indPrice]);

  const topSellSpread = useMemo(() => {
    const s = sortBookSide(book, 'Sell');
    return s[0] && indPrice ? spreadPct(s[0].price, indPrice, 'Sell') : null;
  }, [book, indPrice]);
  const topBuySpread = useMemo(() => {
    const b = sortBookSide(book, 'Buy');
    return b[0] && indPrice ? spreadPct(b[0].price, indPrice, 'Buy') : null;
  }, [book, indPrice]);

  function posClass(pos) {
    if (!pos) return '';
    if (pos === 1) return 'val-ok';
    if (pos <= 3) return 'val-mid';
    return 'val-warn';
  }

  const tradeoffMsg = testPm <= 0.25
    ? { cls: 'good', text: 'Muito agressivo — máximos fills, margem mínima por trade' }
    : testPm <= 0.50
    ? { cls: 'ok', text: 'Equilibrado — bom número de fills com margem razoável' }
    : testPm <= 1.00
    ? { cls: 'mid', text: 'Conservador — menos fills, maior margem por trade' }
    : { cls: 'warn', text: 'Muito conservador — poucos fills, mas alta margem quando executado' };

  const sellBlocked = topSellSpread != null && testPm > topSellSpread;
  const buyBlocked = topBuySpread != null && testPm > topBuySpread;
  const minNeeded = Math.min(topSellSpread ?? 99, topBuySpread ?? 99);

  return (
    <div className="strategy-tester">
      <div className="strategy-tester-header">
        <TbFlask size={15} />
        <span className="strategy-tester-title">Simulador de Estratégia</span>
      </div>

      <div className="strategy-tester-controls">
        <div className="strategy-tester-pair-tabs">
          {CANONICAL_PAIRS_LABELS.map((p, i) => (
            <button
              key={`${p.base}/${p.quote}`}
              type="button"
              className={`strategy-tester-tab${testPairIdx === i ? ' active' : ''}`}
              onClick={() => setTestPairIdx(i)}
            >
              {p.base}/{p.quote}
            </button>
          ))}
        </div>

        <div className="strategy-tester-slider-row">
          <span className="strategy-tester-label">price_min</span>
          <input
            type="range"
            className="strategy-tester-slider"
            min={0.10} max={2.00} step={0.05}
            value={testPm}
            onChange={(e) => setTestPm(parseFloat(e.target.value))}
          />
          <span className="strategy-tester-pm-val">{testPm.toFixed(2)}%</span>
        </div>
      </div>

      {!indPrice ? (
        <div className="strategy-tester-nodata">Aguardando dados SideSwap…</div>
      ) : (
        <div className="strategy-tester-results">
          {/* Coluna Venda */}
          <div className="strategy-tester-col">
            <div className="strategy-tester-col-title sell">Venda</div>
            <div className="strategy-tester-stat">
              <span>Preço simulado</span>
              <span>{simSell ? formatBookPrice(simSell.simPrice) : '—'}</span>
            </div>
            <div className="strategy-tester-stat">
              <span>Posição</span>
              <span className={posClass(simSell?.position)}>
                {simSell ? `#${simSell.position} de ${simSell.total}` : '—'}
              </span>
            </div>
            {topSellSpread != null && (
              <div className="strategy-tester-stat dim">
                <span>#1 mercado</span>
                <span>{topSellSpread.toFixed(2)}%</span>
              </div>
            )}
            {sellBlocked && (
              <div className="strategy-tester-warn">
                Reduzir para ≤ {topSellSpread.toFixed(2)}% para alcançar #1
              </div>
            )}
          </div>

          {/* Coluna Compra */}
          <div className="strategy-tester-col">
            <div className="strategy-tester-col-title buy">Compra</div>
            <div className="strategy-tester-stat">
              <span>Preço simulado</span>
              <span>{simBuy ? formatBookPrice(simBuy.simPrice) : '—'}</span>
            </div>
            <div className="strategy-tester-stat">
              <span>Posição</span>
              <span className={posClass(simBuy?.position)}>
                {simBuy ? `#${simBuy.position} de ${simBuy.total}` : '—'}
              </span>
            </div>
            {topBuySpread != null && (
              <div className="strategy-tester-stat dim">
                <span>#1 mercado</span>
                <span>{topBuySpread.toFixed(2)}%</span>
              </div>
            )}
            {buyBlocked && (
              <div className="strategy-tester-warn">
                Reduzir para ≤ {topBuySpread.toFixed(2)}% para alcançar #1
              </div>
            )}
          </div>

          {/* Trade-off */}
          <div className="strategy-tester-col tradeoff">
            <div className="strategy-tester-col-title">Trade-off</div>
            <div className={`strategy-tester-tradeoff-msg msg-${tradeoffMsg.cls}`}>
              {tradeoffMsg.text}
            </div>
            {(sellBlocked || buyBlocked) && (
              <div className="strategy-tester-tradeoff-msg msg-warn">
                ⚠ Mercado atual: para competir no #1, price_min ≤ {minNeeded.toFixed(2)}%
              </div>
            )}
            <div className="strategy-tester-stat dim" style={{ marginTop: 8 }}>
              <span>ind_price</span>
              <span>{formatBookPrice(indPrice)}</span>
            </div>
            <div className="strategy-tester-stat dim">
              <span>spread capturado</span>
              <span>{(testPm * 2).toFixed(2)}% total</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Componente Principal ───────────────────────────────────────────────── */

export default function StrategyPanel({
  dealers = [],
  selectedPid,
  onSelectDealer,
  sendCommand,
  wsStatus,
  agentConnected,
  scanPairs = [],
  scanIndPrices = {},
  scanBooks = {},
  bookPlacements = [],
}) {
  const [phase, setPhase] = useState('fase0');
  const [customPriceMin, setCustomPriceMin] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [activatedPids, setActivatedPids] = useState(new Set());

  const activity = useBookActivity(scanBooks, scanIndPrices);

  const currentPhase = PHASES.find((p) => p.id === phase) || PHASES[0];
  const effectivePriceMin = customPriceMin.trim() || currentPhase.priceMin;

  const selectedDealer = dealers.find((d) => d.pid === selectedPid) || null;
  const isConnected = wsStatus === 'connected';
  const canOperate = isConnected && agentConnected && selectedPid != null;
  const dealerSelected = selectedPid != null;

  const {
    motor1, motor1Buy, motor1Sell, motor1State,
    motor3, other,
    depix: depixBalance, usdt: usdtBalance, lbtc: lbtcBalance,
    hasDepixExit,
  } = useMemo(
    () => (selectedDealer ? classifyOrders(selectedDealer) : {
      motor1: [], motor1Buy: [], motor1Sell: [], motor1State: 'none',
      motor3: [], other: [],
      depix: 0, usdt: 0, lbtc: 0, hasDepixExit: false,
    }),
    [selectedDealer],
  );

  const motor1Activated = selectedPid != null && activatedPids.has(selectedPid);
  const motor1Running = motor1Activated || motor1State !== 'none';
  const motor3Status = depixBalance > 0 ? (hasDepixExit ? 'active' : 'warn') : 'none';

  // Todas as ordens da estratégia (Motor 1 + Motor 3) para marcação no livro
  const allStrategyOrders = useMemo(
    () => [...motor1Buy, ...motor1Sell, ...motor3],
    [motor1Buy, motor1Sell, motor3],
  );

  const run = async (action, params) => {
    if (!isConnected) { setFeedback({ ok: false, msg: 'WebSocket desconectado.' }); return null; }
    setBusy(true);
    setFeedback(null);
    try {
      const result = await sendCommand(action, params);
      const ok = result?.ok !== false;
      setFeedback({ ok, msg: ok ? `${action} OK.` : (result?.data?.error || `Erro em ${action}`) });
      return result;
    } catch (err) {
      setFeedback({ ok: false, msg: err.message });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleRunMotor1 = async () => {
    const pm = parsePercentInput(effectivePriceMin);
    if (pm == null || pm <= 0) { setFeedback({ ok: false, msg: 'price_min inválido. Ex: 0,50 para 0,5%.' }); return; }
    // follow_target_position=1: rastreia o topo do book, capturando o range máximo disponível.
    // price_min garante o floor de lucro mínimo aceitável.
    const base = {
      pid: selectedPid, base: 'L-BTC', quote: 'USDt', amount: 999999,
      follow_target: true, follow_target_position: 1, price_min: pm,
    };
    const r = await run('send_order', { ...base, trade_dir: 'Buy' });
    if (r?.ok) {
      const r2 = await run('send_order', { ...base, trade_dir: 'Sell' });
      if (r2?.ok) setActivatedPids((prev) => new Set([...prev, selectedPid]));
    }
  };

  // Cancela SOMENTE as ordens Motor 1 (L-BTC/USDt), não toca nas demais
  const handleStopMotor1 = async () => {
    const sentOrders = [...motor1Buy, ...motor1Sell].filter((o) => o.order_id);
    const hasPendingBuy = motor1Buy.some((o) => !o.order_id);
    const hasPendingSell = motor1Sell.some((o) => !o.order_id);

    for (const o of sentOrders) {
      await run('cancel_order', { pid: selectedPid, order_id: o.order_id });
    }
    if (hasPendingBuy) {
      await run('cancel_order', { pid: selectedPid, pending: true, base: 'L-BTC', quote: 'USDt', trade_dir: 'Buy' });
    }
    if (hasPendingSell) {
      await run('cancel_order', { pid: selectedPid, pending: true, base: 'L-BTC', quote: 'USDt', trade_dir: 'Sell' });
    }

    setActivatedPids((prev) => { const next = new Set(prev); next.delete(selectedPid); return next; });
  };

  const handleMotor3 = async (rota) => {
    const base = { pid: selectedPid, amount: 999999, price_min: 0 };
    if (rota === 'A') await run('send_order', { ...base, base: 'USDt', quote: 'DePix', trade_dir: 'Buy' });
    else await run('send_order', { ...base, base: 'L-BTC', quote: 'DePix', trade_dir: 'Buy' });
  };

  return (
    <div className="strategy-panel">

      {/* ── Header ── */}
      <div className="strategy-header">
        <TbRocket className="strategy-header-icon" />
        <div>
          <h3 className="strategy-header-title">Estratégia</h3>
          <p className="strategy-header-sub">
            Selecione a fase e o dealer. Run/Stop operam apenas as ordens desta estratégia.
          </p>
        </div>
      </div>

      {/* ── Seletor de Fase (largura total) ── */}
      <div className="strategy-phases">
        {PHASES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`strategy-phase-card${phase === p.id ? ' active' : ''}`}
            style={phase === p.id ? { borderColor: p.color } : {}}
            onClick={() => { setPhase(p.id); setCustomPriceMin(''); setFeedback(null); }}
          >
            <span className="strategy-phase-label" style={{ color: phase === p.id ? p.color : undefined }}>
              {p.label}
            </span>
            <span className="strategy-phase-sub">{p.subtitle}</span>
            <span className="strategy-phase-capital">{p.capital}</span>
          </button>
        ))}
      </div>

      <div className="strategy-phase-info">
        <div className="strategy-phase-info-row"><span>Objetivo</span><span>{currentPhase.objective}</span></div>
        <div className="strategy-phase-info-row"><span>Avançar quando</span><span>{currentPhase.criteria}</span></div>
      </div>

      {/* ── Layout 2 colunas ── */}
      <div className="strategy-layout">

        {/* ──────────── COLUNA ESQUERDA ──────────── */}
        <div className="strategy-col-left">

          {/* Dealers */}
          <div className="strategy-section">
            <div className="strategy-section-title">
              Dealer
              {!dealerSelected && <span className="strategy-section-title-hint"> — clique para selecionar</span>}
            </div>
            {dealers.length === 0 ? (
              <p className="dealer-empty mb-0">Nenhum dealer ativo. Inicie em <strong>Geral → Run</strong>.</p>
            ) : (
              <div className="strategy-dealer-grid">
                {dealers.map((d) => (
                  <DealerStrategyChip
                    key={d.pid}
                    dealer={d}
                    selected={selectedPid === d.pid}
                    activatedHere={activatedPids.has(d.pid)}
                    onClick={() => onSelectDealer(selectedPid === d.pid ? null : d.pid)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Inventário */}
          {dealerSelected && selectedDealer && (
            <InventoryRow lbtc={lbtcBalance} usdt={usdtBalance} depix={depixBalance} />
          )}

          {/* Motores — locked sem dealer */}
          <div className={`strategy-motors-wrap${!dealerSelected ? ' locked' : ''}`}>
            {!dealerSelected && (
              <div className="strategy-motors-lock">
                <TbLock size={20} />
                <span>Selecione um dealer para operar</span>
              </div>
            )}

            {/* Motor 1 */}
            <div className={`strategy-motor${motor1Running ? ' motor-on' : ''}`}>
              <div className="strategy-motor-head">
                <div className="strategy-motor-title">
                  <MotorDot status={motor1Running ? 'active' : 'off'} />
                  Motor 1 — L-BTC/USDt MM
                </div>
                <Badge bg={motor1State === 'both' ? 'success' : motor1State === 'partial' ? 'warning' : 'secondary'}
                  text={motor1State === 'partial' ? 'dark' : undefined}>
                  {motor1State === 'both' ? 'BUY + SELL' : motor1State === 'partial' ? 'parcial' : 'inativo'}
                </Badge>
              </div>

              {motor1State !== 'none' && !motor1Activated && (
                <div className="strategy-motor-preexisting">
                  <TbAlertTriangle size={13} />
                  {' '}{motor1.length} ordem{motor1.length !== 1 ? 's' : ''} L-BTC/USDt já existente{motor1.length !== 1 ? 's' : ''} — não criadas por este painel
                </div>
              )}

              <div className="strategy-motor-body">
                <div className="strategy-motor-config">
                  <label className="strategy-config-label">lucro mín. %</label>
                  <Form.Control
                    size="sm"
                    className="strategy-pm-input"
                    value={customPriceMin || currentPhase.priceMin}
                    onChange={(e) => setCustomPriceMin(e.target.value)}
                    placeholder={currentPhase.priceMin}
                    disabled={busy || !dealerSelected}
                  />
                  <span className="strategy-config-hint">
                    follow_target_position=1 · floor {currentPhase.priceMin}% ({currentPhase.label})
                  </span>
                </div>

                <div className="strategy-motor-actions">
                  <Button
                    size="sm"
                    className="dealer-btn-primary strategy-run-btn"
                    disabled={busy || !canOperate}
                    onClick={handleRunMotor1}
                  >
                    <TbPlayerPlay /> Run
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    className="strategy-stop-btn"
                    disabled={busy || !canOperate || motor1State === 'none'}
                    onClick={handleStopMotor1}
                  >
                    <TbPlayerStop /> Stop
                  </Button>
                </div>

                {/* Resumo das ordens Motor 1 */}
                {motor1.length > 0 && (
                  <div className="strategy-motor1-orders">
                    {motor1Buy.map((o) => (
                      <span key={o.order_id || 'buy-p'} className="strategy-motor1-order buy">
                        C {o.order_id ? `#${o.order_id}` : 'pendente'}
                        {o.price ? ` @ ${formatBookPrice(o.price)}` : ''}
                      </span>
                    ))}
                    {motor1Sell.map((o) => (
                      <span key={o.order_id || 'sell-p'} className="strategy-motor1-order sell">
                        V {o.order_id ? `#${o.order_id}` : 'pendente'}
                        {o.price ? ` @ ${formatBookPrice(o.price)}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Motor 2 */}
            <div className="strategy-motor">
              <div className="strategy-motor-head">
                <div className="strategy-motor-title">
                  <MotorDot status="info" />
                  Motor 2 — Below-market sniper
                </div>
                <Badge bg="info">via Telegram</Badge>
              </div>
              <div className="strategy-motor-body">
                <div className="strategy-motor-hint">
                  <TbSettings size={13} />
                  {' '}Threshold ({currentPhase.label}): <strong>{currentPhase.belowThreshold}</strong>
                  {' '}· Configure em <strong>Configurações → Telegram</strong>
                </div>
              </div>
            </div>

            {/* Motor 3 — só se houver DePix */}
            {dealerSelected && depixBalance > 0 && (
              <div className={`strategy-motor${motor3Status === 'active' ? ' motor-on' : ' motor-warn'}`}>
                <div className="strategy-motor-head">
                  <div className="strategy-motor-title">
                    <MotorDot status={motor3Status === 'active' ? 'active' : 'warn'} />
                    Motor 3 — Saída DePix
                  </div>
                  <Badge bg={motor3Status === 'active' ? 'success' : 'warning'} text={motor3Status !== 'active' ? 'dark' : undefined}>
                    {formatAssetBalance('DePix', depixBalance)}
                  </Badge>
                </div>
                <div className="strategy-motor-body">
                  {motor3.length > 0 && (
                    <div className="strategy-motor1-orders">
                      {motor3.map((o, i) => (
                        <span key={o.order_id || `m3-${i}`} className="strategy-motor1-order buy">
                          {canonicalAssetName(o.base)}/{canonicalAssetName(o.quote)}
                          {' '}{o.order_id ? `#${o.order_id}` : 'pendente'}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="strategy-motor-actions">
                    <Button size="sm" className="dealer-btn-primary" disabled={busy || !canOperate} onClick={() => handleMotor3('A')}>
                      <TbTarget /> Rota A — DePix → USDt
                    </Button>
                    <Button size="sm" variant="outline-secondary" disabled={busy || !canOperate} onClick={() => handleMotor3('B')}>
                      <TbTarget /> Rota B — DePix → L-BTC
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Outras ordens — fora da estratégia */}
          {dealerSelected && <OtherOrdersList orders={other} />}

          {/* Feedback */}
          {feedback && (
            <div className={`strategy-feedback${feedback.ok ? ' strategy-feedback-ok' : ' strategy-feedback-err'}`}>
              {feedback.ok ? <TbCheck /> : <TbAlertTriangle />} {feedback.msg}
            </div>
          )}
        </div>

        {/* ──────────── COLUNA DIREITA ──────────── */}
        <div className="strategy-col-right">
          <OrderBookSection
            scanPairs={scanPairs}
            scanBooks={scanBooks}
            scanIndPrices={scanIndPrices}
            allStrategyOrders={allStrategyOrders}
          />
          <SwapCalculator scanPairs={scanPairs} scanIndPrices={scanIndPrices} />
        </div>

      </div>

      {/* ──────────── SEÇÃO INFERIOR: Monitor + Simulador ──────────── */}
      <div className="strategy-bottom-section">
        <MonitorSection
          dealers={dealers}
          selectedPid={selectedPid}
          bookPlacements={bookPlacements}
          scanPairs={scanPairs}
          scanBooks={scanBooks}
          scanIndPrices={scanIndPrices}
          currentPhasePm={effectivePriceMin}
          activity={activity}
        />
        <StrategyTester
          scanPairs={scanPairs}
          scanBooks={scanBooks}
          scanIndPrices={scanIndPrices}
        />
      </div>

    </div>
  );
}
