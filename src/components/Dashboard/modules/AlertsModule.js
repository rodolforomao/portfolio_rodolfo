import React, { useState, useEffect, useCallback } from 'react';
import { fetchMultipleFredSeries } from '../api/fredApi';
import { fetchBitcoinInfo, fetchGlobalData } from '../api/coinGeckoApi';
import { calculateZScore, calculatePercentile } from '../utils/statistics';
import { formatNumber, formatPercent } from '../utils/formatters';
import LoadingSpinner from '../components/LoadingSpinner';

function calcNetLiq(walcl, wtregen, rrpon) {
  const rrMap = new Map(rrpon.map(d => [d.date, d.value * 1000]));
  const tgaMap = new Map(wtregen.map(d => [d.date, d.value]));
  return walcl.filter(d => tgaMap.has(d.date)).map(d => ({
    date: d.date,
    value: d.value - (tgaMap.get(d.date) || 0) - (rrMap.get(d.date) || 0),
  }));
}

function pctChange(series, n) {
  if (!series || series.length < n + 1) return null;
  const latest = series[series.length - 1].value;
  const prev = series[series.length - 1 - n].value;
  return ((latest - prev) / Math.abs(prev)) * 100;
}

function checkAlerts(data) {
  const alerts = [];

  if (!data) return alerts;

  const { netLiq, vix, t10y2y, hySpread, btcInfo, globalData } = data;

  // Liquidity alerts
  if (netLiq && netLiq.length > 4) {
    const liq30d = pctChange(netLiq, 4);
    const liq4 = netLiq.slice(-4);
    const liqZscore = calculateZScore(netLiq, 52);
    const currentZ = liqZscore.length ? liqZscore[liqZscore.length - 1].value : null;

    if (liq30d !== null && liq30d < -5) {
      alerts.push({
        id: 'liq-contraction',
        severity: Math.abs(liq30d) > 10 ? 'critical' : 'warning',
        title: 'Fed Liquidity Contracting',
        message: `Net liquidity has fallen ${Math.abs(liq30d).toFixed(1)}% in the last 30 days.`,
        value: liq30d.toFixed(1) + '%',
        category: 'Liquidity',
      });
    }
    if (liq30d !== null && liq30d > 5) {
      alerts.push({
        id: 'liq-expansion',
        severity: 'info',
        title: 'Fed Liquidity Expanding',
        message: `Net liquidity has increased ${liq30d.toFixed(1)}% in the last 30 days.`,
        value: '+' + liq30d.toFixed(1) + '%',
        category: 'Liquidity',
      });
    }
    if (currentZ !== null && currentZ < -2) {
      alerts.push({
        id: 'liq-zscore-low',
        severity: 'critical',
        title: 'Liquidity at 2-Year Low (Z-Score)',
        message: `Net liquidity z-score is ${currentZ.toFixed(2)}σ — historically low.`,
        value: currentZ.toFixed(2) + 'σ',
        category: 'Liquidity',
      });
    }
  }

  // VIX alerts
  if (vix && vix.length > 0) {
    const vixLatest = vix[vix.length - 1].value;
    if (vixLatest > 40) {
      alerts.push({ id: 'vix-extreme', severity: 'critical', title: 'VIX Extreme Fear', message: `VIX at ${vixLatest.toFixed(1)} — extreme market fear/volatility.`, value: vixLatest.toFixed(1), category: 'Markets' });
    } else if (vixLatest > 25) {
      alerts.push({ id: 'vix-elevated', severity: 'warning', title: 'VIX Elevated', message: `VIX at ${vixLatest.toFixed(1)} — above normal volatility range.`, value: vixLatest.toFixed(1), category: 'Markets' });
    } else if (vixLatest < 12) {
      alerts.push({ id: 'vix-low', severity: 'info', title: 'VIX Extreme Complacency', message: `VIX at ${vixLatest.toFixed(1)} — historically low. Potential for volatility spike.`, value: vixLatest.toFixed(1), category: 'Markets' });
    }
  }

  // Yield curve alerts
  if (t10y2y && t10y2y.length > 0) {
    const ycLatest = t10y2y[t10y2y.length - 1].value;
    if (ycLatest < 0) {
      alerts.push({ id: 'yield-inverted', severity: 'warning', title: 'Yield Curve Inverted (10Y-2Y)', message: `10Y-2Y spread is ${ycLatest.toFixed(2)}% — historically precedes recessions.`, value: ycLatest.toFixed(2) + '%', category: 'Macro' });
    }
  }

  // HY spread alerts
  if (hySpread && hySpread.length > 0) {
    const hyLatest = hySpread[hySpread.length - 1].value;
    if (hyLatest > 500) {
      alerts.push({ id: 'hy-stress', severity: 'critical', title: 'HY Spreads in Stress Zone', message: `HY OAS at ${hyLatest.toFixed(0)} bps — credit stress conditions.`, value: hyLatest.toFixed(0) + ' bps', category: 'Credit' });
    } else if (hyLatest > 350) {
      alerts.push({ id: 'hy-elevated', severity: 'warning', title: 'HY Spreads Elevated', message: `HY OAS at ${hyLatest.toFixed(0)} bps — above historical average (~350 bps).`, value: hyLatest.toFixed(0) + ' bps', category: 'Credit' });
    }
  }

  // Bitcoin alerts
  if (btcInfo) {
    if (Math.abs(btcInfo.change24h) > 10) {
      alerts.push({
        id: 'btc-large-move',
        severity: btcInfo.change24h < -10 ? 'warning' : 'info',
        title: `Bitcoin Large 24h Move`,
        message: `BTC moved ${formatPercent(btcInfo.change24h)} in the last 24 hours.`,
        value: formatPercent(btcInfo.change24h),
        category: 'Crypto',
      });
    }
    if (btcInfo.change30d < -30) {
      alerts.push({ id: 'btc-bear', severity: 'warning', title: 'Bitcoin Bear Signal', message: `BTC is down ${Math.abs(btcInfo.change30d).toFixed(1)}% over 30 days.`, value: formatPercent(btcInfo.change30d), category: 'Crypto' });
    }
  }

  if (alerts.length === 0) {
    alerts.push({ id: 'all-clear', severity: 'success', title: 'All Clear', message: 'No threshold alerts triggered. Markets appear in normal operating ranges.', value: '', category: 'System' });
  }

  return alerts;
}

const SEVERITY_STYLES = {
  critical: { bg: 'rgba(248,81,73,0.1)', border: '#f85149', icon: '⬛', label: 'CRITICAL', labelColor: '#f85149' },
  warning: { bg: 'rgba(210,153,34,0.1)', border: '#d29922', icon: '⬛', label: 'WARNING', labelColor: '#d29922' },
  info: { bg: 'rgba(88,166,255,0.1)', border: '#58a6ff', icon: '⬛', label: 'INFO', labelColor: '#58a6ff' },
  success: { bg: 'rgba(63,185,80,0.1)', border: '#3fb950', icon: '⬛', label: 'OK', labelColor: '#3fb950' },
};

export default function AlertsModule() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fredData, btcInfo, globalData] = await Promise.all([
        fetchMultipleFredSeries(['WALCL', 'WTREGEN', 'RRPONTSYD', 'VIXCLS', 'T10Y2Y', 'BAMLH0A0HYM2'], '2016-01-01'),
        fetchBitcoinInfo().catch(() => null),
        fetchGlobalData().catch(() => null),
      ]);

      const netLiq = calcNetLiq(
        fredData['WALCL'] || [],
        fredData['WTREGEN'] || [],
        fredData['RRPONTSYD'] || [],
      );

      const computed = checkAlerts({
        netLiq,
        vix: fredData['VIXCLS'] || [],
        t10y2y: fredData['T10Y2Y'] || [],
        hySpread: fredData['BAMLH0A0HYM2'] || [],
        btcInfo,
        globalData,
      });

      setAlerts(computed);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
    success: alerts.filter(a => a.severity === 'success').length,
  };

  return (
    <div>
      <div className="db-section-title">Alerts Dashboard</div>
      <p style={{ color: '#8b949e', fontSize: '12px', marginBottom: '16px' }}>
        Real-time threshold monitoring for key macroeconomic and crypto indicators.
        {lastUpdated && <span style={{ marginLeft: '8px', color: '#4d6a96' }}>Last updated: {lastUpdated}</span>}
      </p>

      {loading && <LoadingSpinner />}
      {error && (
        <div style={{ color: '#f85149', padding: '20px', textAlign: 'center' }}>
          {error.message}
          <button onClick={load} style={{ marginLeft: '12px', background: '#c770f0', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px' }}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary badges */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {Object.entries(counts).filter(([, v]) => v > 0).map(([severity, count]) => {
              const style = SEVERITY_STYLES[severity];
              return (
                <div key={severity} style={{
                  background: style.bg, border: '1px solid ' + style.border,
                  borderRadius: '8px', padding: '10px 16px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{ color: style.labelColor, fontWeight: 700, fontSize: '13px' }}>{count}</span>
                  <span style={{ color: style.labelColor, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{style.label}</span>
                </div>
              );
            })}
            <button onClick={load} style={{
              background: 'transparent', border: '1px solid #1a2744', color: '#8b949e',
              borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontSize: '11px',
            }}>
              Refresh
            </button>
          </div>

          {/* Alert list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {alerts.map(alert => {
              const style = SEVERITY_STYLES[alert.severity];
              return (
                <div key={alert.id} style={{
                  background: style.bg,
                  border: '1px solid ' + style.border,
                  borderRadius: '10px',
                  padding: '14px 18px',
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr auto',
                  alignItems: 'center',
                  gap: '16px',
                }}>
                  <div>
                    <span style={{
                      display: 'inline-block', padding: '3px 8px', borderRadius: '4px', fontSize: '9px',
                      fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                      background: style.border + '20', color: style.labelColor, border: '1px solid ' + style.border + '60',
                    }}>{style.label}</span>
                    <div style={{ color: '#4d6a96', fontSize: '9px', marginTop: '4px', textTransform: 'uppercase' }}>{alert.category}</div>
                  </div>
                  <div>
                    <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{alert.title}</div>
                    <div style={{ color: '#8b949e', fontSize: '12px' }}>{alert.message}</div>
                  </div>
                  {alert.value && (
                    <div style={{ color: style.labelColor, fontWeight: 700, fontSize: '16px', fontFamily: 'monospace', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {alert.value}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Alert legend */}
          <div style={{ marginTop: '32px', padding: '16px', background: '#0d1421', border: '1px solid #1a2744', borderRadius: '8px' }}>
            <div style={{ color: '#8b949e', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Alert Thresholds</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px', fontSize: '11px', color: '#8b949e' }}>
              <div>Liquidity: &gt;5% 30d change = info; &lt;-5% = warning; &lt;-10% = critical</div>
              <div>VIX: &lt;12 = complacency; &gt;25 = elevated; &gt;40 = extreme fear</div>
              <div>10Y-2Y: &lt;0% = inverted (warning)</div>
              <div>HY OAS: &gt;350 bps = elevated; &gt;500 bps = stress</div>
              <div>BTC 24h: &gt;±10% = large move alert</div>
              <div>BTC 30d: &lt;-30% = bear signal</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
