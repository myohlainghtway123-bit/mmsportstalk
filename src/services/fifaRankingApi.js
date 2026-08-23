const FIFA_RANKING_URL = "https://myanmarsportstalk.com/api/football/rankings/fifa";
const CACHE_MS = 6 * 60 * 60 * 1000;
const root = globalThis;

if (!root.__MST_FIFA_RANKING_CACHE__) root.__MST_FIFA_RANKING_CACHE__ = null;

function validRanking(value) {
  return Boolean(
    value &&
    value.source === "FIFA" &&
    value.official === true &&
    Array.isArray(value.entries) &&
    value.entries.length >= 100
  );
}

export async function fetchFifaMenRanking({ signal, force = false } = {}) {
  const saved = root.__MST_FIFA_RANKING_CACHE__;
  if (!force && saved && Date.now() - saved.fetchedAt < CACHE_MS) return saved.data;

  const url = force ? `${FIFA_RANKING_URL}?force=1` : FIFA_RANKING_URL;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `FIFA ranking API ${response.status}`);
    const data = payload?.data;
    if (!validRanking(data)) throw new Error("Official FIFA ranking response is incomplete.");
    root.__MST_FIFA_RANKING_CACHE__ = { data, fetchedAt: Date.now() };
    return data;
  } catch (error) {
    if (saved?.data && validRanking(saved.data)) return { ...saved.data, stale: true };
    throw error;
  }
}

export function peekFifaMenRanking() {
  return root.__MST_FIFA_RANKING_CACHE__?.data ?? null;
}
