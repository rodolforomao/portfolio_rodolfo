import React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Button from 'react-bootstrap/Button';
import {
  TbChartCandle, TbChartLine, TbArrowsExchange, TbLogout, TbLock,
} from 'react-icons/tb';
import { clearSession, loadSession } from './config';
import './Dealer.css';

const TOOLS = [
  {
    to: '/dealer/console',
    title: 'Dealer',
    description: 'Console de operação — ordens, balances e agentes.',
    icon: TbChartCandle,
  },
  {
    to: '/dealer/analyses',
    title: 'Analyses',
    description: 'Motor dinâmico BTC → USDT (scores e pesos ao vivo).',
    icon: TbChartLine,
  },
  {
    to: '/dealer/liquid-tx',
    title: 'Liquid TX',
    description: 'Histórico e análise de transações Liquid.',
    icon: TbArrowsExchange,
  },
];

export default function DealerMenu() {
  const navigate = useNavigate();
  const session = loadSession();

  if (!session?.authenticated) {
    return <Navigate to="/dealer" replace />;
  }

  const handleLogout = () => {
    clearSession();
    navigate('/dealer', { replace: true });
  };

  return (
    <div className="dealer-root">
      <Container className="dealer-login-wrap">
        <div className="dealer-hub-card">
          <div className="dealer-login-header">
            <TbLock className="dealer-login-icon" />
            <h1>Ferramentas</h1>
            <p>Escolha o módulo após o login.</p>
          </div>

          <div className="dealer-hub-grid">
            {TOOLS.map(({ to, title, description, icon: Icon }) => (
              <Link key={to} to={to} className="dealer-hub-tile">
                <Icon className="dealer-hub-tile-icon" />
                <span className="dealer-hub-tile-title">{title}</span>
                <span className="dealer-hub-tile-desc">{description}</span>
              </Link>
            ))}
          </div>

          <Button
            variant="outline-danger"
            size="sm"
            className="dealer-hub-logout"
            onClick={handleLogout}
          >
            <TbLogout /> Sair
          </Button>
        </div>
      </Container>
    </div>
  );
}
