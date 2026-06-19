import React from 'react';

export default function ErrorDisplay({ error, onRetry }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '16px', textAlign: 'center' }}>
      <div style={{ fontSize: '32px' }}>&#9888;</div>
      <div style={{ color: '#f85149', fontWeight: 600, fontSize: '14px' }}>Failed to load data</div>
      <div style={{ color: '#8b949e', fontSize: '12px', maxWidth: '400px' }}>{error?.message || String(error)}</div>
      {error?.message?.includes('API key') && (
        <div style={{ background: '#1a2744', border: '1px solid #2d4a7a', borderRadius: '8px', padding: '16px', fontSize: '12px', color: '#c9d1d9', maxWidth: '400px', textAlign: 'left' }}>
          <strong>Setup required:</strong><br/>
          1. Get a free FRED API key at <code>fred.stlouisfed.org</code><br/>
          2. Set <code>REACT_APP_FRED_API_KEY=your_key</code> in your .env file<br/>
          3. Restart the dev server
        </div>
      )}
      {onRetry && (
        <button onClick={onRetry} style={{ background: '#c770f0', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 20px', cursor: 'pointer', fontSize: '13px' }}>
          Retry
        </button>
      )}
    </div>
  );
}
