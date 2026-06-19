import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { fetchMultipleFredSeries } from '../api/fredApi';
import { fetchBitcoinPrice } from '../api/coinGeckoApi';
import { calculateLeadLagCorrelation } from '../utils/statistics';
import ChartCard from '../components/ChartCard';
import LoadingSpinner from '../components/LoadingSpinner';

const FRED_SERIES = ['WALCL', 'WTREGEN', 'RRPONTSYD', 'SP500'];

function calcNetLiq(walcl, wtregen, rrpon) {
  const rrMap = new Map(rrpon.map(d => [d.date, d.value * 1000]));
  const tgaMap = new Map(wtregen.map(d => [d.date, d.value]));
  return walcl.filter(d => tgaMap.has(d.date)).map(d => ({
    date: d.date,
    value: d.value - (tgaMap.get(d.date) || 0) - (rrMap.get(d.date) || 0),
  }));
}

function getBestLag(lags) {
  if (!lags || !lags.length) return null;
  return lags.reduce((best, cur) =>
    Math.abs(cur.correlation) > Math.abs(best.correlation) ? cur : best
  , lags[0]);
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2744', borderRadius: '6px', padding: '10px 14px', fontSize: '11px' }}>
      <div style={{ color: '#8b949e', marginBottom: '6px' }}>Lag: {label} days</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: '2px' }}>
          Correlation: {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}
        </div>
      ))}
    </div>
  );
}

export default function LeadLagModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fredData, btcPrices] = await Promise.all([
        fetchMultipleFredSeries(FRED_SERIES, '2016-01-01'),
        fetchBitcoinPrice(365),
      ]);

      const netLiq = calcNetLiq(
        fredData['WALCL'] || [],
        fredData['WTREGEN'] || [],
        fredData['RRPONTSYD'] || [],
      );
      const sp500 = fredData['SP500'] || [];
      const btc = btcPrices.map(d => ({ date: d.date, value: d.price }));

      // Lead-lag analysis: liq leads btc, liq leads sp500
      const liqBtcLags = calculateLeadLagCorrelation(netLiq, btc, 180);
      const liqSpLags = calculateLeadLagCorrelation(netLiq, sp500, 180);
      const btcSpLags = calculateLeadLagCorrelation(btc, sp500, 90);

      const bestLiqBtc = getBestLag(liqBtcLags);
      const bestLiqSp = getBestLag(liqSpLags);
      const bestBtcSp = getBestLag(btcSpLags);

      setData({ liqBtcLags, liqSpLags, btcSpLags, bestLiqBtc, bestLiqSp, bestBtcSp });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function LagInterpretation({ best, label1, label2 }) {
    if (!best) return <div style={{ color: '#8b949e', fontSize: '12px' }}>Loading...</div>;
    const { lag, correlation } = best;
    const direction = lag > 0 ? `${label1} leads ${label2} by ${lag} days`
      : lag < 0 ? `${label2} leads ${label1} by ${-lag} days`
      : `${label1} and ${label2} are coincident`;
    return (
      <div style={{ background: '#0d1421', border: '1px solid #1a2744', borderRadius: '8px', padding: '12px 16px', fontSize: '12px' }}>
        <div style={{ color: '#c770f0', fontWeight: 600, marginBottom: '6px' }}>Best Lag: {lag > 0 ? '+' : ''}{lag} days</div>
        <div style={{ color: '#e6edf3', marginBottom: '4px' }}>{direction}</div>
        <div style={{ color: '#8b949e' }}>Peak correlation: <span style={{ color: correlation > 0.5 ? '#3fb950' : correlation > 0 ? '#d29922' : '#f85149' }}>{correlation?.toFixed(4)}</span></div>
      </div>
    );
  }

  return (
    <div>
      <div className="db-section-title">Lead-Lag Analysis</div>
      <p style={{ color: '#8b949e', fontSize: '12px', marginBottom: '16px' }}>
        Lead-lag analysis measures whether changes in one series predict future changes in another.
        Positive lag = first series leads. Negative lag = second series leads.
      </p>

      {loading && <LoadingSpinner />}
      {error && (
        <div style={{ color: '#f85149', padding: '20px', textAlign: 'center' }}>
          {error.message}
          <button onClick={load} style={{ marginLeft: '12px', background: '#c770f0', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px' }}>Retry</button>
        </div>
      )}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div>
              <div style={{ color: '#8b949e', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Net Liquidity ↔ Bitcoin</div>
              <LagInterpretation best={data.bestLiqBtc} label1="Liquidity" label2="BTC" />
            </div>
            <div>
              <div style={{ color: '#8b949e', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Net Liquidity ↔ S&amp;P500</div>
              <LagInterpretation best={data.bestLiqSp} label1="Liquidity" label2="SP500" />
            </div>
            <div>
              <div style={{ color: '#8b949e', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Bitcoin ↔ S&amp;P500</div>
              <LagInterpretation best={data.bestBtcSp} label1="BTC" label2="SP500" />
            </div>
          </div>

          <div className="db-charts-grid">
            <ChartCard title="Lead-Lag: Net Liquidity vs Bitcoin" subtitle="Correlation at each lag (-180 to +180 days)"
              height={280}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.liqBtcLags} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                  <XAxis dataKey="lag" tick={{ fontSize: 9 }} interval={Math.floor(data.liqBtcLags.length / 12)}
                    tickFormatter={v => v + 'd'} />
                  <YAxis domain={[-1, 1]} tick={{ fontSize: 10 }} width={45} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#4d6a96" />
                  <ReferenceLine x={data.bestLiqBtc?.lag} stroke="#d29922" strokeDasharray="3 3"
                    label={{ value: 'Best', fill: '#d29922', fontSize: 9 }} />
                  <Bar dataKey="correlation" name="Correlation" radius={0}>
                    {data.liqBtcLags.map((entry, index) => (
                      <Cell key={index} fill={entry.correlation > 0 ? '#3fb950' : '#f85149'} opacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Lead-Lag: Net Liquidity vs S&amp;P500" subtitle="Correlation at each lag (-180 to +180 days)"
              height={280}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.liqSpLags} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                  <XAxis dataKey="lag" tick={{ fontSize: 9 }} interval={Math.floor(data.liqSpLags.length / 12)}
                    tickFormatter={v => v + 'd'} />
                  <YAxis domain={[-1, 1]} tick={{ fontSize: 10 }} width={45} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#4d6a96" />
                  <ReferenceLine x={data.bestLiqSp?.lag} stroke="#d29922" strokeDasharray="3 3"
                    label={{ value: 'Best', fill: '#d29922', fontSize: 9 }} />
                  <Bar dataKey="correlation" name="Correlation" radius={0}>
                    {data.liqSpLags.map((entry, index) => (
                      <Cell key={index} fill={entry.correlation > 0 ? '#3fb950' : '#f85149'} opacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Lead-Lag: Bitcoin vs S&amp;P500" subtitle="Correlation at each lag (-90 to +90 days)"
              height={280}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.btcSpLags} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                  <XAxis dataKey="lag" tick={{ fontSize: 9 }} interval={Math.floor(data.btcSpLags.length / 12)}
                    tickFormatter={v => v + 'd'} />
                  <YAxis domain={[-1, 1]} tick={{ fontSize: 10 }} width={45} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#4d6a96" />
                  <ReferenceLine x={data.bestBtcSp?.lag} stroke="#d29922" strokeDasharray="3 3"
                    label={{ value: 'Best', fill: '#d29922', fontSize: 9 }} />
                  <Bar dataKey="correlation" name="Correlation" radius={0}>
                    {data.btcSpLags.map((entry, index) => (
                      <Cell key={index} fill={entry.correlation > 0 ? '#c770f0' : '#f85149'} opacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
