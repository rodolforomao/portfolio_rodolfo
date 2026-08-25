#!/usr/bin/env bash
# Potes Liquid TX + alertas Telegram (liquid_pots_server.py)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

PORT="${LIQUID_POTS_HTTP_PORT:-8770}"
HOST="${LIQUID_POTS_HTTP_HOST:-127.0.0.1}"

if ss -tln 2>/dev/null | grep -q ":${PORT} "; then
  echo "[liquid-pots] porta ${HOST}:${PORT} já em uso — ok"
  exit 0
fi

echo "[liquid-pots] liquid_pots_server.py em ${HOST}:${PORT}"
exec python3 "$ROOT/liquid_pots_server.py"
