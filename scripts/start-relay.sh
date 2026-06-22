#!/usr/bin/env bash
# LOCAL DEV ONLY — não é usado em produção (systemd portfolio-relay na VPS).
# Inicia ws_relay_server.py (neste repo) com o token do .env.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RELAY_PY="$ROOT/ws_relay_server.py"

if [[ ! -f "$RELAY_PY" ]]; then
  echo "[relay] ws_relay_server.py não encontrado em: $RELAY_PY" >&2
  exit 1
fi

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

export WS_BRIDGE_TOKEN="${WS_BRIDGE_TOKEN:-${REACT_APP_DEALER_WS_TOKEN:-}}"
if [[ -z "$WS_BRIDGE_TOKEN" ]]; then
  echo "[relay] WS_BRIDGE_TOKEN / REACT_APP_DEALER_WS_TOKEN não definido no .env" >&2
  exit 1
fi

export WS_RELAY_PORT="${WS_RELAY_PORT:-8765}"
export WS_RELAY_HOST="${WS_RELAY_HOST:-0.0.0.0}"

if ss -tln 2>/dev/null | grep -q ":${WS_RELAY_PORT} "; then
  echo "[relay] porta ${WS_RELAY_HOST}:${WS_RELAY_PORT} já em uso — relay provavelmente ativo (ok)"
  exit 0
fi

bash "$ROOT/scripts/ensure-venv.sh"
PY="$ROOT/venv/bin/python"

echo "[relay] $RELAY_PY em ${WS_RELAY_HOST}:${WS_RELAY_PORT}"
exec "$PY" "$RELAY_PY"
