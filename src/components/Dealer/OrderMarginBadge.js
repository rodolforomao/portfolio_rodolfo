import React from 'react';
import { computeOrderMargin, formatPriceMin } from './utils/orderMargin';
import { formatFollowSummary } from './utils/followTarget';

export default function OrderMarginBadge({ order, showPm = false, showFollow = true, explicit = false }) {
  const margin = computeOrderMargin(order);
  const pm = showPm ? formatPriceMin(order) : null;
  const follow = showFollow ? formatFollowSummary(order) : null;

  if (!margin.kind && !follow) {
    return <span className="dealer-order-margin dealer-order-margin-na">margem —</span>;
  }

  return (
    <span className={`dealer-order-margin${margin.kind ? ` dealer-order-margin-${margin.kind}` : ''}`}>
      {margin.kind && (explicit ? margin.label : margin.shortLabel)}
      {follow && (
        <span className="dealer-order-follow"> · {follow}</span>
      )}
      {pm && !follow && <span className="dealer-order-pm"> · {pm}</span>}
    </span>
  );
}
