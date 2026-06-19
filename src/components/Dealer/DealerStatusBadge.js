import React from 'react';
import Badge from 'react-bootstrap/Badge';
import { DEALER_STATUS_META } from './utils/dealerStatus';

const VARIANT = {
  online: 'success',
  unused: 'secondary',
  zombie: 'warning',
  morto: 'danger',
};

export default function DealerStatusBadge({ dealer, showHint = false }) {
  const status = dealer?.dealerStatus || 'morto';
  const meta = DEALER_STATUS_META[status] || DEALER_STATUS_META.morto;

  return (
    <span className="dealer-status-badge-wrap" title={meta.description}>
      <Badge bg={VARIANT[status] || 'secondary'} className={`dealer-status-badge dealer-status-${status}`}>
        {meta.label}
      </Badge>
      {showHint && dealer?.statusHint && (
        <span className="dealer-status-hint">{dealer.statusHint}</span>
      )}
    </span>
  );
}
