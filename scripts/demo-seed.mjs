/**
 * A local account with a history, for looking at the app by hand.
 *
 * The e2e suite makes a fresh user per test and throws it away, so it is
 * useless for the one thing a person actually wants to do after a UI change:
 * sign in and click around. This gives a stable account three weeks of
 * plausible use, weighted so the streak is real and the run grid has something
 * to say.
 *
 * Since Clerk owns sign-in, this cannot create the account it seeds — Clerk
 * holds the password, and there is nothing in Postgres to insert. So it seeds
 * for a Clerk user who already exists, found by id, email or username:
 *
 *   node scripts/demo-seed.mjs                      # the only Clerk user, if there is one
 *   node scripts/demo-seed.mjs yash@example.com
 *   node scripts/demo-seed.mjs user_3J9WUW4lHT8LGt4uqF4rMeVNv3z
 *
 * Sign in as that user in the browser and the history is there.
 *
 * Local only, and deliberately so: it refuses to run against anything that is
 * not 127.0.0.1. Rows are written through PostgREST with that user's own token
 * rather than the service key, so RLS applies to this script exactly as it
 * applies to the browser — if the policies would reject the app's writes, they
 * reject these too.
 */

import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { localToken } from "./local-token.mjs";

const DAY_ZONE = "Asia/Kolkata";

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

/** Deterministic, so re-running gives the same picture rather than noise. */
function wobble(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The local stack's URL, publishable key and JWT secret.
 *
 * Asking the CLI rather than reading .env.local, because the point of this
 * script is to write to the stack the app is running against, and `supabase
 * status` is the stack's own answer for where that is.
 */
function localStack() {
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const status = JSON.parse(raw);
  if (!String(status.API_URL).includes("127.0.0.1")) {
    throw new Error(`Refusing to seed a non-local stack: ${status.API_URL}`);
  }
  return {
    url: status.API_URL,
    key: status.PUBLISHABLE_KEY,
    secret: status.JWT_SECRET,
  };
}

/**
 * Which Clerk user to seed.
 *
 * `clerk users list` is the dev instance's own answer, so this cannot seed an
 * id that does not exist there — which would look like a bug in the app when
 * the developer signed in and found nothing.
 */
function resolveUser(wanted) {
  const raw = execFileSync("npx", ["clerk", "users", "list"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const users = JSON.parse(raw).data ?? [];

  if (!users.length) {
    throw new Error(
      "No Clerk users on the development instance. Sign up in the browser first, then re-run.",
    );
  }

  if (!wanted) {
    if (users.length > 1) {
      const names = users.map(
        (u) => `  ${u.id}  ${u.username ?? u.email_addresses[0]?.email_address}`,
      );
      throw new Error(`Several Clerk users — name one:\n${names.join("\n")}`);
    }
    return users[0];
  }

  const match = users.find(
    (u) =>
      u.id === wanted ||
      u.username === wanted ||
      u.email_addresses.some((e) => e.email_address === wanted),
  );
  if (!match) throw new Error(`No Clerk user matching "${wanted}"`);
  return match;
}

const stack = localStack();
const clerkUser = resolveUser(process.argv[2]);
const userId = clerkUser.id;

// The user's own token, so every write below goes through RLS.
const db = createClient(stack.url, stack.key, {
  global: { headers: { Authorization: `Bearer ${localToken(userId, stack.secret)}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});

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
    display_name: clerkUser.username ?? clerkUser.first_name ?? "Demo",
    exam_date: "2026-11-29",
    started_on: start,
    streak_threshold: 3,
    section_floor: 85,
    target_percentile: 99,
    theme: "system",
  });
  if (error) throw new Error(`creating profile: ${error.message}`);
}

const name = clerkUser.username ?? clerkUser.email_addresses[0]?.email_address ?? userId;
const doneDays = new Set(logs.filter((l) => l.done).map((l) => l.on_day)).size;
console.log(
  [
    `seeded ${name} (${userId})`,
    `  ${logs.length} drill rows over ${DAYS} days, ${doneDays} of them past the threshold`,
    `  ${sessions.length} focus sessions`,
    "  sign in as that account to see it",
  ].join("\n"),
);
