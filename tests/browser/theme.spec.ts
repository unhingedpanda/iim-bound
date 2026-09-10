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

import { anonTest, expect, settle, test } from "./fixtures";

const PAPER_LIGHT = "rgb(251, 250, 247)";
const PAPER_DARK = "rgb(11, 11, 14)";

const paper = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("the system preference", () => {
  // Signed out, and it has to be. The signed-in fixture would be redirected off
  // /login and onto a page where the profile's own choice applies — so this
  // test was silently measuring the wrong one of the three sources, and passed
  // only while the shared profile happened to still say "system". The next test
  // in this file sets it to dark, which is why running the file twice failed.
  anonTest("light and dark are different pages", async ({ page }) => {
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
    // "system" is expressed by *removing* the attribute, so the absent case has
    // to read back as the value that produced it, or the assertion below is
    // comparing against something the app never sets.
    const theme = () =>
      page.evaluate(() => document.documentElement.dataset.theme ?? "system");
    const save = async (choice: string) => {
      await page.getByLabel("Appearance").selectOption(choice);
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect.poll(theme, { timeout: 10_000 }).toBe(choice);
    };

    await page.goto("/settings");
    await settle(page);

    // One account is shared by the whole suite, so the profile arrives holding
    // whatever the previous run saved. Establishing the starting point is part
    // of the test: an earlier version assumed the default and failed on the
    // second run of the same file, which is a test that only works once.
    await page.emulateMedia({ colorScheme: "light" });
    await save("light");

    // The interesting case: an explicit choice against a contrary system
    // setting. If the profile's value were merely the default, this would pass
    // without proving anything.
    await save("dark");
    expect(await paper(page), "the explicit choice did not win over the system").toBe(PAPER_DARK);

    // Persisted, not just applied to the document in front of us.
    await page.reload();
    await expect.poll(theme, { timeout: 10_000 }).toBe("dark");
    expect(await paper(page)).toBe(PAPER_DARK);

    // Leave the account as it was found, so the next run starts from the same
    // place this one did.
    await save("system");
  });
});
