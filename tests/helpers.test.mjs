/**
 * The pure helpers: the calendar, the route list, form fields, and the
 * day-window rule that decides whether a write may land.
 *
 * No infrastructure needed — these are the pieces the e2e suite assumes are
 * correct when it exercises the database, so they are worth pinning down on
 * their own. Run with `npm test`.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { PAPER } from "@/lib/cat.ts";
import { addDays, daysBetween } from "@/lib/dates.ts";
import { acceptDay, daysThrough, isDay, latestLoggableDay, MAX_DAY_SKEW, today } from "@/lib/day.ts";
import { LIMITS, number, oneOf, optionalText, text, wholeNumber } from "@/lib/form.ts";
import { mockCadence, nextSorts, phaseFor, slugify, SORT_STEP } from "@/lib/plan.ts";
import { APP_ROUTES, isAppPath, safeNext } from "@/lib/routes.ts";

test("the calendar counts days inclusively", () => {
  assert.equal(daysBetween("2026-09-01", "2026-11-29"), 89);

  // The run grid bug: an exclusive span left the exam day itself off the end.
  const run = daysThrough("2026-09-01", "2026-11-29");
  assert.equal(run.length, 90);
  assert.equal(run[0], "2026-09-01");
  assert.equal(run[run.length - 1], "2026-11-29", "the last square is the exam day");
  assert.equal(new Set(run).size, run.length, "no day is drawn twice");

  // A single day is one square, and a backwards span does not run away.
  assert.deepEqual(daysThrough("2026-09-01", "2026-09-01"), ["2026-09-01"]);
  assert.deepEqual(daysThrough("2026-09-02", "2026-09-01"), ["2026-09-02"]);
});

test("addDays crosses months, years and leap days", () => {
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29", "leap year");
  assert.equal(addDays("2026-09-10", 0), "2026-09-10");
});

test("a day is a real date, not just three numbers", () => {
  assert.ok(isDay("2026-09-10"));
  assert.ok(!isDay("2026-02-31"), "the calendar rejects it even though the shape is right");
  assert.ok(!isDay("2026-13-01"));
  assert.ok(!isDay("10/09/2026"));
  assert.ok(!isDay(""));
  assert.ok(!isDay(undefined));
  assert.ok(!isDay(20260910));
});

test("a client may name its own day, within a day of ours", () => {
  const now = today();
  assert.equal(acceptDay(now), now);
  assert.equal(acceptDay(addDays(now, 1)), addDays(now, 1), "a browser ahead of us");
  assert.equal(acceptDay(addDays(now, -1)), addDays(now, -1), "a browser behind us");

  assert.equal(acceptDay(addDays(now, MAX_DAY_SKEW + 1)), null);
  assert.equal(acceptDay(addDays(now, -MAX_DAY_SKEW - 1)), null);
  assert.equal(acceptDay("2099-01-01"), null, "a hand-written form cannot file for the future");
  assert.equal(acceptDay("not-a-date"), null);

  assert.equal(latestLoggableDay(), addDays(now, MAX_DAY_SKEW));
});

test("the route list is the one the nav and the proxy share", () => {
  assert.ok(APP_ROUTES.length > 0);
  for (const route of APP_ROUTES) {
    assert.ok(route.href.startsWith("/"), `${route.href} should be a path`);
    assert.ok(route.label.length > 0, `${route.href} needs a label`);
    assert.ok(isAppPath(route.href));
    assert.ok(isAppPath(`${route.href}/deeper`), "sub-paths are behind the wall too");
  }
  assert.ok(!isAppPath("/"), "the landing page is public");
  assert.ok(!isAppPath("/login"));
  assert.ok(!isAppPath("/demo"));
  assert.ok(!isAppPath("/todayish"), "a prefix is not a route");
});

test("a post-sign-in destination stays on this site", () => {
  assert.equal(safeNext("/mocks"), "/mocks");
  assert.equal(safeNext("/settings?tab=drills"), "/settings?tab=drills");

  // Protocol-relative URLs start with a slash and leave the site.
  assert.equal(safeNext("//evil.com"), "/today");
  assert.equal(safeNext("//evil.com/x"), "/today");
  assert.equal(safeNext("/\\evil.com"), "/today");
  assert.equal(safeNext("https://evil.com"), "/today");
  assert.equal(safeNext("javascript:alert(1)"), "/today");
  assert.equal(safeNext(null), "/today");
  assert.equal(safeNext(undefined), "/today");
  assert.equal(safeNext(""), "/today");
  assert.equal(safeNext("//evil.com", "/mocks"), "/mocks", "the fallback is honoured");
});

test("form fields are trimmed, capped and defaulted in one place", () => {
  const form = new FormData();
  form.set("name", "  Yash  ");
  form.set("long", "x".repeat(200));
  form.set("blank", "   ");
  form.set("count", "42");
  form.set("decimal", "4.5");
  form.set("huge", "9999");
  form.set("theme", "dark");
  form.set("wrong", "chartreuse");

  assert.equal(text(form.get("name"), 40), "Yash");
  assert.equal(text(form.get("long"), LIMITS.displayName).length, LIMITS.displayName);
  assert.equal(text(form.get("missing"), 40), "");
  assert.equal(optionalText(form.get("blank"), 40), null, "whitespace is absence");
  assert.equal(optionalText(form.get("name"), 40), "Yash");

  assert.equal(number(form.get("count"), 1, 10, 3), 10, "clamped to the ceiling");
  assert.equal(number(form.get("missing"), 1, 10, 3), 3, "falls back when absent");
  assert.equal(number(form.get("decimal"), 0, 100, 85), 4.5);

  // A whole number is null when it is absent OR unusable; the caller decides
  // which of those is an error.
  assert.equal(wholeNumber(form.get("count"), 0, 100), 42);
  assert.equal(wholeNumber(form.get("decimal"), 0, 100), null);
  assert.equal(wholeNumber(form.get("huge"), 0, 100), null);
  assert.equal(wholeNumber(form.get("missing"), 0, 100), null);

  assert.equal(oneOf(form.get("theme"), ["system", "light", "dark"], "system"), "dark");
  assert.equal(oneOf(form.get("wrong"), ["system", "light", "dark"], "system"), "system");
});

test("drill order is renumbered, so a tie cannot swallow a move", () => {
  assert.deepEqual(nextSorts(3), [SORT_STEP, SORT_STEP * 2, SORT_STEP * 3]);
  assert.deepEqual(nextSorts(0), []);
  assert.deepEqual(nextSorts(1), [SORT_STEP]);

  // Two drills sharing a sort used to swap identical values — a no-op. The
  // renumbering is what makes the move land, whatever the values were.
  const sorted = nextSorts(2);
  assert.notEqual(sorted[0], sorted[1]);
});

test("a drill key is derived from its label, and stays unique", () => {
  assert.equal(slugify("Quant"), "quant");
  assert.equal(slugify("  Reading   Comp  "), "reading-comp");
  assert.equal(slugify("DILR & LR"), "dilr-lr");
  assert.equal(slugify("!!!"), "drill", "a label with nothing in it still gets a key");
  assert.ok(slugify("x".repeat(80)).length <= 24);

  assert.equal(slugify("Quant", ["quant"]), "quant-2");
  assert.equal(slugify("Quant", ["quant", "quant-2"]), "quant-3");
});

test("the exam model is internally consistent", () => {
  // The paper the README describes.
  assert.equal(PAPER.VARC.questions, 24);
  assert.equal(PAPER.DILR.questions, 22);
  assert.equal(PAPER.QA.questions, 22);
  for (const section of ["VARC", "DILR", "QA"]) {
    assert.equal(PAPER[section].minutes, 40);
  }

  // Guidance phases never overlap, and the exam sits outside the taper.
  const phases = ["2026-09-01", "2026-10-25", "2026-11-20", "2026-11-27"].map(phaseFor);
  assert.deepEqual(
    phases.map((p) => p?.title),
    ["Fundamentals", "Application", "Race pace", "Taper"],
  );
  assert.equal(phaseFor("2026-08-31"), null, "before the plan starts");
  assert.equal(phaseFor("2026-11-29"), null, "exam day is not a phase");

  // Ramp up, then taper: never heavier in the last fortnight than at the peak,
  // and nothing once the exam is days away.
  assert.equal(mockCadence(120).perWeek, 1, "still building topics: one a week");
  assert.ok(mockCadence(60).perWeek >= 2, "the last two months are the mock-heavy ones");
  const peak = Math.max(...[120, 90, 60, 45, 30, 14, 7, 3, 1].map((d) => mockCadence(d).perWeek));
  assert.equal(peak, 3, "three a week at the peak");
  assert.ok(mockCadence(7).perWeek < peak, "and tapering by the last week");
  assert.equal(mockCadence(1).perWeek, 0, "no mocks in the last days");
});
