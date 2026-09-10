/**
 * CAT is fixed: three sections, one exam, percentile cutoffs. What a person
 * asks of themselves is not — drills, targets and thresholds are per-user rows.
 * This file holds the CAT constants and the defaults a new account starts on.
 */

export type Drill = {
  id: string;
  slug: string;
  label: string;
  blurb: string | null;
  target_minutes: number;
  sort: number;
};

/** What a new account is seeded with. Editable from Settings afterwards. */
export const DEFAULT_DRILLS: Array<Omit<Drill, "id">> = [
  { slug: "qa", label: "Quant", blurb: "One topic, worked by hand", target_minutes: 45, sort: 10 },
  {
    slug: "dilr",
    label: "DILR",
    blurb: "Two sets, timed once you can crack them",
    target_minutes: 40,
    sort: 20,
  },
  {
    slug: "varc",
    label: "Reading comp",
    blurb: "Two passages, options dissected",
    target_minutes: 30,
    sort: 30,
  },
  {
    slug: "read",
    label: "Reading",
    blurb: "Something dense that isn't prep",
    target_minutes: 30,
    sort: 40,
  },
];

export const DEFAULTS = {
  streakThreshold: 3,
  sectionFloor: 85,
  targetPercentile: 99,
  examDate: "2026-11-29",
};

export function dailyTarget(drills: Pick<Drill, "target_minutes">[]) {
  return drills.reduce((sum, d) => sum + d.target_minutes, 0);
}

/**
 * The sort values for a list in its new order: 10, 20, 30 …
 *
 * Reordering used to swap the `sort` of two adjacent rows, which is a no-op
 * when they are tied — the button appeared to do nothing and the list stayed
 * put. Renumbering the whole list cannot fail that way, and it heals any tie
 * it finds: after one click the values are distinct again.
 */
export const SORT_STEP = 10;

export function nextSorts(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * SORT_STEP);
}

/** CAT's own structure — not user-editable. */
export const SECTIONS = ["VARC", "DILR", "QA"] as const;
export type Section = (typeof SECTIONS)[number];

/**
 * The causes CAT analysis guides separate out. They matter because the fix is
 * different for each: only the first one is solved by studying more.
 * Single source: the error log UI and the addMistake allow-list both read
 * this, so a new cause can't be added to one and silently dropped by the other.
 */
export const MISTAKE_CAUSES = [
  { key: "concept", label: "Concept", fix: "You did not know it. Studying is the fix." },
  { key: "careless", label: "Careless", fix: "You knew it and slipped. Studying will not help." },
  { key: "misread", label: "Misread", fix: "You solved a question the paper did not ask." },
  { key: "time", label: "Time", fix: "You knew it and ran out. A pacing problem." },
  { key: "selection", label: "Selection", fix: "You attempted one you should have skipped." },
  { key: "missed", label: "Missed easy", fix: "You skipped one you could have solved." },
] as const;

/**
 * How well you know a syllabus topic, as a rating you set by hand.
 *
 * `value` is carried on each level rather than inferred from array position.
 * The previous version was a bare array of labels and the UI used the map index
 * as the value, which is how a fourth label — "Automatic" — ended up meaning
 * "rating 3", ranked above "Solid" and counted towards a "topics solid or
 * better" total. Nothing computes a topic's coverage; you rate it, or you have
 * not rated it yet, and the default already means the latter. So the model is
 * three levels and the zero state is honestly named.
 *
 * 0 doubles as "no row yet", which is why it needs no seed and no backfill:
 * an untouched topic and a stored 0 are the same fact.
 */
export const COVERAGE = [
  { label: "Untouched", value: 0 },
  { label: "Shaky", value: 1 },
  { label: "Solid", value: 2 },
] as const;

export type Coverage = (typeof COVERAGE)[number]["value"];

/** Everything at or above this counts towards the syllabus total. */
export const COVERAGE_SOLID: Coverage = 2;

/**
 * A stored confidence, as a level this build understands.
 *
 * An early build shipped a fourth button that wrote 3, so a database may hold
 * it. 3 was displayed as "Solid" already, so reading it as 2 is what those
 * readers were seeing anyway — the label and the count agree afterwards, which
 * they did not before.
 */
export function coverage(stored: number | null | undefined): Coverage {
  return stored === 1 ? 1 : stored && stored >= COVERAGE_SOLID ? 2 : 0;
}

export type Phase = { from: string; to: string; title: string; detail: string };

/** Guidance for the CAT 2026 cycle, shown on Today. */
export const PHASES: Phase[] = [
  {
    from: "2026-09-01",
    to: "2026-10-20",
    title: "Fundamentals",
    detail:
      "Quant rebuilt in order. DILR every day, untimed until you can crack sets. Two passages daily. Sectional mocks only.",
  },
  {
    from: "2026-10-21",
    to: "2026-11-15",
    title: "Application",
    detail:
      "Two full mocks a week, each reviewed for as long as it took to sit. Fix the three leaks that keep recurring.",
  },
  {
    from: "2026-11-16",
    to: "2026-11-25",
    title: "Race pace",
    detail: "Three mocks a week in the real time slot. No new topics from here.",
  },
  {
    from: "2026-11-26",
    to: "2026-11-28",
    title: "Taper",
    detail: "Notes and the formula sheet. Nothing new, no late mock.",
  },
];

export function phaseFor(day: string): Phase | null {
  return PHASES.find((p) => day >= p.from && day <= p.to) ?? null;
}

/** Turns a label into a stable key for drill_log rows. */
export function slugify(label: string, taken: string[] = []): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "drill";
  if (!taken.includes(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * How often to sit a full mock, by how far out you are. Taken from the common
 * advice across CAT coaching guidance: roughly one a week early, two to four a
 * week through the last two months, tapering in the final fortnight so you
 * arrive rested rather than flattened.
 */
export function mockCadence(daysLeft: number): { perWeek: number; note: string } {
  if (daysLeft > 90) return { perWeek: 1, note: "One a week while you are still building topics." };
  if (daysLeft > 45)
    return { perWeek: 2, note: "Two a week, each reviewed for as long as it took to sit." };
  if (daysLeft > 14)
    return { perWeek: 3, note: "Three a week, in the slot you will actually sit CAT in." };
  if (daysLeft > 3)
    return { perWeek: 2, note: "Taper. One every two or three days, nothing new after them." };
  return { perWeek: 0, note: "No more mocks. Notes and the formula sheet only." };
}
