import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";

export const metadata = { title: "Signed out · IIM Bound" };

/**
 * A sign-out confirmation, rather than a route that signs you out on arrival.
 *
 * The app used a POST form straight to /auth/signout, which worked but meant a
 * real sign-out happened as a side effect of a page load — and a prefetcher or
 * a back button could trigger it. Clerk's SignOutButton makes the sign-out an
 * explicit act, and this page is where you land if you get here by URL.
 */
export default function SignOutPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[720px] flex-col justify-center px-6 py-16">
      <h1 className="display text-[clamp(36px,7vw,64px)]">Signed out</h1>
      <p className="mt-4 max-w-[48ch] text-lg text-ink-2">
        Your logbook is saved. Sign back in whenever you are ready to add to it.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <SignOutButton redirectUrl="/">
          <button type="button" className="bg-ink px-6 py-3 font-semibold text-paper">
            Sign out of this device
          </button>
        </SignOutButton>
        <Link href="/" className="font-semibold text-ink underline underline-offset-4">
          Back to the start
        </Link>
      </div>
    </main>
  );
}
