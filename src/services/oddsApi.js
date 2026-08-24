import { MST_FOOTBALL_API_BASE } from "./mstApiConfig";

const API_BASE = MST_FOOTBALL_API_BASE;
const TIMEOUT_MS = 8000;

const root = globalThis;
if (!root.__MST_ODDS_CACHE__) root.__MST_ODDS_CACHE__ = new Map();
const cache = root.__MST_ODDS_CACHE__;

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Odds API ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function directBackendOdds(payload) {
  const data = payload?.data;
  if (!data || typeof data !== "object" || !data.available) return null;
  return {
    bookmaker: data.bookmaker || "Live Odds",
    sourceName: data.sourceName || data.bookmaker || "MST Odds",
    mode: data.mode || (data.bookmaker === "Live Odds" ? "live" : "prematch"),
    blocked: Boolean(data.blocked),
    stopped: Boolean(data.stopped),
    matchWinner: data.markets?.matchWinner || null,
    overUnder25: data.markets?.overUnder25 || null,
    btts: data.markets?.btts || null,
    all: [],
    updatedAt: data.updatedAt || payload?.meta?.fetchedAt || null,
    backendMeta: payload?.meta || null,
  };
}

async function requestOdds(matchId) {
  const id = encodeURIComponent(String(matchId));
  const payload = await fetchJson(`${API_BASE}/matches/${id}/odds`);
  const selected = directBackendOdds(payload);
  return selected ? { ...selected, payload, fetchedAt: Date.now() } : null;
}

export async function fetchPreferredOdds(matchId, { force = false } = {}) {
  if (!matchId) return null;
  const key = String(matchId);
  const saved = cache.get(key);
  const ttl = saved?.mode === "live" ? 20 * 1000 : 5 * 60 * 1000;
  if (!force && saved && Date.now() - saved.fetchedAt < ttl) return saved;
  try {
    const result = await requestOdds(matchId);
    if (result) cache.set(key, result);
    else cache.delete(key);
    return result;
  } catch (error) {
    if (saved) return saved;
    throw error;
  }
}

export const ODDS_PRIORITY_LABEL = "1xBet priority · Bet365 fallback";
