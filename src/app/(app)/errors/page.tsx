import { redirect } from "next/navigation";
import ErrorsView, { type MistakeRow } from "@/components/ErrorsView";
import { createClient, currentUserId } from "@/lib/supabase/server";

export const metadata = { title: "Errors · IIM Bound" };

export default async function ErrorsPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const [{ data: mistakes }, { data: mocks }] = await Promise.all([
    supabase
      .from("mistakes")
      .select("id, section, topic, note, cause, resolved, created_at, mock_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("mocks")
      .select("id, series, taken_on")
      .eq("user_id", userId)
      .order("taken_on", { ascending: false })
      .limit(30),
  ]);

  return <ErrorsView mistakes={(mistakes ?? []) as MistakeRow[]} mocks={mocks ?? []} />;
}
