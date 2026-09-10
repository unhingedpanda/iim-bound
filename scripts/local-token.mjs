/**
 * A Supabase-acceptable JWT for a Clerk identity, signed locally.
 *
 * Clerk owns sign-in, and in production Supabase verifies Clerk's own signed
 * session token. There is no way to mint one of those without Clerk's private
 * key, so anything running off the browser cannot produce a real session.
 *
 * What it can do is sign the same *claims* with the local stack's symmetric
 * secret, which PostgREST verifies just as readily. That is enough for the two
 * callers here — the e2e suite and the demo seeder — because both are testing
 * and seeding Postgres, not Clerk: the policies read `auth.jwt() ->> 'sub'`,
 * and that resolves identically either way.
 *
 * Both callers go through this one function rather than each rolling its own
 * signature, so a claim that Supabase requires can only be discovered missing
 * in one place.
 */

import { createHmac } from "node:crypto";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

/**
 * @param {string} userId a Clerk id, `user_…`
 * @param {string} secret the local stack's JWT secret
 */
export function localToken(userId, secret) {
  if (!userId) throw new Error("localToken needs a user id");
  if (!secret) throw new Error("localToken needs the stack's JWT secret");

  const now = Math.floor(Date.now() / 1000);

  // `sub` is the identity the row-level policies read. `role` is what makes
  // Supabase treat the caller as `authenticated` rather than `anon` — without
  // it every policy refuses. `aud` is the conventional audience.
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    iss: "supabase",
    iat: now,
    exp: now + 60 * 60,
  };

  const signing = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  return `${signing}.${createHmac("sha256", secret).update(signing).digest("base64url")}`;
}
