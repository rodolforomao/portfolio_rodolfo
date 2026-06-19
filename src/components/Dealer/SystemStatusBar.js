import React, { useMemo } from 'react';
import { countDealersByStatus } from './utils/dealerStatus';
import { countOrdersByStatus } from './utils/orderStatus';
import { prepareDealerOrders } from './utils/orderMarketNormalize';

function StatusPill({ ok, warn, label, detail, title }) {
  const state = ok ? 'ok' : warn ? 'warn' : 'off';
  return (
    <span className={`dealer-sys-pill dealer-sys-pill-${state}`} title={title || detail}>
      <span className="dealer-sys-pill-dot" />
      <span className="dealer-sys-pill-label">{label}</span>
      {detail && <span className="dealer-sys-pill-detail">{detail}</span>}
    </span>
  );
}

function formatStateTs(ts) {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

export default function SystemStatusBar({
  wsStatus,
  agentConnected,
  dealers = [],
  selectedDealer,
  stateTs,
}) {
  const dealerCounts = useMemo(() => countDealersByStatus(dealers), [dealers]);

  const orderTotals = useMemo(() => {
    const totals = { sent: 0, follow: 0, calculating: 0, pending: 0, awaiting: 0 };
    for (const d of dealers) {
      const { orders } = prepareDealerOrders(d.orders || []);
      const c = countOrdersByStatus(orders);
      totals.sent += c.sent;
      totals.follow += c.follow;
      totals.calculating += c.calculating;
      totals.pending += c.pending;
      totals.awaiting += c.awaiting;
    }
    return totals;
  }, [dealers]);

  const selectedOrderCounts = useMemo(() => {
    if (!selectedDealer) return null;
    const { orders } = prepareDealerOrders(selectedDealer.orders || []);
    return countOrdersByStatus(orders);
  }, [selectedDealer]);

  const totalDealers = dealers.length;
  const liveDealers = (dealerCounts.online || 0) + (dealerCounts.unused || 0);
  const wsOk = wsStatus === 'connected';
  const wsConnecting = wsStatus === 'connecting';
  const wsLabel = wsOk ? 'Relay OK' : wsConnecting ? 'Relay…' : wsStatus === 'error' ? 'Relay erro' : 'Relay off';

  const managerLabel = agentConnected ? 'Manager OK' : 'Manager off';
  const managerTitle = agentConnected
    ? 'manager_dealer conectado ao relay — comandos e state_update ativos'
    : 'manager_dealer não está no relay — dashboard pode ser cache; comandos falham';

  const dealerDetailParts = [];
  if (dealerCounts.online) dealerDetailParts.push(`${dealerCounts.online} online`);
  if (dealerCounts.unused) dealerDetailParts.push(`${dealerCounts.unused} ocioso`);
  if (dealerCounts.zombie) dealerDetailParts.push(`${dealerCounts.zombie} zumbi`);
  const dealerDetail = totalDealers
    ? `${totalDealers} PID${totalDealers !== 1 ? 's' : ''}${dealerDetailParts.length ? ` · ${dealerDetailParts.join(' · ')}` : ''}`
    : 'nenhum PID';

  const orderParts = [];
  if (orderTotals.sent) orderParts.push(`${orderTotals.sent} enviada${orderTotals.sent !== 1 ? 's' : ''}`);
  if (orderTotals.follow) orderParts.push(`${orderTotals.follow} follow`);
  const unsent = orderTotals.calculating + orderTotals.pending + orderTotals.awaiting;
  if (unsent) orderParts.push(`${unsent} pendente${unsent !== 1 ? 's' : ''}`);
  const orderDetail = orderParts.length ? orderParts.join(' · ') : 'sem ordens';

  const syncLabel = formatStateTs(stateTs);

  let selectedDetail = null;
  if (selectedDealer && selectedOrderCounts) {
    const parts = [];
    if (selectedOrderCounts.sent) parts.push(`${selectedOrderCounts.sent} env.`);
    if (selectedOrderCounts.follow) parts.push(`${selectedOrderCounts.follow} follow`);
    const pend = selectedOrderCounts.calculating + selectedOrderCounts.pending + selectedOrderCounts.awaiting;
    if (pend) parts.push(`${pend} pend.`);
    selectedDetail = `PID ${selectedDealer.pid} · ${selectedDealer.statusLabel || selectedDealer.dealerStatus}${parts.length ? ` · ${parts.join(' · ')}` : ''}`;
  }

  return (
    <div className="dealer-sys-bar" role="status" aria-live="polite">
      <StatusPill
        ok={wsOk}
        warn={wsConnecting}
        label={wsLabel}
        detail={wsOk ? 'browser ↔ relay' : wsConnecting ? 'conectando' : wsStatus}
        title="Conexão WebSocket do browser com o relay (ws_relay_server)"
      />
      <StatusPill
        ok={agentConnected}
        label={managerLabel}
        detail={agentConnected ? 'no relay' : 'ausente'}
        title={managerTitle}
      />
      <StatusPill
        ok={liveDealers > 0}
        warn={totalDealers > 0 && liveDealers === 0}
        label="Dealers"
        detail={dealerDetail}
        title="Processos dealer no backend. Online = sync WS recente. Zumbi = listado sem sync ao vivo."
      />
      <StatusPill
        ok={orderTotals.sent > 0}
        warn={unsent > 0}
        label="Ordens"
        detail={orderDetail}
        title="Enviada = no SideSwap. Pendente = no config, ainda não aceita."
      />
      {syncLabel && (
        <StatusPill
          ok={wsOk && agentConnected}
          label="Sync"
          detail={syncLabel}
          title="Último state_update do manager"
        />
      )}
      {selectedDetail && (
        <span className="dealer-sys-selected" title="Dealer selecionado">
          {selectedDetail}
        </span>
      )}
    </div>
  );
}
