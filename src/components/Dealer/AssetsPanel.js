import React, { useMemo } from 'react';
import Button from 'react-bootstrap/Button';
import { TbRefresh, TbCoins } from 'react-icons/tb';
import { formatAssetBalance, normalizeBalances } from './utils/dealerFormat';

const SATS_PER_LBTC = 1e8;

function assetClass(asset) {
  const a = asset.toLowerCase();
  if (a.includes('btc')) return 'btc';
  if (a.includes('usd') || a.includes('depix')) return 'stable';
  return 'other';
}

function buildConversionMap(indPrices, pairs) {
  const map = {};
  for (const pair of (pairs || [])) {
    const pd = (indPrices || {})[pair.key];
    if (!pd?.indPrice) continue;
    map[`${pair.base}→${pair.quote}`] = pd.indPrice;
    map[`${pair.quote}→${pair.base}`] = 1 / pd.indPrice;
  }
  return map;
}

function convertAsset(amount, from, to, convMap) {
  if (from === to) return amount;
  const direct = convMap[`${from}→${to}`];
  if (direct != null) return amount * direct;
  const toLbtc = convMap[`${from}→L-BTC`];
  const lbtcTo = convMap[`L-BTC→${to}`];
  if (toLbtc != null && lbtcTo != null) return amount * toLbtc * lbtcTo;
  const toUsdt = convMap[`${from}→USDt`];
  const usdtTo = convMap[`USDt→${to}`];
  if (toUsdt != null && usdtTo != null) return amount * toUsdt * usdtTo;
  return null;
}

function fmtUsdt(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtLbtc(n) {
  if (n == null || !Number.isFinite(n)) return null;
  if (Math.abs(n) < 0.01) {
    return `${Math.round(n * SATS_PER_LBTC).toLocaleString('pt-BR')} sats`;
  }
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} L-BTC`;
}

function fmtDepix(n) {
  if (n == null || !Number.isFinite(n)) return null;
  if (Math.abs(n) < 0.01) return n.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ConvCell({ value, fmt }) {
  const text = fmt(value);
  if (!text) return <td className="dealer-asset-conv dealer-asset-conv-na">—</td>;
  return <td className="dealer-asset-conv">{text}</td>;
}

/** Cabeçalho de coluna de conversão com cotação inline. */
function ConvHead({ label, rate }) {
  return (
    <th className="dealer-asset-conv-head">
      {label}
      {rate != null && (
        <span className="dealer-asset-conv-rate-inline">{rate}</span>
      )}
    </th>
  );
}

function BalanceTable({ balances, convMap, hasConv }) {
  const rateUsdtPerLbtc = convMap['L-BTC→USDt'];      // quanto 1 BTC vale em USD
  const rateDepixPerUsdt = convMap['USDt→DePix'];     // quanto 1 USD vale em BRL
  const rateDepixPerLbtc = convMap['L-BTC→DePix'];   // quanto 1 BTC vale em BRL

  const totals = useMemo(() => {
    if (!hasConv || !balances.length) return null;
    let usdt = 0; let lbtc = 0; let depix = 0;
    let usdtOk = true; let lbtcOk = true; let depixOk = true;
    for (const { asset, value } of balances) {
      const u = convertAsset(value, asset, 'USDt', convMap);
      const l = convertAsset(value, asset, 'L-BTC', convMap);
      const d = convertAsset(value, asset, 'DePix', convMap);
      if (u == null) usdtOk = false; else usdt += u;
      if (l == null) lbtcOk = false; else lbtc += l;
      if (d == null) depixOk = false; else depix += d;
    }
    const partial = !usdtOk || !lbtcOk || !depixOk;
    return {
      usdt: usdtOk ? usdt : null,
      lbtc: lbtcOk ? lbtc : null,
      depix: depixOk ? depix : null,
      partial,
    };
  }, [balances, convMap, hasConv]);

  const cols = hasConv ? 4 : 2;

  return (
    <table className="dealer-assets-table">
      <thead>
        <tr>
          <th>Asset</th>
          <th>Saldo</th>
          {hasConv && (
            <ConvHead
              label="USDt"
              rate={rateDepixPerUsdt != null
                ? `R$${rateDepixPerUsdt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : null}
            />
          )}
          {hasConv && (
            <ConvHead
              label="L-BTC"
              rate={rateUsdtPerLbtc != null
                ? `$${rateUsdtPerLbtc.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
                : null}
            />
          )}
          {hasConv && (
            <ConvHead
              label="DePix"
              rate={rateDepixPerLbtc != null
                ? `R$${(rateDepixPerLbtc / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k/BTC`
                : null}
            />
          )}
        </tr>
      </thead>
      <tbody>
        {balances.map(({ asset, value }) => {
          const inUsdt = hasConv ? convertAsset(value, asset, 'USDt', convMap) : null;
          const inLbtc = hasConv ? convertAsset(value, asset, 'L-BTC', convMap) : null;
          const inDepix = hasConv ? convertAsset(value, asset, 'DePix', convMap) : null;
          return (
            <tr key={asset}>
              <td>
                <span className={`dealer-asset-badge ${assetClass(asset)}`}>{asset}</span>
              </td>
              <td className="dealer-asset-value">{formatAssetBalance(asset, value)}</td>
              {hasConv && <ConvCell value={inUsdt} fmt={fmtUsdt} />}
              {hasConv && <ConvCell value={inLbtc} fmt={fmtLbtc} />}
              {hasConv && <ConvCell value={inDepix} fmt={fmtDepix} />}
            </tr>
          );
        })}
      </tbody>
      {hasConv && totals && (
        <tfoot>
          <tr className="dealer-assets-total">
            <td colSpan={2} className="dealer-assets-total-label">
              Total{totals.partial ? '*' : ''}
            </td>
            <td className="dealer-asset-conv dealer-assets-total-value">{fmtUsdt(totals.usdt) ?? '—'}</td>
            <td className="dealer-asset-conv dealer-assets-total-value">{fmtLbtc(totals.lbtc) ?? '—'}</td>
            <td className="dealer-asset-conv dealer-assets-total-value">{fmtDepix(totals.depix) ?? '—'}</td>
          </tr>
          {totals.partial && (
            <tr>
              <td colSpan={cols} className="dealer-assets-total-note">
                * conversão parcial — preço de algum par ainda não disponível
              </td>
            </tr>
          )}
        </tfoot>
      )}
    </table>
  );
}

function SummaryView({ dealers, convMap, hasConv }) {
  const allBalances = useMemo(() => {
    const totals = {};
    for (const d of dealers) {
      for (const { asset, value } of normalizeBalances(d.balances)) {
        totals[asset] = (totals[asset] || 0) + value;
      }
    }
    return Object.entries(totals)
      .map(([asset, value]) => ({ asset, value }))
      .sort((a, b) => a.asset.localeCompare(b.asset));
  }, [dealers]);

  return (
    <>
      {dealers.length > 1 && allBalances.length > 0 && (
        <div className="dealer-assets-wallet-section dealer-assets-wallet-total">
          <div className="dealer-assets-wallet-label">
            Total — {dealers.length} carteiras
          </div>
          <BalanceTable balances={allBalances} convMap={convMap} hasConv={hasConv} />
        </div>
      )}

      {dealers.map((d) => {
        const balances = normalizeBalances(d.balances);
        if (!balances.length) return null;
        return (
          <div key={d.pid} className="dealer-assets-wallet-section">
            <div className="dealer-assets-wallet-label">
              PID {d.pid} · {d.wallet_name || '—'}
            </div>
            <BalanceTable balances={balances} convMap={convMap} hasConv={hasConv} />
          </div>
        );
      })}
    </>
  );
}

const BOOK_STATUS_LABEL = {
  idle: null,
  connecting: { text: 'conectando…', ok: false, warn: true },
  connected: { text: 'ao vivo', ok: true, warn: false },
  reconnecting: { text: 'reconectando…', ok: false, warn: true },
  error: { text: 'erro', ok: false, warn: false },
};

function ConversionSource({ status, lastUpdate }) {
  const meta = BOOK_STATUS_LABEL[status] || null;
  if (!meta && !lastUpdate) return null;

  const ts = lastUpdate instanceof Date
    ? lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="dealer-conv-source">
      <span className="dealer-conv-source-label">cotações:</span>
      <a
        href="https://sideswap.io/swap-market/"
        target="_blank"
        rel="noopener noreferrer"
        className="dealer-conv-source-name"
        title="SideSwap ind_price — preço indicativo do mercado público"
      >
        SideSwap
      </a>
      {meta && (
        <span className={`dealer-conv-source-status ${meta.ok ? 'ok' : meta.warn ? 'warn' : 'off'}`}>
          <span className="dealer-conv-source-dot" />
          {meta.text}
        </span>
      )}
      {ts && <span className="dealer-conv-source-ts">{ts}</span>}
    </div>
  );
}

export default function AssetsPanel({
  dealer,
  dealers = [],
  onRefresh,
  refreshing,
  lastRefresh,
  conversionPairs = [],
  conversionPrices = {},
  conversionStatus = 'idle',
  conversionLastUpdate = null,
}) {
  const balances = normalizeBalances(dealer?.balances);

  const convMap = useMemo(
    () => buildConversionMap(conversionPrices, conversionPairs),
    [conversionPrices, conversionPairs],
  );

  const hasConv = Object.keys(convMap).length > 0;
  const showSummary = !dealer && dealers.length > 0;

  return (
    <div className="dealer-assets-panel">
      <div className="dealer-assets-header">
        <h3>
          <TbCoins /> Saldos
          {dealer && (
            <span className="dealer-assets-sub">PID {dealer.pid} · {dealer.wallet_name}</span>
          )}
          {showSummary && (
            <span className="dealer-assets-sub">visão geral</span>
          )}
        </h3>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={onRefresh}
          disabled={refreshing || (!dealer && !showSummary)}
          className="dealer-assets-refresh"
        >
          <TbRefresh className={refreshing ? 'dealer-spin' : ''} />
          {refreshing ? '…' : ''}
        </Button>
      </div>

      {hasConv && (
        <ConversionSource status={conversionStatus} lastUpdate={conversionLastUpdate} />
      )}

      {showSummary ? (
        <SummaryView dealers={dealers} convMap={convMap} hasConv={hasConv} />
      ) : !dealer ? (
        <p className="dealer-empty">Clique em um dealer à esquerda para ver os saldos deste PID.</p>
      ) : balances.length === 0 ? (
        <div className="dealer-assets-empty">
          <p className="dealer-empty">Este PID ainda não reportou saldos.</p>
          <p className="dealer-hint">Aguarde o sync ou clique em Atualizar.</p>
        </div>
      ) : (
        <BalanceTable balances={balances} convMap={convMap} hasConv={hasConv} />
      )}

      {dealer && lastRefresh && (
        <p className="dealer-assets-ts">Atualizado: {lastRefresh}</p>
      )}
    </div>
  );
}
