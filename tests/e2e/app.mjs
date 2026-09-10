/**
 * The application's own code, loaded for real.
 *
 * `bindSession()` points the app's Supabase factories at one user's cookie jar
 * and then hands back the app's actual modules: the query layer, the server
 * actions, the day helpers and the exam model. Tests call them directly, so
 * they run against real PostgREST, real row-level security, the real RPC and
 * the real migrations.
 *
 * Requires node --experimental-strip-types, plus the resolver for the app's
 * own `@/` alias (see npm run test:e2e).
 *
 * Imports here are relative rather than aliased: this file lives outside src/,
 * so the resolver's alias rule does not reach it. Everything the app itself
 * imports — which is all of the code under test — uses the alias.
 */

import { installResolver } from "./bootstrap.mjs";
import { bindClerkSession } from "./stubs/clerk-server.mjs";

// Must happen before any application module is imported below.
installResolver();

/**
 * Point the app at one signed-in (or anonymous) user.
 *
 * Takes the identity rather than a cookie jar, because that is what identifies
 * a caller now: Clerk's user id, plus a Supabase token signed for it. The app's
 * own client passes the token, exactly as it does in the browser.
 */
export function bindSession(user = null) {
  bindClerkSession(user ? { userId: user.id, token: user.token } : {});
  globalThis.__E2E_REFRESHES__ = 0;
  return user;
}

/** How many times the code under test asked for a re-render. */
export function refreshes() {
  return globalThis.__E2E_REFRESHES__ ?? 0;
}

/** The app's modules, loaded lazily so the resolver is installed first. */
export async function app() {
  return {
    ...(await import("../../src/lib/data.ts")),
    ...(await import("../../src/app/actions.ts")),
    day: await import("../../src/lib/day.ts"),
    cat: await import("../../src/lib/cat.ts"),
    plan: await import("../../src/lib/plan.ts"),
    routes: await import("../../src/lib/routes.ts"),
    writes: await import("../../src/lib/server/writes.ts"),
  };
}
