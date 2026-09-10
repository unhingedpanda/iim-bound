import MocksView from "@/components/MocksView";
import { daysBetween, todayISO } from "@/lib/dates";
import { demoMocks } from "@/lib/demo";
import { DEFAULTS } from "@/lib/plan";

export const metadata = { title: "Mocks · Demo · IIM Bound" };

export default function DemoMocksPage() {
  const today = todayISO();
  return (
    <MocksView
      mocks={demoMocks(today)}
      sectionFloor={DEFAULTS.sectionFloor}
      targetPercentile={DEFAULTS.targetPercentile}
      daysLeft={Math.max(0, daysBetween(today, DEFAULTS.examDate))}
      demo
    />
  );
}
