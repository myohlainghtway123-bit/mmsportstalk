const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

const bundle = files("dist-ci")
  .filter((file) => /\.(?:hbc|js|map|html|json)$/.test(file))
  .map((file) => fs.readFileSync(file).toString("latin1"))
  .join("\n");

assert.match(bundle, /mst-scores-api-staging\.betflowapp\.workers\.dev/);
assert.match(bundle, /STAGING \/ INTERNAL/);
assert.doesNotMatch(bundle, /app-api\.myanmarsportstalk\.com/);
assert.doesNotMatch(bundle, /\/v1\/predictions|savePrediction|createPrediction|submitPrediction/);

console.log("Phase 4B Android bundle passed: staging marker/origin present; production API and prediction-write surfaces absent.");
