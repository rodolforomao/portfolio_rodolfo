#!/usr/bin/env bash
# Deploy liquid_pots_server.py na VPS (HestiaCP / nginx).
# Usa o mesmo TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID do Dealer (mensageria única).
#
# Uso: bash scripts/deploy-liquid-pots.sh

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
POTS_DIR="${DEPLOY_LIQUID_POTS_PATH:-/home/admin/web/rodolforomao.com.br/liquid-pots}"
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

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "INFO: TELEGRAM_* não está no .env — OK."
  echo "  Configure Telegram em Liquid TX → Settings após o deploy."
  echo
fi

echo "Deploy liquid-pots → $SSH_TARGET:$POTS_DIR"

"${SSH_BASE[@]}" "$SSH_TARGET" "mkdir -p '$POTS_DIR'"

# .env remoto (credenciais Telegram = mesmas do Dealer)
ENV_TMP="$(mktemp)"
cat > "$ENV_TMP" <<EOF
LIQUID_POTS_HTTP_HOST=127.0.0.1
LIQUID_POTS_HTTP_PORT=8770
LIQUID_POTS_DATA_PATH=${POTS_DIR}/liquid_pots_data.json
LIQUID_POTS_POLL_SECONDS=30
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID:-}
TELEGRAM_CONFIG_PATH=${TELEGRAM_CONFIG_PATH:-}
EOF
chmod 600 "$ENV_TMP"

rsync -avz -e "$RSYNC_SSH" \
  "$PROJECT_ROOT/liquid_pots_server.py" \
  "$PROJECT_ROOT/telegram_messaging.py" \
  "$PROJECT_ROOT/scripts/hestia-nginx-liquid-pots.conf" \
  "$PROJECT_ROOT/scripts/systemd/liquid-pots.service" \
  "$ENV_TMP" \
  "$SSH_TARGET:$POTS_DIR/"

# Rename env temp basename on remote
ENV_BASENAME="$(basename "$ENV_TMP")"
rm -f "$ENV_TMP"

"${SSH_BASE[@]}" "$SSH_TARGET" bash -s <<REMOTE
set -euo pipefail
POTS_DIR='$POTS_DIR'
NGINX_CONF_DIR='$NGINX_CONF_DIR'
ENV_BASENAME='$ENV_BASENAME'

if [[ -f "\$POTS_DIR/\$ENV_BASENAME" ]]; then
  mv -f "\$POTS_DIR/\$ENV_BASENAME" "\$POTS_DIR/.env.liquid-pots"
fi
chmod 600 "\$POTS_DIR/.env.liquid-pots"
chown -R admin:admin "\$POTS_DIR"

apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip >/dev/null 2>&1 || true
if [[ ! -x "\$POTS_DIR/venv/bin/python" ]]; then
  python3 -m venv "\$POTS_DIR/venv"
fi
"\$POTS_DIR/venv/bin/pip" install -q python-dotenv websocket-client >/dev/null 2>&1 || true

install -m 644 "\$POTS_DIR/liquid-pots.service" /etc/systemd/system/liquid-pots.service

cp "\$POTS_DIR/hestia-nginx-liquid-pots.conf" "\$NGINX_CONF_DIR/nginx.ssl.conf_liquid_pots"
cp "\$POTS_DIR/hestia-nginx-liquid-pots.conf" "\$NGINX_CONF_DIR/nginx.conf_liquid_pots"

systemctl daemon-reload
systemctl enable liquid-pots.service
systemctl stop liquid-pots.service 2>/dev/null || true

# Libera a porta caso um processo órfão (fora do systemd, ex.: start-liquid-pots.sh
# rodado manualmente em algum momento) ainda esteja com ela presa — systemctl stop
# só encerra o processo que o próprio systemd está rastreando.
POTS_PORT="\$(grep -oP '^LIQUID_POTS_HTTP_PORT=\K.*' "\$POTS_DIR/.env.liquid-pots" 2>/dev/null || echo 8770)"
if command -v fuser >/dev/null 2>&1; then
  fuser -k "\${POTS_PORT}/tcp" >/dev/null 2>&1 || true
else
  STRAY_PIDS="\$(ss -tlnp 2>/dev/null | awk -v p=":\${POTS_PORT} " '\$4 ~ p' | grep -oP 'pid=\K[0-9]+' | sort -u)"
  [[ -n "\$STRAY_PIDS" ]] && kill \$STRAY_PIDS >/dev/null 2>&1 || true
fi
sleep 1

systemctl start liquid-pots.service

sleep 1
if curl -fsS -m 5 http://127.0.0.1:8770/api/liquid-pots/health >/dev/null; then
  echo "liquid-pots local OK (:8770)"
  curl -fsS -m 5 http://127.0.0.1:8770/api/liquid-pots/health
  echo
else
  echo "ERRO: liquid-pots não respondeu em 127.0.0.1:8770" >&2
  systemctl --no-pager -l status liquid-pots.service || true
  journalctl -u liquid-pots.service -n 40 --no-pager || true
  exit 1
fi

nginx -t
BEFORE_WORKERS=\$(pgrep -f 'nginx: worker process' | sort)
systemctl reload nginx
sleep 2
AFTER_WORKERS=\$(pgrep -f 'nginx: worker process' | sort)
NEW_WORKERS=\$(comm -13 <(echo "\$BEFORE_WORKERS") <(echo "\$AFTER_WORKERS"))
if [[ -z "\$NEW_WORKERS" ]]; then
  echo "ERRO: nginx reload não trocou os workers." >&2
  tail -20 /var/log/nginx/error.log >&2 || true
  exit 1
fi
echo "nginx reload confirmado — novos workers: \$NEW_WORKERS"
REMOTE

unset SSHPASS 2>/dev/null || true

echo
bash "$SCRIPT_DIR/verify-liquid-pots-prod.sh" "https://${PUBLIC_HOST}"
