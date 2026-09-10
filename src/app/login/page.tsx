import Link from "next/link";
import LoginForm from "@/components/LoginForm";
import { safeNext } from "@/lib/routes";
import { supabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Sign in · IIM Bound" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  return (
    <main className="mx-auto grid max-w-[1200px] gap-10 px-6 py-12 lg:min-h-dvh lg:grid-cols-2 lg:items-center lg:gap-20">
      <div>
        <Link href="/" className="display text-[clamp(40px,8vw,88px)] block">
          IIM
          <br />
          Bound
        </Link>
        <p className="mt-6 max-w-[42ch] text-lg text-ink-2">
          Drills with a timer behind each one, a mock log that names your weakest section, and a
          syllabus you can actually see the holes in.
        </p>
      </div>

      <div className="lg:justify-self-end lg:w-full lg:max-w-[440px]">
        {params.error === "link_expired" ? (
          <p className="mb-6 border-l-4 border-flag py-2 pl-4 text-flag">
            That link has expired. Send yourself a fresh one.
          </p>
        ) : null}

        {supabaseConfigured() ? (
          <LoginForm next={next} />
        ) : (
          <div className="border-4 border-flag p-6">
            <p className="display text-3xl">Not connected yet</p>
            <p className="mt-3 text-ink-2">
              Copy <code>.env.example</code> to <code>.env.local</code> and add your Supabase URL
              and publishable key, then restart the dev server. The README walks through creating
              the project and running the migration.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
