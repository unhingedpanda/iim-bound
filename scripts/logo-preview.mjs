/**
 * Render the logo candidates so they can be judged as pixels.
 *
 * Design by eye, not by description: a mark that looks fine at 512 is often
 * mud at 16, and the favicon is the size that matters most here. This paints
 * one page with the app's real palette and typography, screenshots it, then
 * cuts per-size crops so the comparison is honest rather than hand-waved.
 *
 *   node scripts/logo-preview.mjs
 */

import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const OUT = process.env.LOGO_OUT ?? "/tmp/iim-bound-logo-preview";
mkdirSync(OUT, { recursive: true });

/* ---- the three directions, each as a self-contained mark ---------------- */

// A. The exam's own animal, reduced to geometry. Flat, no curves, no strokes
//    below 24px — every edge is axis-aligned or one triangle.
const catBlock = (ink, paper) => `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" fill="${ink}"/>
  <path d="M14 30 L14 12 L26 22 Z" fill="${paper}"/>
  <path d="M50 30 L50 12 L38 22 Z" fill="${paper}"/>
  <rect x="14" y="22" width="36" height="26" fill="${paper}"/>
  <rect x="22" y="30" width="6" height="8" fill="${ink}"/>
  <rect x="36" y="30" width="6" height="8" fill="${ink}"/>
  <path d="M30 40 L34 40 L32 45 Z" fill="${ink}"/>
</svg>`;

// B. A bar gaining a bar — the run grid abstracted to three columns and a
//    rising rule. Reads as progress at any size, and nods at the block meter.
const barsMark = (ink, paper, signal) => `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" fill="${ink}"/>
  <rect x="12" y="40" width="10" height="12" fill="${paper}"/>
  <rect x="27" y="30" width="10" height="22" fill="${paper}"/>
  <rect x="42" y="18" width="10" height="34" fill="${signal}"/>
  <path d="M12 26 L42 8 L52 8 L52 15 L42 15 L17 30 Z" fill="${paper}"/>
</svg>`;

// C. The letterform. "IIM" as three columns over an ascending rule — the most
//    editorial of the three, and the quietest.
const iimMark = (ink, paper, signal) => `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" fill="${ink}"/>
  <rect x="13" y="14" width="7" height="28" fill="${paper}"/>
  <rect x="28" y="14" width="7" height="28" fill="${paper}"/>
  <rect x="43" y="14" width="7" height="28" fill="${signal}"/>
  <path d="M11 48 L53 48 L48 54 L16 54 Z" fill="${paper}"/>
</svg>`;

const CANDIDATES = [
  {
    key: "A",
    name: "The animal, as geometry",
    note: "CAT, reduced to blocks and two triangles. Bluntest read at 16px.",
    svg: catBlock,
  },
  {
    key: "B",
    name: "A bar gaining a bar",
    note: "The run grid as a mark, with the arrow as the one blue thing.",
    svg: barsMark,
  },
  {
    key: "C",
    name: "Three columns and a rule",
    note: "The letterform, in the app's own rule-and-block language.",
    svg: iimMark,
  },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 2000 } });

await page.setContent(`
<style>
  @font-face { font-family: x; src: local("Archivo"); }
  :root { --paper:#fbfaf7; --ink:#0d0d10; --signal:#1b36ff; --ink-3:#6f6f7d; --line:#d9d5cb; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink);
         font-family: "Helvetica Neue", Arial, sans-serif; -webkit-font-smoothing:antialiased; }
  .wrap { padding: 40px 48px 56px; }
  h1 { font-size: 15px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-3);
       font-weight:700; margin:0 0 4px; }
  .sub { color:var(--ink-3); font-size:13px; margin:0 0 28px; }
  .card { border-top:4px solid var(--ink); padding-top:18px; margin-bottom:44px; }
  .row { display:flex; align-items:flex-start; gap:40px; }
  .marks { display:flex; align-items:flex-end; gap:26px; }
  .sizes { display:flex; gap:26px; margin-top:26px; align-items:flex-end; }
  .sizes figure, .marks figure { margin:0; text-align:center; }
  .sizes figcaption, .marks figcaption { font-size:10px; color:var(--ink-3); margin-top:7px;
       letter-spacing:.06em; text-transform:uppercase; }
  .meta { flex:1; min-width:0; }
  .title { font-size:27px; font-weight:800; letter-spacing:-.02em; margin:0 0 5px; }
  .note { color:#4a4a55; font-size:13.5px; margin:0; max-width:46ch; line-height:1.5; }
  /* the mark inside a real browser tab, at true size */
  .tab { display:inline-flex; align-items:center; gap:8px; background:#dee1e6; border-radius:8px 8px 0 0;
         padding:7px 14px 8px 11px; font-size:12px; color:#1f1f1f; margin-top:22px; }
  .tab svg { width:16px; height:16px; display:block; }
  /* and in the app's masthead, beside the real wordmark */
  .masthead { display:flex; align-items:center; gap:11px; margin-top:18px; }
  .wordmark { font-size:21px; font-weight:800; letter-spacing:-.03em; font-stretch:112%; }
</style>
<div class="wrap">
  <h1>IIM Bound — mark candidates</h1>
  <p class="sub">Rendered at true size. Shown at 128, 64, 32 and 16px, in a browser tab, and in the masthead.</p>
  ${CANDIDATES.map(
    (c) => `
  <section class="card">
    <div class="row">
      <div>
        <div class="marks">
          ${[
            [128, "128"],
            [64, "64"],
            [32, "32"],
          ]
            .map(
              ([s, label]) =>
                `<figure>${c.svg("var(--ink)", "var(--paper)", "var(--signal)").replace("<svg", `<svg width="${s}" height="${s}"`)}<figcaption>${label}</figcaption></figure>`,
            )
            .join("")}
        </div>
        <div class="sizes">
          ${[16, 24]
            .map(
              (s) =>
                `<figure>${c.svg("var(--ink)", "var(--paper)", "var(--signal)").replace("<svg", `<svg width="${s}" height="${s}"`)}<figcaption>${s}</figcaption></figure>`,
            )
            .join("")}
          <figure style="text-align:left">
            <span class="tab">${c.svg("var(--ink)", "var(--paper)", "var(--signal)").replace("<svg", '<svg width="16" height="16"')}IIM Bound</span>
            <figcaption>in a tab</figcaption>
          </figure>
        </div>
        <div class="masthead">
          ${c.svg("var(--ink)", "var(--paper)", "var(--signal)").replace("<svg", '<svg width="26" height="26"')}
          <span class="wordmark">IIM Bound</span>
        </div>
      </div>
      <div class="meta">
        <div class="title">${c.key}. ${c.name}</div>
        <p class="note">${c.note}</p>
      </div>
    </div>
  </section>`,
  ).join("")}
</div>
`);

await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/contact-sheet.png`, fullPage: true });
console.log(`wrote ${OUT}/contact-sheet.png`);

await browser.close();
