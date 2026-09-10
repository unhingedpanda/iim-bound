import { redirect } from "next/navigation";
import type { DrillState } from "@/components/DrillBoard";
import TodayView, { type RunCell } from "@/components/TodayView";
import {
  currentStreak,
  doneCount,
  getDrillRows,
  getDrills,
  getProfile,
  indexByDay,
  minutesOn,
} from "@/lib/data";
import { addDays, daysBetween, longDate, todayISO, weekdayIndex } from "@/lib/dates";
import { phaseFor } from "@/lib/plan";
import { currentUserId } from "@/lib/supabase/server";

export const metadata = { title: "Today · CAT Register" };

export default async function TodayPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/login");

  const [profile, drillDefs] = await Promise.all([getProfile(userId), getDrills(userId)]);
  const today = todayISO();
  const windowStart = profile.started_on < today ? profile.started_on : today;

  const rows = await getDrillRows(userId, windowStart, today);
  const index = indexByDay(rows);

  const drills: Record<string, DrillState> = {};
  for (const drill of drillDefs) {
    const row = index.get(today)?.get(drill.slug);
    drills[drill.slug] = { minutes: row?.minutes ?? 0, done: row?.done ?? false };
  }

  const totalDays = Math.max(1, daysBetween(windowStart, profile.exam_date));
  const run: RunCell[] = Array.from({ length: totalDays }, (_, i) => {
    const day = addDays(windowStart, i);
    return { day, done: doneCount(day, index, drillDefs) };
  });

  return (
    <TodayView
      today={today}
      dateLabel={longDate(today)}
      dayNumber={daysBetween(profile.started_on, today) + 1}
      streak={currentStreak(today, profile.started_on, index, drillDefs, profile.streak_threshold)}
      minutesToday={minutesOn(today, index)}
      phase={phaseFor(today)}
      drills={drills}
      drillDefs={drillDefs}
      run={run}
      leadingBlanks={weekdayIndex(windowStart)}
      examDate={profile.exam_date}
    />
  );
}
