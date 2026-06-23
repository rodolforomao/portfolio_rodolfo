import { formatOrderConfigSummary, getOrderPricingMode } from './orderPricing';
import { normalizeOrderMarket } from './orderMarketNormalize';

export const ORDER_REGISTRY_KEY = 'dealer_order_registry';

export function loadOrderRegistry() {
  try {
    const raw = sessionStorage.getItem(ORDER_REGISTRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistOrderRegistry(list) {
  const sorted = [...list].sort(
    (a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0),
  );
  sessionStorage.setItem(ORDER_REGISTRY_KEY, JSON.stringify(sorted));
  return sorted;
}

export function buildOrderRegistryId(entry) {
  if (entry?.order_id) return `${entry.pid}|${entry.order_id}`;
  return `${entry.pid}|${entry.base}|${entry.quote}|${entry.trade_dir}|${entry.savedAt || 'draft'}`;
}

function snapshotConfig(order) {
  return {
    pricingMode: getOrderPricingMode(order),
    spreadSummary: formatOrderConfigSummary(order),
  };
}

export function buildRegistryEntry(dealer, order, { source = 'live', now = new Date().toISOString() } = {}) {
  const { order: normalized } = normalizeOrderMarket(order);
  const config = snapshotConfig(normalized);
  const entry = {
    registryId: null,
    pid: dealer?.pid,
    wallet_name: dealer?.wallet_name,
    order_id: normalized?.order_id || null,
    base: normalized?.base,
    quote: normalized?.quote,
    trade_dir: normalized?.trade_dir,
    price: normalized?.price ?? null,
    original_price: normalized?.original_price ?? null,
    price_porc: normalized?.price_porc ?? null,
    price_min: normalized?.price_min ?? null,
    follow_target: normalized?.follow_target ?? false,
    follow_target_order_id: normalized?.follow_target_order_id ?? null,
    follow_ref_order_id: normalized?.follow_ref_order_id ?? null,
    pending: normalized?.pending ?? false,
    amount: normalized?.amount ?? 999999,
    book_label: normalized?.book_label ?? null,
    book_position: normalized?.book_position ?? null,
    spreadSummary: config.spreadSummary,
    pricingMode: config.pricingMode,
    source,
    isLive: source === 'live',
    savedAt: now,
    lastSeenAt: now,
  };
  entry.registryId = buildOrderRegistryId(entry);
  return entry;
}

function upsertEntry(list, entry) {
  const idx = list.findIndex((e) => e.registryId === entry.registryId);
  if (idx >= 0) {
    const prev = list[idx];
    list[idx] = {
      ...prev,
      ...entry,
      savedAt: prev.savedAt || entry.savedAt,
    };
    return list;
  }

  // Mescla rascunho enviado (sem order_id) com ordem ao vivo recém-criada
  if (entry.order_id) {
    const draftIdx = list.findIndex(
      (e) => !e.order_id
        && e.pid === entry.pid
        && e.base === entry.base
        && e.quote === entry.quote
        && e.trade_dir === entry.trade_dir,
    );
    if (draftIdx >= 0) {
      const prev = list[draftIdx];
      list[draftIdx] = {
        ...prev,
        ...entry,
        registryId: entry.registryId,
        savedAt: prev.savedAt || entry.savedAt,
      };
      return list;
    }
  }

  list.push(entry);
  return list;
}

/** Sincroniza ordens ao vivo. Remove entradas de PIDs inexistentes e ordens encerradas. */
export function touchOrderRegistryFromDealers(dealers = []) {
  const activePids = new Set(
    (dealers || []).filter((d) => d.pid).map((d) => d.pid),
  );
  let list = loadOrderRegistry();
  if (activePids.size > 0) {
    list = list.filter((e) => activePids.has(e.pid));
  }
  const now = new Date().toISOString();
  const liveIds = new Set();

  (dealers || []).forEach((dealer) => {
    if (!dealer?.pid) return;
    (dealer.orders || []).forEach((order) => {
      if (!order?.base || !order?.quote || !order?.trade_dir) return;
      const entry = buildRegistryEntry(dealer, order, { source: 'live', now });
      liveIds.add(entry.registryId);
      upsertEntry(list, entry);
    });
  });

  const pruned = list.filter((entry) => {
    if (liveIds.has(entry.registryId)) return true;
    if (activePids.size === 0) return true;
    // Rascunho recém-enviado aguardando order_id no próximo sync
    return entry.source === 'sent' && !entry.order_id;
  });

  return persistOrderRegistry(pruned);
}

export function saveSentOrderToRegistry(pid, walletName, params, responseOrder = null) {
  const now = new Date().toISOString();
  const raw = {
    order_id: responseOrder?.order_id || null,
    base: params.base,
    quote: params.quote,
    trade_dir: params.trade_dir,
    amount: params.amount ?? 999999,
    price: params.price ?? null,
    price_porc: params.price_porc ?? null,
    price_min: params.price_min ?? null,
    follow_target: params.follow_target ?? false,
    follow_target_order_id: params.follow_target ? (params.follow_target_order_id ?? null) : null,
    follow_ref_order_id: params.follow_target ? (responseOrder?.follow_ref_order_id ?? null) : null,
    original_price: responseOrder?.original_price ?? null,
    book_label: responseOrder?.book_label ?? null,
    book_position: responseOrder?.book_position ?? null,
  };
  const { order } = normalizeOrderMarket(raw);
  const entry = buildRegistryEntry(
    { pid, wallet_name: walletName },
    order,
    { source: 'sent', now },
  );
  const list = loadOrderRegistry();
  upsertEntry(list, entry);
  return persistOrderRegistry(list);
}

export function removeOrderFromRegistry(registryId) {
  const list = loadOrderRegistry().filter((e) => e.registryId !== registryId);
  return persistOrderRegistry(list);
}

export function registryEntryToOrder(entry) {
  if (!entry) return null;
  return {
    order_id: entry.order_id,
    base: entry.base,
    quote: entry.quote,
    trade_dir: entry.trade_dir,
    price: entry.price,
    original_price: entry.original_price,
    price_porc: entry.price_porc,
    price_min: entry.price_min,
    follow_target: entry.follow_target,
    follow_target_order_id: entry.follow_target_order_id,
    follow_ref_order_id: entry.follow_ref_order_id,
    amount: entry.amount,
    book_label: entry.book_label,
  };
}
