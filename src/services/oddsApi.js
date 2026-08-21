const API_BASE = "https://myanmarsportstalk.com/api/football";
const TIMEOUT_MS = 8000;

const BOOKMAKER_PRIORITY = [
  { key: "1xbet", label: "1xBet" },
  { key: "bet365", label: "Bet365" },
];

const root = globalThis;
if (!root.__MST_ODDS_CACHE__) root.__MST_ODDS_CACHE__ = new Map();
const cache = root.__MST_ODDS_CACHE__;

function cleanName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function numberValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : String(value);
}

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

function walk(value, visit, depth = 0) {
  if (depth > 8 || value == null) return;
  visit(value);
  if (Array.isArray(value)) {
    value.forEach((child) => walk(child, visit, depth + 1));
  } else if (typeof value === "object") {
    Object.values(value).forEach((child) => walk(child, visit, depth + 1));
  }
}

function collectBookmakers(payload) {
  const found = [];
  walk(payload, (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const name = value.name || value.bookmaker || value.bookmakerName || value.title;
    const bets = value.bets || value.markets || value.odds || value.values;
    if (name && (Array.isArray(bets) || (bets && typeof bets === "object"))) found.push({ name: String(name), bets, raw: value });
  });
  return found;
}

function marketName(market) {
  return String(market?.name || market?.label || market?.market || market?.type || "");
}

function marketValues(market) {
  if (Array.isArray(market?.values)) return market.values;
  if (Array.isArray(market?.outcomes)) return market.outcomes;
  if (Array.isArray(market?.odds)) return market.odds;
  if (Array.isArray(market)) return market;
  return [];
}

function normalizeOutcome(item) {
  return {
    label: String(item?.value || item?.name || item?.label || item?.outcome || ""),
    odd: numberValue(item?.odd ?? item?.odds ?? item?.price ?? item?.valueOdd ?? item?.decimal),
  };
}

function normalizeMarkets(bets) {
  const list = Array.isArray(bets) ? bets : Object.values(bets || {});
  const result = { matchWinner: null, overUnder25: null, btts: null, all: [] };
  for (const market of list) {
    const name = marketName(market);
    const values = marketValues(market).map(normalizeOutcome).filter((x) => x.label && x.odd !== null);
    if (!values.length) continue;
    const normalized = cleanName(name);
    result.all.push({ name, values });

    if (!result.matchWinner && /matchwinner|winner|1x2|fulltimeresult/.test(normalized)) {
      const home = values.find((x) => /^(home|1)$/i.test(x.label));
      const draw = values.find((x) => /^(draw|x)$/i.test(x.label));
      const away = values.find((x) => /^(away|2)$/i.test(x.label));
      if (home || draw || away) result.matchWinner = { home: home?.odd ?? null, draw: draw?.odd ?? null, away: away?.odd ?? null };
    }

    if (!result.overUnder25 && /overunder|totalgoals|goalsoverunder/.test(normalized)) {
      const over = values.find((x) => /over\s*2[.,]?5/i.test(x.label));
      const under = values.find((x) => /under\s*2[.,]?5/i.test(x.label));
      if (over || under) result.overUnder25 = { over: over?.odd ?? null, under: under?.odd ?? null };
    }

    if (!result.btts && /bothteamstoscore|btts/.test(normalized)) {
      const yes = values.find((x) => /^yes$/i.test(x.label));
      const no = values.find((x) => /^no$/i.test(x.label));
      if (yes || no) result.btts = { yes: yes?.odd ?? null, no: no?.odd ?? null };
    }
  }
  return result;
}

function selectPriorityBookmaker(payload) {
  const bookmakers = collectBookmakers(payload);
  for (const priority of BOOKMAKER_PRIORITY) {
    const match = bookmakers.find((item) => cleanName(item.name).includes(priority.key));
    if (!match) continue;
    const markets = normalizeMarkets(match.bets);
    if (markets.matchWinner || markets.overUnder25 || markets.btts || markets.all.length) {
      return { bookmaker: priority.label, sourceName: match.name, ...markets };
    }
  }
  return null;
}

async function requestOdds(matchId) {
  const id = encodeURIComponent(String(matchId));
  const urls = [
    `${API_BASE}/matches/${id}/odds`,
    `${API_BASE}/odds?fixture=${id}`,
    `${API_BASE}/odds?match=${id}`,
  ];
  let lastError = null;
  for (const url of urls) {
    try {
      const payload = await fetchJson(url);
      const selected = selectPriorityBookmaker(payload);
      if (selected) return { ...selected, payload, fetchedAt: Date.now() };
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return null;
}

export async function fetchPreferredOdds(matchId, { force = false } = {}) {
  if (!matchId) return null;
  const key = String(matchId);
  const saved = cache.get(key);
  if (!force && saved && Date.now() - saved.fetchedAt < 5 * 60 * 1000) return saved;
  try {
    const result = await requestOdds(matchId);
    if (result) cache.set(key, result);
    return result;
  } catch (error) {
    if (saved) return saved;
    throw error;
  }
}

export const ODDS_PRIORITY_LABEL = "1xBet priority · Bet365 fallback";
