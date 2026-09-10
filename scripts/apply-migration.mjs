/**
 * Apply one migration to the hosted project, and record it.
 *
 * `supabase db push` cannot run from this network: the direct database host is
 * IPv6-only here, and the IPv4 pooler does not accept a connection either. The
 * Management API does, and it is the same route the CLI's own authenticated
 * commands use — it just happens to need an access token rather than a database
 * password.
 *
 * The SQL runs in one statement, which Postgres wraps in its own implicit
 * transaction: a migration that fails part way leaves nothing behind. The
 * schema_migrations row is written only after the SQL succeeds, so a failure
 * cannot record a migration that did not happen.
 *
 *   node scripts/apply-migration.mjs <version> [--ref <project-ref>]
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [, , version, ...rest] = process.argv;
if (!version) {
  console.error("usage: node scripts/apply-migration.mjs <version> [--ref <ref>]");
  process.exit(1);
}

const refIndex = rest.indexOf("--ref");
const ref = refIndex === -1 ? "jazfypkqpggaierwsvam" : rest[refIndex + 1];

// The CLI keeps its personal access token in the login keychain, not a file.
const token = execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-w"], {
  encoding: "utf8",
}).trim();
if (!token.startsWith("sbp_")) throw new Error("no Supabase access token in the keychain");

const file = execFileSync("ls", ["supabase/migrations"], { encoding: "utf8" })
  .split("\n")
  .find((name) => name.startsWith(`${version}_`));
if (!file) throw new Error(`no migration file for version ${version}`);
const name = file.replace(/^\d+_/, "").replace(/\.sql$/, "");
const sql = readFileSync(`supabase/migrations/${file}`, "utf8");

async function query(sqlText) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sqlText }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : null;
}

console.log(`==> applying ${file} to ${ref}`);
await query(sql);

// Recorded separately and only on success, the way the CLI does it.
await query(
  `insert into supabase_migrations.schema_migrations (version, name, statements)
   values ('${version}', '${name}', null)
   on conflict (version) do nothing`,
);

console.log(`==> recorded ${version} (${name})`);
