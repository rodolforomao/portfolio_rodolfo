import React, { useMemo } from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import { TbRefresh } from 'react-icons/tb';
import {
  describeMarketNormalize,
  formatBookAmount,
  formatBookNotional,
  formatBookPrice,
  marketPairKeyFromNames,
  normalizeMarketOrder,
  sortBookSide,
} from './utils/sideswapBook';
import { marginFromPriceDiff } from './utils/orderMargin';

function ChoiceChip({ item, selected, onSelect }) {
  const priceLabel = item.order.price != null
    ? formatBookPrice(item.order.price)
    : item.order.original_price != null
      ? formatBookPrice(item.order.original_price)
      : null;

  return (
    <button
      type="button"
      className={`dealer-follow-choice${selected ? ' selected' : ''}`}
      onClick={() => onSelect(String(item.order.order_id))}
      title={`PID ${item.pid} · ${item.wallet_name || '—'}`}
    >
      <span className="dealer-follow-choice-meta">
        PID {item.pid} · {item.wallet_name || '—'}
      </span>
      <span className="dealer-follow-choice-id">#{item.order.order_id}</span>
      {priceLabel && <span className="dealer-follow-choice-price">@ {priceLabel}</span>}
    </button>
  );
}

function SelectableMiniBook({
  orders,
  tradeDir,
  selectedId,
  onSelect,
  indPrice,
  baseAsset,
  quoteAsset,
  limit = 8,
}) {
  const side = sortBookSide(orders, tradeDir).slice(0, limit);
  const showPct = indPrice != null && Number.isFinite(Number(indPrice));

  if (!side.length) {
    return <p className="dealer-empty dealer-follow-book-empty">Sem ordens {tradeDir} no livro público.</p>;
  }

  return (
    <div className={`dealer-mini-book dealer-mini-book-extended dealer-follow-book${showPct ? ' dealer-mini-book-with-pct' : ''}`}>
      <div className="dealer-mini-book-head" aria-hidden="true">
        <span>#</span>
        <span>Preço</span>
        {showPct && <span>vs mercado</span>}
        <span>Amount</span>
        <span>Total</span>
        <span>ID</span>
        <span />
      </div>
      {side.map((o, idx) => {
        const selected = String(o.order_id) === String(selectedId);
        const dir = o.trade_dir || tradeDir;
        const vsMarket = showPct
          ? marginFromPriceDiff({ trade_dir: dir, price: o.price }, indPrice, 'sideswap')
          : null;
        const amountLabel = formatBookAmount(o.amount, baseAsset);
        const notional = formatBookNotional(o.amount, o.price, quoteAsset);
        return (
          <button
            type="button"
            key={o.order_id}
            className={[
              'dealer-mini-book-row',
              'dealer-follow-book-row',
              selected ? 'selected' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onSelect(String(o.order_id))}
            title={`Selecionar ordem #${o.order_id}`}
            aria-pressed={selected}
          >
            <span className="dealer-mini-book-pos">{idx + 1}</span>
            <span className="dealer-mini-book-price">{formatBookPrice(o.price)}</span>
            {showPct && (
              <span
                className={`dealer-mini-book-pct dealer-order-margin dealer-order-margin-${vsMarket?.kind || 'na'}`}
              >
                {vsMarket?.shortLabel ?? '—'}
              </span>
            )}
            <span className="dealer-mini-book-amount">{amountLabel}</span>
            <span className="dealer-mini-book-total">{notional ?? '—'}</span>
            <span className="dealer-mini-book-id">{o.order_id}</span>
            {selected && <span className="dealer-mini-book-tag">alvo</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function FollowTargetPicker({
  followTargetOrderId = '',
  onFollowTargetOrderIdChange,
  followTargetChoices = [],
  base = 'L-BTC',
  quote = 'USDt',
  tradeDir = 'Buy',
  assets = [],
  combinations = [],
  books = {},
  indPrices = {},
  bookStatus = 'idle',
  bookError = null,
  onReconnectBook,
}) {
  const market = useMemo(
    () => normalizeMarketOrder(base, quote, tradeDir, combinations),
    [base, quote, tradeDir, combinations],
  );

  const pairKey = useMemo(
    () => marketPairKeyFromNames(base, quote, assets, combinations),
    [base, quote, assets, combinations],
  );

  const bookOrders = pairKey ? (books[pairKey] || []) : [];
  const indPrice = pairKey ? indPrices[pairKey]?.indPrice : null;
  const marketLabel = describeMarketNormalize(base, quote, tradeDir, combinations);

  const handleSelect = (id) => {
    if (onFollowTargetOrderIdChange) onFollowTargetOrderIdChange(id);
  };

  return (
    <div className="dealer-follow-picker">
      {followTargetChoices.length > 0 && (
        <div className="dealer-follow-picker-section">
          <div className="dealer-follow-picker-title">Ordens dos dealers</div>
          <div className="dealer-follow-choices">
            {followTargetChoices.map((item) => (
              <ChoiceChip
                key={item.cancelKey}
                item={item}
                selected={String(followTargetOrderId) === String(item.order.order_id)}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      )}

      <div className="dealer-follow-picker-section">
        <div className="dealer-follow-picker-head">
          <div className="dealer-follow-picker-title">
            Livro SideSwap — {marketLabel}
          </div>
          {onReconnectBook && (
            <Button
              size="sm"
              variant="outline-secondary"
              className="dealer-follow-book-reload"
              onClick={onReconnectBook}
              title="Reconectar livro SideSwap"
            >
              <TbRefresh aria-hidden />
            </Button>
          )}
        </div>
        {bookStatus === 'connecting' && (
          <p className="dealer-empty dealer-follow-book-status">Conectando ao livro…</p>
        )}
        {bookError && bookStatus === 'error' && (
          <p className="dealer-follow-book-err">{bookError}</p>
        )}
        <SelectableMiniBook
          orders={bookOrders}
          tradeDir={market.marketTradeDir}
          selectedId={followTargetOrderId}
          onSelect={handleSelect}
          indPrice={indPrice}
          baseAsset={market.marketBase}
          quoteAsset={market.marketQuote}
        />
        <p className="dealer-follow-book-hint">
          Clique em uma linha do livro para usar o order_id como alvo.
        </p>
      </div>

      <div className="dealer-follow-picker-manual">
        <div className="dealer-field-label">ID manual</div>
        <Form.Control
          size="sm"
          type="text"
          placeholder="ex: 1781867960816"
          value={followTargetOrderId}
          className={!followTargetOrderId ? 'dealer-follow-select-empty' : ''}
          onChange={(e) => handleSelect(e.target.value)}
        />
      </div>
    </div>
  );
}
