import TodayView from "@/components/TodayView";
import { addDays, longDate, todayISO, weekdayIndex } from "@/lib/dates";
import { demoDrillDefs, demoDrills, demoRun } from "@/lib/demo";
import { DEFAULTS, phaseFor } from "@/lib/plan";

export const metadata = {
  title: "Demo · CAT Register",
  description:
    "A filled register, with sample data, so you can see what it does before signing up.",
};

export default function DemoPage() {
  const today = todayISO();
  const start = addDays(today, -27);
  const drillDefs = demoDrillDefs();
  const drills = demoDrills();

  return (
    <TodayView
      today={today}
      dateLabel={longDate(today)}
      dayNumber={28}
      streak={12}
      minutesToday={Object.values(drills).reduce((sum, d) => sum + d.minutes, 0)}
      phase={phaseFor(today)}
      drills={drills}
      drillDefs={drillDefs}
      run={demoRun(start, DEFAULTS.examDate, today)}
      leadingBlanks={weekdayIndex(start)}
      examDate={DEFAULTS.examDate}
      readOnly
    />
  );
}
