#!/usr/bin/env bash
# LOCAL DEV ONLY — não é usado em produção.
# Dev local: React + relay (+ vault opcional com WITH_VAULT=1).
#
# Uso:
#   ./scripts/start-dev.sh
#   npm run start:dev          # react + relay
#   npm run dev                # react + vault + relay
#
# O manager_dealer (agente) roda à parte.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

if [[ ! -f "$ROOT/ws_relay_server.py" ]]; then
  echo "Erro: ws_relay_server.py não encontrado em $ROOT" >&2
  exit 1
fi

if [[ -z "${REACT_APP_DEALER_WS_TOKEN:-}" ]] && [[ -z "${WS_BRIDGE_TOKEN:-}" ]]; then
  echo "Erro: REACT_APP_DEALER_WS_TOKEN (ou WS_BRIDGE_TOKEN) não definido no .env" >&2
  exit 1
fi

if [[ ! -d "$ROOT/node_modules/concurrently" ]]; then
  echo "Instalando dependências npm…"
  npm install
fi

bash "$ROOT/scripts/ensure-venv.sh"

echo "========================================"
echo " Dev — React :3000 + relay :${WS_RELAY_PORT:-8765}"
echo " Abra: http://localhost:3000/dealer"
echo " Após login: Menu → Dealer | Analyses | Liquid TX"
echo " Tools: public/tools/* (npm run sync:tools)"
echo "========================================"
echo

exec npx concurrently \
  --kill-others-on-fail \
  --names "react,relay" \
  --prefix-colors "cyan,yellow" \
  "npm run start" \
  "bash scripts/start-relay.sh"
