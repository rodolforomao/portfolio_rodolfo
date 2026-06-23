import React, { useMemo } from 'react';
import { TbNetwork, TbCpu, TbLayoutList, TbRefresh, TbBrandTelegram } from 'react-icons/tb';
import { countDealersByStatus } from './utils/dealerStatus';
import { countOrdersByStatus } from './utils/orderStatus';
import { prepareDealerOrders } from './utils/orderMarketNormalize';

function SecondaryPill({ ok, warn, label, detail, title, icon: Icon }) {
  const state = ok ? 'ok' : warn ? 'warn' : 'off';
  return (
    <span className={`dealer-sys-pill dealer-sys-pill-${state}`} title={title || detail}>
      <span className="dealer-sys-pill-dot" />
      {Icon && <Icon size={11} />}
      <span className="dealer-sys-pill-label">{label}</span>
      {detail && <span className="dealer-sys-pill-detail">{detail}</span>}
    </span>
  );
}

function DealerPrimaryPill({ dealers, selectedDealer, managerOffline }) {
  const dealerCounts = countDealersByStatus(dealers);
  const liveDealers = (dealerCounts.online || 0) + (dealerCounts.unused || 0);

  if (dealers.length === 0) {
    return (
      <span
        className="dealer-sys-primary dealer-sys-primary-none"
        title="Nenhum dealer iniciado — use Run para iniciar um processo dealer"
      >
        <span className="dealer-sys-primary-dot" />
        <span className="dealer-sys-primary-label">Sem dealer ativo</span>
        <span className="dealer-sys-primary-hint">inicie um dealer para operar</span>
      </span>
    );
  }

  if (selectedDealer) {
    const isLive = selectedDealer.isLive;
    const stateKey = managerOffline && isLive ? 'stale' : selectedDealer.dealerStatus;
    const label = `PID ${selectedDealer.pid}`;
    const wallet = selectedDealer.wallet_name || '—';
    const statusText = managerOffline && isLive
      ? `${selectedDealer.statusLabel}?`
      : (selectedDealer.statusLabel || selectedDealer.dealerStatus);

    return (
      <span
        className={`dealer-sys-primary dealer-sys-primary-${stateKey}`}
        title={
          managerOffline && isLive
            ? `PID ${selectedDealer.pid} · ${wallet} · manager offline, status não verificável`
            : `PID ${selectedDealer.pid} · ${wallet} · ${selectedDealer.statusHint || selectedDealer.dealerStatus}`
        }
      >
        <span className="dealer-sys-primary-dot" />
        <span className="dealer-sys-primary-label">{label}</span>
        <span className="dealer-sys-primary-wallet">{wallet}</span>
        <span className="dealer-sys-primary-status">{statusText}</span>
      </span>
    );
  }

  const state = liveDealers > 0 ? 'ok' : 'warn';
  return (
    <span
      className={`dealer-sys-primary dealer-sys-primary-${state}`}
      title="Selecione um dealer no painel à esquerda"
    >
      <span className="dealer-sys-primary-dot" />
      <span className="dealer-sys-primary-label">
        {dealers.length} dealer{dealers.length !== 1 ? 's' : ''}
      </span>
      <span className="dealer-sys-primary-hint">
        {liveDealers > 0 ? `${liveDealers} online` : 'nenhum online'}
        {' · selecione um'}
      </span>
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
  agentMeta,
  dealers = [],
  selectedDealer,
  stateTs,
  telegramStatus,
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

  const wsOk = wsStatus === 'connected';
  const wsConnecting = wsStatus === 'connecting';
  const wsLabel = wsOk ? 'Relay OK' : wsConnecting ? 'Relay…' : wsStatus === 'error' ? 'Relay erro' : 'Relay off';

  const managerLabel = agentConnected ? 'Manager OK' : 'Manager off';
  const managerDetail = agentConnected
    ? (agentMeta?.hostname ? agentMeta.hostname : 'no relay')
    : 'ausente';
  const managerTitle = agentConnected
    ? `manager_dealer conectado (${agentMeta?.hostname || 'relay'}${
        agentMeta?.sessionId != null ? ` · sessão #${agentMeta.sessionId}` : ''
      })`
    : 'manager_dealer não está no relay — aguardando novo agente ou reconexão';

  const orderParts = [];
  if (orderTotals.sent) orderParts.push(`${orderTotals.sent} env.`);
  if (orderTotals.follow) orderParts.push(`${orderTotals.follow} follow`);
  const unsent = orderTotals.calculating + orderTotals.pending + orderTotals.awaiting;
  if (unsent) orderParts.push(`${unsent} pend.`);
  const orderDetail = orderParts.length ? orderParts.join(' · ') : 'sem ordens';

  const totalDealers = dealers.length;
  const liveDealers = (dealerCounts.online || 0) + (dealerCounts.unused || 0);
  const dealerDetailParts = [];
  if (dealerCounts.online) dealerDetailParts.push(`${dealerCounts.online} online`);
  if (dealerCounts.unused) dealerDetailParts.push(`${dealerCounts.unused} ocioso`);
  if (dealerCounts.zombie) dealerDetailParts.push(`${dealerCounts.zombie} zumbi`);
  const dealerSecondaryDetail = totalDealers
    ? `${totalDealers} PID${totalDealers !== 1 ? 's' : ''}${dealerDetailParts.length ? ` · ${dealerDetailParts.join(' · ')}` : ''}`
    : 'nenhum';

  const syncLabel = formatStateTs(stateTs);

  return (
    <div className="dealer-sys-bar" role="status" aria-live="polite">
      <DealerPrimaryPill
        dealers={dealers}
        selectedDealer={selectedDealer}
        managerOffline={!agentConnected}
      />

      <span className="dealer-sys-divider" aria-hidden="true" />

      <SecondaryPill
        ok={wsOk}
        warn={wsConnecting}
        icon={TbNetwork}
        label={wsLabel}
        detail={wsOk ? 'browser ↔ relay' : wsConnecting ? 'conectando' : wsStatus}
        title="Conexão WebSocket do browser com o relay (ws_relay_server)"
      />
      <SecondaryPill
        ok={agentConnected}
        icon={TbCpu}
        label={managerLabel}
        detail={managerDetail}
        title={managerTitle}
      />
      <SecondaryPill
        ok={orderTotals.sent > 0}
        warn={unsent > 0 && orderTotals.sent === 0}
        icon={TbLayoutList}
        label="Ordens"
        detail={orderDetail}
        title={`Total: ${totalDealers} PID${totalDealers !== 1 ? 's' : ''} · ${dealerSecondaryDetail} · Enviada = no SideSwap; Pendente = aguardando`}
      />
      {syncLabel && (
        <SecondaryPill
          ok={wsOk && agentConnected}
          icon={TbRefresh}
          label="Sync"
          detail={syncLabel}
          title="Último state_update do manager"
        />
      )}
      {telegramStatus != null && (
        <SecondaryPill
          ok={telegramStatus.active}
          warn={telegramStatus.botCount > 0 && !telegramStatus.active}
          icon={TbBrandTelegram}
          label="Telegram"
          detail={
            telegramStatus.active
              ? `${telegramStatus.chatCount} chat${telegramStatus.chatCount !== 1 ? 's' : ''}`
              : telegramStatus.botCount > 0
                ? 'sem chats'
                : 'não conf.'
          }
          title={
            telegramStatus.active
              ? `Telegram ativo — ${telegramStatus.botCount} bot(s) · ${telegramStatus.chatCount} chat(s)`
              : 'Telegram não configurado — vá em Settings → Telegram'
          }
        />
      )}
    </div>
  );
}
