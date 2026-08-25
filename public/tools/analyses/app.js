/**
 * Espelho JS do engine/formulas.py — recalcula instantâneo ao mudar pesos.
 */
function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function scoreStat(rsi14, weekZ, vol7, vol30) {
  const rsiTerm = clamp((70 - rsi14) / 20, -2, 2);
  const zTerm = clamp(-weekZ / 2, -2, 2);
  const volRatio = vol30 > 0 ? vol7 / vol30 : 1;
  const volTerm = clamp((1.2 - volRatio) / 0.6, -2, 2);
  const score = clamp(0.5 * rsiTerm + 0.35 * zTerm + 0.15 * volTerm, -2, 2);
  return {
    score,
    detail: `rsi=${rsiTerm.toFixed(2)}; z=${zTerm.toFixed(2)}; vol=${volTerm.toFixed(2)}`,
  };
}

function scoreHist(n, fwd7, fwd30, win7) {
  if (n < 3) return { score: 0, detail: `n=${n} insuficiente → 0` };
  const fwdTerm = clamp(fwd30 / 10, -2, 2);
  const winTerm = clamp((win7 - 50) / 25, -2, 2);
  const conf = clamp(0.4 + 0.06 * n, 0.4, 1);
  const score = clamp(conf * (0.65 * fwdTerm + 0.35 * winTerm), -2, 2);
  return {
    score,
    detail: `fwd30=${fwdTerm.toFixed(2)}; win7=${winTerm.toFixed(2)}; conf=${conf.toFixed(2)}`,
  };
}

function scoreMacro(dxy, spx, gold, vix, netLiq4w, hy, t10y2y) {
  const dxyT = clamp(-dxy / 2, -2, 2);
  const spxT = clamp(spx / 3, -2, 2);
  const terms = [dxyT, spxT];
  const parts = [`usd=${dxyT.toFixed(2)}`, `spx=${spxT.toFixed(2)}`];
  const vixT = clamp((20 - (vix ?? 20)) / 10, -2, 2);
  terms.push(vixT);
  parts.push(`vix=${vixT.toFixed(2)}`);
  const hyT = clamp((4 - (hy ?? 4)) / 2, -2, 2);
  terms.push(hyT);
  parts.push(`hy=${hyT.toFixed(2)}`);
  const curveT = clamp((t10y2y ?? 0) / 0.5, -2, 2);
  terms.push(curveT);
  parts.push(`curve=${curveT.toFixed(2)}`);
  if (gold) {
    const goldT = clamp(gold / 5, -2, 2);
    terms.push(goldT);
    parts.push(`gold=${goldT.toFixed(2)}`);
  }
  if (netLiq4w != null && !Number.isNaN(netLiq4w)) {
    const liqT = clamp(netLiq4w / 2, -2, 2);
    terms.push(liqT);
    parts.push(`netLiq=${liqT.toFixed(2)}`);
  }
  return {
    score: clamp(terms.reduce((a, b) => a + b, 0) / terms.length, -2, 2),
    detail: parts.join("; "),
  };
}

function scoreSentiment(fg, sentimentUp, funding, lsr) {
  const fgT = clamp((50 - fg) / 25, -2, 2);
  const sentT = clamp((50 - sentimentUp) / 25, -2, 2);
  const fundT = clamp(-funding / 0.03, -2, 2);
  const lsrT = clamp((1 - lsr) / 0.5, -2, 2);
  const score = clamp(0.4 * fgT + 0.25 * sentT + 0.2 * fundT + 0.15 * lsrT, -2, 2);
  return {
    score,
    detail: `fg=${fgT.toFixed(2)}; sent=${sentT.toFixed(2)}; fund=${fundT.toFixed(2)}; lsr=${lsrT.toFixed(2)}`,
  };
}

function scoreStructure(ddAth) {
  const score = clamp(-ddAth / 25, -2, 2);
  return { score, detail: `dd=${ddAth.toFixed(1)}% → ${score.toFixed(2)}` };
}

function sellFraction(total) {
  return clamp(0.35 - 0.2 * total, 0, 0.85);
}

function actionFromTotal(total, sell) {
  const lo = Math.round(Math.max(0, sell * 100 - 8));
  const hi = Math.round(Math.min(85, sell * 100 + 8));
  if (total >= 1)
    return { action: "MANTER / adicionar só com plano", lo, hi };
  if (total >= -0.25)
    return { action: "REALIZAR PARCIAL", lo, hi };
  if (total >= -1)
    return { action: "REDUZIR SIGNIFICATIVO", lo, hi };
  return { action: "DESALAVANCAR FORTE", lo, hi };
}

function computeFromInputs(inp, weights) {
  const pillars = [
    {
      name: "Estatística",
      weight: weights.stat,
      ...scoreStat(inp.rsi14, inp.week_zscore, inp.vol_ann_7d_pct, inp.vol_ann_30d_pct),
    },
    {
      name: "Histórico pós-rally",
      weight: weights.hist,
      ...scoreHist(inp.hist_n, inp.hist_fwd7_avg, inp.hist_fwd30_avg, inp.hist_fwd7_win),
    },
    {
      name: "Macro",
      weight: weights.macro,
      ...scoreMacro(
        inp.dxy_1m_pct,
        inp.spx_1m_pct,
        inp.gold_1m_pct,
        inp.vix_last,
        inp.net_liq_4w_pct,
        inp.hy_oas_last,
        inp.t10y2y_last
      ),
    },
    {
      name: "Sentimento",
      weight: weights.sentiment,
      ...scoreSentiment(
        inp.fear_greed,
        inp.sentiment_up_pct,
        inp.funding_8h_pct,
        inp.long_short_ratio
      ),
    },
    {
      name: "Estrutura vs ATH",
      weight: weights.structure,
      ...scoreStructure(inp.dd_from_ath_pct),
    },
  ].map((p) => ({ ...p, contribution: p.score * p.weight }));

  const wsum = pillars.reduce((s, p) => s + p.weight, 0) || 1;
  const total = pillars.reduce((s, p) => s + p.contribution, 0) / wsum;
  const sell = sellFraction(total);
  const act = actionFromTotal(total, sell);
  return { total, sell_fraction: sell, pillars, ...act };
}

function fmtPct(x, digits = 1) {
  const n = Number(x);
  const sign = n > 0 ? "+" : "";
  return sign + n.toFixed(digits) + "%";
}

function fmtMoney(x) {
  return "$" + Number(x).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function sparkline(values, width, height, color) {
  if (!values || values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none">
    <polyline fill="none" stroke="${color}" stroke-width="2" points="${pts}" />
  </svg>`;
}

let latestInputs = null;
let latestMeta = null;

function readWeights() {
  return {
    stat: Number(document.getElementById("w-stat").value),
    hist: Number(document.getElementById("w-hist").value),
    macro: Number(document.getElementById("w-macro").value),
    sentiment: Number(document.getElementById("w-sentiment").value),
    structure: Number(document.getElementById("w-structure").value),
  };
}

function syncWeightLabels() {
  for (const id of ["stat", "hist", "macro", "sentiment", "structure"]) {
    document.getElementById(`v-${id}`).textContent = Number(
      document.getElementById(`w-${id}`).value
    ).toFixed(2);
  }
}

function render(decision) {
  const el = document.getElementById("verdict");
  el.className = "verdict " + (decision.total >= 0 ? "ok" : "warn");
  el.innerHTML = `
    <div class="eyebrow">Veredito dinâmico</div>
    <h2>${decision.action}</h2>
    <p>Score total <strong>${decision.total.toFixed(2)}</strong> ∈ [-2, +2] ·
       liquidar sugerido <strong>${decision.lo}–${decision.hi}%</strong>
       (fração ${ (decision.sell_fraction * 100).toFixed(0) }%)</p>
  `;

  document.getElementById("stats").innerHTML = `
    <div class="stat"><div class="k">Preço</div><div class="v">${fmtMoney(latestInputs.price)}</div></div>
    <div class="stat"><div class="k">7 dias</div><div class="v">${fmtPct(latestInputs.ret_7d_pct)}</div></div>
    <div class="stat"><div class="k">RSI(14)</div><div class="v">${latestInputs.rsi14.toFixed(1)}</div></div>
    <div class="stat"><div class="k">Fear & Greed</div><div class="v">${latestInputs.fear_greed}</div></div>
    <div class="stat"><div class="k">Z-score semana</div><div class="v">${latestInputs.week_zscore.toFixed(2)}</div></div>
    <div class="stat"><div class="k">vs ATH</div><div class="v">${fmtPct(latestInputs.dd_from_ath_pct)}</div></div>
  `;

  const netLiq =
    latestInputs.net_liq_4w_pct == null
      ? "—"
      : fmtPct(latestInputs.net_liq_4w_pct);
  document.getElementById("macro-stats").innerHTML = `
    <div class="stat"><div class="k">USD broad 1m</div><div class="v">${fmtPct(latestInputs.dxy_1m_pct)}</div></div>
    <div class="stat"><div class="k">S&P 500 1m</div><div class="v">${fmtPct(latestInputs.spx_1m_pct)}</div></div>
    <div class="stat"><div class="k">VIX</div><div class="v">${Number(latestInputs.vix_last || 0).toFixed(1)}</div></div>
    <div class="stat"><div class="k">Net Liq 4w</div><div class="v">${netLiq}</div></div>
    <div class="stat"><div class="k">HY OAS</div><div class="v">${Number(latestInputs.hy_oas_last || 0).toFixed(2)}</div></div>
    <div class="stat"><div class="k">10Y−2Y</div><div class="v">${Number(latestInputs.t10y2y_last || 0).toFixed(2)}</div></div>
  `;
  document.getElementById("macro-source").innerHTML = latestInputs.macro_source
    ? `Fonte macro: <code>${latestInputs.macro_source}</code> ·
       <a href="https://rodolforomao.com.br/macro-dashboard" target="_blank" rel="noopener">abrir Macro Dashboard</a>`
    : "";

  const maxAbs = Math.max(...decision.pillars.map((p) => Math.abs(p.score)), 0.01);
  document.getElementById("pillars").innerHTML = decision.pillars
    .map((p) => {
      const pct = (Math.abs(p.score) / 2) * 100;
      const tone = p.score >= 0 ? "pos" : "neg";
      return `<div class="pillar">
        <div class="row"><strong>${p.name}</strong><span>${p.score.toFixed(2)} · w=${p.weight}</span></div>
        <div class="bar"><i class="${tone}" style="width:${pct}%"></i></div>
        <div class="detail">${p.detail}</div>
      </div>`;
    })
    .join("");

  document.getElementById("formulas").innerHTML = Object.entries(
    latestMeta.formulas || {}
  )
    .map(([k, v]) => `<tr><td><code>${k}</code></td><td><code>${v}</code></td></tr>`)
    .join("");

  if (latestMeta.series) {
    document.getElementById("chart-price").innerHTML = sparkline(
      latestMeta.series.price_30d,
      600,
      120,
      "var(--accent)"
    );
    document.getElementById("chart-fg").innerHTML = sparkline(
      latestMeta.series.fg,
      600,
      120,
      "var(--warn)"
    );
  }

  document.getElementById("asof").textContent = latestMeta.as_of_utc
    ? `Atualizado: ${latestMeta.as_of_utc}`
    : "";
}

function recomputeLocal() {
  if (!latestInputs) return;
  syncWeightLabels();
  const d = computeFromInputs(latestInputs, readWeights());
  render(d);
}

async function refreshLive() {
  const btn = document.getElementById("btn-refresh");
  btn.disabled = true;
  btn.textContent = "Coletando mercado…";
  document.getElementById("status").textContent = "Buscando Binance / F&G / Yahoo…";
  try {
    // Prefer API ao vivo (dev: setupProxy → serve_live.py); fallback: snapshot local.
    let data;
    try {
      const w = readWeights();
      const q = new URLSearchParams(w).toString();
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 800);
      const liveRes = await fetch("/api/analyses/live?" + q, { signal: ac.signal });
      clearTimeout(timer);
      if (liveRes.ok) {
        data = await liveRes.json();
      }
    } catch (_) {
      /* fallback abaixo */
    }
    if (!data || data.error) {
      const res = await fetch(new URL("./live.json", window.location.href));
      data = await res.json();
    }
    if (data.error) throw new Error(data.error);
    latestInputs = data.inputs;
    latestMeta = {
      as_of_utc: data.as_of_utc,
      formulas: data.formulas,
      series: data.series,
    };
    document.getElementById("status").textContent = "OK — fórmulas aplicadas aos dados ao vivo";
    recomputeLocal();
  } catch (e) {
    document.getElementById("status").textContent = "Erro: " + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Atualizar dados ao vivo";
  }
}

function resetWeights() {
  const defaults = { stat: 1, hist: 0.8, macro: 1, sentiment: 1, structure: 0.7 };
  for (const [k, v] of Object.entries(defaults)) {
    document.getElementById(`w-${k}`).value = v;
  }
  recomputeLocal();
}

document.addEventListener("DOMContentLoaded", () => {
  for (const id of ["stat", "hist", "macro", "sentiment", "structure"]) {
    document.getElementById(`w-${id}`).addEventListener("input", recomputeLocal);
  }
  document.getElementById("btn-refresh").addEventListener("click", refreshLive);
  document.getElementById("btn-reset").addEventListener("click", resetWeights);
  syncWeightLabels();
  refreshLive();
});
