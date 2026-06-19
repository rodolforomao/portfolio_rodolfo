import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, Bar, ComposedChart, Area,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { fetchMultipleFredSeries } from '../api/fredApi';
import MetricCard from '../components/MetricCard';
import ChartCard from '../components/ChartCard';

const SERIES = ['DGS1MO', 'TB3MS', 'DGS2', 'DGS5', 'DGS10', 'DGS30', 'T10Y2Y', 'T10Y3M'];

function formatTick(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
}

function getLatest(series) {
  return series && series.length ? series[series.length - 1].value : null;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2744', borderRadius: '6px', padding: '10px 14px', fontSize: '11px' }}>
      <div style={{ color: '#8b949e', marginBottom: '6px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: '2px' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(3) + '%' : p.value}
        </div>
      ))}
    </div>
  );
}

function buildCurrentCurve(series) {
  const maturities = [
    { label: '1M', key: 'DGS1MO' },
    { label: '3M', key: 'TB3MS' },
    { label: '2Y', key: 'DGS2' },
    { label: '5Y', key: 'DGS5' },
    { label: '10Y', key: 'DGS10' },
    { label: '30Y', key: 'DGS30' },
  ];
  return maturities.map(m => ({
    maturity: m.label,
    yield: getLatest(series[m.key]),
  })).filter(d => d.yield != null);
}

export default function YieldCurveModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const series = await fetchMultipleFredSeries(SERIES, '2015-01-01');
      const currentCurve = buildCurrentCurve(series);
      setData({ series, currentCurve });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const t10y2y = getLatest(data?.series?.['T10Y2Y']);
  const t10y3m = getLatest(data?.series?.['T10Y3M']);
  const dgs2 = getLatest(data?.series?.['DGS2']);
  const dgs10 = getLatest(data?.series?.['DGS10']);
  const dgs30 = getLatest(data?.series?.['DGS30']);

  return (
    <div>
      <div className="db-section-title">Yield Curve</div>

      <div className="db-metrics-grid">
        <MetricCard title="10Y-2Y Spread" value={t10y2y != null ? t10y2y.toFixed(2) + '%' : 'N/A'}
          loading={loading} error={error}
          subtitle={t10y2y != null ? (t10y2y < 0 ? 'INVERTED (recession signal)' : 'NORMAL') : ''}
          sparklineData={data?.series?.['T10Y2Y']?.slice(-60)} />
        <MetricCard title="10Y-3M Spread" value={t10y3m != null ? t10y3m.toFixed(2) + '%' : 'N/A'}
          loading={loading} error={error}
          subtitle={t10y3m != null ? (t10y3m < 0 ? 'INVERTED' : 'NORMAL') : ''}
          sparklineData={data?.series?.['T10Y3M']?.slice(-60)} />
        <MetricCard title="2Y Treasury" value={dgs2 != null ? dgs2.toFixed(2) + '%' : 'N/A'}
          loading={loading} error={error} subtitle="Short-end rate" />
        <MetricCard title="10Y Treasury" value={dgs10 != null ? dgs10.toFixed(2) + '%' : 'N/A'}
          loading={loading} error={error} subtitle="Benchmark rate" />
        <MetricCard title="30Y Treasury" value={dgs30 != null ? dgs30.toFixed(2) + '%' : 'N/A'}
          loading={loading} error={error} subtitle="Long-end rate" />
      </div>

      <div className="db-charts-grid">
        <ChartCard title="Current Yield Curve Shape" subtitle="Latest snapshot across all maturities"
          loading={loading} error={error} onRetry={load} height={260}>
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.currentCurve} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="maturity" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => v.toFixed(1) + '%'} tick={{ fontSize: 10 }} width={55} />
                <Tooltip formatter={(v) => v.toFixed(3) + '%'} contentStyle={{ background: '#0d1421', border: '1px solid #1a2744', fontSize: '11px' }} />
                <Area type="monotone" dataKey="yield" name="Yield %" fill="rgba(199,112,240,0.2)" stroke="#c770f0" strokeWidth={2} dot={{ fill: '#c770f0', r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="10Y-2Y Spread History" subtitle="T10Y2Y — inversion = recession risk"
          loading={loading} error={error} onRetry={load} height={260}>
          {data && data.series['T10Y2Y'] && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.series['T10Y2Y']} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.series['T10Y2Y'].length / 8)} />
                <YAxis tickFormatter={v => v.toFixed(1) + '%'} tick={{ fontSize: 10 }} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="#f85149" strokeDasharray="4 4" label={{ value: 'Inversion', fill: '#f85149', fontSize: 10 }} />
                <Bar dataKey="value" name="10Y-2Y Spread" radius={0}>
                  {data.series['T10Y2Y'].map((entry, index) => (
                    <Cell key={index} fill={entry.value < 0 ? '#f85149' : '#3fb950'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="10Y-3M Spread History" subtitle="T10Y3M — historically stronger recession predictor"
          loading={loading} error={error} onRetry={load} height={240}>
          {data && data.series['T10Y3M'] && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.series['T10Y3M']} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.series['T10Y3M'].length / 8)} />
                <YAxis tickFormatter={v => v.toFixed(1) + '%'} tick={{ fontSize: 10 }} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="#f85149" strokeDasharray="4 4" />
                <Bar dataKey="value" name="10Y-3M Spread" radius={0}>
                  {data.series['T10Y3M'].map((entry, index) => (
                    <Cell key={index} fill={entry.value < 0 ? '#f85149' : '#58a6ff'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Treasury Yields: 2Y, 10Y, 30Y" subtitle="Historical yield levels"
          loading={loading} error={error} onRetry={load} height={240}>
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" type="category" allowDuplicatedCategory={false}
                  tickFormatter={formatTick} tick={{ fontSize: 10 }}
                  data={data.series['DGS10']}
                  interval={Math.floor((data.series['DGS10']?.length || 1) / 8)} />
                <YAxis tickFormatter={v => v.toFixed(1) + '%'} tick={{ fontSize: 10 }} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line data={data.series['DGS2']} type="monotone" dataKey="value" name="2Y" stroke="#58a6ff" strokeWidth={1.5} dot={false} />
                <Line data={data.series['DGS10']} type="monotone" dataKey="value" name="10Y" stroke="#c770f0" strokeWidth={2} dot={false} />
                <Line data={data.series['DGS30']} type="monotone" dataKey="value" name="30Y" stroke="#3fb950" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
