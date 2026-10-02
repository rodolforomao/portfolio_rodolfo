#!/usr/bin/env bash
# Verifica quote_orders_server.py em produção.
# Uso: bash scripts/verify-quote-orders-prod.sh [BASE_URL]

set -euo pipefail

BASE="${1:-https://rodolforomao.com.br}"
BASE="${BASE%/}"

fail=0
URL="$BASE/api/quote-orders"
body="$(curl -fsS -m 15 "$URL" 2>/dev/null || true)"
http="$(curl -sS -m 15 -o /dev/null -w '%{http_code}' "$URL" 2>/dev/null || echo "000")"

echo "Verificando quote-orders em: $BASE"
echo

if [[ "$http" == "000" || -z "$body" ]]; then
  echo "FAIL  GET /api/quote-orders — sem resposta ($URL)"
  fail=1
elif [[ "$body" == "<!"* || "$body" == "<html"* ]]; then
  echo "FAIL  GET /api/quote-orders — recebeu HTML (SPA), esperava JSON HTTP $http"
  fail=1
else
  python3 - "$body" <<'PY' || fail=1
import json, sys
raw = sys.argv[1]
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print("FAIL  GET /api/quote-orders — resposta não é JSON")
    sys.exit(1)
quotes = data.get("quotes")
if not isinstance(quotes, list):
    print("FAIL  GET /api/quote-orders — campo quotes ausente")
    sys.exit(1)
ids = [q.get("id") for q in quotes]
needed = ("imp-john-5-25k", "imp-john-5-50k", "imp-john-4", "imp-jhon-3", "imp-jhon-2")
missing = [i for i in needed if i not in ids]
print(f"OK    GET /api/quote-orders — JSON HTTP, {len(quotes)} ordem(ns)")
if missing:
    print("FAIL  banco sem as ordens importadas:", ", ".join(missing))
    sys.exit(1)
print("      importadas:", ", ".join(needed))
PY
fi

echo
if [[ "$fail" -eq 0 ]]; then
  echo "Quote orders API e banco expostos em $BASE."
  exit 0
fi

echo "Quote orders NÃO está exposta. Rode:"
echo "  bash scripts/deploy-quote-orders.sh"
exit 1
