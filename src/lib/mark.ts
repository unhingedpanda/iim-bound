/**
 * The mark: geometry in one place.
 *
 * Three bars gaining, under a squared rising rule, with the tallest bar in the
 * signal blue — the run grid in miniature. Chosen over a cat because at 16px,
 * which is the size that actually matters for a favicon, this still reads:
 * the bars stay separate and the blue step survives the downscale.
 *
 * The shapes are declared once, here, and three things render them: the
 * component in the masthead and on the landing page, the favicon, and the
 * social card. `tests/helpers.test.mjs` parses `src/app/icon.svg` and checks it
 * against this file, so the file-based icon cannot drift from the drawn one.
 *
 * Coordinates are whole pixels in a 32-unit box on purpose. Fractional values
 * anti-alias into visible mush at favicon sizes, which is the one place this
 * mark has to be sharp.
 */

export type MarkRect = { x: number; y: number; w: number; h: number; tone: "paper" | "signal" };
export type MarkPath = { d: string; tone: "paper" | "signal" };

export const MARK_VIEWBOX = 32;

export const MARK_TILE = { tone: "ink" as const };

/** The three bars, shortest to tallest. The last one is the blue. */
export const MARK_BARS: MarkRect[] = [
  { x: 6, y: 21, w: 5, h: 6, tone: "paper" },
  { x: 13, y: 16, w: 5, h: 11, tone: "paper" },
  { x: 20, y: 10, w: 5, h: 17, tone: "signal" },
];

/** The rule rising left to right across the bars, squared off at the top right. */
export const MARK_RULE: MarkPath = {
  d: "M6 14 L19 5 L26 5 L26 9 L20 9 L8 17 Z",
  tone: "paper",
};

/** Fixed values for the favicon and the social card, which cannot use CSS vars. */
export const MARK_COLORS = {
  ink: "#0d0d10",
  paper: "#fbfaf7",
  signal: "#1b36ff",
} as const;

/**
 * How the mark is painted, which depends on the job rather than on the theme.
 *
 * - `tile` is the app icon. Dark tile, paper bars, blue step, identical in every
 *   context — because that is what a favicon is: a fixed asset seen against
 *   browser chrome the page does not control.
 * - `mark` is the logo sitting in the app's own masthead. No tile, bars in the
 *   current text colour, the step still blue. This is what stops the logo
 *   flipping polarity in dark mode: themed naively, the tiled version becomes a
 *   cream block with black bars, which is a different logo from the one in the
 *   tab — and being the same logo everywhere is the entire point of having one.
 */
export type MarkVariant = "tile" | "mark";

/** The mark as standalone SVG markup, for files that are not React. */
export function markSvg({
  size = MARK_VIEWBOX,
  ink = MARK_COLORS.ink,
  paper = MARK_COLORS.paper,
  signal = MARK_COLORS.signal,
  background = true,
  radius = 0,
} = {}): string {
  const tone = (value: MarkRect["tone"]) => (value === "signal" ? signal : paper);
  const rects = [
    background
      ? `<rect width="${MARK_VIEWBOX}" height="${MARK_VIEWBOX}"${radius ? ` rx="${radius}"` : ""} fill="${ink}"/>`
      : "",
    ...MARK_BARS.map(
      (bar) =>
        `<rect x="${bar.x}" y="${bar.y}" width="${bar.w}" height="${bar.h}" fill="${tone(bar.tone)}"/>`,
    ),
    `<path d="${MARK_RULE.d}" fill="${tone(MARK_RULE.tone)}"/>`,
  ].join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}" width="${size}" height="${size}" role="img" aria-label="IIM Bound">${rects}</svg>`;
}
