// Align two series by date intersection
export function alignSeries(s1, s2) {
  const map2 = new Map(s2.map(d => [d.date, d.value]));
  const aligned = s1.filter(d => map2.has(d.date)).map(d => ({
    date: d.date,
    v1: d.value,
    v2: map2.get(d.date),
  }));
  return aligned;
}

export function calculateMA(data, period = 20) {
  return data.map((d, i) => {
    if (i < period - 1) return { date: d.date, value: null };
    const slice = data.slice(i - period + 1, i + 1);
    const avg = slice.reduce((s, x) => s + x.value, 0) / period;
    return { date: d.date, value: avg };
  }).filter(d => d.value !== null);
}

export function calculateEMA(data, period = 20) {
  const k = 2 / (period + 1);
  const result = [];
  let ema = data[0]?.value || 0;
  data.forEach((d, i) => {
    if (i === 0) { result.push({ date: d.date, value: d.value }); return; }
    ema = d.value * k + ema * (1 - k);
    result.push({ date: d.date, value: ema });
  });
  return result;
}

export function calculateDerivative(data) {
  return data.slice(1).map((d, i) => ({
    date: d.date,
    value: d.value - data[i].value,
  }));
}

export function calculateSecondDerivative(data) {
  return calculateDerivative(calculateDerivative(data));
}

export function calculateZScore(data, lookback = 252) {
  return data.map((d, i) => {
    if (i < lookback - 1) return { date: d.date, value: null };
    const slice = data.slice(i - lookback + 1, i + 1).map(x => x.value);
    const mean = slice.reduce((s, v) => s + v, 0) / lookback;
    const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / lookback;
    const std = Math.sqrt(variance);
    return { date: d.date, value: std === 0 ? 0 : (d.value - mean) / std };
  }).filter(d => d.value !== null);
}

export function calculateStdDev(data, lookback = 20) {
  return data.map((d, i) => {
    if (i < lookback - 1) return { date: d.date, value: null };
    const slice = data.slice(i - lookback + 1, i + 1).map(x => x.value);
    const mean = slice.reduce((s, v) => s + v, 0) / lookback;
    const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / lookback;
    return { date: d.date, value: Math.sqrt(variance) };
  }).filter(d => d.value !== null);
}

export function calculatePercentile(value, data) {
  const values = data.map(d => d.value).sort((a, b) => a - b);
  const below = values.filter(v => v <= value).length;
  return (below / values.length) * 100;
}

export function normalizeBase100(data) {
  if (!data.length) return data;
  const base = data[0].value;
  if (base === 0) return data;
  return data.map(d => ({ date: d.date, value: (d.value / base) * 100 }));
}

export function calculateCorrelation(series1, series2) {
  const aligned = alignSeries(series1, series2);
  if (aligned.length < 2) return null;
  const n = aligned.length;
  const mean1 = aligned.reduce((s, d) => s + d.v1, 0) / n;
  const mean2 = aligned.reduce((s, d) => s + d.v2, 0) / n;
  const num = aligned.reduce((s, d) => s + (d.v1 - mean1) * (d.v2 - mean2), 0);
  const den1 = Math.sqrt(aligned.reduce((s, d) => s + Math.pow(d.v1 - mean1, 2), 0));
  const den2 = Math.sqrt(aligned.reduce((s, d) => s + Math.pow(d.v2 - mean2, 2), 0));
  return den1 * den2 === 0 ? 0 : num / (den1 * den2);
}

export function calculateRollingCorrelation(series1, series2, window = 90) {
  const aligned = alignSeries(series1, series2);
  if (aligned.length < window) return [];
  return aligned.slice(window - 1).map((d, i) => {
    const slice = aligned.slice(i, i + window);
    const mean1 = slice.reduce((s, x) => s + x.v1, 0) / window;
    const mean2 = slice.reduce((s, x) => s + x.v2, 0) / window;
    const num = slice.reduce((s, x) => s + (x.v1 - mean1) * (x.v2 - mean2), 0);
    const d1 = Math.sqrt(slice.reduce((s, x) => s + Math.pow(x.v1 - mean1, 2), 0));
    const d2 = Math.sqrt(slice.reduce((s, x) => s + Math.pow(x.v2 - mean2, 2), 0));
    const corr = d1 * d2 === 0 ? 0 : num / (d1 * d2);
    return { date: d.date, value: corr };
  });
}

export function calculateLeadLagCorrelation(series1, series2, maxLag = 180) {
  const lags = [];
  for (let lag = -maxLag; lag <= maxLag; lag += 7) {
    let shifted;
    if (lag >= 0) {
      shifted = series2.slice(lag || 0);
      const base = series1.slice(0, series1.length - lag || undefined);
      const correlation = calculateCorrelation(base, shifted);
      lags.push({ lag, correlation });
    } else {
      shifted = series1.slice(-lag);
      const base = series2.slice(0, series2.length + lag);
      const correlation = calculateCorrelation(shifted, base);
      lags.push({ lag, correlation });
    }
  }
  return lags;
}

export function calculateBollingerBands(data, period = 20, multiplier = 2) {
  const ma = calculateMA(data, period);
  const dates = new Set(ma.map(d => d.date));
  const filtered = data.filter(d => dates.has(d.date));
  return ma.map((m, i) => {
    const slice = filtered.slice(Math.max(0, i - period + 1), i + 1).map(d => d.value);
    const variance = slice.reduce((s, v) => s + Math.pow(v - m.value, 2), 0) / slice.length;
    const std = Math.sqrt(variance);
    return { date: m.date, middle: m.value, upper: m.value + multiplier * std, lower: m.value - multiplier * std };
  });
}
