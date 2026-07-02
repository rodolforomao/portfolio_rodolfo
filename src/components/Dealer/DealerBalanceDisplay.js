import React from 'react';
import {
  formatAssetBalance,
  getAssetReserve,
  computeAvailableBalance,
  hasReserveConfigured,
  normalizeReserveBalance,
} from './utils/dealerFormat';

export function assetChipClass(asset) {
  const a = String(asset || '').toLowerCase();
  if (a.includes('btc')) return 'btc';
  if (a.includes('usd') || a.includes('depix')) return 'stable';
  return 'other';
}

function resolveReserve(reserveBalance, asset, reserve) {
  if (reserve != null && reserve > 0) return reserve;
  return getAssetReserve(reserveBalance, asset);
}

export function DealerBalanceChip({
  asset,
  value,
  reserveBalance,
  reserve,
  className = '',
  chipClass = '',
  compact = false,
}) {
  const reserveAmt = resolveReserve(reserveBalance, asset, reserve);
  const hasReserve = reserveAmt > 0;
  const available = computeAvailableBalance(value, reserveAmt);
  const typeClass = chipClass || `dealer-balance-chip-${assetChipClass(asset)}`;

  return (
    <span
      className={[
        'dealer-balance-chip',
        typeClass,
        hasReserve ? 'dealer-balance-chip-has-reserve' : '',
        compact ? 'dealer-balance-chip-compact' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <span className="dealer-balance-chip-main">
        <span className="dealer-balance-chip-asset">{asset}</span>
        <strong>{formatAssetBalance(asset, value)}</strong>
      </span>
      {hasReserve && (
        <span className="dealer-balance-chip-reserve">
          reserva {formatAssetBalance(asset, reserveAmt)}
          {' · '}
          livre {formatAssetBalance(asset, available)}
        </span>
      )}
    </span>
  );
}

export function BalanceSaldoCell({
  asset,
  value,
  reserveBalance,
  reserve,
}) {
  const reserveAmt = resolveReserve(reserveBalance, asset, reserve);
  const hasReserve = reserveAmt > 0;
  const available = computeAvailableBalance(value, reserveAmt);

  return (
    <div className="dealer-balance-saldo">
      <div className="dealer-balance-saldo-total">{formatAssetBalance(asset, value)}</div>
      {hasReserve && (
        <div className="dealer-balance-saldo-reserve">
          reserva {formatAssetBalance(asset, reserveAmt)}
          {' · '}
          livre {formatAssetBalance(asset, available)}
        </div>
      )}
    </div>
  );
}

export function DealerReserveSummary({ reserveBalance, className = '', prefix = 'Reserva' }) {
  const rows = normalizeReserveBalance(reserveBalance);
  if (!rows.length) return null;

  return (
    <div className={`dealer-reserve-summary${className ? ` ${className}` : ''}`}>
      {prefix ? <span className="dealer-reserve-summary-label">{prefix}</span> : null}
      {rows.map(({ asset, value }) => (
        <span key={asset} className="dealer-reserve-summary-item">
          {formatAssetBalance(asset, value)}
        </span>
      ))}
    </div>
  );
}

export function dealerHasReserve(dealer) {
  return hasReserveConfigured(dealer?.reserve_balance);
}
