#!/usr/bin/env bash
# LOCAL DEV ONLY — não é usado em produção.
# Produção: scripts/deploy-vault-services.sh + systemd (portfolio-vault / portfolio-relay).
# Cria venv local e instala requirements-vault.txt (vault + relay).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d "$ROOT/venv" ]]; then
  echo "[venv] criando $ROOT/venv …"
  python3 -m venv "$ROOT/venv"
fi

"$ROOT/venv/bin/pip" install -q --upgrade pip
"$ROOT/venv/bin/pip" install -q -r "$ROOT/requirements-vault.txt"
