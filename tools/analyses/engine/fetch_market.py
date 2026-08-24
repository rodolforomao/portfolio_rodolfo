"""Coleta de mercado: Binance (preço/derivados) + MacroDash proxy (FRED/CG) + F&G."""

from __future__ import annotations

import json
import math
import statistics
import urllib.request
from datetime import datetime, timezone

from formulas import MarketInputs
from macro_site import collect_macro_site


def get_json(url: str, timeout: int = 45):
    req = urllib.request.Request(url, headers={"User-Agent": "analyses-btc/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def ret(a: float, b: float) -> float:
    return (b - a) / a * 100.0


def rsi(series: list[float], period: int = 14) -> float:
    gains, losses = [], []
    for i in range(1, len(series)):
        d = series[i] - series[i - 1]
        gains.append(max(d, 0.0))
        losses.append(max(-d, 0.0))
    ag = sum(gains[-period:]) / period
    al = sum(losses[-period:]) / period
    if al == 0:
        return 100.0
    return 100.0 - (100.0 / (1.0 + ag / al))


def ann_vol(daily_rets: list[float]) -> float:
    if len(daily_rets) < 2:
        return 0.0
    return statistics.pstdev(daily_rets) * math.sqrt(365) * 100.0


def forward_after_week(daily: list[float], days: list[str], threshold: float) -> dict:
    samples = []
    for i in range(7, len(daily) - 30):
        w = ret(daily[i - 7], daily[i])
        if w >= threshold:
            samples.append(
                {
                    "date": days[i],
                    "fwd7": ret(daily[i], daily[i + 7]),
                    "fwd30": ret(daily[i], daily[i + 30]),
                }
            )
    filtered, last = [], -999
    for s in samples:
        idx = days.index(s["date"])
        if idx - last >= 7:
            filtered.append(s)
            last = idx
    if not filtered:
        return {"n": 0, "fwd7_avg": 0.0, "fwd30_avg": 0.0, "fwd7_win": 50.0}
    f7 = [s["fwd7"] for s in filtered]
    f30 = [s["fwd30"] for s in filtered]
    return {
        "n": len(filtered),
        "fwd7_avg": sum(f7) / len(f7),
        "fwd30_avg": sum(f30) / len(f30),
        "fwd7_win": 100.0 * sum(1 for x in f7 if x > 0) / len(f7),
    }


def yahoo_1m_change(symbol: str) -> tuple[float, float]:
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?range=1mo&interval=1d"
    )
    d = get_json(url)
    closes = [c for c in d["chart"]["result"][0]["indicators"]["quote"][0]["close"] if c]
    last = closes[-1]
    return last, ret(closes[0], last)


def collect() -> MarketInputs:
    kl = get_json(
        "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1000"
    )
    days, daily = [], []
    for c in kl:
        days.append(
            datetime.fromtimestamp(c[0] / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
        )
        daily.append(float(c[4]))

    drets = [(daily[i] - daily[i - 1]) / daily[i - 1] for i in range(1, len(daily))]
    wrets = [ret(daily[i - 7], daily[i]) for i in range(7, len(daily))]
    cur_w = wrets[-1]
    mu, sd = statistics.mean(wrets), statistics.pstdev(wrets)
    z = (cur_w - mu) / sd if sd else 0.0

    ath = max(daily)
    dd = ret(ath, daily[-1])

    thr = 15.0 if cur_w >= 15 else 10.0
    hist = forward_after_week(daily, days, thr)

    fng_raw = get_json("https://api.alternative.me/fng/?limit=14")["data"]
    fg_now = float(fng_raw[0]["value"])
    fg_series = [float(x["value"]) for x in reversed(fng_raw)]
    fg_labels = [
        datetime.fromtimestamp(int(x["timestamp"]), tz=timezone.utc).strftime("%m-%d")
        for x in reversed(fng_raw)
    ]

    funding = (
        float(
            get_json(
                "https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1"
            )[0]["fundingRate"]
        )
        * 100.0
    )
    lsr = float(
        get_json(
            "https://fapi.binance.com/futures/data/globalLongShortAccountRatio"
            "?symbol=BTCUSDT&period=1d&limit=1"
        )[0]["longShortRatio"]
    )

    # --- MacroDash (fonte preferida) ---
    sentiment_up = 50.0
    dominance = 0.0
    dxy_1m = 0.0
    spx_1m = 0.0
    gold_1m = 0.0
    tnx = 0.0
    vix_last = 20.0
    vix_1m_chg = 0.0
    net_liq_4w = None
    hy_oas = 4.0
    t10y2y = 0.0
    dollar_last = 0.0
    macro_source = ""

    try:
        macro = collect_macro_site()
        macro_source = macro.source
        spx_1m = macro.spx_1m_pct
        dxy_1m = macro.dollar_1m_pct  # DTWEXBGS broad USD
        dollar_last = macro.dollar_last
        vix_last = macro.vix_last
        vix_1m_chg = macro.vix_1m_chg
        tnx = macro.dgs10_last
        t10y2y = macro.t10y2y_last
        hy_oas = macro.hy_oas_last or 4.0
        net_liq_4w = macro.net_liq_4w_pct
        dominance = macro.btc_dominance_pct or dominance
        if macro.btc_ath:
            dd = ret(macro.btc_ath, daily[-1])
        # votos CG não vêm do global; tenta info via proxy já usada no bundle
        if macro.btc_price_cg:
            pass
    except Exception as e:
        macro_source = f"fallback-yahoo ({e})"
        try:
            _, dxy_1m = yahoo_1m_change("DX-Y.NYB")
            _, spx_1m = yahoo_1m_change("%5EGSPC")
            _, gold_1m = yahoo_1m_change("GC=F")
            tnx, _ = yahoo_1m_change("%5ETNX")
        except Exception:
            pass

    # Sentimento CG + ATH via proxy (se macro falhou parcialmente)
    try:
        from macro_site import fetch_coingecko

        cg = fetch_coingecko(
            "/coins/bitcoin?localization=false&tickers=false"
            "&community_data=false&developer_data=false"
        )
        sentiment_up = float(cg.get("sentiment_votes_up_percentage") or 50)
        if not dominance:
            g = fetch_coingecko("/global")
            dominance = float(g["data"]["market_cap_percentage"]["btc"])
        ath_cg = float(cg["market_data"]["ath"]["usd"])
        dd = ret(ath_cg, daily[-1])
    except Exception:
        pass

    # Ouro: série FRED do site está descontinuada — Yahoo como complemento opcional
    if gold_1m == 0.0:
        try:
            _, gold_1m = yahoo_1m_change("GC=F")
        except Exception:
            gold_1m = 0.0

    labels_30 = [days[i][5:] for i in range(-30, 0)]
    prices_30 = [round(daily[i], 2) for i in range(-30, 0)]

    return MarketInputs(
        price=round(daily[-1], 2),
        ret_7d_pct=round(cur_w, 3),
        ret_30d_pct=round(ret(daily[-31], daily[-1]), 3),
        rsi14=round(rsi(daily), 2),
        week_zscore=round(z, 3),
        vol_ann_7d_pct=round(ann_vol(drets[-7:]), 2),
        vol_ann_30d_pct=round(ann_vol(drets[-30:]), 2),
        fear_greed=fg_now,
        sentiment_up_pct=round(sentiment_up, 2),
        funding_8h_pct=round(funding, 4),
        long_short_ratio=round(lsr, 3),
        dxy_1m_pct=round(dxy_1m, 3),
        spx_1m_pct=round(spx_1m, 3),
        gold_1m_pct=round(gold_1m, 3),
        tnx_last=round(tnx, 3),
        dd_from_ath_pct=round(dd, 2),
        hist_n=int(hist["n"]),
        hist_fwd7_avg=round(hist["fwd7_avg"], 3),
        hist_fwd30_avg=round(hist["fwd30_avg"], 3),
        hist_fwd7_win=round(hist["fwd7_win"], 1),
        btc_dominance_pct=round(dominance, 2),
        vix_last=round(vix_last, 2),
        vix_1m_chg=round(vix_1m_chg, 2),
        net_liq_4w_pct=round(net_liq_4w, 3) if net_liq_4w is not None else None,
        hy_oas_last=round(hy_oas, 3),
        t10y2y_last=round(t10y2y, 3),
        dollar_last=round(dollar_last, 3),
        macro_source=macro_source,
        price_series_30d=prices_30,
        price_labels_30d=labels_30,
        fg_series=fg_series,
        fg_labels=fg_labels,
    )
