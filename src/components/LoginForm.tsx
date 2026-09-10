"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      setState("sent");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not send the link. Try again.");
    }
  }

  if (state === "sent") {
    return (
      <div className="border-4 border-ink p-6">
        <p className="display text-[clamp(28px,5vw,44px)]">Check your email</p>
        <p className="mt-3 text-ink-2">
          A sign-in link is on its way to {email}. It signs you in on this device and keeps your
          logbook in sync everywhere else.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <label htmlFor="email" className="grid gap-2">
        <span className="text-sm text-ink-2">Email</span>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border-0 border-b-2 border-ink bg-transparent px-1 py-3 text-xl outline-none placeholder:text-ink-3"
        />
      </label>

      <button
        type="submit"
        disabled={state === "sending"}
        className="bg-ink px-6 py-4 text-left text-lg font-semibold text-paper disabled:opacity-60"
      >
        {state === "sending" ? "Sending the link…" : "Email me a sign-in link"}
      </button>

      {state === "error" ? (
        <p className="text-flag" role="alert">
          {message}
        </p>
      ) : (
        <p className="text-sm text-ink-3">
          No password. The link signs you in and expires shortly after.
        </p>
      )}
    </form>
  );
}
