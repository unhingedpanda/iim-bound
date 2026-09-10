import Link from "next/link";
import { daysBetween, todayISO } from "@/lib/dates";
import { DEFAULT_DRILLS } from "@/lib/plan";
import { SITE } from "@/lib/site";

export default function Landing() {
  const daysLeft = Math.max(0, daysBetween(todayISO(), SITE.defaultExamDate));

  return (
    <main className="mx-auto max-w-[1200px] px-6 pb-24 pt-8">
      <nav className="flex items-center justify-between gap-4 pb-8">
        <span className="text-sm font-semibold tracking-tight">{SITE.name}</span>
        <div className="flex items-center gap-5 text-sm">
          <a href={SITE.repoUrl} className="text-ink-2 underline underline-offset-4 hover:text-ink">
            Source
          </a>
          <Link href="/login" className="bg-ink px-4 py-2 font-semibold text-paper">
            Start
          </Link>
        </div>
      </nav>

      {/* Hero: the countdown is the thesis. Everything else is downstream of it. */}
      <header className="rule-heavy pt-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <h1 className="display min-w-0 text-[clamp(56px,13vw,150px)]">
            {daysLeft}
            <span className="block text-[0.28em] font-semibold tracking-[0.02em]">
              days until {SITE.examLabel}
            </span>
          </h1>

          <div className="min-w-0 self-end">
            <p className="max-w-[46ch] text-xl leading-snug text-ink-2 lg:text-2xl">
              Most people fail CAT on consistency, not intelligence. This is the logbook that makes
              both visible: what you did today, what you keep getting wrong, and which section is
              quietly costing you the call.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="bg-signal px-6 py-4 text-lg font-semibold text-signal-ink"
              >
                Start your logbook
              </Link>
              <Link href="/demo" className="border-2 border-ink px-6 py-4 text-lg font-semibold">
                See a filled logbook
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* What a day looks like — the actual interface shape, not a mockup frame. */}
      <section className="rule-heavy mt-20 pt-6" aria-labelledby="day-h">
        <h2 id="day-h" className="display text-[clamp(30px,5vw,52px)]">
          A day is {DEFAULT_DRILLS.length} blocks
        </h2>
        <p className="mt-3 max-w-[60ch] text-ink-2">
          Each drill has a minute target and the bar fills from the timer, so a day you half-did
          looks like a day you half-did. These are the defaults — rename them, retime them, add your
          own.
        </p>

        <ul className="mt-10 grid gap-5">
          {DEFAULT_DRILLS.map((drill, i) => {
            const filled = [100, 100, 55, 0][i] ?? 0;
            return (
              <li
                key={drill.slug}
                className="grid grid-cols-1 items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)_auto]"
              >
                <span className="display whitespace-nowrap text-2xl">{drill.label}</span>
                <span className="meter" data-done={filled === 100} aria-hidden="true">
                  <span style={{ "--fill": filled / 100 } as React.CSSProperties} />
                </span>
                <span className="text-sm text-ink-3">
                  {Math.round((filled / 100) * drill.target_minutes)} / {drill.target_minutes} min
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        className="rule-heavy mt-20 grid grid-cols-1 items-start gap-10 pt-6 md:grid-cols-3"
        aria-labelledby="what-h"
      >
        <h2 id="what-h" className="sr-only">
          What it tracks
        </h2>
        {[
          {
            title: "Mocks scored the way CAT scores them",
            body: "Log attempts and correct answers per section. Net score, accuracy and an estimated percentile come out of CAT 2025's own curves, so a past paper counts as much as a paid series.",
          },
          {
            title: "Syllabus you can see through",
            body: "Every topic rated untouched, shaky, solid or automatic. Coverage gaps stop being a feeling and start being a list.",
          },
          {
            title: "An error log with causes",
            body: "Every mistake tagged concept, careless, misread, timing, selection or missed-easy — because only the first of those six is fixed by studying more.",
          },
        ].map((card) => (
          <article key={card.title}>
            <h3 className="display text-2xl">{card.title}</h3>
            <p className="mt-3 text-ink-2">{card.body}</p>
          </article>
        ))}
      </section>

      <footer className="rule-light mt-20 flex flex-wrap items-center justify-between gap-4 pt-6 text-sm text-ink-3">
        <p>Free to use. Your log is private to your account and never shown to anyone else.</p>
        <a href={SITE.repoUrl} className="underline underline-offset-4">
          Source
        </a>
      </footer>
    </main>
  );
}
