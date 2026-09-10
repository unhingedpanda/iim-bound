/**
 * The CAT exam itself: pattern, marking, and the score-to-percentile curves.
 *
 * None of this is user-editable — it is the exam, not a preference. The curves
 * are CAT 2025's published score-vs-percentile data (IIM Kozhikode's results,
 * as tabulated by Cracku), which is the closest thing to ground truth for
 * turning a raw mock score into a percentile you can compare against a cutoff.
 * CAT scales scores across three slots, so treat any estimate as ±1 percentile.
 */

import type { Section } from "@/lib/plan";

export const PAPER: Record<Section, { questions: number; minutes: number }> = {
  VARC: { questions: 24, minutes: 40 },
  DILR: { questions: 22, minutes: 40 },
  QA: { questions: 22, minutes: 40 },
};

export const MARK_CORRECT = 3;
export const MARK_WRONG = -1;

export const TOTAL_MARKS =
  (PAPER.VARC.questions + PAPER.DILR.questions + PAPER.QA.questions) * MARK_CORRECT; // 204

/**
 * The most a paper could score over `sections` sections, so a partly-logged
 * mock is shown against the right ceiling. A VARC-only row out of 204 reads as
 * a bad paper rather than a sectional test.
 */
export function paperMarks(sections: number): number {
  const ordered = (Object.keys(PAPER) as Section[]).slice(0, Math.max(0, Math.min(3, sections)));
  return ordered.reduce((sum, s) => sum + PAPER[s].questions * MARK_CORRECT, 0);
}

/** [score, percentile] anchors, ascending. CAT 2025 actuals. */
type Anchor = [number, number];

const CURVES: Record<Section | "OVERALL", Anchor[]> = {
  VARC: [
    [11, 60],
    [19, 80],
    [22, 85],
    [26, 90],
    [32.5, 95],
    [44, 99],
    [48, 99.5],
    [53, 99.9],
  ],
  DILR: [
    [8.5, 70],
    [11.5, 80],
    [14, 85],
    [16.7, 90],
    [21.5, 95],
    [29.8, 99],
    [33, 99.5],
    [38, 99.9],
  ],
  QA: [
    [7.1, 70],
    [10, 80],
    [12, 85],
    [15, 90],
    [18.5, 95],
    [27.3, 99],
    [31.2, 99.5],
    [37, 99.9],
  ],
  OVERALL: [
    [38, 80],
    [44.2, 85],
    [51.5, 90],
    [62.3, 95],
    [76, 98],
    [84.8, 99],
    [93, 99.5],
    [111.48, 99.9],
    [118.37, 99.95],
    [132.79, 99.99],
  ],
};

/** Net marks from an attempt count and a correct count. */
export function netScore(attempted: number, correct: number): number {
  const wrong = Math.max(0, attempted - correct);
  return correct * MARK_CORRECT + wrong * MARK_WRONG;
}

export function accuracy(attempted: number, correct: number): number | null {
  return attempted > 0 ? correct / attempted : null;
}

/**
 * Percentiles are cut off at this score. Anyone past it is off the end of the
 * published data, so the estimate stops pretending to a decimal place it does
 * not have.
 */
export const TOP_ANCHOR = 99.9;

/**
 * Where an estimate comes from, so the interface can say.
 *
 * The old version reported one number for every input and left the reader to
 * assume the curve covered it. It did not: below the lowest anchor it ran a
 * straight line through the origin, which has no support in the data, and
 * above the highest it clamped — so a VARC net of 56 marks, higher than the
 * top anchor of 53, came back as a confident "99.9".
 */
export type Estimate = {
  percentile: number;
  basis: "curve" | "below" | "ceiling";
};

export function estimate(scope: Section | "OVERALL", score: number): Estimate | null {
  if (!Number.isFinite(score)) return null;
  const curve = CURVES[scope];
  const first = curve[0];
  const last = curve[curve.length - 1];

  if (score <= 0) return { percentile: 0, basis: "below" };
  // Above the top anchor the honest answer is "at least this, and we stop
  // guessing" — not a fourth decimal place invented from nothing.
  if (score >= last[0]) return { percentile: last[1], basis: "ceiling" };
  if (score <= first[0]) {
    return { percentile: round2((score / first[0]) * first[1]), basis: "below" };
  }

  for (let i = 1; i < curve.length; i += 1) {
    const [x0, y0] = curve[i - 1];
    const [x1, y1] = curve[i];
    if (score <= x1) {
      return { percentile: round2(y0 + ((score - x0) / (x1 - x0)) * (y1 - y0)), basis: "curve" };
    }
  }
  return { percentile: last[1], basis: "ceiling" };
}

/** Just the number, for callers that only need the figure. */
export function estimatePercentile(scope: Section | "OVERALL", score: number): number | null {
  return estimate(scope, score)?.percentile ?? null;
}

/** The raw score a given percentile took, so a target can be shown in marks. */
export function scoreForPercentile(scope: Section | "OVERALL", percentile: number): number | null {
  const curve = CURVES[scope];
  if (percentile <= 0) return 0;
  if (percentile >= curve[curve.length - 1][1]) return curve[curve.length - 1][0];
  if (percentile <= curve[0][1]) return round2((percentile / curve[0][1]) * curve[0][0]);

  for (let i = 1; i < curve.length; i += 1) {
    const [x0, y0] = curve[i - 1];
    const [x1, y1] = curve[i];
    if (percentile <= y1) {
      return round2(x0 + ((percentile - y0) / (y1 - y0)) * (x1 - x0));
    }
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Net questions the curve says a given percentile took in a section — marks
 * divided by three. A far more useful yardstick than "attempt everything".
 *
 * These used to be hardcoded from a different source's *expected* table
 * (VARC 15 / DILR 13 / QA 12) while the curves above are *actual* CAT 2025
 * results — DILR 99 was 29.8 marks = 9.9 net questions, so no DILR user could
 * ever reach "At the bar". The targets are now derived from the same curves
 * the percentiles come from, so the two can never disagree again.
 */
export function targetNetQuestions(section: Section, percentile: number): number {
  const p = Number.isFinite(percentile) ? percentile : 99;
  const marks = scoreForPercentile(section, p) ?? 0;
  // Kept unrounded: rounding here would push the bar a fraction above the
  // true mark and turn an exact-99 paper into "0 short — attempt two more".
  return marks / MARK_CORRECT;
}

/** The defaults, at 99 — kept as a named alias; behaviour reads the function. */
export const NET_QUESTIONS_AT_99: Record<Section, number> = {
  VARC: targetNetQuestions("VARC", 99),
  DILR: targetNetQuestions("DILR", 99),
  QA: targetNetQuestions("QA", 99),
};

/** Where a shortfall in each section usually comes from. */
const SECTION_NOTE: Record<Section, string> = {
  VARC: "In VARC that is nearly always passage choice — the two you pick decide the section.",
  DILR: "In DILR it is set choice. Three minutes reading all four beats diving into the first.",
  QA: "In QA it is a handful of topics doing the damage. The syllabus page will name them.",
};

/**
 * The classic mock diagnosis. Volume and accuracy pull against each other and
 * the fix is opposite depending on which way you are off balance, so the two
 * are read together rather than one at a time.
 */
export function attemptDiagnosis(
  section: Section,
  attempted: number,
  correct: number,
  targetPercentile = 99,
): { verdict: string; fix: string } | null {
  const acc = accuracy(attempted, correct);
  if (acc === null) return null;

  const target = targetNetQuestions(section, targetPercentile);
  const aim = Number.isFinite(targetPercentile) ? targetPercentile : 99;
  const shown = Math.round(target * 10) / 10;
  const netQ = netScore(attempted, correct) / MARK_CORRECT;
  const short = Math.max(0, Math.round((target - netQ) * 10) / 10);
  const precise = acc >= 0.8;
  const enough = netQ >= target;
  const pc = Math.round(acc * 100);

  if (precise && enough) {
    return {
      verdict: "At the bar",
      fix: `${pc}% accuracy and ${netQ.toFixed(1)} net questions — a ${aim} percentile ${section} paper. Hold it for three more mocks before changing anything.`,
    };
  }
  if (precise && !enough) {
    return {
      verdict: "Too cautious",
      fix: `${pc}% of what you touch is right, so accuracy is not the problem — you are ${short} net questions short of the ${shown} a ${aim} takes. Attempt two more and watch whether it holds.`,
    };
  }
  if (!precise && enough) {
    return {
      verdict: "Paying for volume",
      fix: `You clear ${shown} net questions, but at ${pc}% accuracy. Every wrong answer costs a mark and the minutes that bought it — the same score is available from fewer attempts.`,
    };
  }
  if (acc < 0.65) {
    return {
      verdict: "Selection, not knowledge",
      fix: `${pc}% across ${attempted.toFixed(0)} attempts, ${short} net questions short. A choosing problem before a studying one. ${SECTION_NOTE[section]}`,
    };
  }
  return {
    verdict: "Short on both",
    fix: `${pc}% accuracy, ${short} net questions off ${shown}. Accuracy first: past 80% is worth more than two extra attempts. ${SECTION_NOTE[section]}`,
  };
}

/* ------------------------------------------------------- summarising a mock */

export type MockScores = {
  varc_attempted: number | null;
  varc_correct: number | null;
  dilr_attempted: number | null;
  dilr_correct: number | null;
  qa_attempted: number | null;
  qa_correct: number | null;
  varc: number | null;
  dilr: number | null;
  qa: number | null;
  overall: number | null;
};

export type SectionSummary = {
  section: Section;
  attempted: number | null;
  correct: number | null;
  net: number | null;
  accuracy: number | null;
  /** Reported by the series where you have it, estimated from the score if not. */
  percentile: number | null;
  estimated: boolean;
  /** Where an estimated figure came from; null when the series reported one. */
  basis: Estimate["basis"] | null;
};

export type MockSummary = {
  sections: SectionSummary[];
  /** Net marks, over whatever sections were filled in. Null when none were. */
  net: number | null;
  /** How many sections carry attempts and corrects — 0 to 3. */
  sectionsLogged: number;
  /** True when every section has a score, so `net` is a whole paper. */
  complete: boolean;
  percentile: number | null;
  estimated: boolean;
  /** Where the estimate came from, or null when nothing was estimated. */
  basis: Estimate["basis"] | null;
  /** True once there is enough in the row to say anything about the mock. */
  scored: boolean;
};

const FIELDS = {
  VARC: ["varc_attempted", "varc_correct", "varc"],
  DILR: ["dilr_attempted", "dilr_correct", "dilr"],
  QA: ["qa_attempted", "qa_correct", "qa"],
} as const;

/**
 * What a mock row says, including the half-filled ones.
 *
 * A partly-logged mock used to summarise to nothing at all: `net` was only
 * computed when all three sections were present, which meant a sectional test
 * or a paper you abandoned showed as "no mock logged yet" in the hero while
 * sitting in the log below it. A section you did log is a section you can
 * learn from, so the totals now cover what was entered and `complete` says
 * whether it was a whole paper. The one figure that stays whole-paper-only is
 * the overall percentile, because the overall curve is a whole-paper curve.
 */
export function summarise(m: MockScores): MockSummary {
  const sections: SectionSummary[] = (Object.keys(FIELDS) as Section[]).map((section) => {
    const [aKey, cKey, pKey] = FIELDS[section];
    const attempted = m[aKey];
    const correct = m[cKey];
    const reported = m[pKey];
    const hasScore = attempted !== null && correct !== null;
    const net = hasScore ? netScore(attempted, correct) : null;
    const derived = net === null ? null : estimate(section, net);

    return {
      section,
      attempted,
      correct,
      net,
      accuracy: hasScore ? accuracy(attempted, correct) : null,
      percentile: reported ?? derived?.percentile ?? null,
      estimated: reported === null && derived !== null,
      basis: reported === null ? (derived?.basis ?? null) : null,
    };
  });

  const scored = sections.filter((s) => s.net !== null);
  const net = scored.length ? scored.reduce((sum, s) => sum + (s.net ?? 0), 0) : null;
  const complete = scored.length === sections.length;

  // The overall curve is calibrated against a whole paper, so a partial net
  // would be compared to the wrong scale. Fall back to the section percentiles
  // that were actually computed instead of inventing an overall one.
  const overall =
    m.overall !== null
      ? { percentile: m.overall, basis: "curve" as const }
      : complete && net !== null
        ? estimate("OVERALL", net)
        : null;

  return {
    sections,
    net,
    sectionsLogged: scored.length,
    complete,
    percentile: overall?.percentile ?? null,
    estimated: m.overall === null && overall !== null,
    basis: m.overall === null ? (overall?.basis ?? null) : null,
    scored: net !== null || m.overall !== null,
  };
}
