import { MST_FOOTBALL_API_BASE as FOOTBALL_API_BASE } from "./mstApiConfig";
const APP_TIME_ZONE = "Asia/Bangkok";

const LIVE_CODES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE"]);
const LIVE_CLOCK_CODES = new Set(["1H", "2H", "ET", "LIVE"]);
const NON_ACTIVE_CODES = new Set(["SUSP", "INT", "PST", "CANC", "ABD"]);
const FINISHED_CODES = new Set(["FT", "AET", "PEN"]);
const TEAM_STATS_SUPPORTED = new Set([39,2,140,135,78,61,3,848,1,4,5].map(String));
const TEAM_STATS_LEAGUE_PRIORITY = new Map([39,140,135,78,61,2,3,848,5,4,1].map((id,index)=>[String(id),index]));

const root = globalThis;
if (!root.__MST_FOOTBALL_RESPONSE_CACHE__) root.__MST_FOOTBALL_RESPONSE_CACHE__ = new Map();
if (!root.__MST_MATCH_DETAIL_CACHE__) root.__MST_MATCH_DETAIL_CACHE__ = new Map();
if (!root.__MST_COMPETITION_SEASON_CACHE__) root.__MST_COMPETITION_SEASON_CACHE__ = new Map();
const responseCache = root.__MST_FOOTBALL_RESPONSE_CACHE__;
const detailCache = root.__MST_MATCH_DETAIL_CACHE__;
const competitionSeasonCache = root.__MST_COMPETITION_SEASON_CACHE__;

const COMPETITION_ALIASES = {
  ucl: 2,
  "champions league": 2,
  "uefa champions league": 2,
  pl: 39,
  "premier league": 39,
  laliga: 140,
  "la liga": 140,
  seriea: 135,
  "serie a": 135,
  bundesliga: 78,
  ligue1: 61,
  "ligue 1": 61,
};

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
  return pick(value.name, value.title, value.shortName, value.short_name, value.team_name, value.player_name, "");
}

function objectLogo(value) {
  if (!value || typeof value === "string") return null;
  return pick(value.logo, value.crest, value.image, value.photo, value.icon, value.badge, null);
}

function looksLikeEntity(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Boolean(
    value.fixture || value.teams || value.homeTeam || value.awayTeam || value.home_team || value.away_team ||
    (value.home && value.away) || (value.player && value.statistics) || (value.team && value.venue)
  );
}

export function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const keys = [
    "matches", "response", "data", "items", "fixtures", "results", "events",
    "lineups", "statistics", "players", "injuries", "teams", "scorers",
    "seasons", "standings", "groups", "squad", "transfers", "trophies", "competitions",
  ];

  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const nested = extractArray(value);
      if (nested.length) return nested;
    }
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value) && value.length) return value;
  }

  return [];
}

export function extractObject(payload, depth = 0) {
  if (!payload || typeof payload !== "object" || depth > 8) return null;
  if (Array.isArray(payload)) return payload.length ? extractObject(payload[0], depth + 1) || payload[0] : null;
  if (looksLikeEntity(payload)) return payload;

  const keys = ["response", "data", "item", "result", "profile", "match", "fixture", "payload"];
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value) && value.length) return extractObject(value[0], depth + 1) || value[0];
    if (value && typeof value === "object") {
      const nested = extractObject(value, depth + 1);
      if (nested) return nested;
    }
  }

  return payload;
}

function canonicalStatus(value) {
  const raw = String(value || "NS").trim().toUpperCase().replace(/[ -]+/g, "_");
  const aliases = {
    FINISHED: "FT",
    FULL_TIME: "FT",
    FULLTIME: "FT",
    ENDED: "FT",
    COMPLETE: "FT",
    COMPLETED: "FT",
    SCHEDULED: "NS",
    NOT_STARTED: "NS",
    NOTSTARTED: "NS",
    UPCOMING: "NS",
    POSTPONED: "PST",
    CANCELLED: "CANC",
    CANCELED: "CANC",
    ABANDONED: "ABD",
    SUSPENDED: "SUSP",
    INTERRUPTED: "INT",
    HALF_TIME: "HT",
    HALFTIME: "HT",
    FIRST_HALF: "1H",
    SECOND_HALF: "2H",
    EXTRA_TIME: "ET",
    EXTRATIME: "ET",
    BREAK: "BT",
    BREAK_TIME: "BT",
    PENALTIES: "P",
    PENALTY_SHOOTOUT: "P",
    PENALTY_SHOOT_OUT: "P",
    IN_PLAY: "LIVE",
    INPLAY: "LIVE",
  };
  return aliases[raw] || raw;
}

function normalizeStatus(raw) {
  const fixture = raw?.fixture ?? {};
  const statusObject = fixture?.status ?? (typeof raw?.status === "object" ? raw.status : {});
  const code = canonicalStatus(
    pick(
      statusObject?.short,
      statusObject?.code,
      raw?.statusShort,
      raw?.status_short,
      raw?.statusCode,
      raw?.status_code,
      typeof raw?.status === "string" ? raw.status : null,
      "NS"
    )
  );
  const elapsed = numberOrNull(pick(statusObject?.elapsed, raw?.elapsed, raw?.minute, raw?.minutes));
  const long = pick(statusObject?.long, raw?.statusLong, raw?.status_long, raw?.statusLabel, code);
  const explicitLive = Boolean(raw?.live === true || raw?.isLive === true);
  const live = !NON_ACTIVE_CODES.has(code) && (LIVE_CODES.has(code) || explicitLive);
  const finished = FINISHED_CODES.has(code);

  let display = code;
  if (live && LIVE_CLOCK_CODES.has(code) && elapsed !== null) display = `${elapsed}'`;
  else if (code === "NS") {
    const kickoff = pick(fixture?.date,raw?.date,raw?.kickoff,raw?.startTime,raw?.start_time,raw?.fixture_date,raw?.datetime);
    if (kickoff) {
      const parsed = new Date(kickoff);
      if (!Number.isNaN(parsed.getTime())) display = parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  }
  return { code, elapsed, long, live, finished, display };
}

export function normalizeFootballMatch(input, index = 0) {
  const raw = extractObject(input) ?? input ?? {};
  const fixture = raw?.fixture ?? raw?.match ?? {};
  const league = raw?.league ?? raw?.competition ?? raw?.tournament ?? raw?.leagueInfo ?? {};
  const teams = raw?.teams ?? {};
  const homeRaw = pick(teams?.home,raw?.homeTeam,raw?.home_team,raw?.home,raw?.teamHome,raw?.homeClub,{});
  const awayRaw = pick(teams?.away,raw?.awayTeam,raw?.away_team,raw?.away,raw?.teamAway,raw?.awayClub,{});
  const goals = raw?.goals ?? raw?.score ?? raw?.scores ?? {};
  const fulltime = goals?.fulltime ?? goals?.fullTime ?? raw?.fulltime ?? raw?.fullTime ?? {};
  const status = normalizeStatus(raw);
  const homeScore = numberOrNull(pick(goals?.home,raw?.homeScore,raw?.home_score,raw?.scoreHome,raw?.score_home,fulltime?.home,raw?.scores?.home));
  const awayScore = numberOrNull(pick(goals?.away,raw?.awayScore,raw?.away_score,raw?.scoreAway,raw?.score_away,fulltime?.away,raw?.scores?.away));
  const homeName = objectName(homeRaw) || pick(raw?.homeName, raw?.home_name, raw?.homeTeamName, raw?.home_team_name, "Home");
  const awayName = objectName(awayRaw) || pick(raw?.awayName, raw?.away_name, raw?.awayTeamName, raw?.away_team_name, "Away");
  const id = pick(fixture?.id,raw?.fixtureId,raw?.fixture_id,raw?.apiFixtureId,raw?.api_fixture_id,raw?.matchId,raw?.match_id,raw?.id,`mst-${index}`);
  const kickoff = pick(fixture?.date,raw?.date,raw?.kickoff,raw?.startTime,raw?.start_time,raw?.fixtureDate,raw?.fixture_date,raw?.datetime,null);

  return {
    id: String(id),source:"mst-api",
    competition: objectName(league) || pick(raw?.competitionName,raw?.competition_name,raw?.leagueName,raw?.league_name,"Football"),
    competitionId: pick(league?.id,raw?.competitionId,raw?.competition_id,raw?.leagueId,raw?.league_id,null),
    competitionLogo: objectLogo(league),country:pick(league?.country,raw?.country,null),season:pick(league?.season,raw?.season,null),round:pick(league?.round,raw?.round,raw?.stage,null),
    status:status.live?"LIVE":status.code,statusCode:status.code,statusLong:status.long,isLive:status.live,isFinished:status.finished,minute:status.display,elapsed:status.elapsed,kickoff,
    timestamp:pick(fixture?.timestamp,raw?.timestamp,null),venue:pick(fixture?.venue?.name,raw?.venue?.name,raw?.venueName,typeof raw?.venue==="string"?raw.venue:null,null),referee:pick(fixture?.referee,raw?.referee,null),
    home:{id:pick(homeRaw?.id,raw?.homeTeamId,raw?.home_team_id,raw?.homeId,raw?.home_id,null),name:homeName,short:pick(homeRaw?.code,homeRaw?.short,raw?.homeCode,null),logo:objectLogo(homeRaw)||pick(raw?.homeLogo,raw?.home_logo,null)},
    away:{id:pick(awayRaw?.id,raw?.awayTeamId,raw?.away_team_id,raw?.awayId,raw?.away_id,null),name:awayName,short:pick(awayRaw?.code,awayRaw?.short,raw?.awayCode,null),logo:objectLogo(awayRaw)||pick(raw?.awayLogo,raw?.away_logo,null)},
    homeScore,awayScore,aggregate:pick(raw?.aggregate,raw?.score?.aggregate,null),raw,
  };
}

function validMatchIdentity(match) {return Boolean(match&&match.id&&!String(match.id).startsWith("mst-")&&match.home?.name&&match.home.name!=="Home"&&match.away?.name&&match.away.name!=="Away");}
function scheduledSnapshot(match) {return ["","NS","TBD","SCHEDULED","NOT_STARTED","UPCOMING","UNKNOWN"].includes(canonicalStatus(match?.statusCode??match?.status));}
function mergeMatchDetail(previous,fresh){if(!previous)return fresh;if(!fresh)return previous;const merged={...previous,...fresh,home:{...(previous.home||{}),...(fresh.home||{})},away:{...(previous.away||{}),...(fresh.away||{})}};if(fresh.homeScore==null&&previous.homeScore!=null)merged.homeScore=previous.homeScore;if(fresh.awayScore==null&&previous.awayScore!=null)merged.awayScore=previous.awayScore;if((previous.isLive||previous.isFinished)&&scheduledSnapshot(fresh)){merged.status=previous.status;merged.statusCode=previous.statusCode;merged.statusLong=previous.statusLong;merged.isLive=previous.isLive;merged.isFinished=previous.isFinished;merged.minute=previous.minute;merged.elapsed=previous.elapsed;}if(previous.isFinished&&!fresh.isFinished){merged.status=previous.status;merged.statusCode=previous.statusCode;merged.statusLong=previous.statusLong;merged.isLive=false;merged.isFinished=true;merged.minute=previous.minute;merged.elapsed=previous.elapsed;}return merged;}

export function isLiveMatch(match){const code=canonicalStatus(match?.statusCode??match?.status);if(NON_ACTIVE_CODES.has(code))return false;return Boolean(match?.isLive||LIVE_CODES.has(code));}
export function localDateString(date=new Date()){const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,"0"),day=String(date.getDate()).padStart(2,"0");return`${year}-${month}-${day}`;}
export function offsetDateString(days=0){const date=new Date();date.setDate(date.getDate()+days);return localDateString(date);}

function dateKeyInTimeZone(value,timeZone=APP_TIME_ZONE){if(!value)return null;const date=new Date(value);if(Number.isNaN(date.getTime())){const match=String(value).match(/^(\d{4}-\d{2}-\d{2})/);return match?match[1]:null;}try{const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);const values=Object.fromEntries(parts.map((part)=>[part.type,part.value]));if(values.year&&values.month&&values.day)return`${values.year}-${values.month}-${values.day}`;}catch(_){}return date.toISOString().slice(0,10);}
function sortMatches(matches){return[...matches].sort((a,b)=>{if(a.isLive!==b.isLive)return a.isLive?-1:1;const at=a.kickoff?new Date(a.kickoff).getTime():Number.MAX_SAFE_INTEGER,bt=b.kickoff?new Date(b.kickoff).getTime():Number.MAX_SAFE_INTEGER;return(Number.isFinite(at)?at:Number.MAX_SAFE_INTEGER)-(Number.isFinite(bt)?bt:Number.MAX_SAFE_INTEGER);});}

export function resolveCompetitionId(league){if(league?.competitionId)return league.competitionId;if(typeof league?.id==="number"||/^\d+$/.test(String(league?.id??"")))return league.id;const idKey=String(league?.id??"").toLowerCase(),nameKey=String(league?.name??league?.competition??"").toLowerCase();return COMPETITION_ALIASES[idKey]??COMPETITION_ALIASES[nameKey]??league?.id??null;}

async function apiGet(path,{signal}={}){const response=await fetch(`${FOOTBALL_API_BASE}${path}`,{method:"GET",headers:{Accept:"application/json","Cache-Control":"no-cache"},signal});if(!response.ok){const body=await response.text().catch(()=>"");throw new Error(`MST football API ${response.status}${body?`: ${body.slice(0,160)}`:""}`);}return response.json();}
async function apiGetCached(path,maxAgeMs,options={}){const key=String(path),saved=responseCache.get(key);if(saved&&Date.now()-saved.fetchedAt<maxAgeMs)return saved.data;try{const data=await apiGet(path,options);responseCache.set(key,{data,fetchedAt:Date.now()});return data;}catch(error){if(saved)return saved.data;throw error;}}

export async function fetchFootballMatches({date=localDateString(),signal}={}){const payload=await apiGet(`/matches?date=${encodeURIComponent(date)}&timezone=${encodeURIComponent(APP_TIME_ZONE)}`,{signal});const normalized=extractArray(payload).map((item,index)=>normalizeFootballMatch(item,index)).filter((match)=>match.home?.name&&match.away?.name);const strict=normalized.filter((match)=>dateKeyInTimeZone(match.kickoff)===date);return{matches:sortMatches(strict),payload,rawCount:normalized.length,filteredCount:strict.length,requestedDate:date};}
export async function fetchMatchDetail(id,options){const payload=await apiGet(`/matches/${encodeURIComponent(id)}`,options),raw=extractObject(payload),fresh=raw?normalizeFootballMatch(raw):null,key=String(id),previous=detailCache.get(key)||null,match=validMatchIdentity(fresh)?mergeMatchDetail(previous,fresh):previous;if(match)detailCache.set(key,match);return{match:match||null,payload};}
export const fetchMatchEvents=(id,options)=>apiGet(`/matches/${encodeURIComponent(id)}/events`,options);
export const fetchMatchLineups=(id,options)=>apiGetCached(`/matches/${encodeURIComponent(id)}/lineups`,60_000,options);
export const fetchMatchStatistics=(id,options)=>apiGet(`/matches/${encodeURIComponent(id)}/statistics`,options);
export const fetchMatchH2H=(id,options)=>apiGetCached(`/matches/${encodeURIComponent(id)}/h2h`,30*60_000,options);
export const fetchMatchPlayers=(id,options)=>apiGetCached(`/matches/${encodeURIComponent(id)}/players`,60_000,options);
export const fetchMatchInjuries=(id,options)=>apiGetCached(`/matches/${encodeURIComponent(id)}/injuries`,5*60_000,options);

async function settleBundle(tasks,base={}){const keys=Object.keys(tasks),settled=await Promise.allSettled(keys.map((key)=>tasks[key]())),result={...base,errors:{}};settled.forEach((item,index)=>{const key=keys[index];if(item.status==="fulfilled")result[key]=item.value;else{result[key]=null;result.errors[key]=item.reason?.message??"Unavailable";}});return result;}
export async function fetchMatchBundle(id){return settleBundle({detail:()=>fetchMatchDetail(id),events:()=>fetchMatchEvents(id),lineups:()=>fetchMatchLineups(id),statistics:()=>fetchMatchStatistics(id),h2h:()=>fetchMatchH2H(id),players:()=>fetchMatchPlayers(id),injuries:()=>fetchMatchInjuries(id)});}

export const fetchCompetitionCatalog=(options)=>apiGet(`/competitions/catalog`,options);
export const fetchCompetitionSeasons=(id,options)=>apiGetCached(`/competitions/${encodeURIComponent(id)}/seasons`,6*60*60_000,options);
function seasonsFromPayload(payload){return extractArray(payload).map((value)=>Number(typeof value==="object"?(value?.year??value?.season):value)).filter((value)=>Number.isInteger(value)&&value>=1900&&value<=2200).sort((a,b)=>b-a);}
async function resolveCompetitionSeason(id, preferred, options) {
  const explicit = Number(preferred);
  if (Number.isInteger(explicit) && explicit >= 1900 && explicit <= 2200) return explicit;
  const cached = competitionSeasonCache.get(String(id));
  if (cached?.season && Date.now() - cached.fetchedAt < 6 * 60 * 60_000) return cached.season;
  const seasonsPayload = await fetchCompetitionSeasons(id, options).catch(() => null);
  const seasons = seasonsFromPayload(seasonsPayload);
  const season = seasons[0] || 2024;
  competitionSeasonCache.set(String(id), { season, fetchedAt: Date.now() });
  return season;
}

function seasonOptions(options = {}) {
  return { season: options?.season ?? options?.currentSeason ?? options?.latestSeason, signal: options?.signal };
}

export async function fetchCompetitionProfile(id, options = {}) {
  const o = seasonOptions(options);
  const season = await resolveCompetitionSeason(id, o.season, { signal: o.signal });
  return apiGet(`/competitions/${encodeURIComponent(id)}/profile?season=${encodeURIComponent(season)}`, { signal: o.signal });
}

export async function fetchCompetitionMatches(id, options = {}) {
  const o = seasonOptions(options);
  const season = await resolveCompetitionSeason(id, o.season, { signal: o.signal });
  return apiGet(`/competitions/${encodeURIComponent(id)}/matches?season=${encodeURIComponent(season)}`, { signal: o.signal });
}

export async function fetchCompetitionStandings(id, options = {}) {
  const o = seasonOptions(options);
  if (o.season) {
    return apiGet(`/competitions/${encodeURIComponent(id)}/standings?season=${encodeURIComponent(o.season)}`, { signal: o.signal });
  }
  const seasonsPayload = await fetchCompetitionSeasons(id, options).catch(() => null);
  const seasons = seasonsFromPayload(seasonsPayload);
  const candidates = seasons.length ? seasons.slice(0, 4) : [2026, 2025, 2024];

  for (const s of candidates) {
    try {
      const res = await apiGet(`/competitions/${encodeURIComponent(id)}/standings?season=${encodeURIComponent(s)}`, { signal: o.signal });
      const rows = normalizeStandings(res);
      if (rows && rows.length > 0) {
        competitionSeasonCache.set(String(id), { season: s, fetchedAt: Date.now() });
        return res;
      }
    } catch (_) {}
  }
  const fallback = seasons[0] || 2024;
  return apiGet(`/competitions/${encodeURIComponent(id)}/standings?season=${encodeURIComponent(fallback)}`, { signal: o.signal });
}

export async function fetchCompetitionTeams(id, options = {}) {
  const o = seasonOptions(options);
  if (o.season) {
    return apiGet(`/competitions/${encodeURIComponent(id)}/teams?season=${encodeURIComponent(o.season)}`, { signal: o.signal });
  }
  const seasonsPayload = await fetchCompetitionSeasons(id, options).catch(() => null);
  const seasons = seasonsFromPayload(seasonsPayload);
  const candidates = seasons.length ? seasons.slice(0, 4) : [2026, 2025, 2024];

  for (const s of candidates) {
    try {
      const res = await apiGet(`/competitions/${encodeURIComponent(id)}/teams?season=${encodeURIComponent(s)}`, { signal: o.signal });
      const rows = normalizeTeams(res);
      if (rows && rows.length > 0) {
        return res;
      }
    } catch (_) {}
  }
  const fallback = seasons[0] || 2024;
  return apiGet(`/competitions/${encodeURIComponent(id)}/teams?season=${encodeURIComponent(fallback)}`, { signal: o.signal });
}

export async function fetchCompetitionScorers(id, options = {}) {
  const o = seasonOptions(options);
  const season = await resolveCompetitionSeason(id, o.season, { signal: o.signal });
  return apiGet(`/competitions/${encodeURIComponent(id)}/scorers?season=${encodeURIComponent(season)}`, { signal: o.signal });
}

export async function fetchCompetitionBundle(league){const id=resolveCompetitionId(league);if(!id)throw new Error("Competition ID is unavailable.");const seasons=await fetchCompetitionSeasons(id),season=await resolveCompetitionSeason(id,pick(league?.season,league?.currentSeason,league?.latestSeason));return settleBundle({profile:()=>fetchCompetitionProfile(id,{season}),standings:()=>fetchCompetitionStandings(id,{season}),matches:()=>fetchCompetitionMatches(id,{season}),teams:()=>fetchCompetitionTeams(id,{season}),scorers:()=>fetchCompetitionScorers(id,{season})},{id,season,seasons});}

export const fetchTeamProfile=(id,options)=>apiGet(`/teams/${encodeURIComponent(id)}`,options);
export const fetchTeamMatches=(id,options)=>apiGet(`/teams/${encodeURIComponent(id)}/matches`,options);
export const fetchTeamSquad=(id,options)=>apiGet(`/teams/${encodeURIComponent(id)}/squad`,options);
export const fetchTeamTransfers=(id,options)=>apiGet(`/teams/${encodeURIComponent(id)}/transfers`,options);
export const fetchTeamTrophies=(id,options)=>apiGet(`/teams/${encodeURIComponent(id)}/trophies`,options);
function teamStatsContext(payload){const matches=extractArray(payload).map((item,index)=>normalizeFootballMatch(item,index)).filter((match)=>match?.competitionId!=null&&TEAM_STATS_SUPPORTED.has(String(match.competitionId))&&Number.isInteger(Number(match?.season)));if(!matches.length)return null;const now=Date.now();matches.sort((a,b)=>{const ap=TEAM_STATS_LEAGUE_PRIORITY.get(String(a.competitionId))??999,bp=TEAM_STATS_LEAGUE_PRIORITY.get(String(b.competitionId))??999;if(ap!==bp)return ap-bp;const at=a.kickoff?Math.abs(new Date(a.kickoff).getTime()-now):Number.MAX_SAFE_INTEGER,bt=b.kickoff?Math.abs(new Date(b.kickoff).getTime()-now):Number.MAX_SAFE_INTEGER;return at-bt;});const selected=matches[0];return selected?{competitionId:selected.competitionId,season:Number(selected.season),competition:selected.competition}:null;}
export function fetchTeamStats(id,{competitionId,season,signal}={}){if(!competitionId||!Number.isInteger(Number(season)))throw new Error("Team statistics context is unavailable.");return apiGet(`/teams/${encodeURIComponent(id)}/stats?league=${encodeURIComponent(competitionId)}&season=${encodeURIComponent(season)}`,{signal});}
export async function fetchTeamBundle(team){const id=team?.id??team;if(!id)throw new Error("Team ID is unavailable.");const bundle=await settleBundle({profile:()=>fetchTeamProfile(id),matches:()=>fetchTeamMatches(id),squad:()=>fetchTeamSquad(id),transfers:()=>fetchTeamTransfers(id),trophies:()=>fetchTeamTrophies(id)},{id});const context=teamStatsContext(bundle.matches);bundle.statsContext=context;if(!context){bundle.stats=null;bundle.errors.stats="Team statistics context is unavailable.";return bundle;}try{bundle.stats=await fetchTeamStats(id,context);}catch(error){bundle.stats=null;bundle.errors.stats=error?.message??"Team statistics are unavailable.";}return bundle;}

export const fetchPlayerProfile=(id,options)=>apiGet(`/players/${encodeURIComponent(id)}`,options);
export const fetchPlayerSidelined=(id,options)=>apiGet(`/players/${encodeURIComponent(id)}/sidelined`,options);
export const fetchPlayerTransfers=(id,options)=>apiGet(`/players/${encodeURIComponent(id)}/transfers`,options);
export const fetchPlayerTrophies=(id,options)=>apiGet(`/players/${encodeURIComponent(id)}/trophies`,options);
export async function fetchPlayerBundle(player){const id=player?.id??player;if(!id)throw new Error("Player ID is unavailable.");return settleBundle({profile:()=>fetchPlayerProfile(id),sidelined:()=>fetchPlayerSidelined(id),transfers:()=>fetchPlayerTransfers(id),trophies:()=>fetchPlayerTrophies(id)},{id});}

export function flattenDisplayRows(value,prefix="",depth=0){if(value===null||value===undefined||depth>3)return[];if(Array.isArray(value))return value.slice(0,40).flatMap((item,index)=>flattenDisplayRows(item,`${prefix}${prefix?" · ":""}${index+1}`,depth+1));if(typeof value!=="object")return[{label:prefix||"Value",value:String(value)}];const rows=[];for(const[key,item]of Object.entries(value)){if(["raw","paging","parameters","errors","get"].includes(key))continue;const label=`${prefix}${prefix?" · ":""}${key.replace(/_/g," ")}`;if(item===null||item===undefined||item==="")continue;if(typeof item==="object")rows.push(...flattenDisplayRows(item,label,depth+1));else rows.push({label,value:String(item)});if(rows.length>=80)break;}return rows.slice(0,80);}

export function normalizeStandings(payload){const data=payload?.data??payload;let rows=[];if(Array.isArray(data?.groups))rows=data.groups.flat();else{const raw=extractArray(payload);rows=raw;if(raw.length===1&&raw[0]?.league?.standings)rows=raw[0].league.standings.flat();else if(raw.length===1&&raw[0]?.standings)rows=raw[0].standings.flat();else if(raw.length&&raw.every((entry)=>Array.isArray(entry)))rows=raw.flat();else if(Array.isArray(payload?.response?.[0]?.league?.standings))rows=payload.response[0].league.standings.flat();}return rows.map((row,index)=>{const all=row?.all??row?.stats??{},goals=all?.goals??row?.goals??{},team=row?.team??row?.club??{},rank=numberOrNull(pick(row?.rank,row?.position,index+1))??index+1,gf=numberOrNull(pick(goals?.for,row?.goalsFor,row?.gf)),ga=numberOrNull(pick(goals?.against,row?.goalsAgainst,row?.ga)),gd=pick(row?.goalsDiff,row?.goalDifference,row?.gd,gf!==null&&ga!==null?gf-ga:null,"-");return{rank,team:objectName(team)||pick(row?.name,"Team"),teamId:pick(team?.id,row?.teamId,row?.team_id,null),logo:objectLogo(team),p:pick(all?.played,row?.played,row?.p,"-"),w:pick(all?.win,row?.wins,row?.w,"-"),d:pick(all?.draw,row?.draws,row?.d,"-"),l:pick(all?.lose,row?.losses,row?.l,"-"),gd,pts:pick(row?.points,row?.pts,"-"),form:row?.form??null};}).filter((row)=>row.teamId||row.team!=="Team");}
export function normalizePlayers(payload){return extractArray(payload).flatMap((entry)=>Array.isArray(entry?.players)?entry.players.map((player)=>({...player,team:entry.team})):[entry]).map((entry,index)=>{const player=entry?.player??entry;return{id:pick(player?.id,entry?.id,`player-${index}`),name:objectName(player)||pick(entry?.name,"Player"),photo:objectLogo(player),number:pick(player?.number,entry?.number,entry?.statistics?.[0]?.games?.number,null),position:pick(player?.pos,player?.position,entry?.position,entry?.statistics?.[0]?.games?.position,null),age:pick(player?.age,entry?.age,null),nationality:pick(player?.nationality,entry?.nationality,null),team:entry?.team??entry?.statistics?.[0]?.team??null,raw:entry};});}
export function normalizeTeams(payload){return extractArray(payload).map((entry,index)=>{const team=entry?.team??entry;return{id:pick(team?.id,entry?.id,`team-${index}`),name:objectName(team)||"Team",logo:objectLogo(team),country:pick(team?.country,entry?.country,null),founded:pick(team?.founded,entry?.founded,null),venue:entry?.venue??team?.venue??null,raw:entry};});}
export function normalizeScorers(payload){return extractArray(payload).map((entry,index)=>{const player=entry?.player??entry,statistics=entry?.statistics?.[0]??entry?.stats??{};return{id:pick(player?.id,entry?.id,`scorer-${index}`),name:objectName(player)||"Player",photo:objectLogo(player),team:statistics?.team??entry?.team??null,goals:pick(statistics?.goals?.total,entry?.goals,entry?.total,"-"),assists:pick(statistics?.goals?.assists,entry?.assists,"-"),appearances:pick(statistics?.games?.appearences,statistics?.games?.appearances,entry?.appearances,"-"),raw:entry};});}
export const MST_FOOTBALL_API_BASE=FOOTBALL_API_BASE;
