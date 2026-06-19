import React from 'react';
import { formatPercentForInput } from '../PriceFields';

/** ID estável para âncora no mini-book do painel SideSwap. */
export function bookOrderAnchorId(orderId) {
  if (orderId == null || orderId === '') return null;
  return `book-order-${orderId}`;
}

/** Resumo legível do modo follow (badge / chips). */
export function formatFollowSummary(order) {
  if (!order?.follow_target) return null;
  const parts = ['follow'];
  const pm = order.price_min;
  if (pm != null && pm !== '') {
    parts.push(`pm ${formatPercentForInput(pm)}%`);
  }
  if (order.follow_ref_order_id) {
    parts.push(`→ #${order.follow_ref_order_id}`);
  } else if (order.follow_target_order_id) {
    parts.push(`pin #${order.follow_target_order_id}`);
  }
  return parts.join(' · ');
}

export function buildFollowParams({ followTarget, followTargetOrderId, priceMin }) {
  if (!followTarget) return { follow_target: false };
  const p = { follow_target: true };
  const pin = String(followTargetOrderId || '').trim();
  if (pin) p.follow_target_order_id = pin;
  return p;
}

/** Link para a linha do alvo no mini-book (OrderPlacementPanel). */
export function FollowRefLink({ orderId, label, className = '' }) {
  if (orderId == null || orderId === '') return null;
  const anchor = bookOrderAnchorId(orderId);
  const text = label || `#${orderId}`;
  return (
    <a
      href={`#${anchor}`}
      className={`dealer-follow-ref-link ${className}`.trim()}
      title={`Alvo follow no book — order_id ${orderId}`}
      onClick={(e) => {
        e.preventDefault();
        const el = document.getElementById(anchor);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          el.classList.add('dealer-mini-book-row-flash');
          window.setTimeout(() => el.classList.remove('dealer-mini-book-row-flash'), 1800);
        }
      }}
    >
      {text}
    </a>
  );
}
