import { clerkMiddleware } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { isAppPath } from "@/lib/routes";

/**
 * Next.js 16 renamed middleware to proxy. This runs on every matched request
 * and does the whole gate in one place.
 *
 * Signed-in state decides between two destinations and never both, so there is
 * no redirect loop: without a session an app path goes to the sign-in form with
 * a `next` to come back to, and with a session the two entry points — the
 * landing page and the sign-in form — step aside for Today.
 *
 * The session check is Clerk's now, not Supabase's. `auth.protect()` is
 * deliberately not used: it renders Clerk's own hosted page, and this app has
 * its own sign-in route and its own idea of where people should land.
 *
 * Which paths are "app paths" comes from @/lib/routes, the same list the nav
 * renders. This file used to spell the list out again, which is how /errors and
 * /syllabus ended up gated by their layout but invisible to the proxy.
 *
 * It sits in src/ rather than the repository root because Next resolves this
 * convention relative to the app directory: with the app at src/app the file has
 * to be at src/proxy.ts. At the root it is not an error — it is silently
 * ignored, and every gated route renders its own redirect instead.
 */

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const path = request.nextUrl.pathname;

  // Clerk's own handshake and asset routes pass straight through. Running the
  // gate over them made Clerk's token refresh redirect into itself, which Clerk
  // reports as "infinite redirect loop ... your keys do not match" — a message
  // that sends you to the dashboard when the fault is here.
  if (path.startsWith("/__clerk")) return NextResponse.next();

  const { userId } = await auth();
  const signedIn = Boolean(userId);

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

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next internals and static files, run on everything else.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    // Clerk's own handshake endpoints, which the proxy above must also serve.
    "/__clerk/:path*",
    "/(api|trpc)(.*)",
  ],
};
