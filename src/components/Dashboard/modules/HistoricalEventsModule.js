import React, { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, Area, Line, ReferenceLine,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { fetchMultipleFredSeries } from '../api/fredApi';
import { fetchBitcoinPrice } from '../api/coinGeckoApi';
import { normalizeBase100 } from '../utils/statistics';
import ChartCard from '../components/ChartCard';
import LoadingSpinner from '../components/LoadingSpinner';

// Hardcoded historical events with factual dates
const EVENTS = [
  { date: '2000-03-10', label: 'Dotcom Peak', category: 'Crisis', color: '#f85149', description: 'NASDAQ peaks at 5,048. Dotcom bubble begins to burst.' },
  { date: '2001-09-11', label: '9/11 Attacks', category: 'Geopolitical', color: '#e8734a', description: 'Markets close for 4 days. S&P500 falls 11.6% on reopening.' },
  { date: '2004-06-30', label: 'Fed Rate Hike Cycle', category: 'Monetary', color: '#d29922', description: 'Fed begins tightening cycle from 1% to 5.25% over 2 years.' },
  { date: '2007-10-09', label: 'Pre-GFC Peak', category: 'Markets', color: '#8b949e', description: 'S&P500 reaches all-time high of 1,565 before the GFC.' },
  { date: '2008-09-15', label: 'Lehman Collapse', category: 'Crisis', color: '#f85149', description: 'Lehman Brothers files for bankruptcy. Global financial crisis deepens.' },
  { date: '2008-11-25', label: 'QE1 Begins', category: 'Monetary', color: '#c770f0', description: 'Fed launches first round of quantitative easing ($600B).' },
  { date: '2010-11-03', label: 'QE2 Begins', category: 'Monetary', color: '#c770f0', description: 'Fed announces second QE round ($600B in Treasuries).' },
  { date: '2011-07-01', label: 'Euro Debt Crisis', category: 'Crisis', color: '#f85149', description: 'European sovereign debt crisis escalates. Greece near default.' },
  { date: '2012-09-13', label: 'QE3 Begins', category: 'Monetary', color: '#c770f0', description: 'Open-ended QE at $85B/month. "QE Infinity".' },
  { date: '2012-11-28', label: 'Bitcoin Halving 1', category: 'Bitcoin', color: '#f7931a', description: 'First Bitcoin halving. Block reward: 50→25 BTC.' },
  { date: '2013-12-18', label: 'Taper Announcement', category: 'Monetary', color: '#d29922', description: 'Fed announces tapering of QE3. "Taper Tantrum" begins.' },
  { date: '2015-12-16', label: 'First Rate Hike Post-GFC', category: 'Monetary', color: '#d29922', description: 'Fed raises rates for first time since 2006.' },
  { date: '2016-07-09', label: 'Bitcoin Halving 2', category: 'Bitcoin', color: '#f7931a', description: 'Second Bitcoin halving. Block reward: 25→12.5 BTC.' },
  { date: '2017-11-30', label: 'Bitcoin ATH (2017)', category: 'Bitcoin', color: '#f7931a', description: 'Bitcoin reaches ~$19,783 amid retail speculation frenzy.' },
  { date: '2018-12-24', label: 'Fed Pivot Signal', category: 'Monetary', color: '#c770f0', description: 'Markets crash. Fed signals pause in rate hikes.' },
  { date: '2020-02-19', label: 'COVID Market Peak', category: 'Crisis', color: '#f85149', description: 'S&P500 peaks before COVID crash (-34% in 33 days).' },
  { date: '2020-03-23', label: 'COVID Bottom', category: 'Crisis', color: '#3fb950', description: 'S&P500 bottoms. Fed launches unlimited QE.' },
  { date: '2020-05-11', label: 'Bitcoin Halving 3', category: 'Bitcoin', color: '#f7931a', description: 'Third Bitcoin halving. Block reward: 12.5→6.25 BTC.' },
  { date: '2021-11-10', label: 'Bitcoin ATH 2021', category: 'Bitcoin', color: '#f7931a', description: 'Bitcoin reaches ATH of ~$69,000.' },
  { date: '2022-01-04', label: 'Fed Pivot to Tightening', category: 'Monetary', color: '#d29922', description: 'FOMC minutes reveal hawkish pivot. Markets begin repricing.' },
  { date: '2022-03-16', label: 'Rate Hike Cycle 2022', category: 'Monetary', color: '#d29922', description: 'Fed begins fastest rate hike cycle since 1980s.' },
  { date: '2022-06-13', label: 'Crypto Winter Bottom', category: 'Bitcoin', color: '#f85149', description: 'Bitcoin falls below $20K. Luna/UST collapse triggers contagion.' },
  { date: '2023-03-10', label: 'SVB Collapse', category: 'Crisis', color: '#f85149', description: 'Silicon Valley Bank collapses. Second largest US bank failure.' },
  { date: '2024-01-10', label: 'Bitcoin ETF Approval', category: 'Bitcoin', color: '#3fb950', description: 'SEC approves spot Bitcoin ETFs. Historic institutional access.' },
  { date: '2024-04-19', label: 'Bitcoin Halving 4', category: 'Bitcoin', color: '#f7931a', description: 'Fourth Bitcoin halving. Block reward: 6.25→3.125 BTC.' },
];

const CATEGORIES = ['All', 'Crisis', 'Monetary', 'Bitcoin', 'Geopolitical', 'Markets'];

function formatTick(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
}

export default function HistoricalEventsModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedEvent, setSelectedEvent] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fredData, btcPrices] = await Promise.all([
        fetchMultipleFredSeries(['SP500', 'VIXCLS', 'WALCL', 'WTREGEN', 'RRPONTSYD'], '2015-01-01'),
        fetchBitcoinPrice(365),
      ]);

      const sp500 = fredData['SP500'] || [];
      const vix = fredData['VIXCLS'] || [];
      const walcl = fredData['WALCL'] || [];
      const wtregen = fredData['WTREGEN'] || [];
      const rrpon = fredData['RRPONTSYD'] || [];
      const btc = btcPrices.map(d => ({ date: d.date, value: d.price }));

      const rrMap = new Map(rrpon.map(d => [d.date, d.value * 1000]));
      const tgaMap = new Map(wtregen.map(d => [d.date, d.value]));
      const netLiq = walcl.filter(d => tgaMap.has(d.date)).map(d => ({
        date: d.date,
        value: d.value - (tgaMap.get(d.date) || 0) - (rrMap.get(d.date) || 0),
      }));

      const normSp = normalizeBase100(sp500.filter((_, i) => i % 5 === 0));
      const normBtc = normalizeBase100(btc.filter((_, i) => i % 5 === 0));
      const normLiq = normalizeBase100(netLiq.filter((_, i) => i % 5 === 0));

      const btcMap = new Map(normBtc.map(d => [d.date, d.value]));
      const liqMap = new Map(normLiq.map(d => [d.date, d.value]));
      const vixMap = new Map(vix.map(d => [d.date, d.value]));

      const combined = normSp.map(d => ({
        date: d.date,
        SP500: d.value,
        BTC: btcMap.get(d.date),
        Liquidity: liqMap.get(d.date),
        VIX: vixMap.get(d.date),
      }));

      setData({ combined });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredEvents = EVENTS.filter(e => selectedCategory === 'All' || e.category === selectedCategory);

  // Only show events in chart date range
  const chartEvents = data?.combined?.length ? filteredEvents.filter(e => {
    const first = data.combined[0].date;
    const last = data.combined[data.combined.length - 1].date;
    return e.date >= first && e.date <= last;
  }) : [];

  return (
    <div>
      <div className="db-section-title">Historical Events</div>
      <p style={{ color: '#8b949e', fontSize: '12px', marginBottom: '16px' }}>
        Key macro and crypto events overlaid on market data.
      </p>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              background: selectedCategory === cat ? '#c770f0' : 'transparent',
              border: '1px solid ' + (selectedCategory === cat ? '#c770f0' : '#1a2744'),
              color: selectedCategory === cat ? 'white' : '#8b949e',
              borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '11px',
            }}
          >{cat}</button>
        ))}
      </div>

      {loading && <LoadingSpinner />}
      {error && (
        <div style={{ color: '#f85149', padding: '20px', textAlign: 'center' }}>
          {error.message}
          <button onClick={load} style={{ marginLeft: '12px', background: '#c770f0', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px' }}>Retry</button>
        </div>
      )}

      {data && (
        <>
          <ChartCard title="SP500, BTC, Fed Liquidity (Base 100) + Events" subtitle="Normalized since 2015 with event overlays"
            height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.combined} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 10 }} interval={Math.floor(data.combined.length / 8)} />
                <YAxis tick={{ fontSize: 10 }} width={55} />
                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2744', fontSize: '11px' }} formatter={(v) => v ? v.toFixed(1) : 'N/A'} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {chartEvents.slice(0, 15).map(e => (
                  <ReferenceLine key={e.date} x={e.date} stroke={e.color} strokeDasharray="3 3" strokeOpacity={0.7}
                    label={{ value: e.label.split(' ')[0], fill: e.color, fontSize: 8, position: 'insideTopRight' }} />
                ))}
                <Area type="monotone" dataKey="Liquidity" name="Fed Liquidity" fill="rgba(199,112,240,0.08)" stroke="#c770f0" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="SP500" name="SP500" stroke="#3fb950" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="BTC" name="Bitcoin" stroke="#f7931a" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Event list */}
          <div style={{ marginTop: '24px' }}>
            <div className="db-section-title">Event Timeline ({filteredEvents.length} events)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredEvents.map(e => (
                <div
                  key={e.date}
                  onClick={() => setSelectedEvent(selectedEvent?.date === e.date ? null : e)}
                  style={{
                    background: selectedEvent?.date === e.date ? '#0d1421' : 'transparent',
                    border: '1px solid ' + (selectedEvent?.date === e.date ? e.color : '#1a2744'),
                    borderRadius: '8px',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'grid',
                    gridTemplateColumns: '100px auto 80px',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ color: '#8b949e', fontSize: '11px', fontFamily: 'monospace' }}>{e.date}</div>
                  <div>
                    <div style={{ color: e.color, fontSize: '12px', fontWeight: 600 }}>{e.label}</div>
                    {selectedEvent?.date === e.date && (
                      <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '4px' }}>{e.description}</div>
                    )}
                  </div>
                  <div>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '9px',
                      background: e.color + '20', color: e.color, border: '1px solid ' + e.color + '40',
                    }}>{e.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
