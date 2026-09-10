import { redirect } from "next/navigation";
import MocksView from "@/components/MocksView";
import { daysLeft, getMocks, getProfile } from "@/lib/data";
import { currentUserId } from "@/lib/supabase/server";

export const metadata = { title: "Mocks · IIM Bound" };

export default async function MocksPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/login");

  const [profile, mocks] = await Promise.all([getProfile(userId), getMocks(userId)]);

  return (
    <MocksView
      mocks={mocks}
      sectionFloor={profile.section_floor}
      targetPercentile={profile.target_percentile}
      daysLeft={daysLeft(profile)}
    />
  );
}
