"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_ROUTES } from "@/lib/routes";

/** The nav is the route registry rendered. It used to keep its own copy of the
 *  list, which is how the proxy and the nav drifted apart. */

export type AttentionRoute = { href: string; label: string };

/** Small square that marks a section needing attention. */
function AttentionDot() {
  return (
    <span
      aria-hidden="true"
      className="absolute right-1.5 top-1.5 size-1.5 bg-signal sm:right-0.5 sm:top-0.5"
    />
  );
}

export function DesktopNav({ attention = [] }: { attention?: AttentionRoute[] }) {
  const pathname = usePathname();
  return (
    <ul className="hidden flex-wrap items-baseline gap-x-1 sm:flex">
      {APP_ROUTES.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const needsAttention = !active && attention.some((a) => a.href === item.href);
        return (
          <li key={item.href} className="relative">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`px-3 py-1.5 text-sm font-semibold ${
                active ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
              }`}
              title={
                needsAttention ? attention.find((a) => a.href === item.href)?.label : undefined
              }
            >
              {item.label}
            </Link>
            {needsAttention ? <AttentionDot /> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Thumb-reachable tab bar; the app is used on a phone between classes. */
export function MobileNav({ attention = [] }: { attention?: AttentionRoute[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t-2 border-ink bg-paper sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {APP_ROUTES.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const needsAttention = !active && attention.some((a) => a.href === item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative py-3.5 text-center text-xs font-semibold ${
              active ? "bg-ink text-paper" : "text-ink-2"
            }`}
            title={needsAttention ? attention.find((a) => a.href === item.href)?.label : undefined}
          >
            {item.label}
            {needsAttention ? <AttentionDot /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
