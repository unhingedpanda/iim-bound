/**
 * Form fields, read once.
 *
 * Server Actions were each re-implementing the same three moves — trim to a
 * maximum, coerce a number into a range, fall back when a value is missing —
 * in slightly different ways, which is how `display_name` ended up with no
 * server-side cap while its neighbours had one. These are the only versions.
 *
 * `max` values mirror the check constraints in supabase/migrations. If a
 * constraint moves, move the number here with it; the DB stays the backstop.
 */

export const LIMITS = {
  drillLabel: 40,
  drillBlurb: 120,
  topicName: 80,
  series: 80,
  takeaway: 300,
  mistakeNote: 2000,
  displayName: 60,
} as const;

export function text(raw: FormDataEntryValue | null, max: number): string {
  return String(raw ?? "")
    .trim()
    .slice(0, max);
}

export function optionalText(raw: FormDataEntryValue | null, max: number): string | null {
  return text(raw, max) || null;
}

/**
 * A number inside a range, or the fallback.
 *
 * An absent field falls back; a present but silly one is clamped. `Number("")`
 * is 0 rather than NaN, so blank has to be checked before the conversion or an
 * omitted field would silently become the minimum instead of the default.
 */
export function number(
  raw: FormDataEntryValue | null,
  min: number,
  max: number,
  fallback: number,
): number {
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** A whole number inside a range, or null when it is absent or unusable. */
export function wholeNumber(
  raw: FormDataEntryValue | null,
  min: number,
  max: number,
): number | null {
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

export function oneOf<T extends string>(
  raw: FormDataEntryValue | null,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = String(raw ?? "");
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function flag(raw: FormDataEntryValue | null, on = "true"): boolean {
  return raw === on || raw === "on";
}
