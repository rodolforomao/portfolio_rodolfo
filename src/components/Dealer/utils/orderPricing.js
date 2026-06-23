import { formatBookPrice } from './sideswapBook';

function isSet(value) {
  return value != null && value !== '';
}

/** Decimal (0.0035) → "0,35" para exibição. */
export function formatPercentDisplay(decimal) {
  if (!isSet(decimal)) return '';
  const n = Number(decimal);
  if (!Number.isFinite(n)) return '';
  const pct = n * 100;
  const str = pct.toFixed(6).replace(/\.?0+$/, '');
  return str.replace('.', ',');
}

export function formatPriceDisplay(value) {
  if (!isSet(value)) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return String(n).replace('.', ',');
}

/**
 * Modo de precificação CONFIGURADO (o que foi enviado ao manager).
 * `price` em ordens ao vivo é o preço calculado no book — não implica preço fixo.
 */
export function getOrderPricingMode(order) {
  if (!order) return 'none';
  if (order.follow_target) return 'follow';
  if (order.pending && !order.order_id) return 'pending';
  if (isSet(order.price_porc)) return 'spread';
  if (isSet(order.price_min)) return 'pm';
  if (isSet(order.price)) return 'fixed';
  return 'none';
}

/** Resumo do parâmetro enviado — nunca confunde preço do livro com preço fixo. */
export function formatOrderConfigSummary(order) {
  if (!order) return '—';

  const mode = getOrderPricingMode(order);

  if (mode === 'follow') {
    const pm = isSet(order.price_min)
      ? `pm ${formatPercentDisplay(order.price_min)}%`
      : 'pm —';
    const ref = order.follow_ref_order_id
      ? ` → #${order.follow_ref_order_id}`
      : order.follow_target_order_id
        ? ` pin #${order.follow_target_order_id}`
        : order.follow_target_position > 1
          ? ` pos ${order.follow_target_position}`
          : '';
    return `follow ${pm}${ref}`;
  }

  if (mode === 'spread') {
    return `spread ${formatPercentDisplay(order.price_porc)}%`;
  }

  if (mode === 'pm') {
    return `pm ${formatPercentDisplay(order.price_min)}%`;
  }

  if (mode === 'fixed') {
    return `preço fixo ${formatBookPrice(order.price)}`;
  }

  if (mode === 'pending') {
    return 'aguardando preço';
  }

  return '—';
}

/** Preço atual no livro (quando diferente do parâmetro configurado). */
export function formatOrderLivePrice(order) {
  const mode = getOrderPricingMode(order);
  if (mode === 'fixed' || mode === 'none' || mode === 'pending') return null;
  const live = order?.price;
  if (!isSet(live)) return null;
  return formatBookPrice(live);
}

/** Campos do formulário — preenche só o parâmetro que foi usado. */
export function orderConfigToFormFields(order) {
  const empty = {
    base: 'L-BTC',
    quote: 'USDt',
    tradeDir: 'Buy',
    price: '',
    pricePorc: '',
    priceMin: '',
    followTarget: false,
    followTargetOrderId: '',
    followTargetPosition: 1,
  };

  if (!order) return empty;

  const base = {
    ...empty,
    base: order.base || 'L-BTC',
    quote: order.quote || 'USDt',
    tradeDir: order.trade_dir || 'Buy',
  };

  const mode = getOrderPricingMode(order);

  if (mode === 'follow') {
    return {
      ...base,
      followTarget: true,
      priceMin: isSet(order.price_min) ? formatPercentDisplay(order.price_min) : '',
      followTargetOrderId: order.follow_target_order_id
        ? String(order.follow_target_order_id) : '',
      followTargetPosition: order.follow_target_position || 1,
    };
  }

  if (mode === 'spread') {
    return {
      ...base,
      pricePorc: formatPercentDisplay(order.price_porc),
    };
  }

  if (mode === 'pm') {
    return {
      ...base,
      priceMin: formatPercentDisplay(order.price_min),
    };
  }

  if (mode === 'fixed') {
    return {
      ...base,
      price: formatPriceDisplay(order.price),
    };
  }

  return base;
}
