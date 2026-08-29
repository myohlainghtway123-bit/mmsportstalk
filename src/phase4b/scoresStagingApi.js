export const MST_SCORES_STAGING_ORIGIN = "https://mst-scores-api-staging.betflowapp.workers.dev";
export const SCORES_REQUEST_TIMEOUT_MS = 8_000;

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
    throw new ScoresStagingError("The staging service returned an unreadable response.", {
      code: "STAGING_RESPONSE_INVALID",
      status: response.status,
      requestId: response.headers?.get?.("x-request-id") || null,
    });
  }
}

export async function scoresStagingGet(path, {
  fetchImpl = fetch,
  timeoutMs = SCORES_REQUEST_TIMEOUT_MS,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${MST_SCORES_STAGING_ORIGIN}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const payload = await decode(response);
    const requestId = requestIdFrom(response, payload);
    if (!response.ok) {
      throw new ScoresStagingError(
        payload?.error?.message || payload?.message || `Staging Scores API returned ${response.status}.`,
        { status: response.status, requestId },
      );
    }
    return { data: payload?.data ?? null, requestId };
  } catch (error) {
    if (error instanceof ScoresStagingError) throw error;
    if (controller.signal.aborted || error?.name === "AbortError") {
      throw new ScoresStagingError("The staging Scores API timed out. Please retry.", {
        code: "STAGING_TIMEOUT",
      });
    }
    throw new ScoresStagingError("The staging Scores API is unavailable. Please retry.");
  } finally {
    clearTimeout(timer);
  }
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

export async function loadScoresOverview(options) {
  const feeds = Object.keys(FEED_ROUTES);
  const settled = await Promise.allSettled(feeds.map((feed) => loadScoresFeed(feed, options)));
  const successful = settled
    .map((result, index) => ({ feed: feeds[index], result }))
    .filter(({ result }) => result.status === "fulfilled");

  if (successful.length === 0) {
    throw settled[0]?.reason || new ScoresStagingError("No staging Scores feed is available.");
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

  try {
    const tips = await scoresStagingGet(
      `/v1/tips?matchId=${encodeURIComponent(canonicalId)}&limit=10`,
      options,
    );
    return {
      match: detail.data,
      tips: Array.isArray(tips.data) ? tips.data.map(normalizeTipPreview) : [],
      tipsError: null,
      requestIds: { match: detail.requestId, tips: tips.requestId },
    };
  } catch (error) {
    return {
      match: detail.data,
      tips: [],
      tipsError: error?.message || "Tip preview is unavailable.",
      requestIds: { match: detail.requestId, tips: error?.requestId || null },
    };
  }
}
