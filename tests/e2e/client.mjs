/**
 * Making real accounts, so the app code under test can be the real app code.
 *
 * Every test gets its own user. That matters twice over: the tables are
 * RLS-protected per user, so isolation is enforced by the database rather than
 * by test hygiene, and a test that accidentally reads someone else's row fails
 * instead of quietly passing.
 *
 * The cookie builder is the one piece of the framework this file reproduces.
 * @supabase/ssr stores a session as `<storageKey>` holding
 * `base64-` + base64url(JSON), split into `.0`, `.1` … chunks past ~3KB. Ten
 * lines here buys HTTP-level tests that sign in exactly as the browser does,
 * which is worth more than the alternative of testing the proxy with a fake
 * cookie the real stack would reject.
 */

import { createClient } from "@supabase/supabase-js";
import { API_URL, APP_URL, PUBLISHABLE_KEY, SERVICE_KEY } from "./stack.mjs";

export const admin = createClient(API_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let counter = 0;

/** A fresh confirmed account, plus a session for it. */
export async function newUser() {
  counter += 1;
  const email = `e2e-${Date.now()}-${counter}@example.com`;
  const password = "test-password-123";

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);

  const anon = createClient(API_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signedIn, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`);

  return {
    id: data.user.id,
    email,
    session: signedIn.session,
    /** A client scoped to this user, the way PostgREST sees them. */
    db: createClient(API_URL, PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${signedIn.session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

/** The service-role client, for asserting on rows the app cannot see. */
export function asAdmin() {
  return admin;
}

/**
 * The cookies a signed-in browser would send, in @supabase/ssr's format.
 * The key is derived from the Supabase URL, exactly as supabase-js does it:
 * `sb-<first label of the API host>-auth-token`.
 */
export function sessionCookies(session) {
  const storageKey = `sb-${new URL(API_URL).hostname.split(".")[0]}-auth-token`;
  const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;

  const MAX = 3180;
  if (encoded.length <= MAX) return { [storageKey]: encoded };

  const chunks = {};
  for (let i = 0; i * MAX < encoded.length; i += 1) {
    chunks[`${storageKey}.${i}`] = encoded.slice(i * MAX, (i + 1) * MAX);
  }
  return chunks;
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
