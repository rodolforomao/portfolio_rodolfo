const PREFS_KEY = 'dealer_console_prefs';

const DEFAULTS = {
  autoRefreshAssets: true,
  autoRefreshIntervalSec: 15,
  defaultHistoryDestination: 'api',
  transactionsSyncOnSelect: true,
};

export function loadDealerPreferences() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveDealerPreferences(partial) {
  const next = { ...loadDealerPreferences(), ...partial };
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
}
