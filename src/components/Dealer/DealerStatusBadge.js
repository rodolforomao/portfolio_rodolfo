import React from 'react';
import Badge from 'react-bootstrap/Badge';
import { DEALER_STATUS_META } from './utils/dealerStatus';

const VARIANT = {
  online: 'success',
  unused: 'secondary',
  zombie: 'warning',
  morto: 'danger',
  error: 'danger',
};

export default function DealerStatusBadge({ dealer, showHint = false, managerOffline = false }) {
  const status = dealer?.dealerStatus || 'morto';
  const meta = DEALER_STATUS_META[status] || DEALER_STATUS_META.morto;
  const variant = managerOffline && status === 'online' ? 'secondary' : (VARIANT[status] || 'secondary');
  const hint = dealer?.statusHint || meta.description;
  const title = managerOffline && status === 'online'
    ? `${hint} · manager offline — status não verificável`
    : hint;

  return (
    <span className="dealer-status-badge-wrap" title={title}>
      <Badge bg={variant} className={`dealer-status-badge dealer-status-${status}${managerOffline && status === 'online' ? ' dealer-status-stale' : ''}`}>
        {meta.label}{managerOffline && status === 'online' ? '?' : ''}
      </Badge>
      {showHint && dealer?.statusHint && (
        <span className="dealer-status-hint">{dealer.statusHint}</span>
      )}
    </span>
  );
}
