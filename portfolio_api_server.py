#!/usr/bin/env python3
"""
portfolio_api_server.py — Backend isolado da seção /system (Web OS do portfólio).

Processo e porta totalmente separados do vault_server.py / ws_relay_server.py / manager_dealer.
Não importa nenhum código desses sistemas e não tem acesso a vault_data.db nem a qualquer
credencial do AMM Liquid. Serve apenas dados públicos do portfólio.

Endpoints:
  GET  /health                    — healthcheck
  GET  /api/portfolio/stats       — números fixos (estáticos + GitHub public API)
  POST /api/portfolio/ai-chat     — proxy pro LLM, grounded em public/portfolio_context.json,
                                     rate limit por IP, sem tool-calling/execução de código
  GET  /api/portfolio/dev-metrics — telemetria segura deste processo isolado (uptime, contagem
                                     de requests, GitHub stats) — nada do Dealer/vault

Instalar dependências:
  pip install -r requirements-portfolio.txt

Rodar (dev):
  python portfolio_api_server.py

Variáveis de ambiente:
  PORTFOLIO_HTTP_PORT   porta de escuta (padrão: 8767)
  PORTFOLIO_HTTP_HOST   interface (padrão: 127.0.0.1)
  PORTFOLIO_AI_API_KEY  chave da Anthropic API (só server-side, nunca exposta ao client)
  OPENAI_API_KEY        alternativa à Anthropic — se definida, tem prioridade sobre a Anthropic
  OPENAI_MODEL          modelo OpenAI (padrão: gpt-4o-mini)
  OPENAI_BASE_URL       base URL da API OpenAI (padrão: https://api.openai.com/v1)
"""

import os
import json
import time
import logging
from datetime import datetime
from pathlib import Path

try:
    from dotenv import load_dotenv
    _env = Path(__file__).parent / ".env"
    if _env.exists():
        load_dotenv(_env)
except ImportError:
    pass

import aiohttp
from aiohttp import web

try:
    from anthropic import AsyncAnthropic
except ImportError:  # dependência ainda não instalada — endpoint degrada para 503
    AsyncAnthropic = None

HTTP_PORT = int(os.environ.get("PORTFOLIO_HTTP_PORT", "8767"))
HTTP_HOST = os.environ.get("PORTFOLIO_HTTP_HOST", "127.0.0.1")

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("portfolio_api")

# ---------------------------------------------------------------------------
# /api/portfolio/stats
# ---------------------------------------------------------------------------

# Validado contra o currículo real (src/components/Resume/ResumeNew.js): programando desde 2002,
# 18 sistemas nomeados no currículo, 8 linguagens de programação distintas no grupo "Languages".
CODING_SINCE_YEAR = 2002
STATS_CONSTANTS = {
    "systems_delivered": 18,
    "languages": 8,
}

GITHUB_USERNAME = "rodolforomao"
GITHUB_CACHE_TTL_SECONDS = 10 * 60  # ~10 minutos
_github_cache = {"data": None, "ts": 0.0}

PROCESS_START_TIME = time.time()


async def _fetch_github_stats() -> dict:
    """Busca public_repos/followers na API pública do GitHub, com cache em memória.

    Nunca lança exceção: qualquer falha/timeout resulta em valores None.
    """
    now = time.time()
    cached = _github_cache["data"]
    if cached is not None and (now - _github_cache["ts"]) < GITHUB_CACHE_TTL_SECONDS:
        return cached

    result = {"public_repos": None, "followers": None}
    try:
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            url = f"https://api.github.com/users/{GITHUB_USERNAME}"
            async with session.get(url, headers={"Accept": "application/vnd.github+json"}) as resp:
                if resp.status == 200:
                    body = await resp.json()
                    result = {
                        "public_repos": body.get("public_repos"),
                        "followers": body.get("followers"),
                    }
                else:
                    log.warning("GitHub API respondeu status %s", resp.status)
    except Exception as exc:  # noqa: BLE001 — nunca deve derrubar o endpoint
        log.warning("Falha ao consultar GitHub API: %s", exc)

    _github_cache["data"] = result
    _github_cache["ts"] = now
    return result


async def portfolio_stats(_request: web.Request) -> web.Response:
    gh = await _fetch_github_stats()
    payload = {
        "years_coding": datetime.now().year - CODING_SINCE_YEAR,
        "systems_delivered": STATS_CONSTANTS["systems_delivered"],
        "languages": STATS_CONSTANTS["languages"],
        "github_public_repos": gh["public_repos"],
        "github_followers": gh["followers"],
        "uptime_seconds": int(time.time() - PROCESS_START_TIME),
    }
    return web.json_response(payload)


# ---------------------------------------------------------------------------
# /api/portfolio/ai-chat
# ---------------------------------------------------------------------------

MAX_MESSAGE_LENGTH = 500
RATE_LIMIT_PER_MINUTE = 5
RATE_LIMIT_PER_DAY = 20
RATE_LIMIT_WINDOW_DAY = 24 * 60 * 60
RATE_LIMIT_WINDOW_MINUTE = 60

ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
OPENAI_DEFAULT_MODEL = "gpt-4o-mini"
OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1"
AI_MAX_TOKENS = 400

AI_UNAVAILABLE_MSG = "IA indisponível no momento"

PORTFOLIO_CONTEXT_PATH = Path(__file__).parent / "public" / "portfolio_context.json"

# ip -> list[timestamps] (apenas requests aceitos contam para o limite)
_rate_limit_store: dict[str, list] = {}


def _prune_old_timestamps(timestamps: list, now: float) -> list:
    cutoff = now - RATE_LIMIT_WINDOW_DAY
    return [ts for ts in timestamps if ts >= cutoff]


def _check_rate_limit(ip: str) -> str | None:
    """Retorna uma mensagem de erro amigável se o IP estourou o limite, senão None.

    Também registra o timestamp da requisição atual quando permitido.
    """
    now = time.time()
    timestamps = _prune_old_timestamps(_rate_limit_store.get(ip, []), now)

    per_day_count = len(timestamps)
    per_minute_count = sum(1 for ts in timestamps if ts >= now - RATE_LIMIT_WINDOW_MINUTE)

    if per_minute_count >= RATE_LIMIT_PER_MINUTE:
        _rate_limit_store[ip] = timestamps
        return "Muitas perguntas em pouco tempo — aguarde um minuto antes de tentar de novo."

    if per_day_count >= RATE_LIMIT_PER_DAY:
        _rate_limit_store[ip] = timestamps
        return "Limite diário de perguntas atingido — volte amanhã."

    timestamps.append(now)
    _rate_limit_store[ip] = timestamps
    return None


def _build_system_prompt(context_json: dict) -> str:
    context_str = json.dumps(context_json, ensure_ascii=False, indent=2)
    current_year = datetime.now().year
    return (
        "You are a Q&A assistant about Rodolfo Romão's professional background, skills, and "
        "projects. Answer ONLY based on the JSON context below. Never invent information that "
        "isn't in it.\n\n"
        "Always reply in the same language the user asked the question in (the context JSON has "
        "pt-br/en/es/fr blocks — use whichever matches the question's language, or English if "
        f"unsure).\n\n"
        f"The current year is {current_year}. The `codingSinceYear` field tells you when Rodolfo "
        "started programming — compute years of experience precisely from that if asked, don't "
        "guess or round loosely.\n\n"
        "If the user asks something unrelated to Rodolfo's professional background, or asks you "
        "to execute code, access systems, files, databases, or do anything beyond answering from "
        "this context, politely decline and explain you can only discuss Rodolfo's professional "
        "background.\n\n"
        f"Context (JSON):\n{context_str}"
    )


async def _call_openai(api_key: str, system_prompt: str, message: str) -> str:
    """Chama a Chat Completions API da OpenAI. Sem tools/function-calling — só texto."""
    model = os.environ.get("OPENAI_MODEL", OPENAI_DEFAULT_MODEL).strip() or OPENAI_DEFAULT_MODEL
    base_url = (os.environ.get("OPENAI_BASE_URL", OPENAI_DEFAULT_BASE_URL).strip() or OPENAI_DEFAULT_BASE_URL).rstrip("/")

    timeout = aiohttp.ClientTimeout(total=20)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": AI_MAX_TOKENS,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message},
                ],
            },
        ) as resp:
            body = await resp.json()
            if resp.status != 200:
                raise RuntimeError(f"OpenAI API status {resp.status}: {body}")
            reply_text = body["choices"][0]["message"]["content"].strip()
            if not reply_text:
                raise ValueError("resposta vazia do modelo")
            return reply_text


async def _call_anthropic(api_key: str, system_prompt: str, message: str) -> str:
    """Chama a Messages API da Anthropic. Sem tools/tool_choice — só texto."""
    client = AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=AI_MAX_TOKENS,
        system=system_prompt,
        messages=[{"role": "user", "content": message}],
    )
    reply_text = "".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    ).strip()
    if not reply_text:
        raise ValueError("resposta vazia do modelo")
    return reply_text


async def ai_chat(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Corpo da requisição inválido."}, status=400)

    message = body.get("message") if isinstance(body, dict) else None
    if not isinstance(message, str) or not message.strip() or len(message) > MAX_MESSAGE_LENGTH:
        return web.json_response(
            {"error": "Campo 'message' é obrigatório, não pode ser vazio e deve ter até 500 caracteres."},
            status=400,
        )

    ip = request.remote or "unknown"
    rate_limit_error = _check_rate_limit(ip)
    if rate_limit_error is not None:
        return web.json_response({"error": rate_limit_error}, status=429)

    # OpenAI tem prioridade se configurada; senão cai pro Anthropic; senão, indisponível.
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    anthropic_key = os.environ.get("PORTFOLIO_AI_API_KEY", "").strip()

    if not openai_key and (not anthropic_key or AsyncAnthropic is None):
        return web.json_response({"error": AI_UNAVAILABLE_MSG}, status=503)

    try:
        with PORTFOLIO_CONTEXT_PATH.open("r", encoding="utf-8") as f:
            context_json = json.load(f)
    except Exception as exc:
        log.error("Falha ao ler portfolio_context.json: %s", exc)
        return web.json_response({"error": AI_UNAVAILABLE_MSG}, status=503)

    system_prompt = _build_system_prompt(context_json)

    try:
        if openai_key:
            reply_text = await _call_openai(openai_key, system_prompt, message)
        else:
            reply_text = await _call_anthropic(anthropic_key, system_prompt, message)
    except Exception as exc:  # noqa: BLE001 — nunca deixar a exceção derrubar o processo
        log.warning("Falha ao chamar API de IA: %s", exc)
        return web.json_response({"error": AI_UNAVAILABLE_MSG}, status=503)

    return web.json_response({"reply": reply_text})


# ---------------------------------------------------------------------------

async def health(_request: web.Request) -> web.Response:
    return web.json_response({"status": "ok", "service": "portfolio_api_server"})


# ---------------------------------------------------------------------------
# /api/portfolio/dev-metrics
# ---------------------------------------------------------------------------
# Telemetria segura e exclusiva deste processo isolado — nunca expõe nada do
# Dealer/vault/manager_dealer. Contrato de resposta fixo (sem parâmetros):
#   { uptime_seconds: int, request_count: int,
#     github_public_repos: int|null, github_followers: int|null }

_REQUEST_COUNT = 0


@web.middleware
async def request_counter_middleware(request: web.Request, handler):
    global _REQUEST_COUNT
    _REQUEST_COUNT += 1
    return await handler(request)


async def dev_metrics(_request: web.Request) -> web.Response:
    try:
        gh = await _fetch_github_stats()
        github_public_repos = gh.get("public_repos")
        github_followers = gh.get("followers")
    except Exception as exc:  # noqa: BLE001 — este endpoint nunca pode retornar 500
        log.warning("Falha ao obter GitHub stats em dev-metrics: %s", exc)
        github_public_repos = None
        github_followers = None

    payload = {
        "uptime_seconds": int(time.time() - PROCESS_START_TIME),
        "request_count": _REQUEST_COUNT,
        "github_public_repos": github_public_repos,
        "github_followers": github_followers,
    }
    return web.json_response(payload)


def build_app() -> web.Application:
    app = web.Application(middlewares=[request_counter_middleware])
    app.router.add_get("/health", health)
    app.router.add_get("/api/portfolio/stats", portfolio_stats)
    app.router.add_post("/api/portfolio/ai-chat", ai_chat)
    app.router.add_get("/api/portfolio/dev-metrics", dev_metrics)
    return app


if __name__ == "__main__":
    log.info("portfolio_api_server em %s:%s (isolado do vault/manager_dealer)", HTTP_HOST, HTTP_PORT)
    web.run_app(build_app(), host=HTTP_HOST, port=HTTP_PORT)
