"""
Motor de fórmulas BTC → USDT (sem viés narrativo).

Todos os pilares normalizam para [-2, +2]:
  +2 = favorece manter/aumentar BTC
  -2 = favorece reduzir BTC (USDT)

Score total ponderado ∈ [-2, +2].
sell_fraction ∈ [0, 0.85] — fração sugerida a converter para USDT.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


@dataclass
class Weights:
    stat: float = 1.0
    hist: float = 0.8
    macro: float = 1.0
    sentiment: float = 1.0
    structure: float = 0.7

    def as_dict(self) -> dict[str, float]:
        return asdict(self)


DEFAULT_WEIGHTS = Weights()


@dataclass
class MarketInputs:
    price: float
    ret_7d_pct: float
    ret_30d_pct: float
    rsi14: float
    week_zscore: float
    vol_ann_7d_pct: float
    vol_ann_30d_pct: float
    fear_greed: float
    sentiment_up_pct: float
    funding_8h_pct: float
    long_short_ratio: float
    dxy_1m_pct: float  # Broad USD (DTWEXBGS) ou DXY
    spx_1m_pct: float
    gold_1m_pct: float
    tnx_last: float
    dd_from_ath_pct: float  # negativo se abaixo do ATH, ex. -39
    hist_n: int
    hist_fwd7_avg: float
    hist_fwd30_avg: float
    hist_fwd7_win: float
    btc_dominance_pct: float = 0.0
    # MacroDash (FRED via rodolforomao proxy)
    vix_last: float = 20.0
    vix_1m_chg: float = 0.0
    net_liq_4w_pct: float | None = None
    hy_oas_last: float = 4.0
    t10y2y_last: float = 0.0
    dollar_last: float = 0.0
    macro_source: str = ""
    price_series_30d: list[float] = field(default_factory=list)
    price_labels_30d: list[str] = field(default_factory=list)
    fg_series: list[float] = field(default_factory=list)
    fg_labels: list[str] = field(default_factory=list)


@dataclass
class PillarScore:
    name: str
    score: float
    weight: float
    contribution: float
    detail: str


@dataclass
class Decision:
    total: float
    sell_fraction: float
    sell_pct_lo: int
    sell_pct_hi: int
    action: str
    rationale: str
    pillars: list[PillarScore]
    formulas: dict[str, str]


# --- Fórmulas dos pilares -------------------------------------------------


def score_stat(rsi14: float, week_z: float, vol7: float, vol30: float) -> tuple[float, str]:
    """Sobrecompra + spike estatístico → score negativo para manter BTC."""
    rsi_term = clamp((70.0 - rsi14) / 20.0, -2.0, 2.0)
    z_term = clamp(-week_z / 2.0, -2.0, 2.0)
    vol_ratio = (vol7 / vol30) if vol30 > 0 else 1.0
    vol_term = clamp((1.2 - vol_ratio) / 0.6, -2.0, 2.0)
    score = 0.5 * rsi_term + 0.35 * z_term + 0.15 * vol_term
    detail = (
        f"rsi_term={rsi_term:.2f} (RSI={rsi14:.1f}); "
        f"z_term={z_term:.2f} (z={week_z:.2f}); "
        f"vol_term={vol_term:.2f} (vol7/vol30={vol_ratio:.2f})"
    )
    return clamp(score, -2, 2), detail


def score_hist(n: int, fwd7: float, fwd30: float, win7: float) -> tuple[float, str]:
    """Continuidade histórica após rallies similares."""
    if n < 3:
        return 0.0, f"n={n} insuficiente → score neutro (0)"
    # fwd30 médio / 10 mapeia ~±20% → ±2
    fwd_term = clamp(fwd30 / 10.0, -2.0, 2.0)
    win_term = clamp((win7 - 50.0) / 25.0, -2.0, 2.0)
    # sample-size dampening: n=3→0.6, n=10→1.0
    conf = clamp(0.4 + 0.06 * n, 0.4, 1.0)
    score = conf * (0.65 * fwd_term + 0.35 * win_term)
    detail = (
        f"fwd30_term={fwd_term:.2f} ({fwd30:+.1f}%); "
        f"win7_term={win_term:.2f} ({win7:.0f}%); conf={conf:.2f} (n={n})"
    )
    return clamp(score, -2, 2), detail


def score_macro(
    dxy_1m: float,
    spx_1m: float,
    gold_1m: float,
    vix_last: float = 20.0,
    net_liq_4w_pct: float | None = None,
    hy_oas: float = 4.0,
    t10y2y: float = 0.0,
) -> tuple[float, str]:
    """
    Macro alinhado ao MacroDash:
      dólar fraco, SPX firme, VIX baixo, liquidez líquida subindo,
      HY OAS contido, curva não invertida → favorece BTC.
    """
    dxy_t = clamp(-dxy_1m / 2.0, -2.0, 2.0)
    spx_t = clamp(spx_1m / 3.0, -2.0, 2.0)
    gold_t = clamp(gold_1m / 5.0, -2.0, 2.0) if gold_1m else 0.0
    vix_t = clamp((20.0 - vix_last) / 10.0, -2.0, 2.0)
    hy_t = clamp((4.0 - hy_oas) / 2.0, -2.0, 2.0)
    curve_t = clamp(t10y2y / 0.5, -2.0, 2.0)
    terms = [dxy_t, spx_t, vix_t, hy_t, curve_t]
    parts = [
        f"usd={dxy_t:.2f}",
        f"spx={spx_t:.2f}",
        f"vix={vix_t:.2f}({vix_last:.1f})",
        f"hy={hy_t:.2f}({hy_oas:.2f})",
        f"curve={curve_t:.2f}",
    ]
    if gold_1m:
        terms.append(gold_t)
        parts.append(f"gold={gold_t:.2f}")
    if net_liq_4w_pct is not None:
        liq_t = clamp(net_liq_4w_pct / 2.0, -2.0, 2.0)
        terms.append(liq_t)
        parts.append(f"netLiq4w={liq_t:.2f}({net_liq_4w_pct:+.1f}%)")
    score = sum(terms) / len(terms)
    return clamp(score, -2, 2), "; ".join(parts)


def score_sentiment(
    fg: float, sentiment_up: float, funding_8h: float, lsr: float
) -> tuple[float, str]:
    """Greed / otimismo extremo → favorece reduzir."""
    fg_t = clamp((50.0 - fg) / 25.0, -2.0, 2.0)
    sent_t = clamp((50.0 - sentiment_up) / 25.0, -2.0, 2.0)
    # funding típico ~0.01% / 8h; >0.05% já crowding
    fund_t = clamp(-funding_8h / 0.03, -2.0, 2.0)
    # L/S muito alto = crowded long; ~1 neutro
    lsr_t = clamp((1.0 - lsr) / 0.5, -2.0, 2.0)
    score = 0.4 * fg_t + 0.25 * sent_t + 0.2 * fund_t + 0.15 * lsr_t
    detail = (
        f"fg={fg_t:.2f} ({fg:.0f}); sent={sent_t:.2f} ({sentiment_up:.0f}%); "
        f"fund={fund_t:.2f} ({funding_8h:.4f}%); lsr={lsr_t:.2f} ({lsr:.2f})"
    )
    return clamp(score, -2, 2), detail


def score_structure(dd_from_ath: float) -> tuple[float, str]:
    """Drawdown profundo vs ATH → menos tese de topo de ciclo."""
    # dd=-40 → +1.6; dd=0 → 0; dd=+5 (novo ATH) → levemente negativo
    score = clamp(-dd_from_ath / 25.0, -2.0, 2.0)
    detail = f"dd_ath={dd_from_ath:.1f}% → structure={score:.2f}"
    return score, detail


def sell_fraction_from_total(total: float) -> float:
    """
    Mapeia score total → fração a liquidar.
    total=+2 → ~0%; total=0 → 35%; total=-2 → 75%.
    """
    return clamp(0.35 - 0.20 * total, 0.0, 0.85)


def action_from_total(total: float, sell_frac: float) -> tuple[str, str, int, int]:
    lo = int(round(max(0, sell_frac * 100 - 8)))
    hi = int(round(min(85, sell_frac * 100 + 8)))
    if total >= 1.0:
        return (
            "MANTER / adicionar só com plano",
            "Score ≥ +1: macro/estrutura dominam; saída total não justificada.",
            lo,
            hi,
        )
    if total >= -0.25:
        return (
            "REALIZAR PARCIAL",
            "Score neutro/leve negativo: trava ganho sem abandonar tendência.",
            lo,
            hi,
        )
    if total >= -1.0:
        return (
            "REDUZIR SIGNIFICATIVO",
            "Sobrecompra + sentimento quente: corte material de risco.",
            lo,
            hi,
        )
    return (
        "DESALAVANCAR FORTE",
        "Sinais alinhados contra risco tático; preserve capital em USDT.",
        lo,
        hi,
    )


def compute(inputs: MarketInputs, weights: Weights | None = None) -> Decision:
    w = weights or DEFAULT_WEIGHTS

    s_stat, d_stat = score_stat(
        inputs.rsi14, inputs.week_zscore, inputs.vol_ann_7d_pct, inputs.vol_ann_30d_pct
    )
    s_hist, d_hist = score_hist(
        inputs.hist_n, inputs.hist_fwd7_avg, inputs.hist_fwd30_avg, inputs.hist_fwd7_win
    )
    s_macro, d_macro = score_macro(
        inputs.dxy_1m_pct,
        inputs.spx_1m_pct,
        inputs.gold_1m_pct,
        vix_last=inputs.vix_last,
        net_liq_4w_pct=inputs.net_liq_4w_pct,
        hy_oas=inputs.hy_oas_last,
        t10y2y=inputs.t10y2y_last,
    )
    s_sent, d_sent = score_sentiment(
        inputs.fear_greed,
        inputs.sentiment_up_pct,
        inputs.funding_8h_pct,
        inputs.long_short_ratio,
    )
    s_struct, d_struct = score_structure(inputs.dd_from_ath_pct)

    pillars = [
        PillarScore("Estatística", s_stat, w.stat, s_stat * w.stat, d_stat),
        PillarScore("Histórico pós-rally", s_hist, w.hist, s_hist * w.hist, d_hist),
        PillarScore("Macro", s_macro, w.macro, s_macro * w.macro, d_macro),
        PillarScore("Sentimento", s_sent, w.sentiment, s_sent * w.sentiment, d_sent),
        PillarScore("Estrutura vs ATH", s_struct, w.structure, s_struct * w.structure, d_struct),
    ]

    wsum = sum(p.weight for p in pillars) or 1.0
    total = sum(p.contribution for p in pillars) / wsum
    sell = sell_fraction_from_total(total)
    action, rationale, lo, hi = action_from_total(total, sell)

    formulas = {
        "rsi_term": "clamp((70 - RSI) / 20, -2, 2)",
        "z_term": "clamp(-z_week / 2, -2, 2)",
        "vol_term": "clamp((1.2 - vol7/vol30) / 0.6, -2, 2)",
        "stat": "0.5*rsi_term + 0.35*z_term + 0.15*vol_term",
        "hist": "conf(n) * (0.65*clamp(fwd30/10) + 0.35*clamp((win7-50)/25))",
        "macro": "mean(usd, spx, vix, hy, curve[, gold][, netLiq4w]) via MacroDash/FRED",
        "sentiment": "0.4*fg + 0.25*votes + 0.2*funding + 0.15*lsr",
        "structure": "clamp(-dd_ath / 25, -2, 2)",
        "total": "Σ(w_i * score_i) / Σ(w_i)",
        "sell_fraction": "clamp(0.35 - 0.20 * total, 0, 0.85)",
    }

    return Decision(
        total=round(total, 3),
        sell_fraction=round(sell, 3),
        sell_pct_lo=lo,
        sell_pct_hi=hi,
        action=action,
        rationale=rationale,
        pillars=pillars,
        formulas=formulas,
    )


def decision_to_dict(d: Decision, inputs: MarketInputs, weights: Weights) -> dict[str, Any]:
    return {
        "total": d.total,
        "sell_fraction": d.sell_fraction,
        "sell_pct_range": [d.sell_pct_lo, d.sell_pct_hi],
        "action": d.action,
        "rationale": d.rationale,
        "weights": weights.as_dict(),
        "pillars": [
            {
                "name": p.name,
                "score": round(p.score, 3),
                "weight": p.weight,
                "contribution": round(p.contribution, 3),
                "detail": p.detail,
            }
            for p in d.pillars
        ],
        "formulas": d.formulas,
        "inputs": {
            "price": inputs.price,
            "ret_7d_pct": inputs.ret_7d_pct,
            "ret_30d_pct": inputs.ret_30d_pct,
            "rsi14": inputs.rsi14,
            "week_zscore": inputs.week_zscore,
            "vol_ann_7d_pct": inputs.vol_ann_7d_pct,
            "vol_ann_30d_pct": inputs.vol_ann_30d_pct,
            "fear_greed": inputs.fear_greed,
            "sentiment_up_pct": inputs.sentiment_up_pct,
            "funding_8h_pct": inputs.funding_8h_pct,
            "long_short_ratio": inputs.long_short_ratio,
            "dxy_1m_pct": inputs.dxy_1m_pct,
            "spx_1m_pct": inputs.spx_1m_pct,
            "gold_1m_pct": inputs.gold_1m_pct,
            "tnx_last": inputs.tnx_last,
            "dd_from_ath_pct": inputs.dd_from_ath_pct,
            "hist_n": inputs.hist_n,
            "hist_fwd7_avg": inputs.hist_fwd7_avg,
            "hist_fwd30_avg": inputs.hist_fwd30_avg,
            "hist_fwd7_win": inputs.hist_fwd7_win,
            "btc_dominance_pct": inputs.btc_dominance_pct,
            "vix_last": inputs.vix_last,
            "vix_1m_chg": inputs.vix_1m_chg,
            "net_liq_4w_pct": inputs.net_liq_4w_pct,
            "hy_oas_last": inputs.hy_oas_last,
            "t10y2y_last": inputs.t10y2y_last,
            "dollar_last": inputs.dollar_last,
            "macro_source": inputs.macro_source,
        },
        "series": {
            "price_30d_labels": inputs.price_labels_30d,
            "price_30d": inputs.price_series_30d,
            "fg_labels": inputs.fg_labels,
            "fg": inputs.fg_series,
        },
    }
