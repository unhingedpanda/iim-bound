import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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
 */
export async function currentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}
