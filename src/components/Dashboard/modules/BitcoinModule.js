import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, ComposedChart, Area, BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { fetchBitcoinPrice, fetchBitcoinInfo, fetchGlobalData } from '../api/coinGeckoApi';
import { calculateMA, calculateZScore, calculateBollingerBands } from '../utils/statistics';
import { formatNumber, formatPercent, formatCurrency, getChangeColor } from '../utils/formatters';
import MetricCard from '../components/MetricCard';
import ChartCard from '../components/ChartCard';

function formatTick(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2744', borderRadius: '6px', padding: '10px 14px', fontSize: '11px' }}>
      <div style={{ color: '#8b949e', marginBottom: '6px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: '2px' }}>
          {p.name}: {typeof p.value === 'number' ? '$' + formatNumber(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

// Bitcoin halvings
const HALVINGS = [
  { date: '2012-11-28', label: 'Halving 1' },
  { date: '2016-07-09', label: 'Halving 2' },
  { date: '2020-05-11', label: 'Halving 3' },
  { date: '2024-04-19', label: 'Halving 4' },
];

export default function BitcoinModule() {
  const [priceData, setPriceData] = useState(null);
  const [info, setInfo] = useState(null);
  const [globalData, setGlobalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(365);
  const [logScale, setLogScale] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prices, btcInfo, global] = await Promise.all([
        fetchBitcoinPrice(days),
        fetchBitcoinInfo(),
        fetchGlobalData(),
      ]);

      // Build price series for stats
      const priceSeries = prices.map(d => ({ date: d.date, value: d.price }));
      const ma20 = calculateMA(priceSeries, 20);
      const ma50 = calculateMA(priceSeries, 50);
      const bb = calculateBollingerBands(priceSeries, 20, 2);

      const ma20Map = new Map(ma20.map(d => [d.date, d.value]));
      const ma50Map = new Map(ma50.map(d => [d.date, d.value]));
      const bbMap = new Map(bb.map(d => [d.date, { upper: d.upper, lower: d.lower }]));

      const enriched = prices.map(d => ({
        ...d,
        ma20: ma20Map.get(d.date) || null,
        ma50: ma50Map.get(d.date) || null,
        bbUpper: bbMap.get(d.date)?.upper || null,
        bbLower: bbMap.get(d.date)?.lower || null,
      }));

      // Volume in billions
      const volData = prices.map(d => ({ date: d.date, value: d.volume / 1e9 }));

      setPriceData({ enriched, volData, priceSeries });
      setInfo(btcInfo);
      setGlobalData(global);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const DayButton = ({ d, label }) => (
    <button
      onClick={() => setDays(d)}
      style={{
        background: days === d ? '#c770f0' : 'transparent',
        border: '1px solid ' + (days === d ? '#c770f0' : '#1a2744'),
        color: days === d ? 'white' : '#8b949e',
        borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px',
      }}
    >{label}</button>
  );

  const priceActions = (
    <div style={{ display: 'flex', gap: '4px' }}>
      <DayButton d={90} label="90d" />
      <DayButton d={180} label="180d" />
      <DayButton d={365} label="1Y" />
      <button
        onClick={() => setLogScale(l => !l)}
        style={{ background: logScale ? '#c770f0' : 'transparent', border: '1px solid #c770f0', color: logScale ? 'white' : '#c770f0', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px' }}
      >LOG</button>
    </div>
  );

  const visibleHalvings = HALVINGS.filter(h => {
    if (!priceData?.enriched?.length) return false;
    const first = priceData.enriched[0].date;
    return h.date >= first;
  });

  return (
    <div>
      <div className="db-section-title">Bitcoin</div>

      <div className="db-metrics-grid">
        <MetricCard title="BTC Price" value={info ? '$' + formatNumber(info.price) : 'N/A'}
          loading={loading} error={error}
          change={info?.change24h} changeLabel="24h"
          sparklineData={priceData?.priceSeries?.slice(-30)} />
        <MetricCard title="Market Cap" value={info ? formatCurrency(info.marketCap) : 'N/A'}
          loading={loading} error={error} />
        <MetricCard title="24h Volume" value={info ? formatCurrency(info.volume) : 'N/A'}
          loading={loading} error={error} />
        <MetricCard title="BTC Dominance" value={globalData ? globalData.btcDominance.toFixed(1) + '%' : 'N/A'}
          loading={loading} error={error}
          subtitle="Share of total crypto market cap" />
        <MetricCard title="7d Change" value={info ? formatPercent(info.change7d) : 'N/A'}
          loading={loading} error={error} subtitle="Weekly performance" />
        <MetricCard title="30d Change" value={info ? formatPercent(info.change30d) : 'N/A'}
          loading={loading} error={error} subtitle="Monthly performance" />
        <MetricCard title="ETH Dominance" value={globalData ? globalData.ethDominance.toFixed(1) + '%' : 'N/A'}
          loading={loading} error={error} />
        <MetricCard title="ATH" value={info ? '$' + formatNumber(info.ath) : 'N/A'}
          loading={loading} error={error}
          subtitle={info?.athDate ? new Date(info.athDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : ''} />
      </div>

      <div className="db-charts-grid">
        <ChartCard title="Bitcoin Price with Bollinger Bands" subtitle="Price, MA20, MA50, and 2σ bands"
          loading={loading} error={error} onRetry={load} height={300}
          actions={priceActions}>
          {priceData && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={priceData.enriched} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(priceData.enriched.length / 8)} />
                <YAxis scale={logScale ? 'log' : 'linear'} domain={['auto', 'auto']}
                  tickFormatter={v => '$' + formatNumber(v, 0)} tick={{ fontSize: 10 }} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {visibleHalvings.map(h => (
                  <ReferenceLine key={h.date} x={h.date} stroke="#d29922" strokeDasharray="3 3"
                    label={{ value: h.label, fill: '#d29922', fontSize: 9, position: 'insideTopRight' }} />
                ))}
                <Line type="monotone" dataKey="bbUpper" name="BB Upper" stroke="#4d6a96" strokeWidth={1} dot={false} connectNulls strokeDasharray="3 3" />
                <Line type="monotone" dataKey="bbLower" name="BB Lower" stroke="#4d6a96" strokeWidth={1} dot={false} connectNulls strokeDasharray="3 3" />
                <Line type="monotone" dataKey="price" name="BTC/USD" stroke="#f7931a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ma20" name="MA20" stroke="#c770f0" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="ma50" name="MA50" stroke="#3fb950" strokeWidth={1.5} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Trading Volume (Billion USD)" subtitle="Daily trading volume"
          loading={loading} error={error} onRetry={load} height={220}>
          {priceData && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priceData.volData.filter((_, i) => i % 3 === 0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(priceData.volData.length / 3 / 8)} />
                <YAxis tickFormatter={v => '$' + v.toFixed(0) + 'B'} tick={{ fontSize: 10 }} width={60} />
                <Tooltip formatter={(v) => '$' + v.toFixed(1) + 'B'} contentStyle={{ background: '#0d1421', border: '1px solid #1a2744', fontSize: '11px' }} />
                <Bar dataKey="value" name="Volume ($B)" fill="#c770f0" opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Market Cap History" subtitle="Bitcoin total market capitalization"
          loading={loading} error={error} onRetry={load} height={240}>
          {priceData && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={priceData.enriched.map(d => ({ date: d.date, value: d.marketCap / 1e9 }))}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(priceData.enriched.length / 8)} />
                <YAxis tickFormatter={v => '$' + v.toFixed(0) + 'B'} tick={{ fontSize: 10 }} width={70} />
                <Tooltip formatter={(v) => '$' + formatNumber(v) + 'B'} contentStyle={{ background: '#0d1421', border: '1px solid #1a2744', fontSize: '11px' }} />
                <Area type="monotone" dataKey="value" name="Market Cap ($B)"
                  fill="rgba(247,147,26,0.1)" stroke="#f7931a" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
