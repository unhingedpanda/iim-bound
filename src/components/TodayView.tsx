import DrillBoard, { type DrillState } from "@/components/DrillBoard";
import RunBoard from "@/components/RunBoard";
import StreakMark from "@/components/StreakMark";
import { longDate } from "@/lib/dates";
import { type Drill, dailyTarget, type Phase } from "@/lib/plan";

export type RunCell = { day: string; done: number };

export default function TodayView({
  today,
  dateLabel,
  dayNumber,
  streak,
  summary,
  phase,
  drills,
  drillDefs,
  run,
  leadingBlanks,
  examDate,
  readOnly = false,
}: {
  today: string;
  dateLabel: string;
  dayNumber: number;
  streak: number;
  summary: { minutes: number; done: number };
  phase: Phase | null;
  drills: Record<string, DrillState>;
  drillDefs: Drill[];
  run: RunCell[];
  leadingBlanks: number;
  examDate: string;
  readOnly?: boolean;
}) {
  const target = dailyTarget(drillDefs);
  const elapsed = run.filter((cell) => cell.day <= today).length;
  const logged = run.filter((cell) => cell.day <= today && cell.done > 0).length;
  return (
    <main>
      <section className="rule-heavy mt-8 pt-5">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h1 className="display min-w-0 text-[clamp(44px,10vw,110px)]">
            Day {dayNumber}
            <span className="mt-3 block text-base font-semibold leading-tight tracking-normal sm:text-lg text-ink-2">
              {dateLabel}
            </span>
          </h1>

          <dl className="flex gap-10">
            <div>
              <dt className="text-sm text-ink-3">Streak</dt>
              <dd className="display text-[clamp(32px,6vw,60px)]">
                <StreakMark streak={streak} />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-3">Minutes today</dt>
              <dd className="display text-[clamp(32px,6vw,60px)]">
                {summary.minutes}
                {target > 0 ? <span className="text-[0.4em] text-ink-3">/{target}</span> : null}
              </dd>
            </div>
          </dl>
        </div>

        {phase ? (
          <p className="mt-6 max-w-[70ch] text-ink-2">
            <span className="font-semibold text-ink">{phase.title}.</span> {phase.detail}
          </p>
        ) : null}
      </section>

      <section className="mt-12" aria-labelledby="drills-h">
        <h2 id="drills-h" className="sr-only">
          Today&rsquo;s drills
        </h2>
        <DrillBoard day={today} drills={drillDefs} initial={drills} readOnly={readOnly} />
      </section>

      <section className="rule-heavy mt-16 pt-5" aria-labelledby="run-h">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="run-h" className="display text-[clamp(26px,4vw,40px)]">
            The run
          </h2>
          <p className="text-sm text-ink-3">
            One square a day to {longDate(examDate)}. Filled by drills completed.
          </p>
        </div>

        <div className="mt-6 overflow-x-auto pb-1">
          {/*
            The grid is a picture of the run, so it is described rather than
            announced cell by cell — but a picture with no caption helps nobody.
            The summary below carries the same facts for anyone not looking at
            it: days logged, days elapsed, and what is left.
          */}
          <RunBoard
            run={run}
            drills={drillDefs.length}
            today={today}
            leadingBlanks={leadingBlanks}
            label={`${logged} of ${elapsed} days logged, one square a day from ${longDate(run[0]?.day ?? today)} to ${longDate(examDate)}`}
          />
        </div>

        <div className="mt-4 flex items-center gap-3 text-xs text-ink-3">
          <span>Nothing</span>
          {[0, 1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className="size-[13px]"
              style={{
                background:
                  n > 0
                    ? `color-mix(in oklab, var(--ink) ${Math.round((n / 4) * 100)}%, var(--paper-3))`
                    : "var(--paper-3)",
              }}
            />
          ))}
          <span>All {drillDefs.length}</span>
        </div>

        <p className="mt-4 max-w-[70ch] text-sm text-ink-2">
          {logged} of {elapsed} days logged since {longDate(run[0]?.day ?? today)} — {summary.done}{" "}
          of {drillDefs.length} drills done today.
        </p>
      </section>
    </main>
  );
}
