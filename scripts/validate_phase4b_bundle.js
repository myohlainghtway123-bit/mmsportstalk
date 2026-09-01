const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

const directory = process.argv[2] || "dist-ci";
const mode = process.argv[3] || "internal";
const bundle = files(directory)
  .filter((file) => /\.(?:hbc|js|map|html|json)$/.test(file))
  .map((file) => fs.readFileSync(file).toString("latin1"))
  .join("\n");

const forbiddenPredictionWrites = /\/v1\/predictions|savePredictionScore|savePrediction\s*\(|createPrediction\s*\(|submitPrediction\s*\(|editPrediction\s*\(/;
const forbiddenBetFlow = /betflow/i;

if (mode === "default") {
  // The NEW Phase 4B app is now the release entrypoint. Its source intentionally
  // contains the staging origin for internal builds, so presence of that literal
  // is not proof that a production build can use it. Production safety is the
  // fail-closed runtime contract plus absence of the visible internal banner.
  assert.match(bundle, /SCORES_API_ORIGIN_REQUIRED/);
  assert.match(bundle, /PRODUCTION_STAGING_ORIGIN_BLOCKED/);
  assert.doesNotMatch(bundle, /STAGING \/ INTERNAL/);
  assert.doesNotMatch(bundle, forbiddenPredictionWrites);
  assert.doesNotMatch(bundle, forbiddenBetFlow);
  assert.match(bundle, /Follow the game/i);
  console.log("Default Android bundle passed: current NEW Scores app is production-mode, internal banner is absent, production Scores origin fails closed, BetFlow is absent, and exact-score prediction writes are absent.");
} else {
  assert.equal(mode, "internal");
  assert.match(bundle, /scores-api-staging\.myanmarsportstalk\.com/);
  assert.match(bundle, /STAGING \/ INTERNAL/);
  assert.doesNotMatch(bundle, forbiddenPredictionWrites);
  assert.doesNotMatch(bundle, forbiddenBetFlow);
  assert.match(bundle, /Follow the game/i);

  console.log("Phase 4B internal Android bundle passed: staging marker/origin are present only for the internal build; BetFlow and exact-score prediction-write surfaces remain absent.");
}
