import type { LiquidTx } from "./csv";

export type Wallet = {
  id: string;
  name: string;
  txCount: number;
  lastImportedAt: string;
};

const LS_WALLETS = "liquid_txs_wallets_v1";
const LS_WALLET_TXS_PREFIX = "liquid_txs_wallet_txs_";
/** Share of the smaller txid set that must overlap to treat two imports as the same wallet. */
const MATCH_THRESHOLD = 0.5;

export function loadWallets(): Wallet[] {
  try {
    const raw = localStorage.getItem(LS_WALLETS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Wallet[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWallets(wallets: Wallet[]) {
  localStorage.setItem(LS_WALLETS, JSON.stringify(wallets));
}

export function loadWalletTxs(id: string): LiquidTx[] {
  try {
    const raw = localStorage.getItem(LS_WALLET_TXS_PREFIX + id);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LiquidTx[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWalletTxs(id: string, txs: LiquidTx[]) {
  localStorage.setItem(LS_WALLET_TXS_PREFIX + id, JSON.stringify(txs));
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const id of smaller) {
    if (larger.has(id)) shared += 1;
  }
  return shared / smaller.size;
}

/** Finds the previously imported wallet whose txids best overlap this import, if any. */
export function findMatchingWallet(txs: LiquidTx[]): Wallet | null {
  const incoming = new Set(txs.map((t) => t.txid));
  if (incoming.size === 0) return null;

  const wallets = loadWallets();
  let best: { wallet: Wallet; ratio: number } | null = null;
  for (const wallet of wallets) {
    const known = new Set(loadWalletTxs(wallet.id).map((t) => t.txid));
    const ratio = overlapRatio(incoming, known);
    if (ratio >= MATCH_THRESHOLD && (!best || ratio > best.ratio)) {
      best = { wallet, ratio };
    }
  }
  return best?.wallet ?? null;
}

export function newWalletId(): string {
  return crypto.randomUUID?.() || `wallet-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createWallet(name: string, txs: LiquidTx[]): Wallet {
  const wallet: Wallet = {
    id: newWalletId(),
    name: name.trim() || "Carteira sem nome",
    txCount: txs.length,
    lastImportedAt: new Date().toISOString(),
  };
  saveWalletTxs(wallet.id, txs);
  saveWallets([...loadWallets(), wallet]);
  return wallet;
}

export function updateWalletImport(id: string, txs: LiquidTx[]): Wallet {
  const wallets = loadWallets();
  const idx = wallets.findIndex((w) => w.id === id);
  const updated: Wallet = {
    id,
    name: idx >= 0 ? wallets[idx].name : "Carteira",
    txCount: txs.length,
    lastImportedAt: new Date().toISOString(),
  };
  saveWalletTxs(id, txs);
  if (idx >= 0) wallets[idx] = updated;
  else wallets.push(updated);
  saveWallets(wallets);
  return updated;
}

export function renameWallet(id: string, name: string) {
  const wallets = loadWallets();
  const idx = wallets.findIndex((w) => w.id === id);
  if (idx < 0) return;
  wallets[idx] = { ...wallets[idx], name: name.trim() || wallets[idx].name };
  saveWallets(wallets);
}
