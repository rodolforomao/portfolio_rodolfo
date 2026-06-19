import React, { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, ScatterChart, Scatter, Line,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { fetchMultipleFredSeries } from '../api/fredApi';
import { fetchBitcoinPrice } from '../api/coinGeckoApi';
import { calculateCorrelation, calculateRollingCorrelation } from '../utils/statistics';
import { formatNumber } from '../utils/formatters';
import MetricCard from '../components/MetricCard';
import ChartCard from '../components/ChartCard';

// GOLDAMGBD228NLBM foi descontinuada pelo FRED em 2019 — sem dados pós-2019
// Usamos Oil (DCOILWTICO) que é ativa e relevante como ativo macro
const FRED_SERIES = ['WALCL', 'WTREGEN', 'RRPONTSYD', 'SP500', 'DCOILWTICO', 'DTWEXBGS'];

function formatTick(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
}

function cellColor(v) {
  if (v == null) return '#4d6a96';
  if (v > 0.7)  return '#3fb950';
  if (v > 0.3)  return '#6bc275';
  if (v > -0.3) return '#d29922';
  if (v > -0.7) return '#e8734a';
  return '#f85149';
}

function Tooltip2({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2744', borderRadius: 6, padding: '10px 14px', fontSize: 11 }}>
      <div style={{ color: '#8b949e', marginBottom: 6 }}>{label}</div>
      {payload.filter(p => p.value != null).map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(3) : p.value}
        </div>
      ))}
    </div>
  );
}

function calcNetLiq(walcl, wtregen, rrpon) {
  const rrMap  = new Map(rrpon.map(d => [d.date, d.value * 1000]));
  const tgaMap = new Map(wtregen.map(d => [d.date, d.value]));
  return walcl
    .filter(d => tgaMap.has(d.date))
    .map(d => ({ date: d.date, value: d.value - (tgaMap.get(d.date) || 0) - (rrMap.get(d.date) || 0) }));
}

// Restrict series to last N calendar days
function lastN(series, n) {
  if (!series.length) return series;
  const cut = new Date(); cut.setDate(cut.getDate() - n);
  const cutStr = cut.toISOString().slice(0, 10);
  return series.filter(d => d.date >= cutStr);
}

// Forward-fill a daily series onto weekly target dates (binary search)
function resampleToWeekly(weeklyDates, dailySeries) {
  if (!dailySeries.length) return [];
  const sorted = [...dailySeries].sort((a, b) => a.date.localeCompare(b.date));
  return weeklyDates.map(w => {
    // binary search: latest date <= w.date
    let lo = 0, hi = sorted.length - 1, best = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid].date <= w.date) { best = sorted[mid]; lo = mid + 1; }
      else hi = mid - 1;
    }
    return best ? { date: w.date, value: best.value } : null;
  }).filter(Boolean);
}

export default function CorrelationModule() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [winDays, setWinDays] = useState(180);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [fredData, btcPrices] = await Promise.all([
        fetchMultipleFredSeries(FRED_SERIES, '2016-01-01'),
        fetchBitcoinPrice(365),
      ]);

      // Raw series
      const netLiq = calcNetLiq(fredData['WALCL'] || [], fredData['WTREGEN'] || [], fredData['RRPONTSYD'] || []);
      const sp500  = fredData['SP500']       || [];
      const oil    = fredData['DCOILWTICO']  || [];
      const dxy    = fredData['DTWEXBGS']    || [];
      const btc    = btcPrices.map(d => ({ date: d.date, value: d.price }));

      // ── Restrict EVERYTHING to last 365 days for consistent time period ──
      const netLiqR = lastN(netLiq, 365); // weekly, ~52 pts
      const sp500R  = lastN(sp500,  365); // daily,  ~250 pts
      const oilR    = lastN(oil,    365); // daily,  ~250 pts
      const dxyR    = lastN(dxy,    365); // daily,  ~250 pts
      const btcR    = btc;               // daily,  ~365 pts (already 365d)

      // ── Static correlation matrix — same 365-day window for all pairs ──
      const matrixSeries = {
        'Net Liquidity': netLiqR,
        'SP500':         sp500R,
        'Bitcoin':       btcR,
        'Oil':           oilR,
        'DXY':           dxyR,
      };
      const names  = Object.keys(matrixSeries);
      const matrix = names.map(n1 => ({
        name: n1,
        ...Object.fromEntries(names.map(n2 => [n2, calculateCorrelation(matrixSeries[n1], matrixSeries[n2])])),
      }));

      // ── Rolling correlations ─────────────────────────────────────────────
      // Net Liquidity is WEEKLY → resample daily series to the SAME weekly dates
      // This ensures all three rolling series have identical date ranges
      const btcW  = resampleToWeekly(netLiqR, btcR);   // ~52 pts on weekly dates
      const sp5W  = resampleToWeekly(netLiqR, sp500R); // ~52 pts on weekly dates

      // Convert calendar-day window → number of weekly data points
      const wkWin = Math.max(4, Math.floor(winDays / 7));

      const rollLB = calculateRollingCorrelation(netLiqR, btcW,  wkWin);
      const rollLS = calculateRollingCorrelation(netLiqR, sp5W,  wkWin);
      const rollBS = calculateRollingCorrelation(btcW,    sp5W,  wkWin);

      // ── CRITICAL: merge into a SINGLE dataset for recharts ───────────────
      // Using separate `data` props per <Line> causes horizontal artifacts
      // when the series have different date ranges.
      const mapLB = new Map(rollLB.map(d => [d.date, d.value]));
      const mapLS = new Map(rollLS.map(d => [d.date, d.value]));
      const mapBS = new Map(rollBS.map(d => [d.date, d.value]));
      const allDates = [...new Set([...rollLB, ...rollLS, ...rollBS].map(d => d.date))].sort();
      const rollingData = allDates.map(date => ({
        date,
        liqBtc: mapLB.get(date) ?? null,
        liqSp5: mapLS.get(date) ?? null,
        btcSp5: mapBS.get(date) ?? null,
      }));

      // ── Scatter: Net Liq (weekly) vs BTC price ───────────────────────────
      const btcWMap = new Map(btcW.map(d => [d.date, d.value]));
      const scatterData = netLiqR
        .map(w => btcWMap.has(w.date) ? { x: w.value / 1e6, y: btcWMap.get(w.date) } : null)
        .filter(Boolean);

      setData({ matrix, names, rollingData, scatterData, wkWin });
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [winDays]);

  useEffect(() => { load(); }, [load]);

  const WinBtn = ({ d, label }) => (
    <button onClick={() => setWinDays(d)} style={{
      background: winDays === d ? '#c770f0' : 'transparent',
      border: `1px solid ${winDays === d ? '#c770f0' : '#1a2744'}`,
      color: winDays === d ? 'white' : '#8b949e',
      borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 10,
    }}>{label}</button>
  );

  const lastRoll = data?.rollingData?.[data.rollingData.length - 1];
  const liqBtcCorr = lastRoll?.liqBtc ?? null;
  const liqSpCorr  = lastRoll?.liqSp5 ?? null;

  // Scatter X domain: zoom into actual data range, not starting at 0
  const scatterXMin = data?.scatterData?.length ? Math.min(...data.scatterData.map(d => d.x)) - 0.3 : 0;
  const scatterXMax = data?.scatterData?.length ? Math.max(...data.scatterData.map(d => d.x)) + 0.3 : 8;

  return (
    <div>
      <div className="db-section-title">Correlation Analysis</div>
      <div style={{ fontSize: 11, color: '#4d6a96', marginBottom: 12 }}>
        Todos os cálculos usam os últimos 365 dias — mesmo período para todos os pares. Rolling: Net Liquidity semanal (WALCL freq).
      </div>

      <div className="db-metrics-grid">
        <MetricCard title="Liquidity ↔ BTC (rolling)" loading={loading} error={error}
          value={liqBtcCorr != null ? liqBtcCorr.toFixed(3) : 'N/A'}
          subtitle={`${winDays}d (~${data?.wkWin ?? '—'}wk window)`} />
        <MetricCard title="Liquidity ↔ SP500 (rolling)" loading={loading} error={error}
          value={liqSpCorr != null ? liqSpCorr.toFixed(3) : 'N/A'}
          subtitle={`${winDays}d (~${data?.wkWin ?? '—'}wk window)`} />
      </div>

      <div className="db-charts-grid">

        {/* ── Correlation Matrix ── */}
        <ChartCard title="Correlation Matrix (últimos 365 dias)"
          subtitle="Mesmo período para todos os pares — Gold descontinuada no FRED, substituída por Oil"
          loading={loading} error={error} onRetry={load} height={260}>
          {data && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 10px', color: '#8b949e', textAlign: 'left', borderBottom: '1px solid #1a2744' }} />
                    {data.names.map(n => (
                      <th key={n} style={{ padding: '6px 10px', color: '#c770f0', textAlign: 'center', borderBottom: '1px solid #1a2744', minWidth: 95 }}>{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.matrix.map(row => (
                    <tr key={row.name}>
                      <td style={{ padding: '6px 10px', color: '#e6edf3', fontWeight: 600, borderBottom: '1px solid #1a2744', whiteSpace: 'nowrap' }}>{row.name}</td>
                      {data.names.map(n => {
                        const v = row[n];
                        const isdiag = n === row.name;
                        return (
                          <td key={n} style={{
                            padding: '6px 10px', textAlign: 'center', borderBottom: '1px solid #1a2744',
                            color: isdiag ? '#e6edf3' : cellColor(v),
                            fontWeight: isdiag ? 700 : 400,
                            background: (!isdiag && v != null)
                              ? `rgba(${v > 0 ? '63,185,80' : '248,81,73'},${Math.abs(v) * 0.18})`
                              : 'transparent',
                          }}>
                            {v != null ? v.toFixed(3) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        {/* ── Rolling Correlation — SINGLE merged dataset ── */}
        <ChartCard
          title="Rolling Correlation: Liquidity vs BTC & SP500"
          subtitle="Net Liquidity semanal resampled — dataset único para evitar artefatos"
          loading={loading} error={error} onRetry={load} height={300}
          actions={
            <div style={{ display: 'flex', gap: 4 }}>
              <WinBtn d={90}  label="90d"  />
              <WinBtn d={180} label="180d" />
              <WinBtn d={365} label="365d" />
            </div>
          }
        >
          {data && data.rollingData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.rollingData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }}
                  interval={Math.floor(Math.max(1, data.rollingData.length / 8))} />
                <YAxis domain={[-1, 1]} tick={{ fontSize: 10 }} width={36} tickCount={9} />
                <Tooltip content={<Tooltip2 />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0}    stroke="#4d6a96" strokeWidth={1} />
                <ReferenceLine y={0.7}  stroke="#3fb950" strokeDasharray="3 3"
                  label={{ value: '+0.7', fill: '#3fb950', fontSize: 9, position: 'insideRight' }} />
                <ReferenceLine y={-0.7} stroke="#f85149" strokeDasharray="3 3"
                  label={{ value: '-0.7', fill: '#f85149', fontSize: 9, position: 'insideRight' }} />
                <Line type="monotone" dataKey="liqBtc" name="Liq↔BTC"   stroke="#f7931a" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="liqSp5" name="Liq↔SP500" stroke="#3fb950" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="btcSp5" name="BTC↔SP500" stroke="#c770f0" strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: '#8b949e', fontSize: 12, textAlign: 'center', padding: 40 }}>
              Dados insuficientes para a janela selecionada ({data?.wkWin} semanas). Tente uma janela menor.
            </div>
          )}
        </ChartCard>

        {/* ── Scatter ── */}
        <ChartCard title="Scatter: Net Liquidity vs Bitcoin Price"
          subtitle="Pontos semanais (WALCL freq) — últimos 365 dias"
          loading={loading} error={error} onRetry={load} height={300}>
          {data && data.scatterData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis type="number" dataKey="x" name="Net Liquidity"
                  tickFormatter={v => '$' + v.toFixed(1) + 'T'}
                  tick={{ fontSize: 10 }} domain={[scatterXMin, scatterXMax]} />
                <YAxis type="number" dataKey="y" name="BTC Price"
                  tickFormatter={v => '$' + formatNumber(v, 0)}
                  tick={{ fontSize: 10 }} width={72}
                  domain={['dataMin - 5000', 'dataMax + 5000']} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }}
                  formatter={(v, name) =>
                    name === 'Net Liquidity' ? '$' + Number(v).toFixed(2) + 'T' : '$' + formatNumber(v, 0)
                  }
                  contentStyle={{ background: '#0d1421', border: '1px solid #1a2744', fontSize: 11 }} />
                <Scatter data={data.scatterData} fill="#c770f0" opacity={0.8} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: '#8b949e', fontSize: 12, textAlign: 'center', padding: 40 }}>
              Sem dados alinhados suficientes.
            </div>
          )}
        </ChartCard>

      </div>
    </div>
  );
}
