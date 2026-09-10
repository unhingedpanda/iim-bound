import { addTopic, deleteTopic, setTopicConfidence } from "@/app/actions";
import { ActionForm } from "@/components/FormFeedback";
import { COVERAGE, COVERAGE_SOLID, coverage, SECTIONS } from "@/lib/plan";

export type Topic = {
  id: number;
  section: string;
  name: string;
  sort: number;
  user_id?: string | null;
};

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
      </section>

      {SECTIONS.map((section) => {
        const sectionTopics = topics.filter((t) => t.section === section);
        const sectionSolid = sectionTopics.filter((t) => rated(t.id) >= COVERAGE_SOLID).length;
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

            <div className="meter mt-3" aria-hidden="true">
              <span style={{ "--fill": pct / 100 } as React.CSSProperties} />
            </div>

            <ul className="mt-4">
              {sectionTopics.map((topic) => {
                const level = rated(topic.id);
                return (
                  <li
                    key={topic.id}
                    className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line py-3"
                  >
                    <span className={`flex items-center gap-3 ${level === 0 ? "text-ink-3" : ""}`}>
                      {topic.name}
                      {topic.user_id ? (
                        <span className="border border-line px-1.5 py-0.5 text-[11px] text-ink-3">
                          yours
                        </span>
                      ) : null}
                    </span>

                    <div className="flex items-center gap-3">
                      <ActionForm
                        action={setTopicConfidence}
                        className="flex flex-wrap items-center gap-1"
                      >
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
                        <ActionForm action={deleteTopic}>
                          <input type="hidden" name="id" value={topic.id} />
                          <button
                            type="submit"
                            className="text-sm text-ink-3 underline underline-offset-4"
                          >
                            Delete
                          </button>
                        </ActionForm>
                      ) : null}
                    </div>
                  </li>
                );
              })}
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
