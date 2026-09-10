/**
 * Fixtures for the public demo. One file so the demo stays cheap to maintain:
 * if a screen changes shape, only this needs updating.
 */

import type { DrillState } from "@/components/DrillBoard";
import type { RunCell } from "@/components/TodayView";
import type { Mock } from "@/lib/data";
import { addDays, daysBetween, todayISO } from "@/lib/dates";
import { DEFAULT_DRILLS, type Drill } from "@/lib/plan";

export const DEMO_START_OFFSET = -27;

export function demoToday() {
  return todayISO();
}

export function demoDrillDefs(): Drill[] {
  return DEFAULT_DRILLS.map((d, i) => ({ ...d, id: `demo-drill-${i}` }));
}

export function demoDrills(): Record<string, DrillState> {
  const state: Record<string, DrillState> = {};
  demoDrillDefs().forEach((drill, i) => {
    const target = drill.target_minutes;
    const minutes = [target, target, Math.round(target * 0.6), 0][i] ?? 0;
    state[drill.slug] = { minutes, done: i < 2 };
  });
  return state;
}

/** Deterministic history so the demo looks the same for everyone. */
export function demoRun(start: string, end: string, today: string): RunCell[] {
  const total = Math.max(1, daysBetween(start, end));
  const pattern = [4, 4, 3, 4, 2, 0, 3, 4, 3, 4, 4, 1, 4, 3];
  return Array.from({ length: total }, (_, i) => {
    const day = addDays(start, i);
    return { day, done: day > today ? 0 : (pattern[i % pattern.length] ?? 0) };
  });
}

export function demoMocks(today: string): Mock[] {
  // Attempts creeping up while accuracy holds, DILR lagging the other two, and
  // the two most recent sat without series results — so the demo shows both a
  // reported percentile and an estimated one.
  const rows: Array<{
    offset: number;
    series: string;
    a: [number, number, number];
    c: [number, number, number];
    p: [number, number, number, number] | null;
    reviewed: boolean;
    takeaway: string | null;
  }> = [
    {
      offset: -28,
      series: "SimCAT 1",
      a: [14, 7, 9],
      c: [9, 3, 4],
      p: [79.5, 62.1, 63.4, 71.2],
      reviewed: true,
      takeaway: "Read all four RCs before picking. Cost me the whole section.",
    },
    {
      offset: -21,
      series: "SimCAT 2",
      a: [16, 8, 11],
      c: [11, 5, 6],
      p: [87.4, 81.9, 84.6, 90.6],
      reviewed: true,
      takeaway: "Arithmetic is fine, geometry is not. Two whole sums lost to it.",
    },
    {
      offset: -14,
      series: "SimCAT 3",
      a: [17, 9, 12],
      c: [13, 6, 8],
      p: [95.9, 87.2, 95.6, 96.5],
      reviewed: true,
      takeaway: "First set in DILR decided the section. Spend 3 minutes choosing.",
    },
    {
      offset: -7,
      series: "SimCAT 4",
      a: [16, 10, 13],
      c: [14, 7, 8],
      p: null,
      reviewed: true,
      takeaway: "Held pace in QA for the first time. Nothing abandoned halfway.",
    },
    {
      offset: -2,
      series: "CAT 2024 paper",
      a: [17, 11, 13],
      c: [15, 7, 9],
      p: null,
      reviewed: false,
      takeaway: null,
    },
  ];

  return rows.map(({ offset, series, a, c, p, reviewed, takeaway }, i) => ({
    id: `demo-${i}`,
    taken_on: addDays(today, offset),
    series,
    varc_attempted: a[0],
    varc_correct: c[0],
    dilr_attempted: a[1],
    dilr_correct: c[1],
    qa_attempted: a[2],
    qa_correct: c[2],
    varc: p?.[0] ?? null,
    dilr: p?.[1] ?? null,
    qa: p?.[2] ?? null,
    overall: p?.[3] ?? null,
    takeaway,
    reviewed,
    reviewed_on: reviewed ? addDays(today, offset + 1) : null,
  }));
}

export type DemoTopic = { id: number; section: string; name: string; confidence: number };

/** Confidence spread that looks like real, uneven progress. */
export function demoConfidence(topicId: number, section: string): number {
  const bias = section === "QA" ? 0 : section === "VARC" ? 1 : -1;
  const spread = [3, 2, 2, 1, 3, 0, 2, 1, 2, 3, 1, 0, 2, 2, 1, 3];
  return Math.max(0, Math.min(3, (spread[topicId % spread.length] ?? 1) + bias));
}

export type DemoMistake = {
  id: string;
  section: string;
  topic: string | null;
  note: string;
  cause: string;
  resolved: boolean;
  created_at: string;
};

export function demoMistakes(today: string): DemoMistake[] {
  const rows: Array<[number, string, string, string, boolean]> = [
    [-1, "DILR", "selection", "Spent 14 minutes on the tournament set before abandoning it", false],
    [
      -1,
      "QA",
      "missed",
      "Skipped two straight percentage sums that I solve in a minute at home",
      false,
    ],
    [
      -2,
      "VARC",
      "misread",
      "Answered 'the author would agree' as though it asked what was stated",
      false,
    ],
    [
      -2,
      "VARC",
      "concept",
      "Could not separate the author's view from the view being described",
      false,
    ],
    [-3, "QA", "time", "Knew the approach on the mixtures sum but ran out of clock", false],
    [-4, "DILR", "concept", "Never learned how to set up a two-condition grid properly", false],
    [
      -5,
      "QA",
      "careless",
      "Read 'not divisible' as 'divisible' and solved the wrong question",
      true,
    ],
    [-6, "QA", "careless", "Arithmetic slip in the last step, 7 × 8 as 54", true],
  ];

  return rows.map(([offset, section, cause, note, resolved], i) => ({
    id: `demo-m-${i}`,
    section,
    topic: null,
    note,
    cause,
    resolved,
    created_at: `${addDays(today, offset)}T09:00:00.000Z`,
  }));
}

/** The shared CAT syllabus, mirroring the seed in the init migration. */
export const DEMO_TOPICS = [
  { id: 1, section: "QA", name: "Percentages", sort: 10 },
  { id: 2, section: "QA", name: "Ratio and proportion", sort: 20 },
  { id: 3, section: "QA", name: "Averages and alligation", sort: 30 },
  { id: 4, section: "QA", name: "Profit, loss and discount", sort: 40 },
  { id: 5, section: "QA", name: "Simple and compound interest", sort: 50 },
  { id: 6, section: "QA", name: "Time, speed and distance", sort: 60 },
  { id: 7, section: "QA", name: "Time and work", sort: 70 },
  { id: 8, section: "QA", name: "Linear equations", sort: 80 },
  { id: 9, section: "QA", name: "Quadratic equations", sort: 90 },
  { id: 10, section: "QA", name: "Inequalities and modulus", sort: 100 },
  { id: 11, section: "QA", name: "Functions and graphs", sort: 110 },
  { id: 12, section: "QA", name: "Logarithms, indices, surds", sort: 120 },
  { id: 13, section: "QA", name: "Progressions", sort: 130 },
  { id: 14, section: "QA", name: "Number system: divisibility", sort: 140 },
  { id: 15, section: "QA", name: "Number system: remainders", sort: 150 },
  { id: 16, section: "QA", name: "Number system: factors", sort: 160 },
  { id: 17, section: "QA", name: "Geometry: triangles", sort: 170 },
  { id: 18, section: "QA", name: "Geometry: circles", sort: 180 },
  { id: 19, section: "QA", name: "Coordinate geometry", sort: 190 },
  { id: 20, section: "QA", name: "Mensuration", sort: 200 },
  { id: 21, section: "QA", name: "Permutations and combinations", sort: 210 },
  { id: 22, section: "QA", name: "Probability", sort: 220 },
  { id: 23, section: "DILR", name: "Tables and caselets", sort: 10 },
  { id: 24, section: "DILR", name: "Bar, line and pie charts", sort: 20 },
  { id: 25, section: "DILR", name: "Venn diagrams", sort: 30 },
  { id: 26, section: "DILR", name: "Arrangements: linear", sort: 40 },
  { id: 27, section: "DILR", name: "Arrangements: circular", sort: 50 },
  { id: 28, section: "DILR", name: "Matrix and grid puzzles", sort: 60 },
  { id: 29, section: "DILR", name: "Binary and conditional logic", sort: 70 },
  { id: 30, section: "DILR", name: "Games and tournaments", sort: 80 },
  { id: 31, section: "DILR", name: "Scheduling and routes", sort: 90 },
  { id: 32, section: "DILR", name: "Data sufficiency", sort: 100 },
  { id: 33, section: "DILR", name: "Quant-heavy DI sets", sort: 110 },
  { id: 34, section: "DILR", name: "Set selection under time", sort: 120 },
  { id: 35, section: "VARC", name: "Reading comprehension: main idea", sort: 10 },
  { id: 36, section: "VARC", name: "Reading comprehension: inference", sort: 20 },
  { id: 37, section: "VARC", name: "Reading comprehension: tone and attitude", sort: 30 },
  { id: 38, section: "VARC", name: "Reading comprehension: elimination technique", sort: 40 },
  { id: 39, section: "VARC", name: "Para summary", sort: 50 },
  { id: 40, section: "VARC", name: "Para jumbles", sort: 60 },
  { id: 41, section: "VARC", name: "Odd sentence out", sort: 70 },
  { id: 42, section: "VARC", name: "Critical reasoning", sort: 80 },
];
