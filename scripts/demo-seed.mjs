/**
 * A local account with a history, for looking at the app by hand.
 *
 * The e2e suite makes a fresh user per test and throws it away, so it is
 * useless for the one thing a person actually wants to do after a UI change:
 * sign in and click around. This makes a stable account with three weeks of
 * plausible use behind it, weighted so the streak is real and the run grid has
 * something to say.
 *
 * Local only, and deliberately so: it reads the CLI's own service key and
 * refuses to run against anything that is not 127.0.0.1. Rows are written
 * through PostgREST with the *user's* token rather than the service key, so
 * RLS applies to this script exactly as it applies to the browser — if the
 * policies would reject the app's writes, they reject these too.
 *
 *   node scripts/demo-seed.mjs
 */

import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const API_URL = "http://127.0.0.1:55321";
const PUBLISHABLE_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const DAY_ZONE = "Asia/Kolkata";

const EMAIL = "demo@iimbound.local";
const PASSWORD = "demo-password-123";

/** The four defaults every account is seeded with, and their daily targets. */
const DRILLS = [
  { slug: "qa", target: 45 },
  { slug: "dilr", target: 40 },
  { slug: "varc", target: 30 },
  { slug: "read", target: 30 },
];

/** Days of history. 21 fits the run grid's recent weeks without scrolling. */
const DAYS = 21;

/** The app's own notion of today, reproduced from src/lib/day.ts. */
function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DAY_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function serviceKey() {
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const status = JSON.parse(raw);
  if (!String(status.API_URL).includes("127.0.0.1")) {
    throw new Error(`Refusing to seed a non-local stack: ${status.API_URL}`);
  }
  return status.SERVICE_ROLE_KEY;
}

/** Deterministic, so re-running gives the same picture rather than noise. */
function wobble(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const admin = createClient(API_URL, serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
});
const created = createError ? null : (createdUser?.user?.id ?? null);
if (createError && !/already/i.test(createError.message)) {
  throw new Error(`createUser failed: ${createError.message}`);
}

const { data: signedIn, error: signInError } = await createClient(API_URL, PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}).auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (signInError) throw new Error(`signIn failed: ${signInError.message}`);

// The user's own token, so every write below goes through RLS.
const db = createClient(API_URL, PUBLISHABLE_KEY, {
  global: { headers: { Authorization: `Bearer ${signedIn.session.access_token}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});

const userId = signedIn.user.id;
const start = addDays(today(), -(DAYS - 1));

async function wipe(table) {
  const { error } = await db.from(table).delete().eq("user_id", userId);
  if (error) throw new Error(`clearing ${table}: ${error.message}`);
}

await wipe("drill_log");
await wipe("focus_sessions");

const logs = [];
const sessions = [];

for (let i = 0; i < DAYS; i += 1) {
  const day = addDays(start, i);
  const weekend = [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay());

  // Today is left empty on purpose. A local account with today already logged
  // can show you the run grid but never the streak mark, because that fires on
  // an increase — so the last day is the reader's to fill in.
  if (i === DAYS - 1) continue;

  // The last fortnight is the committed stretch the streak is built from; a
  // couple of gaps before that keep the grid from looking synthetic.
  const missed = i === 2 || i === 9;
  const effort = missed ? 0.35 : weekend ? 0.7 : 1;

  for (let d = 0; d < DRILLS.length; d += 1) {
    const drill = DRILLS[d];
    const roll = wobble(i * 7 + d);
    const worked = roll < effort;
    const minutes = worked ? Math.round(drill.target * (0.5 + wobble(i * 13 + d) * 0.7)) : 0;

    logs.push({
      user_id: userId,
      on_day: day,
      drill_key: drill.slug,
      minutes,
      done: worked && roll < effort * 0.8,
    });

    if (minutes > 0) {
      // One session, or two for a long day — the app rounds the sum, not each
      // session, which is exactly the behaviour that is worth eyeballing.
      const halves = minutes > drill.target ? 2 : 1;
      for (let h = 0; h < halves; h += 1) {
        sessions.push({
          user_id: userId,
          on_day: day,
          drill_key: drill.slug,
          seconds: Math.round((minutes * 60) / halves),
          ended_at: `${day}T13:${String(10 + d * 7 + h * 3).padStart(2, "0")}:00Z`,
        });
      }
    }
  }
}

for (const [table, rows] of [
  ["drill_log", logs],
  ["focus_sessions", sessions],
]) {
  const { error } = await db.from(table).upsert(rows, {
    onConflict: table === "drill_log" ? "user_id,on_day,drill_key" : undefined,
  });
  if (error) throw new Error(`seeding ${table}: ${error.message}`);
}

// The profile is created by the app on first sign-in; if it is already there,
// leave the user's own settings alone.
const { data: profile } = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
if (!profile) {
  const { error } = await db.from("profiles").insert({
    id: userId,
    display_name: "Demo",
    exam_date: "2026-11-29",
    started_on: start,
    streak_threshold: 3,
    section_floor: 85,
    target_percentile: 99,
    theme: "system",
  });
  if (error) throw new Error(`creating profile: ${error.message}`);
}

const doneDays = new Set(logs.filter((l) => l.done).map((l) => l.on_day)).size;
console.log(
  [
    `seeded ${EMAIL} / ${PASSWORD}`,
    `  ${logs.length} drill rows over ${DAYS} days, ${doneDays} of them past the threshold`,
    `  ${sessions.length} focus sessions`,
    `  ${created ? "account created" : "account already existed"} (id ${userId})`,
  ].join("\n"),
);
