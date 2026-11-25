#!/usr/bin/env bash
set -euo pipefail

BRANCH_NAME="${1:-main}"
COMMIT_MSG="${2:-feat(v5): add 4 commercial modules (soil lab, BPA certification, field labor payroll, crop marketplace) + smart chat-calendar-inventory flow}"

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
echo "Version v5 validada y subida a $BRANCH_NAME."
