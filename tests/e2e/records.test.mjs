/**
 * Mock logging, settings, and the syllabus — through the app's own actions,
 * against the real database.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { app, bindSession } from "./app.mjs";
import { asAdmin, newUser } from "./client.mjs";

async function actAs(user) {
  bindSession(user);
  return app();
}

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  return data;
}

const EMPTY = { ok: false, error: null };

describe("mocks", () => {
  it("saves a whole paper and derives the percentile off the curves", async () => {
    const user = await newUser();
    const a = await actAs(user);

    const result = await a.addMock(
      EMPTY,
      form({
        taken_on: a.day.today(),
        series: "SimCAT 5",
        varc_attempted: 18,
        varc_correct: 15,
        dilr_attempted: 12,
        dilr_correct: 9,
        qa_attempted: 14,
        qa_correct: 10,
      }),
    );
    assert.deepEqual(result, { ok: true, error: null });

    const [mock] = await a.getMocks(user.id);
    assert.equal(mock.series, "SimCAT 5");
    const summary = a.cat.summarise(mock);
    assert.equal(summary.net, 42 + 24 + 26);
    assert.equal(summary.complete, true);
    assert.equal(summary.sectionsLogged, 3);
    assert.ok(summary.estimated && summary.percentile !== null);
  });

  it("keeps a sectional test as a mock, without inventing an overall", async () => {
    // The bug: net was only computed when all three sections were present, so
    // a section test summarised to nothing and the hero said "no mock logged
    // yet" while the row sat in the log below it.
    const user = await newUser();
    const a = await actAs(user);

    const result = await a.addMock(
      EMPTY,
      form({
        taken_on: a.day.today(),
        series: "VARC sectional",
        varc_attempted: 24,
        varc_correct: 20,
      }),
    );
    assert.equal(result.ok, true);

    const [mock] = await a.getMocks(user.id);
    const summary = a.cat.summarise(mock);

    assert.equal(summary.net, 56, "the section's net is still a net");
    assert.equal(summary.sectionsLogged, 1);
    assert.equal(summary.complete, false);
    assert.equal(summary.scored, true, "it is a mock, not nothing");
    assert.equal(summary.percentile, null, "no whole-paper percentile from a part paper");

    // And the figure that IS shown says what it is: 56 is past the top anchor.
    assert.equal(summary.sections[0].percentile, 99.9);
    assert.equal(summary.sections[0].basis, "ceiling");
    assert.equal(a.cat.paperMarks(1), 72, "shown against the right ceiling, not /204");
    assert.equal(a.cat.paperMarks(3), a.cat.TOTAL_MARKS);
  });

  it("reports nonsense numbers instead of writing them", async () => {
    const user = await newUser();
    const a = await actAs(user);
    const day = a.day.today();

    const cases = [
      [{ series: "" }, /Give the mock a name/],
      [{ series: "X", varc_attempted: 99 }, /whole number between 0 and 24/],
      [{ series: "X", varc_attempted: 10, varc_correct: 11 }, /more than attempted/],
      [{ series: "X", qa: 101 }, /percentile must be between 0 and 100/],
      [{ series: "X", overall: -1 }, /percentile must be between 0 and 100/],
      [{ series: "X", taken_on: "2099-01-01" }, /in the future/],
      [{ series: "X", taken_on: "not-a-date" }, /real date/],
    ];

    for (const [fields, expected] of cases) {
      const result = await a.addMock(EMPTY, form({ taken_on: day, ...fields }));
      assert.equal(result.ok, false, `${JSON.stringify(fields)} should not save`);
      assert.match(result.error, expected);
    }

    const { count } = await asAdmin()
      .from("mocks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    assert.equal(count, 0, "nothing was written");
  });

  it("stores a reported percentile in preference to the estimate", async () => {
    const user = await newUser();
    const a = await actAs(user);

    await a.addMock(
      EMPTY,
      form({
        taken_on: a.day.today(),
        series: "AIMCAT",
        varc_attempted: 18,
        varc_correct: 15,
        dilr_attempted: 12,
        dilr_correct: 9,
        qa_attempted: 14,
        qa_correct: 10,
        overall: 91.25,
        varc: 88.5,
      }),
    );

    const [mock] = await a.getMocks(user.id);
    const summary = a.cat.summarise(mock);
    assert.equal(summary.percentile, 91.25);
    assert.equal(summary.estimated, false);
    assert.equal(summary.sections[0].percentile, 88.5);
    assert.equal(summary.sections[0].estimated, false);
  });

  it("toggles review and deletes, scoped to the owner", async () => {
    const owner = await newUser();
    const stranger = await newUser();
    const a = await actAs(owner);
    await a.addMock(
      EMPTY,
      form({ taken_on: a.day.today(), series: "SimCAT 1", varc_attempted: 10, varc_correct: 8 }),
    );
    const [mock] = await a.getMocks(owner.id);

    await a.setMockReviewed(form({ id: mock.id, reviewed: "true" }));
    let [row] = await a.getMocks(owner.id);
    assert.equal(row.reviewed, true);
    assert.ok(row.reviewed_on, "and stamps the day");

    // A stranger holding the id cannot touch it.
    const b = await actAs(stranger);
    await b.deleteMock(form({ id: mock.id }));
    await b.setMockReviewed(form({ id: mock.id, reviewed: "false" }));

    const { data: survivor } = await asAdmin()
      .from("mocks")
      .select("reviewed")
      .eq("id", mock.id)
      .single();
    assert.equal(survivor.reviewed, true, "someone else's delete was a no-op");

    await a.deleteMock(form({ id: mock.id }));
    assert.equal((await a.getMocks(owner.id)).length, 0);
  });
});

describe("settings", () => {
  const base = {
    exam_date: "2026-11-29",
    display_name: "Yash",
    streak_threshold: "3",
    section_floor: "85",
    target_percentile: "99",
    theme: "dark",
  };

  it("saves a profile and clamps the numbers into range", async () => {
    const user = await newUser();
    const a = await actAs(user);
    await a.getProfile(user.id); // create

    await a.updateSettings(
      form({ ...base, streak_threshold: "999", section_floor: "-20", target_percentile: "150" }),
    );

    const profile = await a.getProfile(user.id);
    assert.equal(profile.display_name, "Yash");
    assert.equal(profile.theme, "dark");
    assert.equal(profile.streak_threshold, 12, "clamped to the column's ceiling");
    assert.equal(profile.section_floor, 0);
    assert.equal(profile.target_percentile, 100);
  });

  it("refuses an exam date that would make the run grid unbounded", async () => {
    // The grid draws one square per day between started_on and exam_date, so
    // an unbounded date is an unbounded render.
    const user = await newUser();
    const a = await actAs(user);
    await a.getProfile(user.id);

    for (const exam_date of ["2099-01-01", "2001-01-01"]) {
      await assert.rejects(
        () => a.updateSettings(form({ ...base, exam_date })),
        /exam date between today and/,
        `${exam_date} should be refused`,
      );
    }

    // A malformed date is a form that is not ours: the stored choice is kept
    // rather than quietly replaced with today.
    const before = await a.getProfile(user.id);
    await a.updateSettings(form({ ...base, exam_date: "not-a-date", display_name: "Renamed" }));
    const after = await a.getProfile(user.id);
    assert.equal(after.exam_date, before.exam_date, "a bad field does not move the exam");
    assert.equal(after.display_name, "Renamed", "the rest of the form still saved");
  });

  it("caps the display name at what the form offers", async () => {
    const user = await newUser();
    const a = await actAs(user);
    await a.getProfile(user.id);

    await a.updateSettings(form({ ...base, display_name: "x".repeat(200) }));
    const profile = await a.getProfile(user.id);
    assert.equal(profile.display_name.length, 60);
  });

  it("restarting the run moves the start date and keeps the history", async () => {
    const user = await newUser();
    const a = await actAs(user);
    const profile = await a.getProfile(user.id);
    await a.getDrills(user.id); // seed, so the key is theirs
    await a.logMinutes(form({ drill_key: "qa", seconds: 300, on_day: a.day.today() }));

    await a.restartRun();
    const after = await a.getProfile(user.id);
    assert.equal(after.started_on, a.day.today());
    assert.ok(after.started_on >= profile.started_on);

    const { count } = await asAdmin()
      .from("focus_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    assert.equal(count, 1, "logged work survives a restart");
  });
});

describe("syllabus and mistakes", () => {
  it("rates a shared topic, and adds and removes a private one", async () => {
    const user = await newUser();
    const a = await actAs(user);
    const { data: topics } = await user.db.from("syllabus_topics").select("id, name").limit(1);

    await a.setTopicConfidence(form({ topic_id: topics[0].id, confidence: 2 }));
    const { data: status } = await asAdmin()
      .from("topic_status")
      .select("confidence")
      .eq("user_id", user.id)
      .eq("topic_id", topics[0].id)
      .single();
    assert.equal(status.confidence, 2);

    // The column allows 3 for a level an early build wrote, but nothing in
    // this build offers it. A hand-written post must not be able to reintroduce
    // a value the UI cannot draw.
    await a.setTopicConfidence(form({ topic_id: topics[0].id, confidence: 3 }));
    const { data: clamped } = await asAdmin()
      .from("topic_status")
      .select("confidence")
      .eq("user_id", user.id)
      .eq("topic_id", topics[0].id)
      .single();
    assert.equal(clamped.confidence, 2, "an out-of-range rating was accepted");

    await a.addTopic(form({ section: "QA", name: "Clocks and calendars" }));
    const { data: mine } = await user.db
      .from("syllabus_topics")
      .select("id, name, user_id")
      .eq("user_id", user.id);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].name, "Clocks and calendars");

    await a.deleteTopic(form({ id: mine[0].id }));
    const { data: gone } = await user.db.from("syllabus_topics").select("id").eq("user_id", user.id);
    assert.equal(gone.length, 0);
  });

  it("does not let one user read or rate another's private topic", async () => {
    const owner = await newUser();
    const stranger = await newUser();
    const a = await actAs(owner);
    await a.addTopic(form({ section: "QA", name: "Owner only" }));
    const { data: mine } = await owner.db
      .from("syllabus_topics")
      .select("id")
      .eq("user_id", owner.id)
      .single();

    const { data: seen } = await stranger.db.from("syllabus_topics").select("id").eq("id", mine.id);
    assert.equal(seen.length, 0, "row level security hides it");

    // And the shared list is still visible to everyone signed in.
    const { data: shared } = await stranger.db.from("syllabus_topics").select("id").limit(5);
    assert.ok(shared.length > 0);
  });

  it("logs a mistake with a cause and a mock, and resolves it", async () => {
    const user = await newUser();
    const a = await actAs(user);
    await a.addMock(EMPTY, form({ taken_on: a.day.today(), series: "SimCAT 1" }));
    const [mock] = await a.getMocks(user.id);

    await a.addMistake(
      form({
        section: "DILR",
        cause: "missed",
        note: "Skipped two sets I could solve",
        mock_id: mock.id,
      }),
    );

    const { data: rows } = await user.db.from("mistakes").select("id, cause, mock_id, resolved");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].cause, "missed");
    assert.equal(rows[0].mock_id, mock.id);

    await a.resolveMistake(form({ id: rows[0].id, resolved: "true" }));
    const { data: after } = await user.db.from("mistakes").select("resolved").single();
    assert.equal(after.resolved, true);
  });

  it("drops a forged cause, an unknown section and a borrowed mock id", async () => {
    const owner = await newUser();
    const stranger = await newUser();
    const b = await actAs(stranger);
    await b.addMock(EMPTY, form({ taken_on: b.day.today(), series: "Theirs" }));
    const [theirMock] = await b.getMocks(stranger.id);

    const a = await actAs(owner);
    await a.addMistake(
      form({
        section: "NOT-A-SECTION",
        cause: "not-a-cause",
        note: "Should land with safe defaults",
        mock_id: theirMock.id,
      }),
    );

    const { data: rows } = await owner.db.from("mistakes").select("section, cause, mock_id");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].cause, "concept", "an unknown cause falls back to the first one");
    assert.equal(rows[0].section, "QA");
    assert.equal(rows[0].mock_id, null, "a borrowed mock is not linked");
  });

  it("refuses a note longer than the column allows", async () => {
    const user = await newUser();
    const a = await actAs(user);
    await a.addMistake(form({ note: "x".repeat(5000), section: "QA", cause: "concept" }));

    const { data: rows } = await user.db.from("mistakes").select("note");
    assert.equal(rows[0].note.length, 2000, "trimmed to the column's limit");
  });
});
