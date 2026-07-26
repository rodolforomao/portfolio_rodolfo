#!/usr/bin/env bash
# LOCAL DEV — inicia termux_api_server.py (status Liquid/Termux para /dealer).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

# Defaults apontando pro workspace termux_blockchain (se existir)
if [[ -z "${TERMUX_SSH_PASS_FILE:-}" && -f /home/black/enviroment/tmp/termux_blockchain/.ssh_pass_tmp ]]; then
  export TERMUX_SSH_PASS_FILE=/home/black/enviroment/tmp/termux_blockchain/.ssh_pass_tmp
fi

PORT="${TERMUX_HTTP_PORT:-8768}"
HOST="${TERMUX_HTTP_HOST:-127.0.0.1}"

if ss -tln 2>/dev/null | grep -q ":${PORT} "; then
  echo "[termux-api] porta ${HOST}:${PORT} já em uso — provavelmente já ativo (ok)"
  exit 0
fi

bash "$ROOT/scripts/ensure-venv.sh"
"$ROOT/venv/bin/pip" install -q -r "$ROOT/requirements-termux.txt"
echo "[termux-api] termux_api_server.py em ${HOST}:${PORT}"
exec "$ROOT/venv/bin/python" "$ROOT/termux_api_server.py"
