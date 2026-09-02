import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const app = read("App.js");
const eas = JSON.parse(read("eas.json"));
const expo = JSON.parse(read("app.json")).expo;
const appConfig = fs.existsSync("app.config.js") ? read("app.config.js") : "";
const phase = read("src/phase4b/Phase4BScoresInternalAlpha.js");
const news = read("src/phase4b/Phase4BNewsPanel.js");
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
  "Phase4BNewsPanel",
  "Phase4BMatchVote",
  "Phase4BMatchInsights",
  "Phase4BReadOnlyHub",
  "Phase4BFavoritesPanel",
  "Phase4BNotificationsPanel",
  "Phase4BSearchPanel",
]) assert.match(phase, new RegExp(marker));

assert.match(phase, /EXPO_PUBLIC_MST_ENVIRONMENT !== "production" \? <EnvironmentBanner \/> : null/);
for (const forbiddenPublicCopy of [
  "Phase 4B staging build",
  "Real staging matches",
  "No staging matches",
  "staging record",
  "staging field",
  "staging deep-link contract",
  "Payments & cards",
  "Final content pending",
  "Integration pending",
  "Product shell",
  "Become a Tipster",
  "Internal tester",
]) assert.doesNotMatch(phase, new RegExp(forbiddenPublicCopy, "i"), `Public Scores source still contains release-placeholder copy: ${forbiddenPublicCopy}`);

assert.match(news, /fetchArticles/);
assert.match(news, /formatContentDate/);
assert.match(news, /READ ON MST/);
assert.doesNotMatch(news, /DEMO_NEWS|placeholder stor/i);

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
  "createTipPurchase",
  "loadTips",
  "loadOwnPurchases",
  "loadTipEntitlement",
  "loadTipsters",
  "loadTipsterLeaderboard",
  "loadUserLeaderboard",
]) assert.match(hub, new RegExp(marker));
assert.match(hub, /BUY TIP/);
assert.match(scoresApi, /\/v1\/purchases\/tips\/\$\{encodeURIComponent\(canonicalTipId\)\}/);
assert.match(scoresApi, /Price, currency, ownership, payment state and entitlement are server-owned/);

assert.match(favorites, /getFavorites/);
assert.match(favorites, /toggleEntityFavorite/);
assert.match(notifications, /getNotifications/);
assert.match(notifications, /markAllNotificationsRead/);
assert.match(notifications, /registerDeviceForPush/);
assert.match(search, /searchFootballEntities/);

const phaseSources = [phase, news, vote, insights, hub, favorites, notifications, search].join("\n");
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
assert.match(scoresApi, /\/v1\/auth\/login/);
assert.match(scoresApi, /\/v1\/auth\/logout/);
assert.match(scoresApi, /Authorization:\s*`Bearer/);

const productionEnv = eas?.build?.production?.env || {};
const dependencies = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const admobPackages = Object.keys(dependencies).filter((name) => /google-mobile-ads|admob/i.test(name));
const blockers = [];
const productionOrigin = String(productionEnv.EXPO_PUBLIC_MST_SCORES_API_ORIGIN || "").trim();
if (!productionOrigin) {
  blockers.push("production Scores API origin is not verified/configured");
} else {
  assert.match(productionOrigin, /^https:\/\//, "production Scores API origin must use HTTPS");
  assert.doesNotMatch(productionOrigin, /staging/i, "production Scores API origin must not be a staging endpoint");
}
if (!admobPackages.length) blockers.push("AdMob SDK/package is not installed");
if (!/react-native-google-mobile-ads/.test(appConfig)) blockers.push("AdMob Expo native config plugin is not configured");
for (const [key, label] of [
  ["MST_ADMOB_ANDROID_APP_ID", "Android AdMob App ID"],
  ["MST_ADMOB_IOS_APP_ID", "iOS AdMob App ID"],
  ["EXPO_PUBLIC_MST_ADMOB_ANDROID_REWARDED_UNIT_ID", "Android rewarded AdMob unit ID"],
  ["EXPO_PUBLIC_MST_ADMOB_IOS_REWARDED_UNIT_ID", "iOS rewarded AdMob unit ID"],
]) {
  if (!String(productionEnv[key] || "").trim()) blockers.push(`${label} is not configured`);
}

const warnings = [];
if (!String(productionEnv.EXPO_PUBLIC_MST_FULL_ANALYSIS_URL_TEMPLATE || "").trim()) warnings.push("website full-analysis URL template is not configured; the shared match response must provide full_analysis_url/fullAnalysisUrl at runtime");
if (!String(productionEnv.EXPO_PUBLIC_MST_PREDICTION_APP_URL_TEMPLATE || "").trim()) warnings.push("Prediction app deep-link template is not configured; the shared match response must provide prediction_app_url/predictionAppUrl at runtime");

console.log("Current MST Scores source contract PASS: production entrypoint is the NEW Phase 4B app; production/staging UI separation, fail-closed Scores origin handling, cleaned public release surface, real MST News, shared-auth/Match Vote/tips/tip-purchase/entitlements/leaderboards/favorites/notifications/search/read-only analysis integrations are present; exact-score prediction writes are absent; iOS/Android identifiers and EAS projectId are intact. Global product separation is enforced by validate-product-separation.js before this release contract runs.");
if (blockers.length) {
  console.log("Release configuration blockers:");
  for (const blocker of blockers) console.log(`- ${blocker}`);
}
if (warnings.length) {
  console.log("Runtime verification required:");
  for (const warning of warnings) console.log(`- ${warning}`);
}
if (process.argv.includes("--strict-release") && blockers.length) process.exit(2);
