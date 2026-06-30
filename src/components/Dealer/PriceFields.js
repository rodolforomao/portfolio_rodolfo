import React from 'react';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import {
  formatOrderConfigSummary,
  orderConfigToFormFields,
} from './utils/orderPricing';
import FollowTargetPicker from './FollowTargetPicker';

/**
 * Converte entrada humana (%) para decimal do backend.
 * Terminal: "0.35%" → price_porc = 0.0035
 */
export function parsePercentInput(value) {
  if (!value || !String(value).trim()) return null;
  const n = parseFloat(String(value).replace(',', '.').replace('%', '').trim());
  return Number.isFinite(n) ? n / 100 : null;
}

export function parsePriceInput(value) {
  if (!value || !String(value).trim()) return null;
  const n = parseFloat(String(value).replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

export function buildPriceParams({
  price, pricePorc, priceMin, followTarget, followTargetOrderId, followTargetPosition,
}) {
  const p = {};
  const min = parsePercentInput(priceMin);
  if (followTarget) {
    p.follow_target = true;
    if (min !== null) p.price_min = min;
    const pin = String(followTargetOrderId || '').trim();
    if (pin) p.follow_target_order_id = pin;
    const pos = parseInt(followTargetPosition, 10);
    if (pos >= 1) p.follow_target_position = pos;
    return p;
  }
  p.follow_target = false;
  p.follow_target_order_id = null;
  p.follow_target_position = null;
  const fixed = parsePriceInput(price);
  const porc = parsePercentInput(pricePorc);
  if (fixed !== null) p.price = fixed;
  if (porc !== null) p.price_porc = porc;
  if (min !== null) p.price_min = min;
  return p;
}

export function validatePriceForm({ price, pricePorc, priceMin, followTarget, followTargetOrderId, followTargetPosition }) {
  if (followTarget) {
    // Com posição alvo definida, order_id é opcional
    const hasPosition = parseInt(followTargetPosition, 10) >= 1;
    const hasPin = !!String(followTargetOrderId || '').trim();
    if (!hasPosition && !hasPin) {
      return {
        ok: false,
        error: 'Selecione uma posição alvo ou ordem específica para o follow_target.',
      };
    }
    if (parsePercentInput(priceMin) === null) {
      return {
        ok: false,
        error: 'Spread mín. (pm %) obrigatório com seguir alvo ativo.',
      };
    }
    return { ok: true };
  }
  const fields = buildPriceParams({ price, pricePorc, priceMin });
  if (!fields.price && fields.price_porc == null && fields.price_min == null) {
    return {
      ok: false,
      error: 'Preencha preço fixo, spread (%) ou spread mín. (pm %).',
    };
  }
  return { ok: true };
}

/** Decimal do backend (0.0035) → entrada humana ("0,35"). */
export function formatPercentForInput(decimal) {
  if (decimal == null || decimal === '') return '';
  const n = Number(decimal);
  if (!Number.isFinite(n)) return '';
  const pct = n * 100;
  const str = pct.toFixed(6).replace(/\.?0+$/, '');
  return str.replace('.', ',');
}

export function formatPriceForInput(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return String(n).replace('.', ',');
}

/** @deprecated use formatOrderConfigSummary — mantido para imports existentes */
export function formatOrderSpreadSummary(order) {
  return formatOrderConfigSummary(order);
}

export function orderToSpreadForm(order) {
  return orderConfigToFormFields(order);
}

export function orderToSendForm(order) {
  const spread = orderToSpreadForm(order);
  return {
    ...spread,
    amount: order?.amount != null ? String(order.amount) : '999999',
  };
}

export default function PriceFields({
  price,
  pricePorc,
  priceMin,
  amount,
  amountAsset = 'base',
  followTarget = false,
  followTargetOrderId = '',
  followTargetPosition = 1,
  followTargetChoices = [],
  base = 'L-BTC',
  quote = 'USDt',
  tradeDir = 'Buy',
  marketAssets = [],
  marketCombinations = [],
  marketBooks = {},
  marketIndPrices = {},
  marketBookStatus = 'idle',
  marketBookError = null,
  onReconnectMarketBook,
  onPriceChange,
  onPricePorcChange,
  onPriceMinChange,
  onAmountChange,
  onAmountAssetChange,
  onFollowTargetChange,
  onFollowTargetOrderIdChange,
  onFollowTargetPositionChange,
  showFollowOptions = true,
  showAmount = true,
}) {
  return (
    <div className="dealer-price-fields">
      {showFollowOptions && onFollowTargetChange && (
        <div className="dealer-follow-block mb-3">
          <Form.Check
            type="switch"
            id="dealer-follow-target"
            className="dealer-follow-switch"
            label="Seguir alvo (follow_target)"
            checked={!!followTarget}
            onChange={(e) => {
              const checked = e.target.checked;
              onFollowTargetChange(checked);
              if (!checked) {
                onFollowTargetOrderIdChange?.('');
                onFollowTargetPositionChange?.(1);
              }
            }}
          />
          <p className="dealer-follow-hint mb-0">
            {followTarget
              ? 'Selecione o dealer alvo abaixo e defina pm % como piso de lucro. Spread calculado automaticamente.'
              : 'Modo clássico: preencha apenas um campo de preço/spread abaixo.'}
          </p>
        </div>
      )}

      <p className="dealer-price-intro">
        {followTarget
          ? <>Com follow ativo, informe o <strong>pm %</strong> (lucro mínimo). Spread fixo é opcional.</>
          : <>Preencha <strong>apenas um</strong> dos três campos abaixo (como no terminal).</>}
      </p>

      <Row className="g-2">
        <Col xs={12} md={4}>
          <FieldLabel
            title="Preço fixo"
            hint="Valor absoluto da ordem no ativo quote (ex.: 119000 em USDt)."
          />
          <Form.Control
            size="sm"
            type="text"
            inputMode="decimal"
            placeholder="ex: 119000"
            value={price}
            disabled={followTarget}
            onChange={(e) => onPriceChange(e.target.value)}
          />
        </Col>
        <Col xs={12} md={4}>
          <FieldLabel
            title="Spread (%)"
            hint="Margem em %. Ex.: digite 0,35 para 0,35% (equivale a 0,35% no terminal)."
          />
          <Form.Control
            size="sm"
            type="text"
            inputMode="decimal"
            placeholder={followTarget ? 'automático' : 'ex: 0,35'}
            value={pricePorc}
            disabled={followTarget}
            onChange={(e) => onPricePorcChange(e.target.value)}
          />
        </Col>
        <Col xs={12} md={4}>
          <FieldLabel
            title="Spread mín. (pm %)"
            hint={followTarget
              ? 'Piso de lucro — obrigatório com follow. Ex.: 1,2 = lucro mínimo 1,2%.'
              : 'Piso dinâmico via order book. Ex.: 0,35 = pm 0,35% no terminal.'}
          />
          <Form.Control
            size="sm"
            type="text"
            inputMode="decimal"
            placeholder={followTarget ? 'ex: 1,2' : 'ex: 0,35'}
            value={priceMin}
            onChange={(e) => onPriceMinChange(e.target.value)}
          />
        </Col>
      </Row>

      {showFollowOptions && followTarget && onFollowTargetOrderIdChange && (
        <div className="mt-2">
          <FieldLabel
            title="Dealer alvo *"
            hint="Selecione uma ordem dos dealers, clique no livro SideSwap ou digite o order_id."
          />
          <FollowTargetPicker
            followTargetOrderId={followTargetOrderId}
            onFollowTargetOrderIdChange={onFollowTargetOrderIdChange}
            followTargetPosition={followTargetPosition}
            onFollowTargetPositionChange={onFollowTargetPositionChange}
            followTargetChoices={followTargetChoices}
            base={base}
            quote={quote}
            tradeDir={tradeDir}
            assets={marketAssets}
            combinations={marketCombinations}
            books={marketBooks}
            indPrices={marketIndPrices}
            bookStatus={marketBookStatus}
            bookError={marketBookError}
            onReconnectBook={onReconnectMarketBook}
          />
        </div>
      )}

      {showAmount && (
        <div className="mt-2">
          <FieldLabel
            title={`Quantidade máx. em ${amountAsset === 'quote' ? quote : base}`}
            hint={
              amountAsset === 'quote'
                ? `Digite em ${quote}. Convertido para ${base} pelo ind_price na hora do envio.`
                : `Limite em ${base}. Padrão 999999 = sem limite prático.`
            }
          />
          {onAmountAssetChange && (
            <div className="dealer-amount-asset-toggle mb-1">
              <button
                type="button"
                className={`dealer-amount-asset-btn${amountAsset === 'base' ? ' active' : ''}`}
                onClick={() => onAmountAssetChange('base')}
              >
                {base}
              </button>
              <button
                type="button"
                className={`dealer-amount-asset-btn${amountAsset === 'quote' ? ' active' : ''}`}
                onClick={() => onAmountAssetChange('quote')}
              >
                {quote}
              </button>
            </div>
          )}
          <Form.Control
            size="sm"
            type="text"
            inputMode="decimal"
            placeholder={amountAsset === 'quote' ? `ex: 2200 ${quote}` : '999999'}
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

function FieldLabel({ title, hint }) {
  return (
    <div className="dealer-field-block">
      <div className="dealer-field-label">{title}</div>
      {hint && <div className="dealer-field-hint">{hint}</div>}
    </div>
  );
}
