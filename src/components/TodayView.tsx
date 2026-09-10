import DrillBoard, { type DrillState } from "@/components/DrillBoard";
import { longDate } from "@/lib/dates";
import { type Drill, dailyTarget, type Phase } from "@/lib/plan";

export type RunCell = { day: string; done: number };

/** Stable keys for the leading weekday offset cells. */
const PAD_KEYS = ["pad-mon", "pad-tue", "pad-wed", "pad-thu", "pad-fri", "pad-sat"];

export default function TodayView({
  today,
  dateLabel,
  dayNumber,
  streak,
  minutesToday,
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
  minutesToday: number;
  phase: Phase | null;
  drills: Record<string, DrillState>;
  drillDefs: Drill[];
  run: RunCell[];
  leadingBlanks: number;
  examDate: string;
  readOnly?: boolean;
}) {
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
              <dd className="display text-[clamp(32px,6vw,60px)]">{streak}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-3">Minutes today</dt>
              <dd className="display text-[clamp(32px,6vw,60px)]">
                {minutesToday}
                {dailyTarget(drillDefs) > 0 ? (
                  <span className="text-[0.4em] text-ink-3">/{dailyTarget(drillDefs)}</span>
                ) : null}
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
          <div
            className="grid w-max grid-flow-col grid-rows-7 gap-[4px]"
            role="img"
            aria-label={`Daily completion up to ${longDate(examDate)}`}
          >
            {PAD_KEYS.slice(0, leadingBlanks).map((key) => (
              <span key={key} aria-hidden="true" className="size-[15px]" />
            ))}
            {run.map(({ day, done }) => {
              const level = done / Math.max(1, drillDefs.length);
              const future = day > today;
              return (
                <span
                  key={day}
                  title={`${day} — ${done} of ${drillDefs.length}`}
                  className="size-[15px]"
                  style={{
                    background:
                      level > 0
                        ? `color-mix(in oklab, var(--ink) ${Math.round(level * 100)}%, var(--paper-3))`
                        : "var(--paper-3)",
                    outline: day === today ? "2px solid var(--signal)" : undefined,
                    outlineOffset: day === today ? "1px" : undefined,
                    opacity: future ? 0.4 : 1,
                  }}
                />
              );
            })}
          </div>
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
      </section>
    </main>
  );
}
