/**
 * A signed-in browser, and the vocabulary the specs share.
 *
 * Authentication is real, and it goes through the form. An earlier version used
 * `clerk.signIn`, which mints a ticket through Clerk's backend API and calls
 * `Clerk.setActive` directly — faster, and it proved the session and the
 * Supabase JWT, but it skipped the component entirely. That mattered the moment
 * the gate started promising to return you to the page you were going to:
 * `setActive` resolves its destination from Clerk's options, so every ticket
 * sign-in landed on the fallback and the promise looked broken when it was not,
 * and would have looked fine if it had been.
 *
 * A real sign-in also gets past device trust without a bypass, because it is
 * the browser Clerk expects. `setupClerkTestingToken` stays for bot protection.
 *
 * The resulting state is captured once and reused, because signing in per test
 * is slow and the state is portable: cookies plus localStorage.
 */

import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { test as base } from "@playwright/test";
import type { Page } from "@playwright/test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { APP_URL } from "../e2e/stack.mjs";

/** Where the captured session lives between runs. Never committed. */
const STATE = "/tmp/iim-bound-browser-state.json";

/** The Clerk test account. Created by tests/e2e/clerk.mjs against the dev instance. */
export const E2E_EMAIL = process.env.E2E_CLERK_EMAIL ?? "e2e-clerk@gmail.com";

/**
 * Its password, which the suite needs only because it fills the form in.
 *
 * Clerk's device trust is switched off on the *development* instance so this
 * can work headlessly; production keeps it on, and nothing here touches
 * production.
 */
export const E2E_PASSWORD = process.env.E2E_CLERK_PASSWORD ?? "e2e-clerk-password-123";

/**
 * Type the credentials into Clerk's form and submit, as a person would.
 *
 * Assumes the page is already on /login with the form mounted, and waits until
 * Clerk has navigated away from it — wherever it was told to go. What that
 * destination is, is the caller's assertion to make.
 */
export async function submitSignInForm(page: Page) {
  await setupClerkTestingToken({ page });

  const identifier = page.locator('input[name="identifier"]');
  const password = page.locator('input[name="password"]');
  const submit = page.getByRole("button", { name: /^continue$/i }).first();

  // Clerk shows the identifier first and reveals the password field once it
  // knows whether the address exists. Both steps submit with the same button.
  await identifier.waitFor({ timeout: 30_000 });
  await identifier.fill(E2E_EMAIL);
  await submit.click();

  await password.waitFor({ timeout: 30_000 });
  await password.fill(E2E_PASSWORD);
  await submit.click();

  await page.waitForFunction(() => !window.location.pathname.startsWith("/login"), null, {
    timeout: 30_000,
  });
}

/** Sign in for real, then remember it. */
export async function signIn(page: Page) {
  await page.goto(`${APP_URL}/login`);
  await submitSignInForm(page);
  mkdirSync(dirname(STATE), { recursive: true });
  await page.context().storageState({ path: STATE });
}

type Fixtures = { page: Page };

export const test = base.extend<Fixtures>({
  page: async ({ browser }, use) => {
    if (!existsSync(STATE)) {
      const warmup = await browser.newContext();
      const page = await warmup.newPage();
      try {
        await signIn(page);
      } finally {
        await warmup.close();
      }
    }

    const context = await browser.newContext({ storageState: STATE });
    const page = await context.newPage();
    try {
      await use(page);
    } finally {
      await context.close();
    }
  },
});

/**
 * For specs that must start signed out.
 *
 * A separate object rather than a flag on the signed-in one, and deliberately
 * not decided by inspecting the test's title: an earlier version matched on a
 * substring, silently failed to match, and handed the sign-in specs an
 * authenticated browser — which then got redirected away from /login by the
 * proxy working exactly as intended. Opting out has to be explicit.
 */
export const anonTest = base.extend<Fixtures>({
  page: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await use(page);
    } finally {
      await context.close();
    }
  },
});

/** Forget the captured session, so the next run signs in from scratch. */
export function clearSession() {
  rmSync(STATE, { force: true });
}

export { expect } from "@playwright/test";

/**
 * Wait for every running animation and transition to finish.
 *
 * Not politeness — correctness of the measurement. Sections rise in over
 * ~380ms and start at zero opacity, so a screenshot taken at load catches a
 * fully opaque black rule mid-fade and reads it as mid-grey. The first version
 * of this rig reported a colour defect that did not exist for exactly this
 * reason.
 */
export async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => {})),
    ),
  );
}

export type Band = { from: number; to: number; height: number; rgb: [number, number, number] };

/**
 * Every row the browser painted as a full-width rule, grouped into vertical
 * bands, between two document offsets.
 *
 * `from`/`to` are required rather than defaulted, and that is the lesson this
 * helper exists to encode: an earlier version scanned a fixed window from the
 * top of the page, with a fixed guess at where the masthead's border lands. The
 * app's masthead is 52px tall and the demo's is 116px, because the demo carries
 * a tab strip the app does not — so a constant that looked reasonable measured
 * the wrong thing on one of them and reported "no rule found". Bounds come from
 * the element under test now.
 *
 * This asks the rendering engine rather than the layout engine. A border can
 * have a perfectly correct rectangle and still not be where the eye sees a
 * line, and the difference between those two answers is the whole reason the
 * browser suite exists.
 *
 * A row counts only if the dark pixels form one long *unbroken* run. Sampling a
 * handful of columns is not enough: the masthead's wordmark and its nav links
 * are ink-dark, so a few samples taken across the header all land on glyphs and
 * the row reads as a rule. Contiguity is what separates a line from a label —
 * prose is dark, but it is not dark from x=100 to x=900 without a gap.
 */
export async function paintedRows(
  page: Page,
  { from, to, threshold = 200, minRun = 600 }: { from: number; to: number; threshold?: number; minRun?: number },
): Promise<Band[]> {
  // The clip is taken from the live viewport, not from a constant. A clip wider
  // than the page photographs the margin beside it, where every row is
  // background — which reads as "no rules found" rather than as a broken rig.
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("paintedRows needs a fixed viewport, not a resizable one");

  const shot = await page.screenshot({
    clip: { x: 0, y: from, width: viewport.width, height: to - from },
  });

  return page.evaluate(
    async ({ url, cutoff, minRun, offset }) => {
      const img = new Image();
      img.src = url;
      await img.decode();

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, img.width, img.height);

      const isDark = (x: number, y: number) => {
        const i = (y * img.width + x) * 4;
        return data[i] < cutoff && data[i + 1] < cutoff && data[i + 2] < cutoff;
      };

      const bands: Band[] = [];
      for (let y = 0; y < img.height; y += 1) {
        // Longest unbroken dark run on this row.
        let run = 0;
        let best = 0;
        for (let x = 0; x < img.width; x += 1) {
          if (isDark(x, y)) {
            run += 1;
            if (run > best) best = run;
          } else {
            run = 0;
          }
        }
        if (best < minRun) continue;

        const last = bands[bands.length - 1];
        const absolute = y + offset;
        if (last && absolute - last.to <= 1) {
          last.to = absolute;
          last.height = last.to - last.from + 1;
        } else {
          const i = (y * img.width + Math.round(img.width / 2)) * 4;
          bands.push({
            from: absolute,
            to: absolute,
            height: 1,
            rgb: [data[i], data[i + 1], data[i + 2]],
          });
        }
      }
      return bands;
    },
    {
      url: `data:image/png;base64,${shot.toString("base64")}`,
      cutoff: threshold,
      minRun,
      offset: from,
    },
  );
}
