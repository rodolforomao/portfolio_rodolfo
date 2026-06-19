export function formatNumber(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return 'N/A';
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(decimals) + 'T';
  if (abs >= 1e9) return (n / 1e9).toFixed(decimals) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(decimals) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(decimals) + 'K';
  return n.toFixed(decimals);
}

export function formatPercent(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return 'N/A';
  return (n >= 0 ? '+' : '') + n.toFixed(decimals) + '%';
}

export function formatCurrency(n) {
  if (n === null || n === undefined || isNaN(n)) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(n);
}

export function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateShort(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
}

export function getChangeColor(value) {
  if (value === null || value === undefined) return '#8b949e';
  return value >= 0 ? '#3fb950' : '#f85149';
}

export function getSpreadColor(value, threshold = 0) {
  return value > threshold ? '#f85149' : '#3fb950';
}
