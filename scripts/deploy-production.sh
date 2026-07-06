#!/usr/bin/env bash
# Deploy COMPLETO para rodolforomao.com.br (HestiaCP):
#   1. React build → public_html            (deploy-ssh.sh)
#   2. vault_server + ws_relay + nginx      (deploy-vault-services.sh)
#   3. portfolio_api_server.py + nginx      (deploy-portfolio-api.sh)
#
# Uso: bash scripts/deploy-production.sh
#
# Variáveis no .env (ver .env.example):
#   DEPLOY_SSH_* , DEPLOY_REMOTE_PATH , DEPLOY_VAULT_PATH , DEPLOY_PORTFOLIO_PATH ,
#   DEPLOY_NGINX_CONF_DIR , REACT_APP_DEALER_* , VAULT_ADMIN_TOKEN
#   DEPLOY_WITH_VAULT=0          — pula vault/relay (só frontend)
#   DEPLOY_WITH_PORTFOLIO_API=0  — pula portfolio-api
#   VAULT_SYNC_DB=1              — sobrescreve vault_data.db local na VPS (cuidado)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

cd "$PROJECT_ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Erro: .env não encontrado. Copie .env.example → .env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

PUBLIC_HOST="${DEPLOY_PUBLIC_HOST:-rodolforomao.com.br}"

echo "========================================"
echo " Deploy produção — $PUBLIC_HOST"
echo "========================================"
echo

echo "▶ [1/3] Frontend React → $DEPLOY_REMOTE_PATH"
bash "$SCRIPT_DIR/deploy-ssh.sh"
echo

if [[ "${DEPLOY_WITH_VAULT:-1}" == "1" ]]; then
  echo "▶ [2/3] Vault + relay + nginx"
  bash "$SCRIPT_DIR/deploy-vault-services.sh"
else
  echo "▸ Vault/relay ignorados (DEPLOY_WITH_VAULT=0)"
  echo "  Rode: bash scripts/deploy-vault-services.sh"
  bash "$SCRIPT_DIR/verify-vault-prod.sh" "https://${PUBLIC_HOST}" || true
fi
echo

if [[ "${DEPLOY_WITH_PORTFOLIO_API:-1}" == "1" ]]; then
  echo "▶ [3/3] Portfolio API + nginx"
  bash "$SCRIPT_DIR/deploy-portfolio-api.sh"
else
  echo "▸ Portfolio API ignorado (DEPLOY_WITH_PORTFOLIO_API=0)"
  echo "  Rode: bash scripts/deploy-portfolio-api.sh"
  bash "$SCRIPT_DIR/verify-portfolio-prod.sh" "https://${PUBLIC_HOST}" || true
fi

echo
echo "Deploy completo."
