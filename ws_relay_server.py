#!/usr/bin/env python3
"""
WebSocket Relay Server — deploy em rodolforomao.com.br

Faz a ponte entre:
  [dealer_agent local]  ←WS→  [este relay]  ←WSS→  [browsers]

Troca de agente (dev local → Termux produção):
  - Novo agente substitui o anterior (não bloqueia com 4009)
  - Browsers recebem state_reset + agent_status com nova session_id
  - last_state é zerado ao desconectar ou trocar sessão
"""

import asyncio
import json
import os
import time
import websockets
from datetime import datetime
from dotenv import load_dotenv
from websockets.protocol import State

load_dotenv()

TOKEN = os.getenv("WS_BRIDGE_TOKEN", "change-me")
PORT  = int(os.getenv("WS_RELAY_PORT", 8765))
HOST  = os.getenv("WS_RELAY_HOST", "0.0.0.0")

dealer_agent: websockets.WebSocketServerProtocol | None = None
browser_clients: set[websockets.WebSocketServerProtocol] = set()
last_state: dict | None = None
agent_connected_at: float | None = None
agent_session_id: int = 0
agent_meta: dict = {}
_lock = asyncio.Lock()


def ts() -> str:
    return datetime.utcnow().strftime("%H:%M:%S")


def log(msg: str):
    print(f"[{ts()}] {msg}", flush=True)


def _ws_is_open(ws) -> bool:
    if ws is None:
        return False
    state = getattr(ws, "state", None)
    if state is not None:
        return state is State.OPEN
    return not getattr(ws, "closed", True)


def _utc_now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def _state_reset_payload(reason: str) -> dict:
    return {
        "type": "state_reset",
        "reason": reason,
        "ts": _utc_now_iso(),
        "dealers": [],
        "messages": [],
    }


def _agent_status_payload(connected: bool) -> dict:
    payload = {
        "type": "agent_status",
        "connected": connected,
        "ts": _utc_now_iso(),
    }
    if connected and agent_meta:
        payload["session_id"] = agent_meta.get("session_id")
        payload["hostname"] = agent_meta.get("hostname")
        payload["agent_session_id"] = agent_meta.get("agent_session_id")
    return payload


async def broadcast(message: str):
    if not browser_clients:
        return
    results = await asyncio.gather(
        *[client.send(message) for client in list(browser_clients)],
        return_exceptions=True,
    )
    to_remove = {
        client for client, result in zip(list(browser_clients), results)
        if isinstance(result, Exception)
    }
    browser_clients.difference_update(to_remove)


async def broadcast_state_reset(reason: str):
    global last_state
    last_state = None
    await broadcast(json.dumps(_state_reset_payload(reason)))


async def _disconnect_previous_agent(new_hostname: str) -> None:
    """Encerra agente anterior para permitir troca local → produção."""
    global dealer_agent, last_state, agent_meta

    prev = dealer_agent
    if prev is None or not _ws_is_open(prev):
        dealer_agent = None
        last_state = None
        agent_meta = {}
        return

    prev_host = agent_meta.get("hostname", "?")
    log(f"Substituindo agente '{prev_host}' por '{new_hostname}'")
    dealer_agent = None
    last_state = None
    agent_meta = {}
    try:
        await prev.close(4010, "Substituído por novo agente")
    except Exception:
        pass
    await broadcast_state_reset("agent_replaced")


async def handle_agent(ws: websockets.WebSocketServerProtocol, auth: dict):
    global dealer_agent, last_state, agent_connected_at, agent_session_id, agent_meta

    hostname = (auth.get("hostname") or "unknown").strip()
    client_session = auth.get("session_id") or auth.get("agent_session_id")

    async with _lock:
        await _disconnect_previous_agent(hostname)
        agent_session_id += 1
        dealer_agent = ws
        agent_connected_at = time.time()
        agent_meta = {
            "session_id": agent_session_id,
            "agent_session_id": client_session,
            "hostname": hostname,
            "connected_at": _utc_now_iso(),
        }

    log(f"Dealer agent conectado: {hostname} (relay session #{agent_session_id})")

    await broadcast_state_reset("agent_connected")
    await broadcast(json.dumps(_agent_status_payload(True)))

    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
                mtype = msg.get("type")

                if mtype == "state_update":
                    last_state = msg
                    await broadcast(raw)

                elif mtype in ("command_result", "event", "error"):
                    await broadcast(raw)

            except Exception as e:
                log(f"Erro ao processar msg do agente: {e}")

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        should_reset = False
        hostname_out = hostname
        async with _lock:
            if dealer_agent is ws:
                dealer_agent = None
                agent_connected_at = None
                last_state = None
                agent_meta = {}
                should_reset = True
                log(f"Dealer agent desconectado: {hostname_out}")
        if should_reset:
            await broadcast_state_reset("agent_disconnected")
            await broadcast(json.dumps(_agent_status_payload(False)))


async def handle_browser(ws: websockets.WebSocketServerProtocol):
    browser_clients.add(ws)
    log(f"Browser conectado: {ws.remote_address}  (total: {len(browser_clients)})")

    agent_live = _ws_is_open(dealer_agent)

    # Nunca envia cache de sessão morta — só estado do agente atualmente conectado
    if agent_live and last_state:
        await ws.send(json.dumps(last_state))
    else:
        await ws.send(json.dumps(_state_reset_payload("no_agent" if not agent_live else "awaiting_state")))

    await ws.send(json.dumps(_agent_status_payload(agent_live)))

    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
                if msg.get("type") == "command":
                    if _ws_is_open(dealer_agent):
                        await dealer_agent.send(raw)
                    else:
                        await ws.send(json.dumps({
                            "type": "error",
                            "message": "Dealer agent não está conectado",
                            "req_id": msg.get("req_id"),
                        }))
            except Exception as e:
                await ws.send(json.dumps({"type": "error", "message": str(e)}))

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        browser_clients.discard(ws)
        log(f"Browser desconectado (restam: {len(browser_clients)})")


async def handler(ws: websockets.WebSocketServerProtocol):
    try:
        raw_auth = await asyncio.wait_for(ws.recv(), timeout=10.0)
        auth = json.loads(raw_auth)
    except asyncio.TimeoutError:
        await ws.close(4001, "Auth timeout")
        return
    except Exception:
        await ws.close(4002, "Mensagem de auth inválida")
        return

    if auth.get("type") != "auth" or auth.get("token") != TOKEN:
        await ws.send(json.dumps({"type": "auth_fail", "message": "Token inválido"}))
        await ws.close(4003, "Unauthorized")
        return

    await ws.send(json.dumps({"type": "auth_ok"}))

    role = auth.get("role", "browser")
    if role == "dealer_agent":
        await handle_agent(ws, auth)
    elif role == "browser":
        await handle_browser(ws)
    else:
        await ws.close(4004, f"Role desconhecida: {role}")


async def heartbeat():
    while True:
        await asyncio.sleep(30)
        if browser_clients:
            dead = set()
            for client in list(browser_clients):
                try:
                    await client.ping()
                except Exception:
                    dead.add(client)
            browser_clients.difference_update(dead)


async def main():
    log(f"Relay iniciando em {HOST}:{PORT}")
    log(f"Token configurado: {'SIM' if TOKEN != 'change-me' else 'NÃO (use WS_BRIDGE_TOKEN=...)'}")

    asyncio.create_task(heartbeat())

    async with websockets.serve(
        handler,
        HOST,
        PORT,
        ping_interval=None,
        max_size=2 * 1024 * 1024,
    ):
        log("Relay rodando. Aguardando conexões...")
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log("Relay encerrado.")
