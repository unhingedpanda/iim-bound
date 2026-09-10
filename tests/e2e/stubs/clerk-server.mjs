/**
 * @clerk/nextjs/server, as much of it as the app uses.
 *
 * The suite runs the app's own modules outside a request, so the two things the
 * app asks Clerk for — who is signed in, and a Supabase token for that person —
 * are supplied here from the test's own session.
 *
 * This is plumbing, not a mock of the thing under test. Everything the app does
 * with the answer stays real: the actions, the query layer, the SQL, the
 * row-level policies and the JWT verification all run for real. What is replaced
 * is only Clerk's machinery for extracting a session from a request, which
 * cannot exist outside a request — the same reason next/headers is stubbed.
 *
 * The token is genuinely signed with the local stack's JWT secret, so PostgREST
 * verifies it and `auth.jwt() ->> 'sub'` returns the Clerk id, exactly as it
 * does in the browser. Unsigned claims would pass through `set_config` but not
 * through PostgREST, and the point is to test the path that ships.
 */

function session() {
  if (!globalThis.__E2E_CLERK_SESSION__) {
    throw new Error("No session bound. Call bindSession({ userId }) before using the app modules.");
  }
  return globalThis.__E2E_CLERK_SESSION__;
}

/** Point the app at one signed-in (or anonymous) Clerk user. */
export function bindClerkSession({ userId = null, token = null } = {}) {
  globalThis.__E2E_CLERK_SESSION__ = { userId, token };
  return globalThis.__E2E_CLERK_SESSION__;
}

export function auth() {
  const { userId } = session();
  return Promise.resolve({
    userId,
    isAuthenticated: Boolean(userId),
    sessionId: userId ? `sess_${userId}` : null,
    getToken: async () => session().token,
    protect: async () => {
      if (!userId) throw new Error("Not signed in");
    },
    has: () => false,
  });
}

export function clerkMiddleware() {
  throw new Error(
    "clerkMiddleware is not stubbed: the proxy is exercised over HTTP against a running server, not imported.",
  );
}

export function createRouteMatcher() {
  throw new Error("createRouteMatcher is not stubbed: see clerkMiddleware.");
}

export function currentUser() {
  const { userId } = session();
  return Promise.resolve(userId ? { id: userId } : null);
}
