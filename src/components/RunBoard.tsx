"use client";

import { useEffect, useRef, useState } from "react";

/**
 * One square per day of the run.
 *
 * This is the app's central claim drawn as a picture: consistency you can see.
 * Marking the day it changes is worth a beat — but only the day that changed,
 * and only once the new value is already on screen, so the square is never
 * briefly saying something untrue.
 *
 * The grid is rendered by the server and re-rendered when a write lands. What
 * happens here is the reaction to that: a square whose level moved gets a
 * short flash, and the rest of the grid sits still. Nothing is deferred, so a
 * slow frame can never delay a number that is already correct.
 */
export type RunSquare = { day: string; done: number };

/** Stagger by day-of-week so a week landing at once arrives as a wave. */
const STAGGER_MS = 26;
const STAGGER_PERIOD = 7;

/** Stable keys for the leading weekday offset cells. */
const PAD_KEYS = ["pad-mon", "pad-tue", "pad-wed", "pad-thu", "pad-fri", "pad-sat"];

function levelOf(done: number, drills: number): number {
  return done / Math.max(1, drills);
}

export default function RunBoard({
  run,
  drills,
  today,
  leadingBlanks,
  label,
}: {
  run: RunSquare[];
  drills: number;
  today: string;
  /** Blank cells before the first day, so the grid starts on a Monday. */
  leadingBlanks: number;
  label: string;
}) {
  const previous = useRef<Map<string, number> | null>(null);
  const [marked, setMarked] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const before = previous.current;
    const now = new Map(run.map((cell) => [cell.day, cell.done]));
    previous.current = now;

    // First render has nothing to compare against, so nothing is marked.
    if (!before) return;

    const changed = new Set<string>();
    for (const [day, done] of now) {
      const was = before.get(day);
      if (was !== undefined && was !== done) changed.add(day);
    }
    if (!changed.size) return;

    setMarked(changed);
    const clear = window.setTimeout(() => setMarked(new Set()), 900);
    return () => window.clearTimeout(clear);
  }, [run]);

  return (
    <div className="grid w-max grid-flow-col grid-rows-7 gap-[4px]" role="img" aria-label={label}>
      {PAD_KEYS.slice(0, leadingBlanks).map((key) => (
        <span key={key} aria-hidden="true" className="size-[15px]" />
      ))}
      {run.map(({ day, done }, i) => {
        const level = levelOf(done, drills);
        const future = day > today;
        const marking = marked.has(day);
        return (
          <span
            key={day}
            title={`${day} — ${done} of ${drills}`}
            className={`run-square size-[15px]${marking ? " settle" : ""}`}
            style={
              {
                "--fill": level,
                outline: day === today ? "2px solid var(--signal)" : undefined,
                outlineOffset: day === today ? "1px" : undefined,
                opacity: future ? 0.4 : 1,
                // Staggered by weekday so a whole week arriving at once
                // reads as a wave rather than a flicker.
                animationDelay: marking ? `${(i % STAGGER_PERIOD) * STAGGER_MS}ms` : undefined,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
