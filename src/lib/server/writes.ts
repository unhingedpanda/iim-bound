/**
 * The only place this app writes to Postgres.
 *
 * Every action used to call `supabase.from(...).insert(...)` and drop the
 * result, so seventeen of eighteen writes could fail silently — the UI showed
 * the drill ticked and the row was never there. Both helpers here inspect the
 * error and turn it into a thrown UserFacingError, which the nearest error
 * boundary renders as a real message.
 *
 * Server-only by construction: this module imports next/cache and the supabase
 * server client, so a client component that imports it fails at build time
 * rather than shipping a service call into the bundle.
 *
 * Every helper takes an optional client. An action that makes several related
 * writes passes one in and gets a single client for the batch; an action that
 * makes one write omits it and pays for one.
 */

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Something the person holding the phone can act on. Rendered as-is, so the
 * text must name the failure and the next step, not the stack.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/** A response shaped like postgrest's: data plus an optional error. */
type Result<T> = { data: T | null; error: { message: string } | null };

export async function connect(): Promise<Db> {
  return createClient();
}

/** Run a read that must succeed, or hand back a fallback when it cannot. */
export async function read<T>(
  what: string,
  run: (db: Db) => PromiseLike<Result<T>>,
  fallback: T,
  client?: Db,
): Promise<T> {
  const db = client ?? (await connect());
  const { data, error } = await run(db);
  if (error) {
    console.error(`[read] ${what}: ${error.message}`);
    return fallback;
  }
  return (data ?? fallback) as T;
}

/**
 * Run a write that must succeed. `what` completes the sentence
 * "Could not save …", so callers pass a noun phrase: "that mock", "your drill".
 */
export async function write<T>(
  what: string,
  run: (db: Db) => PromiseLike<Result<T>>,
  client?: Db,
): Promise<T | null> {
  const db = client ?? (await connect());
  const { data, error } = await run(db);
  if (error) {
    console.error(`[write] ${what}: ${error.message}`);
    throw new UserFacingError(`Could not save ${what}. ${hint(error.message)}`);
  }
  return data;
}

/**
 * Every mutation ends here.
 *
 * Each action used to name the paths it thought it affected — and sometimes
 * got it wrong, since one write can move the header countdown, the grid, the
 * mock chart and the syllabus in the same breath. refresh() re-renders what
 * the person is actually looking at, so there is no per-action list to keep
 * in step with the pages.
 *
 * What it does not do is re-render the layout around the page. A browser test
 * caught this: saving a theme wrote the row and left the shell drawing the old
 * one until a reload, because the inline script that applies the theme lives in
 * the layout and refresh() left it alone. So a value the shell draws cannot be
 * fixed by refreshing harder — it has to be applied where it is changed, which
 * is what ProfileForm does for the theme.
 *
 * Outside a request (the e2e suite calls these functions directly) there is no
 * client router to refresh, so the failure is ignored rather than thrown —
 * the write itself has already succeeded.
 */
export function saved(): void {
  try {
    refresh();
  } catch {
    // No request context: nothing to re-render.
  }
}

/** The database's own words, tidied so they read like a sentence. */
function hint(message: string): string {
  if (message.includes("duplicate key")) return "That already exists.";
  if (message.includes("violates foreign key")) return "Something it refers to is missing.";
  if (message.includes("violates check constraint")) return "One of those values is out of range.";
  if (message.includes("JWT") || message.includes("permission")) return "Try signing in again.";
  return "Try again.";
}
