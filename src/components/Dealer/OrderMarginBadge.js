import React from 'react';
import { computeOrderMargin, formatPriceMin } from './utils/orderMargin';

export default function OrderMarginBadge({ order, showPm = false, explicit = false }) {
  const margin = computeOrderMargin(order);
  const pm = showPm ? formatPriceMin(order) : null;

  if (!margin.kind) {
    return <span className="dealer-order-margin dealer-order-margin-na">margem —</span>;
  }

  return (
    <span className={`dealer-order-margin dealer-order-margin-${margin.kind}`}>
      {explicit ? margin.label : margin.shortLabel}
      {pm && <span className="dealer-order-pm"> · {pm}</span>}
    </span>
  );
}
