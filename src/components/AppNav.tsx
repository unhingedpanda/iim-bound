"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/today", label: "Today" },
  { href: "/mocks", label: "Mocks" },
  { href: "/syllabus", label: "Syllabus" },
  { href: "/errors", label: "Errors" },
  { href: "/settings", label: "Settings" },
];

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <ul className="hidden flex-wrap items-baseline gap-x-1 sm:flex">
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`px-3 py-1.5 text-sm font-semibold ${
                active ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Thumb-reachable tab bar; the app is used on a phone between classes. */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t-2 border-ink bg-paper sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`py-3 text-center text-xs font-semibold ${
              active ? "bg-ink text-paper" : "text-ink-2"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
