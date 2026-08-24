export type TxType = "Received" | "Sent" | "Swap" | string;

export interface LiquidTx {
  txid: string;
  type: TxType;
  timestamp: string;
  networkFee: number;
  memo: string;
  decentralizedPix: number;
  liquidBitcoin: number;
  brxAsset: number;
  tetherUsd: number;
}

export function parseCsv(text: string): LiquidTx[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const rows: LiquidTx[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 9 || !cols[0]) continue;

    rows.push({
      txid: cols[0].trim(),
      type: cols[1].trim(),
      timestamp: cols[2].trim(),
      networkFee: num(cols[3]),
      memo: cols[4]?.trim() ?? "",
      decentralizedPix: num(cols[5]),
      liquidBitcoin: num(cols[6]),
      brxAsset: num(cols[7]),
      tetherUsd: num(cols[8]),
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : 0;
}

export function toDateKey(timestamp: string): string {
  return timestamp.slice(0, 10);
}

export function blockstreamTxUrl(txid: string): string {
  return `https://blockstream.info/liquid/tx/${txid}`;
}

export function liquidScanTxUrl(txid: string): string {
  return `https://liquid.network/tx/${txid}`;
}

export function formatAmount(n: number, digits = 8): string {
  if (n === 0) return "—";
  const abs = Math.abs(n);
  const formatted =
    abs >= 1
      ? n.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: Math.min(digits, 8),
        })
      : n.toFixed(digits).replace(/\.?0+$/, "") || "0";
  return formatted;
}

export function formatFee(n: number): string {
  if (n === 0) return "—";
  return n.toFixed(8).replace(/\.?0+$/, "");
}

/** Min L-BTC notional to treat as a real USDT/L-BTC trade (excludes dust/fees). */
const MIN_LBTC_FOR_PRICE = 0.00001;
const MIN_USDT_FOR_PRICE = 1;

/** Spot price USDT per L-BTC when both legs are present and meaningful. */
export function txUsdtPerLbtc(tx: LiquidTx): number | null {
  const lbtc = Math.abs(tx.liquidBitcoin);
  const usdt = Math.abs(tx.tetherUsd);
  if (lbtc < MIN_LBTC_FOR_PRICE || usdt < MIN_USDT_FOR_PRICE) return null;
  // Opposite signs = swap; same-sign Sent/Received with dust fee skews the ratio
  if (tx.liquidBitcoin * tx.tetherUsd >= 0) return null;
  return usdt / lbtc;
}

export interface AvgPriceStats {
  pricedCount: number;
  skippedCount: number;
  totalLbtc: number;
  totalUsdt: number;
  /** Volume-weighted: Σ|USDT| / Σ|L-BTC| */
  vwap: number | null;
  /** Simple mean of per-tx prices */
  simpleAvg: number | null;
  min: number | null;
  max: number | null;
  soldLbtc: number;
  boughtLbtc: number;
  buyVwap: number | null;
  sellVwap: number | null;
  buyUsdt: number;
  sellUsdt: number;
}

export function avgPriceFromTxs(txs: LiquidTx[]): AvgPriceStats {
  let pricedCount = 0;
  let skippedCount = 0;
  let sumLbtc = 0;
  let sumUsdt = 0;
  let sumPrice = 0;
  let min: number | null = null;
  let max: number | null = null;
  let soldLbtc = 0;
  let boughtLbtc = 0;
  let buyUsdt = 0;
  let sellUsdt = 0;

  for (const tx of txs) {
    const price = txUsdtPerLbtc(tx);
    if (price === null) {
      skippedCount += 1;
      continue;
    }
    const lbtc = Math.abs(tx.liquidBitcoin);
    const usdt = Math.abs(tx.tetherUsd);
    pricedCount += 1;
    sumLbtc += lbtc;
    sumUsdt += usdt;
    sumPrice += price;
    min = min === null ? price : Math.min(min, price);
    max = max === null ? price : Math.max(max, price);
    if (tx.liquidBitcoin < 0) {
      soldLbtc += lbtc;
      sellUsdt += usdt;
    } else {
      boughtLbtc += lbtc;
      buyUsdt += usdt;
    }
  }

  return {
    pricedCount,
    skippedCount,
    totalLbtc: sumLbtc,
    totalUsdt: sumUsdt,
    vwap: sumLbtc > 0 ? sumUsdt / sumLbtc : null,
    simpleAvg: pricedCount > 0 ? sumPrice / pricedCount : null,
    min,
    max,
    soldLbtc,
    boughtLbtc,
    buyVwap: boughtLbtc > 0 ? buyUsdt / boughtLbtc : null,
    sellVwap: soldLbtc > 0 ? sellUsdt / soldLbtc : null,
    buyUsdt,
    sellUsdt,
  };
}

export type BtcVsMe = {
  spot: number;
  reference: number;
  /** (spot - reference) / reference — BTC vs seu preço */
  spotVsMePct: number;
  /**
   * Performance vs hold BTC, signed for the net side of the selection:
   * - net buy: same as spotVsMePct (lucro se spot > custo)
   * - net sell: opposite (lucro se spot < preço de venda)
   */
  vsHoldPct: number;
  side: "buy" | "sell" | "flat";
  label: "aumentando" | "diminuindo" | "empatado";
};

export function compareToBtcSpot(
  stats: AvgPriceStats,
  spot: number
): BtcVsMe | null {
  const net = stats.boughtLbtc - stats.soldLbtc;
  let side: BtcVsMe["side"] = "flat";
  let reference: number | null = stats.vwap;

  if (net > 1e-12 && stats.buyVwap !== null) {
    side = "buy";
    reference = stats.buyVwap;
  } else if (net < -1e-12 && stats.sellVwap !== null) {
    side = "sell";
    reference = stats.sellVwap;
  } else if (stats.vwap === null) {
    return null;
  }

  if (reference === null || reference <= 0) return null;

  const spotVsMePct = ((spot - reference) / reference) * 100;
  const vsHoldPct = side === "sell" ? -spotVsMePct : spotVsMePct;

  let label: BtcVsMe["label"] = "empatado";
  if (vsHoldPct > 0.05) label = "aumentando";
  else if (vsHoldPct < -0.05) label = "diminuindo";

  return { spot, reference, spotVsMePct, vsHoldPct, side, label };
}

export function formatPrice(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPct(n: number, digits = 2): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export const PRICE_BUCKET_USDT = 5000;

export type PriceBucket = {
  /** Inclusive lower bound in USDT */
  from: number;
  /** Exclusive upper bound in USDT */
  to: number;
  label: string;
  lbtc: number;
  usdt: number;
  trades: number;
};

/** L-BTC bought (liquidBitcoin > 0) aggregated into 5k USDT price bands. */
export function buyVolumeByPriceBucket(
  txs: LiquidTx[],
  bucketSize = PRICE_BUCKET_USDT
): PriceBucket[] {
  const map = new Map<number, { lbtc: number; usdt: number; trades: number }>();

  for (const tx of txs) {
    if (tx.liquidBitcoin <= 0) continue;
    const price = txUsdtPerLbtc(tx);
    if (price === null) continue;

    const from = Math.floor(price / bucketSize) * bucketSize;
    const cur = map.get(from) ?? { lbtc: 0, usdt: 0, trades: 0 };
    cur.lbtc += tx.liquidBitcoin;
    cur.usdt += Math.abs(tx.tetherUsd);
    cur.trades += 1;
    map.set(from, cur);
  }

  if (map.size === 0) return [];

  const keys = [...map.keys()].sort((a, b) => a - b);
  const min = keys[0];
  const max = keys[keys.length - 1];
  const out: PriceBucket[] = [];

  for (let from = min; from <= max; from += bucketSize) {
    const cur = map.get(from) ?? { lbtc: 0, usdt: 0, trades: 0 };
    const to = from + bucketSize;
    out.push({
      from,
      to,
      label: `${formatBucketK(from)}–${formatBucketK(to)}`,
      lbtc: cur.lbtc,
      usdt: cur.usdt,
      trades: cur.trades,
    });
  }

  return out;
}

function formatBucketK(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
