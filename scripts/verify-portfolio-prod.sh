#!/usr/bin/env bash
# Verifica se o portfolio_api_server.py está exposto corretamente em produção.
# Uso: bash scripts/verify-portfolio-prod.sh [BASE_URL]
# Exemplo: bash scripts/verify-portfolio-prod.sh https://rodolforomao.com.br

set -euo pipefail

BASE="${1:-https://rodolforomao.com.br}"
BASE="${BASE%/}"

fail=0
RETRIES="${PORTFOLIO_VERIFY_RETRIES:-5}"
RETRY_DELAY="${PORTFOLIO_VERIFY_RETRY_DELAY:-2}"

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

echo "Verificando portfolio-api em: $BASE"
echo

check_json "GET /api/portfolio/stats" "$BASE/api/portfolio/stats"
check_json "GET /api/portfolio/btc-tip" "$BASE/api/portfolio/btc-tip"

# ai-chat exige POST; 503 gracioso (sem chave) ou 200 ambos indicam que o proxy chegou no backend
chat_body="$(curl -sS -m 10 -X POST -H 'Content-Type: application/json' -d '{"message":"health check"}' "$BASE/api/portfolio/ai-chat" 2>/dev/null || true)"
chat_http="$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"message":"health check"}' "$BASE/api/portfolio/ai-chat" 2>/dev/null || echo "000")"
if [[ "$chat_body" == "<!"* ]]; then
  echo "FAIL  POST /api/portfolio/ai-chat — recebeu HTML HTTP $chat_http"
  fail=1
elif [[ "$chat_http" == "200" || "$chat_http" == "503" || "$chat_http" == "429" ]]; then
  echo "OK    POST /api/portfolio/ai-chat — proxy OK HTTP $chat_http"
else
  echo "WARN  POST /api/portfolio/ai-chat — HTTP $chat_http (esperado 200/503/429)"
fi

echo
if [[ "$fail" -eq 0 ]]; then
  echo "Portfolio API exposta corretamente em $BASE."
  exit 0
fi

echo "Portfolio API NÃO está exposta. Rode:"
echo "  bash scripts/deploy-portfolio-api.sh"
exit 1
