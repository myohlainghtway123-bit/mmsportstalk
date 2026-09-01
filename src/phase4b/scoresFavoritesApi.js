import { favoriteMetadata } from "../services/favoriteCatalog";
import { MST_API_BASE } from "../services/mstApiConfig";
import { loadOnboardingPreferences, saveOnboardingPreferences } from "../services/onboardingStore";
import { getSessionToken, setSessionToken } from "../services/sessionStore";

class ScoresAccountError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = "ScoresAccountError";
    this.status = status;
    this.payload = payload;
  }
}

async function decode(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { message: text }; }
}

function errorMessage(payload, fallback) {
  return payload?.error?.message || (typeof payload?.error === "string" ? payload.error : null) || payload?.message || fallback;
}

async function request(path, { method = "GET", body, signal } = {}) {
  const token = await getSessionToken();
  const headers = {
    Accept: "application/json",
    "x-mst-client": "mst-scores",
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
  const payload = await decode(response);
  if (!response.ok) {
    if (response.status === 401) await setSessionToken(null).catch(() => {});
    throw new ScoresAccountError(errorMessage(payload, `MST account request failed (${response.status})`), response.status, payload);
  }
  return payload;
}

function extractUser(payload) {
  const raw = payload?.user || payload?.profile || payload?.data?.user || payload?.data?.profile || payload?.data || null;
  if (!raw || typeof raw !== "object") return null;
  if (!(raw.id || raw.userId || raw.email || raw.name || raw.displayName)) return null;
  return raw;
}

export async function getAuthStatus(options) {
  try {
    const payload = await request("/auth/status", options);
    const explicit = payload?.authenticated ?? payload?.signedIn ?? payload?.loggedIn;
    return {
      authenticated: typeof explicit === "boolean" ? explicit : Boolean(extractUser(payload)),
      user: extractUser(payload),
      payload,
    };
  } catch (error) {
    if (error instanceof ScoresAccountError && error.status === 401) return { authenticated: false, user: null, payload: error.payload };
    throw error;
  }
}

export const getFavorites = (options) => request("/account/favorites", options);

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
  if (!type || !/^\d{1,12}$/.test(entityId)) throw new ScoresAccountError("Choose a valid favorite.");

  if (!active) return request("/account/favorites", { method: "DELETE", body: { kind: type, id: entityId } });

  const curated = favoriteMetadata(type, entityId);
  const finalName = String(name || curated?.name || "").trim();
  if (!finalName) throw new ScoresAccountError("Favorite name is unavailable.");
  const finalImage = imageUrl || logo || photo || curated?.imageUrl || curated?.logo || curated?.photo || null;
  return request("/account/favorites", {
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

function walkArrays(value, found = [], depth = 0) {
  if (depth > 5 || value == null) return found;
  if (Array.isArray(value)) {
    found.push(value);
    for (const item of value.slice(0, 8)) walkArrays(item, found, depth + 1);
  } else if (typeof value === "object") {
    for (const child of Object.values(value)) walkArrays(child, found, depth + 1);
  }
  return found;
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
    const rows = walkArrays(payload).sort((a, b) => b.length - a.length)[0] || [];
    for (const row of rows) {
      const type = String(row?.type || row?.kind || row?.entityType || "").toLowerCase();
      if (type.includes("team")) result.teams.push(row);
      else if (type.includes("player")) result.players.push(row);
      else if (type.includes("league") || type.includes("competition")) result.competitions.push(row);
    }
  }
  return result;
}

function keyForKind(kind) {
  return kind === "competition" ? "competitions" : kind === "player" ? "players" : "teams";
}

export async function readEntityFavorite(type, id) {
  const kind = canonicalFavoriteKind(type);
  const entityId = String(id ?? "");
  if (!kind || !entityId) return { authenticated: false, favorite: false, kind };
  const status = await getAuthStatus().catch(() => ({ authenticated: false }));
  if (status.authenticated) {
    const normalized = normalizeFavoritePayload(await getFavorites().catch(() => null));
    const rows = normalized[keyForKind(kind)] || [];
    return {
      authenticated: true,
      kind,
      favorite: rows.some((item) => String(item?.id ?? item?.entityId ?? item?.[kind]?.id ?? "") === entityId),
    };
  }
  if (kind === "player") return { authenticated: false, favorite: false, kind };
  const prefs = await loadOnboardingPreferences();
  const field = keyForKind(kind);
  return { authenticated: false, kind, favorite: (prefs[field] || []).map(String).includes(entityId) };
}

export async function toggleEntityFavorite({ type, entity, active, name, imageUrl, country, teamId, teamName, competitionId, competitionName }) {
  const kind = canonicalFavoriteKind(type);
  const id = String(entity?.id ?? "");
  if (!kind || !id) throw new ScoresAccountError("Favorite data is unavailable.");
  const status = await getAuthStatus().catch(() => ({ authenticated: false }));
  if (status.authenticated) {
    await setFavorite({
      kind,
      id,
      name: name || entity?.name || entity?.title,
      imageUrl: imageUrl || entity?.logo || entity?.photo || entity?.image,
      country: country || entity?.country,
      teamId: teamId || null,
      teamName: teamName || null,
      competitionId: competitionId || null,
      competitionName: competitionName || null,
      active,
    });
    return { authenticated: true, favorite: active, requiresAuth: false };
  }

  if (kind === "player" || !favoriteMetadata(kind, id)) {
    return { authenticated: false, favorite: false, requiresAuth: true };
  }
  const prefs = await loadOnboardingPreferences();
  const field = keyForKind(kind);
  const current = (prefs[field] || []).map(String);
  const next = active ? [...new Set([...current, id])] : current.filter((value) => value !== id);
  await saveOnboardingPreferences({ [field]: next, favoritesSynced: false });
  return { authenticated: false, favorite: active, requiresAuth: false };
}
