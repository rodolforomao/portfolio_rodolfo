#!/usr/bin/env bash
# Deploy vault_server + ws_relay_server na VPS (HestiaCP / nginx).
# Usa DEPLOY_* do .env (mesmo de scripts/deploy-ssh.sh).
#
# Uso: bash scripts/deploy-vault-services.sh

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
VAULT_DIR="${DEPLOY_VAULT_PATH:-/home/admin/web/rodolforomao.com.br/vault-services}"
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

echo "Deploy vault → $SSH_TARGET:$VAULT_DIR"

"${SSH_BASE[@]}" "$SSH_TARGET" "mkdir -p '$VAULT_DIR'"

RSYNC_FILES=(
  vault_server.py
  ws_relay_server.py
  requirements-vault.txt
  scripts/hestia-nginx-vault.conf
  scripts/nginx-ws-upgrade-map.conf
  scripts/hestia-fix-ws-upgrade-header.sh
  scripts/systemd/portfolio-vault.service
  scripts/systemd/portfolio-relay.service
  scripts/nginx-watchdog.sh
  scripts/systemd/nginx-watchdog.service
  scripts/systemd/nginx-watchdog.timer
)
[[ "${VAULT_SYNC_DB:-}" == "1" && -f vault_data.db ]] && RSYNC_FILES+=(vault_data.db)

rsync -avz -e "$RSYNC_SSH" "${RSYNC_FILES[@]}" "$SSH_TARGET:$VAULT_DIR/"

"${SSH_BASE[@]}" "$SSH_TARGET" bash -s <<REMOTE
set -euo pipefail
VAULT_DIR='$VAULT_DIR'
NGINX_CONF_DIR='$NGINX_CONF_DIR'

cat > "\$VAULT_DIR/.env.vault" <<EOF
VAULT_ADMIN_TOKEN=${VAULT_ADMIN_TOKEN}
WS_BRIDGE_TOKEN=${REACT_APP_DEALER_WS_TOKEN}
VAULT_HTTP_HOST=127.0.0.1
VAULT_HTTP_PORT=8766
VAULT_DB_PATH=\$VAULT_DIR/vault_data.db
WS_RELAY_HOST=127.0.0.1
WS_RELAY_PORT=8765
EOF
chmod 600 "\$VAULT_DIR/.env.vault"
chown -R admin:admin "\$VAULT_DIR"

apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip >/dev/null 2>&1 || true
if [[ ! -x "\$VAULT_DIR/venv/bin/python" ]]; then
  python3 -m venv "\$VAULT_DIR/venv"
fi
"\$VAULT_DIR/venv/bin/pip" install -q -r "\$VAULT_DIR/requirements-vault.txt"

install -m 644 "\$VAULT_DIR/portfolio-vault.service" /etc/systemd/system/
install -m 644 "\$VAULT_DIR/portfolio-relay.service" /etc/systemd/system/
chmod 755 "\$VAULT_DIR/nginx-watchdog.sh"
install -m 644 "\$VAULT_DIR/nginx-watchdog.service" /etc/systemd/system/
install -m 644 "\$VAULT_DIR/nginx-watchdog.timer" /etc/systemd/system/

cp "\$VAULT_DIR/hestia-nginx-vault.conf" "\$NGINX_CONF_DIR/nginx.ssl.conf_vault"
cp "\$VAULT_DIR/hestia-nginx-vault.conf" "\$NGINX_CONF_DIR/nginx.conf_vault"
install -m 644 "\$VAULT_DIR/nginx-ws-upgrade-map.conf" /etc/nginx/conf.d/ws-upgrade-map.conf

# HestiaCP: proxy_hide_header Upgrade no template quebra WSS
if [[ -f "\$VAULT_DIR/hestia-fix-ws-upgrade-header.sh" ]]; then
  bash "\$VAULT_DIR/hestia-fix-ws-upgrade-header.sh" '${PUBLIC_HOST}'
fi

systemctl daemon-reload
systemctl enable portfolio-vault.service portfolio-relay.service
systemctl restart portfolio-vault.service portfolio-relay.service
systemctl enable --now nginx-watchdog.timer

nginx -t
# systemctl reload "sucesso" não significa que o nginx aceitou a config nova —
# se um bind() falhar (porta já em uso por outro processo, ex: Apache), o
# nginx mantém os workers antigos rodando e só loga [emerg], sem erro visível
# pro systemd. Confirmamos comparando PIDs de worker antes/depois: se nenhum
# PID novo aparecer, o reload falhou silenciosamente.
BEFORE_WORKERS=\$(pgrep -f 'nginx: worker process' | sort)
systemctl reload nginx
sleep 2
AFTER_WORKERS=\$(pgrep -f 'nginx: worker process' | sort)
NEW_WORKERS=\$(comm -13 <(echo "\$BEFORE_WORKERS") <(echo "\$AFTER_WORKERS"))
if [[ -z "\$NEW_WORKERS" ]]; then
  echo "ERRO: nginx reload não trocou os workers — provável falha silenciosa (ex: bind() conflict)." >&2
  echo "Últimas linhas de /var/log/nginx/error.log:" >&2
  tail -20 /var/log/nginx/error.log >&2
  exit 1
fi
echo "nginx reload confirmado — novos workers: \$NEW_WORKERS"
REMOTE

unset SSHPASS 2>/dev/null || true

echo
bash "$SCRIPT_DIR/verify-vault-prod.sh" "https://${PUBLIC_HOST}"
