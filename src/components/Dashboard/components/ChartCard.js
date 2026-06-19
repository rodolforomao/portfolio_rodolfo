import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import ErrorDisplay from './ErrorDisplay';

export default function ChartCard({ title, subtitle, children, loading, error, onRetry, height = 300, actions }) {
  const [fullscreen, setFullscreen] = useState(false);

  const content = (
    <div style={{
      background: '#0d1421', border: '1px solid #1a2744', borderRadius: '10px',
      padding: '16px', ...(fullscreen ? { position: 'fixed', inset: 0, zIndex: 9999, borderRadius: 0 } : {}),
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e6edf3' }}>{title}</div>
          {subtitle && <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px' }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {actions}
          <button
            onClick={() => setFullscreen(f => !f)}
            style={{ background: 'transparent', border: '1px solid #1a2744', color: '#8b949e', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px' }}
          >
            {fullscreen ? '⊞' : '⊞'}
          </button>
        </div>
      </div>
      <div style={{ height: fullscreen ? 'calc(100vh - 80px)' : height }}>
        {loading ? <LoadingSpinner /> : error ? <ErrorDisplay error={error} onRetry={onRetry} /> : children}
      </div>
    </div>
  );

  return content;
}
