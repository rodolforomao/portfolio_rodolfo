import React, { useMemo } from 'react';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import { TbExternalLink, TbRefresh, TbCircleCheck, TbCircleX, TbAlertTriangle } from 'react-icons/tb';
import { SideswapBadge, ManagerBadge } from './SourceBadge';
import OrderMarginBadge from './OrderMarginBadge';
import OrderBookPresenceBadge from './OrderBookPresenceBadge';
import { FollowRefLink, bookOrderAnchorId } from './utils/followTarget';
import { computeExternalMargin, computeVsBookTop, marginFromPriceDiff } from './utils/orderMargin';
import {
  describeMarketNormalize,
  formatBookPrice,
  formatBookAmount,
  formatBookNotional,
  sortBookSide,
  sortPlacementsByBook,
} from './utils/sideswapBook';
import { prepareDealerOrders } from './utils/orderMarketNormalize';
import { assessOrderBookPresence } from './utils/orderPlacementStatus';
import { formatAssetBalance } from './utils/dealerFormat';

function PlacementBadge({ found, label, variant = 'danger', hint }) {
  if (found) {
    return (
      <Badge bg="success" className="dealer-placement-badge" title={hint}>
        <TbCircleCheck /> {label}
      </Badge>
    );
  }
  const bg = variant === 'warning' ? 'warning' : variant === 'secondary' ? 'secondary' : 'danger';
  const text = variant === 'warning' ? 'dark' : undefined;
  return (
    <Badge bg={bg} text={text} className="dealer-placement-badge" title={hint}>
      <TbCircleX /> {label || 'offline'}
    </Badge>
  );
}

function MiniBook({
  orders,
  tradeDir,
  highlightId,
  followRefId,
  indPrice,
  baseAsset,
  quoteAsset,
  dealerAmountById = {},
  limit = 6,
}) {
  const side = sortBookSide(orders, tradeDir).slice(0, limit);
  const showPct = indPrice != null && Number.isFinite(Number(indPrice));
  if (!side.length) {
    return <p className="dealer-empty">Sem ordens {tradeDir} no book.</p>;
  }

  const resolveAmount = (o) => {
    const bookAmt = o.amount;
    if (bookAmt != null && Number.isFinite(Number(bookAmt))) return bookAmt;
    const id = String(o.order_id);
    if (dealerAmountById[id] != null) return dealerAmountById[id];
    return null;
  };

  return (
    <div className={`dealer-mini-book dealer-mini-book-extended${showPct ? ' dealer-mini-book-with-pct' : ''}`}>
      <div className="dealer-mini-book-head" aria-hidden="true">
        <span>#</span>
        <span>Preço</span>
        {showPct && <span title="Diferença vs ind_price SideSwap">vs mercado</span>}
        <span title={`Quantidade (${baseAsset || 'base'})`}>Amount</span>
        <span title={quoteAsset ? `Total em ${quoteAsset}` : 'Total (amount × preço)'}>Total</span>
        <span>ID</span>
        <span />
      </div>
      {side.map((o, idx) => {
        const mine = String(o.order_id) === String(highlightId);
        const followRef = followRefId && String(o.order_id) === String(followRefId);
        const rowClass = [
          'dealer-mini-book-row',
          mine ? 'mine' : '',
          followRef ? 'follow-ref' : '',
        ].filter(Boolean).join(' ');
        const anchor = bookOrderAnchorId(o.order_id);
        const dir = o.trade_dir || tradeDir;
        const vsMarket = showPct
          ? marginFromPriceDiff({ trade_dir: dir, price: o.price }, indPrice, 'sideswap')
          : null;
        const amount = resolveAmount(o);
        const amountLabel = formatBookAmount(amount, baseAsset);
        const notional = formatBookNotional(amount, o.price, quoteAsset);
        return (
          <div key={o.order_id} id={anchor || undefined} className={rowClass}>
            <span className="dealer-mini-book-pos">{idx + 1}</span>
            <span className="dealer-mini-book-price">{formatBookPrice(o.price)}</span>
            {showPct && (
              <span
                className={`dealer-mini-book-pct dealer-order-margin dealer-order-margin-${vsMarket?.kind || 'na'}`}
                title={vsMarket?.label || 'vs ind_price'}
              >
                {vsMarket?.shortLabel ?? '—'}
              </span>
            )}
            <span
              className={`dealer-mini-book-amount${mine ? ' mine' : ''}`}
              title={mine ? 'Amount configurado no dealer' : undefined}
            >
              {amountLabel}
            </span>
            <span className="dealer-mini-book-total" title="amount × preço">
              {notional ?? '—'}
            </span>
            <span className="dealer-mini-book-id">{o.order_id}</span>
            {mine && <span className="dealer-mini-book-tag">nossa</span>}
            {followRef && !mine && <span className="dealer-mini-book-tag follow">alvo</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function OrderPlacementPanel({
  dealer,
  combinations = [],
  ownOrders = [],
  status = 'idle',
  error = null,
  lastUpdate = null,
  pairs = [],
  books = {},
  indPrices = {},
  placements = [],
  reconnect = () => {},
}) {
  const { orders: prepared } = prepareDealerOrders(dealer?.orders || []);

  const dealerAmountById = useMemo(() => {
    const map = {};
    for (const o of ownOrders) {
      if (o.order_id != null && o.amount != null) {
        map[String(o.order_id)] = o.amount;
      }
    }
    return map;
  }, [ownOrders]);

  const sortedPlacements = useMemo(
    () => sortPlacementsByBook(placements),
    [placements],
  );

  if (!dealer) {
    return (
      <section className="dealer-order-placement">
        <h3>Livro SideSwap (público) <SideswapBadge /></h3>
        <p className="dealer-empty">Selecione um dealer para verificar ordens no mercado público.</p>
      </section>
    );
  }

  if (!ownOrders.length) {
    const pending = prepared.length - ownOrders.length;
    return (
      <section className="dealer-order-placement">
        <h3>Livro SideSwap (público) <SideswapBadge /></h3>
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
        <h3>
          Livro SideSwap (público)
          <SideswapBadge title="Posições do livro via WebSocket público SideSwap" />
          <ManagerBadge title="Suas ordens via manager_dealer" />
        </h3>
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

      {sortedPlacements.map((item) => {
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

        const presence = assessOrderBookPresence({
          order,
          balances: dealer?.balances,
          found,
          unpublished,
          invertedPair,
          bookLabel: found ? label : null,
        });
        const badgeLabel = presence.badgeLabel;
        const publicLabel = presence.key === 'found' ? label : presence.publicLabel;
        const cardClass = [
          'dealer-placement-card',
          presence.key === 'erro' ? 'dealer-placement-card-erro' : '',
          presence.key === 'sem_ativo' ? 'dealer-placement-card-sem-ativo' : '',
        ].filter(Boolean).join(' ');

        return (
          <div key={cardKey} className={cardClass}>
            <div className="dealer-placement-card-head">
              <strong>
                {order.trade_dir} {order.base}/{order.quote}
              </strong>
              <span className="dealer-placement-price">
                @ {formatBookPrice(order.price ?? order.original_price)}
              </span>
              {order.amount != null && (
                <span className="dealer-placement-amount">
                  · amt {formatBookAmount(order.amount, market?.marketBase || order.base)}
                </span>
              )}
            </div>

            <div className="dealer-placement-meta">
              <span>
                ID:{' '}
                {order.order_id
                  ? <code>{order.order_id}</code>
                  : <em className="dealer-placement-unpublished">não publicada</em>}
              </span>
              <OrderMarginBadge order={order} showPm />
              {order.follow_ref_order_id && (
                <span className="dealer-placement-follow-ref">
                  alvo: <FollowRefLink orderId={order.follow_ref_order_id} />
                </span>
              )}
              <PlacementBadge
                found={found}
                label={badgeLabel}
                variant={presence.variant}
                hint={presence.hint}
              />
            </div>

            {presence.key === 'sem_ativo' && (
              <p className="dealer-placement-warn dealer-placement-sem-ativo-note">
                <TbAlertTriangle />
                {' '}Ordem ativa no dealer, mas <strong>sem ativo</strong>
                {' '}(sem <strong>{presence.fundingAsset}</strong>
                {presence.balance != null && presence.balance > 0 && (
                  <> — saldo {formatAssetBalance(presence.fundingAsset, presence.balance)}</>
                )}
                ). Sem o ativo, o SideSwap mantém <code>active_amount = 0</code>
                {' '}e a ordem não aparece no livro público.
              </p>
            )}

            {presence.key === 'erro' && (
              <p className="dealer-placement-erro dealer-placement-erro-note" role="alert">
                <TbAlertTriangle />
                {' '}<strong>Erro:</strong> ordem <code>{order.order_id}</code> publicada no dealer
                com saldo de <strong>{presence.fundingAsset}</strong>
                {' '}({formatAssetBalance(presence.fundingAsset, presence.balance)}),
                mas <strong>ausente do livro público SideSwap</strong>.
                {' '}Verifique sync, watchdog ou reenvio da ordem.
              </p>
            )}

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
              <span>
                SideSwap público:{' '}
                <strong className={
                  presence.key === 'sem_ativo' ? 'dealer-placement-sem-ativo'
                    : presence.key === 'erro' ? 'dealer-placement-erro-text' : ''
                }>
                  {publicLabel}
                </strong>
              </span>
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
                  <div className="dealer-placement-book-title">
                    Top {bookTradeDir}
                    {canComparePrices && marketRef?.indPrice != null && (
                      <span className="dealer-placement-book-ind">
                        {' '}· ind {formatBookPrice(marketRef.indPrice)}
                      </span>
                    )}
                  </div>
                  <MiniBook
                    orders={book.length ? book : sideOrders}
                    tradeDir={bookTradeDir}
                    highlightId={order.order_id}
                    followRefId={order.follow_ref_order_id}
                    indPrice={canComparePrices ? marketRef?.indPrice : null}
                    baseAsset={market?.marketBase || order.base}
                    quoteAsset={market?.marketQuote || order.quote}
                    dealerAmountById={dealerAmountById}
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
