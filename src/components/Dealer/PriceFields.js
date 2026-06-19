import React from 'react';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

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

export function buildPriceParams({ price, pricePorc, priceMin }) {
  const p = {};
  const fixed = parsePriceInput(price);
  const porc = parsePercentInput(pricePorc);
  const min = parsePercentInput(priceMin);
  if (fixed !== null) p.price = fixed;
  if (porc !== null) p.price_porc = porc;
  if (min !== null) p.price_min = min;
  return p;
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

export function formatOrderSpreadSummary(order) {
  if (!order) return '—';
  if (order.price != null && order.price !== '') {
    return `preço fixo ${formatPriceForInput(order.price)}`;
  }
  if (order.price_porc != null && order.price_porc !== '') {
    return `spread ${formatPercentForInput(order.price_porc)}%`;
  }
  if (order.price_min != null && order.price_min !== '') {
    return `pm ${formatPercentForInput(order.price_min)}%`;
  }
  return '—';
}

export function orderToSpreadForm(order) {
  if (!order) {
    return { base: 'L-BTC', quote: 'USDt', tradeDir: 'Buy', price: '', pricePorc: '', priceMin: '' };
  }
  return {
    base: order.base || 'L-BTC',
    quote: order.quote || 'USDt',
    tradeDir: order.trade_dir || 'Buy',
    price: order.price != null && order.price !== '' ? formatPriceForInput(order.price) : '',
    pricePorc: order.price_porc != null && order.price_porc !== ''
      ? formatPercentForInput(order.price_porc) : '',
    priceMin: order.price_min != null && order.price_min !== ''
      ? formatPercentForInput(order.price_min) : '',
  };
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
  onPriceChange,
  onPricePorcChange,
  onPriceMinChange,
  onAmountChange,
  showAmount = true,
}) {
  return (
    <div className="dealer-price-fields">
      <p className="dealer-price-intro">
        Preencha <strong>apenas um</strong> dos três campos abaixo (como no terminal).
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
            placeholder="ex: 0,35"
            value={pricePorc}
            onChange={(e) => onPricePorcChange(e.target.value)}
          />
        </Col>
        <Col xs={12} md={4}>
          <FieldLabel
            title="Spread mín. (pm %)"
            hint="Piso dinâmico via order book. Ex.: 0,35 = pm 0,35% no terminal."
          />
          <Form.Control
            size="sm"
            type="text"
            inputMode="decimal"
            placeholder="ex: 0,35"
            value={priceMin}
            onChange={(e) => onPriceMinChange(e.target.value)}
          />
        </Col>
      </Row>

      {showAmount && (
        <div className="mt-2">
          <FieldLabel
            title="Quantidade máx. (amount)"
            hint="Limite de quantidade da ordem. Padrão 999999 = sem limite prático."
          />
          <Form.Control
            size="sm"
            type="text"
            inputMode="numeric"
            placeholder="999999"
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
