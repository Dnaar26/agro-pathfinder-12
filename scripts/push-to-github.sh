#!/usr/bin/env bash
set -euo pipefail

BRANCH_NAME="${1:-main}"
COMMIT_MSG="${2:-feat(v7): fix farmer reports queries/tabs and organize admin & staff views by farm/productive unit}"

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
echo "Version v7 validada y subida a $BRANCH_NAME."
