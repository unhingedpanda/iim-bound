/**
 * The phone layout, which is not the desktop layout resized.
 *
 * The app is explicitly built for a phone between classes, and the mobile
 * navigation is a different component with a different job: reachable with a
 * thumb, and never covering the thing you are reading. None of that is
 * visible to a desktop viewport or an HTTP test.
 */

import { expect, test } from "./fixtures";

test.describe("on a phone", () => {
  test("the desktop nav is hidden and the tab bar is not", async ({ page, session }) => {
    void session;
    await page.goto("/today");

    // DesktopNav is `hidden sm:flex`; the mobile bar is `sm:hidden`. If either
    // breakpoint regresses, both render and the header doubles up.
    const desktopNav = page.locator("header ul");
    await expect(desktopNav).toBeHidden();

    const tabBar = page.getByRole("navigation", { name: "Sections" });
    await expect(tabBar).toBeVisible();
  });

  test("every tab is a comfortable thumb target", async ({ page, session }) => {
    void session;
    await page.goto("/today");

    const tabBar = page.getByRole("navigation", { name: "Sections" });
    const tabs = tabBar.getByRole("link");
    await expect(tabs).toHaveCount(5);

    for (const tab of await tabs.all()) {
      const box = await tab.boundingBox();
      expect(box, "a tab has no box").not.toBeNull();
      // 44px is the usual minimum; the bar is sized for a thumb, not a cursor.
      expect(box?.height ?? 0, `tab "${await tab.textContent()}" is too short`).toBeGreaterThanOrEqual(
        44,
      );
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("the tab bar sits at the bottom edge and the page scrolls clear of it", async ({
    page,
    session,
  }) => {
    void session;
    await page.goto("/today");

    const viewport = page.viewportSize();
    const tabBar = page.getByRole("navigation", { name: "Sections" });
    const box = await tabBar.boundingBox();

    expect(box).not.toBeNull();
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(viewport?.height);

    // The shell reserves bottom padding so the last control can be scrolled
    // clear of a fixed bar rather than sitting permanently underneath it. A
    // fixed bar with no reserved space is a trap: the control is visible and
    // unclickable, and no HTTP test can see it.
    const barHeight = box?.height ?? 0;
    const shell = page.locator("main").locator("xpath=..");
    const paddingBottom = await shell.evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).paddingBottom),
    );

    expect(paddingBottom, "shell reserves no room for the fixed tab bar").toBeGreaterThanOrEqual(
      barHeight,
    );
  });

  test("the active tab is the current page", async ({ page, session }) => {
    void session;
    await page.goto("/syllabus");

    const active = page.getByRole("navigation", { name: "Sections" }).locator('[aria-current="page"]');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveText("Syllabus");
  });
});
