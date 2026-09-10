import Link from "next/link";
import { redirect } from "next/navigation";
import { DesktopNav, MobileNav } from "@/components/AppNav";
import Mark from "@/components/Mark";
import { daysLeft, getProfile } from "@/lib/data";
import { SITE } from "@/lib/site";
import { currentUserId } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await currentUserId();
  if (!userId) redirect("/login");

  const profile = await getProfile(userId);
  const left = daysLeft(profile);

  return (
    <div className="min-h-dvh pb-20 sm:pb-0">
      {/* The theme choice lives on the profile, so apply it as the shell streams in. */}
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sets a single attribute from a validated enum
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.dataset.theme=${JSON.stringify(profile.theme)}`,
        }}
      />
      <header className="sticky top-0 z-10 border-b-4 border-ink bg-paper">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
          <div className="flex items-center gap-5">
            <Link href="/today" className="flex items-center gap-2.5">
              <Mark />
              <span className="display text-xl">{SITE.name}</span>
            </Link>
            <DesktopNav />
          </div>

          <div className="flex items-baseline gap-4">
            <span className="text-sm text-ink-2">
              <span className="display text-xl text-ink">{left}</span> days to {SITE.examLabel}
            </span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-sm text-ink-3 underline underline-offset-4">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-6 pb-20">{children}</div>

      <MobileNav />
    </div>
  );
}
