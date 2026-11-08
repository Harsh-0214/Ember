#!/usr/bin/env bash
# Builds Ember against the local mock Supabase and runs the Playwright suite.
# Usage: bash scripts/e2e-mock.sh [--no-build] [playwright args...]
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.mock; set +a
BUILD=1
if [ "${1:-}" = "--no-build" ]; then BUILD=0; shift; fi
if node -e "require('net').connect(3100,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"; then
  echo "Port 3100 is already in use — stop that server first." >&2
  exit 1
fi
node scripts/mock-supabase.mjs 54329 > /tmp/ember-mock.log 2>&1 &
MOCK_PID=$!
cleanup() { kill "$MOCK_PID" 2>/dev/null || true; [ -n "${APP_PID:-}" ] && kill "$APP_PID" 2>/dev/null || true; }
trap cleanup EXIT
if [ "$BUILD" = "1" ]; then ./node_modules/.bin/next build > /tmp/ember-build.log 2>&1; fi
./node_modules/.bin/next start -p 3100 > /tmp/ember-app.log 2>&1 &
APP_PID=$!
sleep 5
E2E_BASE_URL=http://localhost:3100 npx playwright test --trace off "$@"
