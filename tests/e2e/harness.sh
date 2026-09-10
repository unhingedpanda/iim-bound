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
# The suite mints Supabase-acceptable JWTs for its test identities, so it needs
# the secret PostgREST will verify them against.
export SUPABASE_TEST_JWT_SECRET=$(printf '%s' "$status" | python3 -c 'import json,sys; print(json.load(sys.stdin)["JWT_SECRET"])')

# The tests import the application's own modules, and those read the public
# env vars directly. Exported rather than passed per-command so the app the
# tests call and the app the browser talks to are provably the same stack.
export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_TEST_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_TEST_PUBLISHABLE_KEY"

# Clerk's keys come from .env.local and are deliberately NOT overridden: there is
# no local Clerk to point at, so both suites authenticate against the real
# development instance. Parsed with python rather than `source`d, because
# .env.local is not shell syntax — the Vercel OIDC token alone would break it.
if [ -f .env.local ]; then
  while IFS='=' read -r key value; do
    [ -n "$key" ] || continue
    export "$key=$value"
  done < <(python3 - <<'PY'
for line in open(".env.local"):
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    if key.startswith("NEXT_PUBLIC_CLERK_") or key == "CLERK_SECRET_KEY":
        print(f"{key}={value.strip(chr(34))}")
PY
)
fi

if [ -z "${CLERK_SECRET_KEY:-}" ]; then
  echo "CLERK_SECRET_KEY is not set. Add it to .env.local — see README." >&2
  exit 1
fi

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
  if curl -fsS "http://localhost:$APP_PORT/login" >/dev/null 2>&1; then break; fi
  sleep 0.5
done

if ! curl -fsS "http://localhost:$APP_PORT/login" >/dev/null 2>&1; then
  echo "the app did not come up; see /tmp/iim-bound-e2e-server.log" >&2
  exit 1
fi
