import { redirect } from "next/navigation";
import {
  addDrill,
  archiveDrill,
  moveDrill,
  restartRun,
  updateDrill,
  updateSettings,
} from "@/app/actions";
import { getDrills, getProfile } from "@/lib/data";
import { longDate } from "@/lib/dates";
import { dailyTarget } from "@/lib/plan";
import { currentUserId } from "@/lib/supabase/server";

export const metadata = { title: "Settings · CAT Register" };

const FIELD =
  "w-full border-0 border-b-2 border-line bg-transparent py-2 text-base text-ink outline-none focus:border-ink";

export default async function SettingsPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/login");

  const [profile, drills] = await Promise.all([getProfile(userId), getDrills(userId)]);
  const total = dailyTarget(drills);

  return (
    <main className="pb-10">
      <section className="rule-heavy mt-8 pt-5">
        <h1 className="display text-[clamp(36px,7vw,72px)]">Settings</h1>
        <p className="mt-3 max-w-[60ch] text-ink-2">
          CAT is fixed — three sections, one date, one set of cutoffs. Everything you ask of
          yourself around it is yours to set.
        </p>
      </section>

      <section className="mt-14" aria-labelledby="drills-h">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
          <h2 id="drills-h" className="display text-[clamp(24px,4vw,36px)]">
            Your daily drills
          </h2>
          <p className="text-sm text-ink-2">
            {drills.length} drills · {total} minutes a day
          </p>
        </div>

        <ul className="mt-2">
          {drills.map((drill, i) => (
            <li key={drill.id} className="border-b border-line py-4">
              <form action={updateDrill} className="grid gap-3 md:grid-cols-[1fr_1.4fr_110px_auto]">
                <input type="hidden" name="id" value={drill.id} />
                <label className="grid gap-1 text-xs text-ink-3">
                  Name
                  <input name="label" defaultValue={drill.label} required className={FIELD} />
                </label>
                <label className="grid gap-1 text-xs text-ink-3">
                  Note to yourself
                  <input name="blurb" defaultValue={drill.blurb ?? ""} className={FIELD} />
                </label>
                <label className="grid gap-1 text-xs text-ink-3">
                  Minutes
                  <input
                    name="target_minutes"
                    type="number"
                    min={1}
                    max={600}
                    defaultValue={drill.target_minutes}
                    className={FIELD}
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="bg-ink px-4 py-2 text-sm font-semibold text-paper"
                  >
                    Save
                  </button>
                </div>
              </form>

              <div className="mt-2 flex flex-wrap gap-4 text-sm text-ink-3">
                {i > 0 ? (
                  <form action={moveDrill}>
                    <input type="hidden" name="id" value={drill.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" className="underline underline-offset-4">
                      Move up
                    </button>
                  </form>
                ) : null}
                {i < drills.length - 1 ? (
                  <form action={moveDrill}>
                    <input type="hidden" name="id" value={drill.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button type="submit" className="underline underline-offset-4">
                      Move down
                    </button>
                  </form>
                ) : null}
                <form action={archiveDrill}>
                  <input type="hidden" name="id" value={drill.id} />
                  <button type="submit" className="underline underline-offset-4">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>

        <form action={addDrill} className="mt-6 grid gap-3 md:grid-cols-[1fr_1.4fr_110px_auto]">
          <label className="grid gap-1 text-xs text-ink-3">
            New drill
            <input name="label" placeholder="Vocabulary" required className={FIELD} />
          </label>
          <label className="grid gap-1 text-xs text-ink-3">
            Note to yourself
            <input name="blurb" placeholder="20 words, revised twice" className={FIELD} />
          </label>
          <label className="grid gap-1 text-xs text-ink-3">
            Minutes
            <input
              name="target_minutes"
              type="number"
              min={1}
              max={600}
              defaultValue={30}
              className={FIELD}
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className="border-2 border-ink px-4 py-2 text-sm font-semibold">
              Add drill
            </button>
          </div>
        </form>

        <p className="mt-3 text-sm text-ink-3">
          Removing a drill hides it from Today and keeps everything you already logged against it.
        </p>
      </section>

      <section className="mt-16" aria-labelledby="targets-h">
        <div className="border-b-2 border-ink pb-3">
          <h2 id="targets-h" className="display text-[clamp(24px,4vw,36px)]">
            Your targets
          </h2>
        </div>

        <form action={updateSettings} className="mt-6 grid max-w-[760px] gap-6 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-ink-2">
            Name (optional)
            <input
              name="display_name"
              defaultValue={profile.display_name ?? ""}
              className={FIELD}
            />
          </label>

          <label className="grid gap-1 text-sm text-ink-2">
            Exam date
            <input
              name="exam_date"
              type="date"
              defaultValue={profile.exam_date}
              required
              className={FIELD}
            />
            <span className="text-xs text-ink-3">
              Every countdown and the run grid measure to this.
            </span>
          </label>

          <label className="grid gap-1 text-sm text-ink-2">
            Drills needed to keep a streak
            <input
              name="streak_threshold"
              type="number"
              min={1}
              max={Math.max(1, drills.length)}
              defaultValue={profile.streak_threshold}
              className={FIELD}
            />
            <span className="text-xs text-ink-3">
              Out of {drills.length}. Lower means one bad evening doesn&rsquo;t reset you.
            </span>
          </label>

          <label className="grid gap-1 text-sm text-ink-2">
            Sectional percentile floor
            <input
              name="section_floor"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={profile.section_floor}
              className={FIELD}
            />
            <span className="text-xs text-ink-3">Any mock section below this is flagged red.</span>
          </label>

          <label className="grid gap-1 text-sm text-ink-2">
            Overall percentile you&rsquo;re aiming at
            <input
              name="target_percentile"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={profile.target_percentile}
              className={FIELD}
            />
            <span className="text-xs text-ink-3">Drawn as the top line on the mock chart.</span>
          </label>

          <label className="grid gap-1 text-sm text-ink-2">
            Appearance
            <select name="theme" defaultValue={profile.theme} className={FIELD}>
              <option value="system">Match my device</option>
              <option value="light">Always light</option>
              <option value="dark">Always dark</option>
            </select>
          </label>

          <button
            type="submit"
            className="justify-self-start bg-ink px-6 py-3 font-semibold text-paper sm:col-span-2"
          >
            Save settings
          </button>
        </form>
      </section>

      <section className="mt-16" aria-labelledby="run-h">
        <div className="border-b-2 border-ink pb-3">
          <h2 id="run-h" className="display text-[clamp(24px,4vw,36px)]">
            Your run
          </h2>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-[52ch] text-ink-2">
            Started {longDate(profile.started_on)}. Restarting moves the first square of the grid to
            today — your logged days and mocks are kept.
          </p>
          <form action={restartRun}>
            <button type="submit" className="border-2 border-ink px-5 py-3 text-sm font-semibold">
              Restart the run today
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
