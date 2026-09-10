import type { MockScores } from "@/lib/cat";
import { addDays, daysBetween } from "@/lib/dates";
import { today } from "@/lib/day";
import { DEFAULT_DRILLS, DEFAULTS, type Drill } from "@/lib/plan";
import { read } from "@/lib/server/writes";
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

/* ------------------------------------------------------------------ profile */

/** Reads the profile, creating it on first sign-in. */
export async function getProfile(userId: string): Promise<Profile> {
  const existing = await read<Profile | null>(
    "profile",
    (db) => db.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
    null,
  );
  if (existing) return existing;

  const supabase = await createClient();

  // Two requests can race here on first sign-in (the page and its prefetch),
  // so creation has to be idempotent rather than check-then-insert.
  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: userId, exam_date: DEFAULTS.examDate, started_on: today() },
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

/* ------------------------------------------------------------------- drills */

/**
 * The user's drills, seeded with the defaults the first time.
 *
 * Seeding returns the rows rather than reading them back. The read-back was
 * the bug behind an empty board on a brand-new account: the write landed, the
 * read that followed in the same request sometimes did not see it, and the
 * page rendered "All 0" with a 0-minute target until the next refresh. An
 * upsert whose update assigns one of its own conflict columns is a no-op for
 * rows that already exist, so this cannot overwrite a rename or a retimed
 * target — and it hands back the defaults on the way in.
 */
export async function getDrills(userId: string): Promise<Drill[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_drills")
    .select("id, slug, label, blurb, target_minutes, sort")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("sort");

  if (data?.length) return data as Drill[];

  const { data: seeded } = await supabase
    .from("user_drills")
    .upsert(
      DEFAULT_DRILLS.map((d) => ({ ...d, user_id: userId })),
      { onConflict: "user_id,slug" },
    )
    .select("id, slug, label, blurb, target_minutes, sort")
    .eq("archived", false)
    .order("sort");

  return (seeded ?? []) as Drill[];
}

export async function getDrillRows(userId: string, from: string, to: string): Promise<DrillRow[]> {
  return read<DrillRow[]>(
    "drill rows",
    (db) =>
      db
        .from("drill_log")
        .select("on_day, drill_key, minutes, done")
        .eq("user_id", userId)
        .gte("on_day", from)
        .lte("on_day", to),
    [],
  );
}

export type DayMap = Map<string, Map<string, DrillRow>>;

export function indexByDay(rows: DrillRow[]): DayMap {
  const map: DayMap = new Map();
  for (const row of rows) {
    let day = map.get(row.on_day);
    if (!day) {
      day = new Map();
      map.set(row.on_day, day);
    }
    day.set(row.drill_key, row);
  }
  return map;
}

/**
 * Today's numbers, always over the user's *current* drills.
 *
 * Minutes and completions have to be read the same way or the header lies:
 * a drill you archived keeps its logged rows forever (that is the point of
 * archiving rather than deleting), so summing the day's rows counted minutes
 * whose target had already left the denominator — "165 / 85 minutes" on a
 * screen that promised a 85-minute day. Both figures now ignore keys that are
 * no longer on the board, and the archived time stays visible on the drill
 * itself in Settings.
 */
export function daySummary(
  day: string,
  index: DayMap,
  drills: Drill[],
): { minutes: number; done: number } {
  const entries = index.get(day);
  if (!entries || !drills.length) return { minutes: 0, done: 0 };

  let minutes = 0;
  let done = 0;
  for (const drill of drills) {
    const row = entries.get(drill.slug);
    if (!row) continue;
    minutes += row.minutes;
    if (row.done) done += 1;
  }
  return { minutes, done };
}

export function doneCount(day: string, index: DayMap, drills: Drill[]): number {
  return daySummary(day, index, drills).done;
}

export function minutesOn(day: string, index: DayMap, drills: Drill[]): number {
  return daySummary(day, index, drills).minutes;
}

export function currentStreak(
  day: string,
  startedOn: string,
  index: DayMap,
  drills: Drill[],
  threshold: number,
): number {
  // No drills means no bar to clear: without this, needed is 0 and every day
  // back to started_on counts, exploding the streak the moment a user archives
  // their last drill.
  if (!drills.length) return 0;
  const needed = Math.min(threshold, drills.length);
  let streak = 0;
  let cursor = day;
  while (cursor >= startedOn && doneCount(cursor, index, drills) >= needed) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/* -------------------------------------------------------------------- mocks */

export async function getMocks(userId: string): Promise<Mock[]> {
  return read<Mock[]>(
    "mocks",
    (db) =>
      db.from("mocks").select(MOCK_COLUMNS).eq("user_id", userId).order("taken_on", {
        ascending: true,
      }),
    [],
  );
}

export function daysLeft(profile: Profile): number {
  return Math.max(0, daysBetween(today(), profile.exam_date));
}
