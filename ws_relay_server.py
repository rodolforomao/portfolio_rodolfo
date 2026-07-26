#!/usr/bin/env python3
"""
WebSocket Relay Server — deploy em rodolforomao.com.br

Faz a ponte entre:
  [dealer_agent]  ←WS→  [este relay]  ←WSS→  [browsers]
  [termux_agent]  ←WS→  [este relay]  ←WSS→  [browsers]

Troca de agente (dev local → Termux produção):
  - Novo agente substitui o anterior (não bloqueia com 4009)
  - Browsers recebem state_reset + agent_status com nova session_id
  - last_state é zerado ao desconectar ou trocar sessão

Termux (rede residencial, sem IP fixo):
  - role `termux_agent` abre WSS outbound (mesmo /dealer-ws)
  - envia `termux_status` (sync Liquid + saúde do device)
  - browsers recebem `termux_agent_status` + `termux_status`
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
PORT = int(os.getenv("WS_RELAY_PORT", 8765))
HOST = os.getenv("WS_RELAY_HOST", "0.0.0.0")

dealer_agent: websockets.WebSocketServerProtocol | None = None
termux_agent: websockets.WebSocketServerProtocol | None = None
browser_clients: set[websockets.WebSocketServerProtocol] = set()
last_state: dict | None = None
last_termux_status: dict | None = None
agent_connected_at: float | None = None
agent_session_id: int = 0
agent_meta: dict = {}
termux_session_id: int = 0
termux_meta: dict = {}
_lock = asyncio.Lock()

# Janela pra detectar duas fontes brigando pela mesma vaga de agente (ex: um
# manager_dealer de dev esquecido rodando e apontando pra produção, disputando
# com o Termux real) — cada substituição registra um timestamp aqui; se
# várias acontecerem em pouco tempo, é sinal de concorrência, não de uma
# troca única esperada (dev → produção).
CONFLICT_WINDOW_SECONDS = 600   # 10 min
CONFLICT_THRESHOLD = 3          # a partir de quantas trocas nessa janela avisa
_replacement_events: list[float] = []


def ts() -> str:
    return datetime.utcnow().strftime("%H:%M:%S")


def log(msg: str):
    print(f"[{ts()}] {msg}", flush=True)


def _extract_client_ip(ws) -> str | None:
    """IP real do agente, observado pelo relay — não confia em nada que o
    agente diga sobre si mesmo (evita depender de config manual tipo
    MANAGER_AGENT_NAME no .env de cada instância). Em produção o tráfego
    passa pelo nginx (X-Forwarded-For/X-Real-IP já configurados nas
    locations /dealer-ws e /vault-ws); em dev local sem proxy, cai pro IP
    de conexão TCP direta (ws.remote_address).
    """
    try:
        headers = getattr(getattr(ws, "request", None), "headers", None)
        if headers is not None:
            xff = headers.get("X-Forwarded-For")
            if xff:
                return xff.split(",")[0].strip()
            xri = headers.get("X-Real-IP")
            if xri:
                return xri.strip()
    except Exception:
        pass
    try:
        return ws.remote_address[0]
    except Exception:
        return None


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
        # IP observado pelo próprio relay (via X-Forwarded-For/X-Real-IP, não
        # dado enviado pelo agente) — junto com hostname/tag forma o
        # "fingerprint" que o frontend usa pra deixar o operador nomear a
        # fonte manualmente (ver localStorage em useDealerWs.js).
        payload["ip"] = agent_meta.get("ip")
        payload["agent_session_id"] = agent_meta.get("agent_session_id")
        payload["git_tag"] = agent_meta.get("git_tag")
        payload["pid"] = agent_meta.get("pid")
    return payload


def _termux_agent_status_payload(connected: bool) -> dict:
    payload = {
        "type": "termux_agent_status",
        "connected": connected,
        "ts": _utc_now_iso(),
    }
    if connected and termux_meta:
        payload["session_id"] = termux_meta.get("session_id")
        payload["hostname"] = termux_meta.get("hostname")
        payload["ip"] = termux_meta.get("ip")
        payload["pid"] = termux_meta.get("pid")
        payload["device"] = termux_meta.get("device")
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


def _record_replacement() -> int:
    """Registra uma substituição de agente e retorna quantas aconteceram
    dentro de CONFLICT_WINDOW_SECONDS (incluindo esta)."""
    now = time.time()
    _replacement_events.append(now)
    cutoff = now - CONFLICT_WINDOW_SECONDS
    while _replacement_events and _replacement_events[0] < cutoff:
        _replacement_events.pop(0)
    return len(_replacement_events)


def _agent_conflict_payload(prev_meta: dict, new_meta: dict, recent_count: int) -> dict:
    return {
        "type": "agent_conflict",
        "ts": _utc_now_iso(),
        "recent_replacements": recent_count,
        "window_seconds": CONFLICT_WINDOW_SECONDS,
        "likely_ongoing": recent_count >= CONFLICT_THRESHOLD,
        "previous": {
            "hostname": prev_meta.get("hostname"),
            "ip": prev_meta.get("ip"),
            "git_tag": prev_meta.get("git_tag"),
            "pid": prev_meta.get("pid"),
        },
        "new": {
            "hostname": new_meta.get("hostname"),
            "ip": new_meta.get("ip"),
            "git_tag": new_meta.get("git_tag"),
            "pid": new_meta.get("pid"),
        },
    }


async def _disconnect_previous_agent(new_meta: dict) -> None:
    """Encerra agente anterior para permitir troca local → produção.

    Também detecta concorrência entre duas fontes (ex: um manager_dealer de
    dev esquecido rodando e disputando com o Termux real pela mesma vaga) —
    ver CONFLICT_WINDOW_SECONDS acima. O site usa isso pra avisar o operador
    a procurar/derrubar o manager excedente, em vez de só piscar "Manager OK"
    de forma intermitente sem explicar o motivo.
    """
    global dealer_agent, last_state, agent_meta

    prev = dealer_agent
    if prev is None or not _ws_is_open(prev):
        dealer_agent = None
        last_state = None
        agent_meta = {}
        return

    prev_meta = dict(agent_meta)
    prev_label = f"{prev_meta.get('hostname', '?')} ({prev_meta.get('ip', '?')})"
    new_label = f"{new_meta.get('hostname', '?')} ({new_meta.get('ip', '?')})"
    log(f"Substituindo agente '{prev_label}' por '{new_label}'")
    dealer_agent = None
    last_state = None
    agent_meta = {}
    try:
        await prev.close(4010, "Substituído por novo agente")
    except Exception:
        pass

    recent_count = _record_replacement()
    await broadcast(json.dumps(_agent_conflict_payload(prev_meta, new_meta, recent_count)))
    await broadcast_state_reset("agent_replaced")


async def _disconnect_previous_termux(new_meta: dict) -> None:
    global termux_agent, last_termux_status, termux_meta

    prev = termux_agent
    if prev is None or not _ws_is_open(prev):
        termux_agent = None
        # mantém last_termux_status até novo sample (browser ainda vê dados frescos)
        termux_meta = {}
        return

    # Mesmo hostname+pid reconectando: encerra o socket velho sem zerar cache
    same = (
        termux_meta.get("hostname") == new_meta.get("hostname")
        and termux_meta.get("pid") is not None
        and termux_meta.get("pid") == new_meta.get("pid")
    )
    prev_label = f"{termux_meta.get('hostname', '?')} ({termux_meta.get('ip', '?')})"
    new_label = f"{new_meta.get('hostname', '?')} ({new_meta.get('ip', '?')})"
    log(f"Substituindo termux_agent '{prev_label}' por '{new_label}'" + (" (reconnect)" if same else ""))
    termux_agent = None
    if not same:
        last_termux_status = None
    termux_meta = {}
    try:
        await prev.close(4010, "Substituído por novo termux_agent")
    except Exception:
        pass


async def handle_agent(ws: websockets.WebSocketServerProtocol, auth: dict):
    global dealer_agent, last_state, agent_connected_at, agent_session_id, agent_meta

    hostname = (auth.get("hostname") or "unknown").strip()
    ip = _extract_client_ip(ws)
    client_session = auth.get("session_id") or auth.get("agent_session_id")
    git_tag = auth.get("git_tag")
    pid = auth.get("pid")

    async with _lock:
        await _disconnect_previous_agent({"hostname": hostname, "ip": ip, "git_tag": git_tag, "pid": pid})
        agent_session_id += 1
        dealer_agent = ws
        agent_connected_at = time.time()
        agent_meta = {
            "session_id": agent_session_id,
            "agent_session_id": client_session,
            "hostname": hostname,
            "ip": ip,
            "git_tag": git_tag,
            "pid": pid,
            "connected_at": _utc_now_iso(),
        }

    log(f"Dealer agent conectado: {hostname} (ip {ip or '?'}, relay session #{agent_session_id}, tag {git_tag or '?'}, pid {pid or '?'})")

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
        async with _lock:
            if dealer_agent is ws:
                dealer_agent = None
                agent_connected_at = None
                last_state = None
                agent_meta = {}
                should_reset = True
                log(f"Dealer agent desconectado: {hostname} (ip {ip or '?'})")
        if should_reset:
            await broadcast_state_reset("agent_disconnected")
            await broadcast(json.dumps(_agent_status_payload(False)))


async def handle_termux_agent(ws: websockets.WebSocketServerProtocol, auth: dict):
    """Agente no S22/Termux — WSS outbound da rede residencial."""
    global termux_agent, last_termux_status, termux_session_id, termux_meta

    hostname = (auth.get("hostname") or "termux").strip()
    ip = _extract_client_ip(ws)
    pid = auth.get("pid")
    device = auth.get("device") or auth.get("model")

    async with _lock:
        await _disconnect_previous_termux({"hostname": hostname, "ip": ip, "pid": pid})
        termux_session_id += 1
        termux_agent = ws
        termux_meta = {
            "session_id": termux_session_id,
            "hostname": hostname,
            "ip": ip,
            "pid": pid,
            "device": device,
            "connected_at": _utc_now_iso(),
        }

    log(
        f"Termux agent conectado: {hostname} "
        f"(ip {ip or '?'}, session #{termux_session_id}, device {device or '?'}, pid {pid or '?'})"
    )
    await broadcast(json.dumps(_termux_agent_status_payload(True)))
    if last_termux_status:
        await broadcast(json.dumps(last_termux_status))

    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
                mtype = msg.get("type")
                if mtype == "termux_status":
                    # Anexa meta observada pelo relay (IP público residencial)
                    data = msg.get("data") if isinstance(msg.get("data"), dict) else {}
                    enriched = {
                        "type": "termux_status",
                        "ts": msg.get("ts") or _utc_now_iso(),
                        "session_id": termux_meta.get("session_id"),
                        "hostname": hostname,
                        "ip": ip,
                        "device": device,
                        "data": data,
                    }
                    last_termux_status = enriched
                    await broadcast(json.dumps(enriched))
                elif mtype in ("termux_command_result", "heartbeat", "error"):
                    await broadcast(raw)
            except Exception as e:
                log(f"Erro ao processar msg do termux_agent: {e}")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        should_notify = False
        async with _lock:
            if termux_agent is ws:
                termux_agent = None
                last_termux_status = None
                termux_meta = {}
                should_notify = True
                log(f"Termux agent desconectado: {hostname} (ip {ip or '?'})")
        if should_notify:
            await broadcast(json.dumps(_termux_agent_status_payload(False)))


async def handle_browser(ws: websockets.WebSocketServerProtocol):
    browser_clients.add(ws)
    log(f"Browser conectado: {ws.remote_address}  (total: {len(browser_clients)})")

    agent_live = _ws_is_open(dealer_agent)
    termux_live = _ws_is_open(termux_agent)

    # Nunca envia cache de sessão morta — só estado do agente atualmente conectado
    if agent_live and last_state:
        await ws.send(json.dumps(last_state))
    else:
        await ws.send(json.dumps(_state_reset_payload("no_agent" if not agent_live else "awaiting_state")))

    await ws.send(json.dumps(_agent_status_payload(agent_live)))
    await ws.send(json.dumps(_termux_agent_status_payload(termux_live)))
    if termux_live and last_termux_status:
        await ws.send(json.dumps(last_termux_status))

    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
                mtype = msg.get("type")
                if mtype == "command":
                    if _ws_is_open(dealer_agent):
                        await dealer_agent.send(raw)
                    else:
                        await ws.send(json.dumps({
                            "type": "error",
                            "message": "Dealer agent não está conectado",
                            "req_id": msg.get("req_id"),
                            "action": msg.get("action"),
                        }))
                elif mtype == "termux_command":
                    if _ws_is_open(termux_agent):
                        await termux_agent.send(raw)
                    else:
                        await ws.send(json.dumps({
                            "type": "error",
                            "message": "Termux agent não está conectado",
                            "req_id": msg.get("req_id"),
                            "action": msg.get("action"),
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
    elif role == "termux_agent":
        await handle_termux_agent(ws, auth)
    elif role == "browser":
        await handle_browser(ws)
    else:
        await ws.close(4004, f"Role desconhecida: {role}")


async def heartbeat():
    """Pinga browsers em paralelo (30s timeout) — não bloqueia o event loop."""
    while True:
        await asyncio.sleep(30)
        if not browser_clients:
            continue

        dead: set = set()
        clients = list(browser_clients)

        async def _ping_one(client):
            try:
                await asyncio.wait_for(client.ping(), timeout=30.0)
            except Exception:
                dead.add(client)

        tasks = [asyncio.create_task(_ping_one(c)) for c in clients]
        await asyncio.gather(*tasks, return_exceptions=True)
        if dead:
            browser_clients.difference_update(dead)
            log(f"Heartbeat removeu {len(dead)} browser(s) morto(s) (restam: {len(browser_clients)})")


async def main():
    log(f"Relay iniciando em {HOST}:{PORT}")
    log(f"Token configurado: {'SIM' if TOKEN != 'change-me' else 'NÃO (use WS_BRIDGE_TOKEN=...)'}")

    asyncio.create_task(heartbeat())

    async with websockets.serve(
        handler,
        HOST,
        PORT,
        ping_interval=20,
        ping_timeout=60,
        max_size=2 * 1024 * 1024,
    ):
        log("Relay rodando. Aguardando conexões (browser / dealer_agent / termux_agent)...")
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log("Relay encerrado.")
