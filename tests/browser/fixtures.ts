/**
 * A signed-in browser, and the vocabulary the layout specs share.
 *
 * Authentication goes through the same real path as the HTTP suite: a
 * service-role account creation, a password sign-in, and the session written
 * into cookies in @supabase/ssr's own format. Nothing is stubbed, so a spec
 * that renders a page is proving the proxy, the layout gate, RLS and the
 * server components all agreed — not that a mock returned a fixture.
 */

import { test as base } from "@playwright/test";
import type { Page } from "@playwright/test";
import { newUser, sessionCookies } from "../e2e/client.mjs";

export type Session = Awaited<ReturnType<typeof newUser>>;

type Fixtures = {
  /** A fresh account, signed in, with the session cookies already applied. */
  session: Session;
};

export const test = base.extend<Fixtures>({
  session: async ({ context }, use) => {
    const user = await newUser();
    const cookies = sessionCookies(user.session);

    await context.addCookies(
      Object.entries(cookies).map(([name, value]) => ({
        name,
        value: String(value),
        domain: "127.0.0.1",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      })),
    );

    await use(user);
  },
});

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
