import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import Mark from "@/components/Mark";

export const metadata = { title: "Sign in · IIM Bound" };

/**
 * Sign-in, in the app's own shell.
 *
 * Clerk's component does the work — email or username with a password, plus
 * Google, plus the email-link fallback — because every one of those flows is
 * harder to get right by hand than it looks, and Supabase's hosted form is what
 * this replaces. The page keeps its own masthead and copy so the first screen
 * still looks like this app rather than like a vendor's.
 *
 * `/sign-in` and `/sign-up` are pointed here by NEXT_PUBLIC_CLERK_SIGN_IN_URL and
 * _SIGN_UP_URL: one screen that handles both, because Clerk's component does.
 */
export default function LoginPage() {
  return (
    <main className="mx-auto grid max-w-[1200px] gap-10 px-6 py-12 lg:min-h-dvh lg:grid-cols-2 lg:items-center lg:gap-20">
      <div>
        <Link href="/" className="flex items-center gap-3">
          <Mark size={44} />
          <span className="display text-[clamp(28px,5vw,44px)]">IIM Bound</span>
        </Link>
        <p className="mt-6 max-w-[42ch] text-lg text-ink-2">
          Drills with a timer behind each one, a mock log that names your weakest section, and a
          syllabus you can actually see the holes in.
        </p>
        <p className="mt-6 max-w-[42ch] text-sm text-ink-3">
          Pick a username and a password and you are in — no waiting for a link. Or use your email,
          or Google.
        </p>
      </div>

      <div className="flex justify-center lg:justify-self-end lg:w-full lg:max-w-[440px]">
        <SignIn
          appearance={{
            variables: {
              colorPrimary: "var(--signal)",
              colorPrimaryForeground: "var(--signal-ink)",
              colorForeground: "var(--ink)",
              colorMutedForeground: "var(--ink-3)",
              colorBackground: "var(--paper)",
              colorInput: "var(--paper)",
              colorInputForeground: "var(--ink)",
              colorBorder: "var(--line)",
              colorDanger: "var(--flag)",
              borderRadius: "0px",
              fontFamily: "var(--font-instrument), Helvetica Neue, Arial, sans-serif",
            },
            elements: {
              rootBox: "w-full",
              cardBox: "w-full shadow-none border-2 border-ink",
              card: "shadow-none bg-paper",
              headerTitle: "display",
              formButtonPrimary:
                "bg-ink text-paper font-semibold rounded-none shadow-none hover:bg-ink/90 normal-case",
              formFieldInput: "rounded-none border-0 border-b-2 border-line bg-transparent",
              footerActionLink: "text-ink font-semibold",
            },
          }}
        />
      </div>
    </main>
  );
}
