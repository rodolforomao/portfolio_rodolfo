#!/usr/bin/env python3
"""Sincroniza data/live.json → canvas btc-dinamico (bloco SNAPSHOT)."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIVE = ROOT / "data" / "live.json"
CANVAS = Path.home() / ".cursor/projects/home-black-enviroment-tmp-analyses-btc/canvases/btc-dinamico.canvas.tsx"


def main():
    data = json.loads(LIVE.read_text(encoding="utf-8"))
    inp = data["inputs"]
    series = data.get("series", {})
    price_labels = series.get("price_30d_labels", [])
    price_vals = [int(round(x)) for x in series.get("price_30d", [])]
    fg_labels = series.get("fg_labels", [])
    fg_vals = [int(round(x)) for x in series.get("fg", [])]

    snapshot = f"""const SNAPSHOT = {{
  as_of_utc: {json.dumps(data.get("as_of_utc", "")[:19] + "Z")},
  inputs: {{
    price: {inp["price"]},
    ret_7d_pct: {inp["ret_7d_pct"]},
    ret_30d_pct: {inp["ret_30d_pct"]},
    rsi14: {inp["rsi14"]},
    week_zscore: {inp["week_zscore"]},
    vol_ann_7d_pct: {inp["vol_ann_7d_pct"]},
    vol_ann_30d_pct: {inp["vol_ann_30d_pct"]},
    fear_greed: {inp["fear_greed"]},
    sentiment_up_pct: {inp["sentiment_up_pct"]},
    funding_8h_pct: {inp["funding_8h_pct"]},
    long_short_ratio: {inp["long_short_ratio"]},
    dxy_1m_pct: {inp["dxy_1m_pct"]},
    spx_1m_pct: {inp["spx_1m_pct"]},
    gold_1m_pct: {inp["gold_1m_pct"]},
    dd_from_ath_pct: {inp["dd_from_ath_pct"]},
    hist_n: {inp["hist_n"]},
    hist_fwd7_avg: {inp["hist_fwd7_avg"]},
    hist_fwd30_avg: {inp["hist_fwd30_avg"]},
    hist_fwd7_win: {inp["hist_fwd7_win"]},
  }},
  priceLabels: {json.dumps(price_labels)},
  priceVals: {json.dumps(price_vals)},
  fgLabels: {json.dumps(fg_labels)},
  fgVals: {json.dumps(fg_vals)},
}};"""

    text = CANVAS.read_text(encoding="utf-8")
    new_text, n = re.subn(
        r"const SNAPSHOT = \{.*?\n\};",
        snapshot,
        text,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise SystemExit(f"SNAPSHOT block not found or multiple ({n})")
    CANVAS.write_text(new_text, encoding="utf-8")
    print(f"Canvas atualizado: {CANVAS}")
    print(f"price={inp['price']} total={data['total']} action={data['action']}")


if __name__ == "__main__":
    main()
