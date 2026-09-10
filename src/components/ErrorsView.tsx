import { addMistake, resolveMistake } from "@/app/actions";
import { shortDate } from "@/lib/dates";
import { SECTIONS } from "@/lib/plan";

/**
 * The causes CAT analysis guides separate out. They matter because the fix is
 * different for each: only the first one is solved by studying more.
 */
export const CAUSES = [
  { key: "concept", label: "Concept", fix: "You did not know it. Studying is the fix." },
  { key: "careless", label: "Careless", fix: "You knew it and slipped. Studying will not help." },
  { key: "misread", label: "Misread", fix: "You solved a question the paper did not ask." },
  { key: "time", label: "Time", fix: "You knew it and ran out. A pacing problem." },
  { key: "selection", label: "Selection", fix: "You attempted one you should have skipped." },
  { key: "missed", label: "Missed easy", fix: "You skipped one you could have solved." },
] as const;

export type MistakeRow = {
  id: string;
  section: string;
  topic: string | null;
  note: string;
  cause: string;
  resolved: boolean;
  created_at: string;
  mock_id?: string | null;
};

const FIELD =
  "w-full border-0 border-b-2 border-line bg-transparent py-2 text-base text-ink outline-none focus:border-ink";

export default function ErrorsView({
  mistakes,
  mocks = [],
  demo = false,
}: {
  mistakes: MistakeRow[];
  mocks?: Array<{ id: string; series: string; taken_on: string }>;
  demo?: boolean;
}) {
  const open = mistakes.filter((m) => !m.resolved);
  const counts = CAUSES.map((c) => ({ ...c, count: open.filter((m) => m.cause === c.key).length }));
  const worst = counts.reduce((a, b) => (b.count > a.count ? b : a), counts[0]);
  const notConcept = open.filter((m) => m.cause !== "concept").length;
  const max = Math.max(1, ...counts.map((c) => c.count));

  return (
    <main className="pb-10">
      <section className="rule-heavy mt-8 pt-5">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <h1 className="display text-[clamp(40px,8vw,88px)]">
            {open.length}
            <span className="mt-3 block text-base font-semibold leading-tight tracking-normal sm:text-lg text-ink-2">
              mistakes still open
            </span>
          </h1>
          {open.length > 0 ? (
            <p className="max-w-[46ch] text-lg">
              {notConcept > open.length / 2 ? (
                <>
                  Most of your open errors are <span className="font-bold">not knowledge gaps</span>
                  . {notConcept} of {open.length} are careless, misread, timing or selection — more
                  studying will not touch them.
                </>
              ) : (
                <>
                  Your commonest open cause is <span className="font-bold">{worst.label}</span>.{" "}
                  {worst.fix}
                </>
              )}
            </p>
          ) : (
            <p className="max-w-[46ch] text-lg text-ink-2">
              Every mistake from a mock review goes here, tagged by what actually went wrong. The
              tag is the point: four of these six are fixed by changing how you sit the paper, not
              by studying.
            </p>
          )}
        </div>

        <ul className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {counts.map((c) => (
            <li key={c.key} className="border-t-2 border-ink pt-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{c.label}</span>
                <span className="display text-3xl">{c.count}</span>
              </div>
              <div className="meter mt-2" aria-hidden="true">
                <span style={{ "--fill": c.count / max } as React.CSSProperties} />
              </div>
              <p className="mt-2 text-sm text-ink-3">{c.fix}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rule-heavy mt-16 pt-5" aria-labelledby="add-h">
        <h2 id="add-h" className="display text-[clamp(24px,4vw,36px)]">
          Log a mistake
        </h2>
        <form action={demo ? undefined : addMistake} className="mt-6">
          <fieldset disabled={demo} className="grid gap-6 lg:grid-cols-[130px_170px_1fr]">
            <label className="grid gap-1 text-sm text-ink-2">
              Section
              <select name="section" className={FIELD}>
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm text-ink-2">
              Cause
              <select name="cause" className={FIELD}>
                {CAUSES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm text-ink-2">
              What went wrong
              <input
                type="text"
                name="note"
                required
                placeholder="Assumed the ratio was of the whole, not the remainder"
                className={FIELD}
              />
            </label>

            <label className="grid gap-1 text-sm text-ink-2">
              Topic
              <input type="text" name="topic" placeholder="Ratios" className={FIELD} />
            </label>
            <label className="grid max-w-[320px] gap-1 text-sm text-ink-2">
              From which mock
              <select name="mock_id" className={FIELD} defaultValue="">
                <option value="">Not from a mock</option>
                {mocks.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.series} · {shortDate(m.taken_on)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="justify-self-start bg-ink px-6 py-3 font-semibold text-paper disabled:opacity-40"
            >
              Log it
            </button>
          </fieldset>
        </form>
      </section>

      <section className="mt-16" aria-labelledby="log-h">
        <h2 id="log-h" className="display border-b-2 border-ink pb-3 text-[clamp(24px,4vw,36px)]">
          The log
        </h2>
        <ul>
          {mistakes.length === 0 ? (
            <li className="py-6 text-ink-2">Nothing logged yet.</li>
          ) : (
            mistakes.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line py-4"
              >
                <div className="flex min-w-0 flex-wrap items-baseline gap-3">
                  <span className="w-14 shrink-0 text-sm text-ink-3">
                    {shortDate(m.created_at.slice(0, 10))}
                  </span>
                  <span className="border-2 border-ink px-2 py-0.5 text-xs font-bold">
                    {m.section}
                  </span>
                  <span className="bg-paper-2 px-2 py-0.5 text-xs text-ink-2">
                    {CAUSES.find((c) => c.key === m.cause)?.label ?? m.cause}
                  </span>
                  <span className={m.resolved ? "text-ink-3 line-through" : ""}>{m.note}</span>
                </div>
                {demo ? null : (
                  <form action={resolveMistake}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="resolved" value={String(!m.resolved)} />
                    <button
                      type="submit"
                      className="text-sm text-ink-3 underline underline-offset-4"
                    >
                      {m.resolved ? "Reopen" : "Mark fixed"}
                    </button>
                  </form>
                )}
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
