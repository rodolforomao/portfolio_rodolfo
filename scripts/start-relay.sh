#!/usr/bin/env bash
# Inicia ws_relay_server.py do manager_dealer com o token do .env deste projeto.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MD="${MANAGER_DEALER_DIR:-$ROOT/../../../profissional/liquid_projects/manager_dealer}"

if [[ ! -f "$MD/ws_relay_server.py" ]]; then
  echo "[relay] manager_dealer não encontrado em: $MD" >&2
  echo "        Defina MANAGER_DEALER_DIR=/caminho/para/manager_dealer" >&2
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

PY="$MD/venv/bin/python"
[[ -x "$PY" ]] || PY=python3

echo "[relay] $MD/ws_relay_server.py em ${WS_RELAY_HOST}:${WS_RELAY_PORT}"
exec "$PY" "$MD/ws_relay_server.py"
