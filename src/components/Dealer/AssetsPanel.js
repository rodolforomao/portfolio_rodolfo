import React from 'react';
import Button from 'react-bootstrap/Button';
import { TbRefresh, TbCoins } from 'react-icons/tb';
import { formatAssetBalance, normalizeBalances } from './utils/dealerFormat';

function assetClass(asset) {
  const a = asset.toLowerCase();
  if (a.includes('btc')) return 'btc';
  if (a.includes('usd') || a.includes('depix')) return 'stable';
  return 'other';
}

export default function AssetsPanel({
  dealer,
  onRefresh,
  refreshing,
  lastRefresh,
}) {
  const balances = normalizeBalances(dealer?.balances);

  return (
    <div className="dealer-assets-panel">
      <div className="dealer-assets-header">
        <h3>
          <TbCoins /> Saldos
          {dealer && (
            <span className="dealer-assets-sub">
              PID {dealer.pid} · {dealer.wallet_name}
            </span>
          )}
        </h3>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={onRefresh}
          disabled={refreshing || !dealer}
          className="dealer-assets-refresh"
        >
          <TbRefresh className={refreshing ? 'dealer-spin' : ''} />
          {refreshing ? '…' : ''}
        </Button>
      </div>

      {!dealer ? (
        <p className="dealer-empty">Clique em um dealer à esquerda para ver os saldos deste PID.</p>
      ) : balances.length === 0 ? (
        <div className="dealer-assets-empty">
          <p className="dealer-empty">Este PID ainda não reportou saldos.</p>
          <p className="dealer-hint">Aguarde o sync ou clique em Atualizar.</p>
        </div>
      ) : (
        <table className="dealer-assets-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {balances.map(({ asset, value }) => (
              <tr key={asset}>
                <td>
                  <span className={`dealer-asset-badge ${assetClass(asset)}`}>{asset}</span>
                </td>
                <td className="dealer-asset-value">{formatAssetBalance(asset, value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dealer && lastRefresh && (
        <p className="dealer-assets-ts">Atualizado: {lastRefresh}</p>
      )}
    </div>
  );
}
