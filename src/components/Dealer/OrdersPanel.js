import React, { useMemo } from 'react';
import Badge from 'react-bootstrap/Badge';
import { TbListDetails } from 'react-icons/tb';
import { ManagerBadge } from './SourceBadge';
import OrderStatusSignal from './OrderStatusSignal';
import OrderBookPresenceBadge from './OrderBookPresenceBadge';
import { formatOrderConfigSummary, formatOrderLivePrice } from './utils/orderPricing';
import { prepareDealerOrders, cleanPairName } from './utils/orderMarketNormalize';
import { getOrderStatus, countOrdersByStatus } from './utils/orderStatus';
import {
  resolveOrderBookPresence,
  sortDealerOrdersByBookPresence,
} from './utils/orderPlacementStatus';
import { FollowRefLink } from './utils/followTarget';

const SIDESWAP_BADGE_STYLE = { backgroundColor: '#2d9cdb', borderColor: '#2d9cdb' };

const PRESENCE_SIGNAL_COLOR = {
  found: '#3fb950',
  sem_ativo: '#d29922',
  erro: '#f85149',
  inverted: '#6e7681',
  unpublished: '#6e7681',
};

function OrderRowSignal({ order, presence, managerOffline = false, confirmedInBook = false }) {
  if (order?.order_id && presence?.badgeLabel) {
    const offline = managerOffline && !confirmedInBook;
    const color = offline ? '#6e7681' : (PRESENCE_SIGNAL_COLOR[presence.key] || '#6e7681');
    const hint = offline
      ? `${presence.badgeLabel} · status incerto (manager offline)`
      : presence.hint;
    return (
      <span
        className="dealer-order-signal dealer-signal-md"
        title={hint}
        aria-label={presence.badgeLabel}
      >
        <span
          className="dealer-order-signal-dot"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }}
        />
      </span>
    );
  }
  return (
    <OrderStatusSignal
      order={order}
      size="md"
      managerOffline={managerOffline}
      confirmedInBook={confirmedInBook}
    />
  );
}

function OrderRowStatusBadge({ order, presence, managerOffline = false, confirmedInBook = false }) {
  if (order?.order_id && presence?.badgeLabel) {
    return (
      <OrderBookPresenceBadge
        presence={presence}
        className="dealer-order-status"
      />
    );
  }
  return (
    <OrderStatusBadge
      order={order}
      managerOffline={managerOffline}
      confirmedInBook={confirmedInBook}
    />
  );
}

function OrderStatusBadge({ order, managerOffline = false, confirmedInBook = false }) {
  const status = getOrderStatus(order);
  let variant;
  let style;
  let title;

  if (managerOffline && confirmedInBook) {
    variant = null;
    style = SIDESWAP_BADGE_STYLE;
    title = `${status.label} · confirmada no livro público SideSwap`;
  } else if (managerOffline) {
    variant = 'secondary';
    style = undefined;
    title = `${status.label} · status incerto (manager offline)`;
  } else {
    variant = ({
      sent: 'success',
      follow: 'info',
      calculating: 'primary',
      pending: 'warning',
      awaiting: 'secondary',
    }[status.key] || 'secondary');
    style = undefined;
    title = undefined;
  }

  return (
    <Badge
      bg={variant || undefined}
      text={!managerOffline && status.key === 'pending' ? 'dark' : undefined}
      className="dealer-order-status"
      style={style}
      title={title}
    >
      {status.label.toLowerCase()}
    </Badge>
  );
}

export default function OrdersPanel({
  dealer,
  managerOffline = false,
  confirmedOrderIds = null,
  placementByOrderId = null,
  combinations = [],
}) {
  const { orders: rawOrders, normalizeNotes } = useMemo(
    () => prepareDealerOrders(dealer?.orders || []),
    [dealer?.orders],
  );

  const orders = useMemo(() => {
    if (!rawOrders.length) return rawOrders;
    return sortDealerOrdersByBookPresence(rawOrders, {
      placementByOrderId: placementByOrderId || new Map(),
      balances: dealer?.balances,
      combinations,
    });
  }, [rawOrders, placementByOrderId, dealer?.balances, combinations]);

  const statusCounts = useMemo(() => countOrdersByStatus(orders), [orders]);
  const sentCount = statusCounts.sent;
  const unsentCount = orders.length - sentCount;

  return (
    <section className="dealer-orders-panel">
      <div className="dealer-orders-header">
        <h3>
          <TbListDetails /> Ordens
          <ManagerBadge title="Ordens via state_update do manager_dealer" />
          {dealer && (
            <span className="dealer-assets-sub">
              PID {dealer.pid} · {sentCount} enviada{sentCount !== 1 ? 's' : ''}
              {statusCounts.follow > 0 && ` · ${statusCounts.follow} follow`}
              {unsentCount > 0 && ` · ${unsentCount} pendente${unsentCount !== 1 ? 's' : ''}`}
            </span>
          )}
        </h3>
        {orders.length > 0 && (
          <div className="dealer-order-legend" aria-hidden="true">
            <span><Badge bg="success" className="dealer-legend-presence">no livro</Badge></span>
            <span><Badge bg="warning" text="dark" className="dealer-legend-presence">sem ativo</Badge></span>
            <span><Badge bg="danger" className="dealer-legend-presence">erro</Badge></span>
            <span><OrderStatusSignal order={{ follow_target: true, order_id: 1 }} size="sm" managerOffline={managerOffline} /> follow</span>
            <span><OrderStatusSignal order={{ follow_target: true, pending: true }} size="sm" managerOffline={managerOffline} /> calc.</span>
            <span><OrderStatusSignal order={{ price: 1 }} size="sm" managerOffline={managerOffline} /> pendente</span>
            <span><OrderStatusSignal order={{}} size="sm" managerOffline={managerOffline} /> sem preço</span>
          </div>
        )}
      </div>

      {!dealer ? (
        <p className="dealer-empty">Selecione um dealer para ver as ordens configuradas.</p>
      ) : orders.length === 0 ? (
        <p className="dealer-empty">Nenhuma ordem neste PID.</p>
      ) : (
        <div className="dealer-table-scroll">
        <table className="dealer-orders-table">
          <thead>
            <tr>
              <th className="dealer-orders-signal-col" aria-label="Status" />
              <th>Par</th>
              <th>Dir</th>
              <th>Parâmetro</th>
              <th>No livro</th>
              <th>Order ID</th>
              <th>Alvo</th>
              <th>Book</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const pairLabel = cleanPairName(order.base, order.quote);
              const livePrice = formatOrderLivePrice(order);
              const configLabel = formatOrderConfigSummary(order);
              const status = getOrderStatus(order);
              const placement = order.order_id
                ? (placementByOrderId || new Map()).get(String(order.order_id))
                : null;
              const presence = resolveOrderBookPresence({
                order,
                balances: dealer?.balances,
                placement,
                combinations,
              });
              const inBook = managerOffline && confirmedOrderIds != null
                && order.order_id != null
                && confirmedOrderIds.has(String(order.order_id));
              const rowPresenceClass = order.order_id && presence?.key
                ? ` dealer-order-row-${presence.key.replace('_', '-')}`
                : '';
              return (
                <tr
                  key={`${order.base}-${order.quote}-${order.trade_dir}-${order.order_id || 'pending'}`}
                  className={`dealer-order-row dealer-order-row-${status.key}${rowPresenceClass}${managerOffline && !inBook && order.order_id ? ' dealer-order-row-stale' : ''}`}
                >
                  <td className="dealer-orders-signal-col">
                    <OrderRowSignal
                      order={order}
                      presence={presence}
                      managerOffline={managerOffline}
                      confirmedInBook={inBook}
                    />
                  </td>
                  <td>
                    <span className="dealer-order-pair">{pairLabel}</span>
                    <span className="dealer-order-pair-full">{order.base}/{order.quote}</span>
                    {order._displayFrom && (
                      <span className="dealer-order-normalized" title="Par corrigido para SideSwap">
                        ← {order._displayFrom}
                      </span>
                    )}
                  </td>
                  <td>{order.trade_dir}</td>
                  <td>
                    <span className="dealer-order-config-main">{configLabel}</span>
                  </td>
                  <td>
                    {livePrice ? (
                      <span className="dealer-order-live-price" title="Preço calculado no livro">
                        {livePrice}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <code>{order.order_id || '—'}</code>
                  </td>
                  <td className="dealer-order-follow-ref-col">
                    {order.follow_ref_order_id ? (
                      <FollowRefLink orderId={order.follow_ref_order_id} />
                    ) : order.follow_target_order_id ? (
                      <span className="dealer-follow-pin" title="Pin manual em concorrente">
                        pin <FollowRefLink orderId={order.follow_target_order_id} />
                      </span>
                    ) : order.follow_target ? (
                      <span className="dealer-follow-auto" title="Alvo escolhido automaticamente pelo backend">auto</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{order.book_label || '—'}</td>
                  <td>
                    <OrderRowStatusBadge
                      order={order}
                      presence={presence}
                      managerOffline={managerOffline}
                      confirmedInBook={inBook}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {managerOffline && orders.length > 0 && (
        <p className="dealer-hint dealer-hint-stale">
          Manager offline — status das ordens pode ser cache. Sinais em cinza até reconectar.
        </p>
      )}

      {normalizeNotes.length > 0 && (
        <p className="dealer-orders-normalize-hint">
          Pares corrigidos automaticamente: {normalizeNotes.join(' · ')}
        </p>
      )}

      {dealer && unsentCount > 0 && sentCount > 0 && (
        <p className="dealer-hint">
          Ordens pendentes ainda não estão no SideSwap — aguardam price monitor ou envio pelo manager.
          {statusCounts.calculating > 0 && ` ${statusCounts.calculating} calculando preço.`}
          {' '}O livro ao vivo acima mostra só as {sentCount} enviada{sentCount !== 1 ? 's' : ''}.
        </p>
      )}
    </section>
  );
}
