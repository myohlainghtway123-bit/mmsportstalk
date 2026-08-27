import { MST_FOOTBALL_API_BASE } from "./mstApiConfig";

const SEARCH_URL = `${MST_FOOTBALL_API_BASE}/search`;
const CACHE_MS = 6 * 60 * 60 * 1000;
const CACHE_LIMIT = 60;
const root = globalThis;

if (!root.__MST_SMART_SEARCH_CACHE__) root.__MST_SMART_SEARCH_CACHE__ = new Map();

function cleanQuery(value) {
  return String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 48);
}

function boundedSet(cache, key, value) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
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
  if (Array.from(cleaned).length < 3) return { teams:[], players:[], stale:false };
  const key = cleaned.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const cache = root.__MST_SMART_SEARCH_CACHE__;
  const saved = cache.get(key);
  if (saved && Date.now() - saved.fetchedAt < CACHE_MS) return saved.data;

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener?.("abort", abort, { once:true });
  const timeout = setTimeout(abort, 12000);
  try {
    const response = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(cleaned)}`, {
      method:"GET",
      headers:{ Accept:"application/json" },
      signal:controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `Search API ${response.status}`);
    const teams = Array.isArray(payload?.data?.teams) ? payload.data.teams.map(normalizeTeam).filter(Boolean) : [];
    const players = Array.isArray(payload?.data?.players) ? payload.data.players.map(normalizePlayer).filter(Boolean) : [];
    const data = {
      teams,
      players,
      stale:payload?.meta?.stale === true,
      warning:payload?.meta?.partial === true
        ? payload?.meta?.message || "Some search results are temporarily unavailable."
        : null,
    };
    boundedSet(cache, key, { data, fetchedAt:Date.now() });
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    if (saved?.data) return { ...saved.data, stale:true };
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener?.("abort", abort);
  }
}
