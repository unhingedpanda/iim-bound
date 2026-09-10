#!/usr/bin/env bash
#
# Browser suite: the app driven by a real Chromium.
#
# Same environment as the HTTP suite (harness.sh), same build, same port. What
# is different is the instrument: this one can see geometry, computed style,
# hover, focus and a phone viewport, which is where the defects that survive
# every other test live.

set -euo pipefail

source "$(dirname "$0")/../e2e/harness.sh"
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

echo "==> running the browser suite against :$APP_PORT"
npx playwright test --config playwright.config.ts
