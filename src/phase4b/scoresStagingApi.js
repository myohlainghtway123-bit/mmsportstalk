import { getSessionToken, setSessionToken } from "../services/accountApi";

export const MST_SCORES_STAGING_ORIGIN = "https://scores-api-staging.myanmarsportstalk.com";
export const SCORES_REQUEST_TIMEOUT_MS = 8_000;

export const MST_SCORES_ENVIRONMENT = String(process.env.EXPO_PUBLIC_MST_ENVIRONMENT || "staging").trim().toLowerCase();
const CONFIGURED_SCORES_ORIGIN = String(process.env.EXPO_PUBLIC_MST_SCORES_API_ORIGIN || "").trim().replace(/\/+$/, "");
export const MST_SCORES_API_ORIGIN = CONFIGURED_SCORES_ORIGIN || (MST_SCORES_ENVIRONMENT === "production" ? "" : MST_SCORES_STAGING_ORIGIN);

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

export async function scoresProductRequest(path, {
  method = "GET",
  body,
  fetchImpl = fetch,
  timeoutMs = SCORES_REQUEST_TIMEOUT_MS,
  token: explicitToken,
} = {}) {
  const origin = configuredScoresOrigin();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const storedToken = explicitToken === undefined ? await getSessionToken().catch(() => null) : explicitToken;
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
      if (response.status === 401 && storedToken) await setSessionToken(null).catch(() => {});
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
  return scoresProductRequest(path, { ...options, method: "GET" });
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
  await setSessionToken(token);
  return result.data;
}

export async function logoutScoresAccount(options = {}) {
  try {
    return (await scoresProductRequest("/v1/auth/logout", { ...options, method: "POST", body: {} })).data;
  } finally {
    await setSessionToken(null).catch(() => {});
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

export async function loadScoresOverview(options) {
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

export async function loadMatchCenter(matchId, options) {
  const canonicalId = String(matchId ?? "").trim();
  if (!canonicalId) {
    throw new ScoresStagingError("Canonical match ID is required.", { code: "MATCH_ID_REQUIRED" });
  }

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
