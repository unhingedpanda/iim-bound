import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { supabaseEnv } from "./env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. proxy.ts refreshes the
          // session on every request, so ignoring this is safe.
        }
      },
    },
  });
}

/**
 * The signed-in user's id, or null. Uses getClaims(), which verifies the JWT
 * signature — getSession() reads storage without revalidating and must never
 * gate access on the server.
 *
 * Wrapped in cache() because one render asks repeatedly: the layout, the page,
 * and every function in data.ts that scopes a query. Uncached, that was a
 * fresh client and a fresh signature verification per call site. React scopes
 * the memo to the request, so concurrent requests never share an answer.
 */
export const currentUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
});
