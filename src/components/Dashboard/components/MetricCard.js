import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { formatNumber, formatPercent, getChangeColor } from '../utils/formatters';
import LoadingSpinner from './LoadingSpinner';

export default function MetricCard({ title, value, change, changeLabel, subtitle, sparklineData, loading, error, valuePrefix = '', valueSuffix = '' }) {
  const changeColor = getChangeColor(change);
  const changeArrow = change >= 0 ? '▲' : '▼';

  return (
    <div style={{
      background: '#0d1421', border: '1px solid #1a2744', borderRadius: '10px',
      padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '120px',
    }}>
      <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      {loading ? (
        <LoadingSpinner size={24} text="" />
      ) : error ? (
        <div style={{ color: '#f85149', fontSize: '12px' }}>Error loading</div>
      ) : (
        <>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#e6edf3', fontFamily: 'monospace' }}>
            {valuePrefix}{typeof value === 'number' ? formatNumber(value) : value}{valueSuffix}
          </div>
          {change !== undefined && change !== null && (
            <div style={{ fontSize: '12px', color: changeColor, fontWeight: 600 }}>
              {changeArrow} {formatPercent(Math.abs(change))} {changeLabel && <span style={{ color: '#8b949e', fontWeight: 400 }}>{changeLabel}</span>}
            </div>
          )}
          {subtitle && <div style={{ fontSize: '11px', color: '#8b949e' }}>{subtitle}</div>}
          {sparklineData && sparklineData.length > 1 && (
            <div style={{ height: 40, marginTop: 4 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line type="monotone" dataKey="value" stroke="#c770f0" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
