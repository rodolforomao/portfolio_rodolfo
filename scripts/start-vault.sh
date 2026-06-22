#!/usr/bin/env bash
# LOCAL DEV ONLY — não é usado em produção (systemd portfolio-vault na VPS).
# Inicia vault_server.py (ou ignora se a porta já estiver em uso).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

PORT="${VAULT_HTTP_PORT:-8766}"
HOST="${VAULT_HTTP_HOST:-127.0.0.1}"

if ss -tln 2>/dev/null | grep -q ":${PORT} "; then
  echo "[vault] porta ${HOST}:${PORT} já em uso — vault provavelmente ativo (ok)"
  exit 0
fi

bash "$ROOT/scripts/ensure-venv.sh"
echo "[vault] vault_server.py em ${HOST}:${PORT}"
exec "$ROOT/venv/bin/python" "$ROOT/vault_server.py"
