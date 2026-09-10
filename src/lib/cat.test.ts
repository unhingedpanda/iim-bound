/** Run: node --experimental-strip-types src/lib/cat.test.ts */
import assert from "node:assert/strict";
import { estimatePercentile, netScore, scoreForPercentile, summarise } from "./cat.ts";

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

console.log("cat.ts ok");
