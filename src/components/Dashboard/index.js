import React, { useState } from 'react';
import DashboardLayout from './DashboardLayout';
import LiquidityModule from './modules/LiquidityModule';
import CreditModule from './modules/CreditModule';
import MonetaryPolicyModule from './modules/MonetaryPolicyModule';
import YieldCurveModule from './modules/YieldCurveModule';
import DollarModule from './modules/DollarModule';
import MarketModule from './modules/MarketModule';
import BitcoinModule from './modules/BitcoinModule';
import CorrelationModule from './modules/CorrelationModule';
import LeadLagModule from './modules/LeadLagModule';
import RegimeModule from './modules/RegimeModule';
import HistoricalEventsModule from './modules/HistoricalEventsModule';
import AlertsModule from './modules/AlertsModule';
import StatisticsModule from './modules/StatisticsModule';

const MODULE_MAP = {
  liquidity: LiquidityModule,
  credit: CreditModule,
  monetary: MonetaryPolicyModule,
  yield: YieldCurveModule,
  dollar: DollarModule,
  markets: MarketModule,
  bitcoin: BitcoinModule,
  correlations: CorrelationModule,
  leadlag: LeadLagModule,
  regimes: RegimeModule,
  events: HistoricalEventsModule,
  alerts: AlertsModule,
  statistics: StatisticsModule,
};

export default function MacroDashboard() {
  const [activeModule, setActiveModule] = useState('liquidity');
  const ActiveComponent = MODULE_MAP[activeModule] || LiquidityModule;

  return (
    <DashboardLayout activeModule={activeModule} onModuleChange={setActiveModule}>
      <ActiveComponent />
    </DashboardLayout>
  );
}
