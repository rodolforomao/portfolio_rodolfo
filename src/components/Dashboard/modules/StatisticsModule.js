import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, ComposedChart, Area, Line,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { fetchMultipleFredSeries } from '../api/fredApi';
import { fetchBitcoinPrice } from '../api/coinGeckoApi';
import { calculateZScore, calculateStdDev } from '../utils/statistics';
import { formatNumber } from '../utils/formatters';
import ChartCard from '../components/ChartCard';
import LoadingSpinner from '../components/LoadingSpinner';

const FRED_SERIES = ['WALCL', 'WTREGEN', 'RRPONTSYD', 'SP500', 'VIXCLS', 'BAMLH0A0HYM2', 'T10Y2Y'];

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

function buildHistogram(data, bins = 20) {
  if (!data.length) return [];
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / bins;
  const histogram = Array.from({ length: bins }, (_, i) => ({
    binStart: min + i * binWidth,
    binEnd: min + (i + 1) * binWidth,
    count: 0,
    label: (min + i * binWidth).toFixed(1),
  }));
  values.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
    histogram[idx].count++;
  });
  return histogram;
}

function computeStats(data) {
  if (!data.length) return null;
  const values = data.map(d => d.value).sort((a, b) => a - b);
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
  const std = Math.sqrt(variance);
  const median = n % 2 === 0 ? (values[n / 2 - 1] + values[n / 2]) / 2 : values[Math.floor(n / 2)];
  const p25 = values[Math.floor(n * 0.25)];
  const p75 = values[Math.floor(n * 0.75)];
  const p5 = values[Math.floor(n * 0.05)];
  const p95 = values[Math.floor(n * 0.95)];
  const latest = data[data.length - 1].value;
  const percentile = (values.filter(v => v <= latest).length / n) * 100;
  const zScore = (latest - mean) / std;
  return { mean, std, median, p25, p75, p5, p95, latest, percentile, zScore, n };
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2744', borderRadius: '6px', padding: '10px 14px', fontSize: '11px' }}>
      <div style={{ color: '#8b949e', marginBottom: '6px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || '#c9d1d9', marginBottom: '2px' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(3) : p.value}
        </div>
      ))}
    </div>
  );
}

function StatBox({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '10px 14px', background: '#0a0e1a', borderRadius: '6px', border: '1px solid #1a2744' }}>
      <div style={{ color: '#8b949e', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ color: highlight || '#e6edf3', fontWeight: 600, fontSize: '14px', fontFamily: 'monospace' }}>{value}</div>
    </div>
  );
}

export default function StatisticsModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSeries, setSelectedSeries] = useState('netLiq');

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
      const vix = fredData['VIXCLS'] || [];
      const hySpread = fredData['BAMLH0A0HYM2'] || [];
      const yieldCurve = fredData['T10Y2Y'] || [];
      const btc = btcPrices.map(d => ({ date: d.date, value: d.price }));

      const series = { netLiq, sp500, vix, hySpread, yieldCurve, btc };

      // Precompute z-scores
      const zscore = {};
      Object.entries(series).forEach(([key, s]) => {
        zscore[key] = calculateZScore(s, Math.min(252, s.length - 1));
      });

      // Precompute std dev (rolling 20)
      const stdDev = {};
      Object.entries(series).forEach(([key, s]) => {
        stdDev[key] = calculateStdDev(s, 20);
      });

      // Precompute stats
      const stats = {};
      Object.entries(series).forEach(([key, s]) => {
        stats[key] = computeStats(s);
      });

      // Histograms
      const histograms = {};
      Object.entries(series).forEach(([key, s]) => {
        histograms[key] = buildHistogram(s, 25);
      });

      setData({ series, zscore, stdDev, stats, histograms });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const SERIES_LABELS = {
    netLiq: 'Fed Net Liquidity',
    sp500: 'S&P 500',
    vix: 'VIX',
    hySpread: 'HY Credit Spread',
    yieldCurve: '10Y-2Y Yield Curve',
    btc: 'Bitcoin Price',
  };

  const currentStats = data?.stats?.[selectedSeries];
  const currentZscores = data?.zscore?.[selectedSeries] || [];
  const currentStdDev = data?.stdDev?.[selectedSeries] || [];
  const currentHistogram = data?.histograms?.[selectedSeries] || [];
  const currentSeries = data?.series?.[selectedSeries] || [];

  return (
    <div>
      <div className="db-section-title">Statistical Analysis</div>

      {/* Series selector */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {Object.entries(SERIES_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelectedSeries(key)}
            style={{
              background: selectedSeries === key ? '#c770f0' : 'transparent',
              border: '1px solid ' + (selectedSeries === key ? '#c770f0' : '#1a2744'),
              color: selectedSeries === key ? 'white' : '#8b949e',
              borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px',
            }}
          >{label}</button>
        ))}
      </div>

      {loading && <LoadingSpinner />}
      {error && (
        <div style={{ color: '#f85149', padding: '20px', textAlign: 'center' }}>
          {error.message}
          <button onClick={load} style={{ marginLeft: '12px', background: '#c770f0', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px' }}>Retry</button>
        </div>
      )}

      {data && currentStats && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <div className="db-section-title" style={{ fontSize: '11px' }}>{SERIES_LABELS[selectedSeries]} — Summary Statistics</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
              <StatBox label="Latest Value" value={formatNumber(currentStats.latest)} />
              <StatBox label="Mean" value={formatNumber(currentStats.mean)} />
              <StatBox label="Std Dev" value={formatNumber(currentStats.std)} />
              <StatBox label="Median" value={formatNumber(currentStats.median)} />
              <StatBox label="Percentile" value={currentStats.percentile.toFixed(1) + '%'}
                highlight={currentStats.percentile > 90 ? '#f85149' : currentStats.percentile > 70 ? '#d29922' : '#3fb950'} />
              <StatBox label="Z-Score (1yr)" value={currentStats.zScore.toFixed(3)}
                highlight={Math.abs(currentStats.zScore) > 2 ? '#f85149' : '#e6edf3'} />
              <StatBox label="5th Percentile" value={formatNumber(currentStats.p5)} />
              <StatBox label="25th Percentile" value={formatNumber(currentStats.p25)} />
              <StatBox label="75th Percentile" value={formatNumber(currentStats.p75)} />
              <StatBox label="95th Percentile" value={formatNumber(currentStats.p95)} />
              <StatBox label="Data Points" value={currentStats.n.toLocaleString()} />
            </div>
          </div>

          <div className="db-charts-grid">
            <ChartCard title={`${SERIES_LABELS[selectedSeries]} — Z-Score (252-day)`}
              subtitle="Standard deviations from 1-year rolling mean"
              height={260}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={currentZscores.filter((_, i) => i % 3 === 0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                  <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(currentZscores.length / 3 / 8)} />
                  <YAxis tick={{ fontSize: 10 }} width={40} domain={[-4, 4]} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={2} stroke="#f85149" strokeDasharray="3 3" label={{ value: '+2σ', fill: '#f85149', fontSize: 9 }} />
                  <ReferenceLine y={-2} stroke="#3fb950" strokeDasharray="3 3" label={{ value: '-2σ', fill: '#3fb950', fontSize: 9 }} />
                  <ReferenceLine y={0} stroke="#4d6a96" />
                  <Area type="monotone" dataKey="value" name="Z-Score"
                    fill="rgba(199,112,240,0.1)" stroke="#c770f0" strokeWidth={1.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={`${SERIES_LABELS[selectedSeries]} — Distribution`}
              subtitle="Historical value frequency distribution"
              height={260}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentHistogram} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={Math.floor(currentHistogram.length / 8)} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip formatter={(v, n) => [v, 'Frequency']} contentStyle={{ background: '#0d1421', border: '1px solid #1a2744', fontSize: '11px' }} />
                  <Bar dataKey="count" name="Frequency" radius={1}>
                    {currentHistogram.map((entry, index) => {
                      const binMid = (entry.binStart + entry.binEnd) / 2;
                      const isLatest = currentStats && binMid >= currentStats.p25 && binMid <= currentStats.p75;
                      return <Cell key={index} fill={isLatest ? '#c770f0' : '#4d6a96'} opacity={0.8} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={`${SERIES_LABELS[selectedSeries]} — Rolling 20-Period Std Dev`}
              subtitle="Volatility of the series over time"
              height={240}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={currentStdDev.filter((_, i) => i % 3 === 0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                  <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(currentStdDev.length / 3 / 8)} />
                  <YAxis tick={{ fontSize: 10 }} width={60} tickFormatter={v => formatNumber(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="value" name="Std Dev"
                    fill="rgba(88,166,255,0.1)" stroke="#58a6ff" strokeWidth={1.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={`${SERIES_LABELS[selectedSeries]} — Raw Series`}
              subtitle="Full historical data"
              height={240}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={currentSeries.filter((_, i) => i % Math.max(1, Math.floor(currentSeries.length / 300)) === 0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                  <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(Math.min(currentSeries.length, 300) / 8)} />
                  <YAxis tick={{ fontSize: 10 }} width={60} tickFormatter={v => formatNumber(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="value" name={SERIES_LABELS[selectedSeries]}
                    stroke="#c770f0" strokeWidth={1.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
