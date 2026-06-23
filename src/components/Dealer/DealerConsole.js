import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import Nav from 'react-bootstrap/Nav';
import {
  TbPlayerPlay, TbList, TbPlayerStop, TbSend, TbX,
  TbArrowsExchange, TbRefresh, TbHistory, TbMessage,
  TbBug, TbLogout, TbWallet, TbBook, TbHeartbeat, TbCoins,
  TbSettings, TbLayoutDashboard, TbChartLine, TbTerminal2, TbNetwork, TbChevronLeft, TbChevronRight, TbRocket,
} from 'react-icons/tb';
import ArchitecturePanel from './ArchitecturePanel';
import StrategyPanel from './StrategyPanel';
import useDealerWs from './useDealerWs';
import useSideswapBook from './useSideswapBook';
import useMarketScan from './useMarketScan';
import MarketOpportunities from './MarketOpportunities';
import { loadSession, clearSession, resolveWsUrl } from './config';
import {
  fetchVaultDealers,
  dealersToWallets,
  walletStatusLabel,
} from './vault/vaultApi';
import AssetsPanel from './AssetsPanel';
import DealerBalancesBar from './DealerBalancesBar';
import OrdersPanel from './OrdersPanel';
import OrderPlacementPanel from './OrderPlacementPanel';
import TransactionsPanel from './TransactionsPanel';
import OrderBookPresenceBadge from './OrderBookPresenceBadge';
import { formatBookAmount } from './utils/sideswapBook';
import {
  resolveOrderBookPresence,
  sortOrderHistoryByBook,
} from './utils/orderPlacementStatus';
import MessagesModal from './MessagesModal';
import { buildMessageFeed } from './utils/messages';
import {
  normalizeCommandResult,
  findLiveDealer,
  describeSendOrderResult,
} from './utils/commandResult';
import PairSelectors from './PairSelectors';
import { describeTrade, getMarketFromState } from './utils/marketCatalog';
import PriceFields, {
  buildPriceParams,
  formatOrderSpreadSummary,
  orderToSpreadForm,
  orderToSendForm,
  validatePriceForm,
} from './PriceFields';
import {
  loadOrderRegistry,
  touchOrderRegistryFromDealers,
  saveSentOrderToRegistry,
  removeOrderFromRegistry,
  registryEntryToOrder,
  ORDER_REGISTRY_KEY,
} from './utils/orderRegistry';
import { formatAssetBalance, normalizeBalances, flattenDealerOrders } from './utils/dealerFormat';
import {
  prepareDealerOrders,
  normalizeSendParams,
  cleanPairName,
} from './utils/orderMarketNormalize';
import { buildDealerList, dealersSummaryLabel } from './utils/dealerStatus';
import {
  touchRegistryFromDealers,
  removeDealerFromRegistry,
  DEALER_REGISTRY_KEY,
} from './utils/dealerRegistry';
import {
  assessOrderLoss,
  buildLossSendSignature,
  LOSS_SEND_CONFIRM_STEPS,
} from './utils/orderMargin';
import DealerStatusBadge from './DealerStatusBadge';
import DealerSettings from './DealerSettings';
import SystemStatusBar from './SystemStatusBar';
import MarketRatesBar from './MarketRatesBar';
import OrderStatusSignal from './OrderStatusSignal';
import { loadDealerPreferences } from './utils/dealerPreferences';
import { log, registerPushLog } from './utils/logger';
import LogsPanel from './LogsPanel';
import { FollowRefLink } from './utils/followTarget';
import './Dealer.css';
import './DealerTheme.css';
import useMobileLayout from './useMobileLayout';
import { getWalletColor, walletColorStyle } from './utils/walletColors';

function DealerCard({ dealer, onSelect, selected, managerOffline = false }) {
  const assets = normalizeBalances(dealer.balances);
  const { orders: displayOrders } = prepareDealerOrders(dealer.orders || []);
  const isInactive = !dealer.isLive;
  const wallet = dealer.wallet_name || '—';
  const walletColor = getWalletColor(wallet);

  return (
    <div
      className={`dealer-card ${selected ? 'selected' : ''} dealer-card-${dealer.dealerStatus || 'morto'}${managerOffline ? ' dealer-card-manager-offline' : ''}`}
      style={walletColorStyle(wallet)}
      onClick={() => onSelect(selected ? null : dealer.pid)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(selected ? null : dealer.pid)}
    >
      <div className="dealer-card-head">
        <strong>PID {dealer.pid}</strong>
        <span
          className="dealer-wallet-badge"
          style={{
            background: walletColor.bg,
            color: walletColor.text,
            borderColor: walletColor.border,
          }}
        >
          {wallet}
        </span>
        <DealerStatusBadge dealer={dealer} managerOffline={managerOffline} />
      </div>
      <div className="dealer-card-meta">
        API:{dealer.port_api} · WS:{dealer.port_ws}
        {isInactive && <span className="dealer-card-inactive-hint"> · sem sync ao vivo</span>}
      </div>
      <div className="dealer-card-balances">
        {assets.length > 0 ? (
          assets.map(({ asset, value }) => (
            <span key={asset} className="dealer-balance-chip">
              {asset}: <strong>{formatAssetBalance(asset, value)}</strong>
            </span>
          ))
        ) : (
          <span className="dealer-balance-pending">
            {dealer.dealerStatus === 'morto' && 'Saldos: indisponível (morto)'}
            {dealer.dealerStatus === 'zombie' && 'Saldos: sem sync WS — dados do backend'}
            {dealer.dealerStatus !== 'morto' && dealer.dealerStatus !== 'zombie' && 'Saldos: aguardando sync…'}
          </span>
        )}
      </div>
      {displayOrders.length > 0 && (
        <div className="dealer-card-orders">
          {displayOrders.map((o) => (
            <div
              key={`${o.base}-${o.quote}-${o.trade_dir}-${o.order_id || 'p'}`}
              className={`dealer-order-chip ${o.follow_target ? 'follow' : o.order_id ? 'sent' : 'pending'}`}
            >
              <div className="dealer-order-chip-main">
                <OrderStatusSignal order={o} size="sm" managerOffline={managerOffline} />
                <span>
                  {cleanPairName(o.base, o.quote)} {o.trade_dir}
                  {!o.order_id && !o.follow_target && (
                    <Badge bg="secondary" className="ms-1">pendente</Badge>
                  )}
                </span>
                <span className="dealer-order-chip-price">
                  {formatOrderSpreadSummary(o)}
                </span>
              </div>
              <div className="dealer-order-chip-meta">
                {o.order_id && <code className="dealer-order-chip-id">{o.order_id}</code>}
                {o.book_label && o.book_label !== '-' && (
                  <span className="dealer-order-pos">book {o.book_label}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DealerRailChip({ dealer, selected, onSelect, managerOffline = false }) {
  const wallet = dealer.wallet_name || '—';
  const status = dealer.dealerStatus || 'morto';
  const walletColor = getWalletColor(wallet);

  return (
    <button
      type="button"
      className={`dealer-rail-chip dealer-rail-chip-${status}${selected ? ' selected' : ''}${managerOffline ? ' dealer-rail-chip-manager-offline' : ''}`}
      style={walletColorStyle(wallet)}
      onClick={() => onSelect(dealer.pid)}
      title={`PID ${dealer.pid} · ${wallet}`}
      aria-label={`Selecionar ${wallet} PID ${dealer.pid}`}
      aria-pressed={selected}
    >
      <span className="dealer-rail-chip-pid">{dealer.pid}</span>
      <span className="dealer-rail-chip-wallet">{wallet}</span>
    </button>
  );
}

function DealerRailCollapsed({ dealers, selectedPid, onSelectPid, onExpand, managerOffline = false }) {
  return (
    <div className="dealer-rail-column">
      <button
        type="button"
        className="dealer-rail-expand"
        onClick={onExpand}
        title="Expandir lista de dealers"
        aria-label="Expandir lista de dealers"
      >
        <TbChevronRight aria-hidden />
      </button>
      <div className="dealer-rail-chips" role="list" aria-label="Dealers">
        {dealers.length === 0 ? (
          <span className="dealer-rail-empty" title="Nenhum dealer ativo">—</span>
        ) : (
          dealers.map((d) => (
            <DealerRailChip
              key={d.pid}
              dealer={d}
              selected={selectedPid === d.pid}
              onSelect={onSelectPid}
              managerOffline={managerOffline}
            />
          ))
        )}
      </div>
    </div>
  );
}

const CommandPanel = React.memo(function CommandPanel({
  selectedPid,
  onSelectPid,
  activeDealers,
  onDealerStarted,
  onDealerStopped,
  savedOrders,
  onBumpOrderRegistry,
  agentConnected,
  wsStatus,
  marketData,
  sendCommand,
  busy,
  setBusy,
  setFeedback,
  defaultHistoryDestination = 'api',
  bookPlacements = [],
  marketBooks = {},
  marketIndPrices = {},
  marketBookStatus = 'idle',
  marketBookError = null,
  onReconnectMarketBook,
}) {
  const [mnemonicIndex, setMnemonicIndex] = useState('1');
  const [walletName, setWalletName] = useState('');
  const [wallets, setWallets] = useState([]);
  const [vaultLoadErr, setVaultLoadErr] = useState('');
  const [vaultLoading, setVaultLoading] = useState(false);

  const selectedWallet = wallets.find((w) => w.name === walletName) || null;
  const canStartDealer = agentConnected && selectedWallet?.ready;

  const [base, setBase] = useState('L-BTC');
  const [quote, setQuote] = useState('USDt');
  const [tradeDir, setTradeDir] = useState('Buy');
  const [price, setPrice] = useState('');
  const [pricePorc, setPricePorc] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [followTarget, setFollowTarget] = useState(false);
  const [followTargetOrderId, setFollowTargetOrderId] = useState('');
  const [followTargetPosition, setFollowTargetPosition] = useState(1);
  const [amount, setAmount] = useState('999999');
  const [orderId, setOrderId] = useState('');
  const [cancelPick, setCancelPick] = useState(null);
  const [spreadPick, setSpreadPick] = useState(null);
  const [orderPick, setOrderPick] = useState(null);
  const [lossSendConfirm, setLossSendConfirm] = useState({ signature: null, step: 0 });
  const [direction, setDirection] = useState('Buy');
  const [histDest, setHistDest] = useState(defaultHistoryDestination);

  useEffect(() => {
    setHistDest(defaultHistoryDestination);
  }, [defaultHistoryDestination]);

  const run = async (action, params) => {
    if (wsStatus !== 'connected') {
      const fail = { ok: false, data: { error: 'WebSocket não conectado ao relay.' } };
      setFeedback(fail);
      return fail;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const result = await sendCommand(action, params);
      const normalized = normalizeCommandResult(action, result);
      setFeedback(normalized);
      return normalized;
    } catch (err) {
      const fail = { ok: false, data: { error: err.message } };
      setFeedback(fail);
      return fail;
    } finally {
      setBusy(false);
    }
  };

  const handleStartDealer = async () => {
    const result = await run('start_dealer', {
      mnemonic_index: parseInt(mnemonicIndex, 10),
      wallet_name: walletName,
    });
    if (result?.ok && result.data?.pid) {
      onDealerStarted(result.data);
    }
  };

  const handleStopDealer = async () => {
    if (!selectedPid) return;
    const live = findLiveDealer(activeDealers, selectedPid);
    if (!live) {
      setFeedback({ ok: false, data: { error: `PID ${selectedPid} não está ativo no backend (zumbi/morto).` } });
      return;
    }
    const result = await run('stop_dealer', { pid: selectedPid });
    if (result?.ok) {
      onDealerStopped(selectedPid);
    }
  };

  const activeDealer = activeDealers.find((d) => d.pid === selectedPid);
  const { combinations } = marketData;

  const cancelChoices = useMemo(
    () => flattenDealerOrders(activeDealers, { pid: selectedPid || null }),
    [activeDealers, selectedPid],
  );

  const followTargetChoices = useMemo(
    () => flattenDealerOrders(activeDealers, { sentOnly: true }).filter(
      (item) => item.order.base === base
        && item.order.quote === quote
        && item.order.trade_dir === tradeDir
        && item.pid !== selectedPid,
    ),
    [activeDealers, base, quote, tradeDir, selectedPid],
  );

  const cancelTargetPid = selectedPid || cancelPick?.pid || null;

  useEffect(() => {
    setCancelPick((prev) => {
      if (!prev || !selectedPid || prev.pid === selectedPid) return prev;
      return null;
    });
  }, [selectedPid]);

  const handleCancelOrder = async () => {
    const pid = cancelTargetPid;
    if (!pid) return;
    const params = { pid };
    if (!cancelPick?.all) {
      if (cancelPick?.pending) {
        params.pending = true;
        params.base = cancelPick.base;
        params.quote = cancelPick.quote;
        params.trade_dir = cancelPick.trade_dir;
      } else {
        const oid = cancelPick?.orderId || orderId.trim();
        if (oid) params.order_id = oid;
      }
    }
    if (!cancelPick?.all && !params.order_id && !params.pending) return;
    await run('cancel_order', params);
  };

  const selectCancelOrder = (item) => {
    if (item.isPending) {
      setCancelPick({
        pid: item.pid,
        pending: true,
        base: item.order.base,
        quote: item.order.quote,
        trade_dir: item.order.trade_dir,
        cancelKey: item.cancelKey,
      });
      setOrderId('');
      return;
    }
    setCancelPick({ pid: item.pid, orderId: item.order.order_id, cancelKey: item.cancelKey });
    setOrderId(String(item.order.order_id));
  };

  const isCancelItemSelected = (item) => (
    cancelPick?.pid === item.pid
    && cancelPick?.cancelKey === item.cancelKey
    && !cancelPick?.all
  );

  const spreadChoices = useMemo(
    () => flattenDealerOrders(activeDealers, { pid: selectedPid || null, sentOnly: true }),
    [activeDealers, selectedPid],
  );

  const spreadTargetPid = selectedPid || spreadPick?.pid || null;
  const spreadSelectedOrder = spreadPick
    ? spreadChoices.find(
      (item) => item.pid === spreadPick.pid && item.order.order_id === spreadPick.orderId,
    )?.order
    : null;

  useEffect(() => {
    setSpreadPick((prev) => {
      if (!prev || !selectedPid || prev.pid === selectedPid) return prev;
      return null;
    });
  }, [selectedPid]);

  const selectSpreadOrder = (item) => {
    const form = orderToSpreadForm(item.order);
    setSpreadPick({ pid: item.pid, orderId: item.order.order_id });
    setBase(form.base);
    setQuote(form.quote);
    setTradeDir(form.tradeDir);
    setPrice(form.price);
    setPricePorc(form.pricePorc);
    setPriceMin(form.priceMin);
    setFollowTarget(form.followTarget);
    setFollowTargetOrderId(form.followTargetOrderId);
    setFollowTargetPosition(form.followTargetPosition || 1);
  };

  const isSpreadItemSelected = (item) => (
    spreadPick?.pid === item.pid && spreadPick?.orderId === item.order.order_id
  );

  const handleChangeSpread = async () => {
    const pid = spreadTargetPid;
    if (!pid || !spreadPick) return;
    const validation = validatePriceForm({
      price, pricePorc, priceMin, followTarget, followTargetOrderId,
    });
    if (!validation.ok) {
      setFeedback({ ok: false, data: { error: validation.error } });
      return;
    }
    await run('change_spread', {
      pid,
      base,
      quote,
      trade_dir: tradeDir,
      ...buildPriceParams({
        price, pricePorc, priceMin, followTarget, followTargetOrderId,
      }),
    });
  };

  const handleSetFollowTarget = async (enabled) => {
    const pid = spreadTargetPid;
    if (!pid || !spreadPick) return;
    const validation = validatePriceForm({
      price: '', pricePorc: '', priceMin, followTarget: enabled, followTargetOrderId,
    });
    if (enabled && !validation.ok) {
      setFeedback({ ok: false, data: { error: validation.error } });
      return;
    }
    const params = {
      pid,
      base,
      quote,
      trade_dir: tradeDir,
      follow_target: enabled,
    };
    const pm = buildPriceParams({ priceMin, followTarget: true }).price_min;
    if (pm != null) params.price_min = pm;
    const pin = String(followTargetOrderId || '').trim();
    if (pin) params.follow_target_order_id = pin;
    const pos = parseInt(followTargetPosition, 10);
    if (pos >= 1) params.follow_target_position = pos;
    const result = await run('set_follow_target', params);
    if (result?.ok) {
      setFollowTarget(enabled);
    }
  };

  const placementByOrderId = useMemo(() => {
    const map = new Map();
    (bookPlacements || []).forEach((p) => {
      const id = p.order?.order_id;
      if (id != null) map.set(String(id), p);
    });
    return map;
  }, [bookPlacements]);

  const dealerByPid = useMemo(
    () => new Map((activeDealers || []).map((d) => [d.pid, d])),
    [activeDealers],
  );

  const orderHistoryChoices = useMemo(() => {
    const list = savedOrders || [];
    const filtered = selectedPid ? list.filter((e) => e.pid === selectedPid) : list;
    return sortOrderHistoryByBook(filtered, {
      placementByOrderId,
      dealerByPid,
      combinations: marketData?.combinations || [],
    });
  }, [savedOrders, selectedPid, placementByOrderId, dealerByPid, marketData?.combinations]);

  const orderTargetPid = selectedPid || orderPick?.pid || null;

  const sendFormSignature = useMemo(() => buildLossSendSignature({
    pid: orderTargetPid,
    base,
    quote,
    trade_dir: tradeDir,
    ...buildPriceParams({
      price, pricePorc, priceMin, followTarget, followTargetOrderId,
    }),
    amount: parseInt(String(amount).replace(/\D/g, ''), 10) || 999999,
  }), [orderTargetPid, base, quote, tradeDir, price, pricePorc, priceMin, followTarget, followTargetOrderId, amount]);

  useEffect(() => {
    if (lossSendConfirm.signature !== sendFormSignature) {
      setLossSendConfirm({ signature: sendFormSignature, step: 0 });
    }
  }, [sendFormSignature, lossSendConfirm.signature]);

  const pendingLossStep = lossSendConfirm.signature === sendFormSignature
    ? lossSendConfirm.step
    : 0;

  useEffect(() => {
    setOrderPick((prev) => {
      if (!prev || !selectedPid || prev.pid === selectedPid) return prev;
      return null;
    });
  }, [selectedPid]);

  const selectSavedOrder = (entry) => {
    const form = orderToSendForm(registryEntryToOrder(entry));
    setOrderPick({ registryId: entry.registryId, pid: entry.pid });
    setBase(form.base);
    setQuote(form.quote);
    setTradeDir(form.tradeDir);
    setPrice(form.price);
    setPricePorc(form.pricePorc);
    setPriceMin(form.priceMin);
    setFollowTarget(form.followTarget);
    setFollowTargetOrderId(form.followTargetOrderId);
    setFollowTargetPosition(form.followTargetPosition || 1);
    setAmount(form.amount);
  };

  const isOrderHistorySelected = (entry) => orderPick?.registryId === entry.registryId;

  const handleSendOrder = async () => {
    const pid = orderTargetPid;
    if (!pid) return;
    const live = findLiveDealer(activeDealers, pid);
    if (!live) {
      setFeedback({
        ok: false,
        data: { error: `PID ${pid} não está ativo. Selecione um dealer online ou inicie um novo (Run).` },
      });
      return;
    }
    const priceFields = buildPriceParams({
      price, pricePorc, priceMin, followTarget, followTargetOrderId,
    });
    const validation = validatePriceForm({
      price, pricePorc, priceMin, followTarget, followTargetOrderId,
    });
    if (!validation.ok) {
      setFeedback({
        ok: false,
        data: { error: validation.error },
      });
      return;
    }
    const rawParams = {
      pid,
      base,
      quote,
      trade_dir: tradeDir,
      amount: parseInt(String(amount).replace(/\D/g, ''), 10) || 999999,
      ...priceFields,
    };
    const params = normalizeSendParams(rawParams);
    const lossCheck = assessOrderLoss({
      base: params.base,
      quote: params.quote,
      trade_dir: params.trade_dir,
      price: params.price,
      price_porc: params.price_porc,
      price_min: params.price_min,
      follow_target: params.follow_target,
      original_price: params.original_price,
    });

    if (lossCheck.hasLoss && pendingLossStep < LOSS_SEND_CONFIRM_STEPS) {
      const nextStep = pendingLossStep + 1;
      setLossSendConfirm({ signature: sendFormSignature, step: nextStep });
      setFeedback({
        ok: false,
        data: {
          error: nextStep < LOSS_SEND_CONFIRM_STEPS
            ? `Operação com ${lossCheck.label}. Clique em Enviar novamente para confirmar (${nextStep}/${LOSS_SEND_CONFIRM_STEPS}).`
            : `Última confirmação: ${lossCheck.label}. Clique em Enviar mais uma vez para enviar com perda.`,
          lossConfirm: { step: nextStep, total: LOSS_SEND_CONFIRM_STEPS, label: lossCheck.label },
        },
      });
      return;
    }

    const result = await run('send_order', {
      ...params,
      confirm_loss: lossCheck.hasLoss,
    });
    setLossSendConfirm({ signature: sendFormSignature, step: 0 });
    if (result?.ok) {
      const dealer = activeDealers.find((d) => d.pid === pid);
      saveSentOrderToRegistry(pid, dealer?.wallet_name, params, result.data?.order);
      onBumpOrderRegistry();
      const summary = [
        describeSendOrderResult(result),
        params.normalizeNote,
      ].filter(Boolean).join('\n');
      setFeedback({
        ...result,
        data: { ...result.data, summary },
      });
    }
  };

  const pairProps = {
    combinations,
    base,
    quote,
    tradeDir,
    onBaseChange: setBase,
    onQuoteChange: setQuote,
    onTradeDirChange: setTradeDir,
  };

  const loadWalletsFromVault = useCallback(async () => {
    setVaultLoading(true);
    setVaultLoadErr('');
    const r = await fetchVaultDealers();
    setVaultLoading(false);
    if (!r.ok) {
      setVaultLoadErr(r.data?.error || `Vault indisponível (HTTP ${r.status})`);
      setWallets([]);
      return;
    }
    const list = dealersToWallets(r.data.dealers || []);
    setWallets(list);
    setWalletName((prev) => {
      if (prev && list.some((w) => w.name === prev)) return prev;
      if (!list.length) return '';
      const pick = list.find((w) => w.ready) || list[0];
      setMnemonicIndex(String(pick.index));
      return pick.name;
    });
  }, []);

  useEffect(() => {
    loadWalletsFromVault();
  }, [loadWalletsFromVault]);

  const loadWallets = async () => {
    await loadWalletsFromVault();
    if (agentConnected && wsStatus === 'connected') {
      try {
        await run('vault_sync_keys', {});
      } catch {
        // manager antigo sem a ação — ignora
      }
      const r = await run('get_wallets', {});
      if (r?.ok && r.data?.wallets?.length) {
        setWallets(r.data.wallets);
      }
    }
  };

  return (
    <Tabs defaultActiveKey="run" className="dealer-tabs">
      <Tab eventKey="run" title={<><TbPlayerPlay /> Run</>}>
        <div className="dealer-form-block">
          <div className="d-flex gap-2 flex-wrap align-items-center mb-2">
            <Button size="sm" variant="outline-secondary" onClick={loadWallets} disabled={busy || vaultLoading}>
              {vaultLoading ? 'Carregando…' : 'Atualizar catálogo Vault'}
            </Button>
            <span className="dealer-empty" style={{ fontSize: '0.8rem' }}>
              Wallets vêm do Vault (website), não do .env do celular.
            </span>
          </div>

          {vaultLoadErr && (
            <div className="dealer-vault-warning mb-2" style={{ color: '#f85149' }}>
              {vaultLoadErr}
            </div>
          )}

          {wallets.length === 0 && !vaultLoading && !vaultLoadErr && (
            <div className="dealer-status-banner dealer-status-banner-warning mb-2 py-2 px-2" style={{ borderRadius: 8 }}>
              <strong>Nenhuma carteira no Vault.</strong>{' '}
              Abra <strong>Settings → Vault</strong> e crie uma carteira (ex.: <code>depix_pool</code>).
            </div>
          )}

          {wallets.length > 0 && (
            <Form.Select
              size="sm"
              className="mt-2"
              value={walletName}
              onChange={(e) => {
                const w = wallets.find((x) => x.name === e.target.value);
                setWalletName(e.target.value);
                if (w) setMnemonicIndex(String(w.index));
              }}
            >
              {wallets.map((w) => (
                <option key={w.dealer_id || w.index} value={w.name}>
                  {w.index}: {w.name} — {walletStatusLabel(w)}
                </option>
              ))}
            </Form.Select>
          )}

          {!agentConnected && wallets.length > 0 && (
            <div className="dealer-vault-warning mt-2">
              Manager offline — catálogo OK, mas <strong>start_dealer</strong> exige manager conectado ao relay.
            </div>
          )}

          {selectedWallet && !selectedWallet.ready && (
            <div className="dealer-vault-warning mt-2">
              Wallet <strong>{selectedWallet.name}</strong> ainda não está pronta ({walletStatusLabel(selectedWallet)}).
              Conclua em Settings → Vault (passphrase).
            </div>
          )}

          <Row className="g-2 mt-1">
            <Col xs={4}>
              <Form.Control
                size="sm" placeholder="index"
                value={mnemonicIndex} onChange={(e) => setMnemonicIndex(e.target.value)}
                readOnly
              />
            </Col>
            <Col xs={8}>
              <Form.Control
                size="sm" placeholder="wallet (Vault)"
                value={walletName} onChange={(e) => setWalletName(e.target.value)}
                readOnly={wallets.length > 0}
              />
            </Col>
          </Row>
          <Button
            className="dealer-btn-primary mt-2"
            disabled={busy || !canStartDealer}
            onClick={handleStartDealer}
            title={
              !agentConnected
                ? 'Manager offline'
                : !selectedWallet?.ready
                  ? 'Vault não pronto para esta wallet'
                  : 'Iniciar dealer'
            }
          >
            start_dealer
          </Button>
        </div>
      </Tab>

      <Tab eventKey="list" title={<><TbList /> List</>}>
        <Button
          className="dealer-btn-primary"
          disabled={busy}
          onClick={() => run('list_detailed', {})}
        >
          list_detailed
        </Button>
      </Tab>

      <Tab eventKey="stop" title={<><TbPlayerStop /> Stop</>}>
        {activeDealers.length > 0 ? (
          <Form.Select
            size="sm"
            className="mb-2"
            value={selectedPid || ''}
            onChange={(e) => onSelectPid(parseInt(e.target.value, 10))}
          >
            <option value="">Selecione o dealer ({dealersSummaryLabel(activeDealers)})</option>
            {activeDealers.map((d) => (
              <option key={d.pid} value={d.pid}>
                PID {d.pid} — {d.wallet_name} [{d.statusLabel}]
              </option>
            ))}
          </Form.Select>
        ) : (
          <p className="dealer-empty mb-2">Nenhum dealer conhecido. Inicie um na aba Run.</p>
        )}
        {activeDealer && (
          <div className="dealer-stop-info">
            <div><span>Status</span><strong><DealerStatusBadge dealer={activeDealer} /></strong></div>
            <div><span>PID</span><strong>{activeDealer.pid}</strong></div>
            <div><span>Wallet</span><strong>{activeDealer.wallet_name}</strong></div>
            <div><span>API</span><strong>{activeDealer.port_api}</strong></div>
            <div><span>WS</span><strong>{activeDealer.port_ws}</strong></div>
          </div>
        )}
        <Button
          className="dealer-btn-danger mt-2"
          disabled={busy || !selectedPid}
          onClick={handleStopDealer}
        >
          stop_dealer
        </Button>
        {activeDealer?.dealerStatus === 'zombie' && (
          <p className="dealer-empty mt-2 mb-0">Zumbi: ainda no backend — tente stop para limpar.</p>
        )}
      </Tab>

      <Tab eventKey="order" title={<><TbSend /> Order</>}>
        <p className="dealer-cancel-hint">
          {selectedPid
            ? `Histórico do PID ${selectedPid}${activeDealer?.wallet_name ? ` (${activeDealer.wallet_name})` : ''}`
            : 'Ordens salvas — clique para reutilizar no formulário abaixo'}
        </p>

        {orderHistoryChoices.length > 0 ? (
          <div className="dealer-cancel-list dealer-order-history-list">
            {orderHistoryChoices.map((entry) => {
              const historyOrder = registryEntryToOrder(entry);
              const placement = entry.order_id
                ? placementByOrderId.get(String(entry.order_id))
                : null;
              const bookPresence = resolveOrderBookPresence({
                order: historyOrder,
                balances: dealerByPid.get(entry.pid)?.balances,
                placement,
                combinations: marketData?.combinations || [],
              });

              return (
              <button
                key={entry.registryId}
                type="button"
                className={`dealer-cancel-item ${isOrderHistorySelected(entry) ? 'selected' : ''}`}
                onClick={() => selectSavedOrder(entry)}
                disabled={busy}
              >
                <span className="dealer-cancel-dealer">
                  PID {entry.pid} · {entry.wallet_name || '—'}
                  {bookPresence?.badgeLabel ? (
                    <OrderBookPresenceBadge
                      presence={bookPresence}
                      className="ms-1 dealer-order-live-badge"
                    />
                  ) : entry.isLive ? (
                    <Badge bg="success" className="ms-1 dealer-order-live-badge">ativa</Badge>
                  ) : (
                    <Badge bg="secondary" className="ms-1 dealer-order-live-badge">histórico</Badge>
                  )}
                </span>
                <span className="dealer-cancel-pair">
                  {entry.base}/{entry.quote} {entry.trade_dir}
                </span>
                <span className="dealer-cancel-price">
                  {entry.spreadSummary || formatOrderSpreadSummary(historyOrder)}
                  {entry.amount != null && entry.amount !== 999999 && (
                    <> · amt {formatBookAmount(entry.amount, entry.base)}</>
                  )}
                </span>
                {entry.order_id && (
                  <code className="dealer-cancel-id">{entry.order_id}</code>
                )}
              </button>
              );
            })}
          </div>
        ) : (
          <p className="dealer-empty mb-2">
            Nenhuma ordem salva ainda. Envie uma ordem ou aguarde o sync ao vivo.
          </p>
        )}

        {orderPick && (
          <div className="dealer-order-pick-actions">
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={busy}
              onClick={() => setOrderPick(null)}
            >
              Limpar seleção
            </Button>
            <Button
              size="sm"
              variant="outline-danger"
              disabled={busy}
              onClick={() => {
                removeOrderFromRegistry(orderPick.registryId);
                setOrderPick(null);
                onBumpOrderRegistry();
              }}
            >
              Remover do histórico
            </Button>
          </div>
        )}

        <div className="dealer-order-form mt-3">
          {orderPick && (
            <div className="dealer-spread-current mb-3">
              <div className="dealer-spread-current-title">Ordem carregada</div>
              <div className="dealer-spread-current-row">
                <span>PID {orderTargetPid} · {orderHistoryChoices.find((e) => e.registryId === orderPick.registryId)?.wallet_name || '—'}</span>
                <strong>{describeTrade(base, quote, tradeDir).pairLabel}</strong>
              </div>
            </div>
          )}

          <PairSelectors {...pairProps} />
          <PriceFields
            price={price}
            pricePorc={pricePorc}
            priceMin={priceMin}
            followTarget={followTarget}
            followTargetOrderId={followTargetOrderId}
            followTargetPosition={followTargetPosition}
            followTargetChoices={followTargetChoices}
            base={base}
            quote={quote}
            tradeDir={tradeDir}
            marketAssets={marketData.assets}
            marketCombinations={marketData.combinations}
            marketBooks={marketBooks}
            marketIndPrices={marketIndPrices}
            marketBookStatus={marketBookStatus}
            marketBookError={marketBookError}
            onReconnectMarketBook={onReconnectMarketBook}
            amount={amount}
            onPriceChange={setPrice}
            onPricePorcChange={setPricePorc}
            onPriceMinChange={setPriceMin}
            onFollowTargetChange={setFollowTarget}
            onFollowTargetOrderIdChange={setFollowTargetOrderId}
            onFollowTargetPositionChange={setFollowTargetPosition}
            onAmountChange={setAmount}
          />
          <Button
            className={`dealer-btn-primary mt-3${pendingLossStep > 0 ? ' dealer-btn-loss-confirm' : ''}`}
            disabled={busy || !orderTargetPid}
            variant={pendingLossStep > 0 ? 'warning' : 'primary'}
            onClick={handleSendOrder}
          >
            {pendingLossStep > 0
              ? `Confirmar envio com perda (${pendingLossStep}/${LOSS_SEND_CONFIRM_STEPS})`
              : `Enviar — ${describeTrade(base, quote, tradeDir).pairLabel}`}
            {orderPick && pendingLossStep === 0 && ' (baseado no histórico)'}
          </Button>
          {pendingLossStep > 0 && (
            <p className="dealer-loss-confirm-hint mt-2 mb-0">
              Esta ordem pode gerar prejuízo. São necessárias {LOSS_SEND_CONFIRM_STEPS} confirmações
              extras antes do envio.
            </p>
          )}
          {!orderTargetPid && (
            <p className="dealer-empty mt-2 mb-0">Selecione um dealer ou uma ordem do histórico.</p>
          )}
        </div>
      </Tab>

      <Tab eventKey="cancel" title={<><TbX /> Cancel</>}>
        <p className="dealer-cancel-hint">
          {selectedPid
            ? `Ordens do PID ${selectedPid}${activeDealer?.wallet_name ? ` (${activeDealer.wallet_name})` : ''}`
            : 'Todas as ordens — escolha PID, wallet e ordem'}
          {' '}· pendentes removem do config (sem order_id no SideSwap)
        </p>

        {cancelChoices.length > 0 ? (
          <div className="dealer-cancel-list">
            {cancelChoices.map((item) => (
              <button
                key={`${item.pid}-${item.cancelKey}`}
                type="button"
                className={`dealer-cancel-item ${isCancelItemSelected(item) ? 'selected' : ''} ${item.isPending ? 'dealer-cancel-pending' : ''}`}
                onClick={() => selectCancelOrder(item)}
                disabled={busy}
              >
                {!selectedPid && (
                  <span className="dealer-cancel-dealer">
                    PID {item.pid} · {item.wallet_name || '—'}
                  </span>
                )}
                <span className="dealer-cancel-pair">
                  {cleanPairName(item.order.base, item.order.quote)} {item.order.trade_dir}
                  {item.isPending && (
                    <Badge bg="secondary" className="ms-1">pendente</Badge>
                  )}
                </span>
                <span className="dealer-cancel-price">
                  {formatOrderSpreadSummary(item.order)}
                </span>
                {item.isPending ? (
                  <span className="dealer-cancel-id dealer-cancel-id-pending">sem ID — remove local</span>
                ) : (
                  <code className="dealer-cancel-id">{item.order.order_id}</code>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="dealer-empty mb-2">
            {selectedPid
              ? 'Nenhuma ordem neste PID.'
              : 'Nenhuma ordem nos dealers conhecidos.'}
          </p>
        )}

        {cancelTargetPid && (
          <button
            type="button"
            className={`dealer-cancel-item dealer-cancel-all ${cancelPick?.all ? 'selected' : ''}`}
            onClick={() => {
              setCancelPick({ pid: cancelTargetPid, all: true });
              setOrderId('');
            }}
            disabled={busy}
          >
            Cancelar todas as ordens do PID {cancelTargetPid}
          </button>
        )}

        <Form.Control
          size="sm"
          placeholder="order_id manual (opcional)"
          value={orderId}
          onChange={(e) => {
            setOrderId(e.target.value);
            if (e.target.value.trim() && cancelTargetPid) {
              setCancelPick({ pid: cancelTargetPid, orderId: e.target.value.trim() });
            }
          }}
          className="mb-2 mt-2"
        />

        <Button
          className="dealer-btn-danger"
          disabled={busy || !cancelTargetPid || (!cancelPick?.all && !cancelPick?.orderId && !cancelPick?.pending && !orderId.trim())}
          onClick={handleCancelOrder}
        >
          cancel_order
          {cancelPick?.all && ' (todas)'}
          {cancelPick?.pending && ` (${cleanPairName(cancelPick.base, cancelPick.quote)} ${cancelPick.trade_dir})`}
          {!cancelPick?.all && !cancelPick?.pending && (cancelPick?.orderId || orderId) && ` (${cancelPick?.orderId || orderId})`}
        </Button>
      </Tab>

      <Tab eventKey="spread" title={<><TbArrowsExchange /> Spread</>}>
        <p className="dealer-cancel-hint">
          {selectedPid
            ? `Ordens do PID ${selectedPid}${activeDealer?.wallet_name ? ` (${activeDealer.wallet_name})` : ''}`
            : 'Todas as ordens — escolha PID, wallet e ordem para alterar o spread'}
        </p>

        {spreadChoices.length > 0 ? (
          <div className="dealer-cancel-list">
            {spreadChoices.map((item) => (
              <button
                key={`spread-${item.pid}-${item.order.order_id}`}
                type="button"
                className={`dealer-cancel-item ${isSpreadItemSelected(item) ? 'selected' : ''}`}
                onClick={() => selectSpreadOrder(item)}
                disabled={busy}
              >
                {!selectedPid && (
                  <span className="dealer-cancel-dealer">
                    PID {item.pid} · {item.wallet_name || '—'}
                  </span>
                )}
                <span className="dealer-cancel-pair">
                  {item.order.base}/{item.order.quote} {item.order.trade_dir}
                </span>
                <span className="dealer-cancel-price">
                  Atual: {formatOrderSpreadSummary(item.order)}
                </span>
                <code className="dealer-cancel-id">{item.order.order_id}</code>
              </button>
            ))}
          </div>
        ) : (
          <p className="dealer-empty mb-2">
            {selectedPid
              ? 'Nenhuma ordem ativa neste PID.'
              : 'Nenhuma ordem ativa nos dealers conhecidos.'}
          </p>
        )}

        {spreadPick && spreadSelectedOrder && (
          <div className="dealer-spread-form mt-3">
            <div className="dealer-spread-current">
              <div className="dealer-spread-current-title">Configuração atual</div>
              <div className="dealer-spread-current-row">
                <span>{spreadSelectedOrder.base}/{spreadSelectedOrder.quote} {spreadSelectedOrder.trade_dir}</span>
                <strong>{formatOrderSpreadSummary(spreadSelectedOrder)}</strong>
              </div>
              {spreadSelectedOrder.follow_ref_order_id && (
                <div className="dealer-spread-current-ref">
                  Alvo rastreado: <FollowRefLink orderId={spreadSelectedOrder.follow_ref_order_id} />
                </div>
              )}
              {spreadSelectedOrder.original_price != null && (
                <div className="dealer-spread-current-ref">
                  Ref. original_price: {spreadSelectedOrder.original_price}
                </div>
              )}
              <Button
                size="sm"
                variant="outline-secondary"
                className="mt-2"
                disabled={busy}
                onClick={() => setSpreadPick(null)}
              >
                Trocar ordem
              </Button>
            </div>

            <PairSelectors {...pairProps} />
            <PriceFields
              price={price}
              pricePorc={pricePorc}
              priceMin={priceMin}
              followTarget={followTarget}
              followTargetOrderId={followTargetOrderId}
              followTargetPosition={followTargetPosition}
              followTargetChoices={followTargetChoices}
              base={base}
              quote={quote}
              tradeDir={tradeDir}
              marketAssets={marketData.assets}
              marketCombinations={marketData.combinations}
              marketBooks={marketBooks}
              marketIndPrices={marketIndPrices}
              marketBookStatus={marketBookStatus}
              marketBookError={marketBookError}
              onReconnectMarketBook={onReconnectMarketBook}
              showAmount={false}
              onPriceChange={setPrice}
              onPricePorcChange={setPricePorc}
              onPriceMinChange={setPriceMin}
              onFollowTargetChange={setFollowTarget}
              onFollowTargetOrderIdChange={setFollowTargetOrderId}
              onFollowTargetPositionChange={setFollowTargetPosition}
              onAmountChange={setAmount}
            />
            <div className="dealer-follow-actions mt-2">
              <Button
                size="sm"
                variant={followTarget ? 'outline-warning' : 'outline-info'}
                disabled={busy || !spreadTargetPid}
                onClick={() => handleSetFollowTarget(!followTarget)}
              >
                {followTarget ? 'Desativar follow (set_follow_target)' : 'Ativar follow (set_follow_target)'}
              </Button>
            </div>
            <Button
              className="dealer-btn-primary mt-3"
              disabled={busy || !spreadTargetPid}
              onClick={handleChangeSpread}
            >
              Alterar spread — {describeTrade(base, quote, tradeDir).pairLabel}
            </Button>
          </div>
        )}

        {!spreadPick && spreadChoices.length > 0 && (
          <p className="dealer-empty mt-2 mb-0">Selecione uma ordem acima para editar o spread.</p>
        )}
      </Tab>

      <Tab eventKey="recharge" title={<><TbRefresh /> Rechg</>}>
        <PairSelectors
          combinations={combinations}
          base={base}
          quote={quote}
          tradeDir={direction}
          onBaseChange={setBase}
          onQuoteChange={setQuote}
          onTradeDirChange={setDirection}
        />
        <Button
          className="dealer-btn-primary mt-2"
          disabled={busy || !selectedPid}
          onClick={() => run('start_recharge', { pid: selectedPid, base, quote, direction })}
        >
          Recarregar — {describeTrade(base, quote, direction).headline}
        </Button>
      </Tab>

      <Tab eventKey="hist" title={<><TbHistory /> Hist</>}>
        <Form.Select size="sm" value={histDest} onChange={(e) => setHistDest(e.target.value)} className="mb-2">
          <option value="api">api</option>
          <option value="ssh">ssh</option>
        </Form.Select>
        <Button
          className="dealer-btn-primary"
          disabled={busy || !selectedPid}
          onClick={() => run('send_history', { pid: selectedPid, destination: histDest })}
        >
          send_history
        </Button>
      </Tab>

      <Tab eventKey="extra" title="Extras">
        <div className="dealer-extra-btns">
          <Button size="sm" variant="outline-light" disabled={busy} onClick={() => run('get_messages', {})}>
            <TbMessage /> get_messages
          </Button>
          <Button size="sm" variant="outline-light" disabled={busy} onClick={() => run('debug_report', {})}>
            <TbBug /> debug_report
          </Button>
          <Button size="sm" variant="outline-light" disabled={busy} onClick={() => run('get_wallets', {})}>
            <TbWallet /> get_wallets
          </Button>
          <Button size="sm" variant="outline-light" disabled={busy} onClick={() => run('get_assets', {})}>
            <TbCoins /> get_assets
          </Button>
          <Button size="sm" variant="outline-light" disabled={busy} onClick={() => run('list_dealers', {})}>
            <TbList /> list_dealers
          </Button>
          <Button
            size="sm" variant="outline-light" disabled={busy || !selectedPid}
            onClick={() => run('get_order_book', { pid: selectedPid, base, quote })}
          >
            <TbBook /> get_order_book
          </Button>
          <Button
            size="sm" variant="outline-light" disabled={busy || !selectedPid}
            onClick={() => run('health_check', { pid: selectedPid })}
          >
            <TbHeartbeat /> health_check
          </Button>
          <Button
            size="sm" variant="outline-light" disabled={busy || !selectedPid}
            onClick={() => run('get_own_orders', { pid: selectedPid })}
          >
            get_own_orders
          </Button>
        </div>
      </Tab>
    </Tabs>
  );
});

export default function DealerConsole() {
  const navigate = useNavigate();
  const session = loadSession();
  const [selectedPid, setSelectedPid] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [fetchedDealers, setFetchedDealers] = useState([]);
  const [refreshingAssets, setRefreshingAssets] = useState(false);
  const [lastAssetRefresh, setLastAssetRefresh] = useState(null);
  const [marketFromApi, setMarketFromApi] = useState({ assets: [], combinations: [] });
  const [showMessages, setShowMessages] = useState(false);
  const [orderRegistryTick, setOrderRegistryTick] = useState(0);
  const [mainView, setMainView] = useState('geral');
  const [midTab, setMidTab] = useState('operacional');
  const [operacionalTab, setOperacionalTab] = useState('saldos');
  const [dealersExpanded, setDealersExpanded] = useState(true);
  const [mobilePanel, setMobilePanel] = useState('center');
  const [mobileRendPanel, setMobileRendPanel] = useState('dados');
  const [rendPid, setRendPid] = useState(null);
  const [consolePrefs, setConsolePrefs] = useState(() => loadDealerPreferences());
  const [telegramStatus, setTelegramStatus] = useState(null);
  const [belowMarketThresholdPct, setBelowMarketThresholdPct] = useState(0.5);
  const isMobileLayout = useMobileLayout();
  const dealersCollapsed = !isMobileLayout && !!selectedPid && !dealersExpanded;
  const colDealers = dealersCollapsed ? 1 : 4;
  const colCenter = dealersCollapsed ? 7 : 4;
  const colCommands = 4;

  const bumpOrderRegistry = useCallback(() => setOrderRegistryTick((n) => n + 1), []);

  useEffect(() => {
    if (!session?.authenticated) {
      navigate('/dealer', { replace: true });
    }
  }, [session, navigate]);

  const {
    status, agentConnected, agentMeta, state, messages, events, sendCommand, disconnect, lastError,
  } = useDealerWs(session?.wsUrl, session?.token, !!session?.authenticated);

  // Registra push_log no logger global assim que o WS estiver disponível
  useEffect(() => {
    registerPushLog((entry) => {
      if (status === 'connected') {
        return sendCommand('push_log', entry).catch(() => {});
      }
      return null;
    });
  }, [status, sendCommand]);

  const dealers = useMemo(
    () => buildDealerList(state?.dealers || [], fetchedDealers),
    [state?.dealers, fetchedDealers],
  );
  const savedOrders = useMemo(() => {
    touchOrderRegistryFromDealers(dealers);
    return loadOrderRegistry();
  }, [dealers, orderRegistryTick]);
  const marketData = useMemo(
    () => getMarketFromState(state, marketFromApi),
    [state?.assets, state?.combinations, marketFromApi],
  );
  const stateMessages = state?.messages || [];
  const messageCount = useMemo(
    () => buildMessageFeed(stateMessages, messages, 200).length,
    [stateMessages, messages],
  );
  const selectedDealer = dealers.find((d) => d.pid === selectedPid) || null;

  const txSummarySig = useMemo(
    () => (state?.dealers || [])
      .map((d) => `${d.pid}:${d.transactions_summary?.total ?? 0}:${d.transactions_summary?.swap_count ?? 0}`)
      .sort((a, b) => a.localeCompare(b))
      .join('|'),
    [state?.dealers],
  );

  const selectedDealerSentOrders = useMemo(() => {
    const source = selectedDealer ? [selectedDealer] : dealers;
    const all = [];
    for (const d of source) {
      const { orders } = prepareDealerOrders(d.orders || []);
      all.push(...orders.filter((o) => o.order_id));
    }
    return all;
  }, [selectedDealer, dealers]);

  const {
    status: bookStatus,
    error: bookError,
    lastUpdate: bookLastUpdate,
    pairs: bookPairs,
    books: bookData,
    indPrices: bookIndPrices,
    placements: bookPlacements,
    reconnect: reconnectBook,
  } = useSideswapBook(
    selectedDealerSentOrders,
    marketData.assets,
    selectedDealerSentOrders.length > 0,
    marketData.combinations,
  );

  const confirmedOrderIds = useMemo(() => {
    const s = new Set();
    for (const p of bookPlacements) {
      if (p.found && p.order?.order_id != null) s.add(String(p.order.order_id));
    }
    return s;
  }, [bookPlacements]);

  const {
    status: scanStatus,
    error: scanError,
    lastUpdate: scanLastUpdate,
    pairs: scanPairs,
    books: scanBooks,
    indPrices: scanIndPrices,
    reconnect: reconnectScan,
  } = useMarketScan(
    marketData.assets,
    !!marketData.assets?.length,
  );

  const refreshAssets = React.useCallback(async () => {
    if (status !== 'connected' || !agentConnected) return;
    setRefreshingAssets(true);
    try {
      const [listResult, assetsResult] = await Promise.all([
        sendCommand('list_detailed', {}),
        sendCommand('get_assets', {}),
      ]);
      if (assetsResult?.ok && assetsResult.data) {
        setMarketFromApi({
          assets: assetsResult.data.assets || [],
          combinations: assetsResult.data.combinations || [],
        });
      } else {
        log.warn('get_assets falhou ou sem dados', assetsResult?.data);
      }
      if (listResult?.ok && listResult.data?.dealers) {
        setFetchedDealers(listResult.data.dealers);
        setLastAssetRefresh(new Date().toLocaleTimeString('pt-BR'));
        log.debug('list_detailed OK', listResult.data.dealers.length, 'dealer(s)');
      } else {
        log.warn('list_detailed falhou ou sem dealers', listResult?.data);
      }
    } catch (err) {
      log.error('refreshAssets exceção', err);
    } finally {
      setRefreshingAssets(false);
    }
  }, [status, agentConnected, sendCommand]);

  useEffect(() => {
    if (status !== 'connected' || !agentConnected) return;
    sendCommand('get_telegram_config', {}).then((res) => {
      if (!res?.ok) { log.warn('get_telegram_config falhou', res?.data); return; }
      const bots = res.data?.bots || [];
      const chatCount = bots.reduce((n, b) => n + (b.chat_count || 0), 0);
      setTelegramStatus({ active: chatCount > 0, botCount: bots.length, chatCount });
    }).catch((err) => log.warn('get_telegram_config exceção', err));
    sendCommand('get_telegram_alerts_config', {}).then((res) => {
      if (!res?.ok) { log.warn('get_telegram_alerts_config falhou', res?.data); return; }
      const pct = res.data?.below_market_threshold_pct;
      if (pct != null && Number.isFinite(Number(pct))) {
        setBelowMarketThresholdPct(Number(pct));
      }
    }).catch((err) => log.warn('get_telegram_alerts_config exceção', err));
  }, [status, agentConnected, sendCommand]);

  useEffect(() => {
    if (status !== 'connected') return undefined;
    if (!consolePrefs.autoRefreshAssets) return undefined;
    refreshAssets();
    const ms = Math.max(5, consolePrefs.autoRefreshIntervalSec || 15) * 1000;
    const interval = setInterval(refreshAssets, ms);
    return () => clearInterval(interval);
  }, [status, refreshAssets, consolePrefs.autoRefreshAssets, consolePrefs.autoRefreshIntervalSec]);

  useEffect(() => {
    touchRegistryFromDealers(dealers);
  }, [dealers]);

  useEffect(() => {
    if (selectedPid && !dealers.some((d) => d.pid === selectedPid)) {
      const next = dealers.length ? dealers[0].pid : null;
      setSelectedPid(next);
      if (next && !isMobileLayout) setDealersExpanded(false);
    } else if (!selectedPid && dealers.length === 1) {
      setSelectedPid(dealers[0].pid);
      if (!isMobileLayout) setDealersExpanded(false);
    }
  }, [dealers, selectedPid, isMobileLayout]);

  const handleSelectPid = useCallback((pid) => {
    setSelectedPid(pid);
    if (pid != null) {
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 991.98px)').matches) {
        setMobilePanel('center');
      } else {
        setDealersExpanded(false);
      }
    } else {
      setDealersExpanded(true);
    }
  }, []);

  const handleRailSelectPid = useCallback((pid) => {
    setSelectedPid(pid);
  }, []);

  const handleDealerStarted = useCallback((data) => {
    setFetchedDealers((prev) => {
      const rest = prev.filter((d) => d.pid !== data.pid);
      return [...rest, {
        pid: data.pid,
        wallet_name: data.wallet_name,
        port_api: data.port_api,
        port_ws: data.port_ws,
        balances: {},
        orders: [],
      }];
    });
    setSelectedPid(data.pid);
  }, []);

  const handleDealerStopped = useCallback((pid) => {
    removeDealerFromRegistry(pid);
    setFetchedDealers((prev) => prev.filter((d) => d.pid !== pid));
    setSelectedPid((current) => (current === pid ? null : current));
  }, []);

  const handleLogout = () => {
    disconnect();
    sessionStorage.removeItem(DEALER_REGISTRY_KEY);
    sessionStorage.removeItem(ORDER_REGISTRY_KEY);
    clearSession();
    navigate('/dealer', { replace: true });
  };

  if (!session?.authenticated) return null;

  const showWsError = lastError && status === 'error';
  const showAgentOffline = status === 'connected' && !agentConnected;

  return (
    <div className="dealer-root">
      <header className="dealer-topbar">
        <Container fluid>
          <div className="dealer-topbar-inner">
            <div className="dealer-topbar-title-row">
              <h2>Dealer Console</h2>
              <MarketRatesBar
                indPrices={scanIndPrices}
                pairs={scanPairs}
                status={scanStatus}
                lastUpdate={scanLastUpdate}
              />
              <div className="dealer-topbar-actions">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setShowMessages(true)}
                  className="dealer-messages-btn"
                >
                  <TbMessage />
                  <span className="dealer-messages-btn-label">Mensagens</span>
                  {messageCount > 0 && (
                    <Badge bg="secondary" className="dealer-messages-badge">{messageCount}</Badge>
                  )}
                </Button>
                <Button variant="outline-danger" size="sm" onClick={handleLogout}>
                  <TbLogout /> <span className="dealer-logout-label">Sair</span>
                </Button>
              </div>
            </div>
            <Nav variant="pills" className="dealer-main-nav flex-wrap">
              <Nav.Item>
                <Nav.Link
                  active={mainView === 'geral'}
                  onClick={() => setMainView('geral')}
                  className="dealer-main-nav-link"
                >
                  <TbLayoutDashboard /> Geral
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  active={mainView === 'historico'}
                  onClick={() => setMainView('historico')}
                  className="dealer-main-nav-link"
                >
                  <TbChartLine /> Histórico
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  active={mainView === 'oportunidades'}
                  onClick={() => setMainView('oportunidades')}
                  className="dealer-main-nav-link"
                >
                  <TbArrowsExchange /> Oportunidades
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  active={mainView === 'estrategia'}
                  onClick={() => setMainView('estrategia')}
                  className="dealer-main-nav-link"
                >
                  <TbRocket /> Estratégia
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  active={mainView === 'arquitetura'}
                  onClick={() => setMainView('arquitetura')}
                  className="dealer-main-nav-link"
                >
                  <TbNetwork /> Arquitetura
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  active={mainView === 'config'}
                  onClick={() => setMainView('config')}
                  className="dealer-main-nav-link"
                >
                  <TbSettings /> Configurações
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  active={mainView === 'logs'}
                  onClick={() => setMainView('logs')}
                  className="dealer-main-nav-link dealer-main-nav-link-logs"
                >
                  <TbBug />
                  {' Logs'}
                  {(state?.log_summary?.error_count || 0) > 0 && (
                    <Badge bg="danger" className="ms-1 dealer-nav-log-badge">
                      {state.log_summary.error_count}
                    </Badge>
                  )}
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </div>
          <SystemStatusBar
            wsStatus={status}
            agentConnected={agentConnected}
            agentMeta={agentMeta}
            dealers={dealers}
            selectedDealer={mainView === 'geral' ? selectedDealer : null}
            stateTs={state?.ts}
            telegramStatus={telegramStatus}
          />
        </Container>
      </header>

      <div className="dealer-body">
      {showWsError && (
        <div className="dealer-status-banner dealer-status-banner-danger" role="alert">
          <Container fluid>
            <strong>Erro de conexão:</strong> {lastError}
            <div className="dealer-status-banner-hint">
              Relay: <code>{session?.wsUrl || resolveWsUrl()}</code>
              {' — '}
              confirme que <code>ws_relay_server.py</code> está rodando e que o manager_dealer tem{' '}
              <code>WS_RELAY_URL</code> apontando para o mesmo relay.
            </div>
          </Container>
        </div>
      )}

      {showAgentOffline && (
        <div className="dealer-status-banner dealer-status-banner-warning" role="alert">
          <Container fluid>
            <strong>Manager offline.</strong>{' '}
            Relay conectado, mas nenhum <strong>manager_dealer</strong> está ativo no relay agora.
            {dealers.length > 0 && (
              <> A lista abaixo será limpa automaticamente ao reconectar ou trocar de agente.</>
            )}
            <div className="dealer-status-banner-hint">
              Fluxo dev → produção: pare o manager local, inicie no Termux — o novo agente
              substitui o anterior e o console atualiza sozinho (mesmo{' '}
              <code>WS_BRIDGE_TOKEN</code>).
              Wallets e passphrases ficam no <strong>Vault</strong> (Settings → Vault).
            </div>
          </Container>
        </div>
      )}

      {state?.log_summary?.error_count > 0 && mainView !== 'logs' && (
        <div className="dealer-status-banner dealer-status-banner-log-error" role="alert">
          <Container fluid>
            <strong>{state.log_summary.error_count} erro{state.log_summary.error_count !== 1 ? 's' : ''} no manager.</strong>
            {state.log_summary.last_error && (
              <> Último: <code>{state.log_summary.last_error.source}</code> — {state.log_summary.last_error.message}</>
            )}
            {' '}
            <button
              type="button"
              className="dealer-log-error-banner-link"
              onClick={() => setMainView('logs')}
            >
              Ver Logs →
            </button>
          </Container>
        </div>
      )}

      <Container fluid className="dealer-main px-2 px-md-3">
        {mainView === 'logs' ? (
          <Row className="g-3">
            <Col xs={12}>
              <div className="dealer-panel dealer-panel-scroll">
                <LogsPanel
                  sendCommand={sendCommand}
                  wsStatus={status}
                  wsEvents={events}
                  logSummary={state?.log_summary || null}
                />
              </div>
            </Col>
          </Row>
        ) : mainView === 'config' ? (
          <Row className="g-3">
            <Col xs={12}>
              <div className="dealer-panel dealer-settings-panel dealer-panel-scroll">
                <DealerSettings
                  sendCommand={sendCommand}
                  wsStatus={status}
                  agentConnected={agentConnected}
                  wsUrl={session?.wsUrl}
                  onPreferencesChange={setConsolePrefs}
                />
              </div>
            </Col>
          </Row>
        ) : mainView === 'historico' ? (
          <>
          <div className="dealer-mobile-panel-nav dealer-mobile-panel-nav--two d-lg-none" role="tablist" aria-label="Painéis de histórico">
            <button
              type="button"
              role="tab"
              aria-selected={mobileRendPanel === 'carteiras'}
              className={`dealer-mobile-panel-btn${mobileRendPanel === 'carteiras' ? ' active' : ''}`}
              onClick={() => setMobileRendPanel('carteiras')}
            >
              <TbWallet /> Carteiras
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileRendPanel === 'dados'}
              className={`dealer-mobile-panel-btn${mobileRendPanel === 'dados' ? ' active' : ''}`}
              onClick={() => setMobileRendPanel('dados')}
            >
              <TbChartLine /> Histórico
            </button>
          </div>
          <Row className="g-3">
            {(!isMobileLayout || mobileRendPanel === 'carteiras') && (
            <Col xs={12} lg={3} className="dealer-mobile-panel-col">
              <div className="dealer-panel dealer-panel-scroll">
                <h3 className="dealer-rend-sidebar-title"><TbWallet /> Carteiras</h3>
                <button
                  className={`dealer-rend-pid-btn${rendPid === null ? ' active' : ''}`}
                  onClick={() => setRendPid(null)}
                >
                  <span className="dealer-rend-pid-label">Todas as carteiras</span>
                  <span className="dealer-rend-pid-count">{dealers.length} PIDs</span>
                </button>
                {dealers.map((d) => {
                  const wallet = d.wallet_name || '—';
                  const pct = d.transactions_summary?.total_profit_percent;
                  const pctKind = pct == null ? '' : pct > 0.005 ? 'lucro' : pct < -0.005 ? 'perda' : '';
                  return (
                  <button
                    key={d.pid}
                    className={`dealer-rend-pid-btn${rendPid === d.pid ? ' active' : ''}`}
                    style={walletColorStyle(wallet)}
                    onClick={() => {
                      setRendPid(d.pid);
                      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 991.98px)').matches) {
                        setMobileRendPanel('dados');
                      }
                    }}
                  >
                    <span className="dealer-rend-pid-label">
                      PID {d.pid}
                      <span className={`dealer-rend-pid-dot dealer-rend-pid-dot-${d.dealerStatus}`} />
                    </span>
                    <span className="dealer-rend-pid-wallet">{wallet}</span>
                    {pct != null && (
                      <span className={`dealer-rend-pid-pct dealer-tx-${pctKind || 'flow'}`}>
                        {pct >= 0 ? '+' : ''}{(pct * 100).toFixed(2)}%
                      </span>
                    )}
                  </button>
                  );
                })}
                {dealers.length === 0 && (
                  <p className="dealer-empty">Nenhum dealer ativo.</p>
                )}
              </div>
            </Col>
            )}
            {(!isMobileLayout || mobileRendPanel === 'dados') && (
            <Col xs={12} lg={9} className="dealer-mobile-panel-col">
              <div className="dealer-panel dealer-panel-scroll dealer-rend-main">
                <TransactionsPanel
                  dealer={rendPid != null ? dealers.find((d) => d.pid === rendPid) || null : null}
                  dealers={dealers}
                  sendCommand={sendCommand}
                  wsStatus={status}
                  syncOnSelect={consolePrefs.transactionsSyncOnSelect}
                  wsEvents={events}
                  txSummarySig={txSummarySig}
                />
              </div>
            </Col>
            )}
          </Row>
          </>
        ) : mainView === 'arquitetura' ? (
          <Row className="g-3">
            <Col xs={12}>
              <div className="dealer-panel dealer-panel-scroll">
                <ArchitecturePanel
                  wsStatus={status}
                  wsUrl={session?.wsUrl || resolveWsUrl()}
                  lastError={lastError}
                  agentConnected={agentConnected}
                  agentMeta={agentMeta}
                  stateTs={state?.ts}
                  sideswapStatus={scanStatus}
                  sideswapError={scanError}
                  sideswapLastUpdate={scanLastUpdate}
                  dealers={dealers}
                  sendCommand={sendCommand}
                />
              </div>
            </Col>
          </Row>
        ) : mainView === 'estrategia' ? (
          <Row className="g-3">
            <Col xs={12}>
              <div className="dealer-panel dealer-panel-scroll">
                <StrategyPanel
                  dealers={dealers}
                  selectedPid={selectedPid}
                  onSelectDealer={handleSelectPid}
                  sendCommand={sendCommand}
                  wsStatus={status}
                  agentConnected={agentConnected}
                />
              </div>
            </Col>
          </Row>
        ) : mainView === 'oportunidades' ? (
          <Row className="g-3">
            <Col xs={12}>
              <div className="dealer-panel dealer-panel-scroll">
                <MarketOpportunities
                  pairs={scanPairs}
                  books={scanBooks}
                  indPrices={scanIndPrices}
                  status={scanStatus}
                  error={scanError}
                  lastUpdate={scanLastUpdate}
                  dealers={dealers}
                  reconnect={reconnectScan}
                  onGoToOrder={() => {
                    setMainView('geral');
                    setMidTab('operacional');
                  }}
                  belowMarketThresholdPct={belowMarketThresholdPct}
                />
              </div>
            </Col>
          </Row>
        ) : (
        <>
        <div className="dealer-mobile-panel-nav d-lg-none" role="tablist" aria-label="Painéis do console">
          <button
            type="button"
            role="tab"
            aria-selected={mobilePanel === 'dealers'}
            className={`dealer-mobile-panel-btn${mobilePanel === 'dealers' ? ' active' : ''}`}
            onClick={() => setMobilePanel('dealers')}
          >
            <TbList /> Dealers
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePanel === 'center'}
            className={`dealer-mobile-panel-btn${mobilePanel === 'center' ? ' active' : ''}`}
            onClick={() => setMobilePanel('center')}
          >
            <TbLayoutDashboard /> Operacional
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePanel === 'commands'}
            className={`dealer-mobile-panel-btn${mobilePanel === 'commands' ? ' active' : ''}`}
            onClick={() => setMobilePanel('commands')}
          >
            <TbTerminal2 /> Comandos
          </button>
        </div>
        <Row className={`g-3 dealer-layout-row${dealersCollapsed ? ' dealer-layout-dealers-collapsed' : ''}`}>
          {(!isMobileLayout || mobilePanel === 'dealers') && (
          <Col xs={12} lg={colDealers} className="dealer-mobile-panel-col dealer-layout-dealers-col">
            {dealersCollapsed ? (
              <DealerRailCollapsed
                dealers={dealers}
                selectedPid={selectedPid}
                onSelectPid={handleRailSelectPid}
                onExpand={() => setDealersExpanded(true)}
                managerOffline={!agentConnected}
              />
            ) : (
            <div className="dealer-panel dealer-panel-scroll">
              <div className="dealer-list-header">
                <h3>Dealers — {dealersSummaryLabel(dealers)}</h3>
                <div className="dealer-list-header-actions">
                  {selectedPid && dealers.length > 1 && (
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="dealer-deselect-btn"
                      onClick={() => handleSelectPid(null)}
                      title="Ver resumo de todas as carteiras"
                    >
                      Visão geral
                    </Button>
                  )}
                  {selectedPid && !isMobileLayout && (
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="dealer-collapse-dealers-btn"
                      onClick={() => setDealersExpanded(false)}
                      title="Recolher dealers"
                      aria-label="Recolher lista de dealers"
                    >
                      <TbChevronLeft />
                    </Button>
                  )}
                </div>
              </div>
              {dealers.length === 0 ? (
                <p className="dealer-empty">Nenhum dealer ativo. Use Run para iniciar.</p>
              ) : (
                dealers.map((d) => (
                  <DealerCard
                    key={d.pid}
                    dealer={d}
                    selected={selectedPid === d.pid}
                    onSelect={handleSelectPid}
                    managerOffline={!agentConnected}
                  />
                ))
              )}
            </div>
            )}
          </Col>
          )}
          {(!isMobileLayout || mobilePanel === 'center') && (
          <Col xs={12} lg={colCenter} className="dealer-mobile-panel-col dealer-layout-center-col">
            <div className="dealer-panel dealer-panel-scroll dealer-panel-middle">
              {selectedDealer && (
                <DealerBalancesBar
                  dealer={selectedDealer}
                  managerOffline={!agentConnected}
                />
              )}
              <div className="dealer-mid-tabs">
                <button
                  className={`dealer-mid-tab${midTab === 'operacional' ? ' active' : ''}`}
                  onClick={() => setMidTab('operacional')}
                >
                  Operacional
                </button>
                <button
                  className={`dealer-mid-tab${midTab === 'rendimentos' ? ' active' : ''}`}
                  onClick={() => setMidTab('rendimentos')}
                >
                  Rendimentos
                </button>
              </div>

              {midTab === 'operacional' ? (
                <>
                  <div className="dealer-op-tabs" role="tablist" aria-label="Operacional">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={operacionalTab === 'saldos'}
                      className={`dealer-op-tab${operacionalTab === 'saldos' ? ' active' : ''}`}
                      onClick={() => setOperacionalTab('saldos')}
                    >
                      Saldos
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={operacionalTab === 'ordens'}
                      className={`dealer-op-tab${operacionalTab === 'ordens' ? ' active' : ''}`}
                      onClick={() => setOperacionalTab('ordens')}
                    >
                      Ordens
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={operacionalTab === 'livro'}
                      className={`dealer-op-tab${operacionalTab === 'livro' ? ' active' : ''}`}
                      onClick={() => setOperacionalTab('livro')}
                      title="Livro SideSwap (público)"
                    >
                      Livro SideSwap
                    </button>
                  </div>

                  <div className="dealer-op-tab-panel">
                    {operacionalTab === 'saldos' && (
                      <AssetsPanel
                        dealer={selectedDealer}
                        dealers={dealers}
                        onRefresh={refreshAssets}
                        refreshing={refreshingAssets}
                        lastRefresh={lastAssetRefresh}
                        conversionPairs={bookPairs}
                        conversionPrices={bookIndPrices}
                        conversionStatus={bookStatus}
                        conversionLastUpdate={bookLastUpdate}
                      />
                    )}
                    {operacionalTab === 'ordens' && (
                      <OrdersPanel
                        dealer={selectedDealer}
                        managerOffline={!agentConnected}
                        confirmedOrderIds={confirmedOrderIds}
                      />
                    )}
                    {operacionalTab === 'livro' && (
                      <OrderPlacementPanel
                        dealer={selectedDealer}
                        combinations={marketData.combinations}
                        ownOrders={selectedDealerSentOrders}
                        status={bookStatus}
                        error={bookError}
                        lastUpdate={bookLastUpdate}
                        pairs={bookPairs}
                        books={bookData}
                        indPrices={bookIndPrices}
                        placements={bookPlacements}
                        reconnect={reconnectBook}
                      />
                    )}
                  </div>
                </>
              ) : (
                <TransactionsPanel
                  dealer={selectedDealer}
                  dealers={dealers}
                  sendCommand={sendCommand}
                  wsStatus={status}
                  syncOnSelect={consolePrefs.transactionsSyncOnSelect}
                  wsEvents={events}
                  txSummarySig={txSummarySig}
                />
              )}
            </div>
          </Col>
          )}
          {(!isMobileLayout || mobilePanel === 'commands') && (
          <Col xs={12} lg={colCommands} className="dealer-mobile-panel-col dealer-layout-commands-col">
            <div className="dealer-panel dealer-panel-commands">
              <h3>Comandos {selectedPid ? `(PID ${selectedPid})` : ''}</h3>
              {selectedDealer && (
                <DealerBalancesBar
                  dealer={selectedDealer}
                  managerOffline={!agentConnected}
                  compact
                  className="dealer-balances-bar-commands"
                />
              )}
              {!agentConnected && status === 'connected' && (
                <div className="dealer-cmd-offline" role="alert">
                  Manager offline — comandos podem falhar até o manager_dealer reconectar ao relay.
                </div>
              )}
              <CommandPanel
                selectedPid={selectedPid}
                onSelectPid={handleSelectPid}
                activeDealers={dealers}
                onDealerStarted={handleDealerStarted}
                onDealerStopped={handleDealerStopped}
                savedOrders={savedOrders}
                onBumpOrderRegistry={bumpOrderRegistry}
                agentConnected={agentConnected}
                wsStatus={status}
                marketData={marketData}
                sendCommand={sendCommand}
                busy={busy}
                setBusy={setBusy}
                setFeedback={setFeedback}
                defaultHistoryDestination={consolePrefs.defaultHistoryDestination}
                bookPlacements={bookPlacements}
                marketBooks={scanBooks}
                marketIndPrices={scanIndPrices}
                marketBookStatus={scanStatus}
                marketBookError={scanError}
                onReconnectMarketBook={reconnectScan}
              />
              {feedback && (
                <pre className={`dealer-feedback ${feedback.ok ? 'ok' : 'err'}`}>
                  {feedback.data?.summary || JSON.stringify(feedback, null, 2)}
                </pre>
              )}
            </div>
          </Col>
          )}
        </Row>
        </>
        )}
      </Container>
      </div>

      <MessagesModal
        show={showMessages}
        onHide={() => setShowMessages(false)}
        stateMessages={stateMessages}
        wsMessages={messages}
      />
    </div>
  );
}
