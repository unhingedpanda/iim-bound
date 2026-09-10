/**
 * Registers the "@/" alias resolver for the fast test runner.
 *
 * Used via `node --import ./tests/resolver-loader.mjs`. ESM resolves a file's
 * static imports before its body runs, so a test file cannot install the hook
 * itself and then import application code that uses the alias.
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(pathToFileURL(new URL("./e2e/resolver.mjs", import.meta.url).pathname), import.meta.url);
