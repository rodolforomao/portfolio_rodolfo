import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, ComposedChart, Area, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { fetchMultipleFredSeries } from '../api/fredApi';
import { calculateMA } from '../utils/statistics';
import MetricCard from '../components/MetricCard';
import ChartCard from '../components/ChartCard';

// HY OAS, IG OAS, NFCI, TED Spread
const SERIES = ['BAMLH0A0HYM2', 'BAMLC0A0CM', 'NFCI', 'TEDRATE'];

function formatTick(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2744', borderRadius: '6px', padding: '10px 14px', fontSize: '11px' }}>
      <div style={{ color: '#8b949e', marginBottom: '6px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: '2px' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  );
}

function getLatest(series) {
  if (!series || !series.length) return null;
  return series[series.length - 1].value;
}

function pctChange(series, n) {
  if (!series || series.length < n + 1) return null;
  const latest = series[series.length - 1].value;
  const prev = series[series.length - 1 - n].value;
  return ((latest - prev) / Math.abs(prev)) * 100;
}

export default function CreditModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const series = await fetchMultipleFredSeries(SERIES, '2015-01-01');
      const hy = series['BAMLH0A0HYM2'] || [];
      const ig = series['BAMLC0A0CM'] || [];
      const nfci = series['NFCI'] || [];
      const ted = series['TEDRATE'] || [];

      // HY-IG spread
      const igMap = new Map(ig.map(d => [d.date, d.value]));
      const hySpread = hy.map(d => ({ date: d.date, value: d.value, ig: igMap.get(d.date) || null }));
      const hyMa = calculateMA(hy, 20);
      const hyMaMap = new Map(hyMa.map(d => [d.date, d.value]));
      const hyWithMa = hy.map(d => ({ ...d, ma20: hyMaMap.get(d.date) || null }));

      setData({ hy: hyWithMa, hySpread, ig, nfci, ted });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const hyLatest = getLatest(data?.hy);
  const igLatest = getLatest(data?.ig);
  const nfciLatest = getLatest(data?.nfci);
  const tedLatest = getLatest(data?.ted);

  return (
    <div>
      <div className="db-section-title">Credit Markets</div>

      <div className="db-metrics-grid">
        <MetricCard
          title="HY OAS"
          value={hyLatest != null ? hyLatest.toFixed(0) + ' bps' : 'N/A'}
          loading={loading} error={error}
          subtitle={hyLatest != null ? (hyLatest > 500 ? 'STRESS' : hyLatest > 300 ? 'ELEVATED' : 'NORMAL') : ''}
          change={pctChange(data?.hy, 20)}
          changeLabel="30d"
        />
        <MetricCard
          title="IG OAS"
          value={igLatest != null ? igLatest.toFixed(0) + ' bps' : 'N/A'}
          loading={loading} error={error}
          subtitle="Investment Grade Spread"
          change={pctChange(data?.ig, 20)}
          changeLabel="30d"
        />
        <MetricCard
          title="NFCI"
          value={nfciLatest != null ? nfciLatest.toFixed(3) : 'N/A'}
          loading={loading} error={error}
          subtitle={nfciLatest != null ? (nfciLatest > 0 ? 'TIGHTER THAN AVERAGE' : 'LOOSER THAN AVERAGE') : ''}
          sparklineData={data?.nfci?.slice(-52)}
        />
        <MetricCard
          title="TED Spread"
          value={tedLatest != null ? tedLatest.toFixed(2) + ' %' : 'N/A'}
          loading={loading} error={error}
          subtitle="3m LIBOR - T-Bill"
          sparklineData={data?.ted?.slice(-60)}
        />
      </div>

      <div className="db-charts-grid">
        <ChartCard
          title="High Yield OAS (Option-Adjusted Spread)"
          subtitle="BAMLH0A0HYM2 — basis points"
          loading={loading} error={error} onRetry={load} height={260}
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.hy} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.hy.length / 8)} />
                <YAxis tick={{ fontSize: 10 }} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <ReferenceLine y={300} stroke="#d29922" strokeDasharray="4 4" label={{ value: 'Elevated', fill: '#d29922', fontSize: 10 }} />
                <ReferenceLine y={500} stroke="#f85149" strokeDasharray="4 4" label={{ value: 'Stress', fill: '#f85149', fontSize: 10 }} />
                <Area type="monotone" dataKey="value" name="HY OAS" fill="rgba(248,81,73,0.15)" stroke="#f85149" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="ma20" name="20d MA" stroke="#c770f0" strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="HY vs IG Spread Comparison"
          subtitle="Relative credit risk across rating tiers"
          loading={loading} error={error} onRetry={load} height={260}
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.hySpread.filter((_, i) => i % 3 === 0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.hySpread.length / 8 / 3)} />
                <YAxis tick={{ fontSize: 10 }} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="value" name="HY OAS (bps)" stroke="#f85149" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ig" name="IG OAS (bps)" stroke="#58a6ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="National Financial Conditions Index (NFCI)"
          subtitle="Chicago Fed NFCI — positive = tighter than average"
          loading={loading} error={error} onRetry={load} height={240}
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.nfci} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.nfci.length / 8)} />
                <YAxis tick={{ fontSize: 10 }} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="#4d6a96" strokeDasharray="4 4" />
                <Bar dataKey="value" name="NFCI" fill="#58a6ff" opacity={0.8} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="TED Spread"
          subtitle="3-Month LIBOR minus 3-Month T-Bill — systemic risk indicator"
          loading={loading} error={error} onRetry={load} height={240}
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.ted} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.ted.length / 8)} />
                <YAxis tick={{ fontSize: 10 }} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0.5} stroke="#d29922" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="value" name="TED Spread %" fill="rgba(210,153,34,0.15)" stroke="#d29922" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
