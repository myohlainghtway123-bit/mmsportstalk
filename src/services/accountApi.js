const API_BASE = "https://myanmarsportstalk.com/api";

export class MstApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = "MstApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function decodeResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return { message: text };
  }
}

function errorMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  return (
    payload.error ||
    payload.message ||
    payload.detail ||
    payload.reason ||
    payload.errors?.[0]?.message ||
    fallback
  );
}

async function api(path, { method = "GET", body, signal } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  const payload = await decodeResponse(response);
  if (!response.ok) {
    throw new MstApiError(
      errorMessage(payload, `MST API request failed (${response.status})`),
      response.status,
      payload
    );
  }
  return payload;
}

export function extractUser(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.user && typeof payload.user === "object") return payload.user;
  if (payload.profile && typeof payload.profile === "object") return payload.profile;
  if (payload.data && typeof payload.data === "object") {
    if (payload.data.user) return payload.data.user;
    if (payload.data.profile) return payload.data.profile;
    return payload.data;
  }
  if (payload.email || payload.name || payload.id || payload.userId) return payload;
  return null;
}

export function isAuthenticatedPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (payload.authenticated === true || payload.signedIn === true || payload.loggedIn === true) return true;
  if (payload.authenticated === false || payload.signedIn === false || payload.loggedIn === false) return false;
  return Boolean(extractUser(payload));
}

export async function getAuthStatus(options) {
  try {
    const payload = await api("/auth/status", options);
    return { authenticated: isAuthenticatedPayload(payload), user: extractUser(payload), payload };
  } catch (error) {
    if (error instanceof MstApiError && error.status === 401) {
      return { authenticated: false, user: null, payload: error.payload };
    }
    throw error;
  }
}

export async function startEmailLogin(email) {
  return api("/auth/email/start", {
    method: "POST",
    body: { email: String(email || "").trim().toLowerCase() },
  });
}

export async function verifyEmailLogin(email, code) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedCode = String(code || "").trim();
  const payload = await api("/auth/email/verify", {
    method: "POST",
    body: { email: normalizedEmail, code: normalizedCode },
  });
  const status = await getAuthStatus().catch(() => null);
  return { payload, status };
}

export async function logout() {
  try {
    return await api("/auth/logout", { method: "POST", body: {} });
  } catch (error) {
    if (error instanceof MstApiError && error.status === 405) {
      return api("/auth/logout");
    }
    throw error;
  }
}

export const getProfile = (options) => api("/account/profile", options);
export const getFavorites = (options) => api("/account/favorites", options);
export const getAccountPredictions = (options) => api("/account/predictions", options);
export const getLeaderboard = (options) => api("/predictions/leaderboard", options);

function entityTypeAliases(kind) {
  const value = String(kind || "team").toLowerCase();
  if (value.startsWith("comp") || value.startsWith("league")) return ["competition", "league"];
  if (value.startsWith("player")) return ["player"];
  return ["team"];
}

async function tryMutation(attempts) {
  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await api(attempt.path, attempt.options);
    } catch (error) {
      lastError = error;
      // Authentication and server failures should not be retried with alternate shapes.
      if (!(error instanceof MstApiError) || error.status === 401 || error.status >= 500) throw error;
      if (![400, 404, 405, 409, 422].includes(error.status)) throw error;
    }
  }
  throw lastError || new MstApiError("MST API did not accept the request.");
}

export async function setFavorite({ kind, id, active }) {
  const aliases = entityTypeAliases(kind);
  const entityId = String(id);
  const attempts = [];

  for (const type of aliases) {
    attempts.push({
      path: "/account/favorites",
      options: { method: "POST", body: { type, id: entityId, action: active ? "add" : "remove" } },
    });
    attempts.push({
      path: "/account/favorites",
      options: { method: "POST", body: { kind: type, entityId, favorite: Boolean(active) } },
    });
    attempts.push({
      path: "/account/favorites",
      options: { method: "PUT", body: { type, id: entityId, active: Boolean(active) } },
    });

    const idField = type === "team" ? "teamId" : type === "player" ? "playerId" : "competitionId";
    attempts.push({
      path: "/account/favorites",
      options: active
        ? { method: "POST", body: { [idField]: entityId } }
        : { method: "DELETE", body: { [idField]: entityId } },
    });
    attempts.push({
      path: "/account/favorites",
      options: active
        ? { method: "POST", body: { type, id: entityId } }
        : { method: "DELETE", body: { type, id: entityId } },
    });
  }

  return tryMutation(attempts);
}

export async function savePrediction({ matchId, pick }) {
  const id = String(matchId);
  const choice = String(pick).toLowerCase();
  const attempts = [
    { path: "/account/predictions", options: { method: "POST", body: { matchId: id, prediction: choice } } },
    { path: "/account/predictions", options: { method: "POST", body: { fixtureId: id, prediction: choice } } },
    { path: "/account/predictions", options: { method: "POST", body: { matchId: id, pick: choice } } },
    { path: "/account/predictions", options: { method: "POST", body: { fixtureId: id, pick: choice } } },
    { path: "/account/predictions", options: { method: "POST", body: { matchId: id, outcome: choice } } },
    { path: "/account/predictions", options: { method: "PUT", body: { matchId: id, prediction: choice } } },
  ];
  return tryMutation(attempts);
}

function walkArrays(value, found = [], depth = 0) {
  if (depth > 5 || value == null) return found;
  if (Array.isArray(value)) {
    found.push(value);
    for (const item of value.slice(0, 8)) walkArrays(item, found, depth + 1);
    return found;
  }
  if (typeof value === "object") {
    for (const child of Object.values(value)) walkArrays(child, found, depth + 1);
  }
  return found;
}

export function largestArray(payload) {
  return walkArrays(payload).sort((a, b) => b.length - a.length)[0] || [];
}

export function normalizeFavoritePayload(payload) {
  const result = { competitions: [], teams: [], players: [], raw: payload };
  if (!payload || typeof payload !== "object") return result;

  const candidates = [payload, payload.data, payload.favorites].filter(Boolean);
  for (const source of candidates) {
    if (!source || typeof source !== "object") continue;
    for (const key of ["competitions", "leagues", "favoriteCompetitions", "favorite_competitions"]) {
      if (Array.isArray(source[key])) result.competitions = source[key];
    }
    for (const key of ["teams", "favoriteTeams", "favorite_teams"]) {
      if (Array.isArray(source[key])) result.teams = source[key];
    }
    for (const key of ["players", "favoritePlayers", "favorite_players"]) {
      if (Array.isArray(source[key])) result.players = source[key];
    }
  }

  if (!result.competitions.length && !result.teams.length && !result.players.length) {
    const rows = largestArray(payload);
    for (const row of rows) {
      const type = String(row?.type || row?.kind || row?.entityType || "").toLowerCase();
      if (type.includes("team")) result.teams.push(row);
      else if (type.includes("player")) result.players.push(row);
      else if (type.includes("league") || type.includes("competition")) result.competitions.push(row);
    }
  }
  return result;
}

export function normalizePredictionPayload(payload) {
  const rows = largestArray(payload);
  return rows.map((row, index) => ({
    id: row?.id ?? row?.predictionId ?? `prediction-${index}`,
    matchId: row?.matchId ?? row?.fixtureId ?? row?.match_id ?? row?.fixture_id,
    pick: row?.prediction ?? row?.pick ?? row?.outcome ?? row?.selection ?? row?.result,
    points: row?.points ?? row?.score ?? row?.awardedPoints ?? 0,
    status: row?.status ?? row?.resultStatus ?? row?.state ?? "",
    match: row?.match ?? row?.fixture ?? null,
    raw: row,
  }));
}

export function normalizeLeaderboard(payload) {
  const rows = largestArray(payload);
  return rows.map((row, index) => ({
    rank: Number(row?.rank ?? row?.position ?? index + 1),
    id: row?.userId ?? row?.id ?? `leader-${index}`,
    name: row?.displayName ?? row?.name ?? row?.username ?? row?.email ?? "MST User",
    points: Number(row?.points ?? row?.totalPoints ?? row?.score ?? 0),
    correct: Number(row?.correct ?? row?.correctPredictions ?? row?.wins ?? 0),
    predictions: Number(row?.predictions ?? row?.predictionCount ?? row?.totalPredictions ?? 0),
    avatar: row?.avatar ?? row?.avatarUrl ?? row?.image ?? null,
    raw: row,
  }));
}

export const MST_SITE_URL = "https://myanmarsportstalk.com";
