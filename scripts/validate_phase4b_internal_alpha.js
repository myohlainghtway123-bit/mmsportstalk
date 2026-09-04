const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");
const app = read("App.js");
const screen = read("src/phase4b/Phase4BScoresInternalAlpha.js");
const api = read("src/phase4b/scoresStagingApi.js");
const vote = read("src/phase4b/Phase4BMatchVote.js");
const eas = JSON.parse(read("eas.json"));
const workflow = read(".github/workflows/validate-app.yml");
const productContract = read("docs/product/mst-scores-product-contract.md");
const phase4b = `${app}\n${screen}\n${api}\n${vote}`;

// The current NEW Scores app is Phase 4B itself. The legacy final shell is no
// longer the default release entrypoint.
assert.match(app, /Phase4BScoresInternalAlpha/);
assert.doesNotMatch(app, /AppFinalShell/);
assert.match(api, /https:\/\/scores-api-staging\.myanmarsportstalk\.com/);
assert.match(api, /SCORES_API_ORIGIN_REQUIRED/);
assert.match(api, /PRODUCTION_STAGING_ORIGIN_BLOCKED/);
assert.doesNotMatch(phase4b, /app-api\.myanmarsportstalk\.com/);
assert.doesNotMatch(phase4b, /\/v1\/predictions|savePrediction|createPrediction|submitPrediction|editPrediction/);
assert.doesNotMatch(phase4b, /D1Database|wrangler\s+d1|mst-prediction-core|mst-football-staging/);

for (const marker of [
  "Phase4BMatchVote",
  "Phase4BMatchInsights",
  "Phase4BReadOnlyHub",
  "Phase4BFavoritesPanel",
  "Phase4BNotificationsPanel",
  "Phase4BSearchPanel",
]) {
  assert.ok(screen.includes(marker), `missing current Phase 4B component: ${marker}`);
}

for (const contractRule of [
  "MST Scores = Follow the Game.",
  "Match Vote — MST Scores",
  "Vote and Prediction are different systems",
  "MST Scores must not create, edit or submit user predictions.",
  "exact score = 3 points",
  "correct result only = 1 point",
  "wrong result = 0 points",
  "Premium Tips / Buy Tip / purchased-tip access when entitled",
  "premium Match Preview summary",
  "Read Full Analysis on Website",
]) {
  assert.ok(productContract.includes(contractRule), `missing locked product rule: ${contractRule}`);
}

for (const route of [
  "/v1/auth/login",
  "/v1/auth/logout",
  "/v1/fixtures",
  "/v1/live",
  "/v1/results",
  "/v1/matches/",
  "/vote",
  "/v1/tips?",
  "/v1/leaderboards/users",
  "/v1/leaderboards/tipsters",
]) {
  assert.ok(api.includes(route), `missing Scores Product API route: ${route}`);
}
assert.match(api, /method:\s*"PUT"/);
assert.match(api, /method:\s*"POST"/);
assert.doesNotMatch(api, /method:\s*["'](?:PATCH|DELETE)["']/);
assert.match(api, /CANONICAL_MATCH_MISMATCH/);
assert.match(api, /STAGING_TIMEOUT/);
assert.match(api, /accessLevel !== "free" \|\| serverLocked/);
assert.match(api, /selection: locked \? null/);
assert.match(vote, /loadMatchVote\(matchId\)/);
assert.match(vote, /saveMatchVote\(matchId, selection\)/);
assert.match(vote, /match\?\.id/);
assert.match(vote, /HOME/);
assert.match(vote, /DRAW/);
assert.match(vote, /AWAY/);

const profile = eas.build?.["phase4b-internal"];
assert.equal(profile?.distribution, "internal");
assert.equal(profile?.android?.buildType, "apk");
assert.equal(profile?.env?.EXPO_PUBLIC_MST_ENVIRONMENT, "staging");
assert.equal(profile?.env?.EXPO_PUBLIC_MST_INTERNAL, "true");
assert.equal(profile?.env?.EXPO_PUBLIC_MST_SCORES_API_ORIGIN, "https://scores-api-staging.myanmarsportstalk.com");
assert.match(workflow, /API_ORIGIN='https:\/\/app-api\.myanmarsportstalk\.com'/);
assert.match(workflow, /scores-api-staging\.myanmarsportstalk\.com/);
assert.match(workflow, /dist-ci-default default/);
assert.match(workflow, /EXPO_PUBLIC_MST_INTERNAL:\s*"true"/);

console.log("Phase 4B current-app isolation contract passed: the NEW Scores app is the release entrypoint, shared auth/Match Vote/read surfaces are allowed, exact-score prediction writes remain forbidden, staging remains isolated, and production still fails closed without an approved Scores origin.");
