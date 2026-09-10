import Link from "next/link";
import Mark from "@/components/Mark";
import { SITE } from "@/lib/site";
import DemoTabs from "./DemoTabs";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-24 pt-6">
      <header className="border-b-4 border-ink pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Mark size={24} />
            <span className="display text-2xl">{SITE.name}</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="border-2 border-signal px-3 py-1 text-sm font-semibold text-signal">
              Sample data
            </span>
            <Link href="/login" className="bg-ink px-4 py-2 text-sm font-semibold text-paper">
              Start yours
            </Link>
          </div>
        </div>
        <DemoTabs />
      </header>

      {children}

      <p className="mt-16 border-t-2 border-ink pt-5 text-ink-2">
        Nothing here is saved and nothing here is editable — it is one made-up account so you can
        see the screens. Every drill, target and threshold becomes yours once you sign in.{" "}
        <Link href="/login" className="font-semibold text-ink underline underline-offset-4">
          Start your own logbook
        </Link>
        .
      </p>
    </div>
  );
}
