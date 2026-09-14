import AddMockForm from "@/components/AddMockForm";
import MockChart, { type ChartPoint } from "@/components/MockChart";
import { MockRow } from "@/components/MockRow";
import {
  attemptDiagnosis,
  estimate,
  MARK_CORRECT,
  netScore,
  PAPER,
  paperMarks,
  scoreForPercentile,
  summarise,
  TOTAL_MARKS,
} from "@/lib/cat";
import type { Mock } from "@/lib/data";
import { daysBetween } from "@/lib/dates";
import { latestLoggableDay, today } from "@/lib/day";
import { mockCadence, SECTIONS, type Section } from "@/lib/plan";

function pct(n: number | null) {
  return n === null ? "—" : n.toFixed(2);
}

/** Says out loud when a figure is not a reading off the published curve. */
function basisNote(basis: "curve" | "below" | "ceiling" | null): string | null {
  if (basis === "ceiling") return "past the top of the published curve — treat as a floor";
  if (basis === "below") return "below the lowest published anchor — a rough floor, not a rank";
  return null;
}

/** Averages the last few mocks per section, then reads the same diagnosis off them. */
function sectionForm(mocks: Mock[], section: Section, targetPercentile: number) {
  const key = section.toLowerCase() as "varc" | "dilr" | "qa";
  const rows = mocks
    .slice(-3)
    .map((m) => ({ a: m[`${key}_attempted`], c: m[`${key}_correct`] }))
    .filter((r): r is { a: number; c: number } => r.a !== null && r.c !== null);

  if (!rows.length) return null;

  const attempted = rows.reduce((s, r) => s + r.a, 0) / rows.length;
  const correct = rows.reduce((s, r) => s + r.c, 0) / rows.length;
  const net = netScore(attempted, correct);
  const derived = estimate(section, net);

  return {
    section,
    mocks: rows.length,
    attempted,
    correct,
    net,
    accuracy: attempted > 0 ? correct / attempted : 0,
    percentile: derived?.percentile ?? null,
    basis: derived?.basis ?? null,
    diagnosis: attemptDiagnosis(section, attempted, correct, targetPercentile),
  };
}

export default function MocksView({
  mocks,
  sectionFloor,
  targetPercentile,
  daysLeft,
  demo = false,
}: {
  mocks: Mock[];
  sectionFloor: number;
  targetPercentile: number;
  daysLeft: number;
  demo?: boolean;
}) {
  const day = today();
  const latest = mocks.length ? mocks[mocks.length - 1] : null;
  const latestSummary = latest ? summarise(latest) : null;

  const unreviewed = mocks.filter((m) => !m.reviewed);
  const oldestUnreviewed = unreviewed[0];

  const cadence = mockCadence(daysLeft);
  // Defensive against pre-existing future-dated rows: only past dates count.
  const lastWeek = mocks.filter((m) => {
    const back = daysBetween(m.taken_on, day);
    return back >= 0 && back < 7;
  }).length;

  // Only whole papers belong on a whole-paper percentile chart.
  const points: ChartPoint[] = mocks
    .map((m) => ({ mock: m, summary: summarise(m) }))
    .filter(({ summary }) => summary.complete && summary.percentile !== null)
    .map(({ mock, summary }) => ({
      id: mock.id,
      taken_on: mock.taken_on,
      series: mock.series,
      percentile: summary.percentile as number,
      estimated: summary.estimated,
    }));

  const form = SECTIONS.map((s) => sectionForm(mocks, s, targetPercentile)).filter(
    (s) => s !== null,
  );

  // The gap, in the only unit you can act on: questions. Only a whole paper has
  // a net that means anything against a whole-paper target.
  const targetMarks = scoreForPercentile("OVERALL", targetPercentile);
  const gap =
    latestSummary?.complete && latestSummary.net != null && targetMarks != null
      ? targetMarks - latestSummary.net
      : null;

  return (
    <main className="pb-10">
      {/* ------------------------------------------------------------ hero */}
      {mocks.length === 0 ? (
        /* A real empty state: what this screen is for, and the one button that
           gets it going. Nothing else renders because nothing else loads. */
        <section className="rule-heavy mt-8 pt-5">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            <h1 id="mocks-empty-h" className="display text-[clamp(40px,8vw,88px)]">
              No mocks yet.
              <span className="mt-3 block text-base font-semibold leading-tight tracking-normal sm:text-lg text-ink-2">
                this is the one that tells you where you actually stand
              </span>
            </h1>
            <p className="max-w-[46ch] text-lg text-ink-2">
              Log a mock by what you actually did — questions attempted and questions right, per
              section. Net score, accuracy and an estimated percentile come out of that, so a past
              paper counts just as much as a paid series.
            </p>
          </div>
        </section>
      ) : (
        <section className="rule-heavy mt-8 pt-5">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            <h1 className="display min-w-0 text-[clamp(40px,8vw,88px)]">
              {latestSummary?.net ?? "—"}
              <span className="text-ink-3">
                /
                {latestSummary?.complete
                  ? TOTAL_MARKS
                  : paperMarks(latestSummary?.sectionsLogged ?? 0)}
              </span>
              <span className="mt-3 block text-base font-semibold leading-tight tracking-normal sm:text-lg text-ink-2">
                net marks{latest ? ` · ${latest.series}` : " · no mock logged yet"}
                {latestSummary && !latestSummary.complete && latestSummary.sectionsLogged > 0
                  ? ` · ${latestSummary.sectionsLogged} of 3 sections`
                  : ""}
              </span>
            </h1>

            <div className="max-w-[46ch]">
              {latestSummary?.percentile != null ? (
                <>
                  <p className="text-lg">
                    That is about{" "}
                    <span className="display text-[1.6em] leading-none">
                      {pct(latestSummary.percentile)}
                    </span>{" "}
                    overall.{" "}
                    {latestSummary.estimated ? (
                      <span className="text-ink-3">
                        Estimated from CAT 2025&rsquo;s published score-to-percentile data — the
                        series&rsquo; own number, once you have it, replaces this.
                      </span>
                    ) : (
                      <span className="text-ink-3">As reported by the series.</span>
                    )}
                  </p>
                  {basisNote(latestSummary.basis) ? (
                    <p className="mt-2 text-sm text-ink-3">{basisNote(latestSummary.basis)}</p>
                  ) : null}
                  {gap != null ? (
                    <p className="mt-4 border-l-4 border-signal py-1 pl-4">
                      {gap > 0.005 ? (
                        <>
                          <span className="font-bold">{gap.toFixed(1)} marks</span> short of{" "}
                          {targetPercentile}. That is {Math.ceil(gap / MARK_CORRECT)} more correct
                          answer
                          {Math.ceil(gap / MARK_CORRECT) === 1 ? "" : "s"} across the whole paper.
                        </>
                      ) : gap < -0.005 ? (
                        <>
                          Past {targetPercentile} on this one, by{" "}
                          <span className="font-bold">{Math.abs(gap).toFixed(1)} marks</span>. Now
                          do it twice more.
                        </>
                      ) : (
                        <>Right on {targetPercentile} with this one. Now do it twice more.</>
                      )}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-lg text-ink-2">
                  Log a mock by what you actually did — questions attempted and questions right, per
                  section. Net score, accuracy and an estimated percentile come out of that, so a
                  past paper counts just as much as a paid series.
                </p>
              )}
            </div>
          </div>

          {/* ------------------------------------------------- analysis debt */}
          {oldestUnreviewed ? (
            <p className="mt-8 border-l-4 border-flag bg-paper-2 px-4 py-3 text-flag">
              <span className="font-bold">
                {unreviewed.length} mock{unreviewed.length > 1 ? "s" : ""} unanalysed
              </span>{" "}
              — the oldest sat {(() => {
                const daysAgo = Math.max(0, daysBetween(oldestUnreviewed.taken_on, day));
                if (daysAgo === 0) return "today";
                return `${daysAgo} day${daysAgo > 1 ? "s" : ""} ago`;
              })()}. Sitting a mock costs two hours; skipping the review wastes them.
            </p>
          ) : null}
        </section>
      )}

      {/* --------------------------------------------------------- cadence */}
      {mocks.length ? (
        <section className="mt-12" aria-labelledby="cadence-h">
          <h2 id="cadence-h" className="text-sm text-ink-3">
            Cadence
          </h2>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t-2 border-ink pt-4">
            <p className="display text-[clamp(22px,3vw,32px)]">
              {lastWeek}
              <span className="text-ink-3"> of {cadence.perWeek}</span>
            </p>
            <p className="text-ink-2">
              mocks in the last seven days, with {daysLeft} days to go. {cadence.note}
            </p>
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------- section board */}
      {form.length ? (
        <section className="mt-14" aria-labelledby="form-h">
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
            <h2 id="form-h" className="display text-[clamp(24px,4vw,36px)]">
              Where the marks go
            </h2>
            <p className="text-sm text-ink-2">averaged over up to your last 3 mocks</p>
          </div>

          <ul className="mt-6 grid gap-x-8 gap-y-10 lg:grid-cols-3">
            {form.map((s) => {
              const low = s.percentile !== null && s.percentile < sectionFloor;
              return (
                <li key={s.section} className="border-t-2 border-ink pt-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="display text-2xl">{s.section}</h3>
                    <span className={`display text-2xl ${low ? "text-flag" : ""}`}>
                      {pct(s.percentile)}
                    </span>
                  </div>
                  {basisNote(s.basis) ? (
                    <p className="mt-1 text-xs text-ink-3">{basisNote(s.basis)}</p>
                  ) : null}

                  <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-ink-3">Attempted</dt>
                      <dd className="display text-xl">
                        {s.attempted.toFixed(1)}
                        <span className="text-ink-3">/{PAPER[s.section].questions}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">Accuracy</dt>
                      <dd className="display text-xl">{Math.round(s.accuracy * 100)}%</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">Net</dt>
                      <dd className="display text-xl">{s.net.toFixed(1)}</dd>
                    </div>
                  </dl>

                  <div className="meter mt-4" aria-hidden="true">
                    <span style={{ "--fill": s.accuracy } as React.CSSProperties} />
                  </div>

                  {s.diagnosis ? (
                    <p className="mt-4 text-sm">
                      <span className="font-bold">{s.diagnosis.verdict}.</span>{" "}
                      <span className="text-ink-2">{s.diagnosis.fix}</span>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ----------------------------------------------------------- chart */}
      {mocks.length ? (
        <section className="mt-16" aria-labelledby="trace-h">
          <h2 id="trace-h" className="text-sm text-ink-3">
            Overall percentile over time
          </h2>
          <div className="mt-3 overflow-x-auto">
            <MockChart points={points} target={targetPercentile} floor={sectionFloor} />
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------- log */}
      {mocks.length ? (
        <section className="mt-16" aria-labelledby="log-h">
          <h2 id="log-h" className="display border-b-2 border-ink pb-3 text-[clamp(24px,4vw,36px)]">
            The log
          </h2>
          <p className="mt-3 text-sm text-ink-3">
            Each section reads correct of attempted, then net marks, then the percentile that score
            was worth.
          </p>

          <ul>
            {[...mocks].reverse().map((mock) => (
              <MockRow key={mock.id} mock={mock} sectionFloor={sectionFloor} demo={demo} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------------------------------- add a mock */}
      <section className="rule-heavy mt-16 pt-5" aria-labelledby="add-h">
        <h2 id="add-h" className="display text-[clamp(24px,4vw,36px)]">
          Add a mock
        </h2>
        <p className="mt-2 max-w-[60ch] text-ink-2">
          Attempts and correct answers are what you need; the percentile column is optional and only
          for a series that reports one.
        </p>

        <AddMockForm today={latestLoggableDay()} demo={demo} />
      </section>
    </main>
  );
}
