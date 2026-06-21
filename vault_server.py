#!/usr/bin/env python3
"""
vault_server.py — Backend HTTP + WebSocket para o vault split-key.

Roda no mesmo servidor que serve o site (rodolforomao.com.br).

Expõe:
  GET  /admin/vault/status/{dealer_id}  — manager verifica status (Bearer auth)
  POST /admin/vault/register            — manager registra pk_m + pk_auth
  GET  /api/vault/pubkey/{dealer_id}    — browser busca pk_m do dealer
  POST /api/vault/passphrase            — browser envia {enc_p, sealed_r}
  GET  /api/vault/dealers               — browser lista dealers e status
  GET  /vault-ws                        — manager busca vault (Ed25519 challenge-response)

Instalar dependências:
  pip install aiohttp PyNaCl

Rodar (dev):
  python vault_server.py

Systemd / produção:
  [Service]
  ExecStart=/usr/bin/python3 /var/www/portfolio/vault_server.py
  EnvironmentFile=/var/www/portfolio/.env.vault
  Restart=always

nginx (add alongside /dealer-ws):
  location /vault-ws {
      proxy_pass         http://127.0.0.1:8766;
      proxy_http_version 1.1;
      proxy_set_header   Upgrade $http_upgrade;
      proxy_set_header   Connection "upgrade";
      proxy_read_timeout 3600;
  }
  location /admin/vault/ {
      proxy_pass http://127.0.0.1:8766;
  }
  location /api/vault/ {
      proxy_pass http://127.0.0.1:8766;
  }

Variáveis de ambiente:
  VAULT_ADMIN_TOKEN   token Bearer para endpoints /admin/ (obrigatório)
  VAULT_DB_PATH       caminho do arquivo SQLite (padrão: ./vault_data.db)
  VAULT_HTTP_PORT     porta de escuta (padrão: 8766)
  VAULT_HTTP_HOST     interface (padrão: 0.0.0.0)
"""

import os
import json
import sqlite3
import secrets
import logging
from datetime import datetime
from pathlib import Path

# Carrega .env automaticamente se python-dotenv estiver disponível
try:
    from dotenv import load_dotenv
    _env = Path(__file__).parent / ".env"
    if _env.exists():
        load_dotenv(_env)
except ImportError:
    pass

from aiohttp import web, WSMsgType
import nacl.signing
import nacl.exceptions

# ── Config ───────────────────────────────────────────────────────────────────
ADMIN_TOKEN = os.environ.get("VAULT_ADMIN_TOKEN", "change-me")
DB_PATH     = os.environ.get("VAULT_DB_PATH", "./vault_data.db")
HTTP_PORT   = int(os.environ.get("VAULT_HTTP_PORT", "8766"))
HTTP_HOST   = os.environ.get("VAULT_HTTP_HOST", "0.0.0.0")

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("vault_server")

# ── Database ─────────────────────────────────────────────────────────────────
_DB_CONN: sqlite3.Connection | None = None


def get_db() -> sqlite3.Connection:
    global _DB_CONN
    if _DB_CONN is None:
        _DB_CONN = sqlite3.connect(DB_PATH, check_same_thread=False)
        _DB_CONN.row_factory = sqlite3.Row
    return _DB_CONN


def init_db() -> None:
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS vault_entries (
            dealer_id   TEXT PRIMARY KEY,
            wallet_name TEXT,
            pk_m        TEXT NOT NULL DEFAULT '',
            pk_auth     TEXT NOT NULL DEFAULT '',
            enc_p       TEXT,
            sealed_r    TEXT,
            status      TEXT NOT NULL DEFAULT 'pending',
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS vault_audit_log (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            event      TEXT NOT NULL,
            dealer_id  TEXT,
            ts         TEXT NOT NULL DEFAULT (datetime('now')),
            ip         TEXT,
            status     TEXT
        );
    """)
    cols = {row[1] for row in db.execute("PRAGMA table_info(vault_entries)")}
    if "wallet_name" not in cols:
        db.execute("ALTER TABLE vault_entries ADD COLUMN wallet_name TEXT")
    db.commit()


def _row_has_keys(row) -> bool:
    return bool(row["pk_m"] and row["pk_auth"])


def _dealer_public(row) -> dict:
    return {
        "dealer_id":   row["dealer_id"],
        "wallet_name": row["wallet_name"],
        "status":      row["status"],
        "has_keys":    _row_has_keys(row),
    }


def _audit(event: str, dealer_id: str, ip: str, status: str) -> None:
    try:
        db = get_db()
        db.execute(
            "INSERT INTO vault_audit_log (event, dealer_id, ip, status) VALUES (?,?,?,?)",
            (event, dealer_id, ip, status),
        )
        db.commit()
    except Exception as exc:
        log.warning(f"[AUDIT] falha ao registrar {event}/{dealer_id}: {exc}")
    log.info(json.dumps({
        "event": event, "dealer_id": dealer_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "ip": ip, "status": status,
    }))


def _next_dealer_id(db: sqlite3.Connection) -> str:
    rows = db.execute("SELECT dealer_id FROM vault_entries").fetchall()
    nums: list[int] = []
    for row in rows:
        did = row["dealer_id"] or ""
        if did.startswith("dealer_"):
            try:
                nums.append(int(did.split("_", 1)[1]))
            except ValueError:
                pass
    return f"dealer_{max(nums, default=0) + 1}"


def _insert_pending_dealer(db: sqlite3.Connection, dealer_id: str, wallet_name: str) -> None:
    """INSERT explícito — DBs antigos exigem pk_m/pk_auth NOT NULL sem DEFAULT."""
    db.execute(
        """
        INSERT INTO vault_entries (dealer_id, wallet_name, pk_m, pk_auth, status)
        VALUES (?, ?, '', '', 'pending')
        """,
        (dealer_id, wallet_name),
    )


# ── Auth ──────────────────────────────────────────────────────────────────────
def _require_admin(handler):
    async def wrapper(request):
        auth = request.headers.get("Authorization", "")
        if not ADMIN_TOKEN or ADMIN_TOKEN == "change-me":
            return web.json_response({"error": "VAULT_ADMIN_TOKEN não configurado no servidor"}, status=500)
        if auth != f"Bearer {ADMIN_TOKEN}":
            return web.json_response({"error": "Unauthorized"}, status=401)
        return await handler(request)
    return wrapper


# ── HTTP Admin (chamados por vault_provisioner.py) ───────────────────────────

@_require_admin
async def admin_vault_status(request: web.Request) -> web.Response:
    dealer_id = request.match_info["dealer_id"]
    row = get_db().execute(
        "SELECT dealer_id, wallet_name, status, pk_m, pk_auth FROM vault_entries WHERE dealer_id = ?",
        (dealer_id,),
    ).fetchone()
    if not row:
        return web.json_response({"status": "not_found"}, status=404)
    return web.json_response(_dealer_public(row))


@_require_admin
async def admin_vault_register(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "JSON inválido"}, status=400)

    dealer_id   = body.get("dealer_id", "").strip()
    pk_m        = body.get("pk_m", "").strip()
    pk_auth     = body.get("pk_auth", "").strip()
    wallet_name = (body.get("wallet_name") or "").strip() or None

    if not all([dealer_id, pk_m, pk_auth]):
        return web.json_response({"error": "Campos obrigatórios: dealer_id, pk_m, pk_auth"}, status=400)

    db = get_db()
    row = db.execute(
        "SELECT status FROM vault_entries WHERE dealer_id = ?", (dealer_id,)
    ).fetchone()
    if row and row["status"] == "ready":
        return web.json_response({"ok": True, "dealer_id": dealer_id, "unchanged": True})

    if row:
        db.execute("""
            UPDATE vault_entries
            SET pk_m=?, pk_auth=?, status='registered',
                wallet_name=COALESCE(?, wallet_name),
                updated_at=datetime('now')
            WHERE dealer_id=?
        """, (pk_m, pk_auth, wallet_name, dealer_id))
    else:
        db.execute("""
            INSERT INTO vault_entries (dealer_id, wallet_name, pk_m, pk_auth, status)
            VALUES (?, ?, ?, ?, 'registered')
        """, (dealer_id, wallet_name, pk_m, pk_auth))
    db.commit()

    log.info(f"[REGISTER] dealer_id={dealer_id} pk_m={pk_m[:8]}…")
    return web.json_response({"ok": True, "dealer_id": dealer_id})


# ── HTTP API (chamados pelo browser) ─────────────────────────────────────────

async def api_vault_pubkey(request: web.Request) -> web.Response:
    dealer_id = request.match_info["dealer_id"]
    row = get_db().execute(
        "SELECT pk_m, pk_auth, status, wallet_name FROM vault_entries WHERE dealer_id = ?",
        (dealer_id,),
    ).fetchone()
    if not row:
        return web.json_response({"error": "dealer_id não encontrado"}, status=404)
    if not _row_has_keys(row):
        return web.json_response(
            {"error": "dealer_id aguardando chaves do manager — inicie o manager_dealer"},
            status=404,
        )
    return web.json_response({
        "pk_m":        row["pk_m"],
        "pk_auth":     row["pk_auth"],
        "status":      row["status"],
        "wallet_name": row["wallet_name"],
    })


async def api_vault_passphrase(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "JSON inválido"}, status=400)

    dealer_id   = body.get("dealer_id", "").strip()
    enc_p       = body.get("enc_p", "").strip()
    sealed_r    = body.get("sealed_r", "").strip()
    wallet_name = (body.get("wallet_name") or "").strip() or None

    if not all([dealer_id, enc_p, sealed_r]):
        return web.json_response({"error": "Campos obrigatórios: dealer_id, enc_p, sealed_r"}, status=400)

    db = get_db()
    row = db.execute(
        "SELECT dealer_id, pk_m, pk_auth FROM vault_entries WHERE dealer_id = ?", (dealer_id,)
    ).fetchone()
    if not row:
        return web.json_response({"error": "dealer_id não existe — crie o dealer no painel Vault primeiro"}, status=404)
    if not _row_has_keys(row):
        return web.json_response(
            {"error": "Manager ainda não registrou as chaves — inicie o manager_dealer"},
            status=409,
        )

    db.execute("""
        UPDATE vault_entries
        SET enc_p=?, sealed_r=?, status='ready',
            wallet_name=COALESCE(?, wallet_name),
            updated_at=datetime('now')
        WHERE dealer_id=?
    """, (enc_p, sealed_r, wallet_name, dealer_id))
    db.commit()

    log.info(f"[PASSPHRASE] Vault pronto para dealer_id={dealer_id}")
    return web.json_response({"ok": True})


async def api_vault_dealers_list(request: web.Request) -> web.Response:
    rows = get_db().execute(
        "SELECT dealer_id, wallet_name, status, pk_m, pk_auth FROM vault_entries ORDER BY created_at"
    ).fetchall()
    return web.json_response({"dealers": [_dealer_public(r) for r in rows]})


async def api_vault_dealers_create(request: web.Request) -> web.Response:
    """Cria carteira no vault. Só wallet_name é obrigatório; dealer_id é gerado automaticamente."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "JSON inválido"}, status=400)

    wallet_name = (body.get("wallet_name") or "").strip()
    dealer_id   = (body.get("dealer_id") or "").strip()

    if not wallet_name:
        return web.json_response({"error": "Informe o nome da carteira (wallet_name)"}, status=400)

    db = get_db()

    dup = db.execute(
        "SELECT dealer_id FROM vault_entries WHERE lower(wallet_name) = lower(?)",
        (wallet_name,),
    ).fetchone()
    if dup and (not dealer_id or dup["dealer_id"] != dealer_id):
        return web.json_response(
            {"error": f"Carteira '{wallet_name}' já existe"},
            status=409,
        )

    try:
        row = None
        if dealer_id:
            row = db.execute(
                "SELECT status FROM vault_entries WHERE dealer_id = ?", (dealer_id,)
            ).fetchone()

        if row and row["status"] == "ready":
            db.execute(
                "UPDATE vault_entries SET wallet_name=?, updated_at=datetime('now') WHERE dealer_id=?",
                (wallet_name, dealer_id),
            )
            db.commit()
            return web.json_response({"ok": True, "dealer_id": dealer_id, "wallet_name": wallet_name, "updated_name": True})

        if not dealer_id:
            dealer_id = _next_dealer_id(db)

        if row:
            db.execute(
                "UPDATE vault_entries SET wallet_name=?, updated_at=datetime('now') WHERE dealer_id=?",
                (wallet_name, dealer_id),
            )
        else:
            _insert_pending_dealer(db, dealer_id, wallet_name)

        db.commit()
        _audit("dealer_upsert", dealer_id, request.remote, "success")
        log.info(f"[CREATE] dealer_id={dealer_id} wallet={wallet_name}")
        return web.json_response({"ok": True, "dealer_id": dealer_id, "wallet_name": wallet_name})

    except sqlite3.IntegrityError as exc:
        log.error(f"[CREATE FAIL] {exc}")
        return web.json_response({"error": "Carteira já existe ou ID inválido"}, status=409)
    except Exception as exc:
        log.exception(f"[CREATE FAIL] wallet={wallet_name}")
        return web.json_response({"error": str(exc)}, status=500)


async def api_vault_dealers_delete(request: web.Request) -> web.Response:
    """Remove dealer do catálogo (recadastro do zero no website)."""
    dealer_id = request.match_info["dealer_id"].strip()
    if not dealer_id:
        return web.json_response({"error": "dealer_id inválido"}, status=400)

    db = get_db()
    row = db.execute(
        "SELECT dealer_id FROM vault_entries WHERE dealer_id = ?", (dealer_id,)
    ).fetchone()
    if not row:
        return web.json_response({"error": "dealer_id não encontrado"}, status=404)

    db.execute("DELETE FROM vault_entries WHERE dealer_id = ?", (dealer_id,))
    db.commit()
    _audit("dealer_delete", dealer_id, request.remote, "success")
    return web.json_response({"ok": True, "dealer_id": dealer_id})


async def api_vault_dealers_reset(request: web.Request) -> web.Response:
    """
    Redefine chaves + passphrase — mantém dealer_id e wallet_name.
    Fluxo: reset → manager registra pk_m/pk_auth → admin cadastra passphrase de novo.
    """
    dealer_id = request.match_info["dealer_id"].strip()
    if not dealer_id:
        return web.json_response({"error": "dealer_id inválido"}, status=400)

    db = get_db()
    row = db.execute(
        "SELECT dealer_id, wallet_name FROM vault_entries WHERE dealer_id = ?", (dealer_id,)
    ).fetchone()
    if not row:
        return web.json_response({"error": "dealer_id não encontrado"}, status=404)

    db.execute("""
        UPDATE vault_entries
        SET pk_m='', pk_auth='', enc_p=NULL, sealed_r=NULL,
            status='pending', updated_at=datetime('now')
        WHERE dealer_id=?
    """, (dealer_id,))
    db.commit()
    _audit("dealer_reset", dealer_id, request.remote, "success")
    log.info(f"[RESET] dealer_id={dealer_id} wallet={row['wallet_name']}")
    return web.json_response({
        "ok": True,
        "dealer_id": dealer_id,
        "wallet_name": row["wallet_name"],
        "status": "pending",
        "message": "Chaves e passphrase removidas. Inicie o manager no celular e cadastre a passphrase de novo.",
    })


# ── WebSocket Vault (chamado por vault_ws_client.py) ─────────────────────────

async def vault_ws_handler(request: web.Request) -> web.WebSocketResponse:
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    state           = "init"
    challenge_nonce = None
    dealer_id       = None
    ip              = request.remote

    async for msg in ws:
        if msg.type != WSMsgType.TEXT:
            break

        try:
            data = json.loads(msg.data)
        except Exception:
            break

        mtype = data.get("type")

        # ── Fase 1: identificação ──────────────────────────────────────────
        if state == "init" and mtype == "vault_auth":
            dealer_id   = data.get("dealer_id", "")
            pk_auth_hex = data.get("pk_auth", "")

            row = get_db().execute(
                "SELECT pk_auth FROM vault_entries WHERE dealer_id = ?", (dealer_id,)
            ).fetchone()

            if not row or not row["pk_auth"]:
                await ws.send_json({"type": "error", "message": "dealer_id não registrado"})
                break

            if row["pk_auth"] != pk_auth_hex:
                await ws.send_json({"type": "error", "message": "pk_auth não coincide com o registrado"})
                break

            challenge_nonce = secrets.token_bytes(32)
            state = "challenged"
            await ws.send_json({"type": "challenge", "nonce": challenge_nonce.hex()})

        # ── Fase 2: verificação Ed25519 ───────────────────────────────────
        elif state == "challenged" and mtype == "vault_auth_response":
            sig_hex = data.get("signature", "")

            row = get_db().execute(
                "SELECT pk_auth FROM vault_entries WHERE dealer_id = ?", (dealer_id,)
            ).fetchone()

            payload = challenge_nonce + dealer_id.encode()
            try:
                verify_key = nacl.signing.VerifyKey(bytes.fromhex(row["pk_auth"]))
                verify_key.verify(payload, bytes.fromhex(sig_hex))
                state = "authenticated"
                await ws.send_json({"type": "auth_ok"})
                _audit("vault_auth", dealer_id, ip, "success")
            except (nacl.exceptions.BadSignatureError, Exception) as exc:
                log.warning(f"[WS_AUTH FAIL] dealer_id={dealer_id} ip={ip} {exc}")
                _audit("vault_auth", dealer_id, ip, "failure")
                await ws.send_json({"type": "error", "message": "Autenticação Ed25519 falhou"})
                break

        # ── Fase 3: entrega do vault cifrado ──────────────────────────────
        elif state == "authenticated" and mtype == "vault_fetch":
            row = get_db().execute(
                "SELECT enc_p, sealed_r, status FROM vault_entries WHERE dealer_id = ?",
                (dealer_id,),
            ).fetchone()

            if not row or row["status"] != "ready":
                await ws.send_json({
                    "type": "error",
                    "message": "Vault não está pronto — configure a passphrase no website primeiro",
                })
                break

            _audit("vault_fetch", dealer_id, ip, "success")
            await ws.send_json({
                "type":     "vault_data",
                "enc_p":    row["enc_p"],
                "sealed_r": row["sealed_r"],
            })
            break

    return ws


# ── App ───────────────────────────────────────────────────────────────────────

def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get ("/vault-ws",                       vault_ws_handler)
    app.router.add_get ("/admin/vault/status/{dealer_id}", admin_vault_status)
    app.router.add_post("/admin/vault/register",           admin_vault_register)
    app.router.add_get ("/api/vault/pubkey/{dealer_id}",   api_vault_pubkey)
    app.router.add_post("/api/vault/passphrase",           api_vault_passphrase)
    app.router.add_get ("/api/vault/dealers",              api_vault_dealers_list)
    app.router.add_post("/api/vault/dealers",              api_vault_dealers_create)
    app.router.add_delete("/api/vault/dealers/{dealer_id}", api_vault_dealers_delete)
    app.router.add_post("/api/vault/dealers/{dealer_id}/reset", api_vault_dealers_reset)
    return app


if __name__ == "__main__":
    init_db()
    app = create_app()

    log.info("=" * 55)
    log.info("  Vault Server — Split-Key Backend")
    log.info("=" * 55)
    log.info(f"  DB   : {DB_PATH}")
    log.info(f"  Porta: {HTTP_HOST}:{HTTP_PORT}")
    log.info(f"  Token: {'configurado' if ADMIN_TOKEN != 'change-me' else 'NÃO configurado (use VAULT_ADMIN_TOKEN=...)'}")
    log.info("=" * 55)

    web.run_app(app, host=HTTP_HOST, port=HTTP_PORT, print=None)
