import assert from "node:assert/strict";
import {
  MST_SCORES_STAGING_ORIGIN,
  canonicalMatchId,
  loadMatchCenter,
  loadScoresFeed,
  loadScoresOverview,
  normalizeTipPreview,
  scoresStagingGet,
} from "../src/phase4b/scoresStagingApi.js";

const MATCH_ID = "mst:match:af:1627535";

function jsonResponse(data, { status = 200, requestId = "request-fixture" } = {}) {
  return new Response(JSON.stringify({ ok: status < 400, data, meta: { requestId } }), {
    status,
    headers: { "content-type": "application/json", "x-request-id": requestId },
  });
}

async function testReadOnlyFeed() {
  const observed = [];
  const fetchImpl = async (url, init) => {
    observed.push({ url, init });
    return jsonResponse([{ id: MATCH_ID }], { requestId: "feed-request" });
  };
  const result = await loadScoresFeed("fixtures", { fetchImpl, timeoutMs: 50 });
  assert.equal(MST_SCORES_STAGING_ORIGIN, "https://mst-scores-api-staging.betflowapp.workers.dev");
  assert.deepEqual(result, { matches: [{ id: MATCH_ID }], requestId: "feed-request" });
  assert.equal(observed[0].url, `${MST_SCORES_STAGING_ORIGIN}/v1/fixtures?limit=50`);
  assert.equal(observed[0].init.method, "GET");
  assert.equal(observed[0].init.body, undefined);
}

async function testCanonicalMatchFlow() {
  const observed = [];
  const fetchImpl = async (url, init) => {
    observed.push({ url, init });
    if (url.includes("/v1/matches/")) return jsonResponse({ id: MATCH_ID }, { requestId: "match-request" });
    return jsonResponse([
      { id: "free", title: "Free view", access_level: "free", locked: 0, selection: "HOME" },
      { id: "paid", title: "Paid view", access_level: "paid", locked: 1, selection: "AWAY" },
    ], { requestId: "tips-request" });
  };
  const result = await loadMatchCenter(MATCH_ID, { fetchImpl, timeoutMs: 50 });
  assert.equal(canonicalMatchId(result.match), MATCH_ID);
  assert.equal(observed[0].url, `${MST_SCORES_STAGING_ORIGIN}/v1/matches/${encodeURIComponent(MATCH_ID)}`);
  assert.equal(observed[1].url, `${MST_SCORES_STAGING_ORIGIN}/v1/tips?matchId=${encodeURIComponent(MATCH_ID)}&limit=10`);
  assert.ok(observed.every(({ init }) => init.method === "GET" && init.body === undefined));
  assert.deepEqual(result.requestIds, { match: "match-request", tips: "tips-request" });
  assert.equal(result.tips[0].selection, "HOME");
  assert.equal(result.tips[1].selection, null, "paid selection must remain hidden even if supplied upstream");
}

async function testOverviewCombinesRealReadFeeds() {
  const observed = [];
  const fetchImpl = async (url, init) => {
    observed.push({ url, init });
    if (url.includes("/v1/fixtures")) return jsonResponse([{ id: MATCH_ID, status: "scheduled" }], { requestId: "fixtures-request" });
    if (url.includes("/v1/live")) return jsonResponse([{ id: MATCH_ID, status: "live" }], { requestId: "live-request" });
    return new Response(JSON.stringify({ error: { message: "results unavailable" } }), {
      status: 503,
      headers: { "x-request-id": "results-error" },
    });
  };

  const result = await loadScoresOverview({ fetchImpl, timeoutMs: 50 });
  assert.equal(result.matches.length, 1, "canonical matches must be de-duplicated across feeds");
  assert.equal(result.matches[0].id, MATCH_ID);
  assert.equal(result.matches[0].status, "live");
  assert.deepEqual(result.requestIds, { fixtures: "fixtures-request", live: "live-request" });
  assert.deepEqual(result.warnings, [{ feed: "results", message: "results unavailable", requestId: "results-error" }]);
  assert.ok(observed.every(({ init }) => init.method === "GET" && init.body === undefined));
}

async function testFailClosedIdentityAndErrors() {
  assert.deepEqual(normalizeTipPreview({ access_level: "subscriber", locked: 0, selection: "DRAW" }), {
    id: "",
    title: "MST Tip",
    summary: "",
    accessLevel: "subscriber",
    locked: true,
    selection: null,
  });

  await assert.rejects(
    () => loadMatchCenter(MATCH_ID, {
      fetchImpl: async () => jsonResponse({ id: "different-match" }, { requestId: "mismatch-request" }),
      timeoutMs: 50,
    }),
    (error) => error.code === "CANONICAL_MATCH_MISMATCH" && error.requestId === "mismatch-request",
  );

  await assert.rejects(
    () => scoresStagingGet("/v1/fixtures", {
      fetchImpl: async () => new Response(JSON.stringify({ error: { message: "dependency unavailable" } }), {
        status: 503,
        headers: { "x-request-id": "error-request" },
      }),
      timeoutMs: 50,
    }),
    (error) => error.status === 503 && error.requestId === "error-request",
  );

  await assert.rejects(
    () => scoresStagingGet("/v1/fixtures", {
      fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      }),
      timeoutMs: 5,
    }),
    (error) => error.code === "STAGING_TIMEOUT",
  );
}

await testReadOnlyFeed();
await testOverviewCombinesRealReadFeeds();
await testCanonicalMatchFlow();
await testFailClosedIdentityAndErrors();
console.log("Phase 4B Scores API tests passed: staging-only GET routes, canonical match identity, request correlation, timeout handling, and locked-tip protection are enforced.");
