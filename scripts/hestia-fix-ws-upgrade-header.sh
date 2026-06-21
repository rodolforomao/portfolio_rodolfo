#!/usr/bin/env bash
# HestiaCP esconde "Upgrade" em TODAS as respostas proxy — quebra WebSocket.
# Este script comenta a linha no nginx.ssl.conf / nginx.conf do domínio.
#
# Rodar na VPS como root após rebuild do domínio no Hestia:
#   bash hestia-fix-ws-upgrade-header.sh rodolforomao.com.br
#
# Ou via deploy-vault-services.sh (já chama automaticamente).

set -euo pipefail

DOMAIN="${1:-rodolforomao.com.br}"
CONF_DIR="/home/admin/conf/web/${DOMAIN}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Erro: execute como root." >&2
  exit 1
fi

fix_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  if grep -q '^[[:space:]]*proxy_hide_header Upgrade;' "$f"; then
    sed -i 's/^[[:space:]]*proxy_hide_header Upgrade;/# proxy_hide_header Upgrade; # disabled: quebra \/dealer-ws e \/vault-ws/' "$f"
    echo "OK  $f"
  else
    echo "SKIP $f (já corrigido ou sem proxy_hide_header Upgrade)"
  fi
}

fix_file "$CONF_DIR/nginx.ssl.conf"
fix_file "$CONF_DIR/nginx.conf"

nginx -t
systemctl reload nginx
echo "WebSocket Upgrade header liberado para ${DOMAIN}."
