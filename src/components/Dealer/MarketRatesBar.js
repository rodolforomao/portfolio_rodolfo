import React, { useMemo } from 'react';
import { buildMarketRates, SIDESWAP_RATE_SOURCE } from './utils/marketRates';

function RateChip({ rate }) {
  if (!rate) return null;
  const title = [
    rate.label,
    rate.formatted,
    `Par: ${rate.pair}`,
    rate.unit,
    `Fonte: ${rate.source}`,
    rate.brlNote,
  ].filter(Boolean).join('\n');

  return (
    <span className="dealer-rate-chip" title={title}>
      <span className="dealer-rate-chip-pair">{rate.shortLabel}</span>
      <span className="dealer-rate-chip-val">{rate.formatted}</span>
    </span>
  );
}

export default function MarketRatesBar({
  indPrices = {},
  pairs = [],
  status = 'idle',
  lastUpdate = null,
}) {
  const { rates } = useMemo(
    () => buildMarketRates(indPrices, pairs),
    [indPrices, pairs],
  );

  const updatedAt = lastUpdate
    ? lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const statusLabel = status === 'connected'
    ? 'ao vivo'
    : status === 'connecting' || status === 'reconnecting'
      ? 'conectando…'
      : status === 'error'
        ? 'erro'
        : 'aguardando';

  if (rates.length === 0 && status !== 'connecting' && status !== 'reconnecting') {
    return (
      <div className="dealer-rates-header" role="region" aria-label="Cotações de referência">
        <span className="dealer-rates-header-meta">Cotações SideSwap…</span>
      </div>
    );
  }

  return (
    <div className="dealer-rates-header" role="region" aria-label="Cotações de referência">
      <div className="dealer-rates-header-chips">
        {rates.map((rate) => (
          <RateChip key={rate.id} rate={rate} />
        ))}
      </div>
      <div
        className="dealer-rates-header-meta"
        title="Preço indicativo (ind_price) do livro público SideSwap. BRL via DePix ≈ Real."
      >
        {SIDESWAP_RATE_SOURCE}
        {updatedAt && <> · {updatedAt}</>}
        {' · '}
        <span className={`dealer-rates-header-status dealer-rates-header-status-${status}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
