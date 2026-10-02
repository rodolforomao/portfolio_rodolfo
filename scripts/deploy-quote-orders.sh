#!/usr/bin/env bash
# Deploy quote_orders_server.py + quote_orders.db na VPS (HestiaCP / nginx).
#
# O SQLite local é a base das cotações. Na primeira publicação (ou com
# QUOTE_ORDERS_SYNC_DB=1) esse arquivo sobe para a VPS. Sem a flag, um banco
# que já existe em produção é mantido.
#
# Uso: bash scripts/deploy-quote-orders.sh

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

LOCAL_DB="${QUOTE_ORDERS_DB_PATH:-$PROJECT_ROOT/quote_orders.db}"
if [[ ! -f "$LOCAL_DB" ]]; then
  echo "Erro: banco local não encontrado em $LOCAL_DB" >&2
  exit 1
fi

PORT="${DEPLOY_SSH_PORT:-22}"
QUOTE_DIR="${DEPLOY_QUOTE_ORDERS_PATH:-/home/admin/web/rodolforomao.com.br/quote-orders}"
NGINX_CONF_DIR="${DEPLOY_NGINX_CONF_DIR:-/home/admin/conf/web/rodolforomao.com.br}"
PUBLIC_HOST="${DEPLOY_PUBLIC_HOST:-rodolforomao.com.br}"
SYNC_DB="${QUOTE_ORDERS_SYNC_DB:-0}"

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

echo "Deploy quote-orders → $SSH_TARGET:$QUOTE_DIR"

"${SSH_BASE[@]}" "$SSH_TARGET" "mkdir -p '$QUOTE_DIR'"

REMOTE_HAS_DB="$("${SSH_BASE[@]}" "$SSH_TARGET" "test -s '$QUOTE_DIR/quote_orders.db' && echo yes || echo no")"
UPLOAD_DB=0
if [[ "$SYNC_DB" == "1" || "$REMOTE_HAS_DB" != "yes" ]]; then
  UPLOAD_DB=1
fi

DB_TMP="$(mktemp)"
python3 - "$LOCAL_DB" "$DB_TMP" <<'PY'
import sqlite3, sys
src, dst = sys.argv[1], sys.argv[2]
source = sqlite3.connect(src)
dest = sqlite3.connect(dst)
source.backup(dest)
dest.close()
source.close()
PY

ENV_TMP="$(mktemp)"
cat > "$ENV_TMP" <<EOF
QUOTE_ORDERS_HTTP_HOST=127.0.0.1
QUOTE_ORDERS_HTTP_PORT=8771
QUOTE_ORDERS_DB_PATH=${QUOTE_DIR}/quote_orders.db
EOF
chmod 600 "$ENV_TMP"

rsync -avz -e "$RSYNC_SSH" \
  "$PROJECT_ROOT/quote_orders_server.py" \
  "$PROJECT_ROOT/scripts/hestia-nginx-quote-orders.conf" \
  "$PROJECT_ROOT/scripts/systemd/quote-orders.service" \
  "$ENV_TMP" \
  "$SSH_TARGET:$QUOTE_DIR/"

if [[ "$UPLOAD_DB" == "1" ]]; then
  echo "Enviando banco local → $QUOTE_DIR/quote_orders.db"
  rsync -avz -e "$RSYNC_SSH" \
    "$DB_TMP" \
    "$SSH_TARGET:$QUOTE_DIR/quote_orders.db.upload"
else
  echo "Banco remoto já existe — mantido (QUOTE_ORDERS_SYNC_DB=1 para substituir)."
fi

ENV_BASENAME="$(basename "$ENV_TMP")"
rm -f "$ENV_TMP" "$DB_TMP"

"${SSH_BASE[@]}" "$SSH_TARGET" bash -s <<REMOTE
set -euo pipefail
QUOTE_DIR='$QUOTE_DIR'
NGINX_CONF_DIR='$NGINX_CONF_DIR'
ENV_BASENAME='$ENV_BASENAME'
UPLOAD_DB='$UPLOAD_DB'

if [[ -f "\$QUOTE_DIR/\$ENV_BASENAME" ]]; then
  mv -f "\$QUOTE_DIR/\$ENV_BASENAME" "\$QUOTE_DIR/.env.quote-orders"
fi
chmod 600 "\$QUOTE_DIR/.env.quote-orders"

systemctl stop quote-orders.service 2>/dev/null || true
QUOTE_PORT="\$(grep -oP '^QUOTE_ORDERS_HTTP_PORT=\K.*' "\$QUOTE_DIR/.env.quote-orders" 2>/dev/null || echo 8771)"
if command -v fuser >/dev/null 2>&1; then
  fuser -k "\${QUOTE_PORT}/tcp" >/dev/null 2>&1 || true
else
  STRAY_PIDS="\$(ss -tlnp 2>/dev/null | awk -v p=":\${QUOTE_PORT} " '\$4 ~ p' | grep -oP 'pid=\K[0-9]+' | sort -u)"
  [[ -n "\$STRAY_PIDS" ]] && kill \$STRAY_PIDS >/dev/null 2>&1 || true
fi
sleep 1

if [[ "\$UPLOAD_DB" == "1" && -f "\$QUOTE_DIR/quote_orders.db.upload" ]]; then
  mv -f "\$QUOTE_DIR/quote_orders.db.upload" "\$QUOTE_DIR/quote_orders.db"
fi
chmod 600 "\$QUOTE_DIR/quote_orders.db"
chown -R admin:admin "\$QUOTE_DIR"

PYTHON3="\$(command -v python3)"
sed "s|^ExecStart=.*|ExecStart=\${PYTHON3} \$QUOTE_DIR/quote_orders_server.py|" \
  "\$QUOTE_DIR/quote-orders.service" > /etc/systemd/system/quote-orders.service
chmod 644 /etc/systemd/system/quote-orders.service
cp "\$QUOTE_DIR/hestia-nginx-quote-orders.conf" "\$NGINX_CONF_DIR/nginx.ssl.conf_quote_orders"
cp "\$QUOTE_DIR/hestia-nginx-quote-orders.conf" "\$NGINX_CONF_DIR/nginx.conf_quote_orders"

systemctl daemon-reload
systemctl enable quote-orders.service
systemctl start quote-orders.service
sleep 1

if curl -fsS -m 5 http://127.0.0.1:8771/api/quote-orders >/dev/null; then
  echo "quote-orders local OK (:8771)"
  curl -fsS -m 5 http://127.0.0.1:8771/api/quote-orders | python3 -c "import json,sys; d=json.load(sys.stdin); print('ordens', len(d.get('quotes') or []))"
else
  echo "ERRO: quote-orders não respondeu em 127.0.0.1:8771" >&2
  systemctl --no-pager -l status quote-orders.service || true
  journalctl -u quote-orders.service -n 40 --no-pager || true
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
bash "$SCRIPT_DIR/verify-quote-orders-prod.sh" "https://${PUBLIC_HOST}"
