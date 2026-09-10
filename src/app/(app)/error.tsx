"use client";

import { useEffect } from "react";

/**
 * The last resort for a write that failed.
 *
 * Every action that can fail in a way a person needs to act on now returns its
 * message to the form that sent it. This catches what is left — a session that
 * expired mid-submit, a database that is not answering — so the screen says
 * what happened instead of showing the framework's error page.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="rule-heavy mt-8 pt-5">
      <h1 className="display text-[clamp(32px,6vw,64px)]">That didn&rsquo;t save</h1>
      <p className="mt-4 max-w-[60ch] text-ink-2">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 border-2 border-ink px-5 py-3 font-semibold"
      >
        Try again
      </button>
      <p className="mt-4 text-sm text-ink-3">
        Nothing was half-written. If it keeps happening, your session may have expired —{" "}
        <a href="/login" className="underline underline-offset-4">
          sign in again
        </a>
        .
      </p>
    </main>
  );
}
