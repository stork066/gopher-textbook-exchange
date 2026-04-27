#!/usr/bin/env bash
# Deploy the latest main branch on this EC2 host.
# Run from anywhere: `bash ~/gopher-textbook-exchange/deploy.sh`
#
# Steps:
#   1. git pull (fast-forward only — refuses to merge if local has diverged)
#   2. install client + server deps if package-lock changed
#   3. rebuild the client (Vite -> client/dist)
#   4. reload pm2 so server picks up any backend changes
#
# Frontend-only changes go live the moment `npm run build` finishes;
# the pm2 reload at the end covers backend changes.

set -euo pipefail

# Resolve the repo root from the script's own location so cwd doesn't matter.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

echo "==> Repo: $REPO_ROOT"
echo "==> Branch: $(git rev-parse --abbrev-ref HEAD)"

echo "==> git pull --ff-only"
git pull --ff-only

# Track whether deps changed so we can skip npm install on no-op deploys.
CLIENT_LOCK_CHANGED=$(git diff --name-only HEAD@{1} HEAD -- my-app/client/package-lock.json | wc -l | tr -d ' ')
SERVER_LOCK_CHANGED=$(git diff --name-only HEAD@{1} HEAD -- my-app/server/package-lock.json my-app/package-lock.json | wc -l | tr -d ' ')

if [ "$CLIENT_LOCK_CHANGED" != "0" ]; then
  echo "==> client deps changed — npm install"
  (cd my-app/client && npm install --no-audit --no-fund)
else
  echo "==> client deps unchanged — skipping install"
fi

if [ "$SERVER_LOCK_CHANGED" != "0" ]; then
  echo "==> server deps changed — npm install"
  (cd my-app/server && npm install --no-audit --no-fund)
else
  echo "==> server deps unchanged — skipping install"
fi

echo "==> building client"
(cd my-app/client && npm run build)

echo "==> reloading pm2"
if command -v pm2 >/dev/null 2>&1; then
  pm2 reload all || echo "   (pm2 reload failed — frontend changes are still live; check pm2 status)"
else
  echo "   pm2 not found on PATH — skipping (frontend changes are live)"
fi

echo "==> done. Hard-refresh the browser (Cmd+Shift+R)."
