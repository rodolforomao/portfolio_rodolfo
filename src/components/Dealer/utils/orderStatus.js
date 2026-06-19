/** Status visual de uma ordem (enviada, pendente, follow, sem preço). */

export const ORDER_STATUS_META = {
  sent: {
    label: 'Enviada',
    hint: 'Ordem no book SideSwap (tem order_id)',
    color: '#3fb950',
  },
  follow: {
    label: 'Follow',
    hint: 'Segue alvo no book com piso pm % (spread dinâmico)',
    color: '#58a6ff',
  },
  calculating: {
    label: 'Calculando preço',
    hint: 'Registrada no config — price monitor ainda não calculou o par',
    color: '#a371f7',
  },
  pending: {
    label: 'Pendente',
    hint: 'Preço definido, ainda não enviada ao SideSwap',
    color: '#d29922',
  },
  awaiting: {
    label: 'Sem preço',
    hint: 'Aguardando preço ou configuração',
    color: '#6e7681',
  },
};

function isAwaitingPrice(order) {
  if (!order) return false;
  if (order.pending === true) return true;
  if (order.order_id != null && order.order_id !== '') return false;
  if (order.follow_target) return true;
  return order.price == null && order.original_price == null && order.price_porc == null;
}

export function getOrderStatus(order) {
  if (!order) return { key: 'awaiting', ...ORDER_STATUS_META.awaiting };

  const awaitingPrice = isAwaitingPrice(order);

  if (order.follow_target) {
    if (awaitingPrice) {
      return {
        key: 'calculating',
        label: 'Follow · calc.',
        hint: 'Modo follow ativo — aguardando price monitor calcular spread inicial',
        color: ORDER_STATUS_META.calculating.color,
      };
    }
    return { key: 'follow', ...ORDER_STATUS_META.follow };
  }

  if (awaitingPrice) {
    return { key: 'calculating', ...ORDER_STATUS_META.calculating };
  }

  if (order.order_id) {
    return { key: 'sent', ...ORDER_STATUS_META.sent };
  }
  if (order.price != null || order.original_price != null) {
    return { key: 'pending', ...ORDER_STATUS_META.pending };
  }
  return { key: 'awaiting', ...ORDER_STATUS_META.awaiting };
}

export function countOrdersByStatus(orders = []) {
  const counts = { sent: 0, follow: 0, calculating: 0, pending: 0, awaiting: 0 };
  for (const o of orders) {
    counts[getOrderStatus(o).key] += 1;
  }
  return counts;
}
