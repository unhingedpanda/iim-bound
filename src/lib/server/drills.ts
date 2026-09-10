/**
 * Drills: which keys a log row may carry.
 *
 * `drill_log` has no foreign key to `user_drills` — the history of an archived
 * drill has to outlive the drill — so the key on a written row used to be
 * whatever the request said it was. Length and shape were checked; membership
 * was not. Anything holding a form open could file a session against a key
 * that was never a drill, and it would sit in the day's totals forever,
 * invisible and unremovable.
 */

import { read } from "@/lib/server/writes";

export type DrillRef = { id: string; slug: string };

/**
 * The user's drill with this slug, active or archived — archiving hides a
 * drill, it does not invalidate the rows already filed under it. Null for a
 * slug that never belonged to them, or for the empty string a stale form sends.
 */
export async function drillFor(userId: string, slug: string): Promise<DrillRef | null> {
  if (!slug) return null;
  return read<DrillRef | null>(
    "that drill",
    (db) =>
      db
        .from("user_drills")
        .select("id, slug")
        .eq("user_id", userId)
        .eq("slug", slug)
        .maybeSingle(),
    null,
  );
}
