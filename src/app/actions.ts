/**
 * Server Actions: the only way the browser can change anything.
 *
 * Thin on purpose. Each action resolves who is asking, reads its fields once
 * through @/lib/form, and hands the work to a write that either succeeds or
 * throws a UserFacingError the error boundary can show. The decisions worth
 * arguing about — what a valid drill key is, which day a write may land on —
 * live in @/lib/day and @/lib/server/drills, where they can be exercised
 * without a browser.
 */

"use server";

import { PAPER } from "@/lib/cat";
import { addDays } from "@/lib/dates";
import { acceptDay, isDay, latestLoggableDay, today } from "@/lib/day";
import { flag, LIMITS, number, oneOf, optionalText, text, wholeNumber } from "@/lib/form";
import type { MockFormState } from "@/lib/mock-form";
import {
  COVERAGE_SOLID,
  MISTAKE_CAUSES,
  nextSorts,
  SECTIONS,
  SORT_STEP,
  slugify,
} from "@/lib/plan";
import { drillFor } from "@/lib/server/drills";
import { connect, type Db, read, saved, UserFacingError, write } from "@/lib/server/writes";
import { currentUserId } from "@/lib/supabase/server";

/** A date field that a client can legitimately be a day off on. */
function dayField(raw: FormDataEntryValue | null, what: string): string {
  const day = acceptDay(raw);
  if (!day) throw new UserFacingError(`${what} has to be a real date, within a day of today.`);
  return day;
}

async function requireUser(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw new UserFacingError("Your session has expired. Sign in again to keep going.");
  return userId;
}

/* ------------------------------------------------------------------ drills */

export async function toggleDrill(formData: FormData) {
  const userId = await requireUser();
  const drill = await drillFor(userId, text(formData.get("drill_key"), 32));
  if (!drill) return;

  const day = dayField(formData.get("on_day"), "That day");
  const done = flag(formData.get("done"));

  await write("that drill", (db) =>
    db
      .from("drill_log")
      .upsert(
        { user_id: userId, on_day: day, drill_key: drill.slug, done, updated_at: now() },
        { onConflict: "user_id,on_day,drill_key" },
      ),
  );
  saved();
}

/**
 * Files a finished focus session.
 *
 * Returns the day's stored minutes for that drill, which is what the timer
 * board shows once the write lands — the RPC owns that number, and rounding
 * per session on the client is what let the display drift from the database.
 */
export async function logMinutes(formData: FormData): Promise<number | null> {
  const userId = await requireUser();
  const drill = await drillFor(userId, text(formData.get("drill_key"), 32));
  if (!drill) return null;

  const day = dayField(formData.get("on_day"), "That day");
  const seconds = Math.round(Number(formData.get("seconds") ?? 0));
  if (!Number.isFinite(seconds) || seconds < 1) return null;

  // The RPC adds the session and recomputes the day's cached minutes in one
  // transaction, so two tabs stopping at once cannot lose a session. It also
  // re-checks the day and the drill key, because it is reachable directly.
  const minutes = await write<number>("that session", (db) =>
    db.rpc("log_focus_session", {
      p_on_day: day,
      p_drill_key: drill.slug,
      p_seconds: Math.min(seconds, 86_400),
    }),
  );
  saved();
  return typeof minutes === "number" ? minutes : null;
}

export async function addDrill(formData: FormData) {
  const userId = await requireUser();
  const label = text(formData.get("label"), LIMITS.drillLabel);
  if (!label) return;

  const db = await connect();
  const rows = await activeDrillRows(userId, db);
  await write(
    "that drill",
    (db) =>
      db.from("user_drills").insert({
        user_id: userId,
        slug: slugify(
          label,
          rows.map((d) => d.slug),
        ),
        label,
        blurb: optionalText(formData.get("blurb"), LIMITS.drillBlurb),
        target_minutes: number(formData.get("target_minutes"), 1, 600, 30),
        // One past the end of the board, so it lands last.
        sort: nextSorts(rows.length + 1).at(-1) ?? SORT_STEP,
      }),
    db,
  );
  saved();
}

export async function updateDrill(formData: FormData) {
  const userId = await requireUser();
  const id = text(formData.get("id"), 40);
  const label = text(formData.get("label"), LIMITS.drillLabel);
  if (!id || !label) return;

  await write("that drill", (db) =>
    db
      .from("user_drills")
      .update({
        label,
        blurb: optionalText(formData.get("blurb"), LIMITS.drillBlurb),
        target_minutes: number(formData.get("target_minutes"), 1, 600, 30),
      })
      .eq("id", id)
      .eq("user_id", userId),
  );
  saved();
}

/** Archive rather than delete, so the drill's logged history stays intact. */
export async function archiveDrill(formData: FormData) {
  const userId = await requireUser();
  const id = text(formData.get("id"), 40);
  if (!id) return;

  await write("that drill", (db) =>
    db.from("user_drills").update({ archived: true }).eq("id", id).eq("user_id", userId),
  );
  saved();
}

/**
 * One step up or down the board.
 *
 * The list is renumbered rather than having two rows swap their `sort`: if a
 * tie ever existed the swap wrote the same value over itself and the button
 * did nothing at all. Renumbering is idempotent and self-healing, so a tie can
 * never survive a click.
 */
export async function moveDrill(formData: FormData) {
  const userId = await requireUser();
  const id = text(formData.get("id"), 40);
  const direction = oneOf(formData.get("direction"), ["up", "down"] as const, "up");
  if (!id) return;

  const db = await connect();
  const rows = await activeDrillRows(userId, db);
  const from = rows.findIndex((d) => d.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= rows.length) return;

  const order = [...rows];
  [order[from], order[to]] = [order[to], order[from]];
  const sorts = nextSorts(order.length);

  await Promise.all(
    order.map((drill, i) =>
      write(
        "that drill",
        (db) =>
          db
            .from("user_drills")
            .update({ sort: sorts[i] })
            .eq("id", drill.id)
            .eq("user_id", userId),
        db,
      ),
    ),
  );
  saved();
}

/* ------------------------------------------------------------------- mocks */

/**
 * Turns a thrown UserFacingError into form state.
 *
 * The mock form keeps its own inline error rather than the page-level
 * boundary, because it is the one form where the numbers the person just
 * typed are worth preserving — a boundary would replace the whole screen.
 */
function asFormError(error: unknown): MockFormState {
  if (error instanceof UserFacingError) return { ok: false, error: error.message };
  throw error;
}

export async function addMock(_prev: MockFormState, formData: FormData): Promise<MockFormState> {
  try {
    return await saveMock(formData);
  } catch (error) {
    return asFormError(error);
  }
}

async function saveMock(formData: FormData): Promise<MockFormState> {
  const userId = await requireUser();

  /** A percentile, if the series gave you one. Blank is fine; anything else
   *  outside 0–100 is a typo worth flagging, not silently dropping. */
  const percentile = (name: string): number | null | typeof INVALID => {
    const raw = formData.get(name);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : INVALID;
  };

  /** A question count. Blank means "not logging this"; anything outside what
   *  the section holds is rejected rather than nulled or clamped. */
  const count = (name: string, max: number): number | null | typeof INVALID => {
    const n = wholeNumber(formData.get(name), 0, max);
    if (n !== null) return n;
    return formData.get(name) === null || formData.get(name) === "" ? null : INVALID;
  };

  const series = text(formData.get("series"), LIMITS.series);
  if (!series) return fail("Give the mock a name — e.g. SimCAT 5.");

  // Inline rather than thrown: a bad date is the most likely thing to be wrong
  // in this form, and the form is where the answer belongs. Shape and range are
  // reported separately, because "not a date" and "in the future" are different
  // mistakes and the second is the common one.
  const takenOn = String(formData.get("taken_on") ?? "");
  if (!isDay(takenOn)) return fail("Enter the real date you sat it — today or earlier.");
  if (takenOn > latestLoggableDay()) {
    return fail("That date is in the future — log mocks for today or earlier.");
  }

  const row: Record<string, unknown> = {
    user_id: userId,
    taken_on: takenOn,
    series,
    takeaway: optionalText(formData.get("takeaway"), LIMITS.takeaway),
    reviewed: flag(formData.get("reviewed"), "on"),
  };
  if (row.reviewed) row.reviewed_on = today();

  for (const section of SECTIONS) {
    const key = section.toLowerCase();
    const max = PAPER[section].questions;
    const attempted = count(`${key}_attempted`, max);
    if (attempted === INVALID)
      return fail(`${section} attempted must be a whole number between 0 and ${max}.`);
    const correct = count(`${key}_correct`, max);
    if (correct === INVALID)
      return fail(`${section} correct must be a whole number between 0 and ${max}.`);
    if (attempted !== null && correct !== null && correct > attempted)
      return fail(
        `${section} correct (${correct}) is more than attempted (${attempted}) — fix the numbers.`,
      );
    row[`${key}_attempted`] = attempted;
    row[`${key}_correct`] = correct;
    const p = percentile(key);
    if (p === INVALID) return fail(`${section} percentile must be between 0 and 100.`);
    row[key] = p;
  }
  const overall = percentile("overall");
  if (overall === INVALID) return fail("Overall percentile must be between 0 and 100.");
  row.overall = overall;

  await write("that mock", (db) => db.from("mocks").insert(row));
  saved();
  return { ok: true, error: null };
}

export async function setMockReviewed(formData: FormData) {
  const userId = await requireUser();
  const id = text(formData.get("id"), 40);
  if (!id) return;
  const reviewed = flag(formData.get("reviewed"));

  await write("that mock", (db) =>
    db
      .from("mocks")
      .update({ reviewed, reviewed_on: reviewed ? today() : null })
      .eq("id", id)
      .eq("user_id", userId),
  );
  saved();
}

export async function deleteMock(formData: FormData) {
  const userId = await requireUser();
  const id = text(formData.get("id"), 40);
  if (!id) return;

  await write("that mock", (db) => db.from("mocks").delete().eq("id", id).eq("user_id", userId));
  saved();
}

/* ---------------------------------------------------------------- syllabus */

export async function setTopicConfidence(formData: FormData) {
  const userId = await requireUser();
  const topicId = wholeNumber(formData.get("topic_id"), 1, Number.MAX_SAFE_INTEGER);
  // Bounded by the top of the scale, not by the column's own limit: the column
  // allows 3 for a level an early build wrote, and this build never offers it.
  const confidence = wholeNumber(formData.get("confidence"), 0, COVERAGE_SOLID);
  if (topicId === null || confidence === null) return;

  await write("that rating", (db) =>
    db
      .from("topic_status")
      .upsert(
        { user_id: userId, topic_id: topicId, confidence, updated_at: now() },
        { onConflict: "user_id,topic_id" },
      ),
  );
  saved();
}

export async function addTopic(formData: FormData) {
  const userId = await requireUser();
  const name = text(formData.get("name"), LIMITS.topicName);
  const section = oneOf(formData.get("section"), SECTIONS, "QA");
  if (!name) return;

  const inserted = await write("that topic", (db) =>
    db
      .from("syllabus_topics")
      .insert({ user_id: userId, section, name })
      .select("id")
      .maybeSingle(),
  );

  // A topic you already have is not a failure worth a scary page — the unique
  // index rejects the duplicate and the list already shows it.
  if (!inserted) return;
  saved();
}

export async function deleteTopic(formData: FormData) {
  const userId = await requireUser();
  const id = wholeNumber(formData.get("id"), 1, Number.MAX_SAFE_INTEGER);
  if (id === null) return;

  await write("that topic", (db) =>
    db.from("syllabus_topics").delete().eq("id", id).eq("user_id", userId),
  );
  saved();
}

/* ---------------------------------------------------------------- mistakes */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function addMistake(formData: FormData) {
  const userId = await requireUser();
  const note = text(formData.get("note"), LIMITS.mistakeNote);
  const section = oneOf(formData.get("section"), SECTIONS, "QA");
  const cause = oneOf(
    formData.get("cause"),
    MISTAKE_CAUSES.map((c) => c.key),
    "concept",
  );
  if (!note) return;

  // A forged mock_id must not 500 on cast or point at someone else's mock.
  const rawMockId = text(formData.get("mock_id"), 40);
  const mockId = UUID_RE.test(rawMockId) ? await ownedMock(userId, rawMockId) : null;

  await write("that mistake", (db) =>
    db.from("mistakes").insert({
      user_id: userId,
      section,
      cause,
      topic: optionalText(formData.get("topic"), LIMITS.topicName),
      note,
      mock_id: mockId,
    }),
  );
  saved();
}

export async function resolveMistake(formData: FormData) {
  const userId = await requireUser();
  const id = text(formData.get("id"), 40);
  if (!id) return;
  const resolved = flag(formData.get("resolved"));

  await write("that mistake", (db) =>
    db.from("mistakes").update({ resolved }).eq("id", id).eq("user_id", userId),
  );
  saved();
}

/* ---------------------------------------------------------------- settings */

export async function updateSettings(formData: FormData) {
  const userId = await requireUser();

  // The grid draws one square per day between started_on and this, so an
  // unbounded date is an unbounded render. Five years is generous for an exam
  // that is always less than one away.
  const examDate = String(formData.get("exam_date") ?? "");
  const horizon = addDays(today(), 365 * 5);

  // A missing or malformed field means the form was not ours to trust. Keep
  // what the profile already says rather than quietly writing today over a
  // date the person chose — the old code did exactly that, and a typo in one
  // field silently moved their exam.
  const keepExisting = !isDay(examDate);
  if (!keepExisting && (examDate < today() || examDate > horizon)) {
    throw new UserFacingError(
      `Pick an exam date between today and ${horizon}. That is what the countdown and the run grid measure to.`,
    );
  }

  await write("your settings", (db) => {
    const patch: Record<string, unknown> = {
      display_name: optionalText(formData.get("display_name"), LIMITS.displayName),
      streak_threshold: number(formData.get("streak_threshold"), 1, 12, 3),
      section_floor: number(formData.get("section_floor"), 0, 100, 85),
      target_percentile: number(formData.get("target_percentile"), 0, 100, 99),
      theme: oneOf(formData.get("theme"), ["system", "light", "dark"] as const, "system"),
    };
    if (!keepExisting) patch.exam_date = examDate;
    return db.from("profiles").update(patch).eq("id", userId);
  });
  saved();
}

export async function restartRun() {
  const userId = await requireUser();
  await write("your run", (db) =>
    db.from("profiles").update({ started_on: today() }).eq("id", userId),
  );
  saved();
}

/* ----------------------------------------------------------------- helpers */

const INVALID = "invalid" as const;

function fail(error: string): MockFormState {
  return { ok: false, error };
}

function now(): string {
  return new Date().toISOString();
}

function activeDrillRows(userId: string, db: Db) {
  return read<Array<{ id: string; slug: string; sort: number }>>(
    "your drills",
    (db) =>
      db
        .from("user_drills")
        .select("id, slug, sort")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("sort"),
    [],
    db,
  );
}

function ownedMock(userId: string, mockId: string): Promise<string | null> {
  return read<{ id: string } | null>(
    "that mock",
    (db) => db.from("mocks").select("id").eq("id", mockId).eq("user_id", userId).maybeSingle(),
    null,
  ).then((owned) => (owned ? mockId : null));
}
