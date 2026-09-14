import { redirect } from "next/navigation";
import type { DrillState } from "@/components/DrillBoard";
import TodayView, { type RunCell } from "@/components/TodayView";
import {
  currentStreak,
  daySummary,
  getDrillRows,
  getDrills,
  getProfile,
  indexByDay,
} from "@/lib/data";
import { addDays, daysBetween, longDate, weekdayIndex } from "@/lib/dates";
import { daysThrough, today } from "@/lib/day";
import { phaseFor } from "@/lib/plan";
import { currentUserId } from "@/lib/supabase/server";

export const metadata = { title: "Today · IIM Bound" };

/** Seven days back, inclusive of today, for the per-drill accents. */
function weekOf(day: string): string {
  return addDays(day, -6);
}

export default async function TodayPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/login");

  const [profile, drillDefs] = await Promise.all([getProfile(userId), getDrills(userId)]);
  const day = today();

  // The run starts when it started, or today for a start date still ahead.
  const windowStart = profile.started_on < day ? profile.started_on : day;
  const index = indexByDay(await getDrillRows(userId, windowStart, day));

  const drills: Record<string, DrillState> = {};
  const drills7: Record<string, number[]> = {};
  for (const drill of drillDefs) {
    const row = index.get(day)?.get(drill.slug);
    drills[drill.slug] = { minutes: row?.minutes ?? 0, done: row?.done ?? false };

    /** Accents for the last seven days: which of them had this drill done. */
    drills7[drill.slug] = daysThrough(weekOf(day), day).map((d) => {
      const entry = index.get(d)?.get(drill.slug);
      return entry?.done ? 1 : 0;
    });
  }

  // daysThrough() is inclusive, so the grid carries a square for the exam day
  // itself — the one date the whole screen is counting down to.
  const run: RunCell[] = daysThrough(windowStart, profile.exam_date).map((d) => ({
    day: d,
    done: daySummary(d, index, drillDefs).done,
  }));

  return (
    <TodayView
      today={day}
      dateLabel={longDate(day)}
      dayNumber={Math.max(1, daysBetween(profile.started_on, day) + 1)}
      streak={currentStreak(day, profile.started_on, index, drillDefs, profile.streak_threshold)}
      summary={daySummary(day, index, drillDefs)}
      phase={phaseFor(day)}
      drills={drills}
      drills7={drills7}
      drillDefs={drillDefs}
      run={run}
      leadingBlanks={weekdayIndex(windowStart)}
      examDate={profile.exam_date}
    />
  );
}
