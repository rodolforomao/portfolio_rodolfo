#!/usr/bin/env bash
# Verifica se o vault está exposto corretamente em produção.
# Uso: bash scripts/verify-vault-prod.sh [BASE_URL]
# Exemplo: bash scripts/verify-vault-prod.sh https://rodolforomao.com.br

set -euo pipefail

BASE="${1:-https://rodolforomao.com.br}"
BASE="${BASE%/}"

fail=0
RETRIES="${VAULT_VERIFY_RETRIES:-5}"
RETRY_DELAY="${VAULT_VERIFY_RETRY_DELAY:-2}"

check_json() {
  local label="$1"
  local url="$2"
  local body http attempt

  for ((attempt = 1; attempt <= RETRIES; attempt++)); do
    body="$(curl -fsS -m 10 "$url" 2>/dev/null || true)"
    http="$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo "000")"

    if [[ "$http" == "000" ]]; then
      [[ "$attempt" -lt "$RETRIES" ]] && sleep "$RETRY_DELAY" && continue
      echo "FAIL  $label — sem resposta ($url)"
      fail=1
      return
    fi

    if [[ "$body" == "<!"* || "$body" == "<html"* ]]; then
      [[ "$attempt" -lt "$RETRIES" ]] && sleep "$RETRY_DELAY" && continue
      echo "FAIL  $label — recebeu HTML (SPA), esperava JSON ($url) HTTP $http"
      fail=1
      return
    fi

    if printf '%s' "$body" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
      if [[ "$attempt" -gt 1 ]]; then
        echo "OK    $label — JSON HTTP $http (tentativa $attempt/$RETRIES)"
      else
        echo "OK    $label — JSON HTTP $http"
      fi
      return
    fi

    [[ "$attempt" -lt "$RETRIES" ]] && sleep "$RETRY_DELAY"
  done

  echo "FAIL  $label — resposta não é JSON válido ($url) HTTP $http"
  echo "      corpo: ${body:0:120}"
  fail=1
}

echo "Verificando vault em: $BASE"
echo

check_json "GET /api/vault/dealers" "$BASE/api/vault/dealers"

# Admin exige Bearer; 401 JSON ainda indica que o proxy chegou no vault
admin_body="$(curl -sS -m 10 "$BASE/admin/vault/status/dealer_1" 2>/dev/null || true)"
admin_http="$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "$BASE/admin/vault/status/dealer_1" 2>/dev/null || echo "000")"
if [[ "$admin_body" == "<!"* ]]; then
  echo "FAIL  GET /admin/vault/status/dealer_1 — recebeu HTML HTTP $admin_http"
  fail=1
elif [[ "$admin_http" == "401" || "$admin_http" == "404" || "$admin_http" == "200" ]]; then
  echo "OK    GET /admin/vault/status/dealer_1 — proxy OK HTTP $admin_http"
else
  echo "WARN  GET /admin/vault/status/dealer_1 — HTTP $admin_http (esperado 200/401/404)"
fi

echo
if [[ "$fail" -eq 0 ]]; then
  echo "Vault exposto corretamente. Celular pode usar:"
  echo "  VAULT_SERVICE_URL=$BASE"
  echo "  VAULT_SPLIT_WS_URL=wss://${BASE#https://}/vault-ws"
  echo "  WS_RELAY_URL=wss://${BASE#https://}/dealer-ws"
  exit 0
fi

echo "Vault NÃO está exposto. Rode na VPS:"
echo "  bash scripts/setup-vps-vault.sh"
exit 1
