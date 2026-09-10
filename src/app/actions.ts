"use server";

import { revalidatePath } from "next/cache";
import { PAPER } from "@/lib/cat";
import { todayISO } from "@/lib/dates";
import { SECTIONS, slugify } from "@/lib/plan";
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
  if (!drillKey) return;

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
  const userId = await requireUser();
  const drillKey = String(formData.get("drill_key") ?? "");
  const seconds = Number(formData.get("seconds") ?? 0);
  const day = String(formData.get("on_day") ?? todayISO());
  if (!drillKey || !Number.isFinite(seconds) || seconds < 1) return;

  const supabase = await createClient();
  await supabase
    .from("focus_sessions")
    .insert({ user_id: userId, on_day: day, drill_key: drillKey, seconds: Math.round(seconds) });

  const { data: existing } = await supabase
    .from("drill_log")
    .select("minutes")
    .eq("user_id", userId)
    .eq("on_day", day)
    .eq("drill_key", drillKey)
    .maybeSingle();

  const minutes = (existing?.minutes ?? 0) + Math.round(seconds / 60);
  await supabase.from("drill_log").upsert(
    {
      user_id: userId,
      on_day: day,
      drill_key: drillKey,
      minutes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,on_day,drill_key" },
  );

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

export async function addMock(formData: FormData) {
  const userId = await requireUser();
  const supabase = await createClient();

  /** A percentile, if the series gave you one. */
  const percentile = (name: string) => {
    const raw = formData.get(name);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
  };

  /** A question count, capped at what the section actually holds. */
  const count = (name: string, max: number) => {
    const raw = formData.get(name);
    if (raw === null || raw === "") return null;
    const n = Math.round(Number(raw));
    return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  };

  const series = trimmed(formData.get("series"), 80);
  if (!series) return;

  const row: Record<string, unknown> = {
    user_id: userId,
    taken_on: String(formData.get("taken_on") ?? todayISO()),
    series,
    takeaway: trimmed(formData.get("takeaway"), 300) || null,
    reviewed: formData.get("reviewed") === "on",
  };
  if (row.reviewed) row.reviewed_on = todayISO();

  for (const section of SECTIONS) {
    const key = section.toLowerCase();
    const max = PAPER[section].questions;
    const attempted = count(`${key}_attempted`, max);
    const correct = count(`${key}_correct`, max);
    row[`${key}_attempted`] = attempted;
    // Never store more correct than attempted — the check constraint would
    // reject the whole row and the user would lose everything they typed.
    row[`${key}_correct`] =
      correct === null || attempted === null ? correct : Math.min(correct, attempted);
    row[key] = percentile(key);
  }
  row.overall = percentile("overall");

  const { error } = await supabase.from("mocks").insert(row);
  if (error) throw new Error(`Could not save that mock: ${error.message}`);

  revalidatePath("/mocks");
  revalidatePath("/today");
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

export async function addMistake(formData: FormData) {
  const userId = await requireUser();
  const note = trimmed(formData.get("note"), 2000);
  const section = String(formData.get("section") ?? "QA");
  const cause = String(formData.get("cause") ?? "concept");
  const topic = trimmed(formData.get("topic"), 80);

  if (!note) return;
  if (!SECTIONS.includes(section as (typeof SECTIONS)[number])) return;

  const supabase = await createClient();
  await supabase.from("mistakes").insert({
    user_id: userId,
    section,
    cause,
    topic: topic || null,
    note,
    mock_id: trimmed(formData.get("mock_id"), 40) || null,
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
