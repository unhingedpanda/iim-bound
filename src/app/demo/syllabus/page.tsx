import SyllabusView from "@/components/SyllabusView";
import { DEMO_TOPICS, demoConfidence } from "@/lib/demo";

export const metadata = { title: "Syllabus · Demo · IIM Bound" };

export default function DemoSyllabusPage() {
  const confidence = new Map<number, number>(
    DEMO_TOPICS.map((t) => [t.id, demoConfidence(t.id, t.section)]),
  );
  return <SyllabusView topics={DEMO_TOPICS} confidence={confidence} demo />;
}
