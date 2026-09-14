"use client";

import { addTopic, deleteTopic, setTopicConfidence } from "@/app/actions";
import { ActionForm, useConfirm } from "@/components/FormFeedback";
import { COVERAGE, COVERAGE_SOLID, coverage, SECTIONS } from "@/lib/plan";

export type Topic = {
  id: number;
  section: string;
  name: string;
  sort: number;
  user_id?: string | null;
};

/** How the three ratings colour a section metre: solid, shaky, unread. */
function RatingBar({
  unrated,
  shaky,
  solid,
  total,
  ariaLabel,
}: {
  unrated: number;
  shaky: number;
  solid: number;
  total: number;
  ariaLabel: string;
}) {
  if (total === 0) return null;
  return (
    <div
      className="h-2 w-full bg-paper-3"
      role="img"
      aria-label={ariaLabel}
      style={{ display: "flex" }}
    >
      {solid ? (
        <span
          style={{ width: `${(solid / total) * 100}%`, background: "var(--ink)" }}
          aria-hidden="true"
        />
      ) : null}
      {shaky ? (
        <span
          style={{ width: `${(shaky / total) * 100}%`, background: "var(--signal)" }}
          aria-hidden="true"
        />
      ) : null}
      {unrated ? (
        <span
          style={{ width: `${(unrated / total) * 100}%`, background: "var(--line)" }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

/**
 * One syllabus topic row, with the delete button that asks once before
 * removing. Failure stays inside the form via ActionForm's error note.
 */
function TopicRow({ topic, level, demo }: { topic: Topic; level: number; demo: boolean }) {
  const confirmDelete = useConfirm();
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line py-3">
      <span className={`flex items-center gap-3 ${level === 0 ? "text-ink-3" : ""}`}>
        {topic.name}
        {topic.user_id ? (
          <span className="border border-line px-1.5 py-0.5 text-[11px] text-ink-3">yours</span>
        ) : null}
      </span>

      <div className="flex items-center gap-3">
        <ActionForm action={setTopicConfidence} className="flex flex-wrap items-center gap-1">
          <input type="hidden" name="topic_id" value={topic.id} />
          {/* The demo has no account behind it, so its controls are inert. */}
          <fieldset disabled={demo} className="contents">
            {COVERAGE.map(({ label, value }) => (
              <button
                key={label}
                type="submit"
                name="confidence"
                value={value}
                aria-pressed={level === value}
                className={`border-2 px-2.5 py-1 text-xs font-semibold transition-colors ${
                  level === value
                    ? "border-ink bg-ink text-paper"
                    : "border-line text-ink-3 hover:border-ink-3"
                }`}
              >
                {label}
              </button>
            ))}
          </fieldset>
        </ActionForm>

        {topic.user_id && !demo ? (
          confirmDelete.confirming ? (
            <>
              <span className="text-xs font-semibold text-flag">Delete?</span>
              <ActionForm action={deleteTopic}>
                <input type="hidden" name="id" value={topic.id} />
                <button
                  type="submit"
                  onClick={() => confirmDelete.cancel()}
                  className="text-sm font-semibold text-flag"
                >
                  Yes
                </button>
              </ActionForm>
              <button
                type="button"
                onClick={() => confirmDelete.cancel()}
                className="text-ink-3 underline"
              >
                Keep
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => confirmDelete.request()}
              className="text-sm text-ink-3 underline underline-offset-4"
            >
              Delete
            </button>
          )
        ) : null}
      </div>
    </li>
  );
}

export default function SyllabusView({
  topics,
  confidence,
  demo = false,
}: {
  topics: Topic[];
  /** Stored confidence by topic id. Normalised on read, never on write. */
  confidence: Map<number, number>;
  demo?: boolean;
}) {
  const rated = (topicId: number) => coverage(confidence.get(topicId));
  const solid = topics.filter((t) => rated(t.id) >= COVERAGE_SOLID).length;

  /** Whole-syllabus spread, so the metre under the headline has all three. */
  const overall = SECTIONS.reduce(
    (acc, section) => {
      const sectionTopics = topics.filter((t) => t.section === section);
      const sectionSolid = sectionTopics.filter((t) => rated(t.id) >= COVERAGE_SOLID).length;
      const sectionShaky = sectionTopics.filter((t) => rated(t.id) === 1).length;
      acc.solid += sectionSolid;
      acc.shaky += sectionShaky;
      acc.total += sectionTopics.length;
      acc.unrated += sectionTopics.length - sectionSolid - sectionShaky;
      return acc;
    },
    { unrated: 0, shaky: 0, solid: 0, total: 0 },
  );

  return (
    <main className="pb-10">
      <section className="rule-heavy mt-8 pt-5">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h1 className="display min-w-0 text-[clamp(40px,8vw,88px)]">
            {solid}
            <span className="text-ink-3">/{topics.length}</span>
            <span className="mt-3 block text-base font-semibold leading-tight tracking-normal sm:text-lg text-ink-2">
              topics solid or better
            </span>
          </h1>
          <p className="max-w-[44ch] text-ink-2">
            Rate honestly. A topic you can do slowly with the answer key open is shaky, not solid.
            Add your own topics at the bottom of any section.
          </p>
        </div>

        {/* Whole-syllabus spread: ink solid, signal shaky, blank unread. */}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-xs font-semibold text-ink-3">all sections</span>
        </div>
        <RatingBar
          unrated={overall.unrated}
          shaky={overall.shaky}
          solid={overall.solid}
          total={overall.total}
          ariaLabel={`${overall.solid} solid, ${overall.shaky} shaky, ${overall.unrated} unrated of ${overall.total}`}
        />
      </section>

      {SECTIONS.map((section) => {
        const sectionTopics = topics.filter((t) => t.section === section);
        const sectionSolid = sectionTopics.filter((t) => rated(t.id) >= COVERAGE_SOLID).length;
        const sectionShaky = sectionTopics.filter((t) => rated(t.id) === 1).length;
        const sectionUnrated = sectionTopics.length - sectionSolid - sectionShaky;
        const pct = sectionTopics.length
          ? Math.round((sectionSolid / sectionTopics.length) * 100)
          : 0;

        return (
          <section key={section} className="mt-14" aria-labelledby={`s-${section}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
              <h2 id={`s-${section}`} className="display text-[clamp(26px,4vw,40px)]">
                {section}
              </h2>
              <span className="text-sm text-ink-2">
                {sectionSolid} of {sectionTopics.length} solid · {pct}%
              </span>
            </div>

            <div className="mt-3" aria-hidden="true">
              <RatingBar
                unrated={sectionUnrated}
                shaky={sectionShaky}
                solid={sectionSolid}
                total={sectionTopics.length}
                ariaLabel={`${section}: ${sectionSolid} solid, ${sectionShaky} shaky, ${sectionUnrated} unrated`}
              />
            </div>

            <ul className="mt-4">
              {sectionTopics.map((topic) => (
                <TopicRow key={topic.id} topic={topic} level={rated(topic.id)} demo={demo} />
              ))}
            </ul>

            <ActionForm action={addTopic} className="mt-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="section" value={section} />
              <label className="grid gap-1 text-xs text-ink-3">
                Add a topic to {section}
                <input
                  name="name"
                  required
                  disabled={demo}
                  placeholder="Clocks and calendars"
                  className="w-64 max-w-full border-0 border-b-2 border-line bg-transparent py-2 text-base text-ink outline-none focus:border-ink"
                />
              </label>
              <button
                type="submit"
                disabled={demo}
                className="border-2 border-ink px-4 py-2 text-sm font-semibold disabled:opacity-40"
              >
                Add
              </button>
            </ActionForm>
          </section>
        );
      })}
    </main>
  );
}
