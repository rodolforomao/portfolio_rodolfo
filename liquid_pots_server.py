#!/usr/bin/env python3
"""
liquid_pots_server.py — Potes de liquidação Liquid TX + alertas Telegram.

Mensageria via Settings na UI (Liquid TX → Settings).
  Prioridade:
    1. liquid_pots_data.json.telegram (salvo em Settings)
    2. TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID (opcional)
    3. TELEGRAM_CONFIG_PATH → telegram_config.json (opcional)

Endpoints (prefixo /api/liquid-pots via proxy do CRA / nginx):
  GET    /health
  GET    /api/liquid-pots
  PUT    /api/liquid-pots              body: { pots: [...] }
  POST   /api/liquid-pots             cria um pote
  PATCH  /api/liquid-pots/<id>        realize | update label
  DELETE /api/liquid-pots/<id>
  POST   /api/liquid-pots/telegram/test

Background: a cada POLL_SECONDS busca BTC spot e, para potes ativos,
dispara Telegram em cruzamentos de ±0.5% e ±1% vs preço médio do pote.

Env:
  LIQUID_POTS_HTTP_PORT   default 8770
  LIQUID_POTS_HTTP_HOST   default 127.0.0.1
  LIQUID_POTS_DATA_PATH   default ./liquid_pots_data.json
  LIQUID_POTS_POLL_SECONDS default 30
  TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
  TELEGRAM_CONFIG_PATH    opcional (telegram_config.json do manager)
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
import uuid
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    from dotenv import load_dotenv

    _root = Path(__file__).resolve().parent
    for _env in (_root / ".env.liquid-pots", _root / ".env"):
        if _env.exists():
            load_dotenv(_env)
except ImportError:
    pass

from telegram_messaging import TelegramMessenger, resolve_credentials

ROOT = Path(__file__).resolve().parent
HOST = os.environ.get("LIQUID_POTS_HTTP_HOST", "127.0.0.1")
PORT = int(os.environ.get("LIQUID_POTS_HTTP_PORT", "8770"))
DATA_PATH = Path(
    os.environ.get("LIQUID_POTS_DATA_PATH", str(ROOT / "liquid_pots_data.json"))
)
POLL_SECONDS = int(os.environ.get("LIQUID_POTS_POLL_SECONDS", "30"))
THRESHOLDS = (0.5, 1.0)
HYSTERESIS = 0.15  # % — desarma o nível quando volta para dentro

_lock = threading.RLock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_store() -> dict:
    return {
        "telegram": {"bot_token": "", "chat_id": ""},
        "pots": [],
        "messages": [],
        "updated_at": _now_iso(),
    }


def load_store() -> dict:
    with _lock:
        if not DATA_PATH.exists():
            return _default_store()
        try:
            raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return _default_store()
        if not isinstance(raw, dict):
            return _default_store()
        raw.setdefault("telegram", {"bot_token": "", "chat_id": ""})
        raw.setdefault("pots", [])
        return raw


def save_store(store: dict) -> None:
    with _lock:
        store["updated_at"] = _now_iso()
        DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = DATA_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(store, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(DATA_PATH)


def resolve_telegram() -> dict:
    """Credenciais via Settings (UI) — sem exigir .env.

    Prioridade (ver telegram_messaging.resolve_credentials):
      1. liquid_pots_data.json.telegram  (salvo em Settings na UI)
      2. TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID (opcional, só se existir)
      3. TELEGRAM_CONFIG_PATH / telegram_config.json — mesmo bot do Dealer
    """
    env_cfg_path = os.environ.get("LIQUID_POTS_TELEGRAM_CONFIG")
    return resolve_credentials(
        load_store().get("telegram"),
        shared_config_paths=[
            *([env_cfg_path] if env_cfg_path else []),
            ROOT / "telegram_config.json",
            Path.cwd() / "telegram_config.json",
        ],
        log_prefix="liquid-pots",
    )


SIDESWAP_WS_URL = "wss://api.sideswap.io/json-rpc-ws"
# Asset ids públicos da Liquid Network (L-BTC / Tether USDt).
LBTC_ASSET_ID = "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526"
USDT_ASSET_ID = "ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd"


def fetch_sideswap_spot(timeout: float = 6.0) -> float:
    """Preço real do par que negociamos (L-BTC/USDt na SideSwap)."""
    import websocket  # websocket-client — import local: opcional, cai no fallback Binance se ausente

    ws = websocket.create_connection(SIDESWAP_WS_URL, timeout=timeout)
    try:
        ws.send(json.dumps({
            "id": 1,
            "method": "market",
            "params": {
                "subscribe": {"asset_pair": {"base": LBTC_ASSET_ID, "quote": USDT_ASSET_ID}}
            },
        }))
        orders = []
        deadline = time.time() + timeout
        while time.time() < deadline:
            ws.settimeout(max(0.1, deadline - time.time()))
            try:
                raw = ws.recv()
            except Exception:
                break
            if not raw:
                continue
            msg = json.loads(raw)
            subscribe = (msg.get("result") or {}).get("subscribe") or {}
            if subscribe.get("orders"):
                orders = subscribe["orders"]
            mp = (msg.get("params") or {}).get("market_price")
            if mp:
                price = mp.get("last_price") or mp.get("ind_price")
                if price:
                    price = float(price)
                    if price > 0:
                        return price
        sells = sorted(
            (o for o in orders if o.get("trade_dir") == "Sell" and float(o.get("price") or 0) > 0),
            key=lambda o: float(o["price"]),
        )
        buys = sorted(
            (o for o in orders if o.get("trade_dir") == "Buy" and float(o.get("price") or 0) > 0),
            key=lambda o: float(o["price"]),
            reverse=True,
        )
        if sells and buys:
            return (float(sells[0]["price"]) + float(buys[0]["price"])) / 2
        raise ValueError("sem preço da SideSwap dentro do timeout")
    finally:
        ws.close()


def fetch_binance_spot() -> float:
    url = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
    req = urllib.request.Request(url, headers={"User-Agent": "liquid-pots/1.0"})
    with urllib.request.urlopen(req, timeout=12) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    price = float(data["price"])
    if price <= 0:
        raise ValueError("preço inválido")
    return price


def fetch_btc_spot() -> float:
    """SideSwap primeiro (onde nossas transações realmente acontecem);
    Binance BTC/USDT como fallback se a SideSwap estiver indisponível."""
    try:
        return fetch_sideswap_spot()
    except Exception as exc:
        print(f"[liquid-pots] SideSwap spot falhou, usando Binance: {exc}", file=sys.stderr)
        return fetch_binance_spot()


def broadcast_telegram(text: str) -> int:
    creds = resolve_telegram()
    if not creds["configured"]:
        raise ValueError(
            "Telegram não configurado — abra Liquid TX → Settings e salve "
            "bot token + chat ID (mesmo bot do Dealer)."
        )
    return TelegramMessenger(
        creds["bot_token"], creds["chat_ids"], source="liquid-pots"
    ).send(text)


def pot_pnl(pot: dict, spot: float):
    avg = pot.get("avgPrice")
    if avg is None or avg <= 0:
        return None
    side = pot.get("side") or "buy"
    lbtc = float(pot.get("totalLbtc") or 0)
    spot_vs_me = ((spot - avg) / avg) * 100.0
    vs_hold = -spot_vs_me if side == "sell" else spot_vs_me
    if side == "sell":
        usdt_pnl = (avg - spot) * lbtc
    else:
        usdt_pnl = (spot - avg) * lbtc
    return {
        "spot": spot,
        "avgPrice": avg,
        "vsHoldPct": vs_hold,
        "spotVsMePct": spot_vs_me,
        "usdtPnl": usdt_pnl,
        "side": side,
        "totalLbtc": lbtc,
        "totalUsdt": float(pot.get("totalUsdt") or 0),
    }


def format_alert(pot: dict, pnl: dict, level: float) -> str:
    sign = "+" if level > 0 else ""
    side_label = {"buy": "compra", "sell": "venda", "flat": "misto"}.get(
        pnl["side"], pnl["side"]
    )
    lines = [
        f'🔔 Pote "{pot.get("label") or "sem label"}" — {sign}{level:g}%',
        "",
        f"Preço médio: ${pnl['avgPrice']:,.2f}",
        f"Spot BTC: ${pnl['spot']:,.2f}",
        f"Ganho/perda: {pnl['vsHoldPct']:+.2f}% · ${pnl['usdtPnl']:+,.2f} USDT",
        f"L-BTC: {pnl['totalLbtc']:.8f} · lado: {side_label}",
        f"Status: {'realizado' if pot.get('realizedAt') else 'ativo'}",
    ]
    txs = pot.get("txSummaries") or []
    if txs:
        lines.append("")
        lines.append("Transações:")
        for t in txs[:20]:
            lines.append(
                f"- {t.get('shortTxid') or t.get('txid', '')[:14]} · "
                f"{t.get('type', '?')} · ${float(t.get('price') or 0):,.2f}"
            )
        if len(txs) > 20:
            lines.append(f"… +{len(txs) - 20} txs")
    return "\n".join(lines)


def crossed_levels(prev_pct, curr_pct: float, fired: dict) -> list:
    hits = []
    for mag in THRESHOLDS:
        for level in (mag, -mag):
            key = f"{level:g}"
            armed = fired.get(key) is True
            if level > 0:
                if curr_pct >= level and not armed:
                    if prev_pct is None or prev_pct < level:
                        hits.append(level)
                if curr_pct < level - HYSTERESIS and armed:
                    fired[key] = False
            else:
                if curr_pct <= level and not armed:
                    if prev_pct is None or prev_pct > level:
                        hits.append(level)
                if curr_pct > level + HYSTERESIS and armed:
                    fired[key] = False
    return hits


def check_pots_once() -> None:
    creds = resolve_telegram()
    if not creds["configured"]:
        return

    store = load_store()
    try:
        spot = fetch_btc_spot()
    except Exception as exc:
        print(f"[liquid-pots] BTC spot falhou: {exc}", file=sys.stderr)
        return

    changed = False
    for pot in store.get("pots") or []:
        if pot.get("realizedAt"):
            continue
        pnl = pot_pnl(pot, spot)
        if not pnl:
            continue
        fired = pot.setdefault("firedLevels", {})
        prev = pot.get("lastPct")
        curr = float(pnl["vsHoldPct"])
        hits = crossed_levels(prev if prev is None else float(prev), curr, fired)
        pot["lastPct"] = curr
        pot["lastSpot"] = spot
        pot["lastCheckedAt"] = _now_iso()
        for level in hits:
            key = f"{level:g}"
            try:
                broadcast_telegram(format_alert(pot, pnl, level))
                fired[key] = True
                pot["lastAlertAt"] = _now_iso()
                pot["lastAlertLevel"] = level
                changed = True
                print(f"[liquid-pots] alerta {pot.get('label')} @ {level:g}%")
            except Exception as exc:
                print(f"[liquid-pots] Telegram falhou: {exc}", file=sys.stderr)
        changed = True

    if changed:
        save_store(store)


def watcher_loop() -> None:
    print(f"[liquid-pots] watcher a cada {POLL_SECONDS}s")
    while True:
        try:
            check_pots_once()
        except Exception as exc:
            print(f"[liquid-pots] watcher erro: {exc}", file=sys.stderr)
        time.sleep(POLL_SECONDS)


def public_store(store: dict) -> dict:
    creds = resolve_telegram()
    return {
        "pots": store.get("pots") or [],
        "telegram": {
            "configured": creds["configured"],
            "source": creds["source"],
            "chat_ids": creds["chat_ids"],
            "bot_token_masked": creds["bot_token_masked"],
            "hint": (
                "Configure em Menu → Settings (bot token + chat ID). "
                "Configuração compartilhada do hub /dealer."
            ),
        },
        "updated_at": store.get("updated_at"),
        "thresholds": list(THRESHOLDS),
        "poll_seconds": POLL_SECONDS,
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")

    def _json(self, code: int, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8") or "{}")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/health", "/api/liquid-pots/health"):
            creds = resolve_telegram()
            self._json(
                200,
                {
                    "ok": True,
                    "service": "liquid-pots",
                    "telegram_configured": creds["configured"],
                    "telegram_source": creds["source"],
                },
            )
            return
        if path in ("/api/liquid-pots", "/api/liquid-pots/"):
            self._json(200, public_store(load_store()))
            return
        self._json(404, {"error": "not found", "path": path})

    def do_PUT(self):
        path = self.path.split("?")[0]
        try:
            data = self._read_json()
        except json.JSONDecodeError:
            self._json(400, {"error": "JSON inválido"})
            return

        if path in ("/api/liquid-pots", "/api/liquid-pots/"):
            pots = data.get("pots")
            if not isinstance(pots, list):
                self._json(400, {"error": "pots deve ser lista"})
                return
            store = load_store()
            store["pots"] = pots
            save_store(store)
            self._json(200, public_store(store))
            return

        if path == "/api/liquid-pots/telegram":
            token = str(data.get("bot_token") or "").strip()
            chat = str(data.get("chat_id") or "").strip()
            store = load_store()
            tg = store.setdefault("telegram", {})
            if data.get("clear"):
                tg["bot_token"] = ""
                tg["chat_id"] = ""
            else:
                if not token or not chat:
                    self._json(400, {"error": "bot_token e chat_id obrigatórios"})
                    return
                tg["bot_token"] = token
                tg["chat_id"] = chat
            save_store(store)
            self._json(200, public_store(store))
            return

        self._json(404, {"error": "not found", "path": path})

    def do_POST(self):
        path = self.path.split("?")[0]
        try:
            data = self._read_json()
        except json.JSONDecodeError:
            self._json(400, {"error": "JSON inválido"})
            return

        if path in ("/api/liquid-pots", "/api/liquid-pots/"):
            label = str(data.get("label") or "").strip()
            if not label:
                self._json(400, {"error": "label obrigatório"})
                return
            avg = data.get("avgPrice")
            if avg is None or float(avg) <= 0:
                self._json(400, {"error": "avgPrice inválido"})
                return
            pot = {
                "id": str(uuid.uuid4()),
                "label": label,
                "txids": list(data.get("txids") or []),
                "txSummaries": list(data.get("txSummaries") or []),
                "side": data.get("side") or "buy",
                "avgPrice": float(avg),
                "totalLbtc": float(data.get("totalLbtc") or 0),
                "totalUsdt": float(data.get("totalUsdt") or 0),
                "walletId": data.get("walletId") or None,
                "walletName": data.get("walletName") or None,
                "createdAt": _now_iso(),
                "realizedAt": None,
                "realizedValue": None,
                "firedLevels": {},
                "lastPct": None,
                "lastSpot": None,
            }
            store = load_store()
            store.setdefault("pots", []).insert(0, pot)
            save_store(store)
            self._json(201, {"pot": pot, **public_store(store)})
            return

        if path == "/api/liquid-pots/telegram/test":
            try:
                n = broadcast_telegram(
                    "✅ liquid-pots: Telegram OK — Settings "
                    f"(fonte: {resolve_telegram()['source']})."
                )
                self._json(200, {"ok": True, "sent": n, "telegram": {
                    k: v for k, v in resolve_telegram().items() if k != "bot_token"
                }})
            except Exception as exc:
                self._json(502, {"error": str(exc), "telegram": {
                    k: v for k, v in resolve_telegram().items() if k != "bot_token"
                }})
            return

        if path == "/api/liquid-pots/check-now":
            try:
                check_pots_once()
                self._json(200, {"ok": True, **public_store(load_store())})
            except Exception as exc:
                self._json(500, {"error": str(exc)})
            return

        self._json(404, {"error": "not found", "path": path})

    def do_PATCH(self):
        path = self.path.split("?")[0]
        prefix = "/api/liquid-pots/"
        if not path.startswith(prefix):
            self._json(404, {"error": "not found"})
            return
        pot_id = path[len(prefix) :].strip("/")
        if not pot_id or "/" in pot_id or pot_id == "telegram":
            self._json(404, {"error": "not found"})
            return
        try:
            data = self._read_json()
        except json.JSONDecodeError:
            self._json(400, {"error": "JSON inválido"})
            return

        store = load_store()
        pot = next((p for p in store.get("pots") or [] if p.get("id") == pot_id), None)
        if not pot:
            self._json(404, {"error": "pote não encontrado"})
            return

        if data.get("realize") is True:
            pot["realizedAt"] = _now_iso()
            spot = None
            try:
                spot = fetch_btc_spot()
            except Exception as exc:
                print(f"[liquid-pots] spot p/ realização falhou: {exc}", file=sys.stderr)
                fallback = data.get("spot")
                if fallback is not None:
                    try:
                        spot = float(fallback)
                    except (TypeError, ValueError):
                        spot = None
            pnl = pot_pnl(pot, spot) if spot else None
            pot["realizedValue"] = (
                {
                    "spot": pnl["spot"],
                    "avgPrice": pnl["avgPrice"],
                    "usdtPnl": pnl["usdtPnl"],
                    "vsHoldPct": pnl["vsHoldPct"],
                    "spotVsMePct": pnl["spotVsMePct"],
                }
                if pnl
                else None
            )
        if data.get("unrealize") is True:
            pot["realizedAt"] = None
            pot["realizedValue"] = None
            pot["firedLevels"] = {}
        if "label" in data and str(data["label"]).strip():
            pot["label"] = str(data["label"]).strip()
        save_store(store)
        self._json(200, {"pot": pot, **public_store(store)})

    def do_DELETE(self):
        path = self.path.split("?")[0]
        prefix = "/api/liquid-pots/"
        if not path.startswith(prefix):
            self._json(404, {"error": "not found"})
            return
        pot_id = path[len(prefix) :].strip("/")
        store = load_store()
        before = len(store.get("pots") or [])
        store["pots"] = [p for p in store.get("pots") or [] if p.get("id") != pot_id]
        if len(store["pots"]) == before:
            self._json(404, {"error": "pote não encontrado"})
            return
        save_store(store)
        self._json(200, public_store(store))


def main():
    creds = resolve_telegram()
    print(
        f"[liquid-pots] telegram: configured={creds['configured']} source={creds['source']}"
    )
    t = threading.Thread(target=watcher_loop, name="liquid-pots-watcher", daemon=True)
    t.start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"liquid-pots: http://{HOST}:{PORT}/api/liquid-pots")
    print(f"data: {DATA_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nparado.")


if __name__ == "__main__":
    main()
