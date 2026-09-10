import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import Mark from "@/components/Mark";

export const metadata = { title: "Sign in · IIM Bound" };

/**
 * Sign-in and sign-up, in the app's own shell.
 *
 * Clerk's component does the work — email or username with a password, plus
 * Google if it is configured — because every one of those flows is harder to
 * get right by hand than it looks, and Supabase's hosted form is what this
 * replaces. The page keeps its own masthead and copy so the first screen still
 * looks like this app rather than like a vendor's.
 *
 * `withSignUp` is what makes one screen enough. Without it `<SignIn>` is
 * sign-in only: an address it does not recognise comes back as "couldn't find
 * your account", and the "Sign up" link goes wherever NEXT_PUBLIC_CLERK_SIGN_UP_URL
 * points — which is here, because there is no second page. That combination
 * left a new person with no way in at all.
 *
 * Where the user came from is the proxy's job, not this page's: the gate
 * redirects to `?redirect_url=`, which Clerk reads and carries across its own
 * sign-in/sign-up navigation. Nothing here needs to know about it.
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
          Pick a username and a password and you are in — no waiting for a link. Or use the address
          you already signed up with.
        </p>
      </div>

      <div className="flex justify-center lg:justify-self-end lg:w-full lg:max-w-[440px]">
        <SignIn
          withSignUp
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
