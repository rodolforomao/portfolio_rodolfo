import React from 'react';
import { getOrderStatus } from './utils/orderStatus';

const OFFLINE_COLOR = '#6e7681';
const SIDESWAP_COLOR = '#2d9cdb';

export default function OrderStatusSignal({
  order,
  size = 'md',
  showLabel = false,
  className = '',
  managerOffline = false,
  confirmedInBook = false,
}) {
  const status = getOrderStatus(order);
  const sizeClass = size === 'sm' ? 'dealer-signal-sm' : 'dealer-signal-md';

  let color;
  let hint;
  if (managerOffline && confirmedInBook) {
    color = SIDESWAP_COLOR;
    hint = `${status.label} · confirmada no livro público SideSwap (manager offline)`;
  } else if (managerOffline) {
    color = OFFLINE_COLOR;
    hint = `${status.label} · status incerto (manager offline — dado pode ser cache)`;
  } else {
    color = status.color;
    hint = status.hint;
  }

  return (
    <span
      className={`dealer-order-signal ${sizeClass} ${className}`}
      title={hint}
      aria-label={status.label}
    >
      <span
        className="dealer-order-signal-dot"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }}
      />
      {showLabel && <span className="dealer-order-signal-label">{status.label}</span>}
    </span>
  );
}
