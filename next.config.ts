import type { NextConfig } from "next";

/**
 * The page was already same-origin-only in practice — every request carries a
 * Supabase session cookie, and the app renders nothing a third party provides
 * — but none of that was stated anywhere, so a browser had to guess. These are
 * the four headers that stop the guessing, with no build step and nothing to
 * keep in sync.
 *
 * No script-src here on purpose. Next inlines its own bootstrap, the theme
 * script in the app layout is inline by design, and analytics injects at
 * runtime; a `script-src 'self'` would break all three, and a permissive one
 * would be decoration. That one is a follow-up with a nonce, not a header to
 * paste in.
 */
const SECURITY_HEADERS = [
  // Nothing on this site has any business being framed.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  // Never let a browser decide a response is a different type than it is.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin to other sites, the full path only to ourselves.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
