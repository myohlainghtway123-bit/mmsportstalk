import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { persistAppLanguage, syncStoredOnboardingFavorites } from "./onboardingStore";
import { favoriteMetadata } from "./favoriteCatalog";
import { MST_API_BASE, MST_SITE_ORIGIN } from "./mstApiConfig";
import { getStoredDevicePushToken, setStoredDevicePushToken } from "./pushTokenStore";

const AUTH_TOKEN_KEY = "mst.session.v1";
const LEGACY_AUTH_TOKEN_KEY = "@mst_session_token";
const AUTH_TOKEN_MIGRATION_KEY = "@mst_session_secure_store_migrated_v1";

let memoryToken = null;
let tokenLoad = null;

async function loadSessionToken() {
  const stored = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  if (stored) return stored;

  const migrated = await AsyncStorage.getItem(AUTH_TOKEN_MIGRATION_KEY);
  if (migrated === "1") return null;

  const legacy = String(await AsyncStorage.getItem(LEGACY_AUTH_TOKEN_KEY) || "").trim();
  if (legacy) await SecureStore.setItemAsync(AUTH_TOKEN_KEY, legacy);
  await AsyncStorage.multiRemove([LEGACY_AUTH_TOKEN_KEY]);
  await AsyncStorage.setItem(AUTH_TOKEN_MIGRATION_KEY, "1");
  return legacy || null;
}

export async function getSessionToken() {
  if (memoryToken) return memoryToken;
  try {
    tokenLoad ||= loadSessionToken().finally(() => { tokenLoad = null; });
    const stored = await tokenLoad;
    if (stored) memoryToken = stored;
    return stored;
  } catch {
    return null;
  }
}

export async function setSessionToken(token) {
  const clean = token ? String(token).trim() : null;
  memoryToken = clean;
  tokenLoad = null;
  if (clean) await SecureStore.setItemAsync(AUTH_TOKEN_KEY, clean);
  else await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  await AsyncStorage.multiRemove([LEGACY_AUTH_TOKEN_KEY]);
  await AsyncStorage.setItem(AUTH_TOKEN_MIGRATION_KEY, "1");
}

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
  try { return JSON.parse(text); } catch (_) { return { message: text }; }
}

function errorMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  return payload.error?.message || (typeof payload.error === "string" ? payload.error : null) || payload.message || payload.detail || payload.reason || payload.errors?.[0]?.message || fallback;
}

async function api(path, { method = "GET", body, signal } = {}) {
  const token = await getSessionToken();
  const headers = {
    Accept: "application/json",
    "x-mst-client": "mobile-app",
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? {
      Authorization: `Bearer ${token}`,
      "x-mst-session": token,
      Cookie: `mst_user_session=${token}`,
    } : {}),
  };

  const response = await fetch(`${MST_API_BASE}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
  const payload = await decodeResponse(response);
  if (!response.ok) throw new MstApiError(errorMessage(payload, `MST API request failed (${response.status})`), response.status, payload);
  return payload;
}

export function normalizeAvatarUrl(url) {
  if (!url || typeof url !== "string") return null;
  const clean = url.trim();
  if (!clean) return null;
  if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("data:")) return clean;
  if (clean.startsWith("/")) return `${MST_SITE_ORIGIN}${clean}`;
  return `${MST_SITE_ORIGIN}/${clean}`;
}

export function extractUser(payload) {
  if (!payload || typeof payload !== "object") return null;
  let raw = null;
  if (payload.user && typeof payload.user === "object") raw = payload.user;
  else if (payload.profile && typeof payload.profile === "object") raw = payload.profile;
  else if (payload.data && typeof payload.data === "object") {
    if (payload.data.user) raw = payload.data.user;
    else if (payload.data.profile) raw = payload.data.profile;
    else raw = payload.data;
  } else if (payload.email || payload.name || payload.displayName || payload.id || payload.userId) {
    raw = payload;
  }
  if (!raw) return null;
  const avatar = normalizeAvatarUrl(
    raw?.avatar ||
      raw?.avatarUrl ||
      raw?.image ||
      raw?.photoURL ||
      raw?.profilePhoto ||
      raw?.picture ||
      raw?.photo ||
      payload?.avatar ||
      payload?.avatarUrl ||
      payload?.image ||
      payload?.photoURL
  );
  return {
    ...raw,
    id: raw.id || raw.userId || raw._id,
    name: raw.name || raw.displayName || raw.username || (raw.email ? raw.email.split("@")[0] : "MST User"),
    displayName: raw.displayName || raw.name || raw.username || (raw.email ? raw.email.split("@")[0] : "MST User"),
    email: raw.email || "",
    avatar,
    avatarUrl: avatar,
    points: raw.points ?? raw.predictionPoints ?? raw.score ?? 0,
    role: raw.role || "user",
  };
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
    const result = { authenticated: isAuthenticatedPayload(payload), user: extractUser(payload), payload };
    if (result.authenticated) {
      if (result.user?.preferredLanguage !== "my" && result.user?.preferredLanguage !== "en") {
        const profilePayload = await api("/account/profile").catch(() => null);
        result.user = extractUser(profilePayload) || result.user;
      }
      if (result.user?.preferredLanguage === "my" || result.user?.preferredLanguage === "en") {
        persistAppLanguage(result.user.preferredLanguage).catch(() => {});
      }
      syncStoredOnboardingFavorites(setFavorite).catch(() => false);
    }
    return result;
  } catch (error) {
    if (error instanceof MstApiError && error.status === 401) {
      await setSessionToken(null).catch(() => {});
      return { authenticated: false, user: null, payload: error.payload };
    }
    throw error;
  }
}

export async function startEmailLogin(email) {
  return api("/auth/email/start", { method: "POST", body: { email: String(email || "").trim().toLowerCase() } });
}

export async function verifyEmailLogin(email, code) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedCode = String(code || "").trim();
  const payload = await api("/auth/email/verify", { method: "POST", body: { email: normalizedEmail, code: normalizedCode } });
  if (payload?.token) {
    await setSessionToken(payload.token);
  }
  const status = await getAuthStatus().catch(() => null);
  return { payload, status };
}

export async function logout() {
  const pushToken = await getStoredDevicePushToken().catch(() => null);
  if (pushToken) {
    try {
      await api("/account/push-token", { method: "DELETE", body: { token: pushToken } });
      await setStoredDevicePushToken(null);
    } catch {
      // The session logout remains authoritative; failed push tokens are also
      // retired by the backend when the delivery provider rejects them.
    }
  }

  let result;
  try {
    result = await api("/auth/logout", { method: "POST", body: {} });
  } catch (error) {
    if (error instanceof MstApiError && error.status === 405) result = await api("/auth/logout");
    else throw error;
  } finally {
    await setSessionToken(null);
  }
  return result;
}

export const getProfile = (options) => api("/account/profile", options);
export const updateProfile = ({ displayName, preferredLanguage } = {}, options = {}) =>
  api("/account/profile", {
    ...options,
    method: "PATCH",
    body: {
      displayName: typeof displayName === "string" ? displayName.trim() : undefined,
      preferredLanguage: preferredLanguage || undefined,
    },
  });
export const getFavorites = (options) => api("/account/favorites", options);
export const getAccountPredictions = (options) => api("/account/predictions", options);
export const getLeaderboard = (timeframe = "all", options) => {
  const tf = typeof timeframe === "string" ? timeframe : "all";
  const opts = typeof timeframe === "object" ? timeframe : options;
  return api(`/predictions/leaderboard?timeframe=${encodeURIComponent(tf)}`, opts);
};

export async function uploadAvatar(input) {
  const token = await getSessionToken();
  const headers = {
    Accept: "application/json",
    "x-mst-client": "mobile-app",
    ...(token ? {
      Authorization: `Bearer ${token}`,
      "x-mst-session": token,
      Cookie: `mst_user_session=${token}`,
    } : {}),
  };

  let body;
  if (input?.base64) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      base64: input.base64,
      contentType: input.contentType || input.mimeType || "image/jpeg",
    });
  } else if (input?.uri) {
    const formData = new FormData();
    const uri = input.uri;
    const name = uri.split("/").pop() || "avatar.jpg";
    const match = /\.(\w+)$/.exec(name);
    const type = input.contentType || (match ? `image/${match[1]}` : "image/jpeg");
    formData.append("avatar", { uri, name, type });
    body = formData;
  } else {
    throw new MstApiError("Invalid image selection.");
  }

  const response = await fetch(`${MST_API_BASE}/account/avatar`, {
    method: "POST",
    headers,
    body,
  });
  const payload = await decodeResponse(response);
  if (!response.ok) {
    throw new MstApiError(errorMessage(payload, `Avatar upload failed (${response.status})`), response.status, payload);
  }
  const rawUrl = payload?.data?.avatarUrl || payload?.avatarUrl;
  return {
    ok: true,
    avatarUrl: normalizeAvatarUrl(rawUrl),
    payload,
  };
}

export async function deleteAvatar() {
  const token = await getSessionToken();
  const headers = {
    Accept: "application/json",
    "x-mst-client": "mobile-app",
    ...(token ? {
      Authorization: `Bearer ${token}`,
      "x-mst-session": token,
      Cookie: `mst_user_session=${token}`,
    } : {}),
  };

  const response = await fetch(`${MST_API_BASE}/account/avatar`, {
    method: "DELETE",
    headers,
  });
  const payload = await decodeResponse(response);
  if (!response.ok) {
    throw new MstApiError(errorMessage(payload, `Could not remove avatar (${response.status})`), response.status, payload);
  }
  return {
    ok: true,
    avatarUrl: null,
    payload,
  };
}

async function tryMutation(attempts) {
  let lastError = null;
  for (const attempt of attempts) {
    try { return await api(attempt.path, attempt.options); }
    catch (error) {
      lastError = error;
      if (!(error instanceof MstApiError) || error.status === 401 || error.status >= 500) throw error;
      if (![400, 404, 405, 409, 422].includes(error.status)) throw error;
    }
  }
  throw lastError || new MstApiError("MST API did not accept the request.");
}

function canonicalFavoriteKind(kind) {
  const value = String(kind || "").toLowerCase();
  if (value.startsWith("comp") || value.startsWith("league")) return "competition";
  if (value.startsWith("player")) return "player";
  if (value.startsWith("team")) return "team";
  return null;
}

export async function setFavorite({ kind, id, name, imageUrl, logo, photo, country, competitionId, competitionName, teamId, teamName, active }) {
  const type = canonicalFavoriteKind(kind);
  const entityId = String(id ?? "").trim();
  if (!type || !/^\d{1,12}$/.test(entityId)) throw new MstApiError("Choose a valid favorite.");

  if (!active) {
    return api("/account/favorites", { method: "DELETE", body: { kind: type, id: entityId } });
  }

  const curated = favoriteMetadata(type, entityId);
  const finalName = String(name || curated?.name || "").trim();
  if (!finalName) throw new MstApiError("Favorite name is unavailable.");
  const finalImage = imageUrl || logo || photo || curated?.imageUrl || curated?.logo || curated?.photo || null;

  return api("/account/favorites", {
    method: "POST",
    body: {
      kind: type,
      id: entityId,
      name: finalName,
      imageUrl: finalImage,
      country: country || curated?.country || null,
      competitionId: competitionId || null,
      competitionName: competitionName || null,
      teamId: teamId || null,
      teamName: teamName || null,
    },
  });
}

function scoreNumber(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 20 ? n : null;
}

export async function savePredictionScore({ matchId, homeScore, awayScore }) {
  const id = String(matchId || "").trim();
  const home = scoreNumber(homeScore);
  const away = scoreNumber(awayScore);
  if (!/^\d{1,12}$/.test(id)) throw new MstApiError("Choose a valid match.");
  if (home === null || away === null) throw new MstApiError("Enter a valid predicted score from 0 to 20.");
  return api("/account/predictions", { method: "POST", body: { matchId: id, homeScore: home, awayScore: away } });
}

// Kept only for backwards compatibility with older screens. New prediction UI uses savePredictionScore.
export async function savePrediction({ matchId, pick }) {
  const id = String(matchId);
  const choice = String(pick).toLowerCase();
  return tryMutation([
    { path: "/account/predictions", options: { method: "POST", body: { matchId: id, prediction: choice } } },
    { path: "/account/predictions", options: { method: "POST", body: { fixtureId: id, prediction: choice } } },
  ]);
}

function walkArrays(value, found = [], depth = 0) {
  if (depth > 5 || value == null) return found;
  if (Array.isArray(value)) {
    found.push(value);
    for (const item of value.slice(0, 8)) walkArrays(item, found, depth + 1);
    return found;
  }
  if (typeof value === "object") for (const child of Object.values(value)) walkArrays(child, found, depth + 1);
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
    for (const key of ["competitions", "leagues", "favoriteCompetitions", "favorite_competitions"]) if (Array.isArray(source[key])) result.competitions = source[key];
    for (const key of ["teams", "favoriteTeams", "favorite_teams"]) if (Array.isArray(source[key])) result.teams = source[key];
    for (const key of ["players", "favoritePlayers", "favorite_players"]) if (Array.isArray(source[key])) result.players = source[key];
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

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function storedPredictionMatch(row) {
  const id = firstDefined(row?.matchId, row?.fixtureId, row?.match_id, row?.fixture_id);
  const homeName = firstDefined(row?.homeTeamName, row?.home_team_name);
  const awayName = firstDefined(row?.awayTeamName, row?.away_team_name);
  if (!id || !homeName || !awayName) return null;
  return {
    id,
    competition: firstDefined(row?.competitionName, row?.competition_name, "Football"),
    competitionId: firstDefined(row?.competitionId, row?.competition_id, null),
    kickoff: firstDefined(row?.kickoff, null),
    home: {
      id: firstDefined(row?.homeTeamId, row?.home_team_id, null),
      name: homeName,
      logo: firstDefined(row?.homeTeamLogo, row?.home_team_logo, null),
    },
    away: {
      id: firstDefined(row?.awayTeamId, row?.away_team_id, null),
      name: awayName,
      logo: firstDefined(row?.awayTeamLogo, row?.away_team_logo, null),
    },
  };
}

export function normalizePredictionPayload(payload) {
  const rows = largestArray(payload);
  return rows.map((row, index) => {
    const embeddedMatch = row?.match ?? row?.fixture ?? row?.game ?? null;
    const match = embeddedMatch || storedPredictionMatch(row);
    const predictedHome = firstDefined(row?.homeScore, row?.predictedHomeScore, row?.predicted_home_score, row?.home_score, row?.prediction?.home, row?.prediction?.homeScore);
    const predictedAway = firstDefined(row?.awayScore, row?.predictedAwayScore, row?.predicted_away_score, row?.away_score, row?.prediction?.away, row?.prediction?.awayScore);
    const finalHome = firstDefined(row?.finalHomeScore, row?.resultHomeScore, row?.actualHomeScore, row?.final_home_score, row?.result?.home, match?.homeScore, match?.goals?.home);
    const finalAway = firstDefined(row?.finalAwayScore, row?.resultAwayScore, row?.actualAwayScore, row?.final_away_score, row?.result?.away, match?.awayScore, match?.goals?.away);
    return {
      id: row?.id ?? row?.predictionId ?? `prediction-${index}`,
      matchId: row?.matchId ?? row?.fixtureId ?? row?.match_id ?? row?.fixture_id ?? match?.id,
      homeScore: scoreNumber(predictedHome),
      awayScore: scoreNumber(predictedAway),
      finalHomeScore: scoreNumber(finalHome),
      finalAwayScore: scoreNumber(finalAway),
      points: Number(firstDefined(row?.points, row?.awardedPoints, row?.score, 0)) || 0,
      exact: Boolean(firstDefined(row?.exactHit, row?.exact, row?.isExact, row?.exactScore, row?.exact_score, false)),
      correct: Boolean(firstDefined(row?.outcomeHit, row?.correct, row?.correctOutcome, row?.correct_result, false)),
      status: String(firstDefined(row?.status, row?.resultStatus, row?.state, row?.settledAt ? "settled" : "pending", "")),
      match,
      raw: row,
    };
  });
}

export function normalizeLeaderboard(payload) {
  const rows = largestArray(payload);
  return rows.map((row, index) => ({
    rank: Number(row?.rank ?? row?.position ?? index + 1),
    id: row?.userId ?? row?.id ?? `leader-${index}`,
    name: row?.displayName ?? row?.name ?? row?.username ?? row?.email ?? "MST User",
    points: Number(row?.points ?? row?.totalPoints ?? row?.score ?? 0),
    exact: Number(row?.exactHits ?? row?.exact ?? row?.exactScores ?? row?.exactScoreCount ?? row?.exact_count ?? 0),
    correct: Number(row?.correctOutcomes ?? row?.correct ?? row?.correctPredictions ?? row?.correctResults ?? row?.wins ?? 0),
    played: Number(row?.settledPredictions ?? row?.played ?? row?.predictions ?? row?.predictionCount ?? row?.totalPredictions ?? 0),
    avatar: row?.avatar ?? row?.avatarUrl ?? row?.image ?? null,
    raw: row,
  }));
}

export const PREDICTION_SCORING = { exact: 3, correctOutcome: 1, wrong: 0 };
export const MST_SITE_URL = MST_SITE_ORIGIN;

export async function submitSupportReport({ category, message, deviceInfo, matchId, email }) {
  return api("/account/support/report", {
    method: "POST",
    body: {
      category: category || "other",
      message: String(message || "").trim(),
      deviceInfo: deviceInfo || null,
      matchId: matchId || null,
      email: email || null,
    },
  });
}

export async function deleteAccount() {
  const result = await api("/account/delete", { method: "POST", body: {} });
  await setSessionToken(null);
  await setStoredDevicePushToken(null).catch(() => {});
  return result;
}

export async function clearAppCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const purgeKeys = keys.filter(
      (k) =>
        k.startsWith("@mst_cache_") ||
        k.startsWith("@mst_temp_") ||
        k.startsWith("@mst_scores_") ||
        k.startsWith("@mst_news_"),
    );
    if (purgeKeys.length) await AsyncStorage.multiRemove(purgeKeys);
    return { ok: true, cleared: purgeKeys.length };
  } catch {
    return { ok: false, cleared: 0 };
  }
}
