/**
 * Browser tests: the layer the Node suite structurally cannot reach.
 *
 * Everything under tests/e2e/*.test.mjs drives the app over HTTP, which proves
 * what the server sent. It cannot prove what the browser then *did* with it —
 * whether two rules landed on the same pixel, whether a sticky header actually
 * stuck, whether a control is reachable on a phone. Those are the failures a
 * person notices first and a DOM string match never sees.
 *
 * So this suite exists for geometry, layout and interaction, and it deliberately
 * does not re-test what the HTTP suite already covers. It runs against the same
 * production build on the same port, over the same local stack.
 *
 *   npm run test:browser
 *
 * Two projects, not three. The theme specs drive `colorScheme` themselves rather
 * than depending on a project-level setting, so light and dark behaviour is
 * asserted from one run instead of being split across configurations that can
 * disagree.
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.TEST_APP_PORT ?? 3100);

export default defineConfig({
  testDir: "./tests/browser",
  // Mints Clerk's testing token once per run; see the file for why.
  globalSetup: "./tests/browser/global-setup.ts",
  // The stack, the build and the migrations are the harness's job; this suite
  // only drives a browser. Serial because each spec writes to one shared
  // database, and a parallel worker would see another spec's rows.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  // Generous: the harness in front of this rebuilds the app and resets the
  // database, so the first navigation can wait a while for the server.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      // Everything that does not need a phone. Matched by exclusion so a new
      // spec runs here by default rather than silently running nowhere.
      name: "desktop",
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      // The app is used on a phone between classes, and the mobile nav is a
      // different component. It needs its own pass, not a resize.
      name: "phone",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
