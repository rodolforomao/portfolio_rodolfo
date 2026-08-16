#!/usr/bin/env python3
"""
bridge_connect.py — conector genérico usado tipicamente como `ProxyCommand`
do ssh (ou de qualquer outra ferramenta baseada em stdin/stdout) para
alcançar um device registrado no relay (ws_relay_server.py, role
`bridge_agent`) mesmo sem IP fixo/direto — o site é só a ponte.

Uso típico (~/.ssh/config):

  Host termux-bridge
    ProxyCommand python3 /caminho/para/scripts/bridge_connect.py --to termux
    User u0_a351

  $ ssh termux-bridge

Ou direto na linha de comando:

  ssh -o ProxyCommand="python3 scripts/bridge_connect.py --to termux" u0_a351@termux-bridge

Também serve pra device2 → site → device3: rode este script na origem
(device2), apontando --to para o device_id registrado por device3 (que roda
scripts/bridge_agent.py --device-id device3).

Variáveis de ambiente:
  SSH_BRIDGE_RELAY_URL  (default wss://rodolforomao.com.br/dealer-ws)
  SSH_BRIDGE_TOKEN       (obrigatório — NUNCA o mesmo token do dealer/browser)
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import sys
import uuid

try:
    import websockets
except ImportError:
    print("Instale: pip install 'websockets>=12,<14'", file=sys.stderr)
    sys.exit(1)

RELAY_URL = os.environ.get("SSH_BRIDGE_RELAY_URL", "wss://rodolforomao.com.br/dealer-ws")
TOKEN = os.environ.get("SSH_BRIDGE_TOKEN", "")
CHUNK_SIZE = 32 * 1024


async def _stdin_reader() -> asyncio.StreamReader:
    loop = asyncio.get_event_loop()
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await loop.connect_read_pipe(lambda: protocol, sys.stdin)
    return reader


async def run(to: str) -> int:
    if not TOKEN:
        print("SSH_BRIDGE_TOKEN não definido", file=sys.stderr)
        return 2

    session_id = uuid.uuid4().hex
    stdout = sys.stdout.buffer

    try:
        async with websockets.connect(
            RELAY_URL, ping_interval=20, ping_timeout=60, max_size=4 * 1024 * 1024, open_timeout=15,
        ) as ws:
            await ws.send(json.dumps({"type": "auth", "role": "bridge_client", "token": TOKEN}))
            raw = await asyncio.wait_for(ws.recv(), timeout=15)
            if json.loads(raw).get("type") != "auth_ok":
                print("auth falhou (verifique SSH_BRIDGE_TOKEN)", file=sys.stderr)
                return 1

            await ws.send(json.dumps({"type": "bridge_connect", "to": to, "session_id": session_id}))

            stdin_reader = await _stdin_reader()

            async def pump_stdin_to_ws() -> None:
                while True:
                    data = await stdin_reader.read(CHUNK_SIZE)
                    if not data:
                        await ws.send(json.dumps({"type": "bridge_close", "session_id": session_id}))
                        break
                    await ws.send(json.dumps({
                        "type": "bridge_data",
                        "session_id": session_id,
                        "data": base64.b64encode(data).decode("ascii"),
                    }))

            async def pump_ws_to_stdout() -> None:
                async for raw_msg in ws:
                    msg = json.loads(raw_msg)
                    mtype = msg.get("type")
                    if mtype == "bridge_data" and msg.get("session_id") == session_id:
                        stdout.write(base64.b64decode(msg.get("data") or ""))
                        stdout.flush()
                    elif mtype == "bridge_error" and msg.get("session_id") == session_id:
                        print(f"bridge_error: {msg.get('message')}", file=sys.stderr)
                        return
                    elif mtype == "bridge_close" and msg.get("session_id") == session_id:
                        return

            stdin_task = asyncio.create_task(pump_stdin_to_ws())
            stdout_task = asyncio.create_task(pump_ws_to_stdout())
            try:
                # Quem sinaliza fim primeiro decide: se foi o remoto (bridge_close/
                # bridge_error recebido), não há mais nada a enviar. Se foi o stdin
                # local (EOF), não dá pra esperar uma confirmação simétrica — o
                # relay já removeu o mapeamento da sessão assim que encaminhou o
                # bridge_close — então só damos um período de graça curto pra
                # eventual dado final em trânsito antes de encerrar.
                _, pending = await asyncio.wait(
                    {stdin_task, stdout_task}, return_when=asyncio.FIRST_COMPLETED
                )
                if stdout_task in pending:
                    try:
                        await asyncio.wait_for(stdout_task, timeout=2.0)
                    except asyncio.TimeoutError:
                        pass
            finally:
                for task in (stdin_task, stdout_task):
                    if not task.done():
                        task.cancel()
                await asyncio.gather(stdin_task, stdout_task, return_exceptions=True)
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"bridge_connect falhou: {exc}", file=sys.stderr)
        return 1


def main() -> None:
    ap = argparse.ArgumentParser(description="Conector genérico via relay (uso típico: ssh ProxyCommand)")
    ap.add_argument("--to", required=True, help="device_id alvo registrado no relay (ex.: termux)")
    args = ap.parse_args()
    sys.exit(asyncio.run(run(args.to)))


if __name__ == "__main__":
    main()
