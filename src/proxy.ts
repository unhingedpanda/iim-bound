import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isAppPath } from "@/lib/routes";

/**
 * Next.js 16 renamed middleware to proxy. This runs on every matched request
 * to refresh the Supabase auth token and hand the fresh cookie to both the
 * Server Components (request.cookies) and the browser (response.cookies).
 *
 * Signed-in state decides between two destinations and never both, so there is
 * no redirect loop: without a session an app path goes to the sign-in form
 * with a `next` to come back to, and with a session the two entry points —
 * the landing page and the sign-in form — step aside for Today.
 *
 * Which paths are "app paths" comes from @/lib/routes, the same list the nav
 * renders. This file used to spell the list out again, which is how /errors
 * and /syllabus ended up gated by their layout but invisible to the proxy.
 *
 * It sits in src/ rather than the repository root because Next resolves this
 * convention relative to the app directory: with the app at src/app the file
 * has to be at src/proxy.ts. At the root it is not an error — it is silently
 * ignored, and every gated route renders its own redirect instead.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without configuration the app still renders its public pages.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const path = request.nextUrl.pathname;
  const goToLogin = !signedIn && isAppPath(path);
  const goToToday = signedIn && (path === "/" || path === "/login");

  if (goToLogin || goToToday) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = goToLogin ? "/login" : "/today";
    redirect.search = "";
    if (goToLogin) redirect.searchParams.set("next", path);
    // A visitor holding no session must not be able to poison a shared cache
    // with a redirect that a signed-in visitor would then be served.
    return NextResponse.redirect(redirect, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
