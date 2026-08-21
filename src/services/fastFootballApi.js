import { extractArray, normalizeFootballMatch } from "./footballApi";

const FOOTBALL_API_BASE = "https://myanmarsportstalk.com/api/football";
const APP_TIME_ZONE = "Asia/Bangkok";
const DEFAULT_TIMEOUT_MS = 10000;

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

async function requestDate(date, { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
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
    const response = await fetch(
      `${FOOTBALL_API_BASE}/matches?date=${encodeURIComponent(date)}&timezone=${encodeURIComponent(APP_TIME_ZONE)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`MST football API ${response.status}${text ? `: ${text.slice(0, 140)}` : ""}`);
    }

    const payload = await response.json();
    const normalized = extractArray(payload)
      .map((item, index) => normalizeFootballMatch(item, index))
      .filter((match) => match.home?.name && match.away?.name);
    const matches = sortMatches(normalized.filter((match) => dateKeyInBangkok(match.kickoff) === date));

    const result = {
      matches,
      payload,
      rawCount: normalized.length,
      filteredCount: matches.length,
      requestedDate: date,
      cached: false,
      stale: false,
      fetchedAt: Date.now(),
    };
    cache.set(date, result);
    return result;
  } catch (error) {
    const saved = cache.get(date);
    if (saved) return { ...saved, cached: true, stale: true };
    if (error?.name === "AbortError") throw new Error("Football data is taking too long. Pull to refresh in a moment.");
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    if (abortListener) signal?.removeEventListener?.("abort", abortListener);
  }
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

  if (!force && saved && age < ttlFor(date)) {
    return { ...saved, cached: true, stale: false };
  }

  if (!force && saved) {
    startRequest(date, { signal, timeoutMs }).catch(() => {});
    return { ...saved, cached: true, stale: true };
  }

  return startRequest(date, { signal, timeoutMs });
}

export function prefetchFastFootballMatches(dates = []) {
  const unique = [...new Set(dates.filter(Boolean))];
  unique.forEach((date) => {
    const saved = cache.get(date);
    if (saved && Date.now() - saved.fetchedAt < ttlFor(date)) return;
    startRequest(date, { timeoutMs: 8000 }).catch(() => {});
  });
}

export function peekFastFootballMatches(date) {
  const saved = cache.get(date);
  return saved ? { ...saved, cached: true } : null;
}

export function clearFastFootballDate(date) {
  cache.delete(date);
}
