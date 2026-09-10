/**
 * Test credentials, read once.
 *
 * The suite runs against the local Supabase stack (`npm run test:up`), never
 * against a hosted project: every test makes users and rows, and the keys
 * below are the CLI's well-known local ones.
 *
 * For production the app reads NEXT_PUBLIC_SUPABASE_URL/…_KEY. Tests read
 * SUPABASE_TEST_* so a developer's .env.local cannot quietly point them
 * somewhere real.
 */

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Run \`npm run test:up\` first — it starts the local Supabase stack and prints these values.`,
    );
  }
  return value;
}

export const API_URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:55321";
export const PUBLISHABLE_KEY =
  process.env.SUPABASE_TEST_PUBLISHABLE_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
export const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY ?? required("SUPABASE_TEST_SERVICE_KEY");

/** Mirrors supabase/config.toml — this project's own port namespace. */
export const DB_URL =
  process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

/** Where the test Next server listens, and what it calls its own origin. */
export const APP_PORT = Number(process.env.TEST_APP_PORT ?? 3100);
export const APP_URL = `http://localhost:${APP_PORT}`;
