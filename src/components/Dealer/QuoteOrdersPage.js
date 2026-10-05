import React, { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { TbArrowLeft } from 'react-icons/tb';
import { loadSession } from './config';
import QuoteOrdersPanel from './QuoteOrdersPanel';
import './Dealer.css';

/** Swap Dex fora do console. O único acesso é o botão do menu. */
export default function QuoteOrdersPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Swap Dex';
    return () => {
      document.title = previous;
    };
  }, []);

  const session = loadSession();
  if (!session?.authenticated) {
    return <Navigate to="/dealer" replace />;
  }

  return (
    <div className="quote-page">
      <div className="quote-page-frame">
        <Link to="/dealer/menu" className="quote-page-back">
          <TbArrowLeft /> Menu
        </Link>
        <QuoteOrdersPanel />
      </div>
    </div>
  );
}
