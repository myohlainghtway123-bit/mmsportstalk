const FOOTBALL_API_BASE = "https://myanmarsportstalk.com/api/football";

const LIVE_CODES = new Set([
  "1H",
  "HT",
  "2H",
  "ET",
  "BT",
  "P",
  "SUSP",
  "INT",
  "LIVE",
]);

const FINISHED_CODES = new Set(["FT", "AET", "PEN"]);

function pick(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function objectName(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return pick(value.name, value.title, value.shortName, value.short_name, "");
}

function objectLogo(value) {
  if (!value || typeof value === "string") return null;
  return pick(value.logo, value.crest, value.image, value.icon, null);
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const directKeys = ["matches", "response", "data", "items", "fixtures", "results"];
  for (const key of directKeys) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const nested = extractArray(value);
      if (nested.length) return nested;
    }
  }

  return [];
}

function normalizeStatus(raw) {
  const fixture = raw?.fixture ?? {};
  const statusObject = fixture?.status ?? (typeof raw?.status === "object" ? raw.status : {});
  const code = String(
    pick(
      statusObject?.short,
      statusObject?.code,
      raw?.statusShort,
      raw?.status_short,
      typeof raw?.status === "string" ? raw.status : null,
      "NS"
    )
  ).toUpperCase();

  const elapsed = numberOrNull(
    pick(statusObject?.elapsed, raw?.elapsed, raw?.minute, raw?.minutes)
  );

  const long = pick(statusObject?.long, raw?.statusLong, raw?.status_long, code);
  const live = LIVE_CODES.has(code) || Boolean(raw?.live === true || raw?.isLive === true);
  const finished = FINISHED_CODES.has(code);

  let display = code;
  if (live && elapsed !== null && code !== "HT") display = `${elapsed}'`;
  else if (code === "NS") {
    const kickoff = pick(fixture?.date, raw?.date, raw?.kickoff, raw?.startTime, raw?.start_time);
    if (kickoff) {
      const parsed = new Date(kickoff);
      if (!Number.isNaN(parsed.getTime())) {
        display = parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
    }
  }

  return { code, elapsed, long, live, finished, display };
}

export function normalizeFootballMatch(raw, index = 0) {
  const fixture = raw?.fixture ?? {};
  const league = raw?.league ?? raw?.competition ?? raw?.tournament ?? {};
  const teams = raw?.teams ?? {};

  const homeRaw = pick(
    teams?.home,
    raw?.homeTeam,
    raw?.home_team,
    raw?.home,
    raw?.teamHome,
    {}
  );
  const awayRaw = pick(
    teams?.away,
    raw?.awayTeam,
    raw?.away_team,
    raw?.away,
    raw?.teamAway,
    {}
  );

  const goals = raw?.goals ?? raw?.score ?? {};
  const fulltime = goals?.fulltime ?? goals?.fullTime ?? raw?.fulltime ?? {};
  const status = normalizeStatus(raw);

  const homeScore = numberOrNull(
    pick(
      goals?.home,
      raw?.homeScore,
      raw?.home_score,
      raw?.scoreHome,
      fulltime?.home,
      raw?.scores?.home
    )
  );
  const awayScore = numberOrNull(
    pick(
      goals?.away,
      raw?.awayScore,
      raw?.away_score,
      raw?.scoreAway,
      fulltime?.away,
      raw?.scores?.away
    )
  );

  const homeName = objectName(homeRaw) || pick(raw?.homeName, raw?.home_name, "Home");
  const awayName = objectName(awayRaw) || pick(raw?.awayName, raw?.away_name, "Away");

  return {
    id: String(pick(fixture?.id, raw?.id, raw?.fixtureId, raw?.fixture_id, `mst-${index}`)),
    source: "mst-api",
    competition: objectName(league) || pick(raw?.competitionName, raw?.competition_name, "Football"),
    competitionId: pick(league?.id, raw?.competitionId, raw?.competition_id, null),
    country: pick(league?.country, raw?.country, null),
    round: pick(league?.round, raw?.round, raw?.stage, null),
    status: status.live ? "LIVE" : status.code,
    statusCode: status.code,
    statusLong: status.long,
    isLive: status.live,
    isFinished: status.finished,
    minute: status.display,
    kickoff: pick(fixture?.date, raw?.date, raw?.kickoff, raw?.startTime, raw?.start_time, null),
    timestamp: pick(fixture?.timestamp, raw?.timestamp, null),
    venue: pick(fixture?.venue?.name, raw?.venue?.name, raw?.venue, null),
    home: {
      id: pick(homeRaw?.id, raw?.homeTeamId, raw?.home_team_id, null),
      name: homeName,
      short: pick(homeRaw?.code, homeRaw?.short, raw?.homeCode, null),
      logo: objectLogo(homeRaw),
    },
    away: {
      id: pick(awayRaw?.id, raw?.awayTeamId, raw?.away_team_id, null),
      name: awayName,
      short: pick(awayRaw?.code, awayRaw?.short, raw?.awayCode, null),
      logo: objectLogo(awayRaw),
    },
    homeScore,
    awayScore,
    aggregate: pick(raw?.aggregate, raw?.score?.aggregate, null),
    raw,
  };
}

export function isLiveMatch(match) {
  return Boolean(match?.isLive || LIVE_CODES.has(String(match?.statusCode ?? match?.status ?? "").toUpperCase()));
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function offsetDateString(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

export async function fetchFootballMatches({ date = localDateString(), signal } = {}) {
  const url = `${FOOTBALL_API_BASE}/matches?date=${encodeURIComponent(date)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`MST football API ${response.status}${body ? `: ${body.slice(0, 120)}` : ""}`);
  }

  const payload = await response.json();
  const matches = extractArray(payload)
    .map(normalizeFootballMatch)
    .filter((match) => match.home?.name && match.away?.name);

  return { matches, payload };
}

export const MST_FOOTBALL_API_BASE = FOOTBALL_API_BASE;
