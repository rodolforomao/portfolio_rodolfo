#!/usr/bin/env bash
# LOCAL DEV ONLY — inicia portfolio_api_server.py (backend isolado da seção /system).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

PORT="${PORTFOLIO_HTTP_PORT:-8767}"
HOST="${PORTFOLIO_HTTP_HOST:-127.0.0.1}"

if ss -tln 2>/dev/null | grep -q ":${PORT} "; then
  echo "[portfolio-api] porta ${HOST}:${PORT} já em uso — provavelmente já ativo (ok)"
  exit 0
fi

bash "$ROOT/scripts/ensure-venv.sh"
"$ROOT/venv/bin/pip" install -q -r "$ROOT/requirements-portfolio.txt"
echo "[portfolio-api] portfolio_api_server.py em ${HOST}:${PORT}"
exec "$ROOT/venv/bin/python" "$ROOT/portfolio_api_server.py"
