#!/usr/bin/env bash
#
# The environment both test suites run against.
#
# Sourced, not executed, by run.sh and run-browser.sh. It exists because two
# suites now need the same three things — a database reset to the migrations, a
# production build, and a server holding that build — and the second suite
# starting its own server on a different port would have meant two builds of
# the same tree with no guarantee they matched.
#
# Exports, for the caller:
#   APP_PORT   where the server listens
#   SERVER_PID the background server, for the caller's own trap

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"

APP_PORT="${TEST_APP_PORT:-3100}"
export APP_PORT

echo "==> starting the local stack (this project's ports are 553xx)"
npx supabase start >/dev/null

echo "==> resetting the database to the migrations"
npx supabase db reset --local >/dev/null

status=$(npx supabase status -o json)
export SUPABASE_TEST_URL=$(printf '%s' "$status" | python3 -c 'import json,sys; print(json.load(sys.stdin)["API_URL"])')
export SUPABASE_TEST_PUBLISHABLE_KEY=$(printf '%s' "$status" | python3 -c 'import json,sys; print(json.load(sys.stdin)["PUBLISHABLE_KEY"])')
export SUPABASE_TEST_SERVICE_KEY=$(printf '%s' "$status" | python3 -c 'import json,sys; print(json.load(sys.stdin)["SERVICE_ROLE_KEY"])')

# The tests import the application's own modules, and those read the public
# env vars directly. Exported rather than passed per-command so the app the
# tests call and the app the browser talks to are provably the same stack.
export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_TEST_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_TEST_PUBLISHABLE_KEY"

echo "==> building (both suites run the production server, not next dev)"
npm run build >/dev/null

# next start refuses to run without this, and a half-written .next is the usual
# reason — say so here rather than leaving it to the app's own log.
if [ ! -f .next/BUILD_ID ]; then
  echo "no production build in .next after npm run build" >&2
  exit 1
fi

echo "==> starting the app on :$APP_PORT"
PORT="$APP_PORT" npx next start --port "$APP_PORT" >/tmp/iim-bound-e2e-server.log 2>&1 &
SERVER_PID=$!
export SERVER_PID

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$APP_PORT/login" >/dev/null 2>&1; then break; fi
  sleep 0.5
done

if ! curl -fsS "http://127.0.0.1:$APP_PORT/login" >/dev/null 2>&1; then
  echo "the app did not come up; see /tmp/iim-bound-e2e-server.log" >&2
  exit 1
fi
