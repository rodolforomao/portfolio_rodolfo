/** Cliente HTTP do vault (fonte de verdade — não depende do manager_dealer). */

const VAULT_API = process.env.REACT_APP_VAULT_API_URL || '';

export async function vaultFetch(path, opts = {}) {
  try {
    const res = await fetch(`${VAULT_API}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: err.message } };
  }
}

export async function fetchVaultDealers() {
  return vaultFetch('/api/vault/dealers');
}

/** Converte catálogo do vault para lista usada no Run / Telegram. */
export function dealersToWallets(dealers = []) {
  return dealers.map((d, i) => ({
    index: i + 1,
    name: d.wallet_name || d.dealer_id,
    dealer_id: d.dealer_id,
    status: d.status,
    ready: d.status === 'ready',
    has_keys: !!d.has_keys,
  }));
}

export function walletStatusLabel(w) {
  if (!w) return '';
  if (w.ready) return 'pronto';
  if (w.status === 'registered') return 'passphrase pendente';
  if (w.status === 'pending') return 'aguardando manager';
  return w.status || '—';
}

export async function createVaultDealer(dealerId, walletName) {
  return vaultFetch('/api/vault/dealers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dealer_id: dealerId, wallet_name: walletName }),
  });
}

export async function deleteVaultDealer(dealerId) {
  return vaultFetch(`/api/vault/dealers/${encodeURIComponent(dealerId)}`, {
    method: 'DELETE',
  });
}
