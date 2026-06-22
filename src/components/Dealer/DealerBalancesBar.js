import React from 'react';
import DealerStatusBadge from './DealerStatusBadge';
import { formatAssetBalance, normalizeBalances } from './utils/dealerFormat';
import { getWalletColor, walletColorStyle } from './utils/walletColors';

function assetChipClass(asset) {
  const a = String(asset || '').toLowerCase();
  if (a.includes('btc')) return 'btc';
  if (a.includes('usd') || a.includes('depix')) return 'stable';
  return 'other';
}

function balancePendingLabel(dealer) {
  if (dealer.dealerStatus === 'morto') return 'Saldos indisponíveis (dealer morto)';
  if (dealer.dealerStatus === 'zombie') return 'Sem sync ao vivo — aguardando dados do backend';
  return 'Aguardando sync de saldos…';
}

export default function DealerBalancesBar({
  dealer,
  managerOffline = false,
  compact = false,
  className = '',
}) {
  if (!dealer) return null;

  const wallet = dealer.wallet_name || '—';
  const walletColor = getWalletColor(wallet);
  const balances = normalizeBalances(dealer.balances);

  return (
    <div
      className={`dealer-balances-bar${compact ? ' dealer-balances-bar-compact' : ''}${className ? ` ${className}` : ''}`}
      style={walletColorStyle(wallet)}
      role="region"
      aria-label={`Saldos do PID ${dealer.pid}`}
    >
      <div className="dealer-balances-bar-head">
        <div className="dealer-balances-bar-identity">
          <strong className="dealer-balances-bar-pid">PID {dealer.pid}</strong>
          <span
            className="dealer-wallet-badge dealer-balances-bar-wallet"
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
        {!compact && (
          <span className="dealer-balances-bar-label">Saldos deste dealer</span>
        )}
      </div>

      <div className="dealer-balances-bar-assets">
        {balances.length > 0 ? (
          balances.map(({ asset, value }) => (
            <span
              key={asset}
              className={`dealer-balance-chip dealer-balance-chip-${assetChipClass(asset)}`}
            >
              <span className="dealer-balance-chip-asset">{asset}</span>
              <strong>{formatAssetBalance(asset, value)}</strong>
            </span>
          ))
        ) : (
          <span className="dealer-balance-pending">{balancePendingLabel(dealer)}</span>
        )}
      </div>
    </div>
  );
}
