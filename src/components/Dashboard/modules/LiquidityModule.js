import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, Area, ComposedChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { fetchMultipleFredSeries } from '../api/fredApi';
import { calculateMA, calculateDerivative, calculateSecondDerivative } from '../utils/statistics';
import { formatNumber, formatPercent } from '../utils/formatters';
import MetricCard from '../components/MetricCard';
import ChartCard from '../components/ChartCard';

const SERIES = ['WALCL', 'WTREGEN', 'RRPONTSYD'];

function forwardFill(targetDates, sourceSeries) {
  const map = new Map(sourceSeries.map(d => [d.date, d.value]));
  const sorted = [...map.keys()].sort();
  let last = 0;
  return targetDates.map(date => {
    if (map.has(date)) last = map.get(date);
    else {
      const prior = sorted.filter(d => d <= date).pop();
      if (prior) last = map.get(prior);
    }
    return { date, value: last };
  });
}

function calcNetLiquidity(walcl, wtregen, rrpon) {
  // RRP é diário (bilhões); WALCL/TGA são semanais (milhões) — forward-fill alinha datas
  const rrFilled = forwardFill(
    walcl.map(d => d.date),
    rrpon.map(d => ({ date: d.date, value: d.value * 1000 }))
  );
  const rrMap = new Map(rrFilled.map(d => [d.date, d.value]));
  const tgaMap = new Map(wtregen.map(d => [d.date, d.value]));
  return walcl
    .filter(d => tgaMap.has(d.date))
    .map(d => {
      const tga = tgaMap.get(d.date) || 0;
      const rr = rrMap.get(d.date) || 0;
      return { date: d.date, value: d.value - tga - rr };
    });
}

function pctChange(series, nPeriods) {
  if (series.length < nPeriods + 1) return null;
  const latest = series[series.length - 1].value;
  const prev = series[series.length - 1 - nPeriods].value;
  return ((latest - prev) / Math.abs(prev)) * 100;
}

function formatTickDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
}

function CustomTooltip({ active, payload, label, valueFormatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2744', borderRadius: '6px', padding: '10px 14px', fontSize: '11px' }}>
      <div style={{ color: '#8b949e', marginBottom: '6px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: '2px' }}>
          {p.name}: {valueFormatter ? valueFormatter(p.value) : formatNumber(p.value)}
        </div>
      ))}
    </div>
  );
}

export default function LiquidityModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logScale, setLogScale] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const series = await fetchMultipleFredSeries(SERIES, '2015-01-01');
      const walcl = series['WALCL'] || [];
      const wtregen = series['WTREGEN'] || [];
      const rrpon = series['RRPONTSYD'] || [];

      const netLiq = calcNetLiquidity(walcl, wtregen, rrpon);
      const maData = calculateMA(netLiq, 20);
      const maMap = new Map(maData.map(d => [d.date, d.value]));
      const netWithMA = netLiq.map(d => ({ ...d, ma20: maMap.get(d.date) || null }));

      const deriv1 = calculateDerivative(netLiq);
      const deriv2 = calculateSecondDerivative(netLiq);

      // Build components chart (downsample for perf)
      const step = Math.max(1, Math.floor(walcl.length / 200));
      const rrFilled = forwardFill(
        walcl.map(d => d.date),
        rrpon.map(d => ({ date: d.date, value: d.value * 1000 }))
      );
      const rrMap = new Map(rrFilled.map(d => [d.date, d.value]));
      const tgaMap = new Map(wtregen.map(d => [d.date, d.value]));
      const components = walcl.filter((_, i) => i % step === 0).map(d => ({
        date: d.date,
        WALCL: d.value,
        TGA: tgaMap.get(d.date) || null,
        RRP: rrMap.get(d.date) || null,
      }));

      setData({ netWithMA, deriv1, deriv2, components, walcl, netLiq });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const latest = data?.netLiq?.[data.netLiq.length - 1]?.value;
  const change7d = data?.netLiq ? pctChange(data.netLiq, 1) : null;
  const change30d = data?.netLiq ? pctChange(data.netLiq, 4) : null;
  const change90d = data?.netLiq ? pctChange(data.netLiq, 13) : null;
  const changeYoY = data?.netLiq ? pctChange(data.netLiq, 52) : null;

  const tickFormatter = (v) => v == null ? '' : '$' + formatNumber(v / 1e6) + 'T';

  return (
    <div>
      <div className="db-section-title">Fed Net Liquidity</div>

      <div className="db-metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        <MetricCard
          title="Net Liquidity"
          value={latest != null ? '$' + formatNumber(latest / 1e6) + 'T' : 'N/A'}
          loading={loading}
          error={error}
          subtitle="WALCL - TGA - RRP"
        />
        <MetricCard title="7d Change" value={change7d != null ? formatPercent(change7d) : 'N/A'}
          loading={loading} error={error}
          subtitle="Weekly"
          sparklineData={data?.netLiq?.slice(-8)}
        />
        <MetricCard title="30d Change" value={change30d != null ? formatPercent(change30d) : 'N/A'}
          loading={loading} error={error} subtitle="Monthly" />
        <MetricCard title="90d Change" value={change90d != null ? formatPercent(change90d) : 'N/A'}
          loading={loading} error={error} subtitle="Quarterly" />
        <MetricCard title="YoY Change" value={changeYoY != null ? formatPercent(changeYoY) : 'N/A'}
          loading={loading} error={error} subtitle="Year over Year" />
      </div>

      <div className="db-charts-grid">
        <ChartCard
          title="Fed Net Liquidity"
          subtitle="WALCL - TGA - RRP with 20-week MA"
          loading={loading}
          error={error}
          onRetry={load}
          height={280}
          actions={
            <button
              onClick={() => setLogScale(l => !l)}
              style={{ background: logScale ? '#c770f0' : 'transparent', border: '1px solid #c770f0', color: logScale ? 'white' : '#c770f0', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px' }}
            >
              LOG
            </button>
          }
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.netWithMA} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTickDate} tick={{ fontSize: 10 }} interval={Math.floor(data.netWithMA.length / 8)} />
                <YAxis scale={logScale ? 'log' : 'linear'} domain={['auto', 'auto']} tickFormatter={tickFormatter} tick={{ fontSize: 10 }} width={70} />
                <Tooltip content={<CustomTooltip valueFormatter={v => '$' + formatNumber(v / 1e6) + 'T'} />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="value" name="Net Liquidity" fill="rgba(199,112,240,0.15)" stroke="#c770f0" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="ma20" name="20-wk MA" stroke="#3fb950" strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Rate of Change (1st Derivative)"
          subtitle="Weekly change in Net Liquidity"
          loading={loading}
          error={error}
          onRetry={load}
          height={220}
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.deriv1.slice(-200)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTickDate} tick={{ fontSize: 10 }} interval={Math.floor(data.deriv1.slice(-200).length / 6)} />
                <YAxis tickFormatter={v => '$' + formatNumber(v / 1e6) + 'T'} tick={{ fontSize: 10 }} width={70} />
                <Tooltip content={<CustomTooltip valueFormatter={v => '$' + formatNumber(v / 1e6) + 'T'} />} />
                <ReferenceLine y={0} stroke="#4d6a96" strokeDasharray="4 4" />
                <Bar dataKey="value" name="Weekly Change" fill="#c770f0" opacity={0.7} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Acceleration (2nd Derivative)"
          subtitle="Change in rate-of-change — shows regime shifts"
          loading={loading}
          error={error}
          onRetry={load}
          height={220}
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.deriv2.slice(-200)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTickDate} tick={{ fontSize: 10 }} interval={Math.floor(data.deriv2.slice(-200).length / 6)} />
                <YAxis tickFormatter={v => formatNumber(v / 1e6)} tick={{ fontSize: 10 }} width={60} />
                <Tooltip content={<CustomTooltip valueFormatter={v => formatNumber(v / 1e6)} />} />
                <ReferenceLine y={0} stroke="#4d6a96" strokeDasharray="4 4" />
                <Bar dataKey="value" name="Acceleration" fill="#58a6ff" opacity={0.7} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Components: WALCL, TGA, RRP"
          subtitle="Individual Fed balance sheet components (millions USD)"
          loading={loading}
          error={error}
          onRetry={load}
          height={280}
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.components} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTickDate} tick={{ fontSize: 10 }} interval={Math.floor(data.components.length / 8)} />
                <YAxis tickFormatter={tickFormatter} tick={{ fontSize: 10 }} width={70} />
                <Tooltip content={<CustomTooltip valueFormatter={v => '$' + formatNumber(v / 1e6) + 'T'} />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="WALCL" name="Fed Balance Sheet" stroke="#c770f0" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="TGA" name="Treasury General Account" stroke="#f85149" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="RRP" name="Reverse Repo" stroke="#d29922" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
