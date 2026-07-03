#!/usr/bin/env bash
# Deploy SOMENTE do frontend React (npm run build → rsync public_html).
#
# NÃO inclui: vault_server.py, ws_relay_server.py, systemd, nginx vault proxy.
# Para deploy completo use: bash scripts/deploy-production.sh
#
# Requer: .env com DEPLOY_SSH_HOST, DEPLOY_SSH_USER, DEPLOY_REMOTE_PATH.
# Opcional: DEPLOY_SSH_PORT, DEPLOY_SSH_KEY, DEPLOY_SSH_PASSWORD (sshpass).
# Build usa REACT_APP_* do .env (Dealer Console login, WS token, etc.).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

cd "$PROJECT_ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Erro: arquivo .env não encontrado."
  echo "Copie .env.example para .env e preencha os valores:"
  echo "  cp .env.example .env"
  exit 1
fi

# Carrega variáveis do .env
set -a
source "$ENV_FILE"
set +a

for var in DEPLOY_SSH_HOST DEPLOY_SSH_USER DEPLOY_REMOTE_PATH; do
  if [[ -z "${!var}" ]]; then
    echo "Erro: $var não está definido no .env"
    exit 1
  fi
done

PORT="${DEPLOY_SSH_PORT:-22}"
SSH_OPTS=(-o "StrictHostKeyChecking=accept-new" -o "ConnectTimeout=10")
if [[ -n "${DEPLOY_SSH_KEY}" ]]; then
  SSH_OPTS+=(-i "$DEPLOY_SSH_KEY")
fi

# Comando SSH que o rsync usará
SSH_CMD="ssh -p $PORT ${SSH_OPTS[*]}"
if [[ -n "${DEPLOY_SSH_PASSWORD}" ]]; then
  if ! command -v sshpass &>/dev/null; then
    echo "Erro: DEPLOY_SSH_PASSWORD está definido mas sshpass não está instalado."
    echo "Instale com: sudo apt install sshpass   (ou equivalente no seu sistema)"
    exit 1
  fi
  # sshpass -e usa a variável SSHPASS (evita senha na linha de comando)
  export SSHPASS="$DEPLOY_SSH_PASSWORD"
  SSH_CMD="sshpass -e ssh -p $PORT ${SSH_OPTS[*]}"
fi

export REACT_APP_VERSION="$(git tag | tail -1)"
echo "Buildando o projeto... (versão: ${REACT_APP_VERSION:-sem tag})"
npm run build

if [[ ! -d "build" ]]; then
  echo "Erro: pasta build/ não foi gerada."
  exit 1
fi

echo "Enviando para $DEPLOY_SSH_USER@$DEPLOY_SSH_HOST:$DEPLOY_REMOTE_PATH (porta $PORT)..."
rsync -avz --delete \
  -e "$SSH_CMD" \
  build/ \
  "$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST:$DEPLOY_REMOTE_PATH/"

# Limpa SSHPASS do ambiente após o rsync
unset SSHPASS 2>/dev/null || true

echo "Frontend deploy concluído."
echo "  Vault/relay: bash scripts/deploy-vault-services.sh"
echo "  Tudo junto:  bash scripts/deploy-production.sh"
