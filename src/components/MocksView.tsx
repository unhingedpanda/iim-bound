import { addMock, deleteMock, setMockReviewed } from "@/app/actions";
import MockChart, { type ChartPoint } from "@/components/MockChart";
import {
  attemptDiagnosis,
  estimatePercentile,
  MARK_CORRECT,
  netScore,
  PAPER,
  scoreForPercentile,
  summarise,
  TOTAL_MARKS,
} from "@/lib/cat";
import type { Mock } from "@/lib/data";
import { daysBetween, shortDate, todayISO } from "@/lib/dates";
import { mockCadence, SECTIONS, type Section } from "@/lib/plan";

const FIELD =
  "w-full border-0 border-b-2 border-line bg-transparent py-2 text-base text-ink outline-none focus:border-ink";

function pct(n: number | null) {
  return n === null ? "—" : n.toFixed(2);
}

/** Averages the last few mocks per section, then reads the same diagnosis off them. */
function sectionForm(mocks: Mock[], section: Section) {
  const key = section.toLowerCase() as "varc" | "dilr" | "qa";
  const rows = mocks
    .slice(-3)
    .map((m) => ({ a: m[`${key}_attempted`], c: m[`${key}_correct`] }))
    .filter((r): r is { a: number; c: number } => r.a !== null && r.c !== null);

  if (!rows.length) return null;

  const attempted = rows.reduce((s, r) => s + r.a, 0) / rows.length;
  const correct = rows.reduce((s, r) => s + r.c, 0) / rows.length;
  const net = netScore(attempted, correct);

  return {
    section,
    mocks: rows.length,
    attempted,
    correct,
    net,
    accuracy: attempted > 0 ? correct / attempted : 0,
    percentile: estimatePercentile(section, net),
    diagnosis: attemptDiagnosis(section, attempted, correct),
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
  const today = todayISO();
  const latest = mocks.length ? mocks[mocks.length - 1] : null;
  const latestSummary = latest ? summarise(latest) : null;

  const unreviewed = mocks.filter((m) => !m.reviewed);
  const oldestUnreviewed = unreviewed[0];

  const cadence = mockCadence(daysLeft);
  const lastWeek = mocks.filter((m) => daysBetween(m.taken_on, today) < 7).length;

  const points: ChartPoint[] = mocks
    .map((m) => ({ mock: m, summary: summarise(m) }))
    .filter(({ summary }) => summary.percentile !== null)
    .map(({ mock, summary }) => ({
      id: mock.id,
      taken_on: mock.taken_on,
      series: mock.series,
      percentile: summary.percentile as number,
      estimated: summary.estimated,
    }));

  const form = SECTIONS.map((s) => sectionForm(mocks, s)).filter((s) => s !== null);

  // The gap, in the only unit you can act on: questions.
  const targetMarks = scoreForPercentile("OVERALL", targetPercentile);
  const gap =
    latestSummary?.net != null && targetMarks != null ? targetMarks - latestSummary.net : null;

  return (
    <main className="pb-10">
      {/* ------------------------------------------------------------ hero */}
      <section className="rule-heavy mt-8 pt-5">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <h1 className="display min-w-0 text-[clamp(40px,8vw,88px)]">
            {latestSummary?.net ?? "—"}
            <span className="text-ink-3">/{TOTAL_MARKS}</span>
            <span className="mt-3 block text-base font-semibold leading-tight tracking-normal sm:text-lg text-ink-2">
              net marks{latest ? ` · ${latest.series}` : " · no mock logged yet"}
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
                {gap != null ? (
                  <p className="mt-4 border-l-4 border-signal py-1 pl-4">
                    {gap > 0 ? (
                      <>
                        <span className="font-bold">{gap.toFixed(1)} marks</span> short of{" "}
                        {targetPercentile}. That is {Math.ceil(gap / MARK_CORRECT)} more correct
                        answer
                        {Math.ceil(gap / MARK_CORRECT) === 1 ? "" : "s"} across the whole paper.
                      </>
                    ) : (
                      <>
                        Past {targetPercentile} on this one, by{" "}
                        <span className="font-bold">{Math.abs(gap).toFixed(1)} marks</span>. Now do
                        it twice more.
                      </>
                    )}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-lg text-ink-2">
                Log a mock by what you actually did — questions attempted and questions right, per
                section. Net score, accuracy and an estimated percentile come out of that, so a past
                paper counts just as much as a paid series.
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
            — the oldest sat {daysBetween(oldestUnreviewed.taken_on, today)} days ago. Sitting a
            mock costs two hours; skipping the review wastes them.
          </p>
        ) : null}
      </section>

      {/* --------------------------------------------------------- cadence */}
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

      {/* --------------------------------------------------- section board */}
      {form.length ? (
        <section className="mt-14" aria-labelledby="form-h">
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
            <h2 id="form-h" className="display text-[clamp(24px,4vw,36px)]">
              Where the marks go
            </h2>
            <p className="text-sm text-ink-2">averaged over your last {form[0]?.mocks} mocks</p>
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
      <section className="mt-16" aria-labelledby="trace-h">
        <h2 id="trace-h" className="text-sm text-ink-3">
          Overall percentile over time
        </h2>
        <div className="mt-3 overflow-x-auto">
          <MockChart points={points} target={targetPercentile} floor={sectionFloor} />
        </div>
      </section>

      {/* ------------------------------------------------------------- log */}
      <section className="mt-16" aria-labelledby="log-h">
        <h2 id="log-h" className="display border-b-2 border-ink pb-3 text-[clamp(24px,4vw,36px)]">
          The log
        </h2>
        <p className="mt-3 text-sm text-ink-3">
          Each section reads correct of attempted, then net marks, then the percentile that score
          was worth.
        </p>

        {mocks.length === 0 ? (
          <p className="py-6 text-ink-2">Nothing logged yet.</p>
        ) : (
          <ul>
            {[...mocks].reverse().map((mock) => {
              const s = summarise(mock);
              return (
                <li key={mock.id} className="border-b border-line py-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                    <h3 className="flex flex-wrap items-baseline gap-3">
                      <span className="display text-xl">{mock.series}</span>
                      <span className="text-sm text-ink-3">{shortDate(mock.taken_on)}</span>
                      {mock.reviewed ? null : (
                        <span className="border-2 border-flag px-2 py-0.5 text-[11px] font-bold text-flag">
                          unanalysed
                        </span>
                      )}
                    </h3>
                    <p className="flex items-baseline gap-2">
                      <span className="display text-2xl">{s.net ?? "—"}</span>
                      <span className="text-sm text-ink-3">net</span>
                      <span className="display ml-3 text-2xl">{pct(s.percentile)}</span>
                      <span className="text-sm text-ink-3">{s.estimated ? "est." : "%ile"}</span>
                    </p>
                  </div>

                  <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                    {s.sections.map((sec) => {
                      const low = sec.percentile !== null && sec.percentile < sectionFloor;
                      return (
                        <li
                          key={sec.section}
                          className="flex items-baseline justify-between gap-3 bg-paper-2 px-3 py-2 text-sm"
                        >
                          <span className="font-bold">{sec.section}</span>
                          <span className="text-ink-2">
                            {sec.attempted === null
                              ? "—"
                              : `${sec.correct}/${sec.attempted} · ${sec.net} net`}
                          </span>
                          <span className={low ? "font-bold text-flag" : ""}>
                            {pct(sec.percentile)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {mock.takeaway ? (
                    <p className="mt-4 border-l-4 border-line pl-4 text-ink-2 italic">
                      {mock.takeaway}
                    </p>
                  ) : null}

                  {demo ? null : (
                    <div className="mt-4 flex flex-wrap gap-5 text-sm">
                      <form action={setMockReviewed}>
                        <input type="hidden" name="id" value={mock.id} />
                        <input type="hidden" name="reviewed" value={String(!mock.reviewed)} />
                        <button
                          type="submit"
                          className={`underline underline-offset-4 ${
                            mock.reviewed ? "text-ink-3" : "font-semibold text-flag"
                          }`}
                        >
                          {mock.reviewed ? "Mark unanalysed" : "Mark analysed"}
                        </button>
                      </form>
                      <form action={deleteMock}>
                        <input type="hidden" name="id" value={mock.id} />
                        <button type="submit" className="text-ink-3 underline underline-offset-4">
                          Remove
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------- add a mock */}
      <section className="rule-heavy mt-16 pt-5" aria-labelledby="add-h">
        <h2 id="add-h" className="display text-[clamp(24px,4vw,36px)]">
          Add a mock
        </h2>
        <p className="mt-2 max-w-[60ch] text-ink-2">
          Attempts and correct answers are what you need; the percentile column is optional and only
          for a series that reports one.
        </p>

        <form action={demo ? undefined : addMock} className="mt-8">
          <fieldset disabled={demo} className="grid gap-8">
            <div className="grid gap-6 sm:grid-cols-2 lg:max-w-[640px]">
              <label className="grid gap-1 text-sm text-ink-2">
                Date
                <input
                  type="date"
                  name="taken_on"
                  defaultValue={today}
                  required
                  className={FIELD}
                />
              </label>
              <label className="grid gap-1 text-sm text-ink-2">
                Which mock
                <input
                  type="text"
                  name="series"
                  required
                  placeholder="SimCAT 5"
                  className={FIELD}
                />
              </label>
            </div>

            <div>
              <div className="hidden grid-cols-[80px_1fr_1fr_1fr] gap-4 border-b-2 border-ink pb-2 text-sm text-ink-3 sm:grid">
                <span />
                <span>Attempted</span>
                <span>Correct</span>
                <span>Percentile, if reported</span>
              </div>
              {SECTIONS.map((section) => {
                const key = section.toLowerCase();
                return (
                  <div
                    key={section}
                    className="grid items-end gap-x-4 gap-y-3 border-b border-line py-4 sm:grid-cols-[80px_1fr_1fr_1fr]"
                  >
                    <span className="display text-xl">{section}</span>
                    <label className="grid gap-1 text-xs text-ink-3">
                      <span className="sm:hidden">Attempted</span>
                      <input
                        type="number"
                        name={`${key}_attempted`}
                        min={0}
                        max={PAPER[section].questions}
                        placeholder={`of ${PAPER[section].questions}`}
                        className={FIELD}
                      />
                    </label>
                    <label className="grid gap-1 text-xs text-ink-3">
                      <span className="sm:hidden">Correct</span>
                      <input
                        type="number"
                        name={`${key}_correct`}
                        min={0}
                        max={PAPER[section].questions}
                        className={FIELD}
                      />
                    </label>
                    <label className="grid gap-1 text-xs text-ink-3">
                      <span className="sm:hidden">Percentile, if reported</span>
                      <input
                        type="number"
                        name={key}
                        min={0}
                        max={100}
                        step="0.01"
                        placeholder="optional"
                        className={FIELD}
                      />
                    </label>
                  </div>
                );
              })}
              <div className="grid items-end gap-x-4 gap-y-3 py-4 sm:grid-cols-[80px_1fr_1fr_1fr]">
                <span className="text-sm font-bold">Overall</span>
                <span className="hidden sm:block" />
                <span className="hidden sm:block" />
                <label className="grid gap-1 text-xs text-ink-3">
                  <span className="sm:hidden">Overall percentile, if reported</span>
                  <input
                    type="number"
                    name="overall"
                    min={0}
                    max={100}
                    step="0.01"
                    placeholder="optional"
                    className={FIELD}
                  />
                </label>
              </div>
            </div>

            <label className="grid gap-1 text-sm text-ink-2 lg:max-w-[640px]">
              The one thing to do differently next time
              <input
                type="text"
                name="takeaway"
                maxLength={300}
                placeholder="Choose the DILR set for three minutes before committing"
                className={FIELD}
              />
            </label>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="reviewed" className="size-4 accent-[var(--signal)]" />
                Already analysed in full
              </label>
              <button
                type="submit"
                className="bg-ink px-6 py-3 font-semibold text-paper disabled:opacity-40"
              >
                Add mock
              </button>
            </div>
          </fieldset>
        </form>
      </section>
    </main>
  );
}
