const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");
const app = read("App.js");
const screen = read("src/phase4b/Phase4BScoresInternalAlpha.js");
const api = read("src/phase4b/scoresStagingApi.js");
const eas = JSON.parse(read("eas.json"));
const workflow = read(".github/workflows/validate-app.yml");
const phase4b = `${app}\n${screen}\n${api}`;

assert.match(app, /Phase4BScoresInternalAlpha/);
assert.match(app, /AppFinalShell/);
assert.match(app, /process\.env\.EXPO_PUBLIC_MST_INTERNAL === "true"/);
assert.ok(
  app.indexOf("Phase4BScoresInternalAlpha") < app.indexOf("AppFinalShell"),
  "internal shell must be the true branch and normal shell must be the default branch",
);
assert.match(api, /https:\/\/mst-scores-api-staging\.betflowapp\.workers\.dev/);
assert.doesNotMatch(phase4b, /app-api\.myanmarsportstalk\.com/);
assert.doesNotMatch(phase4b, /\/v1\/predictions|savePrediction|createPrediction|submitPrediction/);
assert.doesNotMatch(phase4b, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
assert.doesNotMatch(phase4b, /D1Database|wrangler\s+d1|mst-prediction-core|mst-football-staging/);

for (const marker of [
  "STAGING / INTERNAL",
  "loadScoresFeed",
  "loadMatchCenter",
  "Canonical MST ID",
  "PREDICTION / TIP PREVIEW",
  "MST Scores cannot submit predictions",
  "Loading staging data",
  "Staging dependency unavailable",
  "No matches available",
  "RETRY",
  "request_id",
]) {
  assert.ok(screen.includes(marker), `missing Phase 4B marker: ${marker}`);
}

for (const route of ["/v1/fixtures", "/v1/live", "/v1/results", "/v1/matches/", "/v1/tips?"]) {
  assert.ok(api.includes(route), `missing Scores Product API route: ${route}`);
}
assert.match(api, /CANONICAL_MATCH_MISMATCH/);
assert.match(api, /STAGING_TIMEOUT/);
assert.match(api, /accessLevel !== "free" \|\| serverLocked/);
assert.match(api, /selection: locked \? null/);

const profile = eas.build?.["phase4b-internal"];
assert.equal(profile?.distribution, "internal");
assert.equal(profile?.android?.buildType, "apk");
assert.equal(profile?.env?.EXPO_PUBLIC_MST_ENVIRONMENT, "staging");
assert.equal(profile?.env?.EXPO_PUBLIC_MST_INTERNAL, "true");
assert.equal(profile?.env?.EXPO_PUBLIC_MST_SCORES_API_ORIGIN, "https://mst-scores-api-staging.betflowapp.workers.dev");
assert.match(workflow, /API_ORIGIN='https:\/\/app-api\.myanmarsportstalk\.com'/);
assert.match(workflow, /mst-scores-api-staging\.betflowapp\.workers\.dev/);
assert.match(workflow, /dist-ci-default default/);
assert.match(workflow, /EXPO_PUBLIC_MST_INTERNAL:\s*"true"/);

console.log("Phase 4B isolation contract passed: AppFinalShell is the default, the internal alpha requires the exact true flag, both API checks remain in CI, and the internal APK profile is enforced.");
