import React from 'react';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import { TbExternalLink, TbRefresh, TbCircleCheck, TbCircleX, TbAlertTriangle } from 'react-icons/tb';
import useSideswapBook from './useSideswapBook';
import OrderMarginBadge from './OrderMarginBadge';
import { computeExternalMargin, computeVsBookTop } from './utils/orderMargin';
import {
  describeMarketNormalize,
  formatBookPrice,
  sortBookSide,
} from './utils/sideswapBook';
import { prepareDealerOrders } from './utils/orderMarketNormalize';

function PlacementBadge({ found, label }) {
  if (found) {
    return <Badge bg="success" className="dealer-placement-badge"><TbCircleCheck /> {label}</Badge>;
  }
  return <Badge bg="danger" className="dealer-placement-badge"><TbCircleX /> {label || 'offline'}</Badge>;
}

function MiniBook({ orders, tradeDir, highlightId, limit = 6 }) {
  const side = sortBookSide(orders, tradeDir).slice(0, limit);
  if (!side.length) {
    return <p className="dealer-empty">Sem ordens {tradeDir} no book.</p>;
  }
  return (
    <div className="dealer-mini-book">
      {side.map((o, idx) => {
        const mine = String(o.order_id) === String(highlightId);
        return (
          <div key={o.order_id} className={`dealer-mini-book-row ${mine ? 'mine' : ''}`}>
            <span className="dealer-mini-book-pos">{idx + 1}</span>
            <span className="dealer-mini-book-price">{formatBookPrice(o.price)}</span>
            <span className="dealer-mini-book-id">{o.order_id}</span>
            {mine && <span className="dealer-mini-book-tag">nossa</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function OrderPlacementPanel({ dealer, assets, combinations = [] }) {
  const { orders: prepared } = prepareDealerOrders(dealer?.orders || []);
  const ownOrders = prepared.filter((o) => o.order_id);
  const {
    status, error, lastUpdate, pairs, books, indPrices, placements, reconnect,
  } = useSideswapBook(ownOrders, assets, ownOrders.length > 0, combinations);

  if (!dealer) {
    return (
      <section className="dealer-order-placement">
        <h3>Livro SideSwap (público)</h3>
        <p className="dealer-empty">Selecione um dealer para verificar ordens no mercado público.</p>
      </section>
    );
  }

  if (!ownOrders.length) {
    const pending = prepared.length - ownOrders.length;
    return (
      <section className="dealer-order-placement">
        <h3>Livro SideSwap (público)</h3>
        <p className="dealer-empty">
          {pending > 0
            ? `${pending} ordem(ns) pendente(s) — nenhuma enviada ao SideSwap ainda.`
            : 'Nenhuma ordem ativa neste dealer.'}
        </p>
      </section>
    );
  }

  const statusLabel = {
    idle: 'aguardando',
    connecting: 'conectando…',
    connected: 'SideSwap online',
    reconnecting: 'reconectando…',
    error: 'erro',
  }[status] || status;

  return (
    <section className="dealer-order-placement">
      <div className="dealer-placement-header">
        <h3>Livro SideSwap (público)</h3>
        <div className="dealer-placement-actions">
          <span className={`dealer-placement-status ${status}`}>{statusLabel}</span>
          <Button variant="outline-secondary" size="sm" onClick={reconnect} title="Reconectar">
            <TbRefresh />
          </Button>
        </div>
      </div>

      <p className="dealer-placement-intro">
        Verificação independente via{' '}
        <a href="https://sideswap.io/docs/" target="_blank" rel="noopener noreferrer">API pública SideSwap</a>
        {' '}— mesma fonte do{' '}
        <a href="https://sideswap.io/swap-market/" target="_blank" rel="noopener noreferrer">Swap Market</a>.
      </p>

      {error && <p className="dealer-placement-error">{error}</p>}
      {lastUpdate && (
        <p className="dealer-placement-ts">Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}</p>
      )}

      {placements.map((item) => {
        const {
          order, market, found, label, marketUrl, backendLabel, backendFound, sideOrders,
        } = item;
        const book = books[item.pairKey] || [];
        const mismatch = backendFound != null && backendFound !== found;
        const marketRef = indPrices[item.pairKey];
        const invertedPair = market?.inverted;
        const unpublished = !order.order_id;
        const canComparePrices = !invertedPair && !unpublished;
        const externalMargin = canComparePrices && marketRef?.indPrice != null
          ? computeExternalMargin(order, marketRef.indPrice)
          : null;
        const bookTradeDir = market?.marketTradeDir || order.trade_dir;
        const vsTop = canComparePrices
          ? computeVsBookTop(
            { ...order, trade_dir: bookTradeDir },
            book.length ? book : sideOrders,
          )
          : null;
        const dealerRef = parseFloat(order.original_price);
        const refMatches = externalMargin?.referencePrice != null
          && Number.isFinite(dealerRef)
          && Math.abs(dealerRef - externalMargin.referencePrice) / externalMargin.referencePrice < 0.0005;
        const cardKey = order.order_id
          ? `${order.order_id}-${order.trade_dir}`
          : `${order.base}-${order.quote}-${order.trade_dir}`;

        return (
          <div key={cardKey} className="dealer-placement-card">
            <div className="dealer-placement-card-head">
              <strong>
                {order.trade_dir} {order.base}/{order.quote}
              </strong>
              <span className="dealer-placement-price">
                @ {formatBookPrice(order.price ?? order.original_price)}
              </span>
            </div>

            <div className="dealer-placement-meta">
              <span>
                ID:{' '}
                {order.order_id
                  ? <code>{order.order_id}</code>
                  : <em className="dealer-placement-unpublished">não publicada</em>}
              </span>
              <OrderMarginBadge order={order} showPm explicit />
              <PlacementBadge found={found} label={found ? `posição ${label}` : 'não encontrada'} />
            </div>

            {invertedPair && (
              <p className="dealer-placement-warn dealer-placement-invert-note">
                <TbAlertTriangle />
                {' '}Par local <strong>{order.base}/{order.quote}</strong> não existe na SideSwap.
                Livro público: <strong>{market.marketBase}/{market.marketQuote}</strong>
                {' '}({describeMarketNormalize(order.base, order.quote, order.trade_dir, combinations)}).
                Preços locais não são comparáveis ao ind_price desse mercado.
              </p>
            )}

            {unpublished && (
              <p className="dealer-placement-warn">
                <TbAlertTriangle />
                {' '}Ordem ainda sem <code>order_id</code> — submit falhou ou está pendente
                (SideSwap rejeita <strong>USDt/L-BTC</strong>; use <strong>L-BTC/USDt</strong>).
              </p>
            )}

            <div className="dealer-placement-compare">
              <span>SideSwap público: <strong>{found ? label : 'ausente'}</strong></span>
              {backendLabel && (
                <span>Dealer local: <strong>{backendLabel}</strong></span>
              )}
              {mismatch && (
                <span className="dealer-placement-warn">
                  <TbAlertTriangle /> divergência entre book local e público
                </span>
              )}
            </div>

            {canComparePrices && externalMargin?.kind && (
              <div className="dealer-placement-verify">
                <div className="dealer-placement-verify-title">Conferência externa (SideSwap)</div>
                <div className="dealer-placement-verify-row">
                  <span>Ref. mercado (ind_price): <strong>{formatBookPrice(marketRef.indPrice)}</strong></span>
                  <span className={`dealer-order-margin dealer-order-margin-${externalMargin.kind}`}>
                    {externalMargin.label}
                  </span>
                </div>
                {Number.isFinite(dealerRef) && (
                  <div className="dealer-placement-verify-row">
                    <span>Ref. dealer (original_price): <strong>{formatBookPrice(dealerRef)}</strong></span>
                    <span className={refMatches ? 'dealer-verify-ok' : 'dealer-verify-warn'}>
                      {refMatches ? '✓ alinhado com ind_price' : '≠ difere do ind_price público'}
                    </span>
                  </div>
                )}
                {vsTop && (
                  <div className="dealer-placement-verify-row">
                    <span>Topo {bookTradeDir}: <strong>{formatBookPrice(vsTop.topPrice)}</strong></span>
                    <span>{vsTop.label}</span>
                  </div>
                )}
              </div>
            )}

            {marketUrl && (
              <a
                href={marketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="dealer-placement-link"
              >
                <TbExternalLink /> Ver {market?.marketBase}/{market?.marketQuote} no Swap Market
              </a>
            )}

            {found && (
              <div className="dealer-placement-book-preview">
                <div className="dealer-placement-book-col">
                  <div className="dealer-placement-book-title">Top {bookTradeDir}</div>
                  <MiniBook
                    orders={book.length ? book : sideOrders}
                    tradeDir={bookTradeDir}
                    highlightId={order.order_id}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {pairs.map((pair) => {
        const count = (books[pair.key] || []).length;
        const marketLabel = `${pair.base}/${pair.quote}`;
        const dealerOnly = pair.dealerLabels?.filter((l) => l !== marketLabel) || [];
        return (
          <div key={pair.key} className="dealer-placement-pair-meta">
            {marketLabel} — {count} ordens no book público
            {dealerOnly.length > 0 && (
              <span className="dealer-placement-pair-note">
                {' '}(ordens locais em {dealerOnly.join(', ')} → mercado {marketLabel})
              </span>
            )}
          </div>
        );
      })}
    </section>
  );
}
