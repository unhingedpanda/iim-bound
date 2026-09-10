"use server";

import { revalidatePath } from "next/cache";
import { PAPER } from "@/lib/cat";
import { todayISO } from "@/lib/dates";
import { MISTAKE_CAUSES, SECTIONS, slugify } from "@/lib/plan";
import { createClient, currentUserId } from "@/lib/supabase/server";

async function requireUser() {
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in first.");
  return userId;
}

function clampNumber(raw: FormDataEntryValue | null, min: number, max: number, fallback: number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function trimmed(raw: FormDataEntryValue | null, max: number) {
  return String(raw ?? "")
    .trim()
    .slice(0, max);
}

/* ------------------------------------------------------------------ drills */

export async function toggleDrill(formData: FormData) {
  const userId = await requireUser();
  const drillKey = String(formData.get("drill_key") ?? "");
  const day = String(formData.get("on_day") ?? todayISO());
  const done = formData.get("done") === "true";
  if (!drillKey || drillKey.length > 32) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;

  const supabase = await createClient();
  await supabase.from("drill_log").upsert(
    {
      user_id: userId,
      on_day: day,
      drill_key: drillKey,
      done,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,on_day,drill_key" },
  );

  revalidatePath("/today");
}

export async function logMinutes(formData: FormData) {
  await requireUser();
  const drillKey = String(formData.get("drill_key") ?? "");
  const seconds = Number(formData.get("seconds") ?? 0);
  const day = String(formData.get("on_day") ?? todayISO());
  if (!drillKey || drillKey.length > 32) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  if (!Number.isFinite(seconds) || seconds < 1) return;

  // One atomic transaction (insert + derived minutes), so concurrent stops
  // serialise instead of losing a session to last-write-wins.
  const supabase = await createClient();
  await supabase.rpc("log_focus_session", {
    p_on_day: day,
    p_drill_key: drillKey,
    p_seconds: Math.round(seconds),
  });

  revalidatePath("/today");
}

export async function addDrill(formData: FormData) {
  const userId = await requireUser();
  const label = trimmed(formData.get("label"), 40);
  if (!label) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("user_drills")
    .select("slug, sort")
    .eq("user_id", userId);

  const rows = (existing ?? []) as Array<{ slug: string; sort: number }>;
  const maxSort = rows.reduce((max, d) => Math.max(max, d.sort), 0);

  await supabase.from("user_drills").insert({
    user_id: userId,
    slug: slugify(
      label,
      rows.map((d) => d.slug),
    ),
    label,
    blurb: trimmed(formData.get("blurb"), 120) || null,
    target_minutes: clampNumber(formData.get("target_minutes"), 1, 600, 30),
    sort: maxSort + 10,
  });

  revalidatePath("/settings");
  revalidatePath("/today");
}

export async function updateDrill(formData: FormData) {
  const userId = await requireUser();
  const id = String(formData.get("id") ?? "");
  const label = trimmed(formData.get("label"), 40);
  if (!id || !label) return;

  const supabase = await createClient();
  await supabase
    .from("user_drills")
    .update({
      label,
      blurb: trimmed(formData.get("blurb"), 120) || null,
      target_minutes: clampNumber(formData.get("target_minutes"), 1, 600, 30),
    })
    .eq("id", id)
    .eq("user_id", userId);

  revalidatePath("/settings");
  revalidatePath("/today");
}

/** Archive rather than delete, so the drill's logged history stays intact. */
export async function archiveDrill(formData: FormData) {
  const userId = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("user_drills").update({ archived: true }).eq("id", id).eq("user_id", userId);

  revalidatePath("/settings");
  revalidatePath("/today");
}

export async function moveDrill(formData: FormData) {
  const userId = await requireUser();
  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_drills")
    .select("id, sort")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("sort");

  const list = (data ?? []) as Array<{ id: string; sort: number }>;
  const i = list.findIndex((d) => d.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;

  const a = list[i];
  const b = list[j];
  await Promise.all([
    supabase.from("user_drills").update({ sort: b.sort }).eq("id", a.id).eq("user_id", userId),
    supabase.from("user_drills").update({ sort: a.sort }).eq("id", b.id).eq("user_id", userId),
  ]);

  revalidatePath("/settings");
  revalidatePath("/today");
}

/* ------------------------------------------------------------------- mocks */

export type MockFormState = { ok: boolean; error: string | null };

const INVALID = "invalid" as const;

export async function addMock(_prev: MockFormState, formData: FormData): Promise<MockFormState> {
  const userId = await requireUser();
  const supabase = await createClient();
  const fail = (error: string): MockFormState => ({ ok: false, error });

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
    const raw = formData.get(name);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n <= max ? n : INVALID;
  };

  const series = trimmed(formData.get("series"), 80);
  if (!series) return fail("Give the mock a name — e.g. SimCAT 5.");

  const takenOn = String(formData.get("taken_on") ?? todayISO());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(takenOn)) return fail("Enter a real date for when you sat it.");
  const today = todayISO();
  if (takenOn > today) return fail("That date is in the future — log mocks for today or earlier.");

  const row: Record<string, unknown> = {
    user_id: userId,
    taken_on: takenOn,
    series,
    takeaway: trimmed(formData.get("takeaway"), 300) || null,
    reviewed: formData.get("reviewed") === "on",
  };
  if (row.reviewed) row.reviewed_on = todayISO();

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

  const { error } = await supabase.from("mocks").insert(row);
  if (error) throw new Error(`Could not save that mock: ${error.message}`);

  revalidatePath("/mocks");
  revalidatePath("/today");
  return { ok: true, error: null };
}

export async function setMockReviewed(formData: FormData) {
  const userId = await requireUser();
  const id = String(formData.get("id") ?? "");
  const reviewed = formData.get("reviewed") === "true";
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("mocks")
    .update({ reviewed, reviewed_on: reviewed ? todayISO() : null })
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/mocks");
}

export async function deleteMock(formData: FormData) {
  const userId = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("mocks").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/mocks");
}

/* ---------------------------------------------------------------- syllabus */

export async function setTopicConfidence(formData: FormData) {
  const userId = await requireUser();
  const topicId = Number(formData.get("topic_id"));
  const confidence = Number(formData.get("confidence"));
  if (!Number.isInteger(topicId) || confidence < 0 || confidence > 3) return;

  const supabase = await createClient();
  await supabase
    .from("topic_status")
    .upsert(
      { user_id: userId, topic_id: topicId, confidence, updated_at: new Date().toISOString() },
      { onConflict: "user_id,topic_id" },
    );

  revalidatePath("/syllabus");
}

export async function addTopic(formData: FormData) {
  const userId = await requireUser();
  const name = trimmed(formData.get("name"), 80);
  const section = String(formData.get("section") ?? "");
  if (!name || !SECTIONS.includes(section as (typeof SECTIONS)[number])) return;

  const supabase = await createClient();
  await supabase.from("syllabus_topics").insert({ user_id: userId, section, name, sort: 900 });
  revalidatePath("/syllabus");
}

export async function deleteTopic(formData: FormData) {
  const userId = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const supabase = await createClient();
  await supabase.from("syllabus_topics").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/syllabus");
}

/* ---------------------------------------------------------------- mistakes */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function addMistake(formData: FormData) {
  const userId = await requireUser();
  const note = trimmed(formData.get("note"), 2000);
  const section = String(formData.get("section") ?? "QA");
  const cause = String(formData.get("cause") ?? "concept");
  const topic = trimmed(formData.get("topic"), 80);

  if (!note) return;
  if (!SECTIONS.includes(section as (typeof SECTIONS)[number])) return;
  if (!MISTAKE_CAUSES.some((c) => c.key === cause)) return;

  const supabase = await createClient();

  // A forged mock_id must not 500 on cast or point at someone else's mock.
  let mockId: string | null = null;
  const rawMockId = trimmed(formData.get("mock_id"), 40);
  if (rawMockId && UUID_RE.test(rawMockId)) {
    const { data: owned } = await supabase
      .from("mocks")
      .select("id")
      .eq("id", rawMockId)
      .eq("user_id", userId)
      .maybeSingle();
    if (owned) mockId = rawMockId;
  }

  await supabase.from("mistakes").insert({
    user_id: userId,
    section,
    cause,
    topic: topic || null,
    note,
    mock_id: mockId,
  });

  revalidatePath("/errors");
}

export async function resolveMistake(formData: FormData) {
  const userId = await requireUser();
  const id = String(formData.get("id") ?? "");
  const resolved = formData.get("resolved") === "true";
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("mistakes").update({ resolved }).eq("id", id).eq("user_id", userId);
  revalidatePath("/errors");
}

/* ---------------------------------------------------------------- settings */

export async function updateSettings(formData: FormData) {
  const userId = await requireUser();
  const examDate = String(formData.get("exam_date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return;

  const theme = String(formData.get("theme") ?? "system");

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({
      exam_date: examDate,
      display_name: trimmed(formData.get("display_name"), 60) || null,
      streak_threshold: clampNumber(formData.get("streak_threshold"), 1, 12, 3),
      section_floor: clampNumber(formData.get("section_floor"), 0, 100, 85),
      target_percentile: clampNumber(formData.get("target_percentile"), 0, 100, 99),
      theme: ["system", "light", "dark"].includes(theme) ? theme : "system",
    })
    .eq("id", userId);

  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/mocks");
}

export async function restartRun() {
  const userId = await requireUser();
  const supabase = await createClient();
  await supabase.from("profiles").update({ started_on: todayISO() }).eq("id", userId);
  revalidatePath("/today");
  revalidatePath("/settings");
}
