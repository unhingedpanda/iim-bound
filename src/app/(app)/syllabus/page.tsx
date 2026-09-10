import { redirect } from "next/navigation";
import SyllabusView, { type Topic } from "@/components/SyllabusView";
import { createClient, currentUserId } from "@/lib/supabase/server";

export const metadata = { title: "Syllabus · CAT Register" };

export default async function SyllabusPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const [{ data: topics }, { data: statuses }] = await Promise.all([
    supabase.from("syllabus_topics").select("id, section, name, sort, user_id").order("sort"),
    supabase.from("topic_status").select("topic_id, confidence").eq("user_id", userId),
  ]);

  const confidence = new Map<number, number>(
    (statuses ?? []).map((s: { topic_id: number; confidence: number }) => [
      s.topic_id,
      s.confidence,
    ]),
  );

  return <SyllabusView topics={(topics ?? []) as Topic[]} confidence={confidence} />;
}
