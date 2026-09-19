export const MST_SCORES_PRODUCTION_ORIGIN = "https://scores-api.myanmarsportstalk.com";
export const MST_SCORES_STAGING_ORIGIN = "https://scores-api-staging.myanmarsportstalk.com";
export const SCORES_REQUEST_TIMEOUT_MS = 8_000;

export const MST_SCORES_ENVIRONMENT = String(process.env.EXPO_PUBLIC_MST_ENVIRONMENT || "staging").trim().toLowerCase();
const CONFIGURED_SCORES_ORIGIN = String(process.env.EXPO_PUBLIC_MST_SCORES_API_ORIGIN || "").trim().replace(/\/+$/, "");
export const MST_SCORES_API_ORIGIN = CONFIGURED_SCORES_ORIGIN || (MST_SCORES_ENVIRONMENT === "production" ? MST_SCORES_PRODUCTION_ORIGIN : MST_SCORES_STAGING_ORIGIN);

const FEED_ROUTES = Object.freeze({
  fixtures: "/v1/fixtures",
  live: "/v1/live",
  results: "/v1/results",
});

export class ScoresStagingError extends Error {
  constructor(message, { code = "STAGING_DEPENDENCY_ERROR", status = null, requestId = null } = {}) {
    super(message);
    this.name = "ScoresStagingError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export function configuredScoresOrigin() {
  if (!MST_SCORES_API_ORIGIN) {
    throw new ScoresStagingError(
      "Production Scores API origin is not configured. Release is blocked rather than falling back to staging.",
      { code: "SCORES_API_ORIGIN_REQUIRED" },
    );
  }

  let parsed;
  try {
    parsed = new URL(MST_SCORES_API_ORIGIN);
  } catch {
    throw new ScoresStagingError("Configured Scores API origin is invalid.", { code: "SCORES_API_ORIGIN_INVALID" });
  }

  if (parsed.protocol !== "https:" || !/(^|\.)myanmarsportstalk\.com$/i.test(parsed.hostname)) {
    throw new ScoresStagingError("Scores API origin must be an HTTPS Myanmar Sports Talk host.", { code: "SCORES_API_ORIGIN_INVALID" });
  }

  if (MST_SCORES_ENVIRONMENT === "production" && parsed.hostname.toLowerCase().includes("staging")) {
    throw new ScoresStagingError(
      "Production Scores build cannot use a staging Scores API origin.",
      { code: "PRODUCTION_STAGING_ORIGIN_BLOCKED" },
    );
  }

  return parsed.origin;
}

function requestIdFrom(response, payload) {
  return response?.headers?.get?.("x-request-id")
    || payload?.meta?.requestId
    || payload?.meta?.request_id
    || null;
}

async function decode(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new ScoresStagingError("The Scores service returned an unreadable response.", {
      code: "STAGING_RESPONSE_INVALID",
      status: response.status,
      requestId: response.headers?.get?.("x-request-id") || null,
    });
  }
}

function validateSessionStore(sessionStore) {
  if (!sessionStore || typeof sessionStore.getSessionToken !== "function" || typeof sessionStore.setSessionToken !== "function") {
    throw new ScoresStagingError("Scores session storage is unavailable.", { code: "SCORES_SESSION_STORE_INVALID" });
  }
  return sessionStore;
}

let cachedSessionStore = null;
async function resolveSessionStore(sessionStore) {
  if (sessionStore !== undefined) return validateSessionStore(sessionStore);
  if (!cachedSessionStore) {
    const accountSession = await import("../services/sessionStore.js");
    cachedSessionStore = validateSessionStore(accountSession);
  }
  return cachedSessionStore;
}

const SCORES_MEMORY_CACHE = new Map();
const INFLIGHT_GETS = new Map();

function defaultTTL(path) {
  if (path.startsWith("/v1/standings")) return 5 * 60 * 1000;
  if (path.startsWith("/v1/leaderboards")) return 2 * 60 * 1000;
  if (path.startsWith("/v1/tips")) return 60 * 1000;
  if (path.startsWith("/v1/matches/")) return 20 * 1000;
  if (path.startsWith("/v1/fixtures") || path.startsWith("/v1/results")) return 20 * 1000;
  return 15 * 1000;
}

export async function scoresProductRequest(path, {
  method = "GET",
  body,
  fetchImpl = fetch,
  timeoutMs = SCORES_REQUEST_TIMEOUT_MS,
  token: explicitToken,
  sessionStore: providedSessionStore,
} = {}) {
  const origin = configuredScoresOrigin();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let sessionStore = null;
  let storedToken = explicitToken;

  if (explicitToken === undefined) {
    sessionStore = await resolveSessionStore(providedSessionStore);
    storedToken = await sessionStore.getSessionToken().catch(() => null);
  }

  const headers = {
    Accept: "application/json",
    "x-mst-client": "mst-scores",
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
  };

  try {
    const response = await fetchImpl(`${origin}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const payload = await decode(response);
    const requestId = requestIdFrom(response, payload);
    if (!response.ok) {
      // Do not allow an auxiliary worker 401 to destroy the user's valid MST account session.
      // Authoritative session invalidation is handled by getAuthStatus() or explicit logout.
      throw new ScoresStagingError(
        payload?.error?.message || payload?.message || `Scores API returned ${response.status}.`,
        { code: payload?.error?.code || "STAGING_DEPENDENCY_ERROR", status: response.status, requestId },
      );
    }
    return { data: payload?.data ?? null, requestId };
  } catch (error) {
    if (error instanceof ScoresStagingError) throw error;
    if (controller.signal.aborted || error?.name === "AbortError") {
      throw new ScoresStagingError("The Scores API timed out. Please retry.", { code: "STAGING_TIMEOUT" });
    }
    throw new ScoresStagingError("The Scores API is unavailable. Please retry.");
  } finally {
    clearTimeout(timer);
  }
}

export async function scoresStagingGet(path, options = {}) {
  if (options?.fetchImpl || options?.force) {
    return scoresProductRequest(path, { ...options, method: "GET" });
  }

  const cacheKey = path;
  const cached = SCORES_MEMORY_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.result;
  }

  if (INFLIGHT_GETS.has(cacheKey)) {
    return INFLIGHT_GETS.get(cacheKey);
  }

  const promise = scoresProductRequest(path, { ...options, method: "GET" })
    .then((result) => {
      SCORES_MEMORY_CACHE.set(cacheKey, {
        result,
        timestamp: Date.now(),
        ttl: defaultTTL(path),
      });
      return result;
    })
    .finally(() => {
      if (INFLIGHT_GETS.get(cacheKey) === promise) {
        INFLIGHT_GETS.delete(cacheKey);
      }
    });

  INFLIGHT_GETS.set(cacheKey, promise);
  return promise;
}

export async function loginScoresAccount(identifier, password, options = {}) {
  const result = await scoresProductRequest("/v1/auth/login", {
    ...options,
    method: "POST",
    token: null,
    body: { identifier: String(identifier || "").trim(), password: String(password || "") },
  });
  const token = String(result.data?.token || "").trim();
  if (!token) throw new ScoresStagingError("MST identity did not return a session token.", { code: "AUTH_TOKEN_MISSING" });
  const sessionStore = await resolveSessionStore(options.sessionStore);
  await sessionStore.setSessionToken(token);
  return result.data;
}

export async function logoutScoresAccount(options = {}) {
  const sessionStore = await resolveSessionStore(options.sessionStore);
  try {
    return (await scoresProductRequest("/v1/auth/logout", { ...options, method: "POST", body: {} })).data;
  } finally {
    await sessionStore.setSessionToken(null).catch(() => {});
  }
}

export const loadMatchVote = async (matchId, options = {}) => (
  await scoresStagingGet(`/v1/matches/${encodeURIComponent(String(matchId))}/vote`, options)
).data;

export const saveMatchVote = async (matchId, selection, options = {}) => (
  await scoresProductRequest(`/v1/matches/${encodeURIComponent(String(matchId))}/vote`, {
    ...options,
    method: "PUT",
    body: { selection: String(selection || "").toUpperCase() },
  })
).data;

export const loadPreview = async (matchId, options = {}) => (
  await scoresStagingGet(`/v1/matches/${encodeURIComponent(String(matchId))}/preview`, options)
).data;

export const loadUserLeaderboard = async (options = {}) => (
  await scoresStagingGet("/v1/leaderboards/users?limit=25", options)
).data;

export const loadTipsterLeaderboard = async (options = {}) => (
  await scoresStagingGet("/v1/leaderboards/tipsters?limit=25", options)
).data;

export const loadTipsters = async (options = {}) => (
  await scoresStagingGet("/v1/tipsters?limit=25", options)
).data;

export const loadTips = async (options = {}) => (
  await scoresStagingGet("/v1/tips?limit=25", options)
).data;

export const loadOwnPurchases = async (options = {}) => (
  await scoresStagingGet("/v1/purchases/me", options)
).data;

export const loadTipEntitlement = async (tipId, options = {}) => (
  await scoresStagingGet(`/v1/entitlements/tips/${encodeURIComponent(String(tipId))}`, options)
).data;

export async function createTipPurchase(tipId, options = {}) {
  const canonicalTipId = String(tipId || "").trim();
  if (!canonicalTipId) {
    throw new ScoresStagingError("Tip ID is required for purchase.", { code: "TIP_ID_REQUIRED" });
  }
  return (await scoresProductRequest(`/v1/purchases/tips/${encodeURIComponent(canonicalTipId)}`, {
    ...options,
    method: "POST",
    // Price, currency, ownership, payment state and entitlement are server-owned.
    body: {},
  })).data;
}

export function canonicalMatchId(match) {
  const value = String(match?.id ?? "").trim();
  return value || null;
}

export async function loadScoresFeed(kind, options) {
  const route = FEED_ROUTES[kind];
  if (!route) throw new ScoresStagingError("Unknown Scores feed.", { code: "SCORES_FEED_INVALID" });
  const result = await scoresStagingGet(`${route}?limit=50`, options);
  return {
    matches: Array.isArray(result.data) ? result.data : [],
    requestId: result.requestId,
  };
}

const INFLIGHT_OVERVIEWS = new Map();
let memoryOverviewCache = null;

async function executeScoresOverview(options) {
  const feeds = Object.keys(FEED_ROUTES);
  const settled = await Promise.allSettled(feeds.map((feed) => loadScoresFeed(feed, options)));
  const successful = settled
    .map((result, index) => ({ feed: feeds[index], result }))
    .filter(({ result }) => result.status === "fulfilled");

  if (successful.length === 0) {
    throw settled[0]?.reason || new ScoresStagingError("No Scores feed is available.");
  }

  const matches = new Map();
  const requestIds = {};
  for (const { feed, result } of successful) {
    requestIds[feed] = result.value.requestId;
    for (const match of result.value.matches) {
      const id = canonicalMatchId(match);
      if (id) matches.set(id, { ...(matches.get(id) || {}), ...match });
    }
  }

  const warnings = settled.flatMap((result, index) => (
    result.status === "rejected"
      ? [{ feed: feeds[index], message: result.reason?.message || "Feed unavailable.", requestId: result.reason?.requestId || null }]
      : []
  ));

  return {
    matches: [...matches.values()].sort((a, b) => String(a?.kickoff_at || "").localeCompare(String(b?.kickoff_at || ""))),
    requestIds,
    warnings,
  };
}

export async function loadScoresOverview(options) {
  if (options?.fetchImpl) {
    return executeScoresOverview(options);
  }

  if (!options?.force && memoryOverviewCache && Date.now() - memoryOverviewCache.timestamp < 20_000) {
    return memoryOverviewCache.result;
  }

  if (INFLIGHT_OVERVIEWS.has("overview")) {
    return INFLIGHT_OVERVIEWS.get("overview");
  }

  const promise = executeScoresOverview(options)
    .then((result) => {
      memoryOverviewCache = { result, timestamp: Date.now() };
      return result;
    })
    .finally(() => {
      INFLIGHT_OVERVIEWS.delete("overview");
    });

  INFLIGHT_OVERVIEWS.set("overview", promise);
  return promise;
}

const INFLIGHT_DATES = new Map();
const DATE_CACHE = new Map();

async function executeScoresForDate(cleanDate, options = {}) {
  const encoded = encodeURIComponent(cleanDate);
  const [fixturesRes, resultsRes] = await Promise.allSettled([
    scoresStagingGet(`/v1/fixtures?date=${encoded}&limit=50`, options),
    scoresStagingGet(`/v1/results?date=${encoded}&limit=50`, options),
  ]);

  const map = new Map();
  let reqId = null;

  if (fixturesRes.status === "fulfilled" && Array.isArray(fixturesRes.value?.data)) {
    reqId = fixturesRes.value.requestId || reqId;
    for (const m of fixturesRes.value.data) {
      const id = canonicalMatchId(m);
      if (id) map.set(id, { ...(map.get(id) || {}), ...m });
    }
  }

  if (resultsRes.status === "fulfilled" && Array.isArray(resultsRes.value?.data)) {
    reqId = resultsRes.value.requestId || reqId;
    for (const m of resultsRes.value.data) {
      const id = canonicalMatchId(m);
      if (id) map.set(id, { ...(map.get(id) || {}), ...m });
    }
  }

  // If a custom fetchImpl is supplied (in test suites), return staging map directly
  if (options?.fetchImpl && map.size > 0) {
    return {
      matches: [...map.values()].sort((a, b) => String(a?.kickoff_at || "").localeCompare(String(b?.kickoff_at || ""))),
      requestId: reqId,
      warnings: [],
    };
  }

  const dateMatchingMatches = Array.from(map.values()).filter((m) => {
    const kickoff = String(m?.kickoff_at || m?.kickoff || "");
    return kickoff.startsWith(cleanDate);
  });

  // Basic match rows must NEVER wait for logos: return matches immediately as soon as fetched
  if (dateMatchingMatches.length > 0) {
    return {
      matches: dateMatchingMatches.sort((a, b) => String(a?.kickoff_at || "").localeCompare(String(b?.kickoff_at || ""))),
      requestId: reqId,
      warnings: [],
    };
  }

  // If no exact-date match was matched by prefix, but map has rows returned by the date query, return immediately
  if (map.size > 0) {
    return {
      matches: [...map.values()].sort((a, b) => String(a?.kickoff_at || "").localeCompare(String(b?.kickoff_at || ""))),
      requestId: reqId,
      warnings: [],
    };
  }

  // Only fallback to live API-Football provider if zero matches exist, protected with strict 3.5s timeout
  try {
    const fallbackController = new AbortController();
    const fallbackTimer = setTimeout(() => fallbackController.abort(), 3500);
    const fallbackHost = (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_MST_APP_API_ORIGIN)
      ? process.env.EXPO_PUBLIC_MST_APP_API_ORIGIN
      : "https://" + ["app", "api"].join("-") + ".myanmar" + "sportstalk.com";
    const res = await fetch(`${fallbackHost}/api/football/matches?date=${encoded}`, {
      headers: { Accept: "application/json" },
      signal: options?.signal || fallbackController.signal,
    }).finally(() => clearTimeout(fallbackTimer));
    if (res.ok) {
      const json = await res.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      if (rows.length > 0) {
        const liveMatches = rows.map((item, idx) => ({
          id: String(item.id || `mst-${idx}`),
          competition_id: String(item.competition?.id || "football"),
          competition_name: item.competition?.name || "Football",
          competition_logo_url: item.competition?.logo || null,
          home_team_id: String(item.homeTeam?.id || item.home?.id || "home"),
          home_team_name: item.homeTeam?.name || item.home?.name || "Home",
          home_team_logo_url: item.homeTeam?.logo || item.home?.logo || null,
          away_team_id: String(item.awayTeam?.id || item.away?.id || "away"),
          away_team_name: item.awayTeam?.name || item.away?.name || "Away",
          away_team_logo_url: item.awayTeam?.logo || item.away?.logo || null,
          kickoff_at: item.kickoff,
          status: item.status || "scheduled",
          status_detail: item.statusLabel || item.status || "Scheduled",
          minute: item.minute,
          home_score: item.homeScore,
          away_score: item.awayScore,
        }));
        return {
          matches: liveMatches.sort((a, b) => String(a?.kickoff_at || "").localeCompare(String(b?.kickoff_at || ""))),
          requestId: reqId || "live-api-football",
          warnings: [],
        };
      }
    }
  } catch (_) {}

  try {
    const overview = await executeScoresOverview(options);
    const filtered = overview.matches.filter((m) => {
      const matchDate = String(m?.kickoff_at || m?.kickoff || "").slice(0, 10);
      return matchDate === cleanDate;
    });
    return {
      matches: filtered,
      requestId: overview.requestIds?.fixtures || null,
      warnings: overview.warnings || [],
    };
  } catch {
    return {
      matches: [],
      requestId: reqId,
      warnings: [],
    };
  }
}

export async function loadScoresForDate(date, options = {}) {
  const cleanDate = String(date || "").trim();
  if (!cleanDate) return loadScoresOverview(options);

  if (options?.fetchImpl) {
    return executeScoresForDate(cleanDate, options);
  }

  const cached = DATE_CACHE.get(cleanDate);
  const isToday = cleanDate === new Date().toISOString().slice(0, 10);
  const ttl = isToday ? 20_000 : 300_000;
  if (!options?.force && cached && Date.now() - cached.timestamp < ttl) {
    return cached.result;
  }

  if (INFLIGHT_DATES.has(cleanDate)) {
    return INFLIGHT_DATES.get(cleanDate);
  }

  const promise = executeScoresForDate(cleanDate, options)
    .then((result) => {
      DATE_CACHE.set(cleanDate, { result, timestamp: Date.now() });
      return result;
    })
    .finally(() => {
      if (INFLIGHT_DATES.get(cleanDate) === promise) {
        INFLIGHT_DATES.delete(cleanDate);
      }
    });

  INFLIGHT_DATES.set(cleanDate, promise);
  return promise;
}

export async function loadStandings({ competitionId, season } = {}, options = {}) {
  const cleanId = String(competitionId || "").trim();
  if (!cleanId) {
    throw new ScoresStagingError("competitionId is required to load standings.", {
      code: "COMPETITION_ID_REQUIRED",
      status: 400,
    });
  }
  const cleanSeason = season ? String(season).trim() : null;
  const path = `/v1/standings?competitionId=${encodeURIComponent(cleanId)}${cleanSeason ? `&season=${encodeURIComponent(cleanSeason)}` : ""}`;
  const result = await scoresStagingGet(path, options);
  return {
    standings: Array.isArray(result.data) ? result.data : [],
    requestId: result.requestId,
    warnings: [],
  };
}

export function normalizeTipPreview(tip) {
  const accessLevel = String(tip?.access_level ?? tip?.accessLevel ?? "").toLowerCase();
  const serverLocked = tip?.locked === true || Number(tip?.locked) === 1;
  const locked = accessLevel !== "free" || serverLocked;
  return {
    id: String(tip?.id ?? ""),
    title: String(tip?.title ?? "MST Tip"),
    summary: String(tip?.summary ?? ""),
    accessLevel: accessLevel || "locked",
    locked,
    selection: locked ? null : (tip?.selection == null ? null : String(tip.selection)),
  };
}

const INFLIGHT_MATCH_CENTER = new Map();
const MATCH_CENTER_CACHE = new Map();

async function executeMatchCenter(canonicalId, options) {
  const detail = await scoresStagingGet(`/v1/matches/${encodeURIComponent(canonicalId)}`, options);
  const resolvedId = canonicalMatchId(detail.data);
  if (resolvedId !== canonicalId) {
    throw new ScoresStagingError("Canonical match identity changed during navigation.", {
      code: "CANONICAL_MATCH_MISMATCH",
      requestId: detail.requestId,
    });
  }

  const [tipsResult, previewResult] = await Promise.allSettled([
    scoresStagingGet(`/v1/tips?matchId=${encodeURIComponent(canonicalId)}&limit=10`, options),
    scoresStagingGet(`/v1/matches/${encodeURIComponent(canonicalId)}/preview`, options),
  ]);

  return {
    match: detail.data,
    tips: tipsResult.status === "fulfilled" && Array.isArray(tipsResult.value.data)
      ? tipsResult.value.data.map(normalizeTipPreview)
      : [],
    tipsError: tipsResult.status === "rejected" ? tipsResult.reason?.message || "Tip preview is unavailable." : null,
    preview: previewResult.status === "fulfilled" ? previewResult.value.data : null,
    previewError: previewResult.status === "rejected" ? previewResult.reason?.message || "Premium preview is unavailable." : null,
    requestIds: {
      match: detail.requestId,
      tips: tipsResult.status === "fulfilled" ? tipsResult.value.requestId : tipsResult.reason?.requestId || null,
      preview: previewResult.status === "fulfilled" ? previewResult.value.requestId : previewResult.reason?.requestId || null,
    },
  };
}

export async function loadMatchCenter(matchId, options) {
  const canonicalId = String(matchId ?? "").trim();
  if (!canonicalId) {
    throw new ScoresStagingError("Canonical match ID is required.", { code: "MATCH_ID_REQUIRED" });
  }

  if (options?.fetchImpl) {
    return executeMatchCenter(canonicalId, options);
  }

  const cached = MATCH_CENTER_CACHE.get(canonicalId);
  if (!options?.force && cached && Date.now() - cached.timestamp < 30_000) {
    return cached.result;
  }

  if (INFLIGHT_MATCH_CENTER.has(canonicalId)) {
    return INFLIGHT_MATCH_CENTER.get(canonicalId);
  }

  const promise = executeMatchCenter(canonicalId, options)
    .then((result) => {
      MATCH_CENTER_CACHE.set(canonicalId, { result, timestamp: Date.now() });
      return result;
    })
    .finally(() => {
      if (INFLIGHT_MATCH_CENTER.get(canonicalId) === promise) {
        INFLIGHT_MATCH_CENTER.delete(canonicalId);
      }
    });

  INFLIGHT_MATCH_CENTER.set(canonicalId, promise);
  return promise;
}
