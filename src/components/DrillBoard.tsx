"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { logMinutes, toggleDrill } from "@/app/actions";
import type { Drill } from "@/lib/plan";

export type DrillState = { minutes: number; done: boolean };

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DrillBoard({
  day,
  drills,
  initial,
  readOnly = false,
}: {
  day: string;
  drills: Drill[];
  initial: Record<string, DrillState>;
  readOnly?: boolean;
}) {
  const [state, setState] = useState(initial);
  const [running, setRunning] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [, startTransition] = useTransition();
  const startedAt = useRef<number>(0);

  useEffect(() => setState(initial), [initial]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // A timer left running through a reload would lose its minutes silently.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  function start(key: string) {
    if (running) stop();
    startedAt.current = Date.now();
    setElapsed(0);
    setRunning(key);
  }

  function stop() {
    const key = running;
    if (!key) return;
    const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
    setRunning(null);
    setElapsed(0);
    if (seconds < 30) return; // too short to be a session

    setState((prev) => ({
      ...prev,
      [key]: {
        minutes: (prev[key]?.minutes ?? 0) + Math.round(seconds / 60),
        done: prev[key]?.done ?? false,
      },
    }));

    if (readOnly) return;
    const form = new FormData();
    form.set("drill_key", key);
    form.set("seconds", String(seconds));
    form.set("on_day", day);
    startTransition(() => {
      void logMinutes(form);
    });
  }

  function toggle(key: string) {
    const next = !(state[key]?.done ?? false);
    setState((prev) => ({
      ...prev,
      [key]: { minutes: prev[key]?.minutes ?? 0, done: next },
    }));

    if (readOnly) return;
    const form = new FormData();
    form.set("drill_key", key);
    form.set("done", String(next));
    form.set("on_day", day);
    startTransition(() => {
      void toggleDrill(form);
    });
  }

  return (
    <ul className="grid gap-6">
      {drills.map((drill) => {
        const current = state[drill.slug] ?? { minutes: 0, done: false };
        const live = running === drill.slug ? Math.floor(elapsed / 60) : 0;
        const minutes = current.minutes + live;
        const pct = Math.min(100, Math.round((minutes / drill.target_minutes) * 100));

        return (
          <li key={drill.id} className="rule-light pt-5">
            <div className="flex items-start justify-between gap-4">
              <button
                type="button"
                onClick={() => toggle(drill.slug)}
                aria-pressed={current.done}
                className="flex items-center gap-3 text-left"
              >
                <span
                  aria-hidden="true"
                  className={`size-5 shrink-0 border-2 ${
                    current.done ? "border-signal bg-signal" : "border-ink bg-transparent"
                  }`}
                />
                <span
                  className={`display text-[clamp(22px,3.2vw,32px)] ${
                    current.done ? "text-ink-2" : ""
                  }`}
                >
                  {drill.label}
                </span>
              </button>

              <div className="flex shrink-0 items-center gap-3">
                <span className="whitespace-nowrap text-sm text-ink-2">
                  {minutes} / {drill.target_minutes} min
                </span>
                {running === drill.slug ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="whitespace-nowrap bg-signal px-4 py-2 text-sm font-semibold text-signal-ink"
                  >
                    Stop {clock(elapsed)}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => start(drill.slug)}
                    className="whitespace-nowrap border-2 border-ink px-4 py-2 text-sm font-semibold"
                  >
                    Start
                  </button>
                )}
              </div>
            </div>

            <p className="mt-1 pl-8 text-sm text-ink-3">{drill.blurb}</p>

            <span className="meter mt-3" data-done={current.done} aria-hidden="true">
              <span style={{ "--fill": pct / 100 } as React.CSSProperties} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
