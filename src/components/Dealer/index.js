import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DealerLogin from './DealerLogin';
import DealerConsole from './DealerConsole';
import DealerMenu from './DealerMenu';
import DealerHubSettings from './DealerHubSettings';
import DealerToolFrame from './DealerToolFrame';
import { loadSession, ANALYSES_EMBED_URL, LIQUID_TX_EMBED_URL } from './config';

function DealerIndex() {
  const session = loadSession();
  if (session?.authenticated) {
    return <Navigate to="/dealer/menu" replace />;
  }
  return <DealerLogin />;
}

export default function DealerApp() {
  return (
    <Routes>
      <Route path="/" element={<DealerIndex />} />
      <Route path="/menu" element={<DealerMenu />} />
      <Route path="/settings" element={<DealerHubSettings />} />
      <Route path="/console" element={<DealerConsole />} />
      <Route
        path="/analyses"
        element={<DealerToolFrame title="Analyses" src={ANALYSES_EMBED_URL} />}
      />
      <Route
        path="/liquid-tx"
        element={<DealerToolFrame title="Liquid TX" src={LIQUID_TX_EMBED_URL} />}
      />
      <Route path="*" element={<Navigate to="/dealer" replace />} />
    </Routes>
  );
}
