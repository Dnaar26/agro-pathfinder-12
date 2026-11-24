#!/usr/bin/env bash
set -euo pipefail

BRANCH_NAME="${1:-main}"
COMMIT_MSG="${2:-feat(ai-free-v3): add free multi-model cascade (gpt-oss-120b/20b + gemini-3.5-flash-lite), voice/photo chat, humidity fix and fast queries}"

rm -rf ./agro-pathfinder-12-main

npm ci
npm run typecheck
npm run lint
npm run test:e2e:safety
npm run test:phase34
npm run build

git add -A
git reset -- .env .env.local .env.production 2>/dev/null || true

git commit -m "$COMMIT_MSG"
git push -u origin "$BRANCH_NAME"
echo "Cambios validados y subidos a $BRANCH_NAME."
