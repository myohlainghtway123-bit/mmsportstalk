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

if (mode === "default") {
  assert.match(bundle, /app-api\.myanmarsportstalk\.com/);
  assert.doesNotMatch(bundle, /scores-api-staging\.myanmarsportstalk\.com/);
  assert.doesNotMatch(bundle, /STAGING \/ INTERNAL/);
  console.log("Default Android bundle passed: normal app API present; Phase 4B staging origin and marker absent.");
} else {
  assert.equal(mode, "internal");
  assert.match(bundle, /scores-api-staging\.myanmarsportstalk\.com/);
  assert.match(bundle, /STAGING \/ INTERNAL/);
  assert.doesNotMatch(bundle, /app-api\.myanmarsportstalk\.com/);
  assert.doesNotMatch(bundle, /\/v1\/predictions|savePrediction|createPrediction|submitPrediction/);

  console.log("Phase 4B Android bundle passed: staging marker/origin present; production API and prediction-write surfaces absent.");
}
