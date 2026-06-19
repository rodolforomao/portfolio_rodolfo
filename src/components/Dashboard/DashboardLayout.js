import React, { useState } from 'react';
import './Dashboard.css';
import {
  TbDroplet, TbCurrencyDollar, TbBuildingBank, TbChartLine,
  TbCurrencyDollarOff, TbTrendingUp, TbCurrencyBitcoin, TbChartDots,
  TbArrowsRightLeft, TbFilter, TbCalendarEvent, TbBell, TbMathFunction,
  TbMenu2, TbX
} from 'react-icons/tb';

const MODULES = [
  { id: 'liquidity', label: 'Liquidity', icon: TbDroplet, group: 'Macro' },
  { id: 'credit', label: 'Credit', icon: TbCurrencyDollar, group: 'Macro' },
  { id: 'monetary', label: 'Monetary Policy', icon: TbBuildingBank, group: 'Macro' },
  { id: 'yield', label: 'Yield Curve', icon: TbChartLine, group: 'Macro' },
  { id: 'dollar', label: 'Dollar (DXY)', icon: TbCurrencyDollarOff, group: 'Markets' },
  { id: 'markets', label: 'Markets', icon: TbTrendingUp, group: 'Markets' },
  { id: 'bitcoin', label: 'Bitcoin', icon: TbCurrencyBitcoin, group: 'Crypto' },
  { id: 'correlations', label: 'Correlations', icon: TbChartDots, group: 'Analytics' },
  { id: 'leadlag', label: 'Lead-Lag', icon: TbArrowsRightLeft, group: 'Analytics' },
  { id: 'regimes', label: 'Regimes', icon: TbFilter, group: 'Analytics' },
  { id: 'events', label: 'Events', icon: TbCalendarEvent, group: 'Context' },
  { id: 'alerts', label: 'Alerts', icon: TbBell, group: 'Context' },
  { id: 'statistics', label: 'Statistics', icon: TbMathFunction, group: 'Analytics' },
];

const GROUPS = ['Macro', 'Markets', 'Crypto', 'Analytics', 'Context'];

export default function DashboardLayout({ activeModule, onModuleChange, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clock, setClock] = React.useState(new Date().toUTCString().slice(0, 25));

  React.useEffect(() => {
    const t = setInterval(() => setClock(new Date().toUTCString().slice(0, 25)), 1000);
    return () => clearInterval(t);
  }, []);

  const activeInfo = MODULES.find(m => m.id === activeModule);

  return (
    <div className="db-root">
      <div className="db-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setMobileOpen(o => !o)}
            style={{ background: 'transparent', border: 'none', color: '#c770f0', fontSize: '20px', cursor: 'pointer', padding: 0 }}
          >
            {mobileOpen ? <TbX /> : <TbMenu2 />}
          </button>
          <span className="db-topbar-title">
            MacroDash &mdash; <span style={{ color: '#c770f0' }}>{activeInfo?.label || ''}</span>
          </span>
          <span className="db-tag db-tag-live">LIVE</span>
        </div>
        <span className="db-topbar-time">{clock} UTC</span>
      </div>

      <div className="db-layout">
        <nav className="db-sidebar">
          <div className="db-sidebar-header">
            <div className="db-sidebar-title">MacroDash</div>
            <div className="db-sidebar-subtitle">Global Liquidity Terminal</div>
          </div>
          {GROUPS.map(group => {
            const items = MODULES.filter(m => m.group === group);
            return (
              <div className="db-sidebar-section" key={group}>
                <div className="db-sidebar-section-label">{group}</div>
                {items.map(m => {
                  const Icon = m.icon;
                  return (
                    <div
                      key={m.id}
                      className={`db-sidebar-item ${activeModule === m.id ? 'active' : ''}`}
                      onClick={() => { onModuleChange(m.id); setMobileOpen(false); }}
                    >
                      <Icon />
                      <span>{m.label}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <main className="db-main">
          {children}
        </main>
      </div>
    </div>
  );
}
