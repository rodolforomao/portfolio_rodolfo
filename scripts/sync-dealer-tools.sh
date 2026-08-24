#!/usr/bin/env bash
# Sincroniza Analyses + Liquid TX para public/tools/ (servidos pelo CRA em dev e no build).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANALYSES_SRC="$ROOT/tools/analyses"
LIQUID_SRC="$ROOT/tools/liquid-txs"
ANALYSES_OUT="$ROOT/public/tools/analyses"
LIQUID_OUT="$ROOT/public/tools/liquid-tx"

mkdir -p "$ANALYSES_OUT"

cp -f "$ANALYSES_SRC/dashboard/index.html" "$ANALYSES_OUT/index.html"
cp -f "$ANALYSES_SRC/dashboard/app.js" "$ANALYSES_OUT/app.js"
cp -f "$ANALYSES_SRC/data/live.json" "$ANALYSES_OUT/live.json"

if [[ ! -d "$LIQUID_SRC/node_modules" ]]; then
  echo "Instalando deps de tools/liquid-txs…"
  (cd "$LIQUID_SRC" && npm install)
fi

echo "Build Liquid TX → public/tools/liquid-tx"
(cd "$LIQUID_SRC" && npm run build)

echo "OK — public/tools/analyses + public/tools/liquid-tx atualizados."
