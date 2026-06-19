export const DEALER_REGISTRY_KEY = 'dealer_active_registry';

export function loadDealerRegistry() {
  try {
    const raw = sessionStorage.getItem(DEALER_REGISTRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDealerToRegistry(dealer) {
  if (!dealer?.pid) return;
  const now = new Date().toISOString();
  const entry = {
    pid: dealer.pid,
    wallet_name: dealer.wallet_name,
    port_api: dealer.port_api,
    port_ws: dealer.port_ws,
    status: dealer.dealerStatus || 'online',
    savedAt: now,
    lastSeenAt: now,
  };
  const list = loadDealerRegistry().filter((d) => d.pid !== entry.pid);
  list.push(entry);
  sessionStorage.setItem(DEALER_REGISTRY_KEY, JSON.stringify(list));
  return entry;
}

/** Espelha só dealers atuais (WS/backend). PIDs antigos são removidos do storage. */
export function touchRegistryFromDealers(dealers) {
  const now = new Date().toISOString();
  const list = (dealers || [])
    .filter((d) => d.pid)
    .map((d) => ({
      pid: d.pid,
      wallet_name: d.wallet_name,
      port_api: d.port_api,
      port_ws: d.port_ws,
      status: d.dealerStatus || 'online',
      savedAt: now,
      lastSeenAt: now,
    }))
    .sort((a, b) => a.pid - b.pid);

  sessionStorage.setItem(DEALER_REGISTRY_KEY, JSON.stringify(list));
  return list;
}

export function removeDealerFromRegistry(pid) {
  const list = loadDealerRegistry().filter((d) => d.pid !== pid);
  sessionStorage.setItem(DEALER_REGISTRY_KEY, JSON.stringify(list));
  return list;
}
