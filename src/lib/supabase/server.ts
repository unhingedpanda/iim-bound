import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { supabaseEnv } from "./env";

/**
 * The Clerk JWT template Supabase validates.
 *
 * A contract with the Clerk dashboard: Clerk's "Connect with Supabase" creates a
 * template of exactly this name and puts the `role: authenticated` claim in it,
 * which Supabase insists on before it will accept a Clerk token at all. Rename
 * it here and it has to be renamed there.
 */
const SUPABASE_TOKEN_TEMPLATE = "supabase";

/**
 * Supabase, as Clerk's authenticated user.
 *
 * The session token is minted by Clerk and handed to Supabase on every request,
 * and that is what makes `auth.jwt() ->> 'sub'` the identity in Postgres.
 * Without it the request is anonymous and every row-level policy refuses —
 * which is the safe direction to fail in.
 *
 * `accessToken` is a callback rather than a value because Clerk refreshes the
 * token: supabase-js calls it when it needs one, and again after a 401.
 *
 * This replaced createServerClient from @supabase/ssr. That package exists to
 * persist Supabase's own session in cookies, and there is no Supabase session
 * any more — Clerk owns the session and the cookie. Keeping the SSR client
 * would have left two things believing they were the source of truth.
 */
export async function createClient() {
  const { url, key } = supabaseEnv();
  const { getToken } = await auth();

  return createSupabaseClient(url, key, {
    accessToken: () => getToken({ template: SUPABASE_TOKEN_TEMPLATE }),
  });
}

/**
 * The signed-in user's id, or null.
 *
 * Wrapped in cache() because one render asks repeatedly: the layout, the page,
 * and every function in data.ts that scopes a query. React scopes the memo to
 * the request, so concurrent requests never share an answer.
 *
 * Clerk's userId is a string like `user_2abc…`, not a uuid — which is exactly
 * why the schema's user columns are text. `auth.uid()` returns null for it,
 * silently, so nothing in the data layer may go back to using that.
 */
export const currentUserId = cache(async (): Promise<string | null> => {
  const { userId } = await auth();
  return userId;
});
