"use client";

import { deleteMock, setMockReviewed } from "@/app/actions";
import { ActionForm, useConfirm } from "@/components/FormFeedback";
import { summarise } from "@/lib/cat";
import type { Mock } from "@/lib/data";
import { shortDate } from "@/lib/dates";

function pct(n: number | null) {
  return n === null ? "—" : n.toFixed(2);
}

/**
 * One row of the mock log. The delete button asks once: the first click turns
 * it into an explicit "Remove this mock?" line, and the second click actually
 * removes the row. Failure stays inside the form via ActionForm's error note.
 */
export function MockRow({
  mock,
  sectionFloor,
  demo = false,
}: {
  mock: Mock;
  sectionFloor: number;
  demo?: boolean;
}) {
  const summary = summarise(mock);
  const confirmRemove = useConfirm();

  return (
    <li className="border-b border-line py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h3 className="flex flex-wrap items-baseline gap-3">
          <span className="display text-xl">{mock.series}</span>
          <span className="text-sm text-ink-3">{shortDate(mock.taken_on)}</span>
          {mock.reviewed ? null : (
            <span className="border-2 border-flag px-2 py-0.5 text-[11px] font-bold text-flag">
              unanalysed
            </span>
          )}
        </h3>
        <p className="flex items-baseline gap-2">
          <span className="display text-2xl">{summary.net ?? "—"}</span>
          <span className="text-sm text-ink-3">net</span>
          <span className="display ml-3 text-2xl">{pct(summary.percentile)}</span>
          <span className="text-sm text-ink-3">{summary.estimated ? "est." : "%ile"}</span>
        </p>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {summary.sections.map((sec) => {
          const low = sec.percentile !== null && sec.percentile < sectionFloor;
          return (
            <li
              key={sec.section}
              className="flex items-baseline justify-between gap-3 bg-paper-2 px-3 py-2 text-sm"
            >
              <span className="font-bold">{sec.section}</span>
              <span className="text-ink-2">
                {sec.attempted === null ? "—" : `${sec.correct}/${sec.attempted} · ${sec.net} net`}
              </span>
              <span className={low ? "font-bold text-flag" : ""}>{pct(sec.percentile)}</span>
            </li>
          );
        })}
      </ul>

      {mock.takeaway ? (
        <p className="mt-4 border-l-4 border-line pl-4 text-ink-2 italic">{mock.takeaway}</p>
      ) : null}

      {demo ? null : (
        <div className="mt-4 flex flex-wrap items-center gap-5 text-sm">
          <ActionForm action={setMockReviewed}>
            <input type="hidden" name="id" value={mock.id} />
            <input type="hidden" name="reviewed" value={String(!mock.reviewed)} />
            <button
              type="submit"
              className={`underline underline-offset-4 ${
                mock.reviewed ? "text-ink-3" : "font-semibold text-flag"
              }`}
            >
              {mock.reviewed ? "Mark unanalysed" : "Mark analysed"}
            </button>
          </ActionForm>

          {confirmRemove.confirming ? (
            <>
              <span className="font-semibold text-flag">Remove this mock?</span>
              <ActionForm action={deleteMock}>
                <input type="hidden" name="id" value={mock.id} />
                <button
                  type="submit"
                  onClick={() => confirmRemove.cancel()}
                  className="font-semibold text-flag"
                >
                  Yes, remove it
                </button>
              </ActionForm>
              <button
                type="button"
                onClick={() => confirmRemove.cancel()}
                className="text-ink-3 underline underline-offset-4"
              >
                Keep it
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => confirmRemove.request()}
              className="text-ink-3 underline underline-offset-4"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </li>
  );
}
