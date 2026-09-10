import MocksView from "@/components/MocksView";
import { daysBetween } from "@/lib/dates";
import { today } from "@/lib/day";
import { demoMocks } from "@/lib/demo";
import { DEFAULTS } from "@/lib/plan";

export const metadata = { title: "Mocks · Demo · IIM Bound" };

export default function DemoMocksPage() {
  const day = today();
  return (
    <MocksView
      mocks={demoMocks(day)}
      sectionFloor={DEFAULTS.sectionFloor}
      targetPercentile={DEFAULTS.targetPercentile}
      daysLeft={Math.max(0, daysBetween(day, DEFAULTS.examDate))}
      demo
    />
  );
}
