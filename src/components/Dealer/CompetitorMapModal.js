import React from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TbChartLine, TbX, TbAlertTriangle } from 'react-icons/tb';
import { formatBookPrice } from './utils/sideswapBook';

const EVENT_LABELS = {
  approach: 'aproximação',
  reaction_drop: 'concorrente cedeu',
  reaction_hold: 'concorrente segurou',
  competitor_lost: 'concorrente saiu',
  overtaken: 'fomos ultrapassados',
};

const CONFIDENCE_LABELS = { alta: 'alta', media: 'média', baixa: 'baixa' };

function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR');
}

function StatusBanner({ status, order }) {
  if (status === 'we_lead') {
    return (
      <p className="dealer-competitor-banner dealer-competitor-banner-neutral">
        Estamos em 1º lugar — sem concorrente à frente no momento.
      </p>
    );
  }
  if (status === 'no_competitor') {
    return (
      <p className="dealer-competitor-banner dealer-competitor-banner-neutral">
        Nenhum concorrente identificado neste lado do book
        {order?.order_id ? ' (ou nossa ordem não está publicada no momento)' : ''}.
      </p>
    );
  }
  return null;
}

function FloorBadge({ inferredFloor, confidence }) {
  if (inferredFloor == null) {
    return (
      <span className="dealer-competitor-floor-badge dealer-competitor-confidence-baixa">
        Ainda sem dados suficientes para inferir o piso
      </span>
    );
  }
  return (
    <span className={`dealer-competitor-floor-badge dealer-competitor-confidence-${confidence}`}>
      Piso provável: {formatBookPrice(inferredFloor)} · confiança: {CONFIDENCE_LABELS[confidence] || confidence}
    </span>
  );
}

function EventsTable({ events }) {
  if (!events?.length) {
    return <p className="dealer-empty">Nenhum evento registrado ainda.</p>;
  }
  const rows = [...events].reverse().slice(0, 50);
  return (
    <div className="dealer-competitor-events">
      <div className="dealer-competitor-events-head">
        <span>Hora</span>
        <span>Evento</span>
        <span>Nosso preço</span>
        <span>Preço dele</span>
        <span>Δ</span>
      </div>
      {rows.map((e, idx) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={`${e.ts}-${idx}`} className={`dealer-competitor-events-row dealer-competitor-event-${e.type}`}>
          <span>{timeLabel(e.ts)}</span>
          <span>{EVENT_LABELS[e.type] || e.type}</span>
          <span>{formatBookPrice(e.ourPrice)}</span>
          <span>{formatBookPrice(e.competitorPrice)}</span>
          <span>{e.deltaPct != null ? `${e.deltaPct.toFixed(3)}%` : '—'}</span>
        </div>
      ))}
    </div>
  );
}

export default function CompetitorMapModal({
  show,
  onHide,
  order,
  tradeDir,
  baseAsset,
  quoteAsset,
  competitorMap,
}) {
  const { series = [], events = [], inferredFloor = null, confidence = 'baixa', status = 'no_competitor', competitorOrderId = null } = competitorMap || {};

  const chartData = series.map((p) => ({ ts: p.ts, nossa: p.ourPrice, concorrente: p.competitorPrice }));

  return (
    <Modal
      show={show}
      onHide={onHide}
      fullscreen="sm-down"
      size="lg"
      centered
      className="dealer-competitor-modal"
      scrollable
    >
      <Modal.Header closeButton closeVariant="white" className="dealer-modal-header">
        <Modal.Title>
          <TbChartLine /> Mapeamento de concorrente — {tradeDir} {baseAsset}/{quoteAsset}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="dealer-modal-body">
        <p className="dealer-competitor-subtitle">
          Nossa ordem <code>{order?.order_id ?? '—'}</code> @ {formatBookPrice(order?.price)}
          {competitorOrderId && (
            <> · concorrente rastreado: <code>{competitorOrderId}</code></>
          )}
        </p>

        <StatusBanner status={status} order={order} />

        {status !== 'no_competitor' && (
          <div className="dealer-competitor-floor-row">
            <FloorBadge inferredFloor={inferredFloor} confidence={confidence} />
          </div>
        )}

        {chartData.length > 1 ? (
          <div className="dealer-competitor-chart">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis
                  dataKey="ts"
                  tickFormatter={timeLabel}
                  tick={{ fontSize: 10, fill: '#8b949e' }}
                  stroke="#8b949e"
                />
                <YAxis
                  tickFormatter={formatBookPrice}
                  tick={{ fontSize: 10, fill: '#8b949e' }}
                  stroke="#8b949e"
                  width={90}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{ background: '#0d1421', border: '1px solid #1a2744', fontSize: 12 }}
                  labelFormatter={(ts) => new Date(ts).toLocaleString('pt-BR')}
                  formatter={(value) => formatBookPrice(value)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="nossa" name="Nossa ordem" stroke="#388bfd" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="concorrente" name="Concorrente" stroke="#bb8009" strokeWidth={2} dot={false} connectNulls />
                {inferredFloor != null && (
                  <ReferenceLine
                    y={inferredFloor}
                    stroke="#8b949e"
                    strokeDasharray="4 4"
                    label={{ value: 'piso provável', fill: '#8b949e', fontSize: 10, position: 'insideTopLeft' }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="dealer-empty">
            <TbAlertTriangle /> Ainda não há dados suficientes para desenhar o gráfico — deixe a modal aberta
            observando o par por alguns minutos.
          </p>
        )}

        <EventsTable events={events} />
      </Modal.Body>
      <Modal.Footer className="dealer-modal-footer">
        <span className="dealer-competitor-footnote">
          Apenas leitura — nenhuma ação de precificação é tomada automaticamente aqui.
        </span>
        <Button variant="outline-secondary" size="sm" onClick={onHide}>
          <TbX /> Fechar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
