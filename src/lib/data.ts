import type { MockScores } from "@/lib/cat";
import { summarise } from "@/lib/cat";
import { addDays, daysBetween, todayISO } from "@/lib/dates";
import { DEFAULT_DRILLS, DEFAULTS, type Drill } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  display_name: string | null;
  exam_date: string;
  started_on: string;
  streak_threshold: number;
  section_floor: number;
  target_percentile: number;
  theme: "system" | "light" | "dark";
};

const PROFILE_COLUMNS =
  "id, display_name, exam_date, started_on, streak_threshold, section_floor, target_percentile, theme";

export type DrillRow = {
  on_day: string;
  drill_key: string;
  minutes: number;
  done: boolean;
};

export type Mock = MockScores & {
  id: string;
  taken_on: string;
  series: string;
  takeaway: string | null;
  reviewed: boolean;
  reviewed_on: string | null;
};

const MOCK_COLUMNS =
  "id, taken_on, series, varc, dilr, qa, overall, varc_attempted, varc_correct, dilr_attempted, dilr_correct, qa_attempted, qa_correct, takeaway, reviewed, reviewed_on";

/** Reads the profile, creating it on first sign-in. */
export async function getProfile(userId: string): Promise<Profile> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (data) return data as Profile;

  // Two requests can race here on first sign-in (the page and its prefetch),
  // so creation has to be idempotent rather than check-then-insert.
  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: userId, exam_date: DEFAULTS.examDate, started_on: todayISO() },
      { onConflict: "id", ignoreDuplicates: true },
    );

  if (error) throw new Error(`Could not create your profile: ${error.message}`);

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .single();

  if (readError) throw new Error(`Could not read your profile: ${readError.message}`);
  return profile as Profile;
}

/** The user's drills, seeded with the defaults the first time. */
export async function getDrills(userId: string): Promise<Drill[]> {
  const supabase = await createClient();

  const read = async () =>
    supabase
      .from("user_drills")
      .select("id, slug, label, blurb, target_minutes, sort")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("sort");

  const { data } = await read();
  if (data?.length) return data as Drill[];

  await supabase.from("user_drills").upsert(
    DEFAULT_DRILLS.map((d) => ({ ...d, user_id: userId })),
    { onConflict: "user_id,slug", ignoreDuplicates: true },
  );

  const { data: seeded } = await read();
  return (seeded ?? []) as Drill[];
}

export async function getDrillRows(userId: string, from: string, to: string): Promise<DrillRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("drill_log")
    .select("on_day, drill_key, minutes, done")
    .eq("user_id", userId)
    .gte("on_day", from)
    .lte("on_day", to);
  return (data ?? []) as DrillRow[];
}

export type DayMap = Map<string, Map<string, DrillRow>>;

export function indexByDay(rows: DrillRow[]): DayMap {
  const map: DayMap = new Map();
  for (const row of rows) {
    if (!map.has(row.on_day)) map.set(row.on_day, new Map());
    map.get(row.on_day)?.set(row.drill_key, row);
  }
  return map;
}

export function doneCount(day: string, index: DayMap, drills: Drill[]): number {
  const entries = index.get(day);
  if (!entries) return 0;
  return drills.reduce((n, drill) => n + (entries.get(drill.slug)?.done ? 1 : 0), 0);
}

export function minutesOn(day: string, index: DayMap): number {
  const entries = index.get(day);
  if (!entries) return 0;
  let total = 0;
  for (const row of entries.values()) total += row.minutes;
  return total;
}

export function currentStreak(
  today: string,
  startedOn: string,
  index: DayMap,
  drills: Drill[],
  threshold: number,
): number {
  const needed = Math.min(threshold, drills.length);
  let streak = 0;
  let cursor = today;
  while (cursor >= startedOn && doneCount(cursor, index, drills) >= needed) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export async function getMocks(userId: string): Promise<Mock[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mocks")
    .select(MOCK_COLUMNS)
    .eq("user_id", userId)
    .order("taken_on", { ascending: true });
  return (data ?? []) as Mock[];
}

/**
 * Which section is dragging the overall down, over the last few mocks. Works
 * off the summarised percentile, so a mock logged as raw marks counts too.
 */
export function weakestSection(mocks: Mock[]): { section: string; average: number } | null {
  const recent = mocks.slice(-3);
  if (!recent.length) return null;

  const totals = new Map<string, number[]>();
  for (const mock of recent) {
    for (const s of summarise(mock).sections) {
      if (s.percentile === null) continue;
      totals.set(s.section, [...(totals.get(s.section) ?? []), s.percentile]);
    }
  }

  const averages = [...totals].map(([section, values]) => ({
    section,
    average: values.reduce((a, b) => a + b, 0) / values.length,
  }));

  if (!averages.length) return null;
  return averages.reduce((worst, s) => (s.average < worst.average ? s : worst));
}

/** Mocks sat in the last `days` days — the cadence check. */
export function mocksInLast(mocks: Mock[], today: string, days: number): number {
  const from = addDays(today, -(days - 1));
  return mocks.filter((m) => m.taken_on >= from && m.taken_on <= today).length;
}

export function daysLeft(profile: Profile): number {
  return Math.max(0, daysBetween(todayISO(), profile.exam_date));
}
