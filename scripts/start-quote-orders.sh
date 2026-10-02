#!/usr/bin/env bash
# Cotações da mesa (quote_orders_server.py + quote_orders.db)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

PORT="${QUOTE_ORDERS_HTTP_PORT:-8771}"
HOST="${QUOTE_ORDERS_HTTP_HOST:-127.0.0.1}"

if ss -tln 2>/dev/null | grep -q ":${PORT} "; then
  echo "[quote-orders] porta ${HOST}:${PORT} já em uso — banco local segue em ${QUOTE_ORDERS_DB_PATH:-$ROOT/quote_orders.db}"
  exit 0
fi

echo "[quote-orders] quote_orders_server.py em ${HOST}:${PORT}"
exec python3 "$ROOT/quote_orders_server.py"
