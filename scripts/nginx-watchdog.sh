#!/usr/bin/env bash
# nginx-watchdog.sh — detecta reload/bind do nginx quebrado silenciosamente.
#
# Contexto: em 2026-08 o nginx desse servidor ficou dias recusando reload
# (bind() em porta já usada pelo Apache) sem NENHUM sinal visível — o
# `systemctl reload nginx` sempre retornava sucesso porque o comando em si
# roda, mesmo quando o nginx internamente rejeita a config nova e mantém os
# workers antigos no ar. Isso mascarou correções reais (ex: header Upgrade
# do WebSocket) por semanas.
#
# Rodado via timer systemd (nginx-watchdog.timer) a cada 5 min. Alerta via
# Telegram se configurado em /root/.nginx-watchdog-telegram.env (variáveis
# TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID); sem esse arquivo, só loga em
# /var/log/nginx-watchdog.log.

set -euo pipefail

STATE_FILE="/var/lib/nginx-watchdog/last_alert"
ALERT_ENV="/root/.nginx-watchdog-telegram.env"
LOG_FILE="/var/log/nginx-watchdog.log"
LOOKBACK_MIN=10
ALERT_COOLDOWN_SEC=1800  # 30 min entre alertas repetidos

mkdir -p "$(dirname "$STATE_FILE")"

problems=()

# 1) A config atual em disco é sintaticamente válida?
if ! test_output=$(nginx -t 2>&1); then
  problems+=("nginx -t falhou: $(echo "$test_output" | tail -3 | tr '\n' ' ')")
fi

# 2) Algum bind()/emerg recente nos logs? (sinal de reload rejeitado)
#
# error_log do nginx não vai pro journalctl (nginx escreve direto no arquivo,
# não em stdout/stderr do serviço) — journalctl -u nginx só teria as linhas
# "Reloading.../Reloaded..." do systemd, nunca o [emerg] real. Por isso lemos
# o arquivo direto, filtrando pela DATA DA LINHA (não mtime do arquivo — o
# arquivo é reescrito/tocado o tempo todo, então -newermt sempre "bate" e
# pega lixo histórico repetido pra sempre).
recent_emerg=""
if [[ -f /var/log/nginx/error.log ]]; then
  cutoff="$(date -d "-${LOOKBACK_MIN} minutes" '+%Y/%m/%d %H:%M:%S')"
  recent_emerg="$(awk -v cutoff="$cutoff" 'substr($0,1,19) >= cutoff' /var/log/nginx/error.log 2>/dev/null | grep -i 'emerg\]' || true)"
fi
if [[ -n "$recent_emerg" ]]; then
  problems+=("[emerg] recente no nginx: $(echo "$recent_emerg" | tail -3 | tr '\n' ' | ')")
fi

if [[ ${#problems[@]} -eq 0 ]]; then
  rm -f "$STATE_FILE"
  exit 0
fi

message="⚠️ nginx-watchdog ($(hostname)): $(printf '%s; ' "${problems[@]}")"
echo "$(date -Iseconds) $message" >> "$LOG_FILE"

now=$(date +%s)
last=0
[[ -f "$STATE_FILE" ]] && last=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
if (( now - last < ALERT_COOLDOWN_SEC )); then
  exit 0
fi
echo "$now" > "$STATE_FILE"

if [[ -f "$ALERT_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$ALERT_ENV"
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    curl -s -m 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d chat_id="${TELEGRAM_CHAT_ID}" \
      --data-urlencode text="$message" >/dev/null || true
  fi
fi
