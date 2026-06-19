import { normalizeBalances } from './dealerFormat';

export const DEALER_STATUS_META = {
  online: { label: 'online', short: 'ON', description: 'Ativo no backend com sync ao vivo' },
  unused: { label: 'não usado', short: 'IDLE', description: 'Online sem ordens nem saldos' },
  zombie: { label: 'zumbi', short: 'ZMB', description: 'Listado no backend, sem sync WS recente' },
  morto: { label: 'morto', short: 'OFF', description: 'Só no histórico local — processo encerrado' },
};

function hasActivity(dealer) {
  const orders = dealer?.orders?.length > 0;
  const balances = normalizeBalances(dealer?.balances).length > 0;
  return orders || balances;
}

/**
 * Une dealers do state_update (WS) e list_detailed (backend).
 * Não inclui PIDs só do histórico local — processos encerrados somem da lista.
 * Prioridade de dados: WS (vivo) > list_detailed.
 */
export function buildDealerList(wsDealers = [], fetchedDealers = []) {
  const wsMap = new Map((wsDealers || []).map((d) => [d.pid, d]));
  const fetchedMap = new Map((fetchedDealers || []).map((d) => [d.pid, d]));

  const allPids = new Set([
    ...wsMap.keys(),
    ...fetchedMap.keys(),
  ]);

  return [...allPids]
    .filter(Boolean)
    .map((pid) => {
      const ws = wsMap.get(pid);
      const fetched = fetchedMap.get(pid);
      const merged = {
        ...(fetched || {}),
        ...(ws || {}),
        pid,
      };

      let dealerStatus = 'zombie';
      if (ws) {
        dealerStatus = hasActivity(merged) ? 'online' : 'unused';
      }

      const meta = DEALER_STATUS_META[dealerStatus];
      return {
        ...merged,
        dealerStatus,
        statusLabel: meta.label,
        statusShort: meta.short,
        statusHint: meta.description,
        isLive: dealerStatus === 'online' || dealerStatus === 'unused',
      };
    })
    .sort((a, b) => {
      const order = { online: 0, unused: 1, zombie: 2, morto: 3 };
      const diff = (order[a.dealerStatus] ?? 9) - (order[b.dealerStatus] ?? 9);
      return diff || (a.pid - b.pid);
    });
}

export function countDealersByStatus(dealers) {
  return (dealers || []).reduce((acc, d) => {
    acc[d.dealerStatus] = (acc[d.dealerStatus] || 0) + 1;
    return acc;
  }, {});
}

export function dealersSummaryLabel(dealers) {
  const c = countDealersByStatus(dealers);
  const parts = [];
  if (c.online) parts.push(`${c.online} online`);
  if (c.unused) parts.push(`${c.unused} não usado`);
  if (c.zombie) parts.push(`${c.zombie} zumbi`);
  if (c.morto) parts.push(`${c.morto} morto`);
  return parts.length ? parts.join(', ') : '0 dealers';
}
