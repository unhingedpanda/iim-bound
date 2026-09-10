import TodayView from "@/components/TodayView";
import { addDays, longDate, weekdayIndex } from "@/lib/dates";
import { today } from "@/lib/day";
import { demoDrillDefs, demoDrills, demoRun } from "@/lib/demo";
import { DEFAULTS, phaseFor } from "@/lib/plan";

export const metadata = {
  title: "Demo · IIM Bound",
  description: "A filled logbook, with sample data, so you can see what it does before signing up.",
};

export default function DemoPage() {
  const day = today();
  const start = addDays(day, -27);
  const drillDefs = demoDrillDefs();
  const drills = demoDrills();

  return (
    <TodayView
      today={day}
      dateLabel={longDate(day)}
      dayNumber={28}
      streak={12}
      summary={{
        minutes: Object.values(drills).reduce((sum, d) => sum + d.minutes, 0),
        done: Object.values(drills).filter((d) => d.done).length,
      }}
      phase={phaseFor(day)}
      drills={drills}
      drillDefs={drillDefs}
      run={demoRun(start, DEFAULTS.examDate, day)}
      leadingBlanks={weekdayIndex(start)}
      examDate={DEFAULTS.examDate}
      readOnly
    />
  );
}
