/**
 * Drills and focus time, end to end through the app's own code.
 *
 * Every assertion here is about a specific way the old implementation could be
 * wrong while looking right on screen.
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { app, bindSession, refreshes } from "./app.mjs";
import { asAdmin, newUser } from "./client.mjs";

/** Sign the app in as this user, with the cookies a browser would send. */
async function actAs(user) {
  bindSession(user);
  return app();
}

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  return data;
}

const TODAY = (await app()).day.today();

describe("drills and focus time", () => {
  it("seeds a new account with the default drills, once", async () => {
    const user = await newUser();
    const a = await actAs(user);

    const first = await a.getDrills(user.id);
    assert.equal(first.length, 4, "four default drills");
    assert.deepEqual(
      first.map((d) => d.slug),
      ["qa", "dilr", "varc", "read"],
      "in their stored order",
    );

    const second = await a.getDrills(user.id);
    assert.deepEqual(
      second.map((d) => d.slug),
      first.map((d) => d.slug),
      "a second read does not duplicate them",
    );

    const { count } = await asAdmin()
      .from("user_drills")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    assert.equal(count, 4, "exactly four rows exist");
  });

  it("files a session and shows the minutes the database actually stores", async () => {
    const user = await newUser();
    const a = await actAs(user);
    await a.getDrills(user.id); // seed

    const minutes = await a.logMinutes(
      form({ drill_key: "qa", seconds: 1800, on_day: TODAY }),
    );
    assert.equal(minutes, 30, "the action returns the stored figure");

    const index = a.indexByDay(await a.getDrillRows(user.id, TODAY, TODAY));
    const drills = await a.getDrills(user.id);
    assert.equal(a.minutesOn(TODAY, index, drills), 30);
    assert.equal(a.daySummary(TODAY, index, drills).done, 0, "time alone does not tick a drill off");
    assert.ok(refreshes() > 0, "the write asked for a re-render");
  });

  it("rounds once over the day, not once per session", async () => {
    // The bug: sum(round(seconds/60)) counted two 30-second sessions as two
    // minutes. Three of them used to be three minutes for 90 seconds of work.
    const user = await newUser();
    const a = await actAs(user);
    await a.getDrills(user.id);

    for (let i = 0; i < 3; i += 1) {
      await a.logMinutes(form({ drill_key: "qa", seconds: 30, on_day: TODAY }));
    }

    const index = a.indexByDay(await a.getDrillRows(user.id, TODAY, TODAY));
    const shown = a.minutesOn(TODAY, index, (await a.getDrills(user.id)));

    const { data: sessions } = await asAdmin()
      .from("focus_sessions")
      .select("seconds")
      .eq("user_id", user.id);
    const trueSeconds = sessions.reduce((sum, s) => sum + s.seconds, 0);
    assert.equal(trueSeconds, 90, "every session row survived");
    assert.equal(shown, Math.round(trueSeconds / 60), "displayed minutes round the true total");
    assert.equal(shown, 2, "90 seconds is two minutes, not three");
  });

  it("refuses a drill key that is not this user's", async () => {
    const user = await newUser();
    const a = await actAs(user);
    await a.getDrills(user.id);

    // An unknown key is not an error worth showing — it is a stale form, and
    // the write is simply dropped.
    assert.equal(
      await a.logMinutes(form({ drill_key: "not-a-drill", seconds: 600, on_day: TODAY })),
      null,
    );
    assert.equal(await a.logMinutes(form({ drill_key: "", seconds: 600, on_day: TODAY })), null);

    const { count } = await asAdmin()
      .from("focus_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    assert.equal(count, 0, "nothing was filed");

    // And the toggle path is held to the same rule.
    await a.toggleDrill(form({ drill_key: "not-a-drill", done: "true", on_day: TODAY }));
    const { data: forgedRows } = await asAdmin()
      .from("drill_log")
      .select("drill_key")
      .eq("user_id", user.id);
    assert.deepEqual(
      forgedRows.map((r) => r.drill_key),
      [],
      "neither forged key left a row behind",
    );

    // A real key on the real day still works, so the checks above are not
    // simply refusing everything.
    assert.equal(
      await a.logMinutes(form({ drill_key: "qa", seconds: 600, on_day: TODAY })),
      10,
      "a real session is still filed",
    );
  });

  it("refuses a day that is not near today, and allows one either side", async () => {
    const user = await newUser();
    const a = await actAs(user);
    const { addDays } = await import("../../src/lib/dates.ts");
    await a.getDrills(user.id); // seed: an unknown key bails before the day check

    // A day the form should never have offered is reported, not swallowed.
    for (const far of ["2099-01-01", addDays(TODAY, -5), "not-a-date"]) {
      await assert.rejects(
        () => a.logMinutes(form({ drill_key: "qa", seconds: 600, on_day: far })),
        /within a day of today/,
        `${far} should be refused with a message`,
      );
    }
    const { count: none } = await asAdmin()
      .from("focus_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    assert.equal(none, 0, "a forged day wrote nothing");

    // A browser in another timezone can legitimately be a day off.
    assert.equal(await a.logMinutes(form({ drill_key: "qa", seconds: 60, on_day: addDays(TODAY, -1) })), 1);
    assert.equal(await a.logMinutes(form({ drill_key: "qa", seconds: 60, on_day: addDays(TODAY, 1) })), 1);
  });

  it("rejects the day at the SQL boundary too, not just in the action", async () => {
    // The RPC is reachable straight through PostgREST, so the guard has to
    // live there as well.
    const user = await newUser();
    await actAs(user);
    await (await app()).getDrills(user.id);

    const { data: forged, error } = await user.db.rpc("log_focus_session", {
      p_on_day: "2099-01-01",
      p_drill_key: "qa",
      p_seconds: 600,
    });
    assert.equal(error, null, "the call is accepted");
    assert.equal(forged, null, "but it files nothing");

    const { data: wrongKey } = await user.db.rpc("log_focus_session", {
      p_on_day: TODAY,
      p_drill_key: "someone-elses-drill",
      p_seconds: 600,
    });
    assert.equal(wrongKey, null);

    const { count } = await asAdmin()
      .from("focus_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    assert.equal(count, 0);
  });

  it("keeps logged minutes out of the totals once a drill is archived", async () => {
    // The bug: minutes were summed over every row of the day, so an archived
    // drill's time stayed in the numerator after its target left the
    // denominator — "165 / 85 minutes" on a screen promising an 85-minute day.
    const user = await newUser();
    const a = await actAs(user);
    const drills = await a.getDrills(user.id);
    const qa = drills.find((d) => d.slug === "qa");
    const read = drills.find((d) => d.slug === "read");

    await a.logMinutes(form({ drill_key: "qa", seconds: 3600, on_day: TODAY }));
    await a.logMinutes(form({ drill_key: "read", seconds: 5400, on_day: TODAY }));

    const before = a.daySummary(
      TODAY,
      a.indexByDay(await a.getDrillRows(user.id, TODAY, TODAY)),
      await a.getDrills(user.id),
    );
    assert.equal(before.minutes, 150, "90 + 60 while both are on the board");

    await a.archiveDrill(form({ id: read.id }));
    const active = await a.getDrills(user.id);
    const after = a.daySummary(
      TODAY,
      a.indexByDay(await a.getDrillRows(user.id, TODAY, TODAY)),
      active,
    );

    assert.equal(active.length, 3, "the drill is off the board");
    assert.equal(after.minutes, 60, "and so is its time");
    assert.equal(
      after.minutes,
      before.minutes - 90,
      "exactly the archived drill's minutes left the total",
    );
    // The figure and the target it is shown against now come from one set of
    // drills, so the day can no longer read as over its own target.
    assert.ok(after.minutes <= a.plan.dailyTarget(active));

    // The history is kept, which is the reason archiving exists.
    const { count } = await asAdmin()
      .from("focus_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("drill_key", "read");
    assert.equal(count, 1, "the session row survives archiving");

    // And clicking it off today still works: the key is still theirs.
    await a.toggleDrill(form({ drill_key: "read", done: "true", on_day: TODAY }));
    const { data: row } = await asAdmin()
      .from("drill_log")
      .select("done")
      .eq("user_id", user.id)
      .eq("drill_key", "read")
      .single();
    assert.equal(row.done, true, "an archived drill can still be ticked off");
    assert.equal(qa.slug, "qa");
  });

  it("reorders a board whose drills share a sort value", async () => {
    // The bug: adjacent rows swapped their `sort`, so a tie made the button a
    // silent no-op.
    const user = await newUser();
    const a = await actAs(user);
    await a.getDrills(user.id);

    // Force a tie, the way a concurrent add could have.
    await asAdmin()
      .from("user_drills")
      .update({ sort: 10 })
      .eq("user_id", user.id)
      .in("slug", ["qa", "dilr"]);

    const before = (await a.getDrills(user.id)).map((d) => d.slug);
    await a.moveDrill(form({ id: (await a.getDrills(user.id))[1].id, direction: "up" }));
    const after = (await a.getDrills(user.id)).map((d) => d.slug);

    assert.notDeepEqual(after, before, "the move actually moved something");
    assert.deepEqual(after.slice(0, 2), [before[1], before[0]], "the two swapped");

    const sorts = (await a.getDrills(user.id)).map((d) => d.sort);
    assert.equal(new Set(sorts).size, sorts.length, "the tie was healed, not preserved");
  });

  it("adds a drill with a unique key and a sort at the end", async () => {
    const user = await newUser();
    const a = await actAs(user);
    await a.getDrills(user.id);

    await a.addDrill(form({ label: "Vocabulary", target_minutes: 20 }));
    await a.addDrill(form({ label: "Vocabulary", target_minutes: 20 }));

    const drills = await a.getDrills(user.id);
    assert.equal(drills.length, 6);
    assert.deepEqual(
      drills.slice(-2).map((d) => d.slug),
      ["vocabulary", "vocabulary-2"],
      "the second gets a distinct key",
    );
    const sorts = drills.map((d) => d.sort);
    assert.deepEqual(sorts, [...sorts].sort((x, y) => x - y), "sorted ascending");
    assert.equal(new Set(sorts).size, sorts.length, "and distinct");
  });
});

after(async () => {
  // Nothing global to tear down: every test makes its own user, and the local
  // database is disposable. Kept so the file has an obvious end.
  assert.ok(true);
});
