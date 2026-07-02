import React, { useState } from 'react';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import Alert from 'react-bootstrap/Alert';
import { TbRefresh, TbShieldCheck, TbAlertTriangle, TbCheck } from 'react-icons/tb';
import { canonicalAssetName } from './utils/dealerFormat';

function formatMargin(margin) {
  if (margin == null || !Number.isFinite(Number(margin))) return 'indefinida';
  return `${(Number(margin) * 100).toFixed(2)}%`;
}

function formatTs(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return ts;
  }
}

function PendingRow({ entry, confirming, busy, onArm, onApprove }) {
  const order = entry.order || {};
  const pair = `${canonicalAssetName(order.base)}/${canonicalAssetName(order.quote)}`;
  const marginUndetermined = entry.margin == null;

  return (
    <div className="dealer-approval-row">
      <div className="dealer-approval-row-main">
        <span className={`dealer-approval-dir ${String(order.trade_dir).toLowerCase()}`}>
          {order.trade_dir === 'Sell' ? 'V' : 'C'}
        </span>
        <strong>{pair}</strong>
        <Badge bg={marginUndetermined ? 'secondary' : 'danger'}>
          margem {formatMargin(entry.margin)}
        </Badge>
        <span className="dealer-approval-meta">
          PID {entry.pid} · {entry.wallet_name || '—'}
        </span>
      </div>
      <div className="dealer-approval-row-sub">
        <span>desde {formatTs(entry.first_seen_at)}</span>
        <code title="assinatura — mesma usada no Telegram/terminal">{entry.signature}</code>
      </div>
      <div className="dealer-approval-row-actions">
        <Button
          size="sm"
          variant={confirming ? 'danger' : 'outline-danger'}
          disabled={busy}
          onClick={() => (confirming ? onApprove(entry.signature) : onArm(entry.signature))}
        >
          <TbCheck /> {confirming ? 'Confirmar aprovação' : 'Aprovar'}
        </Button>
        {confirming && (
          <Button size="sm" variant="outline-secondary" disabled={busy} onClick={() => onArm(null)}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}

export default function PendingApprovalsPanel({
  pending = [],
  loading = false,
  error = null,
  onRefresh,
  onApprove,
}) {
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const handleApprove = async (signature) => {
    setBusyId(signature);
    try {
      await onApprove(signature);
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  return (
    <div className="dealer-approvals-panel">
      <div className="dealer-approvals-header">
        <TbShieldCheck size={18} />
        <h3 className="m-0">Aprovações pendentes</h3>
        <Badge bg={pending.length ? 'danger' : 'secondary'} className="ms-1">{pending.length}</Badge>
        <Button
          size="sm"
          variant="outline-secondary"
          className="ms-auto"
          disabled={loading}
          onClick={onRefresh}
        >
          <TbRefresh /> Atualizar
        </Button>
      </div>

      <p className="dealer-approvals-hint">
        Ordens que adquirem DePix (quote DePix, venda) com margem abaixo de 3% — ou margem
        indefinida — ficam bloqueadas no backend até aprovação manual. Aprovar aqui é
        equivalente a <code>/aprovar</code> no Telegram ou <code>[a]</code> no terminal.
      </p>

      {error && <Alert variant="danger" className="py-2"><TbAlertTriangle /> {error}</Alert>}

      {!pending.length ? (
        <p className="dealer-empty mb-0">Nenhuma ordem aguardando aprovação.</p>
      ) : (
        <div className="dealer-approvals-list">
          {pending.map((entry) => (
            <PendingRow
              key={entry.signature}
              entry={entry}
              confirming={confirmId === entry.signature}
              busy={busyId === entry.signature}
              onArm={setConfirmId}
              onApprove={handleApprove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
