import React, { useEffect, useMemo, useRef, useState } from 'react';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import {
  TbRefresh, TbExternalLink, TbAlertTriangle, TbCircleCheck, TbMinus, TbTag, TbFlame,
  TbTarget, TbTrash, TbArrowRight,
} from 'react-icons/tb';
import { SideswapBadge } from './SourceBadge';
import { sortBookSide, formatBookPrice } from './utils/sideswapBook';
import { prepareDealerOrders } from './utils/orderMarketNormalize';
import { findBelowMarketSells } from './utils/marketBargain';
import {
  computeSpreadOpportunities,
  ROUTE_MIN_PCT,
  standaloneExecution,
} from './utils/spreadOpportunities';
import { bestConversionPath } from './utils/rebalanceGoals';
import { formatAssetBalance } from './utils/dealerFormat';
import depixUrl from './assets/marks/depix.png';
import usdtUrl from './assets/marks/usdt.png';
import lbtcUrl from './assets/marks/lbtc.png';

const GOAL_ASSETS = ['L-BTC', 'USDt', 'DePix'];

/** Mantém "desde quando" cada oportunidade está ativa (persiste enquanto o id existir). */
function useOpportunityAge(ids) {
  const firstSeenRef = useRef(new Map());
  useEffect(() => {
    const map = firstSeenRef.current;
    const now = Date.now();
    const idSet = new Set(ids);
    for (const id of idSet) {
      if (!map.has(id)) map.set(id, now);
    }
    for (const key of Array.from(map.keys())) {
      if (!idSet.has(key)) map.delete(key);
    }
  }, [ids]);
  return firstSeenRef.current;
}

function formatAge(firstSeenMs) {
  if (!firstSeenMs) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - firstSeenMs) / 1000));
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  return `há ${hours}h${minutes % 60}min`;
}

/* ── Funções de análise ── */

function computeSpread(book) {
  const buys = sortBookSide(book, 'Buy');
  const sells = sortBookSide(book, 'Sell');
  const bestBuy = buys[0]?.price ?? null;
  const bestSell = sells[0]?.price ?? null;
  if (bestBuy == null || bestSell == null || bestBuy <= 0) return null;
  return (bestSell - bestBuy) / bestBuy * 100;
}

function bookDepth(book) {
  const buys = sortBookSide(book, 'Buy').length;
  const sells = sortBookSide(book, 'Sell').length;
  return { buys, sells, total: buys + sells };
}

function topPrices(book) {
  const buys = sortBookSide(book, 'Buy');
  const sells = sortBookSide(book, 'Sell');
  return {
    bestBuy: buys[0]?.price ?? null,
    bestSell: sells[0]?.price ?? null,
    secondBuy: buys[1]?.price ?? null,
    secondSell: sells[1]?.price ?? null,
  };
}

function isCovered(book, dealerOrderIds) {
  if (!dealerOrderIds.size) return false;
  return (book || []).some((o) => dealerOrderIds.has(String(o.order_id)));
}

/** Lado sugerido: o mais raso (menos concorrência) é onde vale mais entrar. */
function suggestedSide(depth) {
  if (!depth || depth.buys === depth.sells) return null;
  return depth.buys < depth.sells ? 'Buy' : 'Sell';
}

/** Score de 0–100 para oportunidade de market making */
function opportunityScore({ spread, depth, covered, indPrice }) {
  if (spread == null || indPrice == null) return 0;
  // Spread score: 0-60 points (>3% = max)
  const spreadScore = Math.min(spread / 3, 1) * 60;
  // Depth score: fewer orders = higher score (0-25 points)
  const depthScore = Math.max(0, 25 - depth.total * 1.5);
  // Coverage penalty: -20 if we're already there (still might want to optimize)
  const coverPenalty = covered ? 10 : 0; // small penalty — we're already there but could improve
  return Math.max(0, spreadScore + depthScore - coverPenalty);
}

function scoreLabel(score) {
  if (score >= 60) return { label: 'Alta', kind: 'alta' };
  if (score >= 30) return { label: 'Média', kind: 'media' };
  if (score >= 10) return { label: 'Baixa', kind: 'baixa' };
  return { label: 'Nula', kind: 'nula' };
}

function spreadLabel(pct) {
  if (pct == null) return { text: '—', cls: '' };
  if (pct >= 3) return { text: `${pct.toFixed(2)}%`, cls: 'spread-high' };
  if (pct >= 1) return { text: `${pct.toFixed(2)}%`, cls: 'spread-mid' };
  return { text: `${pct.toFixed(2)}%`, cls: 'spread-low' };
}

/** Sugestão de entrada: preço e direção para ser competitivo */
function entrySuggestion({ spread, top, indPrice }) {
  if (spread == null || indPrice == null) return null;
  const margin = spread * 0.35; // entra um pouco acima do melhor buy / abaixo do melhor sell
  const suggestSell = top.bestSell != null
    ? (top.bestSell * (1 - margin / 100)) : null;
  const suggestBuy = top.bestBuy != null
    ? (top.bestBuy * (1 + margin / 100)) : null;
  return { sell: suggestSell, buy: suggestBuy, marginPct: margin };
}

/* ── Sub-componentes ── */

function OpportunityCard({ pair, book, indPrice, dealerOrderIds, onGoToOrder }) {
  const spread = useMemo(() => computeSpread(book), [book]);
  const depth = useMemo(() => bookDepth(book), [book]);
  const top = useMemo(() => topPrices(book), [book]);
  const covered = useMemo(() => isCovered(book, dealerOrderIds), [book, dealerOrderIds]);

  const score = opportunityScore({ spread, depth, covered, indPrice: indPrice?.indPrice });
  const { label: oppLabel, kind: oppKind } = scoreLabel(score);
  const { text: spreadText, cls: spreadCls } = spreadLabel(spread);
  const suggestion = entrySuggestion({ spread, top, indPrice: indPrice?.indPrice });
  const side = useMemo(() => suggestedSide(depth), [depth]);

  const noData = !book || book.length === 0;
  const sideCls = side ? ` dealer-opp-side-${side.toLowerCase()}` : '';

  return (
    <div className={`dealer-opp-card dealer-opp-${oppKind}${covered ? ' covered' : ''}${sideCls}`}>
      {/* Cabeçalho */}
      <div className="dealer-opp-head">
        <div className="dealer-opp-pair">
          <span className="dealer-opp-pair-name">{pair.base}/{pair.quote}</span>
          {side && (
            <span className={`dealer-opp-dir ${side.toLowerCase()}`} title="Lado com menos concorrência no livro">
              {side}
            </span>
          )}
          {covered ? (
            <span className="dealer-opp-cov dealer-opp-cov-yes" title="Temos ordens neste mercado">
              <TbCircleCheck /> cobertura
            </span>
          ) : (
            <span className="dealer-opp-cov dealer-opp-cov-no" title="Sem ordens neste mercado">
              <TbMinus /> sem cobertura
            </span>
          )}
        </div>
        <div className="dealer-opp-score-wrap">
          <span className={`dealer-opp-score dealer-opp-score-${oppKind}`}>{oppLabel}</span>
        </div>
      </div>

      {noData ? (
        <p className="dealer-opp-nodata">Aguardando dados do livro…</p>
      ) : (
        <>
          {/* Preços e spread */}
          <div className="dealer-opp-prices">
            <div className="dealer-opp-price-row">
              <span className="dealer-opp-price-label">Melhor compra</span>
              <span className="dealer-opp-price-val buy">{formatBookPrice(top.bestBuy)}</span>
            </div>
            <div className="dealer-opp-spread-mid">
              <span className={`dealer-opp-spread ${spreadCls}`}>spread {spreadText}</span>
            </div>
            <div className="dealer-opp-price-row">
              <span className="dealer-opp-price-label">Melhor venda</span>
              <span className="dealer-opp-price-val sell">{formatBookPrice(top.bestSell)}</span>
            </div>
          </div>

          {/* Referência */}
          {indPrice?.indPrice != null && (
            <div className="dealer-opp-ref">
              <span className="dealer-opp-ref-label">ind_price SideSwap</span>
              <span className="dealer-opp-ref-val">{formatBookPrice(indPrice.indPrice)}</span>
            </div>
          )}

          {/* Profundidade */}
          <div className="dealer-opp-depth">
            <span className="dealer-opp-depth-item buy">
              {depth.buys} ordem{depth.buys !== 1 ? 's' : ''} compra
            </span>
            <span className="dealer-opp-depth-sep">·</span>
            <span className="dealer-opp-depth-item sell">
              {depth.sells} ordem{depth.sells !== 1 ? 's' : ''} venda
            </span>
          </div>

          {/* Sugestão de entrada */}
          {!covered && suggestion && spread > 0.5 && (
            <div className="dealer-opp-suggestion">
              <div className="dealer-opp-suggestion-title">
                <TbAlertTriangle /> Entrada sugerida (margem ~{suggestion.marginPct.toFixed(2)}%)
              </div>
              <div className="dealer-opp-suggestion-prices">
                {suggestion.buy != null && (
                  <span>
                    <span className="dealer-opp-dir buy">Buy</span>
                    {' '}até <strong>{formatBookPrice(suggestion.buy)}</strong>
                  </span>
                )}
                {suggestion.sell != null && (
                  <span>
                    <span className="dealer-opp-dir sell">Sell</span>
                    {' '}a partir de <strong>{formatBookPrice(suggestion.sell)}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="dealer-opp-actions">
            {onGoToOrder && (
              <Button
                size="sm"
                variant="outline-primary"
                className="dealer-opp-btn"
                onClick={() => onGoToOrder(pair.base, pair.quote)}
              >
                Colocar ordem
              </Button>
            )}
            {pair.marketUrl && (
              <a
                href={pair.marketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="dealer-opp-link"
              >
                <TbExternalLink /> Ver livro
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BelowMarketCard({ pair, hits, indPrice, marketUrl }) {
  const [expanded, setExpanded] = useState(false);
  const best = hits[0];
  if (!best) return null;

  const visibleHits = expanded ? hits : hits.slice(0, 3);
  const hasMore = hits.length > 3;

  return (
    <div className="dealer-opp-card dealer-opp-below-market">
      {/* Cabeçalho */}
      <div className="dealer-opp-head">
        <div className="dealer-opp-pair">
          <span className="dealer-opp-pair-name">{pair.base}/{pair.quote}</span>
          <Badge bg="success" className="dealer-opp-below-badge">
            <TbTag /> {hits.length} venda{hits.length !== 1 ? 's' : ''} abaixo
          </Badge>
        </div>
        <span className="dealer-opp-below-discount" title="Maior desconto encontrado">
          −{best.discountPct.toFixed(2)}%
        </span>
      </div>

      {/* Referência de mercado */}
      <div className="dealer-opp-below-ref">
        <span className="dealer-opp-price-label">ind_price SideSwap</span>
        <span className="dealer-opp-ref-val">{formatBookPrice(indPrice)}</span>
      </div>

      {/* Chamada de ação */}
      <div className="dealer-opp-below-cta">
        Compra abaixo do mercado — alguém está vendendo {pair.base} mais barato que o preço de referência.
      </div>

      {/* Lista de hits */}
      <div className="dealer-opp-below-hits">
        <div className="dealer-opp-below-hits-header">
          <span>Preço (Sell)</span>
          <span>Desconto</span>
          <span>Order ID</span>
        </div>
        {visibleHits.map((hit, idx) => (
          <div key={hit.orderId ?? idx} className={`dealer-opp-below-hit-row${idx === 0 ? ' best' : ''}`}>
            <span className="dealer-opp-price-val sell">{formatBookPrice(hit.price)}</span>
            <span className="dealer-opp-below-hit-discount">−{hit.discountPct.toFixed(2)}%</span>
            <code className="dealer-opp-below-hit-id">{hit.orderId ?? '—'}</code>
          </div>
        ))}
        {hasMore && (
          <button
            type="button"
            className="dealer-opp-below-expand"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? `Mostrar menos` : `+${hits.length - 3} mais`}
          </button>
        )}
      </div>

      {/* Ação */}
      {marketUrl && (
        <div className="dealer-opp-actions">
          <a href={marketUrl} target="_blank" rel="noopener noreferrer" className="dealer-opp-link">
            <TbExternalLink /> Comprar no Swap Market
          </a>
        </div>
      )}
    </div>
  );
}

function moneyLabel(asset, amount) {
  if (amount == null || !Number.isFinite(amount)) return null;
  return formatAssetBalance(asset, amount);
}

function assetMarkUrl(asset) {
  const key = String(asset || '').toLowerCase().replace(/-/g, '');
  if (key === 'usdt') return usdtUrl;
  if (key === 'lbtc') return lbtcUrl;
  if (key === 'depix') return depixUrl;
  return null;
}

function AssetMark({ asset }) {
  const url = assetMarkUrl(asset);
  if (!url) return null;
  return <img className="dealer-opp-step-mark" src={url} alt="" />;
}

function AssetAmount({ asset, amount }) {
  const label = moneyLabel(asset, amount) || '—';
  return (
    <span className="dealer-opp-step-amt">
      <AssetMark asset={asset} />
      {label}
    </span>
  );
}

function RouteLegStep({ index, giveAsset, giveAmount, getAsset, getAmount, leg }) {
  const price = formatBookPrice(leg.price);
  const title = `${leg.base}/${leg.quote} · ordem ${leg.side} a ${price}`;
  return (
    <li className="dealer-opp-spread-step" title={title}>
      <span className="dealer-opp-step-num">{index}</span>
      <span className="dealer-opp-step-flow">
        <AssetAmount asset={giveAsset} amount={giveAmount} />
        <TbArrowRight className="dealer-opp-step-arrow" aria-hidden="true" />
        <AssetAmount asset={getAsset} amount={getAmount} />
        <span className="dealer-opp-step-price">a {price}</span>
      </span>
      {leg.marketUrl && (
        <a
          href={leg.marketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="dealer-opp-step-book"
          title={`Abrir livro ${leg.base}/${leg.quote}`}
        >
          <TbExternalLink />
        </a>
      )}
    </li>
  );
}

function StandaloneOpportunityCard({ leg, age }) {
  const exec = standaloneExecution(leg);
  const gainPct = Math.abs(leg.mmPct);
  const profitLabel = moneyLabel(exec.profitAsset, exec.profitAmount);

  return (
    <div className="dealer-opp-card dealer-opp-spread">
      <div className="dealer-opp-head">
        <div className="dealer-opp-pair">
          <span className="dealer-opp-pair-name">{leg.base}/{leg.quote}</span>
          <Badge bg="danger" className="dealer-opp-spread-badge">
            <TbFlame /> desconto
          </Badge>
        </div>
        <span className="dealer-opp-spread-pct">{gainPct.toFixed(2)}% abaixo</span>
      </div>
      <p className="dealer-opp-spread-lead">
        {profitLabel
          ? <>Você economiza <strong className="dealer-opp-spread-gain-inline">{profitLabel}</strong>.</>
          : <>Desconto de <strong>{gainPct.toFixed(2)}%</strong> em relação ao preço de mercado.</>}
        {exec.unlimited ? ' A ordem não tem limite.' : null}
      </p>
      <ol className="dealer-opp-spread-steps">
        <RouteLegStep
          index={1}
          giveAsset={exec.inputAsset}
          giveAmount={exec.inputAmount}
          getAsset={exec.outputAsset}
          getAmount={exec.outputAmount}
          leg={leg}
        />
      </ol>
      {age && <div className="dealer-opp-spread-age">Ativa {age}</div>}
    </div>
  );
}

function RouteOpportunityCard({ route, age }) {
  const exec = route.execution;
  const [leg1, leg2] = route.legs;
  const gainPct = Math.abs(route.combinedMmPct);
  const profitLabel = moneyLabel(route.end, exec?.profitAmount);
  const payLabel = moneyLabel(route.start, exec?.startAmount);
  const receiveLabel = moneyLabel(route.end, exec?.endAmount);
  const perUnit = exec?.profitPerStart != null && exec?.startAmount == null
    ? formatAssetBalance(route.end, exec.profitPerStart)
    : null;
  const limitNote = exec?.limitedBy != null
    ? `O tamanho cabe na ordem ${exec.limitedBy + 1}.`
    : (exec?.unlimited ? 'A ordem não tem limite. O ganho acompanha o valor que você colocar.' : null);

  return (
    <div className="dealer-opp-card dealer-opp-spread">
      <div className="dealer-opp-head">
        <div className="dealer-opp-pair">
          <span className="dealer-opp-pair-name dealer-opp-route-name">
            <AssetMark asset={route.start} />
            {route.start}
            <TbArrowRight aria-hidden="true" />
            <AssetMark asset={route.mid} />
            {route.mid}
            <TbArrowRight aria-hidden="true" />
            <AssetMark asset={route.end} />
            {route.end}
          </span>
        </div>
        <span className="dealer-opp-spread-pct">+{gainPct.toFixed(2)}%</span>
      </div>

      <p className="dealer-opp-spread-lead">
        {payLabel && receiveLabel
          ? <>Pague <strong>{payLabel}</strong> e receba <strong>{receiveLabel}</strong>.</>
          : <>Troque {route.start} por {route.end} em dois passos.</>}
        {' '}
        {profitLabel
          ? <>Ganho de <strong className="dealer-opp-spread-gain-inline">{profitLabel}</strong> (+{gainPct.toFixed(2)}%).</>
          : <>Ganho de <strong>+{gainPct.toFixed(2)}%</strong>{perUnit ? <> — {perUnit} a cada 1 {route.start}</> : null}.</>}
        {' '}
        Melhor que trocar {route.start} por {route.end} numa ordem só.
      </p>
      {limitNote && <p className="dealer-opp-spread-limit">{limitNote}</p>}

      <ol className="dealer-opp-spread-steps">
        <RouteLegStep
          index={1}
          giveAsset={route.start}
          giveAmount={exec?.startAmount}
          getAsset={route.mid}
          getAmount={exec?.midAmount}
          leg={leg1}
        />
        <RouteLegStep
          index={2}
          giveAsset={route.mid}
          giveAmount={exec?.midAmount}
          getAsset={route.end}
          getAmount={exec?.endAmount}
          leg={leg2}
        />
      </ol>

      {age && <div className="dealer-opp-spread-age">Ativa {age}</div>}
    </div>
  );
}

function GoalForm({ onAdd }) {
  const [fromAsset, setFromAsset] = useState(GOAL_ASSETS[2]); // DePix por padrão
  const otherAssets = GOAL_ASSETS.filter((a) => a !== fromAsset);
  const [selected, setSelected] = useState({ [otherAssets[0]]: true, [otherAssets[1]]: false });
  const [splitPct, setSplitPct] = useState(50);

  const handleFromChange = (asset) => {
    setFromAsset(asset);
    const others = GOAL_ASSETS.filter((a) => a !== asset);
    setSelected({ [others[0]]: true, [others[1]]: false });
    setSplitPct(50);
  };

  const chosen = otherAssets.filter((a) => selected[a]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!chosen.length) return;
    const targets = chosen.length === 1
      ? [{ asset: chosen[0], pct: 100 }]
      : [{ asset: chosen[0], pct: splitPct }, { asset: chosen[1], pct: 100 - splitPct }];
    onAdd(fromAsset, targets);
  };

  return (
    <form className="dealer-goal-form" onSubmit={handleSubmit}>
      <div className="dealer-goal-form-row">
        <span className="dealer-goal-form-label">Tenho</span>
        <select
          className="dealer-goal-form-select"
          value={fromAsset}
          onChange={(e) => handleFromChange(e.target.value)}
        >
          {GOAL_ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <TbArrowRight />
        <span className="dealer-goal-form-label">quero</span>
        {otherAssets.map((asset) => (
          <label key={asset} className="dealer-goal-form-check">
            <input
              type="checkbox"
              checked={!!selected[asset]}
              onChange={(e) => setSelected((prev) => ({ ...prev, [asset]: e.target.checked }))}
            />
            {asset}
          </label>
        ))}
      </div>
      {chosen.length === 2 && (
        <div className="dealer-goal-form-row">
          <span className="dealer-goal-form-label">Split: {chosen[0]} {splitPct}% / {chosen[1]} {100 - splitPct}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={splitPct}
            onChange={(e) => setSplitPct(Number(e.target.value))}
            className="dealer-goal-form-range"
          />
        </div>
      )}
      <Button type="submit" size="sm" variant="outline-primary" disabled={!chosen.length}>
        <TbTarget /> Marcar meta
      </Button>
    </form>
  );
}

function GoalPathBadge({ path }) {
  if (!path) return <span className="dealer-goal-path-na">sem rota disponível</span>;
  const cls = path.mmPct <= 0 ? 'good' : 'neutral';
  const desc = path.type === 'direct'
    ? path.legs[0].label
    : `${path.legs[0].label} + ${path.legs[1].label} (via ${path.bridgeAsset})`;
  return (
    <span className={`dealer-goal-path dealer-goal-path-${cls}`} title={desc}>
      {path.mmPct.toFixed(2)}% · {desc}
    </span>
  );
}

function GoalCard({ goal, legs, onRemove }) {
  const balance = goal.balance ?? 0;

  return (
    <div className="dealer-opp-card dealer-goal-card">
      <div className="dealer-opp-head">
        <div className="dealer-opp-pair">
          <span className="dealer-opp-pair-name">
            {goal.fromAsset} <TbArrowRight /> {goal.targets.map((t) => `${t.asset}${goal.targets.length > 1 ? ` (${t.pct}%)` : ''}`).join(' + ')}
          </span>
        </div>
        <Button size="sm" variant="outline-danger" className="dealer-goal-remove" onClick={() => onRemove(goal.id)} title="Remover meta">
          <TbTrash />
        </Button>
      </div>
      <div className="dealer-opp-ref">
        <span className="dealer-opp-ref-label">Saldo atual de {goal.fromAsset}</span>
        <span className="dealer-opp-ref-val">{formatAssetBalance(goal.fromAsset, balance)}</span>
      </div>
      <div className="dealer-opp-spread-legs-title">Melhor rota agora</div>
      <div className="dealer-goal-paths">
        {goal.targets.map((t) => {
          const path = bestConversionPath(goal.fromAsset, t.asset, legs, GOAL_ASSETS);
          return (
            <div key={t.asset} className="dealer-goal-path-row">
              <span className="dealer-opp-price-label">{goal.fromAsset} → {t.asset}</span>
              <GoalPathBadge path={path} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MarketOpportunities({
  pairs,
  books,
  indPrices,
  status,
  error,
  lastUpdate,
  dealers = [],
  reconnect,
  onGoToOrder,
  belowMarketThresholdPct = 0.5,
  sendCommand,
}) {
  const [viewMode, setViewMode] = useState('spread');
  const [goals, setGoals] = useState([]);
  const [goalsError, setGoalsError] = useState(null);

  const refreshGoals = React.useCallback(() => {
    if (!sendCommand) return;
    sendCommand('get_rebalance_goals', {}).then((res) => {
      if (res?.ok && res.data) {
        setGoals(res.data.goals || []);
        setGoalsError(null);
      } else {
        setGoalsError(res?.error || 'Falha ao carregar metas');
      }
    }).catch((err) => setGoalsError(err.message));
  }, [sendCommand]);

  useEffect(() => {
    refreshGoals();
    const t = setInterval(refreshGoals, 20000);
    return () => clearInterval(t);
  }, [refreshGoals]);

  const handleAddGoal = async (fromAsset, targets) => {
    if (!sendCommand) return;
    const res = await sendCommand('add_rebalance_goal', { from_asset: fromAsset, targets });
    if (res?.ok) refreshGoals();
    else setGoalsError(res?.error || 'Falha ao criar meta');
  };
  const handleRemoveGoal = async (id) => {
    if (!sendCommand) return;
    const res = await sendCommand('remove_rebalance_goal', { id });
    if (res?.ok) refreshGoals();
    else setGoalsError(res?.error || 'Falha ao remover meta');
  };
  /* Coleta todos os order_ids das nossas ordens (para verificar cobertura no livro) */
  const dealerOrderIds = useMemo(() => {
    const ids = new Set();
    for (const d of dealers) {
      const { orders } = prepareDealerOrders(d.orders || []);
      for (const o of orders) {
        if (o.order_id != null) ids.add(String(o.order_id));
      }
    }
    return ids;
  }, [dealers]);

  /* Ordena pares: maior score primeiro */
  const sortedPairs = useMemo(() => {
    if (!pairs.length) return [];
    return [...pairs].sort((a, b) => {
      const bookA = books[a.key] || [];
      const bookB = books[b.key] || [];
      const scoreA = opportunityScore({
        spread: computeSpread(bookA),
        depth: bookDepth(bookA),
        covered: isCovered(bookA, dealerOrderIds),
        indPrice: indPrices[a.key]?.indPrice,
      });
      const scoreB = opportunityScore({
        spread: computeSpread(bookB),
        depth: bookDepth(bookB),
        covered: isCovered(bookB, dealerOrderIds),
        indPrice: indPrices[b.key]?.indPrice,
      });
      return scoreB - scoreA;
    });
  }, [pairs, books, indPrices, dealerOrderIds]);

  const belowMarketByPair = useMemo(() => {
    if (!pairs.length) return [];
    return pairs
      .map((pair) => {
        const book = books[pair.key] || [];
        const ind = indPrices[pair.key]?.indPrice;
        const hits = findBelowMarketSells(book, ind, belowMarketThresholdPct)
          .sort((a, b) => b.discountPct - a.discountPct);
        if (!hits.length) return null;
        return { pair, hits, indPrice: ind };
      })
      .filter(Boolean)
      .sort((a, b) => b.hits[0].discountPct - a.hits[0].discountPct);
  }, [pairs, books, indPrices, belowMarketThresholdPct]);

  const spreadOpp = useMemo(
    () => computeSpreadOpportunities(pairs, books, indPrices),
    [pairs, books, indPrices],
  );
  const spreadOppIds = useMemo(
    () => [...spreadOpp.standalone.map((l) => l.id), ...spreadOpp.routes.map((r) => r.id)],
    [spreadOpp],
  );
  const spreadOppAge = useOpportunityAge(spreadOppIds);

  const statusDot = status === 'connected' ? 'ok'
    : status === 'connecting' || status === 'reconnecting' ? 'warn' : 'off';

  const ts = lastUpdate instanceof Date
    ? lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="dealer-opp-panel">
      <div className="dealer-opp-header">
        <div className="dealer-opp-header-left">
          <h4 className="dealer-opp-title">
            Oportunidades de mercado
            <SideswapBadge title="Livro público SideSwap — WebSocket direto, sem passar pelo manager" />
          </h4>
          <div className="dealer-opp-source">
            <span className={`dealer-opp-status-dot ${statusDot}`} />
            <span className="dealer-opp-status-text">
              SideSwap{status === 'connecting' ? ' · conectando…' : status === 'reconnecting' ? ' · reconectando…' : status === 'error' ? ' · erro' : ''}
            </span>
            {ts && <span className="dealer-opp-ts">{ts}</span>}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={reconnect}
          title="Reconectar ao livro público"
          className="dealer-opp-reconnect"
        >
          <TbRefresh />
        </Button>
      </div>

      <p className="dealer-opp-intro">
        Varredura do livro público SideSwap — spread amplo, cobertura e vendas abaixo do{' '}
        <code>ind_price</code>. Alertas Telegram em Configurações → Telegram.
      </p>

      <div className="dealer-opp-view-tabs mb-3">
        <button
          type="button"
          className={`dealer-opp-view-tab${viewMode === 'spread' ? ' active' : ''}`}
          onClick={() => setViewMode('spread')}
        >
          Spread &amp; cobertura
        </button>
        <button
          type="button"
          className={`dealer-opp-view-tab${viewMode === 'below' ? ' active' : ''}`}
          onClick={() => setViewMode('below')}
        >
          Abaixo do mercado
          {belowMarketByPair.length > 0 && (
            <Badge bg="success" className="ms-1">{belowMarketByPair.length}</Badge>
          )}
        </button>
        <button
          type="button"
          className={`dealer-opp-view-tab${viewMode === 'arbitragem' ? ' active' : ''}`}
          onClick={() => setViewMode('arbitragem')}
        >
          Spread Opportunity
          {spreadOpp.total > 0 && (
            <Badge bg="danger" className="ms-1 dealer-opp-tab-badge">{spreadOpp.total}</Badge>
          )}
        </button>
        <button
          type="button"
          className={`dealer-opp-view-tab${viewMode === 'metas' ? ' active' : ''}`}
          onClick={() => setViewMode('metas')}
        >
          Metas de conversão
          {goals.length > 0 && (
            <Badge bg="secondary" className="ms-1 dealer-opp-tab-badge">{goals.length}</Badge>
          )}
        </button>
      </div>

      {error && <p className="dealer-placement-error">{error}</p>}

      {status === 'idle' && (
        <p className="dealer-empty">Aguardando dados de ativos para iniciar varredura.</p>
      )}

      {(status === 'connecting') && !sortedPairs.length && (
        <p className="dealer-empty">Conectando ao livro SideSwap…</p>
      )}

      {viewMode === 'below' ? (
        <>
          <p className="dealer-opp-below-hint">
            Ordens <strong>Sell</strong> com preço ≥ {belowMarketThresholdPct}% abaixo do ind_price SideSwap.
          </p>
          {belowMarketByPair.length === 0 && status === 'connected' && (
            <p className="dealer-empty">Nenhuma venda abaixo do mercado nos pares monitorados.</p>
          )}
          <div className="dealer-opp-grid">
            {belowMarketByPair.map(({ pair, hits, indPrice }) => (
              <BelowMarketCard
                key={pair.key}
                pair={pair}
                hits={hits}
                indPrice={indPrice}
                marketUrl={pair.marketUrl}
              />
            ))}
          </div>
        </>
      ) : viewMode === 'arbitragem' ? (
        <>
          <p className="dealer-opp-below-hint">
            Duas trocas seguidas entre L-BTC, USDt e DePix que rendem pelo menos {ROUTE_MIN_PCT}% a mais
            que a troca direta. Uma ordem sozinha aparece quando o desconto está entre 6% e 20%.
            O Telegram repete o alerta a cada 1h enquanto a oportunidade durar.
          </p>
          {spreadOpp.total === 0 && status === 'connected' && (
            <p className="dealer-empty">Nenhuma Spread Opportunity no momento.</p>
          )}
          <div className="dealer-opp-grid dealer-opp-grid-arbitragem">
            {spreadOpp.standalone.map((leg) => (
              <StandaloneOpportunityCard key={leg.id} leg={leg} age={formatAge(spreadOppAge.get(leg.id))} />
            ))}
            {spreadOpp.routes.map((route) => (
              <RouteOpportunityCard key={route.id} route={route} age={formatAge(spreadOppAge.get(route.id))} />
            ))}
          </div>
        </>
      ) : viewMode === 'metas' ? (
        <>
          <p className="dealer-opp-below-hint">
            Preferência estrutural de inventário — "tenho X e quero estar em Y", independente de
            haver arbitragem agora. Roda no backend (não precisa do navegador aberto) e avisa no
            Telegram quando a rota ficar favorável, a cada 1h enquanto durar.
          </p>
          {!sendCommand ? (
            <p className="dealer-empty">Conecte-se ao manager para configurar metas.</p>
          ) : (
            <>
              <GoalForm onAdd={handleAddGoal} />
              {goalsError && <p className="dealer-placement-error">{goalsError}</p>}
              {goals.length === 0 ? (
                <p className="dealer-empty">Nenhuma meta marcada ainda.</p>
              ) : (
                <div className="dealer-opp-grid">
                  {goals.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      legs={spreadOpp.legs}
                      onRemove={handleRemoveGoal}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      ) : (
      <div className="dealer-opp-grid">
        {sortedPairs.map((pair) => (
          <OpportunityCard
            key={pair.key}
            pair={pair}
            book={books[pair.key] || []}
            indPrice={indPrices[pair.key]}
            dealerOrderIds={dealerOrderIds}
            onGoToOrder={onGoToOrder}
          />
        ))}
      </div>
      )}
    </div>
  );
}
