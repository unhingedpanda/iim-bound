/**
 * Every route behind the sign-in wall, in one place.
 *
 * This list used to be written out twice — once as a chain of startsWith()
 * calls in the proxy and once as the nav array — so /errors was gated by the
 * layout while the proxy knew nothing about it, and adding a section meant
 * remembering both. The proxy imports APP_ROUTES; the nav adds a label.
 */

export const APP_ROUTES = [
  { href: "/today", label: "Today" },
  { href: "/mocks", label: "Mocks" },
  { href: "/syllabus", label: "Syllabus" },
  { href: "/errors", label: "Errors" },
  { href: "/settings", label: "Settings" },
] as const;

export type AppRoute = (typeof APP_ROUTES)[number]["href"];

const APP_PATHS: readonly string[] = APP_ROUTES.map((r) => r.href);

export function isAppPath(pathname: string): boolean {
  return APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * A post-sign-in destination we are willing to send a browser to.
 *
 * `startsWith("/")` is not enough: "//evil.com" is a protocol-relative URL, so
 * `origin + next` leaves the site. Only a single leading slash is ours.
 */
export function safeNext(next: string | null | undefined, fallback = "/today"): string {
  // A path only: one leading slash, and nothing after it that a browser could
  // read as another host. "//evil.com" is protocol-relative, and browsers
  // treat a backslash the way they treat a slash, so "/\evil.com" is the same
  // trick spelled differently.
  if (!next?.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("\\")) return fallback;
  return next;
}
