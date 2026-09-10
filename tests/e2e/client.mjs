/**
 * Identities for the e2e suite, now that Clerk owns them.
 *
 * Two things changed with the migration and both are load-bearing:
 *
 *  - A user id is a Clerk id (`user_…`), not a uuid. The schema's user columns
 *    are text for exactly this reason.
 *  - Supabase is reached with a *token*, not a cookie. So instead of building
 *    @supabase/ssr's cookie format by hand, this hands out a real JWT signed
 *    with the local stack's secret, carrying the same claims Clerk's template
 *    does — see scripts/local-token.mjs. PostgREST verifies the signature, so
 *    what is tested is the path that ships: `auth.jwt() ->> 'sub'` resolves,
 *    and the row-level policies apply.
 *
 * Accounts are still per-test. There is nothing in Postgres to create — Clerk
 * owns the user — so a "new user" is a fresh id, and isolation is enforced by
 * the database rather than by test hygiene.
 */

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { localToken } from "../../scripts/local-token.mjs";
import { API_URL, APP_URL, PUBLISHABLE_KEY, SERVICE_KEY } from "./stack.mjs";

export const JWT_SECRET = process.env.SUPABASE_TEST_JWT_SECRET ?? "";
if (!JWT_SECRET) {
  throw new Error(
    "SUPABASE_TEST_JWT_SECRET is not set. tests/e2e/harness.sh exports it from `supabase status`.",
  );
}

export const admin = createClient(API_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function tokenFor(userId) {
  return localToken(userId, JWT_SECRET);
}

let counter = 0;

/**
 * A fresh signed-in user.
 *
 * `db` is a client scoped to that identity, the way PostgREST sees it, so a
 * query here is subject to the same policies a browser request is.
 */
export async function newUser() {
  counter += 1;
  const id = `user_e2e${counter}${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const token = tokenFor(id);

  return {
    id,
    token,
    db: createClient(API_URL, PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

/** The service-role client, for asserting on rows the app cannot see. */
export function asAdmin() {
  return admin;
}

/**
 * The cookie a browser would send. Only used by the HTTP suite, which talks to
 * a running server; the token is what the server's own client passes on.
 */
export function sessionCookies(user) {
  return { __session: user.token };
}

export function cookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

/** fetch() against the test server, with cookies and no redirect following. */
export async function get(path, { cookies, origin = APP_URL } = {}) {
  const response = await fetch(`${origin}${path}`, {
    redirect: "manual",
    headers: cookies ? { cookie: cookieHeader(cookies) } : {},
  });
  return { response, location: response.headers.get("location"), body: await response.text() };
}

export { APP_URL, API_URL, PUBLISHABLE_KEY, SERVICE_KEY };
