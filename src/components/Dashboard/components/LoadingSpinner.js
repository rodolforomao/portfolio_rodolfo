import React from 'react';

export default function LoadingSpinner({ size = 40, text = 'Loading data...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '16px' }}>
      <div style={{
        width: size, height: size,
        border: `3px solid #1a2744`,
        borderTop: `3px solid #c770f0`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <span style={{ color: '#8b949e', fontSize: '13px' }}>{text}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
