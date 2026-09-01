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

// Match Vote now uses the canonical Scores Product API/BFF and the canonical
// match.id directly. Provider-ID adaptation belongs behind the shared platform
// boundary, not in the mobile client.
assert.match(vote, /loadMatchVote\(matchId\)/);
assert.match(vote, /saveMatchVote\(matchId, selection\)/);
assert.match(vote, /match\?\.id/);
assert.match(vote, /HOME/);
assert.match(vote, /DRAW/);
assert.match(vote, /AWAY/);
assert.match(scoresApi, /\/v1\/matches\/\$\{encodeURIComponent\(String\(matchId\)\)\}\/vote/);
assert.match(scoresApi, /method:\s*"PUT"/);

assert.match(insights, /EXPO_PUBLIC_MST_FULL_ANALYSIS_URL_TEMPLATE/);
assert.match(insights, /EXPO_PUBLIC_MST_PREDICTION_APP_URL_TEMPLATE/);
assert.match(insights, /full_analysis_url/);
assert.match(insights, /prediction_app_url/);

for (const marker of [
  "loadTips",
  "loadOwnPurchases",
  "loadTipEntitlement",
  "loadTipsters",
  "loadTipsterLeaderboard",
  "loadUserLeaderboard",
]) assert.match(hub, new RegExp(marker));

assert.match(favorites, /getFavorites/);
assert.match(favorites, /toggleEntityFavorite/);
assert.match(notifications, /getNotifications/);
assert.match(notifications, /markAllNotificationsRead/);
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
  /betflow/i,
]) assert.doesNotMatch(phaseSources, forbidden, `Current Scores app contains forbidden product surface: ${forbidden}`);

assert.match(scoresApi, /SCORES_API_ORIGIN_REQUIRED/);
assert.match(scoresApi, /PRODUCTION_STAGING_ORIGIN_BLOCKED/);
assert.match(scoresApi, /\/v1\/auth\/login/);
assert.match(scoresApi, /\/v1\/auth\/logout/);
assert.match(scoresApi, /Authorization:\s*`Bearer/);

const dependencies = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const admobPackages = Object.keys(dependencies).filter((name) => /google-mobile-ads|admob/i.test(name));
const blockers = [];
if (!String(eas?.build?.production?.env?.EXPO_PUBLIC_MST_SCORES_API_ORIGIN || "").trim()) blockers.push("production Scores API origin is not configured");
if (!admobPackages.length) blockers.push("AdMob SDK/package is not configured");

const warnings = [];
if (!String(eas?.build?.production?.env?.EXPO_PUBLIC_MST_FULL_ANALYSIS_URL_TEMPLATE || "").trim()) warnings.push("website full-analysis URL template is not configured; the shared match response must provide full_analysis_url/fullAnalysisUrl at runtime");
if (!String(eas?.build?.production?.env?.EXPO_PUBLIC_MST_PREDICTION_APP_URL_TEMPLATE || "").trim()) warnings.push("Prediction app deep-link template is not configured; the shared match response must provide prediction_app_url/predictionAppUrl at runtime");

console.log("Current MST Scores source contract PASS: production entrypoint is the NEW Phase 4B app; canonical shared-auth/Match Vote/tips/entitlements/leaderboards/favorites/notifications/search/read-only analysis integrations are present; exact-score prediction writes and BetFlow are absent; iOS/Android identifiers and EAS projectId are intact.");
if (blockers.length) {
  console.log("Release configuration blockers:");
  for (const blocker of blockers) console.log(`- ${blocker}`);
}
if (warnings.length) {
  console.log("Runtime verification required:");
  for (const warning of warnings) console.log(`- ${warning}`);
}
if (process.argv.includes("--strict-release") && blockers.length) process.exit(2);
