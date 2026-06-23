#!/usr/bin/env bash
# Commit, incrementa a tag semver (1.00.XXX) e opcionalmente faz push.
#
# Uso:
#   bash scripts/release.sh "mensagem do commit"
#   bash scripts/release.sh "mensagem do commit" --no-push
#   npm run release -- "mensagem do commit"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  cat <<'EOF'
Uso: release.sh "mensagem do commit" [--no-push]

  --no-push   Cria commit e tag localmente, sem git push.
EOF
}

next_tag() {
  local latest major minor patch next_patch

  latest="$(git tag -l | sort -V | tail -1 || true)"

  if [[ -z "$latest" ]]; then
    echo "1.00.001"
    return
  fi

  IFS='.' read -r major minor patch <<< "$latest"
  next_patch=$((10#${patch:-0} + 1))
  printf '%s.%s.%03d' "$major" "$minor" "$next_patch"
}

cd "$PROJECT_ROOT"

MESSAGE=""
PUSH=1

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      usage
      exit 0
      ;;
    --no-push)
      PUSH=0
      ;;
    *)
      if [[ -z "$MESSAGE" ]]; then
        MESSAGE="$arg"
      else
        echo "Erro: argumento desconhecido: $arg" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$MESSAGE" ]]; then
  echo "Erro: informe a mensagem do commit." >&2
  usage >&2
  exit 1
fi

BRANCH="$(git branch --show-current)"
if [[ -z "$BRANCH" ]]; then
  echo "Erro: não foi possível detectar o branch atual." >&2
  exit 1
fi

git add .

if git diff --cached --quiet; then
  echo "Nada para commitar (working tree limpa após git add)." >&2
  exit 1
fi

NEW_TAG="$(next_tag)"

git commit -m "$MESSAGE"
git tag "$NEW_TAG"

echo
echo "✓ Commit criado"
echo "✓ Tag: $NEW_TAG"

if [[ "$PUSH" -eq 1 ]]; then
  git push origin "$BRANCH"
  git push origin "$NEW_TAG"
  echo "✓ Push: $BRANCH e tag $NEW_TAG"
else
  echo "→ Push ignorado (--no-push)"
  echo "  git push origin $BRANCH && git push origin $NEW_TAG"
fi
