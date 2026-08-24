#!/usr/bin/env python3
"""Snapshot BTC: estatística, macro proxies e sentimento — sem viés narrativo."""

from __future__ import annotations

import json
import math
import statistics
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def get_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "analyses-btc/1.0"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode())


def ret(a: float, b: float) -> float:
    return (b - a) / a * 100


def rsi(series: list[float], period: int = 14) -> float:
    gains, losses = [], []
    for i in range(1, len(series)):
        d = series[i] - series[i - 1]
        gains.append(max(d, 0))
        losses.append(max(-d, 0))
    ag = sum(gains[-period:]) / period
    al = sum(losses[-period:]) / period
    if al == 0:
        return 100.0
    return 100 - (100 / (1 + ag / al))


def forward_after_week(daily: list[float], days: list[str], threshold: float):
    samples = []
    for i in range(7, len(daily) - 30):
        w = ret(daily[i - 7], daily[i])
        if w >= threshold:
            samples.append(
                {
                    "date": days[i],
                    "week": round(w, 2),
                    "fwd7": round(ret(daily[i], daily[i + 7]), 2),
                    "fwd30": round(ret(daily[i], daily[i + 30]), 2),
                }
            )
    filtered, last = [], -999
    for s in samples:
        idx = days.index(s["date"])
        if idx - last >= 7:
            filtered.append(s)
            last = idx
    if not filtered:
        return {"n": 0}
    f7 = [s["fwd7"] for s in filtered]
    f30 = [s["fwd30"] for s in filtered]
    return {
        "n": len(filtered),
        "fwd7_avg": round(sum(f7) / len(f7), 2),
        "fwd7_win_pct": round(100 * sum(1 for x in f7 if x > 0) / len(f7), 1),
        "fwd30_avg": round(sum(f30) / len(f30), 2),
        "fwd30_win_pct": round(100 * sum(1 for x in f30 if x > 0) / len(f30), 1),
    }


def main():
    kl = get_json(
        "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1000"
    )
    days, daily = [], []
    for c in kl:
        days.append(
            datetime.fromtimestamp(c[0] / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
        )
        daily.append(float(c[4]))

    wrets = [ret(daily[i - 7], daily[i]) for i in range(7, len(daily))]
    cur = wrets[-1]
    mu, sd = statistics.mean(wrets), statistics.pstdev(wrets)

    fng = get_json("https://api.alternative.me/fng/?limit=1")["data"][0]
    fr = get_json(
        "https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1"
    )[0]

    out = {
        "as_of_utc": datetime.now(timezone.utc).isoformat(),
        "price": daily[-1],
        "ret_7d_pct": round(cur, 2),
        "ret_30d_pct": round(ret(daily[-31], daily[-1]), 2),
        "rsi14": round(rsi(daily), 2),
        "week_zscore": round((cur - mu) / sd, 2) if sd else None,
        "fear_greed": {
            "value": int(fng["value"]),
            "label": fng["value_classification"],
        },
        "funding_last_pct_8h": round(float(fr["fundingRate"]) * 100, 4),
        "after_ge_10": forward_after_week(daily, days, 10),
        "after_ge_15": forward_after_week(daily, days, 15),
    }

    path = Path(__file__).resolve().parents[1] / "data" / "latest_snapshot.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
