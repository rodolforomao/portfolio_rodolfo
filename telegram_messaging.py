#!/usr/bin/env python3
"""telegram_messaging.py — helper único de mensageria Telegram do hub /dealer.

Usado pelos backends Python deste repo (liquid_pots_server.py e futuros
tools do hub) para não duplicar: resolução de credenciais, chamada HTTP à
API do Telegram, broadcast pra múltiplos chats e quebra de mensagem longa.

Uso típico num tool novo:

    from telegram_messaging import resolve_credentials, TelegramMessenger

    def resolve_telegram():
        return resolve_credentials(
            load_store().get("telegram"),          # config salva em Settings
            shared_config_paths=[ROOT / "telegram_config.json"],  # opcional:
            # permite usar o MESMO bot do manager_dealer sem duplicar token
        )

    creds = resolve_telegram()
    if creds["configured"]:
        TelegramMessenger(creds["bot_token"], creds["chat_ids"], source="meu-tool").send(texto)
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

TELEGRAM_MAX_LEN = 4096
_SPLIT_MARGIN = 96  # folga para a quebra não estourar o limite real


class TelegramError(RuntimeError):
    """Erro ao configurar ou enviar mensagem via Telegram."""


def parse_chat_ids(raw) -> list:
    """Aceita chat_id único, lista, ou string separada por vírgula/ponto-e-vírgula."""
    if raw is None:
        return []
    if isinstance(raw, (list, tuple)):
        return [str(c).strip() for c in raw if str(c).strip()]
    text = str(raw).replace(";", ",")
    return [c.strip() for c in text.split(",") if c.strip()]


def split_message(text: str, max_len: int = TELEGRAM_MAX_LEN - _SPLIT_MARGIN) -> list:
    """Quebra `text` em pedaços <= max_len, preservando linhas inteiras quando possível."""
    if len(text) <= max_len:
        return [text]
    parts: list = []
    buf = ""
    for line in text.split("\n"):
        candidate = f"{buf}\n{line}" if buf else line
        if len(candidate) > max_len and buf:
            parts.append(buf)
            buf = line
        else:
            buf = candidate
    if buf:
        parts.append(buf)
    return parts or [text[:max_len]]


def resolve_credentials(
    local_config: dict | None,
    *,
    env_token_var: str = "TELEGRAM_BOT_TOKEN",
    env_chat_var: str = "TELEGRAM_CHAT_ID",
    shared_config_paths=(),
    shared_config_path_env: str = "TELEGRAM_CONFIG_PATH",
    log_prefix: str = "telegram_messaging",
) -> dict:
    """Resolve bot_token + chat_ids em cascata, sem exigir .env:

      1. `local_config` — dict {"bot_token", "chat_id"} salvo via Settings de cada tool
      2. variáveis de ambiente (`env_token_var` / `env_chat_var`)
      3. `telegram_config.json` compartilhado (formato do manager_dealer:
         {"bots": {"<id>": {"token", "chat_ids"}}, "global_bot": "<id>"}) —
         permite reusar o MESMO bot do Dealer sem duplicar credenciais.
    """
    token = ""
    chats: list = []
    source = "none"

    local_config = local_config or {}
    token = (local_config.get("bot_token") or "").strip()
    chats = parse_chat_ids(local_config.get("chat_id") or local_config.get("chat_ids"))
    if token and chats:
        source = "settings"

    if not token or not chats:
        env_token = (os.environ.get(env_token_var) or "").strip()
        env_chats = parse_chat_ids(os.environ.get(env_chat_var) or "")
        if env_token and env_chats:
            token, chats, source = env_token, env_chats, "env"

    if not token or not chats:
        cfg_path = (os.environ.get(shared_config_path_env) or "").strip()
        candidates = [Path(cfg_path)] if cfg_path else []
        candidates.extend(Path(p) for p in shared_config_paths)
        for path in candidates:
            if not path.is_file():
                continue
            try:
                cfg = json.loads(path.read_text(encoding="utf-8"))
                bots = cfg.get("bots") or {}
                global_bot = cfg.get("global_bot") or "main"
                bot = bots.get(global_bot) or (next(iter(bots.values())) if bots else None)
                if not bot:
                    continue
                cfg_token = (bot.get("token") or "").strip()
                cfg_chats = parse_chat_ids(bot.get("chat_ids"))
                if cfg_token and cfg_chats:
                    token, chats, source = cfg_token, cfg_chats, f"shared_config:{path.name}"
                    break
            except Exception as exc:
                print(f"[{log_prefix}] {path}: {exc}", file=sys.stderr)

    masked = ""
    if token:
        masked = (token[:6] + "…" + token[-4:]) if len(token) > 12 else "***"

    return {
        "bot_token": token,
        "chat_ids": chats,
        "source": source,
        "configured": bool(token and chats),
        "bot_token_masked": masked,
    }


class TelegramMessenger:
    def __init__(
        self,
        bot_token: str,
        chat_ids,
        *,
        source: str = "app",
        timeout: float = 15.0,
    ):
        self.bot_token = (bot_token or "").strip()
        self.chat_ids = parse_chat_ids(chat_ids)
        self.source = source
        self.timeout = timeout

    @property
    def configured(self) -> bool:
        return bool(self.bot_token and self.chat_ids)

    def send(self, text: str) -> int:
        """Envia `text` (quebrado se > 4096 chars) para todos os chat_ids.

        Retorna quantos chats receberam com sucesso. Levanta TelegramError
        só se TODOS falharem — um chat_id inválido não deve calar os outros.
        """
        if not self.configured:
            raise TelegramError("Telegram não configurado (bot_token/chat_ids ausente)")
        chunks = split_message(text)
        sent = 0
        errors = []
        for chat_id in self.chat_ids:
            try:
                for chunk in chunks:
                    self._post(chat_id, chunk)
                sent += 1
            except TelegramError as exc:
                errors.append(f"{chat_id}: {exc}")
        if errors and sent == 0:
            raise TelegramError("; ".join(errors))
        return sent

    def send_test(self, label: str = "") -> int:
        suffix = f" ({label})" if label else ""
        return self.send(f"✅ Telegram OK{suffix} — mensagens de teste funcionando.")

    def _post(self, chat_id: str, text: str) -> None:
        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        body = urllib.parse.urlencode(
            {"chat_id": chat_id, "text": text, "disable_web_page_preview": "true"}
        ).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": f"{self.source}/1.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "ignore")
            raise TelegramError(f"HTTP {exc.code}: {detail[:200]}") from exc
        except urllib.error.URLError as exc:
            raise TelegramError(f"Falha de rede: {exc.reason}") from exc
        if not payload.get("ok"):
            raise TelegramError(payload.get("description") or "Telegram retornou erro")
