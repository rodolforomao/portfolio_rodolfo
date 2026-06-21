#!/usr/bin/env bash
# Setup one-shot na VPS: Python venv, systemd, proxy web.
# Rodar COMO ROOT na VPS, dentro de /var/www/portfolio (ou DEPLOY_REMOTE_PATH).
#
# Pré-requisitos:
#   - vault_server.py e requirements-vault.txt no diretório do site
#   - ws_relay_server.py copiado para o mesmo diretório (repo manager_dealer)
#   - .env.vault com VAULT_ADMIN_TOKEN e WS_BRIDGE_TOKEN (mesmos do manager_dealer)
#
# Uso na VPS:
#   cd /var/www/portfolio
#   sudo bash scripts/setup-vps-vault.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WEB_USER="${WEB_USER:-www-data}"
VENV="$ROOT/venv"
ENV_FILE="$ROOT/.env.vault"

echo "== Portfolio vault setup =="
echo "Diretório: $ROOT"
echo

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Erro: execute como root (sudo)." >&2
  exit 1
fi

for f in vault_server.py requirements-vault.txt; do
  if [[ ! -f "$ROOT/$f" ]]; then
    echo "Erro: $f não encontrado em $ROOT" >&2
    exit 1
  fi
done

if [[ ! -f "$ROOT/ws_relay_server.py" ]]; then
  echo "AVISO: ws_relay_server.py não encontrado — relay não será habilitado."
  echo "       Copie de manager_dealer/ para $ROOT/ws_relay_server.py"
  RELAY_OK=0
else
  RELAY_OK=1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Criando $ENV_FILE a partir do template..."
  cat > "$ENV_FILE" <<'EOF'
# Tokens — devem coincidir com manager_dealer/.env
VAULT_ADMIN_TOKEN=troque-este-token-forte
WS_BRIDGE_TOKEN=troque-este-token-forte

VAULT_HTTP_HOST=127.0.0.1
VAULT_HTTP_PORT=8766
VAULT_DB_PATH=/var/www/portfolio/vault_data.db
EOF
  chmod 600 "$ENV_FILE"
  if [[ "${NONINTERACTIVE:-}" != "1" ]]; then
    echo "Edite $ENV_FILE antes de continuar (Ctrl+C agora ou ENTER para seguir com placeholders)."
    read -r _
  else
    echo "NONINTERACTIVE=1 — continuando (confira tokens em $ENV_FILE)."
  fi
fi

echo "Instalando venv Python..."
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip >/dev/null 2>&1 || true
python3 -m venv "$VENV"
"$VENV/bin/pip" install -q -r "$ROOT/requirements-vault.txt"

chown -R "$WEB_USER:$WEB_USER" "$VENV" "$ROOT/vault_data.db" 2>/dev/null || true
touch "$ROOT/vault_data.db"
chown "$WEB_USER:$WEB_USER" "$ROOT/vault_data.db"

echo "Instalando units systemd..."
install -m 644 "$ROOT/scripts/systemd/portfolio-vault.service" /etc/systemd/system/
if [[ "$RELAY_OK" -eq 1 ]]; then
  install -m 644 "$ROOT/scripts/systemd/portfolio-relay.service" /etc/systemd/system/
fi

# Ajusta paths nos units se DEPLOY_REMOTE_PATH != /var/www/portfolio
if [[ "$ROOT" != "/var/www/portfolio" ]]; then
  sed -i "s|/var/www/portfolio|$ROOT|g" /etc/systemd/system/portfolio-vault.service
  [[ "$RELAY_OK" -eq 1 ]] && sed -i "s|/var/www/portfolio|$ROOT|g" /etc/systemd/system/portfolio-relay.service
fi

systemctl daemon-reload
systemctl enable portfolio-vault.service
systemctl restart portfolio-vault.service

if [[ "$RELAY_OK" -eq 1 ]]; then
  systemctl enable portfolio-relay.service
  systemctl restart portfolio-relay.service
fi

echo
echo "Serviços:"
systemctl --no-pager status portfolio-vault.service | head -5 || true
[[ "$RELAY_OK" -eq 1 ]] && systemctl --no-pager status portfolio-relay.service | head -5 || true

echo
echo "== Configurar proxy web =="
if command -v nginx >/dev/null 2>&1; then
  SNIP="/etc/nginx/snippets/portfolio-vault.conf"
  cp "$ROOT/scripts/nginx-portfolio-vault.conf" "$SNIP"
  echo "Snippet nginx instalado em $SNIP"
  echo "Adicione dentro do server {} de rodolforomao.com.br (ANTES do catch-all SPA):"
  echo "  include snippets/portfolio-vault.conf;"
  echo "Depois: nginx -t && systemctl reload nginx"
elif command -v apache2 >/dev/null 2>&1; then
  a2enmod proxy proxy_http proxy_wstunnel rewrite 2>/dev/null || true
  install -m 644 "$ROOT/scripts/apache-portfolio-vault.conf" /etc/apache2/conf-available/portfolio-vault.conf
  a2enconf portfolio-vault 2>/dev/null || ln -sf ../conf-available/portfolio-vault.conf /etc/apache2/conf-enabled/portfolio-vault.conf
  systemctl reload apache2
  echo "Apache: conf portfolio-vault habilitada."
else
  echo "Nem nginx nem apache2 detectados — configure proxy manualmente (scripts/nginx-portfolio-vault.conf)."
fi

echo
echo "Teste local na VPS:"
echo "  curl -s http://127.0.0.1:8766/api/vault/dealers"
echo "Teste público (de qualquer máquina):"
echo "  bash scripts/verify-vault-prod.sh https://rodolforomao.com.br"
