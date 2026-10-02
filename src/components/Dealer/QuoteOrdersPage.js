import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { TbArrowLeft } from 'react-icons/tb';
import { loadSession } from './config';
import QuoteOrdersPanel from './QuoteOrdersPanel';
import './Dealer.css';

/** Cotações fora do console. O único acesso é o botão do menu. */
export default function QuoteOrdersPage() {
  const session = loadSession();
  if (!session?.authenticated) {
    return <Navigate to="/dealer" replace />;
  }

  return (
    <div className="quote-page">
      <Link to="/dealer/menu" className="quote-page-back">
        <TbArrowLeft /> Menu
      </Link>
      <QuoteOrdersPanel />
    </div>
  );
}
