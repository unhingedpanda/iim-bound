import ErrorsView from "@/components/ErrorsView";
import { today } from "@/lib/day";
import { demoMistakes } from "@/lib/demo";

export const metadata = { title: "Errors · Demo · IIM Bound" };

export default function DemoErrorsPage() {
  return <ErrorsView mistakes={demoMistakes(today())} demo />;
}
