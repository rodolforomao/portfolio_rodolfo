#!/usr/bin/env node
/**
 * Valida os cálculos do Macro Dashboard contra dados brutos da FRED API.
 * Uso: node scripts/validate-dashboard.js
 * Requer REACT_APP_FRED_API_KEY no .env ou variável de ambiente.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

function loadApiKey() {
  if (process.env.REACT_APP_FRED_API_KEY) return process.env.REACT_APP_FRED_API_KEY;
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const match = fs.readFileSync(envPath, 'utf8').match(/REACT_APP_FRED_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }
  throw new Error('REACT_APP_FRED_API_KEY não encontrada');
}

function fetchFred(seriesId, start = '2015-01-01') {
  const key = loadApiKey();
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&observation_start=${start}&sort_order=asc`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.error_code) reject(new Error(json.error_message));
          else resolve(
            json.observations
              .filter((o) => o.value !== '.' && o.value !== '')
              .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
          );
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function forwardFill(targetDates, sourceSeries) {
  const map = new Map(sourceSeries.map((d) => [d.date, d.value]));
  const sorted = [...map.keys()].sort();
  let last = 0;
  return targetDates.map((date) => {
    if (map.has(date)) last = map.get(date);
    else {
      const prior = sorted.filter((d) => d <= date).pop();
      if (prior) last = map.get(prior);
    }
    return { date, value: last };
  });
}

function calcNetLiquidity(walcl, wtregen, rrpon) {
  const rrFilled = forwardFill(
    walcl.map((d) => d.date),
    rrpon.map((d) => ({ date: d.date, value: d.value * 1000 }))
  );
  const rrMap = new Map(rrFilled.map((d) => [d.date, d.value]));
  const tgaMap = new Map(wtregen.map((d) => [d.date, d.value]));
  return walcl
    .filter((d) => tgaMap.has(d.date))
    .map((d) => ({
      date: d.date,
      value: d.value - tgaMap.get(d.date) - (rrMap.get(d.date) || 0),
    }));
}

function pctChange(series, n) {
  if (series.length < n + 1) return null;
  const latest = series[series.length - 1].value;
  const prev = series[series.length - 1 - n].value;
  return ((latest - prev) / Math.abs(prev)) * 100;
}

const FRED_LINKS = {
  WALCL: 'https://fred.stlouisfed.org/series/WALCL',
  WTREGEN: 'https://fred.stlouisfed.org/series/WTREGEN',
  RRPONTSYD: 'https://fred.stlouisfed.org/series/RRPONTSYD',
  T10Y2Y: 'https://fred.stlouisfed.org/series/T10Y2Y',
  T10Y3M: 'https://fred.stlouisfed.org/series/T10Y3M',
  DGS10: 'https://fred.stlouisfed.org/series/DGS10',
  DGS2: 'https://fred.stlouisfed.org/series/DGS2',
  DTWEXBGS: 'https://fred.stlouisfed.org/series/DTWEXBGS',
  VIXCLS: 'https://fred.stlouisfed.org/series/VIXCLS',
  BAMLH0A0HYM2: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2',
};

function fmt(n, dec = 2) {
  return n == null ? 'N/A' : n.toFixed(dec);
}

async function main() {
  console.log('=== Validação Macro Dashboard vs FRED ===\n');
  console.log(`Data: ${new Date().toISOString().slice(0, 10)}\n`);

  const [walcl, wtregen, rrpon, t10y2y, t10y3m, dgs10, dgs2, dxy, vix, hy] = await Promise.all([
    fetchFred('WALCL', '2020-01-01'),
    fetchFred('WTREGEN', '2020-01-01'),
    fetchFred('RRPONTSYD', '2020-01-01'),
    fetchFred('T10Y2Y', '2026-01-01'),
    fetchFred('T10Y3M', '2026-01-01'),
    fetchFred('DGS10', '2026-01-01'),
    fetchFred('DGS2', '2026-01-01'),
    fetchFred('DTWEXBGS', '2026-01-01'),
    fetchFred('VIXCLS', '2026-01-01'),
    fetchFred('BAMLH0A0HYM2', '2026-01-01'),
  ]);

  const netLiq = calcNetLiquidity(walcl, wtregen, rrpon);
  const latest = netLiq[netLiq.length - 1];
  const w = walcl[walcl.length - 1];
  const t = wtregen[wtregen.length - 1];
  const r = rrpon[rrpon.length - 1];

  console.log('── Liquidez Líquida do Fed ──');
  console.log(`Fórmula: WALCL - TGA(WTREGEN) - RRP(RRPONTSYD × 1000)`);
  console.log(`Data: ${latest.date}`);
  console.log(`  WALCL:  ${(w.value / 1e6).toFixed(3)}T  →  ${FRED_LINKS.WALCL}`);
  console.log(`  TGA:    ${(t.value / 1e6).toFixed(3)}T  →  ${FRED_LINKS.WTREGEN}`);
  console.log(`  RRP:    ${((r.value * 1000) / 1e6).toFixed(3)}T  →  ${FRED_LINKS.RRPONTSYD}`);
  console.log(`  NET:    ${(latest.value / 1e6).toFixed(3)}T`);
  console.log(`  7d Δ:   ${fmt(pctChange(netLiq, 1))}%  (1 semana)`);
  console.log(`  30d Δ:  ${fmt(pctChange(netLiq, 4))}%  (4 semanas)`);
  console.log(`  90d Δ:  ${fmt(pctChange(netLiq, 13))}%  (13 semanas)`);
  console.log(`  YoY Δ:  ${fmt(pctChange(netLiq, 52))}%  (52 semanas)\n`);

  const t10y2yLatest = t10y2y[t10y2y.length - 1];
  const t10y3mLatest = t10y3m[t10y3m.length - 1];
  const dgs10Latest = dgs10[dgs10.length - 1];
  const dgs2Latest = dgs2[dgs2.length - 1];
  const manualSpread = dgs10Latest.value - dgs2Latest.value;

  console.log('── Curva de Juros ──');
  console.log(`  T10Y2Y:  ${fmt(t10y2yLatest.value)}%  (${t10y2yLatest.date})  →  ${FRED_LINKS.T10Y2Y}`);
  console.log(`  T10Y3M:  ${fmt(t10y3mLatest.value)}%  (${t10y3mLatest.date})  →  ${FRED_LINKS.T10Y3M}`);
  console.log(`  DGS10:   ${fmt(dgs10Latest.value)}%  (${dgs10Latest.date})  →  ${FRED_LINKS.DGS10}`);
  console.log(`  DGS2:    ${fmt(dgs2Latest.value)}%  (${dgs2Latest.date})  →  ${FRED_LINKS.DGS2}`);
  console.log(`  Manual DGS10-DGS2: ${fmt(manualSpread)}%  (diff vs T10Y2Y: ${fmt(Math.abs(manualSpread - t10y2yLatest.value), 3)}pp)\n`);

  const dxyLatest = dxy[dxy.length - 1];
  const vixLatest = vix[vix.length - 1];
  const hyLatest = hy[hy.length - 1];

  console.log('── Outros Indicadores ──');
  console.log(`  DTWEXBGS (DXY):  ${fmt(dxyLatest.value, 4)}  (${dxyLatest.date})  →  ${FRED_LINKS.DTWEXBGS}`);
  console.log(`  VIX:             ${fmt(vixLatest.value)}  (${vixLatest.date})  →  ${FRED_LINKS.VIXCLS}`);
  console.log(`  HY OAS:          ${fmt(hyLatest.value)}%  (${hyLatest.date})  →  ${FRED_LINKS.BAMLH0A0HYM2}\n`);

  console.log('── Como conferir visualmente ──');
  console.log('1. Abra cada link FRED acima e compare o valor mais recente com o dashboard');
  console.log('2. No FRED, use o gráfico "Edit Graph" → período 2015-presente para comparar formato');
  console.log('3. Net Liquidity: compare com gráficos de liquidez do Fed (mesma fórmula WALCL-TGA-RRP)');
  console.log('4. Yield curve: T10Y2Y e T10Y3M são séries FRED oficiais — devem bater exatamente');
  console.log('\n✓ Valores acima são calculados com a mesma lógica do dashboard.');
}

main().catch((e) => {
  console.error('Erro:', e.message);
  process.exit(1);
});
