/**
 * Module resolution for the e2e suite.
 *
 * Two jobs:
 *
 *  1. Teach Node the app's own alias, so `@/lib/data` resolves to
 *     `src/lib/data.ts`. Nothing else in the toolchain does this outside the
 *     Next.js compiler, and without it the app's modules cannot be imported
 *     directly.
 *
 *  2. Redirect the two framework imports that only make sense inside a request:
 *     `next/headers`, which @supabase/ssr uses to read and write the session
 *     cookie, and `next/cache`, whose refresh() re-renders a client router
 *     that does not exist here. Both are plumbing, not application logic, and
 *     both are replaced with a faithful stand-in rather than a mock of the
 *     thing under test — the queries, the actions and the SQL all stay real.
 *
 * The cookie store is kept on globalThis because the resolver and the test
 * file are separate module graphs that must agree on it.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SRC = path.join(ROOT, "src");

const STUBS = {
  "next/headers": pathToFileURL(path.join(ROOT, "tests/e2e/stubs/headers.mjs")).href,
  "next/cache": pathToFileURL(path.join(ROOT, "tests/e2e/stubs/cache.mjs")).href,
};

/**
 * Extensionless imports are the app's house style — the Next.js compiler
 * resolves `./env` to `./env.ts`, and Node does not. Add the extension the
 * bundler would have added.
 */
function withExtension(file) {
  if (path.extname(file)) return file;
  for (const candidate of [`${file}.ts`, `${file}.tsx`, path.join(file, "index.ts")]) {
    if (existsSync(candidate)) return candidate;
  }
  return file;
}

export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) {
    return { url: STUBS[specifier], shortCircuit: true, format: "module" };
  }

  if (specifier.startsWith("@/")) {
    // tsconfig maps "@/*" to "./src/*".
    return nextResolve(pathToFileURL(withExtension(path.join(SRC, specifier.slice(2)))).href, context);
  }

  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const parent = path.dirname(new URL(context.parentURL).pathname);
    const resolved = withExtension(path.resolve(parent, specifier));
    if (resolved.endsWith(".ts") || resolved.endsWith(".tsx")) {
      return nextResolve(pathToFileURL(resolved).href, context);
    }
  }

  return nextResolve(specifier, context);
}
