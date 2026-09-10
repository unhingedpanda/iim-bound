"use client";

import { useActionState } from "react";
import { addMock } from "@/app/actions";
import { PAPER } from "@/lib/cat";
import { SECTIONS } from "@/lib/plan";

const FIELD =
  "w-full border-0 border-b-2 border-line bg-transparent py-2 text-base text-ink outline-none focus:border-ink";

export default function AddMockForm({ today, demo = false }: { today: string; demo?: boolean }) {
  const [state, action, isPending] = useActionState(addMock, { ok: false, error: null });

  return (
    <form action={demo ? undefined : action} className="mt-8">
      {state.error && !demo ? (
        <p role="alert" className="mb-6 border-l-4 border-flag bg-paper-2 px-4 py-3 text-flag">
          <span className="font-bold">Not saved.</span> {state.error} Nothing was written — your
          numbers are still in the form.
        </p>
      ) : null}
      <fieldset disabled={demo} className="grid gap-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:max-w-[640px]">
          <label className="grid gap-1 text-sm text-ink-2">
            Date
            <input type="date" name="taken_on" defaultValue={today} required className={FIELD} />
          </label>
          <label className="grid gap-1 text-sm text-ink-2">
            Which mock
            <input type="text" name="series" required placeholder="SimCAT 5" className={FIELD} />
          </label>
        </div>

        <div>
          <div className="hidden grid-cols-[80px_1fr_1fr_1fr] gap-4 border-b-2 border-ink pb-2 text-sm text-ink-3 sm:grid">
            <span />
            <span>Attempted</span>
            <span>Correct</span>
            <span>Percentile, if reported</span>
          </div>
          {SECTIONS.map((section) => {
            const key = section.toLowerCase();
            return (
              <div
                key={section}
                className="grid items-end gap-x-4 gap-y-3 border-b border-line py-4 sm:grid-cols-[80px_1fr_1fr_1fr]"
              >
                <span className="display text-xl">{section}</span>
                <label className="grid gap-1 text-xs text-ink-3">
                  <span className="sm:hidden">Attempted</span>
                  <input
                    type="number"
                    name={`${key}_attempted`}
                    min={0}
                    max={PAPER[section].questions}
                    placeholder={`of ${PAPER[section].questions}`}
                    className={FIELD}
                  />
                </label>
                <label className="grid gap-1 text-xs text-ink-3">
                  <span className="sm:hidden">Correct</span>
                  <input
                    type="number"
                    name={`${key}_correct`}
                    min={0}
                    max={PAPER[section].questions}
                    className={FIELD}
                  />
                </label>
                <label className="grid gap-1 text-xs text-ink-3">
                  <span className="sm:hidden">Percentile, if reported</span>
                  <input
                    type="number"
                    name={key}
                    min={0}
                    max={100}
                    step="0.01"
                    placeholder="optional"
                    className={FIELD}
                  />
                </label>
              </div>
            );
          })}
          <div className="grid items-end gap-x-4 gap-y-3 py-4 sm:grid-cols-[80px_1fr_1fr_1fr]">
            <span className="text-sm font-bold">Overall</span>
            <span className="hidden sm:block" />
            <span className="hidden sm:block" />
            <label className="grid gap-1 text-xs text-ink-3">
              <span className="sm:hidden">Overall percentile, if reported</span>
              <input
                type="number"
                name="overall"
                min={0}
                max={100}
                step="0.01"
                placeholder="optional"
                className={FIELD}
              />
            </label>
          </div>
        </div>

        <label className="grid gap-1 text-sm text-ink-2 lg:max-w-[640px]">
          The one thing to do differently next time
          <input
            type="text"
            name="takeaway"
            maxLength={300}
            placeholder="Choose the DILR set for three minutes before committing"
            className={FIELD}
          />
        </label>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="reviewed" className="size-4 accent-[var(--signal)]" />
            Already analysed in full
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="bg-ink px-6 py-3 font-semibold text-paper disabled:opacity-40"
          >
            {isPending ? "Adding…" : "Add mock"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
