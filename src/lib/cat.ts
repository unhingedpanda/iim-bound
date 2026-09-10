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

export const TOTAL_QUESTIONS = 68;
export const TOTAL_MARKS = TOTAL_QUESTIONS * MARK_CORRECT; // 204

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
 * Linear interpolation between published anchors. Below the lowest anchor it
 * runs a straight line down to zero; above the highest it flattens, because
 * nobody needs a fourth decimal place above 99.9.
 */
export function estimatePercentile(scope: Section | "OVERALL", score: number): number | null {
  if (!Number.isFinite(score)) return null;
  const curve = CURVES[scope];
  const first = curve[0];
  const last = curve[curve.length - 1];

  if (score <= 0) return 0;
  if (score <= first[0]) return round2((score / first[0]) * first[1]);
  if (score >= last[0]) return last[1];

  for (let i = 1; i < curve.length; i += 1) {
    const [x0, y0] = curve[i - 1];
    const [x1, y1] = curve[i];
    if (score <= x1) {
      return round2(y0 + ((score - x0) / (x1 - x0)) * (y1 - y0));
    }
  }
  return last[1];
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
};

export type MockSummary = {
  sections: SectionSummary[];
  net: number | null;
  percentile: number | null;
  estimated: boolean;
  /** True once there is enough in the row to say anything about the mock. */
  scored: boolean;
};

const FIELDS = {
  VARC: ["varc_attempted", "varc_correct", "varc"],
  DILR: ["dilr_attempted", "dilr_correct", "dilr"],
  QA: ["qa_attempted", "qa_correct", "qa"],
} as const;

export function summarise(m: MockScores): MockSummary {
  const sections: SectionSummary[] = (Object.keys(FIELDS) as Section[]).map((section) => {
    const [aKey, cKey, pKey] = FIELDS[section];
    const attempted = m[aKey];
    const correct = m[cKey];
    const reported = m[pKey];
    const hasScore = attempted !== null && correct !== null;
    const net = hasScore ? netScore(attempted, correct) : null;

    return {
      section,
      attempted,
      correct,
      net,
      accuracy: hasScore ? accuracy(attempted, correct) : null,
      percentile: reported ?? (net === null ? null : estimatePercentile(section, net)),
      estimated: reported === null && net !== null,
    };
  });

  const nets = sections.map((s) => s.net).filter((n): n is number => n !== null);
  const net = nets.length === 3 ? nets.reduce((a, b) => a + b, 0) : null;

  return {
    sections,
    net,
    percentile: m.overall ?? (net === null ? null : estimatePercentile("OVERALL", net)),
    estimated: m.overall === null && net !== null,
    scored: net !== null || m.overall !== null,
  };
}
