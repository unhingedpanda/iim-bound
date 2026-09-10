/**
 * One master clock.
 *
 * Every date in this app is a plain YYYY-MM-DD in the user's own day, and the
 * server runs on UTC. Two rules keep the two from disagreeing:
 *
 *  1. The server's opinion of "today" is the India day. That is what steaks,
 *     the countdown and the run grid are measured in, and it is stable no
 *     matter which region renders the page.
 *  2. A client may name its own day — a phone in London at 23:00 is already on
 *     tomorrow's date in Kolkata — so we accept the client's day when it is
 *     within a day either side of ours, and refuse anything further out. That
 *     window is wide enough for every real timezone and narrow enough that a
 *     forged form post cannot write a row for 2099.
 *
 * Everything that needs "what day is it" goes through here, so the tolerance
 * and the timezone are decided once rather than per call site.
 */

import { addDays, daysBetween } from "@/lib/dates";

export const DAY_ZONE = "Asia/Kolkata";

/** How far a client's day may differ from the server's before we refuse it. */
export const MAX_DAY_SKEW = 1;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today, in the app's own zone. */
export function today(): string {
  // Assembled from parts rather than trusting a locale's field order, so no
  // ICU version can silently rearrange the day.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DAY_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isDay(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_RE.test(value)) return false;
  // The shape can be right while the calendar is not: 2026-02-31 and
  // 2026-13-01 both match the regex. A round trip asks the calendar itself,
  // and an unparseable date makes toISOString throw — which is the "not a day"
  // answer we want, rather than an error escaping into a request.
  try {
    return addDays(value, 0) === value;
  } catch {
    return false;
  }
}

/**
 * The latest day a write may land on.
 *
 * One past "today" rather than today, because the client's calendar is the one
 * the person is looking at: a phone in Auckland at 09:00 is already on the
 * next date while this server is still on the previous one. A bigger window
 * buys nothing and lets a hand-written form file a mock for next month.
 */
export function latestLoggableDay(): string {
  return addDays(today(), MAX_DAY_SKEW);
}

/** A client-named day, or null if it is malformed or too far from ours. */
export function acceptDay(value: unknown, relativeTo: string = today()): string | null {
  if (!isDay(value)) return null;
  const drift = Math.abs(daysBetween(value, relativeTo));
  return drift <= MAX_DAY_SKEW ? value : null;
}

/**
 * Every day from `from` through `to`, both included. The run grid needs an
 * inclusive span: daysBetween() is end-exclusive, which is what left the exam
 * day itself off the end of the grid.
 */
export function daysThrough(from: string, to: string): string[] {
  const total = daysBetween(from, to);
  if (total < 0) return [from];
  return Array.from({ length: total + 1 }, (_, i) => addDays(from, i));
}
