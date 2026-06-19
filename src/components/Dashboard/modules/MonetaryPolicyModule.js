import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, ComposedChart, Area,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { fetchMultipleFredSeries } from '../api/fredApi';
// formatters imported but values formatted inline
import MetricCard from '../components/MetricCard';
import ChartCard from '../components/ChartCard';

const SERIES = ['FEDFUNDS', 'CPIAUCSL', 'UNRATE', 'T10YIE'];

function formatTick(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
}

function getLatest(series) {
  return series && series.length ? series[series.length - 1].value : null;
}

// eslint-disable-next-line no-unused-vars
function yoyChange(series) {
  if (!series || series.length < 13) return null;
  const latest = series[series.length - 1].value;
  const prev = series[series.length - 13].value;
  return ((latest - prev) / Math.abs(prev)) * 100;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2744', borderRadius: '6px', padding: '10px 14px', fontSize: '11px' }}>
      <div style={{ color: '#8b949e', marginBottom: '6px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: '2px' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) + '%' : p.value}
        </div>
      ))}
    </div>
  );
}

// Calculate YoY CPI inflation rate
function calcInflationRate(cpiSeries) {
  if (!cpiSeries || cpiSeries.length < 13) return [];
  return cpiSeries.slice(12).map((d, i) => {
    const prev = cpiSeries[i].value;
    return { date: d.date, value: ((d.value - prev) / prev) * 100 };
  });
}

// Real fed funds = FEDFUNDS - inflation
function calcRealRate(fedfunds, inflation) {
  const infMap = new Map(inflation.map(d => [d.date, d.value]));
  return fedfunds.filter(d => infMap.has(d.date)).map(d => ({
    date: d.date,
    value: d.value - infMap.get(d.date),
    nominal: d.value,
    inflation: infMap.get(d.date),
  }));
}

export default function MonetaryPolicyModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const series = await fetchMultipleFredSeries(SERIES, '2010-01-01');
      const fedfunds = series['FEDFUNDS'] || [];
      const cpi = series['CPIAUCSL'] || [];
      const unrate = series['UNRATE'] || [];
      const t10yie = series['T10YIE'] || [];

      const inflation = calcInflationRate(cpi);
      const realRate = calcRealRate(fedfunds, inflation);

      setData({ fedfunds, cpi, unrate, t10yie, inflation, realRate });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fedLatest = getLatest(data?.fedfunds);
  const inflationLatest = getLatest(data?.inflation);
  const unrateLatest = getLatest(data?.unrate);
  const t10yieLatest = getLatest(data?.t10yie);
  const realRateLatest = data?.realRate?.length ? data.realRate[data.realRate.length - 1].value : null;

  return (
    <div>
      <div className="db-section-title">Monetary Policy</div>

      <div className="db-metrics-grid">
        <MetricCard title="Fed Funds Rate" value={fedLatest != null ? fedLatest.toFixed(2) + '%' : 'N/A'}
          loading={loading} error={error} subtitle="Current policy rate"
          sparklineData={data?.fedfunds?.slice(-24)} />
        <MetricCard title="CPI Inflation (YoY)" value={inflationLatest != null ? inflationLatest.toFixed(2) + '%' : 'N/A'}
          loading={loading} error={error}
          subtitle={inflationLatest != null ? (inflationLatest > 3 ? 'ABOVE TARGET' : inflationLatest > 2 ? 'NEAR TARGET' : 'BELOW TARGET') : ''}
          sparklineData={data?.inflation?.slice(-24)} />
        <MetricCard title="Unemployment Rate" value={unrateLatest != null ? unrateLatest.toFixed(1) + '%' : 'N/A'}
          loading={loading} error={error}
          subtitle="U-3 Unemployment"
          sparklineData={data?.unrate?.slice(-24)} />
        <MetricCard title="10yr Breakeven" value={t10yieLatest != null ? t10yieLatest.toFixed(2) + '%' : 'N/A'}
          loading={loading} error={error} subtitle="Market inflation expectations" />
        <MetricCard title="Real Fed Funds" value={realRateLatest != null ? realRateLatest.toFixed(2) + '%' : 'N/A'}
          loading={loading} error={error}
          subtitle={realRateLatest != null ? (realRateLatest > 0 ? 'RESTRICTIVE' : 'ACCOMMODATIVE') : ''} />
      </div>

      <div className="db-charts-grid">
        <ChartCard title="Fed Funds Rate vs CPI Inflation" subtitle="Nominal rate vs YoY inflation"
          loading={loading} error={error} onRetry={load} height={280}>
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.realRate.filter((_, i) => i % 2 === 0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.realRate.length / 2 / 8)} />
                <YAxis tick={{ fontSize: 10 }} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <ReferenceLine y={2} stroke="#d29922" strokeDasharray="3 3" label={{ value: '2% target', fill: '#d29922', fontSize: 9 }} />
                <ReferenceLine y={0} stroke="#4d6a96" />
                <Line type="monotone" dataKey="nominal" name="Fed Funds %" stroke="#c770f0" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="inflation" name="CPI Inflation %" stroke="#f85149" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Real Fed Funds Rate" subtitle="Nominal rate minus CPI inflation"
          loading={loading} error={error} onRetry={load} height={280}>
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.realRate.filter((_, i) => i % 2 === 0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.realRate.length / 2 / 8)} />
                <YAxis tick={{ fontSize: 10 }} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="#d29922" strokeDasharray="4 4" label={{ value: 'Neutral', fill: '#d29922', fontSize: 10 }} />
                <Area type="monotone" dataKey="value" name="Real Rate %"
                  fill="rgba(199,112,240,0.15)" stroke="#c770f0" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Unemployment Rate" subtitle="U-3 Unemployment % — UNRATE"
          loading={loading} error={error} onRetry={load} height={240}>
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.unrate} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.unrate.length / 8)} />
                <YAxis tick={{ fontSize: 10 }} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name="Unemployment %"
                  fill="rgba(88,166,255,0.15)" stroke="#58a6ff" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="10-Year Breakeven Inflation" subtitle="T10YIE — market-implied inflation expectations"
          loading={loading} error={error} onRetry={load} height={240}>
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.t10yie} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.t10yie.length / 8)} />
                <YAxis tick={{ fontSize: 10 }} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={2} stroke="#d29922" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="value" name="10yr Breakeven %"
                  stroke="#3fb950" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
