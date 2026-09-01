import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const app = read("App.js");
const eas = JSON.parse(read("eas.json"));
const expo = JSON.parse(read("app.json")).expo;
const phase = read("src/phase4b/Phase4BScoresInternalAlpha.js");
const vote = read("src/phase4b/Phase4BMatchVote.js");
const insights = read("src/phase4b/Phase4BMatchInsights.js");
const hub = read("src/phase4b/Phase4BReadOnlyHub.js");
const favorites = read("src/phase4b/Phase4BFavoritesPanel.js");
const notifications = read("src/phase4b/Phase4BNotificationsPanel.js");
const search = read("src/phase4b/Phase4BSearchPanel.js");
const scoresApi = read("src/phase4b/scoresStagingApi.js");
const pkg = JSON.parse(read("package.json"));

assert.match(app, /Phase4BScoresInternalAlpha/);
assert.doesNotMatch(app, /AppFinalShell/);
assert.equal(eas?.build?.production?.autoIncrement, true);
assert.equal(eas?.build?.production?.env?.EXPO_PUBLIC_MST_ENVIRONMENT, "production");
assert.equal(expo?.ios?.bundleIdentifier, "com.myanmarsportstalk.mst");
assert.equal(expo?.android?.package, "com.myanmarsportstalk.mst");
assert.ok(String(expo?.extra?.eas?.projectId || "").trim(), "EAS projectId must exist");

for (const marker of [
  "Phase4BMatchVote",
  "Phase4BMatchInsights",
  "Phase4BReadOnlyHub",
  "Phase4BFavoritesPanel",
  "Phase4BNotificationsPanel",
  "Phase4BSearchPanel",
]) assert.match(phase, new RegExp(marker));

assert.match(vote, /getMatchPoll/);
assert.match(vote, /voteMatchPoll/);
assert.match(vote, /matchVoteProviderId/);
assert.match(vote, /provider_id/);
assert.match(vote, /mst:match:af:/);
assert.match(vote, /HOME/);
assert.match(vote, /DRAW/);
assert.match(vote, /AWAY/);
assert.match(insights, /EXPO_PUBLIC_MST_FULL_ANALYSIS_URL_TEMPLATE/);
assert.match(insights, /EXPO_PUBLIC_MST_PREDICTION_APP_URL_TEMPLATE/);
assert.match(hub, /getTips/);
assert.match(hub, /getTipsMe/);
assert.match(hub, /getTipsters/);
assert.match(hub, /getLeaderboard/);
assert.match(favorites, /getFavorites/);
assert.match(favorites, /toggleEntityFavorite/);
assert.match(notifications, /getNotifications/);
assert.match(notifications, /registerDeviceForPush/);
assert.match(search, /searchFootballEntities/);

const phaseSources = [phase, vote, insights, hub, favorites, notifications, search].join("\n");
for (const forbidden of [
  /savePredictionScore\s*\(/,
  /savePrediction\s*\(/,
  /createPrediction\s*\(/,
  /submitPrediction\s*\(/,
  /editPrediction\s*\(/,
  /\/v1\/predictions/,
]) assert.doesNotMatch(phaseSources, forbidden, `Current Scores app contains forbidden prediction write surface: ${forbidden}`);

assert.match(scoresApi, /SCORES_API_ORIGIN_REQUIRED/);
assert.match(scoresApi, /PRODUCTION_STAGING_ORIGIN_BLOCKED/);

const dependencies = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const admobPackages = Object.keys(dependencies).filter((name) => /google-mobile-ads|admob/i.test(name));
const blockers = [];
if (!String(eas?.build?.production?.env?.EXPO_PUBLIC_MST_SCORES_API_ORIGIN || "").trim()) blockers.push("production Scores API origin is not configured");
if (!admobPackages.length) blockers.push("AdMob SDK/package is not configured");
if (!String(eas?.build?.production?.env?.EXPO_PUBLIC_MST_FULL_ANALYSIS_URL_TEMPLATE || "").trim()) blockers.push("website full-analysis URL template is not configured (API-provided URL may still satisfy runtime)");
if (!String(eas?.build?.production?.env?.EXPO_PUBLIC_MST_PREDICTION_APP_URL_TEMPLATE || "").trim()) blockers.push("Prediction app deep-link template is not configured (API-provided URL may still satisfy runtime)");

console.log("Current MST Scores source contract PASS: production entrypoint is Phase 4B; Match Vote/favorites/notifications/tips/leaderboards/search/read-only analysis integrations are present; Match Vote adapts canonical Scores IDs to provider IDs; exact-score prediction writes are absent; iOS/Android identifiers and EAS projectId are intact.");
if (blockers.length) {
  console.log("Release configuration blockers:");
  for (const blocker of blockers) console.log(`- ${blocker}`);
}
if (process.argv.includes("--strict-release") && blockers.length) process.exit(2);
