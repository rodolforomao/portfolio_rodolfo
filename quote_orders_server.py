#!/usr/bin/env python3
"""
Cotações BRL → cripto. SQLite é a base das ordens (abertas e já executadas).

  GET  /api/quote-orders
  PUT  /api/quote-orders     body: { "quotes": [ ... ] }

Env:
  QUOTE_ORDERS_HTTP_PORT  default 8771
  QUOTE_ORDERS_HTTP_HOST  default 127.0.0.1
  QUOTE_ORDERS_DB_PATH    default ./quote_orders.db
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = os.environ.get("QUOTE_ORDERS_HTTP_HOST", "127.0.0.1")
PORT = int(os.environ.get("QUOTE_ORDERS_HTTP_PORT", "8771"))
DB_PATH = Path(os.environ.get("QUOTE_ORDERS_DB_PATH", str(ROOT / "quote_orders.db")))

_lock = threading.RLock()

# Ordens já executadas, lidas de ~/Downloads/jhon*.ods e john*.ods.
# rate = reais / USDT bruto (valor cotado), para a conta fechar com a planilha.
# john 5.ods é uma ordem por valor: Global só Washington (2,5%);
# com o terceiro a mesa sobe 0,5% e fica em 3%.
EXECUTED_SEED = [
    {
        "id": "imp-jhon-2",
        "createdAt": 1790714047229,
        "brlAmount": 50000,
        "gross": 9534.19,
        "mesaPct": 3,
        "clientName": "John",
        "sourceFile": "jhon 2.ods",
        "sourceSheet": "Sheet1",
        "parties": [
            {"name": "Luiz", "pct": 1, "mine": False, "terceiro": False},
            {"name": "Terceiro", "pct": 1, "mine": False, "terceiro": True},
            {"name": "Rodolfo", "pct": 1, "mine": True, "terceiro": False},
        ],
    },
    {
        "id": "imp-jhon-3",
        "createdAt": 1790800732072,
        "brlAmount": 50000,
        "gross": 9621.09,
        "mesaPct": 3,
        "clientName": "John",
        "sourceFile": "jhon 3.ods",
        "sourceSheet": "Sheet1",
        "parties": [
            {"name": "Luiz", "pct": 1, "mine": False, "terceiro": False},
            {"name": "Terceiro", "pct": 1, "mine": False, "terceiro": True},
            {"name": "Rodolfo", "pct": 1, "mine": True, "terceiro": False},
        ],
    },
    {
        "id": "imp-john-4",
        "createdAt": 1790878162599,
        "brlAmount": 100000,
        "gross": 19078.22,
        "mesaPct": 3,
        "clientName": "John",
        "sourceFile": "john 4.ods",
        "sourceSheet": "Sheet1",
        "parties": [
            {"name": "Luiz", "pct": 1, "mine": False, "terceiro": False},
            {"name": "Terceiro", "pct": 1, "mine": False, "terceiro": True},
            {"name": "Rodolfo", "pct": 1, "mine": True, "terceiro": False},
        ],
    },
    {
        "id": "imp-john-5-25k",
        "createdAt": 1790967105642,
        "brlAmount": 25000,
        "gross": 4763.73,
        "mesaPct": 3,
        "clientName": "John",
        "sourceFile": "john 5.ods",
        "sourceSheet": "Luiz + terceiro",
        "parties": [
            {"name": "Luiz", "pct": 1, "mine": False, "terceiro": False},
            {"name": "Terceiro", "pct": 1, "mine": False, "terceiro": True},
            {"name": "Rodolfo", "pct": 1, "mine": True, "terceiro": False},
        ],
        "note": "",
    },
    {
        "id": "imp-john-5-50k",
        "createdAt": 1790967105642,
        "brlAmount": 50000,
        "gross": 9528.89,
        "mesaPct": 3,
        "clientName": "John",
        "sourceFile": "john 5.ods",
        "sourceSheet": "Bruno + terceiro",
        "parties": [
            {"name": "Bruno", "pct": 1.25, "mine": False, "terceiro": False},
            {"name": "Terceiro", "pct": 0.5, "mine": False, "terceiro": True},
            {"name": "Dealer", "pct": 1.25, "mine": True, "terceiro": False},
        ],
        "note": "Aba Global é só o Bruno, mesa 2,5% (cliente receberia ₮ 9.290,67). Com o terceiro, a mesa sobe 0,5%.",
    },
]

# Do #1 ao #4 a mesa de 3% é Luiz, terceiro e Rodolfo, 1% cada.
LUIZ_RODOLFO_IDS = ("imp-jhon-2", "imp-jhon-3", "imp-john-4", "imp-john-5-25k")
LUIZ_RODOLFO_PARTIES = [
    {"name": "Luiz", "pct": 1, "mine": False, "terceiro": False},
    {"name": "Terceiro", "pct": 1, "mine": False, "terceiro": True},
    {"name": "Rodolfo", "pct": 1, "mine": True, "terceiro": False},
]
LUIZ_DEALER_IDS = ("imp-jhon-2", "imp-jhon-3", "imp-john-4")
LUIZ_DEALER_PARTIES = LUIZ_RODOLFO_PARTIES

JOHN5_REPLACED_IDS = (
    "imp-john-5-global-25k",
    "imp-john-5-global-50k",
    "imp-john-5-john-25k",
    "imp-john-5-john-50k",
)


def _name_bruno_on_order_five(conn: sqlite3.Connection) -> None:
    """A ordem de R$ 50 mil do john 5 é John <> Bruno + terceiro."""
    row = conn.execute(
        "SELECT parties_json, note, source_sheet FROM quote_orders WHERE id = ?",
        ("imp-john-5-50k",),
    ).fetchone()
    if row is None:
        return
    try:
        parties = json.loads(row["parties_json"] or "[]")
    except json.JSONDecodeError:
        return
    changed = False
    for party in parties:
        if str(party.get("name") or "").strip().lower() == "washington":
            party["name"] = "Bruno"
            changed = True
    if not changed:
        return
    note = row["note"] or ""
    note = note.replace("só Washington", "só o Bruno")
    sheet = "Bruno + terceiro" if "Washington" in (row["source_sheet"] or "") else (row["source_sheet"] or "")
    conn.execute(
        "UPDATE quote_orders SET parties_json = ?, note = ?, source_sheet = ? WHERE id = ?",
        (json.dumps(parties, ensure_ascii=False), note, sheet, "imp-john-5-50k"),
    )
    conn.commit()


def _name_luiz_rodolfo(conn: sqlite3.Connection) -> None:
    """Do #1 ao #4: Luiz, terceiro e Rodolfo. Não mexe se o Rodolfo já está na ordem."""
    payload = json.dumps(LUIZ_RODOLFO_PARTIES, ensure_ascii=False)
    changed = False
    for order_id in LUIZ_RODOLFO_IDS:
        row = conn.execute(
            "SELECT parties_json, note FROM quote_orders WHERE id = ?",
            (order_id,),
        ).fetchone()
        if row is None:
            continue
        try:
            parties = json.loads(row["parties_json"] or "[]")
        except json.JSONDecodeError:
            parties = []
        names = {str(party.get("name") or "").strip().lower() for party in parties}
        if "rodolfo" in names:
            continue
        note = row["note"] or ""
        if order_id == "imp-john-5-25k":
            note = ""
            conn.execute(
                """
                UPDATE quote_orders
                   SET parties_json = ?, note = ?, source_sheet = ?
                 WHERE id = ?
                """,
                (payload, note, "Luiz + terceiro", order_id),
            )
        else:
            conn.execute(
                "UPDATE quote_orders SET parties_json = ? WHERE id = ?",
                (payload, order_id),
            )
        changed = True
    if changed:
        conn.commit()


def _name_luiz_dealer(conn: sqlite3.Connection) -> None:
    """Troca a parte genérica Mesa por Luiz e Dealer. Não mexe se já foi renomeada."""
    payload = json.dumps(LUIZ_DEALER_PARTIES, ensure_ascii=False)
    changed = False
    for order_id in LUIZ_DEALER_IDS:
        row = conn.execute(
            "SELECT parties_json FROM quote_orders WHERE id = ?",
            (order_id,),
        ).fetchone()
        if row is None:
            continue
        try:
            parties = json.loads(row["parties_json"] or "[]")
        except json.JSONDecodeError:
            parties = []
        if len(parties) != 1:
            continue
        if str(parties[0].get("name") or "").strip().lower() != "mesa":
            continue
        conn.execute(
            "UPDATE quote_orders SET parties_json = ? WHERE id = ?",
            (payload, order_id),
        )
        changed = True
    if changed:
        conn.commit()


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS quote_orders (
          id TEXT PRIMARY KEY,
          created_at INTEGER NOT NULL,
          expires_at INTEGER,
          decided_at INTEGER,
          status TEXT NOT NULL,
          brl_amount REAL NOT NULL,
          asset TEXT NOT NULL,
          network TEXT,
          symbol TEXT,
          rate REAL NOT NULL,
          client_name TEXT,
          mesa_pct REAL NOT NULL,
          parties_json TEXT NOT NULL,
          source_file TEXT,
          source_sheet TEXT,
          note TEXT,
          renewed_from TEXT,
          renewed_to TEXT,
          usdt_rate REAL,
          profit_currency TEXT,
          profit_rate REAL,
          payout_status TEXT,
          client_address TEXT,
          hops_json TEXT
        )
        """
    )
    cols = {row[1] for row in conn.execute("PRAGMA table_info(quote_orders)")}
    if "usdt_rate" not in cols:
        conn.execute("ALTER TABLE quote_orders ADD COLUMN usdt_rate REAL")
    if "profit_currency" not in cols:
        conn.execute("ALTER TABLE quote_orders ADD COLUMN profit_currency TEXT")
    if "profit_rate" not in cols:
        conn.execute("ALTER TABLE quote_orders ADD COLUMN profit_rate REAL")
    if "payout_status" not in cols:
        conn.execute("ALTER TABLE quote_orders ADD COLUMN payout_status TEXT")
    if "client_address" not in cols:
        conn.execute("ALTER TABLE quote_orders ADD COLUMN client_address TEXT")
    if "hops_json" not in cols:
        conn.execute("ALTER TABLE quote_orders ADD COLUMN hops_json TEXT")
    conn.execute(
        """
        UPDATE quote_orders
           SET usdt_rate = rate
         WHERE usdt_rate IS NULL AND asset = 'USDT'
        """
    )
    conn.commit()
    _name_luiz_dealer(conn)
    _name_luiz_rodolfo(conn)
    _name_bruno_on_order_five(conn)
    count = conn.execute("SELECT COUNT(*) AS n FROM quote_orders").fetchone()["n"]
    if not count:
        for raw in EXECUTED_SEED:
            _upsert(conn, _seed_quote(raw))
        conn.commit()
        return
    # john 5 entrou como quatro linhas. É a mesma operação: Global só
    # Washington (2,5%) e a outra aba soma o terceiro (+0,5%).
    placeholders = ",".join("?" for _ in JOHN5_REPLACED_IDS)
    stale = conn.execute(
        f"SELECT COUNT(*) AS n FROM quote_orders WHERE id IN ({placeholders})",
        JOHN5_REPLACED_IDS,
    ).fetchone()["n"]
    if not stale:
        return
    conn.execute(
        f"DELETE FROM quote_orders WHERE id IN ({placeholders})",
        JOHN5_REPLACED_IDS,
    )
    for raw in EXECUTED_SEED:
        if raw["id"].startswith("imp-john-5-"):
            _upsert(conn, _seed_quote(raw))
    conn.commit()


def _seed_quote(raw: dict) -> dict:
    gross = float(raw["gross"])
    brl = float(raw["brlAmount"])
    mesa = float(raw["mesaPct"])
    created = int(raw["createdAt"])
    return {
        "id": raw["id"],
        "createdAt": created,
        "expiresAt": created,
        "decidedAt": created,
        "status": "realizada",
        "brlAmount": brl,
        "asset": "USDT",
        "network": "",
        "symbol": "USDTBRL",
        "rate": brl / gross,
        "usdtRate": brl / gross,
        "clientName": raw.get("clientName") or "",
        "mesaPct": mesa,
        "parties": raw.get("parties") or [{"name": "Mesa", "pct": mesa, "mine": False}],
        "sourceFile": raw.get("sourceFile") or "",
        "sourceSheet": raw.get("sourceSheet") or "",
        "note": raw.get("note") or "",
        "renewedFrom": None,
        "renewedTo": None,
    }


def _upsert(conn: sqlite3.Connection, quote: dict) -> None:
    parties = quote.get("parties") or []
    conn.execute(
        """
        INSERT INTO quote_orders (
          id, created_at, expires_at, decided_at, status, brl_amount, asset,
          network, symbol, rate, client_name, mesa_pct, parties_json,
          source_file, source_sheet, note, renewed_from, renewed_to, usdt_rate,
          profit_currency, profit_rate, payout_status, client_address, hops_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          created_at=excluded.created_at,
          expires_at=excluded.expires_at,
          decided_at=excluded.decided_at,
          status=excluded.status,
          brl_amount=excluded.brl_amount,
          asset=excluded.asset,
          network=excluded.network,
          symbol=excluded.symbol,
          rate=excluded.rate,
          client_name=excluded.client_name,
          mesa_pct=excluded.mesa_pct,
          parties_json=excluded.parties_json,
          source_file=excluded.source_file,
          source_sheet=excluded.source_sheet,
          note=excluded.note,
          renewed_from=excluded.renewed_from,
          renewed_to=excluded.renewed_to,
          usdt_rate=excluded.usdt_rate,
          profit_currency=excluded.profit_currency,
          profit_rate=excluded.profit_rate,
          payout_status=excluded.payout_status,
          client_address=excluded.client_address,
          hops_json=excluded.hops_json
        """,
        (
            quote.get("id"),
            int(quote.get("createdAt") or 0),
            quote.get("expiresAt"),
            quote.get("decidedAt"),
            quote.get("status") or "aberta",
            float(quote.get("brlAmount") or 0),
            quote.get("asset") or "USDT",
            quote.get("network") or "",
            quote.get("symbol") or "",
            float(quote.get("rate") or 0),
            quote.get("clientName") or "",
            float(quote.get("mesaPct") or 0),
            json.dumps(parties, ensure_ascii=False),
            quote.get("sourceFile") or "",
            quote.get("sourceSheet") or "",
            quote.get("note") or "",
            quote.get("renewedFrom"),
            quote.get("renewedTo"),
            quote.get("usdtRate"),
            quote.get("profitCurrency"),
            quote.get("profitRate"),
            quote.get("payoutStatus") or "a_pagar",
            quote.get("clientAddress") or "",
            json.dumps(quote.get("hops") or [], ensure_ascii=False),
        ),
    )


def _row_to_quote(row: sqlite3.Row) -> dict:
    try:
        parties = json.loads(row["parties_json"] or "[]")
    except json.JSONDecodeError:
        parties = []
    try:
        hops = json.loads(row["hops_json"] or "[]")
    except (json.JSONDecodeError, IndexError, KeyError):
        hops = []
    if not isinstance(hops, list):
        hops = []
    return {
        "id": row["id"],
        "createdAt": row["created_at"],
        "expiresAt": row["expires_at"],
        "decidedAt": row["decided_at"],
        "status": row["status"],
        "brlAmount": row["brl_amount"],
        "asset": row["asset"],
        "network": row["network"] or "",
        "symbol": row["symbol"] or "",
        "rate": row["rate"],
        "usdtRate": row["usdt_rate"],
        "profitCurrency": row["profit_currency"],
        "profitRate": row["profit_rate"],
        "payoutStatus": row["payout_status"] or "a_pagar",
        "clientName": row["client_name"] or "",
        "mesaPct": row["mesa_pct"],
        "parties": parties,
        "sourceFile": row["source_file"] or "",
        "sourceSheet": row["source_sheet"] or "",
        "note": row["note"] or "",
        "renewedFrom": row["renewed_from"],
        "renewedTo": row["renewed_to"],
        "clientAddress": row["client_address"] or "",
        "hops": hops,
    }


def list_quotes(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM quote_orders ORDER BY created_at DESC, id DESC"
    ).fetchall()
    return [_row_to_quote(row) for row in rows]


def replace_quotes(conn: sqlite3.Connection, quotes: list[dict]) -> None:
    conn.execute("DELETE FROM quote_orders")
    for quote in quotes:
        if not quote.get("id"):
            continue
        _upsert(conn, quote)
    conn.commit()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        print(f"[quote-orders] {self.address_string()} {fmt % args}")

    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send(204, {})

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if path in ("/health",):
            self._send(200, {"ok": True})
            return
        if path in ("/api/quote-orders",):
            with _lock:
                conn = self.server.conn
                self._send(200, {"quotes": list_quotes(conn)})
            return
        self._send(404, {"error": "not found"})

    def do_PUT(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if path not in ("/api/quote-orders",):
            self._send(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._send(400, {"error": "JSON inválido"})
            return
        quotes = data.get("quotes")
        if not isinstance(quotes, list):
            self._send(400, {"error": "quotes precisa ser uma lista"})
            return
        with _lock:
            conn = self.server.conn
            replace_quotes(conn, quotes)
            self._send(200, {"quotes": list_quotes(conn)})


def main() -> None:
    conn = connect()
    init_db(conn)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.conn = conn
    print(f"quote orders em http://{HOST}:{PORT}/api/quote-orders  db={DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        conn.close()


if __name__ == "__main__":
    main()
