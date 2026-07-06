#!/usr/bin/env bash
# Deploy portfolio_api_server.py na VPS (HestiaCP / nginx) — seção /system (Web OS).
# Processo e porta isolados do vault_server.py/ws_relay_server.py/manager_dealer.
# Usa DEPLOY_* do .env (mesmo de scripts/deploy-ssh.sh).
#
# Uso: bash scripts/deploy-portfolio-api.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

cd "$PROJECT_ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Erro: .env não encontrado." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

for var in DEPLOY_SSH_HOST DEPLOY_SSH_USER; do
  if [[ -z "${!var:-}" ]]; then
    echo "Erro: $var não definido no .env" >&2
    exit 1
  fi
done

PORT="${DEPLOY_SSH_PORT:-22}"
PORTFOLIO_DIR="${DEPLOY_PORTFOLIO_PATH:-/home/admin/web/rodolforomao.com.br/portfolio-api}"
NGINX_CONF_DIR="${DEPLOY_NGINX_CONF_DIR:-/home/admin/conf/web/rodolforomao.com.br}"
PUBLIC_HOST="${DEPLOY_PUBLIC_HOST:-rodolforomao.com.br}"

SSH_OPTS=(-o "StrictHostKeyChecking=accept-new" -o "ConnectTimeout=15")
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  SSH_OPTS+=(-i "$DEPLOY_SSH_KEY")
fi

SSH_TARGET="$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST"
SSH_BASE=(ssh -p "$PORT" "${SSH_OPTS[@]}")
RSYNC_SSH="ssh -p $PORT ${SSH_OPTS[*]}"

if [[ -n "${DEPLOY_SSH_PASSWORD:-}" ]]; then
  if ! command -v sshpass &>/dev/null; then
    echo "Erro: sshpass necessário para DEPLOY_SSH_PASSWORD." >&2
    exit 1
  fi
  export SSHPASS="$DEPLOY_SSH_PASSWORD"
  SSH_BASE=(sshpass -e ssh -p "$PORT" "${SSH_OPTS[@]}")
  RSYNC_SSH="sshpass -e ssh -p $PORT ${SSH_OPTS[*]}"
fi

echo "Deploy portfolio-api → $SSH_TARGET:$PORTFOLIO_DIR"

"${SSH_BASE[@]}" "$SSH_TARGET" "mkdir -p '$PORTFOLIO_DIR/public'"

RSYNC_FILES=(
  portfolio_api_server.py
  requirements-portfolio.txt
  scripts/hestia-nginx-portfolio.conf
  scripts/systemd/portfolio-api.service
)

rsync -avz -e "$RSYNC_SSH" "${RSYNC_FILES[@]}" "$SSH_TARGET:$PORTFOLIO_DIR/"
rsync -avz -e "$RSYNC_SSH" public/portfolio_context.json "$SSH_TARGET:$PORTFOLIO_DIR/public/"

"${SSH_BASE[@]}" "$SSH_TARGET" bash -s <<REMOTE
set -euo pipefail
PORTFOLIO_DIR='$PORTFOLIO_DIR'
NGINX_CONF_DIR='$NGINX_CONF_DIR'

cat > "\$PORTFOLIO_DIR/.env.portfolio" <<EOF
PORTFOLIO_HTTP_HOST=127.0.0.1
PORTFOLIO_HTTP_PORT=8767
PORTFOLIO_AI_API_KEY=${PORTFOLIO_AI_API_KEY:-}
OPENAI_API_KEY=${OPENAI_API_KEY:-}
OPENAI_MODEL=${OPENAI_MODEL:-gpt-4o-mini}
OPENAI_BASE_URL=${OPENAI_BASE_URL:-https://api.openai.com/v1}
EOF
chmod 600 "\$PORTFOLIO_DIR/.env.portfolio"
chown -R admin:admin "\$PORTFOLIO_DIR"

apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip >/dev/null 2>&1 || true
if [[ ! -x "\$PORTFOLIO_DIR/venv/bin/python" ]]; then
  python3 -m venv "\$PORTFOLIO_DIR/venv"
fi
"\$PORTFOLIO_DIR/venv/bin/pip" install -q -r "\$PORTFOLIO_DIR/requirements-portfolio.txt"

install -m 644 "\$PORTFOLIO_DIR/portfolio-api.service" /etc/systemd/system/

cp "\$PORTFOLIO_DIR/hestia-nginx-portfolio.conf" "\$NGINX_CONF_DIR/nginx.ssl.conf_portfolio"
cp "\$PORTFOLIO_DIR/hestia-nginx-portfolio.conf" "\$NGINX_CONF_DIR/nginx.conf_portfolio"

systemctl daemon-reload
systemctl enable portfolio-api.service
systemctl restart portfolio-api.service
nginx -t && systemctl reload nginx
REMOTE

unset SSHPASS 2>/dev/null || true

echo
bash "$SCRIPT_DIR/verify-portfolio-prod.sh" "https://${PUBLIC_HOST}"
