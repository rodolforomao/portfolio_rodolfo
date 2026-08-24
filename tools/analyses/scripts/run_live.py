#!/usr/bin/env python3
"""Pipeline: coleta → fórmulas → data/live.json (+ opcional regen canvas)."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))

from fetch_market import collect  # noqa: E402
from formulas import (  # noqa: E402
    Weights,
    compute,
    decision_to_dict,
)


def run(weights: Weights | None = None) -> dict:
    w = weights or Weights()
    inputs = collect()
    decision = compute(inputs, w)
    payload = decision_to_dict(decision, inputs, w)
    payload["as_of_utc"] = datetime.now(timezone.utc).isoformat()
    payload["meta"] = {
        "engine": "formulas.py",
        "note": "Não é consultoria financeira. Score ∈ [-2,+2]; sell_fraction ∈ [0,0.85].",
    }
    out = ROOT / "data" / "live.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def main():
    p = argparse.ArgumentParser(description="BTC live analysis via fórmulas")
    p.add_argument("--stat", type=float, default=1.0)
    p.add_argument("--hist", type=float, default=0.8)
    p.add_argument("--macro", type=float, default=1.0)
    p.add_argument("--sentiment", type=float, default=1.0)
    p.add_argument("--structure", type=float, default=0.7)
    args = p.parse_args()
    w = Weights(
        stat=args.stat,
        hist=args.hist,
        macro=args.macro,
        sentiment=args.sentiment,
        structure=args.structure,
    )
    payload = run(w)
    print(json.dumps({
        "as_of_utc": payload["as_of_utc"],
        "price": payload["inputs"]["price"],
        "total": payload["total"],
        "action": payload["action"],
        "sell_pct_range": payload["sell_pct_range"],
        "pillars": {p["name"]: p["score"] for p in payload["pillars"]},
    }, indent=2))


if __name__ == "__main__":
    main()
