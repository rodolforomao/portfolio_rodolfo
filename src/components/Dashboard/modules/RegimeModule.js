import React, { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, Line,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell, BarChart, Bar
} from 'recharts';
import { fetchMultipleFredSeries } from '../api/fredApi';
import ChartCard from '../components/ChartCard';
import LoadingSpinner from '../components/LoadingSpinner';

const FRED_SERIES = ['WALCL', 'WTREGEN', 'RRPONTSYD', 'VIXCLS', 'T10Y2Y', 'BAMLH0A0HYM2'];

function formatTick(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
}

function calcNetLiq(walcl, wtregen, rrpon) {
  const rrMap = new Map(rrpon.map(d => [d.date, d.value * 1000]));
  const tgaMap = new Map(wtregen.map(d => [d.date, d.value]));
  return walcl.filter(d => tgaMap.has(d.date)).map(d => ({
    date: d.date,
    value: d.value - (tgaMap.get(d.date) || 0) - (rrMap.get(d.date) || 0),
  }));
}

// Classify regime based on multiple indicators
function classifyRegime(liqChange, vix, yield_curve, hy_spread) {
  let score = 0;
  // Liquidity trend (positive = bullish)
  if (liqChange > 2) score += 2;
  else if (liqChange > 0) score += 1;
  else if (liqChange < -2) score -= 2;
  else if (liqChange < 0) score -= 1;

  // VIX
  if (vix < 15) score += 2;
  else if (vix < 20) score += 1;
  else if (vix > 30) score -= 2;
  else if (vix > 25) score -= 1;

  // Yield curve
  if (yield_curve > 0.5) score += 1;
  else if (yield_curve < 0) score -= 2;

  // HY spread
  if (hy_spread < 300) score += 1;
  else if (hy_spread > 500) score -= 2;
  else if (hy_spread > 400) score -= 1;

  if (score >= 4) return { label: 'RISK-ON', color: '#3fb950', score };
  if (score >= 2) return { label: 'MILD RISK-ON', color: '#8bc34a', score };
  if (score >= -1) return { label: 'NEUTRAL', color: '#d29922', score };
  if (score >= -3) return { label: 'MILD RISK-OFF', color: '#e8734a', score };
  return { label: 'RISK-OFF', color: '#f85149', score };
}

function buildRegimeTimeline(netLiq, vix, yieldCurve, hySpread) {
  if (!netLiq.length) return [];
  const vixMap = new Map(vix.map(d => [d.date, d.value]));
  const ycMap = new Map(yieldCurve.map(d => [d.date, d.value]));
  const hyMap = new Map(hySpread.map(d => [d.date, d.value]));

  const step = Math.max(1, Math.floor(netLiq.length / 200));
  return netLiq.filter((_, i) => i % step === 0).map((d, i, arr) => {
    const prevValue = i >= 4 ? arr[i - 4].value : d.value;
    const liqChange = ((d.value - prevValue) / Math.abs(prevValue)) * 100;
    const vixVal = vixMap.get(d.date) || 20;
    const ycVal = ycMap.get(d.date) || 0;
    const hyVal = hyMap.get(d.date) || 350;
    const regime = classifyRegime(liqChange, vixVal, ycVal, hyVal);
    return {
      date: d.date,
      regime: regime.label,
      score: regime.score,
      color: regime.color,
      liquidity: d.value / 1e6,
      vix: vixVal,
      yieldCurve: ycVal,
      hySpread: hyVal,
    };
  });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2744', borderRadius: '6px', padding: '10px 14px', fontSize: '11px' }}>
      <div style={{ color: '#8b949e', marginBottom: '6px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || '#c9d1d9', marginBottom: '2px' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  );
}

export default function RegimeModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const series = await fetchMultipleFredSeries(FRED_SERIES, '2016-01-01');
      const netLiq = calcNetLiq(
        series['WALCL'] || [],
        series['WTREGEN'] || [],
        series['RRPONTSYD'] || [],
      );
      const vix = series['VIXCLS'] || [];
      const yieldCurve = series['T10Y2Y'] || [];
      const hySpread = series['BAMLH0A0HYM2'] || [];

      const regimes = buildRegimeTimeline(netLiq, vix, yieldCurve, hySpread);
      const currentRegime = regimes.length ? regimes[regimes.length - 1] : null;

      // Score distribution for recent periods
      const recentScores = regimes.slice(-60);
      const scoreDist = [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(s => ({
        score: s,
        count: recentScores.filter(r => r.score === s).length,
      })).filter(d => d.count > 0);

      setData({ regimes, currentRegime, scoreDist });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="db-section-title">Market Regimes</div>
      <p style={{ color: '#8b949e', fontSize: '12px', marginBottom: '16px' }}>
        Regime classification based on Fed Net Liquidity trend, VIX level, yield curve shape, and HY credit spreads.
      </p>

      {loading && <LoadingSpinner />}
      {error && (
        <div style={{ color: '#f85149', padding: '20px', textAlign: 'center' }}>
          {error.message}
          <button onClick={load} style={{ marginLeft: '12px', background: '#c770f0', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px' }}>Retry</button>
        </div>
      )}

      {data?.currentRegime && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'inline-block',
            background: data.currentRegime.color + '20',
            border: '2px solid ' + data.currentRegime.color,
            borderRadius: '10px',
            padding: '16px 24px',
          }}>
            <div style={{ color: '#8b949e', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Current Regime</div>
            <div style={{ color: data.currentRegime.color, fontSize: '24px', fontWeight: 700, letterSpacing: '0.05em' }}>
              {data.currentRegime.regime}
            </div>
            <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '6px' }}>
              Score: {data.currentRegime.score > 0 ? '+' : ''}{data.currentRegime.score} &nbsp;&bull;&nbsp; {data.currentRegime.date}
            </div>
          </div>

          <div style={{ display: 'inline-grid', gridTemplateColumns: 'repeat(4, auto)', gap: '8px', marginTop: '16px', marginLeft: '16px' }}>
            {[
              { label: 'Net Liq ($T)', value: data.currentRegime.liquidity?.toFixed(2), prefix: '$' },
              { label: 'VIX', value: data.currentRegime.vix?.toFixed(1) },
              { label: '10Y-2Y Spread', value: (data.currentRegime.yieldCurve?.toFixed(2) || 'N/A') + '%' },
              { label: 'HY OAS', value: (data.currentRegime.hySpread?.toFixed(0) || 'N/A') + ' bps' },
            ].map(m => (
              <div key={m.label} style={{ background: '#0d1421', border: '1px solid #1a2744', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ color: '#8b949e', fontSize: '10px', marginBottom: '4px' }}>{m.label}</div>
                <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: '14px' }}>{m.prefix || ''}{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data && (
        <div className="db-charts-grid">
          <ChartCard title="Regime Score History" subtitle="Composite risk-on/risk-off score over time"
            height={260}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.regimes.slice(-200)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(Math.min(data.regimes.length, 200) / 8)} />
                <YAxis domain={[-6, 6]} tick={{ fontSize: 10 }} width={35} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="#4d6a96" />
                <ReferenceLine y={2} stroke="#3fb950" strokeDasharray="3 3" />
                <ReferenceLine y={-2} stroke="#f85149" strokeDasharray="3 3" />
                <Bar dataKey="score" name="Regime Score" radius={0}>
                  {data.regimes.slice(-200).map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Regime Indicator: VIX vs Yield Curve" subtitle="Two key inputs to regime classification"
            height={260}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.regimes.slice(-200)} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(Math.min(data.regimes.length, 200) / 8)} />
                <YAxis yAxisId="vix" orientation="left" tick={{ fontSize: 10 }} width={40} label={{ value: 'VIX', angle: -90, fill: '#f85149', fontSize: 10, position: 'insideLeft' }} />
                <YAxis yAxisId="yc" orientation="right" tick={{ fontSize: 10 }} width={50} label={{ value: '10Y-2Y%', angle: 90, fill: '#58a6ff', fontSize: 10, position: 'insideRight' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <ReferenceLine yAxisId="yc" y={0} stroke="#4d6a96" />
                <Line yAxisId="vix" type="monotone" dataKey="vix" name="VIX" stroke="#f85149" strokeWidth={1.5} dot={false} />
                <Line yAxisId="yc" type="monotone" dataKey="yieldCurve" name="10Y-2Y%" stroke="#58a6ff" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Score Distribution (Last 60 Periods)" subtitle="How time has been spent in each regime"
            height={220}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.scoreDist} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="score" tick={{ fontSize: 10 }} tickFormatter={v => (v > 0 ? '+' : '') + v} />
                <YAxis tick={{ fontSize: 10 }} width={35} />
                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2744', fontSize: '11px' }} />
                <Bar dataKey="count" name="Periods" radius={2}>
                  {data.scoreDist.map((entry, i) => (
                    <Cell key={i} fill={entry.score > 0 ? '#3fb950' : entry.score === 0 ? '#d29922' : '#f85149'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}
