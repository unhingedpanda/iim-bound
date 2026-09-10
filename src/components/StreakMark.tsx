"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The streak, which is allowed to be pleased with itself.
 *
 * It moves at most once a day, and only when the work that earned it was
 * actually written — so this is the one number on the screen with room for a
 * beat. A count-up would be the obvious move and the wrong one: the figure is
 * something the person is trying to read, and reading it should never wait on
 * an animation. The number changes instantly; the mark around it settles.
 */
export default function StreakMark({ streak }: { streak: number }) {
  const [marking, setMarking] = useState(false);
  const previous = useRef<number | null>(null);

  useEffect(() => {
    const was = previous.current;
    previous.current = streak;
    // Only an increase is worth marking. A streak resetting to zero is not a
    // moment to celebrate, and a first paint has nothing to compare against.
    if (was === null || streak <= was) return;

    setMarking(true);
    const clear = window.setTimeout(() => setMarking(false), 700);
    return () => window.clearTimeout(clear);
  }, [streak]);

  return <span className={marking ? "streak-mark inline-block" : "inline-block"}>{streak}</span>;
}
