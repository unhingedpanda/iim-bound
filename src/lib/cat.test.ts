/** Run: node --experimental-strip-types src/lib/cat.test.ts */
import assert from "node:assert/strict";
import {
  attemptDiagnosis,
  estimatePercentile,
  NET_QUESTIONS_AT_99,
  netScore,
  scoreForPercentile,
  summarise,
  targetNetQuestions,
} from "./cat.ts";

// +3/-1: 20 attempted, 15 right = 45 - 5.
assert.equal(netScore(20, 15), 40);
assert.equal(netScore(0, 0), 0);

// Published anchors must come back exactly.
assert.equal(estimatePercentile("QA", 27.3), 99);
assert.equal(estimatePercentile("OVERALL", 84.8), 99);
assert.equal(estimatePercentile("VARC", 26), 90);

// Between anchors, and off both ends.
const mid = estimatePercentile("OVERALL", 70);
assert.ok(mid !== null && mid > 95 && mid < 98, `midpoint out of range: ${mid}`);
assert.equal(estimatePercentile("OVERALL", 0), 0);
assert.equal(estimatePercentile("OVERALL", 200), 99.99);

// Round-trips through the inverse.
assert.ok(Math.abs((scoreForPercentile("QA", 95) ?? 0) - 18.5) < 0.01);

// A reported percentile always beats the estimate; a missing one is estimated.
const s = summarise({
  varc_attempted: 18,
  varc_correct: 15,
  dilr_attempted: 12,
  dilr_correct: 9,
  qa_attempted: 14,
  qa_correct: 10,
  varc: 97.5,
  dilr: null,
  qa: null,
  overall: null,
});
assert.equal(s.net, 42 + 24 + 26);
assert.equal(s.sections[0].percentile, 97.5);
assert.equal(s.sections[0].estimated, false);
assert.equal(s.sections[1].estimated, true);
assert.ok(s.estimated && s.scored);

// A half-filled row says nothing rather than guessing.
const empty = summarise({
  varc_attempted: null,
  varc_correct: null,
  dilr_attempted: null,
  dilr_correct: null,
  qa_attempted: null,
  qa_correct: null,
  varc: null,
  dilr: null,
  qa: null,
  overall: null,
});
assert.equal(empty.net, null);
assert.equal(empty.scored, false);

// Section targets are derived from the same curves as the percentiles, so the
// diagnosis and the percentile can never disagree the way the old hardcoded
// VARC 15 / DILR 13 / QA 12 did (DILR 99 is 29.8 marks = 9.9 net questions).
for (const section of ["VARC", "DILR", "QA"] as const) {
  const derived = (scoreForPercentile(section, 99) ?? 0) / 3;
  assert.ok(
    Math.abs(targetNetQuestions(section, 99) - derived) < 1e-9,
    `${section} target drifted from its curve: ${targetNetQuestions(section, 99)} vs ${derived}`,
  );
  assert.ok(
    Math.abs(NET_QUESTIONS_AT_99[section] - derived) < 1e-9,
    `${section} alias drifted: ${NET_QUESTIONS_AT_99[section]} vs ${derived}`,
  );
}
// Spot values, so a curve edit forces a conscious test update too.
assert.ok(Math.abs(NET_QUESTIONS_AT_99.VARC - 14.67) < 0.05);
assert.ok(Math.abs(NET_QUESTIONS_AT_99.DILR - 9.93) < 0.05);
assert.ok(Math.abs(NET_QUESTIONS_AT_99.QA - 9.1) < 0.05);

// A true 99 paper in each section reaches the bar (default aim is 99).
assert.equal(attemptDiagnosis("VARC", 16, 15)?.verdict, "At the bar");
assert.equal(attemptDiagnosis("DILR", 12, 11)?.verdict, "At the bar");
assert.equal(attemptDiagnosis("QA", 11, 10)?.verdict, "At the bar");

// Each branch still fires at the corrected thresholds.
assert.equal(attemptDiagnosis("DILR", 11, 10)?.verdict, "Too cautious");
assert.equal(attemptDiagnosis("VARC", 24, 18)?.verdict, "Paying for volume");
assert.equal(attemptDiagnosis("VARC", 20, 10)?.verdict, "Selection, not knowledge");
assert.equal(attemptDiagnosis("QA", 14, 10)?.verdict, "Short on both");
assert.equal(attemptDiagnosis("VARC", 0, 0), null);

// The bar follows the user's own target: 8.7 DILR net questions clears 95
// but not 99.
assert.equal(attemptDiagnosis("DILR", 10, 9, 95)?.verdict, "At the bar");
assert.equal(attemptDiagnosis("DILR", 10, 9, 99)?.verdict, "Too cautious");

console.log("cat.ts ok");
