#!/usr/bin/env python3
"""
Servidor local dinâmico:
  GET /            → dashboard
  GET /api/live    → coleta + fórmulas (query: ?stat=1&hist=0.8&...)
  GET /api/formulas → só as fórmulas (documentação)
  GET /data/live.json → último snapshot em disco
"""

from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT / "scripts"))

from formulas import (  # noqa: E402
    DEFAULT_WEIGHTS,
    MarketInputs,
    Weights,
    compute,
    decision_to_dict,
)
from fetch_market import collect  # noqa: E402

PORT = int(__import__("os").environ.get("ANALYSES_HTTP_PORT", "8769"))
DASHBOARD = ROOT / "dashboard" / "index.html"


def parse_weights(qs: dict) -> Weights:
    def f(key: str, default: float) -> float:
        if key not in qs:
            return default
        try:
            return float(qs[key][0])
        except (ValueError, IndexError):
            return default

    return Weights(
        stat=f("stat", 1.0),
        hist=f("hist", 0.8),
        macro=f("macro", 1.0),
        sentiment=f("sentiment", 1.0),
        structure=f("structure", 0.7),
    )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")

    def _json(self, code: int, obj):
        body = json.dumps(obj, indent=2).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _html(self, path: Path):
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _file(self, path: Path, ctype: str):
        if not path.exists():
            self._json(404, {"error": "not found"})
            return
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self._cors()
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path in ("/", "/index.html"):
            self._html(DASHBOARD)
            return

        if path == "/dashboard.js":
            self._file(ROOT / "dashboard" / "app.js", "application/javascript; charset=utf-8")
            return

        if path == "/api/formulas":
            dummy = MarketInputs(
                price=0, ret_7d_pct=0, ret_30d_pct=0, rsi14=50, week_zscore=0,
                vol_ann_7d_pct=40, vol_ann_30d_pct=40, fear_greed=50,
                sentiment_up_pct=50, funding_8h_pct=0.01, long_short_ratio=1,
                dxy_1m_pct=0, spx_1m_pct=0, gold_1m_pct=0, tnx_last=4,
                dd_from_ath_pct=-20, hist_n=5, hist_fwd7_avg=0, hist_fwd30_avg=0,
                hist_fwd7_win=50,
            )
            d = compute(dummy, DEFAULT_WEIGHTS)
            self._json(200, {"formulas": d.formulas, "weights_default": DEFAULT_WEIGHTS.as_dict()})
            return

        if path == "/api/live":
            try:
                w = parse_weights(qs)
                inputs = collect()
                decision = compute(inputs, w)
                payload = decision_to_dict(decision, inputs, w)
                from datetime import datetime, timezone

                payload["as_of_utc"] = datetime.now(timezone.utc).isoformat()
                # cache to disk
                out = ROOT / "data" / "live.json"
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
                self._json(200, payload)
            except Exception as e:
                self._json(500, {"error": str(e)})
            return

        if path == "/api/recompute":
            # recompute from last live.json inputs with new weights (no refetch)
            try:
                live_path = ROOT / "data" / "live.json"
                if not live_path.exists():
                    self._json(400, {"error": "no live.json — call /api/live first"})
                    return
                raw = json.loads(live_path.read_text(encoding="utf-8"))
                inp = raw["inputs"]

                inputs = MarketInputs(
                    price=inp["price"],
                    ret_7d_pct=inp["ret_7d_pct"],
                    ret_30d_pct=inp["ret_30d_pct"],
                    rsi14=inp["rsi14"],
                    week_zscore=inp["week_zscore"],
                    vol_ann_7d_pct=inp["vol_ann_7d_pct"],
                    vol_ann_30d_pct=inp["vol_ann_30d_pct"],
                    fear_greed=inp["fear_greed"],
                    sentiment_up_pct=inp["sentiment_up_pct"],
                    funding_8h_pct=inp["funding_8h_pct"],
                    long_short_ratio=inp["long_short_ratio"],
                    dxy_1m_pct=inp["dxy_1m_pct"],
                    spx_1m_pct=inp["spx_1m_pct"],
                    gold_1m_pct=inp["gold_1m_pct"],
                    tnx_last=inp["tnx_last"],
                    dd_from_ath_pct=inp["dd_from_ath_pct"],
                    hist_n=inp["hist_n"],
                    hist_fwd7_avg=inp["hist_fwd7_avg"],
                    hist_fwd30_avg=inp["hist_fwd30_avg"],
                    hist_fwd7_win=inp["hist_fwd7_win"],
                    btc_dominance_pct=inp.get("btc_dominance_pct", 0),
                    vix_last=inp.get("vix_last", 20),
                    vix_1m_chg=inp.get("vix_1m_chg", 0),
                    net_liq_4w_pct=inp.get("net_liq_4w_pct"),
                    hy_oas_last=inp.get("hy_oas_last", 4),
                    t10y2y_last=inp.get("t10y2y_last", 0),
                    dollar_last=inp.get("dollar_last", 0),
                    macro_source=inp.get("macro_source", ""),
                    price_series_30d=raw.get("series", {}).get("price_30d", []),
                    price_labels_30d=raw.get("series", {}).get("price_30d_labels", []),
                    fg_series=raw.get("series", {}).get("fg", []),
                    fg_labels=raw.get("series", {}).get("fg_labels", []),
                )
                w = parse_weights(qs)
                decision = compute(inputs, w)
                payload = decision_to_dict(decision, inputs, w)
                payload["as_of_utc"] = raw.get("as_of_utc")
                payload["recomputed"] = True
                self._json(200, payload)
            except Exception as e:
                self._json(500, {"error": str(e)})
            return

        if path == "/data/live.json":
            self._file(ROOT / "data" / "live.json", "application/json; charset=utf-8")
            return

        self._json(404, {"error": "not found", "path": path})


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Dashboard dinâmico: http://127.0.0.1:{PORT}/")
    print(f"API ao vivo:         http://127.0.0.1:{PORT}/api/live")
    print("Ctrl+C para parar.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nparado.")


if __name__ == "__main__":
    main()
