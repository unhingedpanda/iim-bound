import { type NextRequest, NextResponse } from "next/server";
import { safeNext } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  // Only a path on this site. `next=//evil.com` is a protocol-relative URL, so
  // `${origin}${next}` would have handed the browser to another host with a
  // real magic link as the bait.
  const next = safeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
