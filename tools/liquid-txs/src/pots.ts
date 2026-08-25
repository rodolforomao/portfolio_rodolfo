import {
  avgPriceFromTxs,
  formatPrice,
  txUsdtPerLbtc,
  type LiquidTx,
} from "./csv";

export type PotSide = "buy" | "sell" | "flat";

export type PotTxSummary = {
  txid: string;
  shortTxid: string;
  type: string;
  price: number | null;
  lbtc: number;
  usdt: number;
  timestamp: string;
  /** True when the last wallet sync could not find this txid in the import anymore. */
  missing?: boolean;
};

export type PotRealizedValue = {
  spot: number;
  avgPrice: number;
  usdtPnl: number;
  vsHoldPct: number;
  spotVsMePct: number;
};

export type LiquidPot = {
  id: string;
  label: string;
  txids: string[];
  txSummaries: PotTxSummary[];
  side: PotSide;
  avgPrice: number;
  totalLbtc: number;
  totalUsdt: number;
  createdAt: string;
  realizedAt: string | null;
  /** Spot price + PnL frozen at the moment of realization. */
  realizedValue?: PotRealizedValue | null;
  walletId?: string;
  walletName?: string;
  firedLevels?: Record<string, boolean>;
  lastPct?: number | null;
  lastSpot?: number | null;
  lastAlertAt?: string | null;
  lastAlertLevel?: number | null;
};

export type TelegramPublic = {
  configured: boolean;
  source?: string;
  chat_ids?: string[];
  chat_id?: string;
  bot_token_masked: string;
  hint?: string;
};

const LS_POTS = "liquid_txs_pots_v1";

export function loadLocalPots(): LiquidPot[] {
  try {
    const raw = localStorage.getItem(LS_POTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LiquidPot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalPots(pots: LiquidPot[]) {
  localStorage.setItem(LS_POTS, JSON.stringify(pots));
}

function shortTx(txid: string): string {
  if (txid.length < 16) return txid;
  return `${txid.slice(0, 8)}…${txid.slice(-6)}`;
}

export function buildPotFromSelection(
  label: string,
  txs: LiquidTx[],
  wallet?: { id: string; name: string } | null
): Omit<LiquidPot, "id" | "createdAt" | "realizedAt"> | null {
  const stats = avgPriceFromTxs(txs);
  const net = stats.boughtLbtc - stats.soldLbtc;
  let side: PotSide = "flat";
  let avg: number | null = stats.vwap;
  if (net > 1e-12 && stats.buyVwap != null) {
    side = "buy";
    avg = stats.buyVwap;
  } else if (net < -1e-12 && stats.sellVwap != null) {
    side = "sell";
    avg = stats.sellVwap;
  }
  if (avg == null || avg <= 0) return null;

  const lbtc =
    side === "buy"
      ? stats.boughtLbtc
      : side === "sell"
        ? stats.soldLbtc
        : Math.abs(stats.boughtLbtc - stats.soldLbtc) || stats.totalLbtc;

  const usdt =
    side === "buy"
      ? stats.buyUsdt
      : side === "sell"
        ? stats.sellUsdt
        : stats.totalUsdt;

  const txSummaries: PotTxSummary[] = txs.map((tx) => ({
    txid: tx.txid,
    shortTxid: shortTx(tx.txid),
    type: String(tx.type),
    price: txUsdtPerLbtc(tx),
    lbtc: tx.liquidBitcoin,
    usdt: tx.tetherUsd,
    timestamp: tx.timestamp,
  }));

  return {
    label: label.trim(),
    txids: txs.map((t) => t.txid),
    txSummaries,
    side,
    avgPrice: avg,
    totalLbtc: lbtc,
    totalUsdt: usdt,
    walletId: wallet?.id,
    walletName: wallet?.name,
    firedLevels: {},
    lastPct: null,
    lastSpot: null,
  };
}

/**
 * Reconciles a wallet's pots against a freshly imported tx list: refreshes the
 * summary of txs that are still present and flags the ones that vanished from
 * the new import (without touching pots' aggregates or other wallets' pots).
 */
export function syncPotsWithWallet(
  pots: LiquidPot[],
  walletId: string,
  txs: LiquidTx[]
): { pots: LiquidPot[]; changed: boolean; missingCount: number } {
  const byTxid = new Map(txs.map((tx) => [tx.txid, tx]));
  let changed = false;
  let missingCount = 0;

  const nextPots = pots.map((pot) => {
    if (pot.walletId !== walletId) return pot;
    let potChanged = false;
    const nextSummaries = pot.txSummaries.map((summary) => {
      const tx = byTxid.get(summary.txid);
      if (!tx) {
        missingCount += 1;
        if (!summary.missing) potChanged = true;
        return summary.missing ? summary : { ...summary, missing: true };
      }
      if (summary.missing) potChanged = true;
      const refreshed: PotTxSummary = {
        txid: tx.txid,
        shortTxid: summary.shortTxid,
        type: String(tx.type),
        price: txUsdtPerLbtc(tx),
        lbtc: tx.liquidBitcoin,
        usdt: tx.tetherUsd,
        timestamp: tx.timestamp,
        missing: false,
      };
      if (
        refreshed.price !== summary.price ||
        refreshed.lbtc !== summary.lbtc ||
        refreshed.usdt !== summary.usdt ||
        refreshed.timestamp !== summary.timestamp
      ) {
        potChanged = true;
      }
      return refreshed;
    });
    if (!potChanged) return pot;
    changed = true;
    return { ...pot, txSummaries: nextSummaries };
  });

  return { pots: changed ? nextPots : pots, changed, missingCount };
}

export function potPnl(pot: LiquidPot, spot: number) {
  const avg = pot.avgPrice;
  if (!avg || avg <= 0) return null;
  const spotVsMePct = ((spot - avg) / avg) * 100;
  const vsHoldPct = pot.side === "sell" ? -spotVsMePct : spotVsMePct;
  const usdtPnl =
    pot.side === "sell"
      ? (avg - spot) * pot.totalLbtc
      : (spot - avg) * pot.totalLbtc;
  return { spotVsMePct, vsHoldPct, usdtPnl, reference: avg };
}

const API_BASE = "/api/liquid-pots";

async function api<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    // fetch() segue redirects automaticamente e, para métodos != GET/HEAD, um 301/302
    // rebaixa o request para GET e descarta o corpo — a resposta pareceria "ok" mas a
    // operação (create/update/delete) nunca teria realmente acontecido. Aborta cedo
    // em vez de reportar sucesso falso.
    const method = (init?.method || "GET").toUpperCase();
    if (res.redirected && method !== "GET" && method !== "HEAD") {
      return {
        ok: false,
        error: `Redirecionado durante ${method} — operação pode não ter sido aplicada (verifique config de proxy).`,
      };
    }
    let data: (T & { error?: string }) | null = null;
    try {
      data = await res.json();
    } catch {
      return {
        ok: false,
        error: `Resposta inválida do servidor (HTTP ${res.status})`,
      };
    }
    if (!res.ok) {
      return { ok: false, error: data?.error || `HTTP ${res.status}` };
    }
    return { ok: true, data: data as T };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "API offline",
    };
  }
}

export type PotsApiState = {
  pots: LiquidPot[];
  telegram: TelegramPublic;
  thresholds: number[];
  poll_seconds: number;
};

// nginx redireciona (301) "/api/liquid-pots" sem barra final para "/api/liquid-pots/".
// fetch() segue esse redirect rebaixando POST/PUT para GET e descartando o corpo — por
// isso os endpoints "raiz" (sem :id) sempre precisam da barra final aqui.
export async function fetchPotsState() {
  return api<PotsApiState>("/");
}

export async function createPotRemote(
  body: ReturnType<typeof buildPotFromSelection> & { label: string }
) {
  return api<PotsApiState & { pot: LiquidPot }>("/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function realizePotRemote(
  id: string,
  realize: boolean,
  fallbackSpot?: number | null
) {
  const body = realize
    ? { realize: true, spot: fallbackSpot ?? undefined }
    : { unrealize: true };
  return api<PotsApiState & { pot: LiquidPot }>(`/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deletePotRemote(id: string) {
  return api<PotsApiState>(`/${id}`, { method: "DELETE" });
}

export async function syncPotsRemote(pots: LiquidPot[]) {
  return api<PotsApiState>("/", {
    method: "PUT",
    body: JSON.stringify({ pots }),
  });
}

export function formatPotAvg(n: number) {
  return formatPrice(n);
}

export function newLocalId() {
  return crypto.randomUUID?.() || `pot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
