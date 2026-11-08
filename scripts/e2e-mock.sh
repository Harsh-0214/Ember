#!/usr/bin/env bash
# Builds Ember against the local mock Supabase and runs the Playwright suite.
# Usage: bash scripts/e2e-mock.sh [--no-build] [playwright args...]
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.mock; set +a
BUILD=1
if [ "${1:-}" = "--no-build" ]; then BUILD=0; shift; fi
node scripts/mock-supabase.mjs 54329 > /tmp/ember-mock.log 2>&1 &
MOCK_PID=$!
cleanup() { kill "$MOCK_PID" 2>/dev/null || true; [ -n "${APP_PID:-}" ] && kill "$APP_PID" 2>/dev/null || true; }
trap cleanup EXIT
if [ "$BUILD" = "1" ]; then npx next build > /tmp/ember-build.log 2>&1; fi
npx next start -p 3100 > /tmp/ember-app.log 2>&1 &
APP_PID=$!
sleep 5
E2E_BASE_URL=http://localhost:3100 npx playwright test --trace off "$@"
