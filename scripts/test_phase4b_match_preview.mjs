import assert from "node:assert/strict";
import {
  MATCH_CENTER_PREVIEW_SECTIONS,
  isProfessionalMatchPreview,
  matchCenterPreviewQuality,
  matchCenterPreviewSections,
} from "../src/phase4b/matchCenterPreview.js";

function section(key, status, facts = [], missingReason = null) {
  return {
    key,
    title: key,
    status,
    facts,
    evidenceIds: [],
    checkedAt: "2026-09-03T01:30:00Z",
    missingReason,
  };
}

function fact(key, label, value, unit = null) {
  return { key, label, value, unit, subject: null, evidenceIds: [`evidence:${key}`] };
}

const preview = {
  contract: "professional-match-preview.v1",
  previewStandardVersion: "1.0",
  previewId: "professional-preview:mst:match:af:1504477",
  state: "DEGRADED",
  premiumReady: true,
  quality: { score: 85, confidenceBand: "HIGH" },
  provenance: { sourceCount: 77, sourceFamilyCount: 2 },
  sections: [
    section("keyStatistics", "AVAILABLE", [
      fact("played", "Played", "38"),
      fact("wins", "Wins", "24"),
      fact("goalsFor", "Goals for", "72", "goals"),
    ]),
    section("expectedStartingXi", "AVAILABLE", [fact("lineupStatus", "Lineup status", "CONFIRMED")]),
    section("headToHead", "UNAVAILABLE", [], "NO_VERIFIED_DATA"),
    section("recentForm", "AVAILABLE", [fact("form", "Recent form", "WWDLW")]),
    section("competitionSituation", "AVAILABLE", [fact("position", "League position", "2")]),
  ],
};

assert.equal(isProfessionalMatchPreview(preview), true);
assert.equal(isProfessionalMatchPreview({ contract: "wrong", sections: [] }), false);

const quality = matchCenterPreviewQuality(preview);
assert.equal(quality.available, true);
assert.equal(quality.premiumReady, true);
assert.equal(quality.state, "DEGRADED", "minimum evidence readiness must never be mislabeled COMPLETE");
assert.equal(quality.score, 85);
assert.equal(quality.sourceCount, 77);
assert.equal(quality.sourceFamilyCount, 2);
assert.match(quality.message, /not presenting this as a complete premium preview/i);

const mapped = matchCenterPreviewSections(preview, { maxFacts: 2 });
assert.deepEqual(mapped.map((item) => item.title), MATCH_CENTER_PREVIEW_SECTIONS.map((item) => item.title));

const stats = mapped.find((item) => item.id === "stats");
assert.equal(stats.status, "AVAILABLE");
assert.deepEqual(stats.facts, [
  { key: "played", label: "Played", value: "38" },
  { key: "wins", label: "Wins", value: "24" },
]);
assert.equal(stats.hiddenFactCount, 1, "large evidence sections must remain bounded in the Match Center UI");
assert.equal(stats.message, null);

const h2h = mapped.find((item) => item.id === "h2h");
assert.equal(h2h.status, "UNAVAILABLE");
assert.deepEqual(h2h.facts, [], "missing H2H must never be synthesized");
assert.match(h2h.message, /no verified data/i);

const form = mapped.find((item) => item.id === "form");
assert.deepEqual(form.facts, [{ key: "form", label: "Recent form", value: "WWDLW" }]);

const unknownPreview = matchCenterPreviewSections(null);
assert.equal(unknownPreview.length, 5);
assert.ok(unknownPreview.every((item) => item.status === "NOT_CHECKED" && item.facts.length === 0));

const incomplete = matchCenterPreviewQuality({ ...preview, premiumReady: false, state: "DEGRADED" });
assert.equal(incomplete.premiumReady, false);
assert.match(incomplete.message, /has not met the minimum evidence gate/i);

console.log("Phase 4B Match Center preview tests passed: only verified structured facts are mapped, unknown H2H stays unavailable, and DEGRADED is never mislabeled COMPLETE.");
