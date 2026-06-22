import React from 'react';
import { TbRobot, TbWorld } from 'react-icons/tb';

export function ManagerBadge({ title }) {
  return (
    <span
      className="dealer-source-badge dealer-source-manager"
      title={title || 'Dados do manager_dealer — backend local via relay WebSocket'}
    >
      <TbRobot /> manager
    </span>
  );
}

export function SideswapBadge({ title }) {
  return (
    <span
      className="dealer-source-badge dealer-source-sideswap"
      title={title || 'Dados públicos do livro SideSwap — WebSocket direto'}
    >
      <TbWorld /> SideSwap
    </span>
  );
}
