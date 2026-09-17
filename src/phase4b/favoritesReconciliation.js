/**
 * MST Scores — Favorites Reconciliation & Synchronization Engine
 *
 * Implements the required P0 behavior:
 * SERVER STATE UNION GUEST LOCAL STATE = FINAL AUTHENTICATED STATE
 *
 * Guarantees:
 * 1. Reads guest state before authenticated replacement.
 * 2. Reads server state and normalizes canonical entity IDs.
 * 3. Deduplicates entities by canonical MST key (e.g. "team:33" vs "mst:team:33").
 * 4. Pushes only missing guest entities to server.
 * 5. Re-fetches server truth after pushing.
 * 6. Preserves local pending state on network/server failure so guest data is NEVER lost.
 * 7. Supports numeric API-Football IDs and canonical mst:* IDs safely.
 */

/**
 * Standardizes favorite kind.
 */
export function canonicalFavoriteKind(kind) {
  const value = String(kind || "").toLowerCase().trim();
  if (value.startsWith("comp") || value.startsWith("league")) return "competition";
  if (value.startsWith("player")) return "player";
  if (value.startsWith("team")) return "team";
  if (value.startsWith("match")) return "match";
  return null;
}

/**
 * Normalizes payload from server favorites API into standard structure.
 */
export function normalizeFavoritePayload(payload) {
  const result = { competitions: [], teams: [], players: [], matches: [], raw: payload };
  if (!payload || typeof payload !== "object") return result;

  // Handle direct array payloads (e.g. [{ kind: "team", id: "541" }])
  const directList = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : null;
  if (directList) {
    for (const item of directList) {
      if (!item || typeof item !== "object") continue;
      const k = canonicalFavoriteKind(item.kind || item.type || item.entityType);
      if (k === "team") result.teams.push(item);
      else if (k === "competition") result.competitions.push(item);
      else if (k === "player") result.players.push(item);
      else if (k === "match") result.matches.push(item);
    }
  }

  const candidates = [payload, payload.data, payload.favorites].filter(Boolean);
  for (const source of candidates) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    for (const key of ["competitions", "leagues", "favoriteCompetitions", "favorite_competitions"]) {
      if (Array.isArray(source[key])) result.competitions = source[key];
    }
    for (const key of ["teams", "favoriteTeams", "favorite_teams"]) {
      if (Array.isArray(source[key])) result.teams = source[key];
    }
    for (const key of ["players", "favoritePlayers", "favorite_players"]) {
      if (Array.isArray(source[key])) result.players = source[key];
    }
    for (const key of ["matches", "favoriteMatches", "favorite_matches"]) {
      if (Array.isArray(source[key])) result.matches = source[key];
    }
  }
  return result;
}

/**
 * Standardizes an entity ID into a unique canonical deduplication key.
 * Examples:
 * - ("team", 33) => "team:33"
 * - ("team", "33") => "team:33"
 * - ("team", "mst:team:33") => "team:33"
 * - ("competition", "mst:comp:39") => "competition:39"
 * - ("match", "mst:match:12345") => "match:12345"
 * - ("match", 12345) => "match:12345"
 */
export function canonicalEntityKey(kind, id) {
  const cleanKind = canonicalFavoriteKind(kind) || String(kind || "").toLowerCase().trim();
  const rawId = String(id ?? "").trim();
  if (!rawId) return "";

  // Strip known MST namespace prefixes for deduplication matching
  const stripped = rawId
    .replace(/^mst:(team|comp|competition|player|match):/i, "")
    .replace(/^(team|comp|competition|player|match):/i, "");

  return `${cleanKind}:${stripped.toLowerCase()}`;
}

/**
 * Extracts a clean entity ID suitable for API transmission.
 */
export function cleanEntityId(id) {
  return String(id ?? "").trim();
}

/**
 * Reconciles local guest favorites with authenticated server favorites.
 *
 * @param {Object} options
 * @param {Function} [options.getFavoritesFn] - Override for testing or direct provider
 * @param {Function} [options.setFavoriteFn] - Override for testing or direct provider
 * @param {Function} [options.loadGuestPrefsFn] - Override for testing or direct provider
 * @param {Function} [options.saveGuestPrefsFn] - Override for testing or direct provider
 * @returns {Promise<{
 *   success: boolean,
 *   mergedCount: number,
 *   pendingCount: number,
 *   finalState: { teams: Array, competitions: Array, players: Array, matches: Array },
 *   error?: string
 * }>}
 */
export async function reconcileGuestFavorites(options = {}) {
  let getFavs = options.getFavoritesFn;
  let setFav = options.setFavoriteFn;
  let loadPrefs = options.loadGuestPrefsFn;
  let savePrefs = options.saveGuestPrefsFn;

  // Lazy-load defaults if not provided in options
  if (!getFavs || !setFav) {
    const api = await import("./scoresFavoritesApi.js");
    getFavs = getFavs || api.getFavorites;
    setFav = setFav || api.setFavorite;
  }
  if (!loadPrefs || !savePrefs) {
    const store = await import("../services/onboardingStore.js");
    loadPrefs = loadPrefs || store.loadOnboardingPreferences;
    savePrefs = savePrefs || store.saveOnboardingPreferences;
  }

  // 1. Read current guest preferences and local entity catalog
  const prefs = await loadPrefs();
  const guestEntities = prefs.entities || {};
  const pendingQueue = Array.isArray(prefs.pendingSyncEntities) ? [...prefs.pendingSyncEntities] : [];

  // Build list of candidate guest items
  const guestCandidates = [];

  const addGuestCandidate = (kind, id) => {
    const cleanId = cleanEntityId(id);
    if (!cleanId) return;
    const key = `${kind}:${cleanId}`;
    const meta = guestEntities[key] || guestEntities[`${kind}:${cleanId.toLowerCase()}`] || {};
    guestCandidates.push({
      kind,
      id: cleanId,
      name: meta.name || cleanId,
      imageUrl: meta.logo || meta.photo || meta.imageUrl || null,
      country: meta.country || null,
      canonicalKey: canonicalEntityKey(kind, cleanId),
    });
  };

  (prefs.teams || []).forEach((id) => addGuestCandidate("team", id));
  (prefs.competitions || []).forEach((id) => addGuestCandidate("competition", id));
  (prefs.players || []).forEach((id) => addGuestCandidate("player", id));
  (prefs.matches || []).forEach((id) => addGuestCandidate("match", id));

  // Include any previously failed pending items
  pendingQueue.forEach((item) => {
    if (item && item.kind && item.id) {
      guestCandidates.push({
        ...item,
        canonicalKey: canonicalEntityKey(item.kind, item.id),
      });
    }
  });

  // Deduplicate guest candidates by canonical key
  const uniqueGuestMap = new Map();
  for (const candidate of guestCandidates) {
    if (candidate.canonicalKey && !uniqueGuestMap.has(candidate.canonicalKey)) {
      uniqueGuestMap.set(candidate.canonicalKey, candidate);
    }
  }

  // 2. Fetch server state
  let serverPayload = null;
  try {
    serverPayload = await getFavs();
  } catch (error) {
    // If server fetch fails (e.g. offline right after OTP):
    // DO NOT DROP GUEST DATA. Keep pending queue intact and return local union state.
    const fallbackFinal = buildUnionState({
      serverTeams: [],
      serverCompetitions: [],
      serverPlayers: [],
      serverMatches: [],
      guestItems: Array.from(uniqueGuestMap.values()),
    });
    return {
      success: false,
      reason: "server_unavailable",
      error: error?.message || "Could not fetch server favorites",
      mergedCount: 0,
      pendingCount: uniqueGuestMap.size,
      finalState: fallbackFinal,
    };
  }

  const serverNormalized = normalizeFavoritePayload(serverPayload);
  const serverKeys = new Set();

  const registerServerKeys = (list, kind) => {
    (list || []).forEach((item) => {
      const id = item?.id ?? item?.entityId ?? item?.[kind]?.id;
      if (id) {
        serverKeys.add(canonicalEntityKey(kind, id));
      }
    });
  };

  registerServerKeys(serverNormalized.teams, "team");
  registerServerKeys(serverNormalized.competitions, "competition");
  registerServerKeys(serverNormalized.players, "player");
  registerServerKeys(serverNormalized.matches || [], "match");

  // 3. Find guest items missing from server (Diff)
  const itemsToPush = [];
  for (const [key, item] of uniqueGuestMap.entries()) {
    if (!serverKeys.has(key)) {
      itemsToPush.push(item);
    }
  }

  // 4. Push missing guest entities to server
  const pushFailures = [];
  let pushedSuccessCount = 0;

  for (const item of itemsToPush) {
    // Matches are retained in local authenticated preferences
    if (item.kind === "match") {
      continue;
    }

    try {
      await setFav({
        kind: item.kind,
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        country: item.country,
        active: true,
      });
      pushedSuccessCount++;
      serverKeys.add(item.canonicalKey);
    } catch (pushErr) {
      pushFailures.push(item);
    }
  }

  // 5. Re-fetch server truth if we successfully pushed any item
  let finalServerNormalized = serverNormalized;
  if (pushedSuccessCount > 0) {
    try {
      const refreshed = await getFavs();
      finalServerNormalized = normalizeFavoritePayload(refreshed);
    } catch (_) {
      // If refresh fails, serverNormalized augmented with pushed keys is still reliable
    }
  }

  // 6. Construct unified final state: SERVER STATE UNION GUEST STATE
  const finalState = buildUnionState({
    serverTeams: finalServerNormalized.teams,
    serverCompetitions: finalServerNormalized.competitions,
    serverPlayers: finalServerNormalized.players,
    serverMatches: finalServerNormalized.matches || [],
    guestItems: Array.from(uniqueGuestMap.values()),
  });

  // 7. Update local onboarding store safely:
  // - If any pushes failed, retain them in pendingSyncEntities so they will be retried.
  // - If all succeeded, clear pendingSyncEntities and mark favoritesSynced = true.
  await savePrefs({
    pendingSyncEntities: pushFailures,
    favoritesSynced: pushFailures.length === 0,
    teams: finalState.teams.map((x) => String(x.id)),
    competitions: finalState.competitions.map((x) => String(x.id)),
    players: finalState.players.map((x) => String(x.id)),
    matches: finalState.matches.map((x) => String(x.id)),
  });

  return {
    success: pushFailures.length === 0,
    mergedCount: pushedSuccessCount,
    pendingCount: pushFailures.length,
    finalState,
    error: pushFailures.length > 0 ? `${pushFailures.length} favorites queued for retry` : null,
  };
}

/**
 * Builds a clean deduplicated union of server and guest entities.
 */
function buildUnionState({ serverTeams, serverCompetitions, serverPlayers, serverMatches, guestItems }) {
  const teamsMap = new Map();
  const compsMap = new Map();
  const playersMap = new Map();
  const matchesMap = new Map();

  const addEntity = (map, kind, entity) => {
    const id = entity?.id ?? entity?.entityId ?? entity?.[kind]?.id;
    if (!id) return;
    const key = canonicalEntityKey(kind, id);
    if (!map.has(key)) {
      map.set(key, {
        id: String(id),
        name: String(entity?.name || entity?.title || id),
        logo: entity?.logo || entity?.photo || entity?.imageUrl || null,
        country: entity?.country || null,
        kind,
      });
    }
  };

  // 1. Add server entities
  (serverTeams || []).forEach((e) => addEntity(teamsMap, "team", e));
  (serverCompetitions || []).forEach((e) => addEntity(compsMap, "competition", e));
  (serverPlayers || []).forEach((e) => addEntity(playersMap, "player", e));
  (serverMatches || []).forEach((e) => addEntity(matchesMap, "match", e));

  // 2. Union with guest entities (ensuring nothing is lost)
  for (const item of guestItems || []) {
    if (item.kind === "team") addEntity(teamsMap, "team", item);
    else if (item.kind === "competition") addEntity(compsMap, "competition", item);
    else if (item.kind === "player") addEntity(playersMap, "player", item);
    else if (item.kind === "match") addEntity(matchesMap, "match", item);
  }

  return {
    teams: Array.from(teamsMap.values()),
    competitions: Array.from(compsMap.values()),
    players: Array.from(playersMap.values()),
    matches: Array.from(matchesMap.values()),
  };
}
