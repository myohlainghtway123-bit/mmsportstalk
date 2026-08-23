const SEARCH_URL = "https://myanmarsportstalk.com/api/football/search";
const CACHE_MS = 6 * 60 * 60 * 1000;
const root = globalThis;

if (!root.__MST_SMART_SEARCH_CACHE__) root.__MST_SMART_SEARCH_CACHE__ = new Map();

function cleanQuery(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 48);
}

function normalizeTeam(item) {
  const team = item?.team || item;
  if (!team?.id || !team?.name) return null;
  return {
    id:team.id,
    name:team.name,
    logo:team.logo || null,
    country:item?.country || null,
    national:item?.national === true,
    founded:item?.founded ?? null,
    venue:item?.venue || null,
  };
}

function normalizePlayer(player) {
  if (!player?.id || !player?.name) return null;
  return {
    id:player.id,
    name:player.name,
    photo:player.photo || null,
    nationality:player.nationality || null,
    age:player.age ?? null,
    firstName:player.firstName || null,
    lastName:player.lastName || null,
    injured:typeof player.injured === "boolean" ? player.injured : null,
  };
}

export async function searchFootballEntities(query, { signal } = {}) {
  const cleaned = cleanQuery(query);
  if (cleaned.length < 4) return { teams:[], players:[], stale:false };
  const key = cleaned.toLowerCase();
  const cache = root.__MST_SMART_SEARCH_CACHE__;
  const saved = cache.get(key);
  if (saved && Date.now() - saved.fetchedAt < CACHE_MS) return saved.data;

  try {
    const response = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(cleaned)}`, {
      method:"GET",
      headers:{ Accept:"application/json" },
      signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `Search API ${response.status}`);
    const teams = Array.isArray(payload?.data?.teams) ? payload.data.teams.map(normalizeTeam).filter(Boolean) : [];
    const players = Array.isArray(payload?.data?.players) ? payload.data.players.map(normalizePlayer).filter(Boolean) : [];
    const data = { teams, players, stale:payload?.meta?.stale === true };
    cache.set(key, { data, fetchedAt:Date.now() });
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    if (saved?.data) return { ...saved.data, stale:true };
    throw error;
  }
}
