import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, ComposedChart, Area,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { fetchMultipleFredSeries } from '../api/fredApi';
import { calculateMA, normalizeBase100 } from '../utils/statistics';
import { formatNumber } from '../utils/formatters';
import MetricCard from '../components/MetricCard';
import ChartCard from '../components/ChartCard';

const SERIES = ['SP500', 'NASDAQCOM', 'VIXCLS', 'GOLDAMGBD228NLBM', 'DCOILWTICO'];

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
          {p.name}: {typeof p.value === 'number' ? formatNumber(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

export default function MarketModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const series = await fetchMultipleFredSeries(SERIES, '2015-01-01');
      const sp500 = series['SP500'] || [];
      const nasdaq = series['NASDAQCOM'] || [];
      const vix = series['VIXCLS'] || [];
      const gold = series['GOLDAMGBD228NLBM'] || [];
      const oil = series['DCOILWTICO'] || [];

      // Add 200-day MA to SP500
      const sp500Ma200 = calculateMA(sp500, 200);
      const maMap = new Map(sp500Ma200.map(d => [d.date, d.value]));
      const sp500WithMa = sp500.map(d => ({ ...d, ma200: maMap.get(d.date) || null }));

      // Normalized for performance comparison
      const normSp = normalizeBase100(sp500.filter((_, i) => i % 5 === 0));
      const normNasdaq = normalizeBase100(nasdaq.filter((_, i) => i % 5 === 0));
      const normGold = normalizeBase100(gold.filter((_, i) => i % 5 === 0));
      const normOil = normalizeBase100(oil.filter((_, i) => i % 5 === 0));

      const nasdaqMap = new Map(normNasdaq.map(d => [d.date, d.value]));
      const goldMap = new Map(normGold.map(d => [d.date, d.value]));
      const oilMap = new Map(normOil.map(d => [d.date, d.value]));

      const comparison = normSp.map(d => ({
        date: d.date,
        SP500: d.value,
        Nasdaq: nasdaqMap.get(d.date),
        Gold: goldMap.get(d.date),
        Oil: oilMap.get(d.date),
      }));

      setData({ sp500: sp500WithMa, nasdaq, vix, gold, oil, comparison });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const spLatest = getLatest(data?.sp500);
  const nasdaqLatest = getLatest(data?.nasdaq);
  const vixLatest = getLatest(data?.vix);
  const goldLatest = getLatest(data?.gold);
  const oilLatest = getLatest(data?.oil);

  const vixLabel = vixLatest != null ? (vixLatest > 40 ? 'EXTREME FEAR' : vixLatest > 25 ? 'FEAR' : vixLatest > 15 ? 'NEUTRAL' : 'COMPLACENCY') : '';

  return (
    <div>
      <div className="db-section-title">Markets</div>

      <div className="db-metrics-grid">
        <MetricCard title="S&amp;P 500" value={spLatest != null ? formatNumber(spLatest, 0) : 'N/A'}
          loading={loading} error={error}
          change={pctChange(data?.sp500, 20)} changeLabel="30d"
          valuePrefix="$"
          sparklineData={data?.sp500?.slice(-60)} />
        <MetricCard title="Nasdaq Composite" value={nasdaqLatest != null ? formatNumber(nasdaqLatest, 0) : 'N/A'}
          loading={loading} error={error}
          change={pctChange(data?.nasdaq, 20)} changeLabel="30d"
          sparklineData={data?.nasdaq?.slice(-60)} />
        <MetricCard title="VIX (Fear Index)" value={vixLatest != null ? vixLatest.toFixed(1) : 'N/A'}
          loading={loading} error={error} subtitle={vixLabel}
          sparklineData={data?.vix?.slice(-60)} />
        <MetricCard title="Gold (USD/oz)" value={goldLatest != null ? '$' + formatNumber(goldLatest, 0) : 'N/A'}
          loading={loading} error={error}
          change={pctChange(data?.gold, 20)} changeLabel="30d" />
        <MetricCard title="WTI Crude (USD/bbl)" value={oilLatest != null ? '$' + formatNumber(oilLatest, 1) : 'N/A'}
          loading={loading} error={error}
          change={pctChange(data?.oil, 20)} changeLabel="30d" />
      </div>

      <div className="db-charts-grid">
        <ChartCard title="S&amp;P 500 with 200-Day MA" subtitle="SP500 — price with 200-day moving average"
          loading={loading} error={error} onRetry={load} height={280}>
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.sp500.filter((_, i) => i % 3 === 0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.sp500.length / 3 / 8)} />
                <YAxis tickFormatter={v => '$' + formatNumber(v, 0)} tick={{ fontSize: 10 }} width={65} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="value" name="SP500" fill="rgba(63,185,80,0.1)" stroke="#3fb950" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="ma200" name="200d MA" stroke="#d29922" strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="VIX — Volatility Index" subtitle="CBOE Volatility Index — fear gauge"
          loading={loading} error={error} onRetry={load} height={240}>
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.vix} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.vix.length / 8)} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={20} stroke="#d29922" strokeDasharray="4 4" label={{ value: 'Normal', fill: '#d29922', fontSize: 9 }} />
                <ReferenceLine y={40} stroke="#f85149" strokeDasharray="4 4" label={{ value: 'Panic', fill: '#f85149', fontSize: 9 }} />
                <Area type="monotone" dataKey="value" name="VIX"
                  fill="rgba(248,81,73,0.1)" stroke="#f85149" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Normalized Performance (Base 100)" subtitle="SP500 vs Nasdaq vs Gold vs Oil since 2015"
          loading={loading} error={error} onRetry={load} height={280}>
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.comparison} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.comparison.length / 8)} />
                <YAxis tick={{ fontSize: 10 }} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <ReferenceLine y={100} stroke="#4d6a96" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="SP500" stroke="#3fb950" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Nasdaq" stroke="#c770f0" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Gold" stroke="#d29922" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="Oil" stroke="#58a6ff" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Gold Price (USD/oz)" subtitle="GOLDAMGBD228NLBM — safe haven asset"
          loading={loading} error={error} onRetry={load} height={240}>
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.gold.filter((_, i) => i % 3 === 0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.gold.length / 3 / 8)} />
                <YAxis tickFormatter={v => '$' + formatNumber(v, 0)} tick={{ fontSize: 10 }} width={65} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name="Gold $/oz"
                  fill="rgba(210,153,34,0.15)" stroke="#d29922" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
