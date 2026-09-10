import ErrorsView from "@/components/ErrorsView";
import { todayISO } from "@/lib/dates";
import { demoMistakes } from "@/lib/demo";

export const metadata = { title: "Errors · Demo · IIM Bound" };

export default function DemoErrorsPage() {
  return <ErrorsView mistakes={demoMistakes(todayISO())} demo />;
}
