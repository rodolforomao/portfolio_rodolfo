import React, { useState, useMemo } from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Badge from 'react-bootstrap/Badge';
import {
  TbPlayerPlay, TbX, TbTarget, TbCheck, TbAlertTriangle,
  TbRocket, TbSettings, TbLock,
} from 'react-icons/tb';
import { parsePercentInput } from './PriceFields';
import { normalizeBalances, formatAssetBalance } from './utils/dealerFormat';
import { prepareDealerOrders } from './utils/orderMarketNormalize';
import DealerStatusBadge from './DealerStatusBadge';

const PHASES = [
  {
    id: 'fase0',
    label: 'Fase 0',
    subtitle: 'Piloto',
    capital: 'R$ 2–5k',
    priceMin: '0,50',
    objective: 'Calibrar, não lucrar. Coletar fills reais.',
    criteria: 'Avançar após 30 dias com P&L marcado a mercado positivo.',
    belowThreshold: '1,0–1,2%',
    color: '#8b949e',
  },
  {
    id: 'fase1',
    label: 'Fase 1',
    subtitle: 'Validada',
    capital: 'R$ 10k',
    priceMin: '0,40',
    objective: 'Escalar com dados reais. Adicionar below-market.',
    criteria: 'Avançar após 60 dias com drawdown mensal < 3%.',
    belowThreshold: '0,8–1,0%',
    color: '#c770f0',
  },
  {
    id: 'fase2',
    label: 'Fase 2',
    subtitle: 'Plena',
    capital: 'R$ 20k+',
    priceMin: '0,40',
    objective: 'Capital completo. Todos os motores ativos.',
    criteria: 'Multi-PID. Rebalanceamento via BTSE quando USDt > 65%.',
    belowThreshold: '0,8%',
    color: '#3fb950',
  },
];

function getDealerOrderState(dealer) {
  const { orders } = prepareDealerOrders(dealer?.orders || []);
  const lbtc = orders.filter((o) => o.base === 'L-BTC' && o.quote === 'USDt');
  const hasBuy = lbtc.some((o) => o.trade_dir === 'Buy');
  const hasSell = lbtc.some((o) => o.trade_dir === 'Sell');
  const motor1Orders = hasBuy && hasSell ? 'both' : hasBuy || hasSell ? 'partial' : 'none';

  const balances = normalizeBalances(dealer?.balances);
  const depix = balances.find((b) => b.asset === 'DePix')?.value || 0;
  const hasDepixExit = orders.some((o) => o.quote === 'DePix');

  return { motor1Orders, depix, hasDepixExit };
}

function MotorDot({ status, size = 8 }) {
  return (
    <span
      className={`strategy-motor-dot strategy-motor-dot-${status}`}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

function DealerStrategyChip({ dealer, selected, activatedHere, onClick }) {
  return (
    <button
      type="button"
      className={`strategy-dealer-card${selected ? ' selected' : ''}${activatedHere ? ' running' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div className="strategy-dealer-card-head">
        <div className="strategy-dealer-card-id">
          <span
            className="strategy-dealer-card-indicator"
            style={{ background: activatedHere ? '#3fb950' : '#6e7681' }}
            title={activatedHere ? 'Ativado nesta sessão' : 'Não ativado'}
          />
          <strong>PID {dealer.pid}</strong>
          <span className="strategy-dealer-card-wallet">{dealer.wallet_name || '—'}</span>
        </div>
        <DealerStatusBadge dealer={dealer} />
      </div>
      {activatedHere && (
        <div className="strategy-dealer-card-selected-label">ativado nesta sessão</div>
      )}
      {selected && !activatedHere && (
        <div className="strategy-dealer-card-selected-label" style={{ color: '#c770f0' }}>selecionado</div>
      )}
    </button>
  );
}

export default function StrategyPanel({
  dealers = [],
  selectedPid,
  onSelectDealer,
  sendCommand,
  wsStatus,
  agentConnected,
}) {
  const [phase, setPhase] = useState('fase0');
  const [customPriceMin, setCustomPriceMin] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  // PIDs que tiveram estratégia ativada nesta sessão
  const [activatedPids, setActivatedPids] = useState(new Set());

  const currentPhase = PHASES.find((p) => p.id === phase) || PHASES[0];
  const effectivePriceMin = customPriceMin.trim() || currentPhase.priceMin;

  const selectedDealer = dealers.find((d) => d.pid === selectedPid) || null;
  const isConnected = wsStatus === 'connected';
  const canOperate = isConnected && agentConnected && selectedPid != null;
  const dealerSelected = selectedPid != null;

  const { motor1Orders, depix: depixBalance, hasDepixExit } = useMemo(
    () => (selectedDealer ? getDealerOrderState(selectedDealer) : { motor1Orders: 'none', depix: 0, hasDepixExit: false }),
    [selectedDealer],
  );

  // motor1Status: baseado SOMENTE em ativação explícita nesta sessão
  const motor1Activated = selectedPid != null && activatedPids.has(selectedPid);
  const motor1Status = motor1Activated ? 'active' : 'inactive';

  // ordens pré-existentes detectadas mas não ativadas por este painel
  const motor1HasPreexisting = !motor1Activated && motor1Orders !== 'none';

  const motor3Status = depixBalance > 0 ? (hasDepixExit ? 'active' : 'warn') : 'none';

  const run = async (action, params) => {
    if (!isConnected) { setFeedback({ ok: false, msg: 'WebSocket desconectado.' }); return null; }
    setBusy(true);
    setFeedback(null);
    try {
      const result = await sendCommand(action, params);
      const ok = result?.ok !== false;
      setFeedback({ ok, msg: ok ? `${action} enviado com sucesso.` : (result?.data?.error || `Erro em ${action}`) });
      return result;
    } catch (err) {
      setFeedback({ ok: false, msg: err.message });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const activateMotor1 = async () => {
    const pm = parsePercentInput(effectivePriceMin);
    if (pm == null || pm <= 0) { setFeedback({ ok: false, msg: 'price_min inválido. Ex: 0,50 para 0,5%.' }); return; }
    const base = { pid: selectedPid, base: 'L-BTC', quote: 'USDt', amount: 999999, price_porc: pm, price_min: pm };
    const r = await run('send_order', { ...base, trade_dir: 'Buy' });
    if (r?.ok) {
      const r2 = await run('send_order', { ...base, trade_dir: 'Sell' });
      if (r2?.ok) {
        setActivatedPids((prev) => new Set([...prev, selectedPid]));
      }
    }
  };

  const cancelAllMotor1 = async () => {
    const r = await run('cancel_order', { pid: selectedPid, all: true });
    if (r?.ok) {
      setActivatedPids((prev) => { const next = new Set(prev); next.delete(selectedPid); return next; });
    }
  };

  const activateMotor3 = async (rota) => {
    const base = { pid: selectedPid, amount: 999999, price_min: 0 };
    if (rota === 'A') await run('send_order', { ...base, base: 'USDt', quote: 'DePix', trade_dir: 'Buy' });
    else await run('send_order', { ...base, base: 'L-BTC', quote: 'DePix', trade_dir: 'Buy' });
  };

  return (
    <div className="strategy-panel">
      {/* Header */}
      <div className="strategy-header">
        <TbRocket className="strategy-header-icon" />
        <div>
          <h3 className="strategy-header-title">Estratégia</h3>
          <p className="strategy-header-sub">
            Selecione o dealer e ative os motores. O status reflete o estado real das ordens enviadas.
          </p>
        </div>
      </div>

      {/* Phase selector */}
      <div className="strategy-phases">
        {PHASES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`strategy-phase-card${phase === p.id ? ' active' : ''}`}
            style={phase === p.id ? { borderColor: p.color } : {}}
            onClick={() => { setPhase(p.id); setCustomPriceMin(''); setFeedback(null); }}
          >
            <span className="strategy-phase-label" style={{ color: phase === p.id ? p.color : undefined }}>
              {p.label}
            </span>
            <span className="strategy-phase-sub">{p.subtitle}</span>
            <span className="strategy-phase-capital">{p.capital}</span>
          </button>
        ))}
      </div>

      <div className="strategy-phase-info">
        <div className="strategy-phase-info-row"><span>Objetivo</span><span>{currentPhase.objective}</span></div>
        <div className="strategy-phase-info-row"><span>Avançar quando</span><span>{currentPhase.criteria}</span></div>
      </div>

      {/* Dealer selection */}
      <div className="strategy-section">
        <div className="strategy-section-title">
          Dealer
          {!dealerSelected && <span className="strategy-section-title-hint"> — clique para selecionar</span>}
        </div>

        {dealers.length === 0 ? (
          <p className="dealer-empty mb-0">Nenhum dealer ativo. Inicie em <strong>Geral → Run</strong>.</p>
        ) : (
          <div className="strategy-dealer-grid">
            {dealers.map((d) => (
              <DealerStrategyChip
                key={d.pid}
                dealer={d}
                selected={selectedPid === d.pid}
                activatedHere={activatedPids.has(d.pid)}
                onClick={() => onSelectDealer(selectedPid === d.pid ? null : d.pid)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Banner: só aparece se há algo relevante para mostrar */}
      {dealerSelected && selectedDealer && (motor1Activated || motor1HasPreexisting || depixBalance > 0) && (
        <div className={`strategy-status-banner${motor1Activated ? ' banner-active' : motor1HasPreexisting ? ' banner-partial' : ' banner-inactive'}`}>
          <div className="strategy-status-banner-main">
            <MotorDot status={motor1Activated ? 'active' : motor1HasPreexisting ? 'warn' : 'off'} size={10} />
            <span className="strategy-status-banner-pid">PID {selectedDealer.pid} · {selectedDealer.wallet_name || '—'}</span>
            <span className="strategy-status-banner-state">
              {motor1Activated
                ? 'Motor 1 ativado nesta sessão (BUY + SELL)'
                : motor1HasPreexisting
                  ? 'Ordens L-BTC/USDt já existentes — não ativadas por aqui'
                  : 'Sem ordens ativas'}
            </span>
          </div>
          {depixBalance > 0 && (
            <div className="strategy-status-banner-sub">
              <MotorDot status="warn" size={8} />
              DePix no inventário: {formatAssetBalance('DePix', depixBalance)}
              {motor3Status !== 'active' && ' — ative Motor 3 para colocar ordens de saída'}
            </div>
          )}
        </div>
      )}

      {/* Motors — wrapped in lock overlay when no dealer selected */}
      <div className={`strategy-motors-wrap${!dealerSelected ? ' locked' : ''}`}>
        {!dealerSelected && (
          <div className="strategy-motors-lock">
            <TbLock size={20} />
            <span>Selecione um dealer acima para operar</span>
          </div>
        )}

        {/* Motor 1 */}
        <div className={`strategy-motor${motor1Activated ? ' motor-on' : ''}`}>
          <div className="strategy-motor-head">
            <div className="strategy-motor-title">
              <MotorDot status={motor1Activated ? 'active' : 'off'} />
              Motor 1 — L-BTC/USDt MM
            </div>
            <Badge bg={motor1Activated ? 'success' : 'secondary'}>
              {motor1Activated ? 'BUY + SELL ativo' : 'inativo'}
            </Badge>
          </div>
          <div className="strategy-motor-body">
            <p className="strategy-motor-desc">
              Ordens BUY + SELL simultâneas em L-BTC/USDt.
              Spread capturado a cada ciclo. Flash crash cancela automaticamente.
            </p>
            {motor1HasPreexisting && (
              <div className="strategy-motor-preexisting">
                <TbAlertTriangle size={13} />
                {' '}Ordens L-BTC/USDt existentes detectadas neste dealer
                (não ativadas por este painel).
              </div>
            )}
            <div className="strategy-motor-config">
              <label className="strategy-config-label">price_min %</label>
              <Form.Control
                size="sm"
                className="strategy-pm-input"
                value={customPriceMin || currentPhase.priceMin}
                onChange={(e) => setCustomPriceMin(e.target.value)}
                placeholder={currentPhase.priceMin}
                disabled={busy || !dealerSelected}
              />
              <span className="strategy-config-hint">padrão {currentPhase.label}: {currentPhase.priceMin}%</span>
            </div>
            <div className="strategy-motor-actions">
              <Button
                size="sm"
                className="dealer-btn-primary"
                disabled={busy || !canOperate}
                onClick={activateMotor1}
              >
                <TbPlayerPlay /> Ativar BUY + SELL
              </Button>
              {(motor1Activated || motor1HasPreexisting) && (
                <Button size="sm" variant="outline-danger" disabled={busy || !canOperate} onClick={cancelAllMotor1}>
                  <TbX /> Cancelar tudo
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Motor 2 */}
        <div className="strategy-motor">
          <div className="strategy-motor-head">
            <div className="strategy-motor-title">
              <MotorDot status="info" />
              Motor 2 — Below-market sniper
            </div>
            <Badge bg="info">via Telegram</Badge>
          </div>
          <div className="strategy-motor-body">
            <p className="strategy-motor-desc">
              Detecta ordens abaixo do ind_price e alerta via Telegram.
              Configure o threshold em <strong>Configurações → Telegram</strong>.
            </p>
            <div className="strategy-motor-hint">
              <TbSettings size={13} />
              {' '}Threshold recomendado ({currentPhase.label}): <strong>{currentPhase.belowThreshold}</strong>
            </div>
          </div>
        </div>

        {/* Motor 3 — só se houver DePix */}
        {(dealerSelected && depixBalance > 0) && (
          <div className={`strategy-motor${motor3Status === 'active' ? ' motor-on' : ' motor-warn'}`}>
            <div className="strategy-motor-head">
              <div className="strategy-motor-title">
                <MotorDot status={motor3Status === 'active' ? 'active' : 'warn'} />
                Motor 3 — Saída DePix
              </div>
              <Badge bg={motor3Status === 'active' ? 'success' : 'warning'} text={motor3Status !== 'active' ? 'dark' : undefined}>
                {formatAssetBalance('DePix', depixBalance)} DePix
              </Badge>
            </div>
            <div className="strategy-motor-body">
              <p className="strategy-motor-desc">
                DePix detectado no inventário. Ative ordens de saída ao ind_price (custo 0%).
                Compare Rota A vs B antes de enviar.
              </p>
              <div className="strategy-motor-actions">
                <Button size="sm" className="dealer-btn-primary" disabled={busy || !canOperate} onClick={() => activateMotor3('A')}>
                  <TbTarget /> Rota A — DePix → USDt
                </Button>
                <Button size="sm" variant="outline-secondary" disabled={busy || !canOperate} onClick={() => activateMotor3('B')}>
                  <TbTarget /> Rota B — DePix → L-BTC
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`strategy-feedback${feedback.ok ? ' strategy-feedback-ok' : ' strategy-feedback-err'}`}>
          {feedback.ok ? <TbCheck /> : <TbAlertTriangle />} {feedback.msg}
        </div>
      )}
    </div>
  );
}
