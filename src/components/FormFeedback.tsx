"use client";

import { useCallback, useState, useTransition } from "react";

/**
 * Running a Server Action from a client component, with the failure kept.
 *
 * Server Actions used to be fired and forgotten — `void logMinutes(form)` with
 * no catch anywhere in src/ — so a rejected write left the optimistic number
 * on screen and put nothing in the database. The action now throws a readable
 * message and this hook turns it into something the person can see.
 *
 * `onDone` receives whatever the action returned, which is how the drill board
 * replaces its optimistic arithmetic with the figure the server actually
 * stored. `run` takes an optional `after` for the same reason from the other
 * direction: anything that marks a write as landed must run on success only.
 */
export type AsyncForm = (form: FormData) => Promise<unknown>;

export function useFormAction<T = unknown>(
  action: AsyncForm,
  onDone?: (result: T) => void,
  /** Success-only, and handed the submitted form: see ActionForm. */
  onSubmitted?: (form: FormData, result: T) => void,
) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (form: FormData, after?: (result: T) => void) => {
      setError(null);
      startTransition(async () => {
        try {
          const result = (await action(form)) as T;
          onDone?.(result);
          onSubmitted?.(form, result);
          // Runs only once the write is through, which is what makes it safe
          // to hang a "this landed" mark on.
          after?.(result);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "That did not save. Try again.");
        }
      });
    },
    [action, onDone, onSubmitted],
  );

  const dismiss = useCallback(() => setError(null), []);

  return { run, pending, error, dismiss };
}

/** The one place a failed write is shown. */
export function ErrorNote({ error, onDismiss }: { error: string | null; onDismiss?: () => void }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="note-in mt-4 border-l-4 border-flag bg-paper-2 px-4 py-3 text-sm text-flag"
    >
      <span className="font-bold">Not saved.</span> {error}
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="ml-3 underline underline-offset-4">
          Dismiss
        </button>
      ) : null}
    </p>
  );
}

/**
 * A form whose action can report failure.
 *
 * Used by the small settings forms — move, remove, restart — where the whole
 * of the feedback is "did that work". The note sits inside the form that
 * failed, so it is obvious which one to retry.
 *
 * `onDone` runs only once the write is through, and receives the submitted
 * FormData as well as the action's result. That is for the handful of settings
 * the server cannot make visible on its own: `refresh()` re-renders the page,
 * but not the layout around it, so anything the shell draws — the theme, the
 * countdown — has to be applied here rather than waited for.
 */
export function ActionForm({
  action,
  children,
  className = "",
  noteClassName = "",
  onDone,
}: {
  action: AsyncForm;
  children: React.ReactNode;
  className?: string;
  /** Where the error sits inside `className`'s grid, when it is one. */
  noteClassName?: string;
  onDone?: (form: FormData, result: unknown) => void;
}) {
  const { run, pending, error } = useFormAction(action, undefined, onDone);
  return (
    <form action={run} aria-busy={pending} className={className}>
      {children}
      <div className={noteClassName}>
        <ErrorNote error={error} />
      </div>
    </form>
  );
}
