#!/usr/bin/env bash
# Verifica liquid_pots_server.py em produção.
# Uso: bash scripts/verify-liquid-pots-prod.sh [BASE_URL]

set -euo pipefail

BASE="${1:-https://rodolforomao.com.br}"
BASE="${BASE%/}"

fail=0
RETRIES="${LIQUID_POTS_VERIFY_RETRIES:-5}"
RETRY_DELAY="${LIQUID_POTS_VERIFY_RETRY_DELAY:-2}"

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
      # extrai telegram_configured se health
      if [[ "$url" == *"/health"* ]]; then
        printf '%s' "$body" | python3 -c "
import sys, json
d=json.load(sys.stdin)
print('      telegram_configured=', d.get('telegram_configured'), ' source=', d.get('telegram_source'))
" 2>/dev/null || true
      fi
      return
    fi

    [[ "$attempt" -lt "$RETRIES" ]] && sleep "$RETRY_DELAY"
  done

  echo "FAIL  $label — resposta não é JSON válido ($url) HTTP $http"
  echo "      corpo: ${body:0:120}"
  fail=1
}

echo "Verificando liquid-pots em: $BASE"
echo

check_json "GET /api/liquid-pots/health" "$BASE/api/liquid-pots/health"
check_json "GET /api/liquid-pots/" "$BASE/api/liquid-pots/"

echo
if [[ "$fail" -eq 0 ]]; then
  echo "Liquid pots API exposta corretamente em $BASE."
  exit 0
fi

echo "Liquid pots NÃO está exposta. Rode:"
echo "  bash scripts/deploy-liquid-pots.sh"
exit 1
