#!/usr/bin/env python3
"""
termux_api_server.py — Status do Liquid node + saúde do device Termux (S22).

Coleta via SSH (adb forward → porta 8022) métricas de:
  - sync blockchain (mainnet/testnet via elements-cli getblockchaininfo)
  - RAM, disco, núcleos CPU, load average, top processos
  - estado dos daemons elementsd

Endpoints:
  GET /health              — healthcheck do próprio processo
  GET /api/termux/status   — snapshot completo (cache curto)

Variáveis de ambiente:
  TERMUX_HTTP_PORT / TERMUX_HTTP_HOST
  TERMUX_SSH_HOST / TERMUX_SSH_PORT / TERMUX_SSH_USER
  TERMUX_SSH_PASSWORD  ou  TERMUX_SSH_PASS_FILE
  TERMUX_ADB_FORWARD   (1/0 — tenta `adb forward` antes do SSH)
  TERMUX_STATUS_CACHE_SECONDS
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import shutil
import time
from pathlib import Path

try:
    from dotenv import load_dotenv

    _env = Path(__file__).parent / ".env"
    if _env.exists():
        load_dotenv(_env)
except ImportError:
    pass

from aiohttp import web

HTTP_PORT = int(os.environ.get("TERMUX_HTTP_PORT", "8768"))
HTTP_HOST = os.environ.get("TERMUX_HTTP_HOST", "127.0.0.1")

SSH_HOST = os.environ.get("TERMUX_SSH_HOST", "127.0.0.1")
SSH_PORT = int(os.environ.get("TERMUX_SSH_PORT", "8022"))
SSH_USER = os.environ.get("TERMUX_SSH_USER", "u0_a351")
SSH_PASSWORD = os.environ.get("TERMUX_SSH_PASSWORD", "")
SSH_PASS_FILE = os.environ.get("TERMUX_SSH_PASS_FILE", "")
ADB_FORWARD = os.environ.get("TERMUX_ADB_FORWARD", "1").strip() not in ("0", "false", "no")
CACHE_SECONDS = float(os.environ.get("TERMUX_STATUS_CACHE_SECONDS", "8"))
SSH_TIMEOUT = float(os.environ.get("TERMUX_SSH_TIMEOUT", "25"))

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("termux_api")

_cache: dict = {"data": None, "ts": 0.0}

REMOTE_SCRIPT = r"""
set +e
python3 - <<'PY'
import json, os, re, subprocess, time
from pathlib import Path

HOME = Path.home()
SERVER = HOME / "server"

def run(cmd, timeout=12):
    try:
        p = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        return (p.stdout or "") + (p.stderr or ""), p.returncode
    except Exception as e:
        return str(e), 1

def parse_meminfo(text):
    out = {}
    for line in text.splitlines():
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        m = re.search(r"(\d+)", v)
        if m:
            out[k.strip()] = int(m.group(1)) * 1024  # kB -> bytes
    total = out.get("MemTotal")
    avail = out.get("MemAvailable")
    used = (total - avail) if total is not None and avail is not None else None
    return {
        "total_bytes": total,
        "available_bytes": avail,
        "free_bytes": out.get("MemFree"),
        "used_bytes": used,
        "cached_bytes": out.get("Cached"),
        "buffers_bytes": out.get("Buffers"),
        "swap_total_bytes": out.get("SwapTotal"),
        "swap_free_bytes": out.get("SwapFree"),
        "swap_used_bytes": (
            (out["SwapTotal"] - out["SwapFree"])
            if "SwapTotal" in out and "SwapFree" in out
            else None
        ),
        "usage_percent": round(100.0 * used / total, 1) if total and used is not None else None,
    }

def parse_df(text):
    lines = [l for l in text.splitlines() if l.strip()]
    if len(lines) < 2:
        return None
    # handle wrapped headers: take last non-header line
    parts = lines[-1].split()
    if len(parts) < 6:
        return None
    try:
        size_k = int(parts[1])
        used_k = int(parts[2])
        avail_k = int(parts[3])
        pct = int(parts[4].rstrip("%"))
    except ValueError:
        return None
    return {
        "filesystem": parts[0],
        "mount": parts[5] if len(parts) >= 6 else None,
        "total_bytes": size_k * 1024,
        "used_bytes": used_k * 1024,
        "available_bytes": avail_k * 1024,
        "usage_percent": pct,
    }

def cpu_info():
    text, _ = run("cat /proc/cpuinfo 2>/dev/null")
    cores = len(re.findall(r"^processor\s*:", text, re.M))
    hw = None
    m = re.search(r"^Hardware\s*:\s*(.+)$", text, re.M)
    if m:
        hw = m.group(1).strip()
    if not cores:
        out, _ = run("nproc 2>/dev/null")
        try:
            cores = int(out.strip().split()[0])
        except Exception:
            cores = None
    up, _ = run("uptime 2>/dev/null")
    loads = None
    m = re.search(r"load average:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)", up)
    if m:
        loads = {
            "1m": float(m.group(1)),
            "5m": float(m.group(2)),
            "15m": float(m.group(3)),
        }
    uptime_s = None
    try:
        with open("/proc/uptime") as f:
            uptime_s = float(f.read().split()[0])
    except Exception:
        pass
    usage_pct = None
    if loads and cores:
        usage_pct = round(min(100.0, 100.0 * loads["1m"] / cores), 1)
    return {
        "cores": cores,
        "hardware": hw,
        "load_average": loads,
        "usage_percent_estimate": usage_pct,
        "uptime_seconds": uptime_s,
        "uptime_human": up.strip() if up.strip() else None,
    }

def top_procs(limit=6):
    out, rc = run("ps -A -o pid,pcpu,pmem,rss,comm --sort=-pcpu 2>/dev/null | head -n %d" % (limit + 1))
    if rc != 0 or not out.strip():
        return []
    rows = []
    for line in out.splitlines()[1:]:
        parts = line.split(None, 4)
        if len(parts) < 5:
            continue
        try:
            rows.append({
                "pid": int(parts[0]),
                "cpu_percent": float(parts[1]),
                "mem_percent": float(parts[2]),
                "rss_kb": int(parts[3]),
                "command": parts[4],
            })
        except ValueError:
            continue
    return rows

def chain_dir_bytes(network):
    path = SERVER / network / "data"
    out, _ = run("du -sk %s 2>/dev/null" % path)
    try:
        return int(out.split()[0]) * 1024
    except Exception:
        return None

def daemon_status(network):
    pid_file = SERVER / network / "elementsd.pid"
    pid = None
    running = False
    if pid_file.exists():
        try:
            pid = int(pid_file.read_text().strip())
            running = (subprocess.run(["kill", "-0", str(pid)], capture_output=True).returncode == 0)
        except Exception:
            pass
    return {"pid": pid, "running": running, "data_bytes": chain_dir_bytes(network)}

def blockchain_info(network):
    conf = SERVER / network / "elements.conf"
    base = {"online": False, "error": None, "info": None, "daemon": daemon_status(network)}
    if not conf.exists():
        base["error"] = "elements.conf ausente"
        return base
    cmd = "elements-cli -conf=%s getblockchaininfo 2>&1" % conf
    out, rc = run(cmd, timeout=10)
    out = out.strip()
    if rc != 0 or not out.startswith("{"):
        # timeout / connection errors
        err = out.splitlines()[-1] if out else "RPC indisponível"
        if "Could not connect" in out or "timeout" in out.lower():
            err = "daemon offline / RPC inacessível"
        base["error"] = err[:240]
        return base
    try:
        info = json.loads(out)
    except json.JSONDecodeError:
        base["error"] = "JSON inválido do elements-cli"
        return base
    progress = info.get("verificationprogress")
    blocks = info.get("blocks")
    headers = info.get("headers")
    base.update({
        "online": True,
        "info": {
            "chain": info.get("chain"),
            "blocks": blocks,
            "headers": headers,
            "bestblockhash": info.get("bestblockhash"),
            "verificationprogress": progress,
            "verificationprogress_percent": round(float(progress) * 100, 3) if progress is not None else None,
            "initialblockdownload": info.get("initialblockdownload"),
            "size_on_disk": info.get("size_on_disk"),
            "pruned": info.get("pruned"),
            "warnings": info.get("warnings") or "",
            "headers_gap": (headers - blocks) if isinstance(headers, int) and isinstance(blocks, int) else None,
        },
    })
    return base

mem_txt, _ = run("cat /proc/meminfo 2>/dev/null")
df_txt, _ = run("df -k $HOME 2>/dev/null")

payload = {
    "ok": True,
    "ts": time.time(),
    "host": {
        "hostname": (run("hostname 2>/dev/null")[0] or "").strip() or None,
        "user": os.environ.get("USER"),
        "home": str(HOME),
    },
    "cpu": cpu_info(),
    "memory": parse_meminfo(mem_txt),
    "disk": parse_df(df_txt),
    "processes": top_procs(),
    "blockchain": {
        "mainnet": blockchain_info("mainnet"),
        "testnet": blockchain_info("testnet"),
    },
}
print(json.dumps(payload, separators=(",", ":")))
PY
"""


def _resolve_password() -> str | None:
    if SSH_PASSWORD:
        return SSH_PASSWORD
    if SSH_PASS_FILE:
        path = Path(SSH_PASS_FILE).expanduser()
        if not path.is_absolute():
            # allow relative to cwd or common sibling project
            candidates = [
                Path.cwd() / path,
                Path(__file__).parent / path,
                Path("/home/black/enviroment/tmp/termux_blockchain") / path.name,
            ]
            for c in candidates:
                if c.exists():
                    path = c
                    break
        if path.exists():
            return path.read_text(encoding="utf-8").strip()
    # default sibling project password file
    default = Path("/home/black/enviroment/tmp/termux_blockchain/.ssh_pass_tmp")
    if default.exists():
        return default.read_text(encoding="utf-8").strip()
    return None


async def _ensure_adb_forward() -> dict:
    if not ADB_FORWARD:
        return {"attempted": False, "ok": True}
    adb = shutil.which("adb")
    if not adb:
        return {"attempted": True, "ok": False, "error": "adb não encontrado no PATH"}
    try:
        proc = await asyncio.create_subprocess_exec(
            adb, "forward", f"tcp:{SSH_PORT}", f"tcp:{SSH_PORT}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=8)
        ok = proc.returncode == 0
        return {
            "attempted": True,
            "ok": ok,
            "stdout": (stdout or b"").decode(errors="replace").strip(),
            "stderr": (stderr or b"").decode(errors="replace").strip(),
        }
    except Exception as exc:  # noqa: BLE001
        return {"attempted": True, "ok": False, "error": str(exc)}


async def _ssh_collect(password: str) -> tuple[dict | None, str | None]:
    sshpass = shutil.which("sshpass")
    ssh = shutil.which("ssh")
    if not ssh:
        return None, "ssh não encontrado no PATH"
    if not sshpass:
        return None, "sshpass não encontrado no PATH (necessário para autenticação por senha)"

    cmd = [
        sshpass, "-p", password,
        "ssh",
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        "-o", "LogLevel=ERROR",
        "-o", "ConnectTimeout=8",
        "-o", "PreferredAuthentications=password",
        "-o", "PubkeyAuthentication=no",
        "-p", str(SSH_PORT),
        f"{SSH_USER}@{SSH_HOST}",
        "bash -s",
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(REMOTE_SCRIPT.encode("utf-8")),
            timeout=SSH_TIMEOUT,
        )
    except asyncio.TimeoutError:
        return None, f"timeout SSH ({SSH_TIMEOUT:.0f}s)"
    except Exception as exc:  # noqa: BLE001
        return None, f"falha SSH: {exc}"

    out = (stdout or b"").decode(errors="replace").strip()
    err = (stderr or b"").decode(errors="replace").strip()
    if proc.returncode != 0 and not out:
        return None, err or f"ssh exit {proc.returncode}"

    # remote may print warnings before JSON — take last {...} block
    start = out.find("{")
    end = out.rfind("}")
    if start < 0 or end < start:
        return None, (err or out or "resposta remota sem JSON")[:400]
    try:
        data = json.loads(out[start : end + 1])
    except json.JSONDecodeError as exc:
        return None, f"JSON remoto inválido: {exc}"
    return data, None


async def collect_status(force: bool = False) -> dict:
    now = time.time()
    if (
        not force
        and _cache["data"] is not None
        and (now - _cache["ts"]) < CACHE_SECONDS
    ):
        cached = dict(_cache["data"])
        cached["cached"] = True
        return cached

    password = _resolve_password()
    if not password:
        result = {
            "ok": False,
            "error": "Senha SSH do Termux não configurada (TERMUX_SSH_PASSWORD ou TERMUX_SSH_PASS_FILE)",
            "ts": now,
            "connection": {"ssh_host": SSH_HOST, "ssh_port": SSH_PORT, "ssh_user": SSH_USER},
        }
        return result

    adb_info = await _ensure_adb_forward()
    data, err = await _ssh_collect(password)
    if err or not data:
        result = {
            "ok": False,
            "error": err or "falha ao coletar status",
            "ts": now,
            "connection": {
                "ssh_host": SSH_HOST,
                "ssh_port": SSH_PORT,
                "ssh_user": SSH_USER,
                "adb_forward": adb_info,
            },
        }
        _cache["data"] = result
        _cache["ts"] = now
        return result

    data["ok"] = True
    data["cached"] = False
    data["connection"] = {
        "ssh_host": SSH_HOST,
        "ssh_port": SSH_PORT,
        "ssh_user": SSH_USER,
        "adb_forward": adb_info,
        "reachable": True,
    }
    _cache["data"] = data
    _cache["ts"] = now
    return data


async def health(_request: web.Request) -> web.Response:
    return web.json_response({"ok": True, "service": "termux_api", "ts": time.time()})


async def termux_status(request: web.Request) -> web.Response:
    force = request.rel_url.query.get("refresh") in ("1", "true", "yes")
    data = await collect_status(force=force)
    status = 200 if data.get("ok") else 503
    return web.json_response(data, status=status)


def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/health", health)
    app.router.add_get("/api/termux/status", termux_status)
    return app


def main() -> None:
    app = create_app()
    log.info("termux_api_server ouvindo em %s:%s", HTTP_HOST, HTTP_PORT)
    web.run_app(app, host=HTTP_HOST, port=HTTP_PORT, print=None)


if __name__ == "__main__":
    main()
