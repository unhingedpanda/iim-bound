"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/demo", label: "Today" },
  { href: "/demo/mocks", label: "Mocks" },
  { href: "/demo/syllabus", label: "Syllabus" },
  { href: "/demo/errors", label: "Errors" },
];

export default function DemoTabs() {
  const path = usePathname();

  return (
    <nav aria-label="Demo screens" className="-mb-4 mt-4 flex flex-wrap gap-x-6 gap-y-2">
      {TABS.map((tab) => {
        const active = path === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`border-b-4 pb-3 text-sm font-semibold transition-colors ${
              active ? "border-signal text-ink" : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
