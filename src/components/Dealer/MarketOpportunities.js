import React, { useMemo } from 'react';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import { TbRefresh, TbExternalLink, TbAlertTriangle, TbCircleCheck, TbMinus } from 'react-icons/tb';
import { sortBookSide, formatBookPrice } from './utils/sideswapBook';
import { prepareDealerOrders } from './utils/orderMarketNormalize';

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

  const noData = !book || book.length === 0;

  return (
    <div className={`dealer-opp-card dealer-opp-${oppKind}${covered ? ' covered' : ''}`}>
      {/* Cabeçalho */}
      <div className="dealer-opp-head">
        <div className="dealer-opp-pair">
          <span className="dealer-opp-pair-name">{pair.base}/{pair.quote}</span>
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
}) {
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

  const statusDot = status === 'connected' ? 'ok'
    : status === 'connecting' || status === 'reconnecting' ? 'warn' : 'off';

  const ts = lastUpdate instanceof Date
    ? lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="dealer-opp-panel">
      <div className="dealer-opp-header">
        <div className="dealer-opp-header-left">
          <h4 className="dealer-opp-title">Oportunidades de mercado</h4>
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
        Varredura do livro público SideSwap — pares onde o spread está amplo e/ou não temos cobertura.
        Score calculado em tempo real: spread × profundidade × presença.
      </p>

      {error && <p className="dealer-placement-error">{error}</p>}

      {status === 'idle' && (
        <p className="dealer-empty">Aguardando dados de ativos para iniciar varredura.</p>
      )}

      {(status === 'connecting') && !sortedPairs.length && (
        <p className="dealer-empty">Conectando ao livro SideSwap…</p>
      )}

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
    </div>
  );
}
