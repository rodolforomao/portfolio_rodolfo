import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DealerLogin from './DealerLogin';
import DealerConsole from './DealerConsole';
import { loadSession } from './config';

function DealerIndex() {
  const session = loadSession();
  if (session?.authenticated) {
    return <Navigate to="/dealer/console" replace />;
  }
  return <DealerLogin />;
}

export default function DealerApp() {
  return (
    <Routes>
      <Route path="/" element={<DealerIndex />} />
      <Route path="/console" element={<DealerConsole />} />
      <Route path="*" element={<Navigate to="/dealer" replace />} />
    </Routes>
  );
}
