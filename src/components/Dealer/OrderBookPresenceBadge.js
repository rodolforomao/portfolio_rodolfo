import React from 'react';
import Badge from 'react-bootstrap/Badge';
import { TbCircleCheck, TbCircleX, TbAlertTriangle } from 'react-icons/tb';

const ICON_BY_KEY = {
  found: TbCircleCheck,
  sem_ativo: TbAlertTriangle,
  erro: TbCircleX,
  inverted: TbAlertTriangle,
  unpublished: TbCircleX,
};

export default function OrderBookPresenceBadge({ presence, className = '' }) {
  if (!presence?.badgeLabel) return null;

  const bg = presence.variant === 'warning' ? 'warning'
    : presence.variant === 'danger' ? 'danger'
      : presence.variant === 'success' ? 'success'
        : 'secondary';
  const text = presence.variant === 'warning' ? 'dark' : undefined;
  const Icon = ICON_BY_KEY[presence.key] || TbCircleX;

  return (
    <Badge
      bg={bg}
      text={text}
      className={`dealer-book-presence-badge ${className}`.trim()}
      title={presence.hint}
    >
      <Icon aria-hidden /> {presence.badgeLabel}
    </Badge>
  );
}
