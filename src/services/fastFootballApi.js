import { extractArray, normalizeFootballMatch } from "./footballApi";

export const FOOTBALL_API_BASE = "https://myanmarsportstalk.com/api/football";
const APP_TIME_ZONE = "Asia/Bangkok";
const DEFAULT_TIMEOUT_MS = 15000;

const root = globalThis;
if (!root.__MST_MATCH_CACHE__) root.__MST_MATCH_CACHE__ = new Map();
if (!root.__MST_MATCH_INFLIGHT__) root.__MST_MATCH_INFLIGHT__ = new Map();
const cache = root.__MST_MATCH_CACHE__;
const inflight = root.__MST_MATCH_INFLIGHT__;

function dateKeyInBangkok(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  } catch (_) {
    return date.toISOString().slice(0, 10);
  }
}

function todayBangkok() {
  return dateKeyInBangkok(new Date());
}

function ttlFor(date) {
  return date === todayBangkok() ? 20000 : 5 * 60 * 1000;
}

function sortMatches(matches) {
  return [...matches].sort((a, b) => {
    if (Boolean(a.isLive) !== Boolean(b.isLive)) return a.isLive ? -1 : 1;
    const at = a.kickoff ? new Date(a.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.kickoff ? new Date(b.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
    return (Number.isFinite(at) ? at : Number.MAX_SAFE_INTEGER) - (Number.isFinite(bt) ? bt : Number.MAX_SAFE_INTEGER);
  });
}

function directDateKey(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

async function fetchJson(url, { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  let timer = null;
  let abortListener = null;

  if (signal) {
    if (signal.aborted) controller.abort();
    else {
      abortListener = () => controller.abort();
      signal.addEventListener?.("abort", abortListener, { once: true });
    }
  }
  timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`MST football API ${response.status}${text ? `: ${text.slice(0, 160)}` : ""}`);
    try { return text ? JSON.parse(text) : {}; }
    catch (_) { throw new Error("MST football API returned invalid JSON."); }
  } finally {
    if (timer) clearTimeout(timer);
    if (abortListener) signal?.removeEventListener?.("abort", abortListener);
  }
}

function chooseRequestedDateMatches(normalized, date) {
  const bangkok = normalized.filter((match) => dateKeyInBangkok(match.kickoff) === date);
  if (bangkok.length) return bangkok;

  // Some cached/provider payloads expose a date-only value without enough timezone
  // information for Intl to recover the requested Bangkok day. Use the raw date as
  // a safe second pass before declaring the screen empty.
  const direct = normalized.filter((match) => directDateKey(match.kickoff) === date);
  if (direct.length) return direct;

  // If the endpoint itself returned only one calendar date, preserve those rows.
  // This avoids a false "0 matches" screen while still rejecting broad multi-day caches.
  const distinct = [...new Set(normalized.map((m) => dateKeyInBangkok(m.kickoff) || directDateKey(m.kickoff)).filter(Boolean))];
  if (normalized.length && distinct.length <= 1) return normalized;

  return [];
}

async function requestDate(date, { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const encodedDate = encodeURIComponent(date);
  const encodedTz = encodeURIComponent(APP_TIME_ZONE);
  const urls = [
    `${FOOTBALL_API_BASE}/matches?date=${encodedDate}&timezone=${encodedTz}`,
    `${FOOTBALL_API_BASE}/matches?date=${encodedDate}`,
  ];

  let payload = null;
  let lastError = null;
  for (const url of urls) {
    try {
      payload = await fetchJson(url, { signal, timeoutMs });
      break;
    } catch (error) {
      lastError = error;
      const message = String(error?.message || "");
      // Retry only when the server rejected the query shape. Network/5xx errors
      // should surface rather than creating duplicate provider traffic.
      if (!/MST football API (400|404|405|422)/.test(message)) throw error;
    }
  }
  if (!payload) throw lastError || new Error("MST football API is unavailable.");

  const normalized = extractArray(payload)
    .map((item, index) => normalizeFootballMatch(item, index))
    .filter((match) => match.home?.name && match.away?.name);
  const matches = sortMatches(chooseRequestedDateMatches(normalized, date));

  const result = {
    matches,
    payload,
    rawCount: normalized.length,
    filteredCount: matches.length,
    requestedDate: date,
    cached: false,
    stale: false,
    fetchedAt: Date.now(),
    apiBase: FOOTBALL_API_BASE,
  };
  cache.set(date, result);
  return result;
}

function startRequest(date, options = {}) {
  if (inflight.has(date)) return inflight.get(date);
  const promise = requestDate(date, options).finally(() => {
    if (inflight.get(date) === promise) inflight.delete(date);
  });
  inflight.set(date, promise);
  return promise;
}

export async function fetchFastFootballMatches({ date = todayBangkok(), signal, force = false, timeoutMs } = {}) {
  const saved = cache.get(date);
  const age = saved ? Date.now() - saved.fetchedAt : Number.POSITIVE_INFINITY;

  if (!force && saved && age < ttlFor(date)) return { ...saved, cached: true, stale: false };
  if (!force && saved) {
    startRequest(date, { signal, timeoutMs }).catch(() => {});
    return { ...saved, cached: true, stale: true };
  }

  try {
    return await startRequest(date, { signal, timeoutMs });
  } catch (error) {
    if (saved) return { ...saved, cached: true, stale: true };
    if (error?.name === "AbortError") throw new Error("Football data is taking too long. Pull to refresh in a moment.");
    throw error;
  }
}

export function prefetchFastFootballMatches(dates = []) {
  [...new Set(dates.filter(Boolean))].forEach((date) => {
    const saved = cache.get(date);
    if (saved && Date.now() - saved.fetchedAt < ttlFor(date)) return;
    startRequest(date, { timeoutMs: 10000 }).catch(() => {});
  });
}

export function peekFastFootballMatches(date) {
  const saved = cache.get(date);
  return saved ? { ...saved, cached: true } : null;
}

export function clearFastFootballDate(date) {
  cache.delete(date);
}

export async function verifyFootballApiConnection({ date = todayBangkok(), signal } = {}) {
  const result = await requestDate(date, { signal, timeoutMs: 12000 });
  return {
    ok: true,
    apiBase: FOOTBALL_API_BASE,
    date,
    rawCount: result.rawCount,
    matchCount: result.matches.length,
  };
}
