import assert from "node:assert/strict";
import {
  MST_SCORES_STAGING_ORIGIN,
  canonicalMatchId,
  createTipPurchase,
  loadMatchCenter,
  loadScoresFeed,
  loadScoresOverview,
  loginScoresAccount,
  logoutScoresAccount,
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

function createSessionStore(initialToken = null) {
  let token = initialToken;
  const writes = [];
  return {
    async getSessionToken() {
      return token;
    },
    async setSessionToken(nextToken) {
      token = nextToken;
      writes.push(nextToken);
    },
    current() {
      return token;
    },
    writes,
  };
}

async function testReadOnlyFeed() {
  const observed = [];
  const sessionStore = createSessionStore();
  const fetchImpl = async (url, init) => {
    observed.push({ url, init });
    return jsonResponse([{ id: MATCH_ID }], { requestId: "feed-request" });
  };
  const result = await loadScoresFeed("fixtures", { fetchImpl, timeoutMs: 50, sessionStore });
  assert.equal(MST_SCORES_STAGING_ORIGIN, "https://scores-api-staging.myanmarsportstalk.com");
  assert.deepEqual(result, { matches: [{ id: MATCH_ID }], requestId: "feed-request" });
  assert.equal(observed[0].url, `${MST_SCORES_STAGING_ORIGIN}/v1/fixtures?limit=50`);
  assert.equal(observed[0].init.method, "GET");
  assert.equal(observed[0].init.body, undefined);
  assert.equal(observed[0].init.headers.Authorization, undefined);
}

async function testCanonicalMatchFlow() {
  const observed = [];
  const sessionStore = createSessionStore();
  const fetchImpl = async (url, init) => {
    observed.push({ url, init });
    if (url.includes("/v1/matches/")) return jsonResponse({ id: MATCH_ID }, { requestId: "match-request" });
    return jsonResponse([
      { id: "free", title: "Free view", access_level: "free", locked: 0, selection: "HOME" },
      { id: "paid", title: "Paid view", access_level: "paid", locked: 1, selection: "AWAY" },
    ], { requestId: "tips-request" });
  };
  const result = await loadMatchCenter(MATCH_ID, { fetchImpl, timeoutMs: 50, sessionStore });
  assert.equal(canonicalMatchId(result.match), MATCH_ID);
  assert.equal(observed[0].url, `${MST_SCORES_STAGING_ORIGIN}/v1/matches/${encodeURIComponent(MATCH_ID)}`);
  assert.equal(observed[1].url, `${MST_SCORES_STAGING_ORIGIN}/v1/tips?matchId=${encodeURIComponent(MATCH_ID)}&limit=10`);
  assert.ok(observed.every(({ init }) => init.method === "GET" && init.body === undefined));
  assert.deepEqual(result.requestIds, { match: "match-request", tips: "tips-request", preview: "match-request" });
  assert.equal(result.tips[0].selection, "HOME");
  assert.equal(result.tips[1].selection, null, "paid selection must remain hidden even if supplied upstream");
}

async function testOverviewCombinesRealReadFeeds() {
  const observed = [];
  const sessionStore = createSessionStore();
  const fetchImpl = async (url, init) => {
    observed.push({ url, init });
    if (url.includes("/v1/fixtures")) return jsonResponse([{ id: MATCH_ID, status: "scheduled" }], { requestId: "fixtures-request" });
    if (url.includes("/v1/live")) return jsonResponse([{ id: MATCH_ID, status: "live" }], { requestId: "live-request" });
    return new Response(JSON.stringify({ error: { message: "results unavailable" } }), {
      status: 503,
      headers: { "x-request-id": "results-error" },
    });
  };

  const result = await loadScoresOverview({ fetchImpl, timeoutMs: 50, sessionStore });
  assert.equal(result.matches.length, 1, "canonical matches must be de-duplicated across feeds");
  assert.equal(result.matches[0].id, MATCH_ID);
  assert.equal(result.matches[0].status, "live");
  assert.deepEqual(result.requestIds, { fixtures: "fixtures-request", live: "live-request" });
  assert.deepEqual(result.warnings, [{ feed: "results", message: "results unavailable", requestId: "results-error" }]);
  assert.ok(observed.every(({ init }) => init.method === "GET" && init.body === undefined));
}

async function testSharedSessionContract() {
  const sessionStore = createSessionStore();
  const observed = [];
  const loginFetch = async (url, init) => {
    observed.push({ url, init });
    return jsonResponse({ token: "shared-identity-token", tokenType: "Bearer" }, { requestId: "login-request" });
  };

  const login = await loginScoresAccount("qa@example.test", "not-a-real-secret", {
    fetchImpl: loginFetch,
    timeoutMs: 50,
    sessionStore,
  });
  assert.equal(login.token, "shared-identity-token");
  assert.equal(sessionStore.current(), "shared-identity-token", "shared identity token must persist through the existing session authority");
  assert.equal(observed[0].url, `${MST_SCORES_STAGING_ORIGIN}/v1/auth/login`);
  assert.equal(observed[0].init.headers.Authorization, undefined, "login must not send a stale bearer token");

  await scoresStagingGet("/v1/purchases/me", {
    sessionStore,
    timeoutMs: 50,
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers.Authorization, "Bearer shared-identity-token");
      return jsonResponse([], { requestId: "authenticated-request" });
    },
  });

  await assert.rejects(
    () => scoresStagingGet("/v1/purchases/me", {
      sessionStore,
      timeoutMs: 50,
      fetchImpl: async () => new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "expired" } }), {
        status: 401,
        headers: { "x-request-id": "expired-request" },
      }),
    }),
    (error) => error.status === 401 && error.requestId === "expired-request",
  );
  assert.equal(sessionStore.current(), null, "401 must clear the persisted shared session");

  await sessionStore.setSessionToken("logout-token");
  await logoutScoresAccount({
    sessionStore,
    timeoutMs: 50,
    fetchImpl: async (url, init) => {
      assert.equal(url, `${MST_SCORES_STAGING_ORIGIN}/v1/auth/logout`);
      assert.equal(init.headers.Authorization, "Bearer logout-token");
      return jsonResponse({ revoked: true }, { requestId: "logout-request" });
    },
  });
  assert.equal(sessionStore.current(), null, "logout must clear the local shared session even after the API call succeeds");
}

async function testTipPurchaseContract() {
  const sessionStore = createSessionStore("buyer-session-token");
  const observed = [];
  const result = await createTipPurchase("tip paid/42", {
    sessionStore,
    timeoutMs: 50,
    fetchImpl: async (url, init) => {
      observed.push({ url, init });
      return jsonResponse({
        purchaseRequired: true,
        entitled: false,
        purchase: { id: "purchase-42", tipId: "tip paid/42", status: "pending" },
      }, { status: 201, requestId: "purchase-request" });
    },
  });

  assert.equal(observed[0].url, `${MST_SCORES_STAGING_ORIGIN}/v1/purchases/tips/${encodeURIComponent("tip paid/42")}`);
  assert.equal(observed[0].init.method, "POST");
  assert.equal(observed[0].init.headers.Authorization, "Bearer buyer-session-token");
  assert.equal(observed[0].init.body, "{}", "Scores must not send price, currency, user ownership, payment state or entitlement fields");
  assert.equal(result.purchase.id, "purchase-42");
  assert.equal(result.purchaseRequired, true);

  await assert.rejects(
    () => createTipPurchase("", { sessionStore, timeoutMs: 50, fetchImpl: async () => { throw new Error("must not fetch"); } }),
    (error) => error.code === "TIP_ID_REQUIRED",
  );
}

async function testFailClosedIdentityAndErrors() {
  const sessionStore = createSessionStore();
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
      sessionStore,
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
      sessionStore,
    }),
    (error) => error.status === 503 && error.requestId === "error-request",
  );

  await assert.rejects(
    () => scoresStagingGet("/v1/fixtures", {
      fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      }),
      timeoutMs: 5,
      sessionStore,
    }),
    (error) => error.code === "STAGING_TIMEOUT",
  );
}

await testReadOnlyFeed();
await testOverviewCombinesRealReadFeeds();
await testCanonicalMatchFlow();
await testSharedSessionContract();
await testTipPurchaseContract();
await testFailClosedIdentityAndErrors();
console.log("Phase 4B Scores API tests passed: canonical reads, shared auth/session handling, server-owned tip purchase intent, request correlation, timeout handling, and locked-tip protection are enforced.");
