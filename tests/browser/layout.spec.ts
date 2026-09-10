/**
 * The page furniture: rules, the masthead, the syllabus ratings.
 *
 * These are the defects that survive every other kind of test. The markup is
 * right, the HTTP status is right, and the page still looks broken — only a
 * browser layout pass can tell the difference, and only a painted-pixel scan
 * can prove it is fixed.
 */

import { expect, paintedRows, settle, test } from "./fixtures";

const APP_PAGES = ["/today", "/mocks", "/syllabus", "/errors", "/settings"];

test.describe("the rule at the top of a page", () => {
  for (const path of APP_PAGES) {
    test(`${path} shows one rule at the header seam, not two`, async ({ page, session }) => {
      void session;
      await page.goto(path);
      await settle(page);

      // Where the masthead's own rule is, read from the live layout rather than
      // assumed: the app's masthead is 52px tall and the demo's is 116px.
      const header = await page.locator("header").evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const border = Number.parseFloat(getComputedStyle(el).borderBottomWidth);
        return { ruleFrom: rect.bottom - border, ruleTo: rect.bottom };
      });

      // Structure: the content's opening rule is suppressed in CSS, so no
      // element below the masthead should be painting a heavy top border.
      const heavyBorders = await page.evaluate((below) => {
        const found: string[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>("main *"))) {
          const width = Number.parseFloat(getComputedStyle(el).borderTopWidth);
          if (width >= 3 && el.getBoundingClientRect().top - window.scrollY < below + 240) {
            found.push(`${el.tagName.toLowerCase()}.${el.className.split(" ")[0]}`);
          }
        }
        return found;
      }, header.ruleTo);
      expect(heavyBorders, "a heavy rule survived at the top of the content").toEqual([]);

      // Pixels: exactly one heavy rule is painted in the seam — the masthead's.
      // The window starts below the header's content line, because the active
      // nav item is an ink-filled box and scanning through it finds a 36px
      // "rule" that is really a selected tab.
      const bands = await paintedRows(page, {
        from: header.ruleTo - 4,
        to: header.ruleTo + 240,
      });
      const heavy = bands.filter((band) => band.height >= 3 && band.rgb[0] < 40);

      expect(
        heavy.map((b) => `y=${b.from}-${b.to} h=${b.height} rgb(${b.rgb.join(",")})`),
        `expected exactly one heavy rule at the masthead seam (rule is at ${header.ruleFrom}-${header.ruleTo}). All bands seen: ${JSON.stringify(bands)}`,
      ).toHaveLength(1);
      expect(heavy[0].height, "the masthead rule should stay 4px").toBe(4);
      expect(
        Math.abs(heavy[0].from - header.ruleFrom),
        "the surviving rule is not the masthead's",
      ).toBeLessThanOrEqual(1);
    });
  }
});

test.describe("the demo pages", () => {
  test("/demo/syllabus shows one rule at the header seam, not two", async ({ page }) => {
    await page.goto("/demo/syllabus");
    await settle(page);

    // The demo answers the same question differently: its tab strip is pulled
    // up so the active tab's underline lands *on* the masthead rule, which is
    // why the tabs read as attached to it rather than floating above it.
    const header = await page.locator("header").evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const border = Number.parseFloat(getComputedStyle(el).borderBottomWidth);
      return { ruleFrom: rect.bottom - border, ruleTo: rect.bottom };
    });

    const bands = await paintedRows(page, { from: header.ruleTo - 4, to: header.ruleTo + 240 });
    const heavy = bands.filter((band) => band.height >= 3 && band.rgb[0] < 40);

    expect(
      heavy.map((b) => `y=${b.from}-${b.to} h=${b.height}`),
      `the demo page has a doubled rule again. All bands seen: ${JSON.stringify(bands)}`,
    ).toHaveLength(1);
    expect(heavy[0].height, "the active tab's underline should reach the rule").toBe(4);
  });
  test("the active tab's underline butts against the masthead rule", async ({ page }) => {
    await page.goto("/demo/syllabus");
    await settle(page);

    const tab = page.getByRole("link", { name: "Syllabus", exact: true });
    const tabBox = await tab.boundingBox();
    const headerBox = await page.locator("header").boundingBox();

    expect(tabBox).not.toBeNull();
    expect(headerBox).not.toBeNull();

    const underlineBottom = (tabBox?.y ?? 0) + (tabBox?.height ?? 0);
    const ruleTop = (headerBox?.y ?? 0) + (headerBox?.height ?? 0) - 4;

    // The tab strip is pulled up by the header's own bottom padding so the
    // underline ends exactly where the masthead rule begins — one continuous
    // line, the active segment in signal blue. If the pull is short, the
    // underline floats and the reader sees two lines.
    expect(
      Math.abs(underlineBottom - ruleTop),
      `underline ends at y=${underlineBottom}, rule starts at y=${ruleTop}`,
    ).toBeLessThanOrEqual(1);  });
});

test.describe("the sticky header", () => {
  test("stays pinned, and stays opaque, while the page scrolls", async ({ page, session }) => {
    void session;
    await page.goto("/today");

    const header = page.locator("header");
    const before = await header.boundingBox();

    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(200);

    const after = await header.boundingBox();
    expect(Math.round(after?.y ?? -1), "header scrolled away").toBe(0);
    expect(before?.height).toBeGreaterThan(0);

    // A sticky header with a transparent background is the classic version of
    // this bug: content slides under it and the two overlap.
    const background = await header.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background, "sticky header has no background to hide content behind").not.toBe(
      "rgba(0, 0, 0, 0)",
    );
  });
});

test.describe("rating a syllabus topic", () => {
  const firstRow = (page: import("@playwright/test").Page) =>
    page.locator("main ul li").first();

  test("offers three ratings and no mystery fourth", async ({ page, session }) => {
    void session;
    await page.goto("/syllabus");
    await settle(page);

    const buttons = firstRow(page).getByRole("button");
    await expect(buttons).toHaveText(["Untouched", "Shaky", "Solid"]);

    // The old fourth button, "Automatic", sat at the top of the rating scale
    // while meaning "never rated" — so a topic that had never been touched
    // outranked one you had called solid, and padded the coverage total.
    await expect(page.getByRole("button", { name: "Automatic" })).toHaveCount(0);
  });

  test("an unrated topic reads as untouched, and the count says so", async ({ page, session }) => {
    void session;
    await page.goto("/syllabus");
    await settle(page);

    const untouched = firstRow(page).getByRole("button", { name: "Untouched" });
    await expect(untouched).toHaveAttribute("aria-pressed", "true");

    const headline = await page.locator("main h1").innerText();
    expect(headline.replace(/\s+/g, " ")).toContain("0/");
  });

  test("rating a topic survives a reload, and the count follows", async ({ page, session }) => {
    void session;
    await page.goto("/syllabus");
    await settle(page);

    const row = firstRow(page);
    const topic = (await row.locator("span").first().innerText()).trim();

    await row.getByRole("button", { name: "Solid" }).click();
    await expect(row.getByRole("button", { name: "Solid" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // A rating is a write. It has to be true on the server, not just in the
    // markup the click happened to leave behind.
    await page.reload();
    await settle(page);

    const reloaded = page.locator("main ul li", { hasText: topic }).first();
    await expect(reloaded.getByRole("button", { name: "Solid" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("main h1")).toContainText("1/");
  });
});
