import React, { useMemo } from 'react';
import Badge from 'react-bootstrap/Badge';
import { TbListDetails } from 'react-icons/tb';
import OrderStatusSignal from './OrderStatusSignal';
import OrderMarginBadge from './OrderMarginBadge';
import { formatBookPrice } from './utils/sideswapBook';
import { formatOrderSpreadSummary } from './PriceFields';
import { prepareDealerOrders, cleanPairName } from './utils/orderMarketNormalize';
import { getOrderStatus, countOrdersByStatus } from './utils/orderStatus';
import { FollowRefLink } from './utils/followTarget';

function OrderStatusBadge({ order }) {
  const status = getOrderStatus(order);
  const variant = {
    sent: 'success',
    follow: 'info',
    calculating: 'primary',
    pending: 'warning',
    awaiting: 'secondary',
  }[status.key] || 'secondary';

  return (
    <Badge bg={variant} text={status.key === 'pending' ? 'dark' : undefined} className="dealer-order-status">
      {status.label.toLowerCase()}
    </Badge>
  );
}

export default function OrdersPanel({ dealer }) {
  const { orders, normalizeNotes } = useMemo(
    () => prepareDealerOrders(dealer?.orders || []),
    [dealer?.orders],
  );

  const statusCounts = useMemo(() => countOrdersByStatus(orders), [orders]);
  const sentCount = statusCounts.sent;
  const unsentCount = orders.length - sentCount;

  return (
    <section className="dealer-orders-panel">
      <div className="dealer-orders-header">
        <h3>
          <TbListDetails /> Ordens
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
            <span><OrderStatusSignal order={{ order_id: 1 }} size="sm" /> enviada</span>
            <span><OrderStatusSignal order={{ follow_target: true, order_id: 1 }} size="sm" /> follow</span>
            <span><OrderStatusSignal order={{ follow_target: true, pending: true }} size="sm" /> calc.</span>
            <span><OrderStatusSignal order={{ price: 1 }} size="sm" /> pendente</span>
            <span><OrderStatusSignal order={{}} size="sm" /> sem preço</span>
          </div>
        )}
      </div>

      {!dealer ? (
        <p className="dealer-empty">Selecione um dealer para ver as ordens configuradas.</p>
      ) : orders.length === 0 ? (
        <p className="dealer-empty">Nenhuma ordem neste PID.</p>
      ) : (
        <table className="dealer-orders-table">
          <thead>
            <tr>
              <th className="dealer-orders-signal-col" aria-label="Status" />
              <th>Par</th>
              <th>Dir</th>
              <th>Preço</th>
              <th>Order ID</th>
              <th>Alvo</th>
              <th>Book</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const pairLabel = cleanPairName(order.base, order.quote);
              const price = order.price ?? order.original_price;
              const status = getOrderStatus(order);
              return (
                <tr
                  key={`${order.base}-${order.quote}-${order.trade_dir}-${order.order_id || 'pending'}`}
                  className={`dealer-order-row dealer-order-row-${status.key}`}
                >
                  <td className="dealer-orders-signal-col">
                    <OrderStatusSignal order={order} size="md" />
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
                    {price != null ? formatBookPrice(price) : '—'}
                    <div className="dealer-order-spread-summary">
                      {formatOrderSpreadSummary(order)}
                    </div>
                    {order.follow_target && (
                      <div className="dealer-order-margin-wrap">
                        <OrderMarginBadge order={order} showPm explicit />
                      </div>
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
                  <td><OrderStatusBadge order={order} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
          {' '}O livro público abaixo mostra só as {sentCount} enviada{sentCount !== 1 ? 's' : ''}.
        </p>
      )}
    </section>
  );
}
