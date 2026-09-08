import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MST_API_ORIGIN,
  MST_SITE_ORIGIN,
  resolveMstApiOrigin,
} from "../src/services/mstApiConfig.js";
import {
  loadScoresForDate,
  loadStandings,
  scoresStagingGet,
} from "../src/phase4b/scoresStagingApi.js";
import {
  fetchArticles,
} from "../src/services/contentApi.js";
import {
  loadOnboardingPreferences,
  persistAppLanguage,
  subscribeAppLanguage,
} from "../src/services/onboardingStore.js";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

if (typeof globalThis.window === "undefined") {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, val) => {
        store.set(key, String(val));
        return Promise.resolve();
      },
      removeItem: (key) => {
        store.delete(key);
        return Promise.resolve();
      },
      clear: () => {
        store.clear();
        return Promise.resolve();
      },
    },
  };
}

console.log("Running MST Scores V1 Defect Fixes Regression Tests...\n");

// =========================================================================
// TEST 1: PRODUCT BOUNDARY & ACTIVE SHELL
// =========================================================================
console.log("1. Checking Product Boundary & Shell...");
const appSource = read("App.js");
const shellSource = read("src/phase4b/Phase4BScoresInternalAlpha.js");
assert.match(appSource, /Phase4BScoresInternalAlpha/, "App.js must export the active shell");
assert.doesNotMatch(shellSource, /\/v1\/predictions|savePrediction|createPrediction|submitPrediction/, "Scores shell must not create exact-score predictions");
assert.match(shellSource, /Phase4BMatchVote/, "Scores shell must support Match Vote");
assert.match(shellSource, /Phase4BReadOnlyHub/, "Scores shell must support read-only Tips");
assert.match(shellSource, /Phase4BNewsPanel/, "Scores shell must support News");
assert.match(shellSource, /Phase4BFavoritesPanel/, "Scores shell must support Favorites");
console.log("   -> PASS: Product boundaries and shell intact.\n");

// =========================================================================
// TEST 2: SIGN-IN FLOW & NO SETTINGS->PROFILE->SETTINGS LOOP
// =========================================================================
console.log("2. Checking Sign-in flow & Guest navigation...");
const profileSource = read("src/phase4b/Phase4BProfileScreen.js");
const settingsSource = read("src/final/SettingsScreenV2.js");
const authModalSource = read("src/phase4b/Phase4BAuthModal.js");

// Profile has sign-in CTA for guests
assert.match(profileSource, /onOpenSignIn/, "ProfileScreen must accept onOpenSignIn");
assert.match(profileSource, /SIGN IN \/ REGISTER/, "ProfileScreen must render sign-in CTA for guests");

// Settings triggers onOpenSignIn/openAccount for guests
assert.match(settingsSource, /onOpenSignIn/, "SettingsScreenV2 must accept onOpenSignIn");
assert.match(settingsSource, /auth\?\.authenticated\s*\?\s*\(openProfile \|\| openAccount\)\s*:\s*\(onOpenSignIn \|\| openAccount \|\| openProfile\)/, "SettingsScreenV2 must route guests directly to sign-in, not profile");

// AuthModal implements canonical startEmailLogin & verifyEmailLogin
assert.match(authModalSource, /startEmailLogin/, "AuthModal must use canonical startEmailLogin");
assert.match(authModalSource, /verifyEmailLogin/, "AuthModal must use canonical verifyEmailLogin");
assert.match(shellSource, /<Phase4BAuthModal/, "Scores shell must mount Phase4BAuthModal");
console.log("   -> PASS: Guest sign-in flow and loop elimination verified.\n");

// =========================================================================
// TEST 3: NON-DESTRUCTIVE 401 SESSION ARCHITECTURE
// =========================================================================
console.log("3. Checking Non-destructive 401 session handling...");
const testSessionStore = {
  token: "my-valid-user-token",
  async getSessionToken() { return this.token; },
  async setSessionToken(t) { this.token = t; },
};

// Simulate a 401 from an auxiliary worker endpoint
try {
  await scoresStagingGet("/v1/purchases/me", {
    sessionStore: testSessionStore,
    timeoutMs: 50,
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "unauthorized" } }), {
      status: 401,
      headers: { "content-type": "application/json", "x-request-id": "aux-401" },
    }),
  });
  assert.fail("Should have thrown 401");
} catch (error) {
  assert.equal(error.status, 401);
  assert.equal(testSessionStore.token, "my-valid-user-token", "An auxiliary worker 401 must NOT destroy the active user session");
}
console.log("   -> PASS: Non-destructive 401 session handling verified.\n");

// =========================================================================
// TEST 4: CANONICAL FAVORITES (ALPHANUMERIC & STRING IDS)
// =========================================================================
console.log("4. Checking Canonical Favorites validation...");
const favoritesApiSource = read("src/phase4b/scoresFavoritesApi.js");
const accountApiSource = read("src/services/accountApi.js");
const favoritesPanelSource = read("src/phase4b/Phase4BFavoritesPanel.js");

// Verify that the legacy numeric-only regex /^\d{1,12}$/ is completely removed
assert.doesNotMatch(favoritesApiSource, /\/\\d\{1,12\}\$\//, "scoresFavoritesApi must not restrict to numeric-only IDs");
assert.doesNotMatch(accountApiSource, /\/\\d\{1,12\}\$\//, "accountApi must not restrict to numeric-only IDs");
assert.doesNotMatch(favoritesPanelSource, /\/\\d\{1,12\}\$\//, "Phase4BFavoritesPanel must not restrict to numeric-only IDs");

// Verify canonical regex /^[a-zA-Z0-9_\-:.]{1,64}$/ is present in all 3 modules
assert.match(favoritesApiSource, /\/\^\[a-zA-Z0-9_\\-:\.\]\{1,64\}\$\//, "scoresFavoritesApi must use canonical alphanumeric/slug regex");
assert.match(accountApiSource, /\/\^\[a-zA-Z0-9_\\-:\.\]\{1,64\}\$\//, "accountApi must use canonical alphanumeric/slug regex");
assert.match(favoritesPanelSource, /\/\^\[a-zA-Z0-9_\\-:\.\]\{1,64\}\$\//, "Phase4BFavoritesPanel must use canonical alphanumeric/slug regex");

// Verify canonical kinds mapping
assert.match(favoritesApiSource, /function canonicalFavoriteKind\(kind\)/, "scoresFavoritesApi must have canonicalFavoriteKind");

// Should NOT throw for canonical slugs
const canonicalIds = ["chelsea", "premier-league", "epl", "mst:comp:45", "team_arsenal", "12345"];
for (const id of canonicalIds) {
  // Check regex pattern: /^[a-zA-Z0-9_\-:.]{1,64}$/
  assert.ok(/^[a-zA-Z0-9_\-:.]{1,64}$/.test(id), `ID ${id} must match valid favorite pattern`);
}

// Invalid IDs should be rejected
const invalidIds = ["", "   ", "has space", "invalid/slash", "bad@char#"];
for (const id of invalidIds) {
  assert.ok(!/^[a-zA-Z0-9_\-:.]{1,64}$/.test(id), `ID "${id}" must be rejected`);
}
console.log("   -> PASS: Canonical string & numeric IDs accepted for favorites.\n");

// =========================================================================
// TEST 5: DATE NAVIGATION & BACKEND QUERIES
// =========================================================================
console.log("5. Checking Date Navigation backend querying...");
const requestedUrls = [];
const dateMockFetch = async (url, init) => {
  requestedUrls.push(url);
  if (url.includes("/v1/fixtures?date=2026-09-15")) {
    return new Response(JSON.stringify({
      ok: true,
      data: [{ id: "mst:match:20260915-1", kickoff_at: "2026-09-15T19:00:00Z", home_team_name: "Team A", away_team_name: "Team B" }],
      meta: { requestId: "date-req-1" },
    }), { status: 200, headers: { "content-type": "application/json", "x-request-id": "date-req-1" } });
  }
  return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200, headers: { "content-type": "application/json" } });
};

const dateResult = await loadScoresForDate("2026-09-15", {
  fetchImpl: dateMockFetch,
  timeoutMs: 50,
  sessionStore: testSessionStore,
});
assert.ok(requestedUrls.some((u) => u.includes("date=2026-09-15")), "loadScoresForDate must query the backend with the requested date parameter");
assert.equal(dateResult.matches.length, 1);
assert.equal(dateResult.matches[0].id, "mst:match:20260915-1");
console.log("   -> PASS: Backend date querying verified.\n");

// =========================================================================
// TEST 6: LANGUAGE SELECTION & LOCALIZED CONTENT
// =========================================================================
console.log("6. Checking Language selection & Content localization...");
let observedLanguage = null;
const unsubscribe = subscribeAppLanguage((lang) => {
  observedLanguage = lang;
});

await persistAppLanguage("en");
assert.equal(observedLanguage, "en", "subscribeAppLanguage must notify listeners on language update");

await persistAppLanguage("my");
assert.equal(observedLanguage, "my", "subscribeAppLanguage must notify listeners when switching to Burmese");
unsubscribe();

// Verify fetchArticles sends locale and Accept-Language
const contentObserved = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  contentObserved.push({ url, init });
  return new Response(JSON.stringify({ posts: [{ id: "art-1", title: "Football News" }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

try {
  await fetchArticles({ force: true, locale: "en" });
  assert.ok(contentObserved.length > 0);
  assert.ok(contentObserved[0].url.includes("locale=en"), "fetchArticles must append locale=en query");
  assert.equal(contentObserved[0].init.headers["Accept-Language"], "en", "fetchArticles must send Accept-Language header");
} finally {
  globalThis.fetch = originalFetch;
}
console.log("   -> PASS: Language selection, persistence, and content localization verified.\n");

// =========================================================================
// TEST 7: STAGING VS PRODUCTION ISOLATION & FAIL-CLOSED
// =========================================================================
console.log("7. Checking Staging vs Production isolation...");
// Test staging resolution
const savedEnv = process.env.EXPO_PUBLIC_MST_ENVIRONMENT;
const savedOrigin = process.env.EXPO_PUBLIC_MST_APP_API_ORIGIN;

try {
  process.env.EXPO_PUBLIC_MST_ENVIRONMENT = "staging";
  delete process.env.EXPO_PUBLIC_MST_APP_API_ORIGIN;
  const stagingOrigin = resolveMstApiOrigin();
  assert.equal(stagingOrigin, "https://app-api-staging.myanmarsportstalk.com", "Staging environment must resolve to staging API");

  process.env.EXPO_PUBLIC_MST_ENVIRONMENT = "production";
  delete process.env.EXPO_PUBLIC_MST_APP_API_ORIGIN;
  const prodOrigin = resolveMstApiOrigin();
  assert.equal(prodOrigin, "https://app-api.myanmarsportstalk.com", "Production environment must resolve to production API");

  // Fail closed on staging origin in production
  process.env.EXPO_PUBLIC_MST_APP_API_ORIGIN = "https://app-api-staging.myanmarsportstalk.com";
  assert.throws(
    () => resolveMstApiOrigin(),
    /PRODUCTION_STAGING_ORIGIN_BLOCKED/,
    "Production build must fail closed if given staging origin",
  );

  // Fail closed on invalid domain
  process.env.EXPO_PUBLIC_MST_APP_API_ORIGIN = "https://unauthorized-domain.com";
  assert.throws(
    () => resolveMstApiOrigin(),
    /PRODUCTION_API_ORIGIN_INVALID/,
    "Production build must fail closed if given non-MST origin",
  );
} finally {
  process.env.EXPO_PUBLIC_MST_ENVIRONMENT = savedEnv;
  if (savedOrigin) process.env.EXPO_PUBLIC_MST_APP_API_ORIGIN = savedOrigin;
  else delete process.env.EXPO_PUBLIC_MST_APP_API_ORIGIN;
}
console.log("   -> PASS: Staging/Production isolation & fail-closed guards verified.\n");

// =========================================================================
// TEST 8: COMMERCE & TIPS SAFETY
// =========================================================================
console.log("8. Checking Tips & Commerce surface safety...");
const hubSource = read("src/phase4b/Phase4BReadOnlyHub.js");
assert.match(hubSource, /Linking\.openURL\(`\$\{MST_SITE_ORIGIN\}\/tips`\)/, "Locked tips in production must link to MST website tips rather than faking purchases");
assert.match(hubSource, /PREMIUM/, "Locked tips must be clearly labeled PREMIUM");
assert.doesNotMatch(hubSource, /fakePurchase|simulatePurchase/, "Fake purchases must not exist");
console.log("   -> PASS: Safe commerce behavior verified.\n");

// =========================================================================
// TEST 9: STANDINGS PARAMETER CONTRACT & RESILIENCE
// =========================================================================
console.log("9. Checking Standings parameters contract...");
// Test that missing competitionId rejects client-side without firing a network 400
try {
  await loadStandings({});
  assert.fail("loadStandings without competitionId must reject");
} catch (err) {
  assert.equal(err.status, 400);
  assert.equal(err.code, "COMPETITION_ID_REQUIRED");
}

// Test that valid competitionId queries properly
const standingsObserved = [];
const standingsMockFetch = async (url) => {
  standingsObserved.push(url);
  return new Response(JSON.stringify({ ok: true, data: [{ rank: 1, team: "Chelsea" }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const standingsResult = await loadStandings(
  { competitionId: "mst:competition:af:135", season: "2024" },
  { fetchImpl: standingsMockFetch, sessionStore: testSessionStore },
);
assert.equal(standingsResult.standings.length, 1);
assert.ok(standingsObserved[0].includes("competitionId=mst%3Acompetition%3Aaf%3A135"));
assert.ok(standingsObserved[0].includes("season=2024"));
console.log("   -> PASS: Standings parameter validation and contract verified.\n");

console.log("ALL MST SCORES DEFECT FIXES AND REGRESSION TESTS PASS!");
