/**
 * Loader bootstrap.
 *
 * The app's modules only resolve once the `@/` alias hook is installed, and
 * `--import` does not reach the module graph of a test file. So the hook is
 * registered in-process, from the helper every test file already imports
 * (`./app.mjs`), before it imports any application code.
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

let installed = false;

export function installResolver() {
  if (installed || globalThis.__E2E_RESOLVER__) return;
  register(pathToFileURL(new URL("./resolver.mjs", import.meta.url).pathname), import.meta.url);
  installed = true;
  globalThis.__E2E_RESOLVER__ = true;
}
