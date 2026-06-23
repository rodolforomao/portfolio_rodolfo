import React from 'react';
import { formatOrderConfigSummary, getOrderPricingMode } from './utils/orderPricing';
import { formatFollowSummary } from './utils/followTarget';
import { formatPriceMin } from './utils/orderMargin';

/**
 * Exibe o parâmetro de preço CONFIGURADO (spread, pm, fixo, follow).
 * Não mostra lucro/perda calculado vs mercado — isso é outro contexto.
 */
export default function OrderMarginBadge({ order, showPm = false, showFollow = true }) {
  const mode = getOrderPricingMode(order);
  const summary = formatOrderConfigSummary(order);
  const pm = showPm && mode !== 'follow' ? formatPriceMin(order) : null;
  const follow = showFollow && mode === 'follow' ? formatFollowSummary(order) : null;

  if (mode === 'none' || mode === 'pending') {
    return <span className="dealer-order-config dealer-order-config-na">{summary}</span>;
  }

  return (
    <span className={`dealer-order-config dealer-order-config-${mode}`} title="Parâmetro enviado">
      {summary}
      {follow && follow !== summary && (
        <span className="dealer-order-follow"> · {follow}</span>
      )}
      {pm && mode !== 'spread' && mode !== 'pm' && (
        <span className="dealer-order-pm"> · {pm}</span>
      )}
    </span>
  );
}
