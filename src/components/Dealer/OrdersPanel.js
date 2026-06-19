import React, { useMemo } from 'react';
import Badge from 'react-bootstrap/Badge';
import { TbListDetails } from 'react-icons/tb';
import OrderMarginBadge from './OrderMarginBadge';
import { formatBookPrice } from './utils/sideswapBook';
import { prepareDealerOrders, cleanPairName } from './utils/orderMarketNormalize';

function OrderStatusBadge({ order }) {
  if (order.order_id) {
    return <Badge bg="success" className="dealer-order-status">enviada</Badge>;
  }
  if (order.price || order.original_price) {
    return <Badge bg="warning" text="dark" className="dealer-order-status">pendente</Badge>;
  }
  return <Badge bg="secondary" className="dealer-order-status">aguardando preço</Badge>;
}

export default function OrdersPanel({ dealer }) {
  const { orders, normalizeNotes } = useMemo(
    () => prepareDealerOrders(dealer?.orders || []),
    [dealer?.orders],
  );

  const sentCount = orders.filter((o) => o.order_id).length;
  const pendingCount = orders.length - sentCount;

  return (
    <section className="dealer-orders-panel">
      <div className="dealer-orders-header">
        <h3>
          <TbListDetails /> Ordens
          {dealer && (
            <span className="dealer-assets-sub">
              PID {dealer.pid} · {sentCount} enviada{sentCount !== 1 ? 's' : ''}
              {pendingCount > 0 && ` · ${pendingCount} pendente${pendingCount !== 1 ? 's' : ''}`}
            </span>
          )}
        </h3>
      </div>

      {!dealer ? (
        <p className="dealer-empty">Selecione um dealer para ver as ordens configuradas.</p>
      ) : orders.length === 0 ? (
        <p className="dealer-empty">Nenhuma ordem neste PID.</p>
      ) : (
        <table className="dealer-orders-table">
          <thead>
            <tr>
              <th>Par</th>
              <th>Dir</th>
              <th>Preço</th>
              <th>Order ID</th>
              <th>Book</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const pairLabel = cleanPairName(order.base, order.quote);
              const price = order.price ?? order.original_price;
              return (
                <tr
                  key={`${order.base}-${order.quote}-${order.trade_dir}-${order.order_id || 'pending'}`}
                  className={order.order_id ? 'dealer-order-sent' : 'dealer-order-pending'}
                >
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
                    <OrderMarginBadge order={order} showPm explicit />
                  </td>
                  <td>
                    <code>{order.order_id || '—'}</code>
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

      {dealer && pendingCount > 0 && sentCount > 0 && (
        <p className="dealer-hint">
          Ordens pendentes ainda não estão no SideSwap — aguardam preço ou envio pelo manager.
          O livro público abaixo mostra só as {sentCount} enviada{sentCount !== 1 ? 's' : ''}.
        </p>
      )}
    </section>
  );
}
