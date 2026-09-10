#!/usr/bin/env bash
#
# End-to-end suite: the app driven over HTTP.
#
# The environment — stack, migrations, build, server — is harness.sh, which the
# browser suite sources too. This file only owns what is specific to running
# Node's test runner against a live server.
#
# The tests read SUPABASE_TEST_* credentials rather than .env.local, which
# points at a hosted project: no test should be one typo away from writing to it.

set -euo pipefail

source "$(dirname "$0")/harness.sh"
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

echo "==> running the HTTP suite on :$APP_PORT"
node --experimental-strip-types --test --test-concurrency=1 tests/e2e/*.test.mjs
