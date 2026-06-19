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
import {
  TbPlayerPlay, TbList, TbPlayerStop, TbSend, TbX,
  TbArrowsExchange, TbRefresh, TbHistory, TbMessage,
  TbBug, TbLogout, TbWallet, TbBook, TbHeartbeat, TbCoins, TbLock,
} from 'react-icons/tb';
import useDealerWs from './useDealerWs';
import { loadSession, clearSession, resolveWsUrl } from './config';
import AssetsPanel from './AssetsPanel';
import OrdersPanel from './OrdersPanel';
import OrderPlacementPanel from './OrderPlacementPanel';
import TransactionsPanel from './TransactionsPanel';
import OrderMarginBadge from './OrderMarginBadge';
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
import VaultSetup from './VaultSetup';
import './Dealer.css';

function StatusDot({ ok, label }) {
  return (
    <span className={`dealer-status ${ok ? 'ok' : 'off'}`}>
      <span className="dealer-status-dot" />
      {label}
    </span>
  );
}

function DealerCard({ dealer, onSelect, selected }) {
  const assets = normalizeBalances(dealer.balances);
  const { orders: displayOrders } = prepareDealerOrders(dealer.orders || []);
  const isInactive = !dealer.isLive;
  return (
    <div
      className={`dealer-card ${selected ? 'selected' : ''} dealer-card-${dealer.dealerStatus || 'morto'}`}
      onClick={() => onSelect(dealer.pid)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(dealer.pid)}
    >
      <div className="dealer-card-head">
        <strong>PID {dealer.pid}</strong>
        <span>{dealer.wallet_name}</span>
        <DealerStatusBadge dealer={dealer} />
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
              className={`dealer-order-chip ${o.order_id ? 'sent' : 'pending'}`}
            >
              <div className="dealer-order-chip-main">
                <span>
                  {cleanPairName(o.base, o.quote)} {o.trade_dir}
                  {!o.order_id && <Badge bg="secondary" className="ms-1">pendente</Badge>}
                </span>
                <span className="dealer-order-chip-price">@ {o.price ?? o.price_porc ?? '—'}</span>
              </div>
              <div className="dealer-order-chip-meta">
                {o.order_id && <code className="dealer-order-chip-id">{o.order_id}</code>}
                <OrderMarginBadge order={o} showPm explicit />
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
}) {
  const [mnemonicIndex, setMnemonicIndex] = useState('1');
  const [walletName, setWalletName] = useState('');
  const [wallets, setWallets] = useState([]);

  const [base, setBase] = useState('L-BTC');
  const [quote, setQuote] = useState('USDt');
  const [tradeDir, setTradeDir] = useState('Buy');
  const [price, setPrice] = useState('');
  const [pricePorc, setPricePorc] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [amount, setAmount] = useState('999999');
  const [orderId, setOrderId] = useState('');
  const [cancelPick, setCancelPick] = useState(null);
  const [spreadPick, setSpreadPick] = useState(null);
  const [orderPick, setOrderPick] = useState(null);
  const [lossSendConfirm, setLossSendConfirm] = useState({ signature: null, step: 0 });
  const [direction, setDirection] = useState('Buy');
  const [histDest, setHistDest] = useState('api');

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
  };

  const isSpreadItemSelected = (item) => (
    spreadPick?.pid === item.pid && spreadPick?.orderId === item.order.order_id
  );

  const handleChangeSpread = async () => {
    const pid = spreadTargetPid;
    if (!pid || !spreadPick) return;
    await run('change_spread', {
      pid,
      base,
      quote,
      trade_dir: tradeDir,
      ...priceParams(),
    });
  };

  const orderHistoryChoices = useMemo(() => {
    const list = savedOrders || [];
    const filtered = selectedPid ? list.filter((e) => e.pid === selectedPid) : list;
    return [...filtered];
  }, [savedOrders, selectedPid]);

  const orderTargetPid = selectedPid || orderPick?.pid || null;

  const sendFormSignature = useMemo(() => buildLossSendSignature({
    pid: orderTargetPid,
    base,
    quote,
    trade_dir: tradeDir,
    ...buildPriceParams({ price, pricePorc, priceMin }),
    amount: parseInt(String(amount).replace(/\D/g, ''), 10) || 999999,
  }), [orderTargetPid, base, quote, tradeDir, price, pricePorc, priceMin, amount]);

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
    const priceFields = buildPriceParams({ price, pricePorc, priceMin });
    if (!priceFields.price && priceFields.price_porc == null && priceFields.price_min == null) {
      setFeedback({
        ok: false,
        data: { error: 'Preencha preço fixo, spread (%) ou spread mín. (pm %).' },
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

  const loadWallets = async () => {
    const r = await run('get_wallets', {});
    if (r?.ok && r.data?.wallets) {
      setWallets(r.data.wallets);
      if (r.data.wallets.length && !walletName) {
        setWalletName(r.data.wallets[0].name);
        setMnemonicIndex(String(r.data.wallets[0].index));
      }
    }
  };

  const priceParams = () => buildPriceParams({ price, pricePorc, priceMin });

  return (
    <Tabs defaultActiveKey="run" className="dealer-tabs">
      <Tab eventKey="run" title={<><TbPlayerPlay /> Run</>}>
        <div className="dealer-form-block">
          <Button size="sm" variant="outline-secondary" onClick={loadWallets} disabled={busy}>
            Carregar wallets
          </Button>
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
                <option key={w.index} value={w.name}>{w.index}: {w.name}</option>
              ))}
            </Form.Select>
          )}
          <Row className="g-2 mt-1">
            <Col xs={4}>
              <Form.Control
                size="sm" placeholder="mnemonic_index"
                value={mnemonicIndex} onChange={(e) => setMnemonicIndex(e.target.value)}
              />
            </Col>
            <Col xs={8}>
              <Form.Control
                size="sm" placeholder="wallet_name"
                value={walletName} onChange={(e) => setWalletName(e.target.value)}
              />
            </Col>
          </Row>
          <Button
            className="dealer-btn-primary mt-2"
            disabled={busy}
            onClick={handleStartDealer}
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
            {orderHistoryChoices.map((entry) => (
              <button
                key={entry.registryId}
                type="button"
                className={`dealer-cancel-item ${isOrderHistorySelected(entry) ? 'selected' : ''}`}
                onClick={() => selectSavedOrder(entry)}
                disabled={busy}
              >
                <span className="dealer-cancel-dealer">
                  PID {entry.pid} · {entry.wallet_name || '—'}
                  {entry.isLive
                    ? <Badge bg="success" className="ms-1 dealer-order-live-badge">ativa</Badge>
                    : <Badge bg="secondary" className="ms-1 dealer-order-live-badge">histórico</Badge>}
                </span>
                <span className="dealer-cancel-pair">
                  {entry.base}/{entry.quote} {entry.trade_dir}
                </span>
                <span className="dealer-cancel-price">
                  {entry.spreadSummary || formatOrderSpreadSummary(registryEntryToOrder(entry))}
                  {entry.amount != null && entry.amount !== 999999 && ` · amt ${entry.amount}`}
                </span>
                <span className="dealer-order-history-margin">
                  <OrderMarginBadge order={registryEntryToOrder(entry)} explicit />
                </span>
                {entry.order_id && (
                  <code className="dealer-cancel-id">{entry.order_id}</code>
                )}
              </button>
            ))}
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
            amount={amount}
            onPriceChange={setPrice}
            onPricePorcChange={setPricePorc}
            onPriceMinChange={setPriceMin}
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
                  @ {item.order.price ?? item.order.price_porc ?? '—'}
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
              showAmount={false}
              onPriceChange={setPrice}
              onPricePorcChange={setPricePorc}
              onPriceMinChange={setPriceMin}
              onAmountChange={setAmount}
            />
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

      <Tab eventKey="vault" title={<><TbLock /> Vault</>}>
        <VaultSetup />
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

  const bumpOrderRegistry = useCallback(() => setOrderRegistryTick((n) => n + 1), []);

  useEffect(() => {
    if (!session?.authenticated) {
      navigate('/dealer', { replace: true });
    }
  }, [session, navigate]);

  const {
    status, agentConnected, state, messages, sendCommand, disconnect, lastError,
  } = useDealerWs(session?.wsUrl, session?.token, !!session?.authenticated);

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

  const refreshAssets = React.useCallback(async () => {
    if (status !== 'connected') return;
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
      }
      if (listResult?.ok && listResult.data?.dealers) {
        setFetchedDealers(listResult.data.dealers);
        setLastAssetRefresh(new Date().toLocaleTimeString('pt-BR'));
      }
    } catch {
      // silencioso — state_update continua em background
    } finally {
      setRefreshingAssets(false);
    }
  }, [status, sendCommand]);

  useEffect(() => {
    if (status !== 'connected') return undefined;
    refreshAssets();
    const interval = setInterval(refreshAssets, 15000);
    return () => clearInterval(interval);
  }, [status, refreshAssets]);

  useEffect(() => {
    touchRegistryFromDealers(dealers);
  }, [dealers]);

  useEffect(() => {
    if (selectedPid && !dealers.some((d) => d.pid === selectedPid)) {
      setSelectedPid(dealers.length ? dealers[0].pid : null);
    } else if (!selectedPid && dealers.length === 1) {
      setSelectedPid(dealers[0].pid);
    }
  }, [dealers, selectedPid]);

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
  const hasStatusBanner = showWsError || showAgentOffline;

  return (
    <div className={`dealer-root${hasStatusBanner ? ' dealer-root-alert' : ''}`}>
      <div className="dealer-topbar">
        <Container fluid>
          <div className="dealer-topbar-inner">
            <div className="dealer-topbar-left">
              <h2>Dealer Console</h2>
              <StatusDot ok={status === 'connected'} label={status} />
              <StatusDot ok={agentConnected} label={agentConnected ? 'agente online' : 'agente offline'} />
              {state?.ts && <Badge bg="secondary" className="dealer-ts">{state.ts}</Badge>}
            </div>
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
        </Container>
      </div>

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
            <strong>Agente offline.</strong>{' '}
            Relay conectado, mas o manager_dealer ainda não está online no relay.
            {dealers.length > 0 && (
              <> Os dealers exibidos podem ser <strong>cache antigo</strong>.</>
            )}
            <div className="dealer-status-banner-hint">
              Verifique se o backend está rodando com{' '}
              <code>bash run-pc.sh run</code> (ou equivalente), com{' '}
              <code>WS_RELAY_URL=ws://127.0.0.1:8765</code> e{' '}
              <code>WS_BRIDGE_TOKEN</code> iguais ao <code>.env</code> do site.
            </div>
          </Container>
        </div>
      )}

      <Container fluid className="dealer-main">
        <Row className="g-3">
          <Col xs={12} lg={4}>
            <div className="dealer-panel dealer-panel-scroll">
              <h3>Dealers — {dealersSummaryLabel(dealers)}</h3>
              {dealers.length === 0 ? (
                <p className="dealer-empty">Nenhum dealer ativo. Use Run para iniciar.</p>
              ) : (
                dealers.map((d) => (
                  <DealerCard
                    key={d.pid}
                    dealer={d}
                    selected={selectedPid === d.pid}
                    onSelect={setSelectedPid}
                  />
                ))
              )}
            </div>
          </Col>

          <Col xs={12} lg={4}>
            <div className="dealer-panel dealer-panel-scroll dealer-panel-middle">
              <AssetsPanel
                dealer={selectedDealer}
                onRefresh={refreshAssets}
                refreshing={refreshingAssets}
                lastRefresh={lastAssetRefresh}
              />
              <OrdersPanel dealer={selectedDealer} />
              <TransactionsPanel
                dealer={selectedDealer}
                sendCommand={sendCommand}
                wsStatus={status}
              />
              <OrderPlacementPanel
                dealer={selectedDealer}
                assets={marketData.assets}
                combinations={marketData.combinations}
              />
            </div>
          </Col>

          <Col xs={12} lg={4}>
            <div className="dealer-panel dealer-panel-commands">
              <h3>Comandos {selectedPid ? `(PID ${selectedPid})` : ''}</h3>
              {!agentConnected && status === 'connected' && (
                <div className="dealer-cmd-offline" role="alert">
                  Agente offline — comandos podem falhar até o manager_dealer reconectar ao relay.
                </div>
              )}
              <CommandPanel
                selectedPid={selectedPid}
                onSelectPid={setSelectedPid}
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
              />
              {feedback && (
                <pre className={`dealer-feedback ${feedback.ok ? 'ok' : 'err'}`}>
                  {feedback.data?.summary || JSON.stringify(feedback, null, 2)}
                </pre>
              )}
            </div>
          </Col>
        </Row>
      </Container>

      <MessagesModal
        show={showMessages}
        onHide={() => setShowMessages(false)}
        stateMessages={stateMessages}
        wsMessages={messages}
      />
    </div>
  );
}
