import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, ComposedChart, Area,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { fetchMultipleFredSeries } from '../api/fredApi';
import { calculateMA, calculateZScore } from '../utils/statistics';
import MetricCard from '../components/MetricCard';
import ChartCard from '../components/ChartCard';

// DTWEXBGS: Broad Dollar Index (replaces old DXY available on FRED)
const SERIES = ['DTWEXBGS', 'GOLDAMGBD228NLBM', 'DCOILWTICO', 'DEXUSEU', 'DEXJPUS'];

function formatTick(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
}

function getLatest(series) {
  return series && series.length ? series[series.length - 1].value : null;
}

function pctChange(series, n) {
  if (!series || series.length < n + 1) return null;
  const latest = series[series.length - 1].value;
  const prev = series[series.length - 1 - n].value;
  return ((latest - prev) / Math.abs(prev)) * 100;
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

// Normalize two series to base 100 for comparison
function normalizeToBase(series, baseDate) {
  if (!series || !series.length) return [];
  const baseVal = series[0].value;
  return series.map(d => ({ date: d.date, value: (d.value / baseVal) * 100 }));
}

export default function DollarModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const series = await fetchMultipleFredSeries(SERIES, '2015-01-01');
      const dxy = series['DTWEXBGS'] || [];
      const gold = series['GOLDAMGBD228NLBM'] || [];
      const oil = series['DCOILWTICO'] || [];
      const eurusd = series['DEXUSEU'] || [];
      const usdjpy = series['DEXJPUS'] || [];

      // MA
      const ma20 = calculateMA(dxy, 20);
      const ma50 = calculateMA(dxy, 50);
      const ma20Map = new Map(ma20.map(d => [d.date, d.value]));
      const ma50Map = new Map(ma50.map(d => [d.date, d.value]));
      const dxyWithMa = dxy.map(d => ({
        ...d,
        ma20: ma20Map.get(d.date) || null,
        ma50: ma50Map.get(d.date) || null,
      }));

      // Z-score
      const zscores = calculateZScore(dxy, 252);

      // Normalized for comparison
      const normDxy = normalizeToBase(dxy);
      const normGold = normalizeToBase(gold);
      const normOil = normalizeToBase(oil);

      // Build comparison chart (align by date)
      const goldMap = new Map(normGold.map(d => [d.date, d.value]));
      const oilMap = new Map(normOil.map(d => [d.date, d.value]));
      const comparison = normDxy.filter((_, i) => i % 5 === 0).map(d => ({
        date: d.date,
        DXY: d.value,
        Gold: goldMap.get(d.date),
        Oil: oilMap.get(d.date),
      }));

      setData({ dxy: dxyWithMa, zscores, comparison, eurusd, usdjpy });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dxyLatest = getLatest(data?.dxy);
  const eurLatest = getLatest(data?.eurusd);
  const jpyLatest = getLatest(data?.usdjpy);
  const zscore = data?.zscores?.length ? data.zscores[data.zscores.length - 1].value : null;

  return (
    <div>
      <div className="db-section-title">Dollar Index (DXY) &amp; FX</div>

      <div className="db-metrics-grid">
        <MetricCard title="Broad Dollar Index" value={dxyLatest != null ? dxyLatest.toFixed(2) : 'N/A'}
          loading={loading} error={error}
          change={pctChange(data?.dxy, 20)} changeLabel="30d"
          sparklineData={data?.dxy?.slice(-60)} />
        <MetricCard title="EUR/USD" value={eurLatest != null ? eurLatest.toFixed(4) : 'N/A'}
          loading={loading} error={error}
          change={pctChange(data?.eurusd, 20)} changeLabel="30d" />
        <MetricCard title="USD/JPY" value={jpyLatest != null ? jpyLatest.toFixed(2) : 'N/A'}
          loading={loading} error={error}
          change={pctChange(data?.usdjpy, 20)} changeLabel="30d" />
        <MetricCard title="DXY Z-Score (1yr)" value={zscore != null ? zscore.toFixed(2) : 'N/A'}
          loading={loading} error={error}
          subtitle={zscore != null ? (Math.abs(zscore) > 2 ? 'EXTREME' : Math.abs(zscore) > 1 ? 'ELEVATED' : 'NORMAL') : ''} />
      </div>

      <div className="db-charts-grid">
        <ChartCard title="Broad Dollar Index with MAs" subtitle="DTWEXBGS with 20 &amp; 50-day moving averages"
          loading={loading} error={error} onRetry={load} height={280}>
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.dxy.filter((_, i) => i % 3 === 0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.dxy.length / 3 / 8)} />
                <YAxis tick={{ fontSize: 10 }} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="value" name="DXY" stroke="#c770f0" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="ma20" name="MA20" stroke="#3fb950" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="ma50" name="MA50" stroke="#d29922" strokeWidth={1.5} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="DXY Z-Score (252-day)" subtitle="Standard deviations from 1-year mean"
          loading={loading} error={error} onRetry={load} height={240}>
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.zscores.filter((_, i) => i % 3 === 0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.zscores.length / 3 / 8)} />
                <YAxis tick={{ fontSize: 10 }} width={45} domain={[-3, 3]} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={2} stroke="#f85149" strokeDasharray="3 3" />
                <ReferenceLine y={-2} stroke="#3fb950" strokeDasharray="3 3" />
                <ReferenceLine y={0} stroke="#4d6a96" />
                <Area type="monotone" dataKey="value" name="Z-Score"
                  fill="rgba(199,112,240,0.1)" stroke="#c770f0" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="DXY vs Gold vs Oil (Base 100)" subtitle="Normalized comparison since 2015"
          loading={loading} error={error} onRetry={load} height={260}>
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.comparison} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.comparison.length / 8)} />
                <YAxis tick={{ fontSize: 10 }} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="DXY" stroke="#c770f0" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Gold" stroke="#d29922" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Oil" stroke="#58a6ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="EUR/USD Exchange Rate" subtitle="Inverse of dollar strength in EUR terms"
          loading={loading} error={error} onRetry={load} height={240}>
          {data && data.eurusd.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.eurusd.filter((_, i) => i % 3 === 0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.eurusd.length / 3 / 8)} />
                <YAxis tick={{ fontSize: 10 }} width={55} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="value" name="EUR/USD" stroke="#3fb950" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
