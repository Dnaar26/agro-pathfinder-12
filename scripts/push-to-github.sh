#!/usr/bin/env bash
set -euo pipefail

BRANCH_NAME="${1:-feat/production-v2-streaming-trace-optimistic}"
COMMIT_MSG="${2:-feat(prod-v2): add AI SSE streaming, SQL public trace RPC, offline conflict tray, optimistic UI and real error telemetry}"

rm -rf ./agro-pathfinder-12-main

npm ci
npm run typecheck
npm run lint
npm run test:e2e:safety
npm run test:phase34
npm run build

git checkout -B "$BRANCH_NAME"
git add -A
git reset -- .env .env.local .env.production 2>/dev/null || true

git commit -m "$COMMIT_MSG"
git push -u origin "$BRANCH_NAME"
echo "Rama $BRANCH_NAME validada y subida a GitHub."
