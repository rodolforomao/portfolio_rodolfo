import React from 'react';
import { getOrderStatus } from './utils/orderStatus';

export default function OrderStatusSignal({ order, size = 'md', showLabel = false, className = '' }) {
  const status = getOrderStatus(order);
  const sizeClass = size === 'sm' ? 'dealer-signal-sm' : 'dealer-signal-md';

  return (
    <span
      className={`dealer-order-signal ${sizeClass} ${className}`}
      title={status.hint}
      aria-label={status.label}
    >
      <span
        className="dealer-order-signal-dot"
        style={{ backgroundColor: status.color, boxShadow: `0 0 6px ${status.color}88` }}
      />
      {showLabel && <span className="dealer-order-signal-label">{status.label}</span>}
    </span>
  );
}
