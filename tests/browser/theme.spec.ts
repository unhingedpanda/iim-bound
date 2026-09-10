/**
 * The palette, in both directions.
 *
 * Colour is defined three times — light, a `prefers-color-scheme` dark, and an
 * explicit `[data-theme="dark"]` — and the profile's choice is applied by an
 * inline script before paint. Three sources for one decision is exactly the
 * arrangement where a stale copy wins silently, so these assertions are about
 * which one actually took effect, not about whether the CSS parses.
 *
 * The colour scheme is driven here rather than inherited from a project, so
 * light and dark are both asserted from one run instead of being split across
 * configurations that can quietly disagree.
 */

import { expect, settle, test } from "./fixtures";

const PAPER_LIGHT = "rgb(251, 250, 247)";
const PAPER_DARK = "rgb(11, 11, 14)";

const paper = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("the system preference", () => {
  test("light and dark are different pages", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/login");
    await settle(page);
    const light = await paper(page);

    await page.emulateMedia({ colorScheme: "dark" });
    await settle(page);
    const dark = await paper(page);

    expect(light).toBe(PAPER_LIGHT);
    expect(dark).toBe(PAPER_DARK);
  });
});

test.describe("the profile's own choice", () => {
  test("beats the system preference, and survives a reload", async ({ page }) => {
    await page.goto("/settings");
    await settle(page);

    // The harness's browser prefers light, which is the interesting case: an
    // explicit choice has to win over a contrary system setting.
    await page.emulateMedia({ colorScheme: "light" });
    expect(await paper(page)).toBe(PAPER_LIGHT);

    await page.getByLabel("Appearance").selectOption("dark");
    await page.getByRole("button", { name: "Save settings" }).click();

    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme), { timeout: 10_000 })
      .toBe("dark");

    // Persisted, not just applied to the document in front of us.
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme), { timeout: 10_000 })
      .toBe("dark");
    expect(await paper(page), "the explicit choice did not win over the system").toBe(PAPER_DARK);
  });
});
