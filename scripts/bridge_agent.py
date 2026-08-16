#!/usr/bin/env python3
"""
bridge_agent.py — daemon genérico que registra este device no relay
(ws_relay_server.py, role `bridge_agent`) e o deixa alcançável por SSH real
através do site, mesmo sem IP fixo — mesma técnica de conexão outbound que o
termux_ws_agent.py já usa pra telemetria (resolve o problema de o Termux não
ter IP fixo / não aceitar conexão de entrada).

Ao receber um pedido de sessão (`bridge_open`), abre uma conexão TCP local
(por padrão 127.0.0.1:22 — o sshd deste device) e repassa bytes brutos entre
essa conexão e o relay (frames `bridge_data`, base64). Não interpreta o
conteúdo — o SSH de verdade roda ponta-a-ponta entre quem chama e este
device; o relay e este agente são só transporte.

Rode em qualquer device que deva ficar "alcançável" (Termux, um PC, etc.):

  export SSH_BRIDGE_RELAY_URL=wss://rodolforomao.com.br/dealer-ws
  export SSH_BRIDGE_TOKEN=<token — NUNCA o mesmo do dealer/browser>
  python3 bridge_agent.py --device-id termux --forward-port 8022

De outra máquina, alcance via scripts/bridge_connect.py (ex.: ProxyCommand
do ssh) usando o mesmo --device-id / SSH_BRIDGE_TOKEN.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import socket
import sys

try:
    import websockets
except ImportError:
    print("Instale: pip install 'websockets>=12,<14'", file=sys.stderr)
    sys.exit(1)

RELAY_URL = os.environ.get("SSH_BRIDGE_RELAY_URL", "wss://rodolforomao.com.br/dealer-ws")
TOKEN = os.environ.get("SSH_BRIDGE_TOKEN", "")
CHUNK_SIZE = 32 * 1024


def log(msg: str) -> None:
    print(f"[bridge-agent] {msg}", flush=True)


class Session:
    """Uma conexão TCP local (ex.: sshd) pareada com um session_id do relay."""

    def __init__(self, session_id: str, ws, forward_host: str, forward_port: int):
        self.session_id = session_id
        self.ws = ws
        self.forward_host = forward_host
        self.forward_port = forward_port
        self.writer: asyncio.StreamWriter | None = None
        self.inbound: asyncio.Queue[bytes | None] = asyncio.Queue()
        self._tasks: list[asyncio.Task] = []

    async def start(self) -> bool:
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(self.forward_host, self.forward_port), timeout=10
            )
        except Exception as exc:  # noqa: BLE001
            await self._send({"type": "bridge_error", "session_id": self.session_id, "message": str(exc)})
            return False
        self.writer = writer
        self._tasks.append(asyncio.create_task(self._pump_local_to_ws(reader)))
        self._tasks.append(asyncio.create_task(self._pump_queue_to_local()))
        return True

    async def _send(self, payload: dict) -> None:
        try:
            await self.ws.send(json.dumps(payload))
        except Exception:
            pass

    async def _pump_local_to_ws(self, reader: asyncio.StreamReader) -> None:
        try:
            while True:
                data = await reader.read(CHUNK_SIZE)
                if not data:
                    break
                await self._send({
                    "type": "bridge_data",
                    "session_id": self.session_id,
                    "data": base64.b64encode(data).decode("ascii"),
                })
        except Exception:
            pass
        finally:
            await self._send({"type": "bridge_close", "session_id": self.session_id})

    async def _pump_queue_to_local(self) -> None:
        try:
            while True:
                data = await self.inbound.get()
                if data is None:
                    break
                if self.writer:
                    self.writer.write(data)
                    await self.writer.drain()
        except Exception:
            pass

    async def feed(self, data: bytes) -> None:
        await self.inbound.put(data)

    async def close(self) -> None:
        await self.inbound.put(None)
        for task in self._tasks:
            task.cancel()
        if self.writer:
            try:
                self.writer.close()
            except Exception:
                pass


async def run(device_id: str, forward_host: str, forward_port: int) -> None:
    sessions: dict[str, Session] = {}
    auth = {
        "type": "auth",
        "role": "bridge_agent",
        "token": TOKEN,
        "device_id": device_id,
        "hostname": socket.gethostname(),
    }
    backoff = 2.0
    while True:
        try:
            log(f"conectando {RELAY_URL} como '{device_id}' …")
            async with websockets.connect(
                RELAY_URL, ping_interval=20, ping_timeout=60, max_size=4 * 1024 * 1024, open_timeout=20,
            ) as ws:
                await ws.send(json.dumps(auth))
                raw = await asyncio.wait_for(ws.recv(), timeout=15)
                reply = json.loads(raw)
                if reply.get("type") != "auth_ok":
                    log(f"auth falhou: {reply}")
                    await asyncio.sleep(10)
                    continue

                log(f"autenticado — encaminhando sessões para {forward_host}:{forward_port}")
                backoff = 2.0

                async for raw_msg in ws:
                    try:
                        msg = json.loads(raw_msg)
                    except Exception:
                        continue
                    mtype = msg.get("type")
                    sid = msg.get("session_id")

                    if mtype == "bridge_open" and sid:
                        sess = Session(sid, ws, forward_host, forward_port)
                        sessions[sid] = sess
                        ok = await sess.start()
                        if not ok:
                            sessions.pop(sid, None)
                        log(f"sessão {sid}: {'aberta' if ok else 'falhou'}")
                    elif mtype == "bridge_data" and sid in sessions:
                        try:
                            data = base64.b64decode(msg.get("data") or "")
                        except Exception:
                            continue
                        await sessions[sid].feed(data)
                    elif mtype in ("bridge_close", "bridge_error") and sid in sessions:
                        sess = sessions.pop(sid)
                        await sess.close()
                        log(f"sessão {sid}: encerrada")
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            log(f"desconectado ({exc}) — retry em {backoff:.0f}s")
            await asyncio.sleep(backoff)
            backoff = min(60.0, backoff * 1.7)
        finally:
            for sess in list(sessions.values()):
                await sess.close()
            sessions.clear()


def main() -> None:
    ap = argparse.ArgumentParser(description="Bridge agent genérico — expõe este device via relay/SSH")
    ap.add_argument("--device-id", required=True, help="Identificador único deste device no relay (ex.: termux, pc-black)")
    ap.add_argument("--forward-host", default="127.0.0.1")
    ap.add_argument("--forward-port", type=int, default=22, help="Porta local a expor (padrão 22, sshd)")
    args = ap.parse_args()

    if not TOKEN:
        print("SSH_BRIDGE_TOKEN não definido", file=sys.stderr)
        sys.exit(2)

    try:
        asyncio.run(run(args.device_id, args.forward_host, args.forward_port))
    except KeyboardInterrupt:
        log("encerrado")


if __name__ == "__main__":
    main()
