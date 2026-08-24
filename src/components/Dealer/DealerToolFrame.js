import React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Button from 'react-bootstrap/Button';
import { TbArrowLeft, TbLogout } from 'react-icons/tb';
import { clearSession, loadSession } from './config';
import './Dealer.css';

/**
 * Shell autenticado que embute um app externo (Analyses / Liquid TX)
 * servido via setupProxy em /tools/*.
 */
export default function DealerToolFrame({ title, src }) {
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
    <div className="dealer-root dealer-tool-root">
      <header className="dealer-tool-bar">
        <Link to="/dealer/menu" className="dealer-tool-back">
          <TbArrowLeft /> Menu
        </Link>
        <h1 className="dealer-tool-title">{title}</h1>
        <Button variant="outline-danger" size="sm" onClick={handleLogout}>
          <TbLogout /> <span className="dealer-logout-label">Sair</span>
        </Button>
      </header>
      <iframe
        className="dealer-tool-frame"
        title={title}
        src={src}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
