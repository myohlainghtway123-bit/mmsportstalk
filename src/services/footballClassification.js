/**
 * MST Football Classification & Dynamic Season Engine
 * Strict hierarchy: COUNTRY -> COMPETITION -> SEASON -> TEAMS -> MATCHES
 * 
 * Cleanly separates:
 * 1. Factual Metadata Classification (Country, Competition IDs, Gender, Age Group)
 * 2. Dynamic Provider Season Membership (Source of truth from backend / provider API)
 * 3. MST Priority Ranking (Favorites, Regional/Myanmar/ASEAN, Big Clubs, Live Status)
 */

import { fetchCompetitionTeams, normalizeTeams } from "./footballApi";

// -------------------------------------------------------------
// 1. FACTUAL COMPETITION DATABASE & IDS
// -------------------------------------------------------------
export const FACTUAL_COMPETITIONS = {
  // England
  39: { id: 39, name: "Premier League", country: "England", code: "PL", tier: 1, type: "league", gender: "men" },
  40: { id: 40, name: "Championship", country: "England", code: "CHA", tier: 2, type: "league", gender: "men" },
  45: { id: 45, name: "FA Cup", country: "England", code: "FAC", tier: 1, type: "cup", gender: "men" },
  48: { id: 48, name: "EFL Cup", country: "England", code: "EFL", tier: 1, type: "cup", gender: "men" },

  // Spain
  140: { id: 140, name: "La Liga", country: "Spain", code: "LL", tier: 1, type: "league", gender: "men" },
  141: { id: 141, name: "Segunda División", country: "Spain", code: "SD", tier: 2, type: "league", gender: "men" },
  143: { id: 143, name: "Copa del Rey", country: "Spain", code: "CDR", tier: 1, type: "cup", gender: "men" },

  // Italy
  135: { id: 135, name: "Serie A", country: "Italy", code: "SA", tier: 1, type: "league", gender: "men" },
  136: { id: 136, name: "Serie B", country: "Italy", code: "SB", tier: 2, type: "league", gender: "men" },
  137: { id: 137, name: "Coppa Italia", country: "Italy", code: "CI", tier: 1, type: "cup", gender: "men" },

  // Germany
  78: { id: 78, name: "Bundesliga", country: "Germany", code: "BL", tier: 1, type: "league", gender: "men" },
  79: { id: 79, name: "2. Bundesliga", country: "Germany", code: "2BL", tier: 2, type: "league", gender: "men" },
  81: { id: 81, name: "DFB Pokal", country: "Germany", code: "DFB", tier: 1, type: "cup", gender: "men" },

  // France
  61: { id: 61, name: "Ligue 1", country: "France", code: "L1", tier: 1, type: "league", gender: "men" },
  62: { id: 62, name: "Ligue 2", country: "France", code: "L2", tier: 2, type: "league", gender: "men" },
  66: { id: 66, name: "Coupe de France", country: "France", code: "CDF", tier: 1, type: "cup", gender: "men" },

  // UEFA & Global Championships
  2: { id: 2, name: "UEFA Champions League", country: "Europe", code: "UCL", tier: 1, type: "intl_club", gender: "men" },
  3: { id: 3, name: "UEFA Europa League", country: "Europe", code: "UEL", tier: 1, type: "intl_club", gender: "men" },
  848: { id: 848, name: "UEFA Conference League", country: "Europe", code: "UECL", tier: 1, type: "intl_club", gender: "men" },
  1: { id: 1, name: "FIFA World Cup", country: "World", code: "WC", tier: 1, type: "intl_tournament", gender: "men" },
  4: { id: 4, name: "UEFA Euro", country: "Europe", code: "EURO", tier: 1, type: "intl_tournament", gender: "men" },
  5: { id: 5, name: "UEFA Nations League", country: "Europe", code: "UNL", tier: 1, type: "intl_tournament", gender: "men" },
  9: { id: 9, name: "Copa America", country: "South America", code: "CA", tier: 1, type: "intl_tournament", gender: "men" },
  15: { id: 15, name: "FIFA Club World Cup", country: "World", code: "CWC", tier: 1, type: "intl_club", gender: "men" },
  6: { id: 6, name: "AFCON", country: "Africa", code: "AFCON", tier: 1, type: "intl_tournament", gender: "men" },
  7: { id: 7, name: "AFC Asian Cup", country: "Asia", code: "AFC", tier: 1, type: "intl_tournament", gender: "men" },

  // Myanmar & Regional
  360: { id: 360, name: "Myanmar National League", country: "Myanmar", code: "MNL", tier: 1, type: "league", gender: "men" },
  299: { id: 299, name: "Thai League 1", country: "Thailand", code: "TL1", tier: 1, type: "league", gender: "men" },
  284: { id: 284, name: "Liga 1", country: "Indonesia", code: "L1I", tier: 1, type: "league", gender: "men" },
  340: { id: 340, name: "V.League 1", country: "Vietnam", code: "VL1", tier: 1, type: "league", gender: "men" },
  290: { id: 290, name: "Malaysia Super League", country: "Malaysia", code: "MSL", tier: 1, type: "league", gender: "men" },
  368: { id: 368, name: "Singapore Premier League", country: "Singapore", code: "SPL", tier: 1, type: "league", gender: "men" },
};

// Major Global Teams for Priority Boosts
export const BIG_GLOBAL_CLUBS = [
  "real madrid", "barcelona", "atletico madrid", "manchester united", "man utd",
  "manchester city", "man city", "liverpool", "arsenal", "chelsea",
  "tottenham", "bayern munich", "bayern", "paris saint-germain", "psg",
  "juventus", "inter", "inter milan", "ac milan",
];

export const ELITE_GLOBAL_CLUBS = [
  "borussia dortmund", "dortmund", "bayer leverkusen", "leverkusen", "napoli",
  "roma", "as roma", "aston villa", "newcastle", "newcastle united",
  "sporting cp", "benfica", "porto", "fc porto", "ajax", "al hilal", "al nassr", "inter miami",
  "leeds", "sunderland", "coventry", "hull city",
];

const YOUTH_REGEX = /\b(u17|u18|u19|u20|u21|u23|youth|juniors|reserve|reserves|primavera|oberliga|regionalliga|tercera|sub-19|sub-20|sub-21|sub-23)\b/i;
const WOMEN_REGEX = /\b(women|woman|feminine|femmes|frauen|w league|nwsl|femenina|damallsvenskan|wsl|uwcl|\(w\))\b/i;
const ASEAN_TOURNAMENT_REGEX = /(asean|aff |sea games|shopee cup|mitsubishi electric cup|suzukicup)/i;
const ASEAN_LEAGUE_REGEX = /(thai league|liga 1 indonesia|v\.league|malaysia super league|singapore premier|philippines football league|cambodian premier|lao league)/i;

// -------------------------------------------------------------
// 2. FACTUAL CLASSIFICATION FUNCTIONS
// -------------------------------------------------------------

/**
 * Validates whether a match belongs strictly to the England Premier League.
 * Disambiguates from Canadian Premier League, Belarus Premier League, etc.
 */
export function isPremierLeagueEngland(match) {
  if (!match) return false;
  const compId = Number(match.competitionId || match.leagueId || match.raw?.league?.id);
  if (compId === 39) return true;

  const country = String(match.country || match.raw?.league?.country || "").trim().toLowerCase();
  const compName = String(match.competition || match.raw?.league?.name || "").trim().toLowerCase();

  // Strict identification: country is England AND name matches premier league or epl
  if (country === "england" && /\b(premier\s*league|epl)\b/i.test(compName)) {
    return true;
  }
  return false;
}

/**
 * Returns the factual country for a match/competition.
 */
export function getFactualCountry(match) {
  if (!match) return "International";
  const compId = Number(match.competitionId || match.leagueId || match.raw?.league?.id);
  if (FACTUAL_COMPETITIONS[compId]?.country) {
    return FACTUAL_COMPETITIONS[compId].country;
  }
  const explicit = match.country || match.raw?.league?.country || match.raw?.country;
  if (explicit && typeof explicit === "string" && explicit.trim()) {
    return explicit.trim();
  }
  return "International";
}

/**
 * Classifies gender factually.
 */
export function isFactualWomenMatch(match) {
  if (!match) return false;
  const compId = Number(match.competitionId || match.leagueId || match.raw?.league?.id);
  if (FACTUAL_COMPETITIONS[compId]?.gender === "women") return true;
  const comp = String(match.competition || "");
  const country = String(match.country || "");
  const home = String(match.home?.name || "");
  const away = String(match.away?.name || "");
  return WOMEN_REGEX.test(comp) || WOMEN_REGEX.test(country) || WOMEN_REGEX.test(home) || WOMEN_REGEX.test(away);
}

/**
 * Classifies youth factually.
 */
export function isFactualYouthMatch(match) {
  if (!match) return false;
  const comp = String(match.competition || "");
  const home = String(match.home?.name || "");
  const away = String(match.away?.name || "");
  return YOUTH_REGEX.test(comp) || YOUTH_REGEX.test(home) || YOUTH_REGEX.test(away);
}

/**
 * Generates a unique, factual grouping key for SectionList.
 * Disambiguates identically-named competitions across different countries.
 */
export function getFactualCompetitionKey(match) {
  const compName = String(match?.competition || "Other").trim();
  const country = getFactualCountry(match);
  if (country && country !== "International" && !compName.toLowerCase().includes(country.toLowerCase())) {
    return `${country} - ${compName}`;
  }
  return compName;
}

/**
 * Dynamic Provider Season Membership Validation (Live API Source of Truth)
 * Validates current membership against actual provider/backend competition ID + season data.
 */
export async function validateProviderSeasonMembership(competitionId = 39, season = 2026) {
  const payload = await fetchCompetitionTeams(competitionId, { season });
  const teams = normalizeTeams(payload);
  const teamIds = new Set(teams.map((t) => String(t.id)));

  return {
    competitionId: Number(competitionId),
    season: Number(season),
    count: teams.length,
    uniqueIdCount: teamIds.size,
    isExact20: teams.length === 20 && teamIds.size === 20,
    teams: teams.map((t) => ({ id: t.id, name: t.name, country: t.country })),
  };
}

// -------------------------------------------------------------
// 3. MST PRIORITY RANKING SYSTEM (DECOUPLED FROM CLASSIFICATION)
// -------------------------------------------------------------

function containsClub(teamName, list) {
  if (!teamName) return false;
  const t = String(teamName).trim().toLowerCase();
  return list.some((item) => t.includes(item));
}

/**
 * Calculates factual competition baseline weight.
 * Establishing a strict hierarchy to ensure major leagues always rank above minor leagues.
 */
export function getFactualCompetitionWeight(match) {
  if (!match) return 20;
  const compId = Number(match.competitionId || match.leagueId || match.raw?.league?.id);

  // 1. European & World Championships
  if (compId === 2) return 1000; // UEFA Champions League
  if (compId === 1) return 980;  // FIFA World Cup
  if (compId === 4) return 960;  // UEFA Euro
  if (compId === 3) return 950;  // UEFA Europa League
  if (compId === 9) return 920;  // Copa America
  if (compId === 848 || compId === 15) return 900; // Conference League / Club World Cup
  if (compId === 7 || compId === 6) return 880; // Asian Cup / AFCON

  // 2. The Big 5 European Leagues
  if (compId === 39) return 1500; // England Premier League - BOOSTED TO BE ALWAYS FIRST
  if (compId === 140) return 830; // La Liga
  if (compId === 135) return 810; // Serie A
  if (compId === 78) return 790;  // Bundesliga
  if (compId === 61) return 770;  // Ligue 1

  // 3. Domestic Cups
  if (compId === 45) return 750; // FA Cup
  if (compId === 143) return 740; // Copa del Rey
  if (compId === 137) return 730; // Coppa Italia
  if (compId === 81) return 720;  // DFB Pokal
  if (compId === 66) return 710;  // Coupe de France
  if (compId === 48) return 700;  // EFL Cup

  // 4. Secondary Leagues
  if (compId === 40) return 580; // Championship

  // Factual text fallback if ID missing from provider
  const comp = String(match.competition || "").toLowerCase();
  const country = String(match.country || "").toLowerCase();

  if (comp.includes("champions league") || comp.includes("ucl")) return 1000;
  if (comp.includes("world cup")) return 980;
  if (comp.includes("euro") && (country.includes("europe") || country.includes("world"))) return 960;
  if (comp.includes("europa league") || comp.includes("uel")) return 950;
  if (comp.includes("copa america")) return 920;
  if (comp.includes("conference league") || comp.includes("uecl")) return 900;

  if (country === "england" && /\b(premier\s*league|epl)\b/i.test(comp)) return 1500; // Strict EPL fallback
  if (country === "spain" && (comp.includes("la liga") || comp.includes("laliga") || comp.includes("primera division"))) return 830;
  if (country === "italy" && (comp.includes("serie a") || comp.includes("calcio"))) return 810;
  if (country === "germany" && comp.includes("bundesliga")) return 790;
  if (country === "france" && comp.includes("ligue 1")) return 770;

  if (ASEAN_TOURNAMENT_REGEX.test(comp)) return 400;
  if (ASEAN_LEAGUE_REGEX.test(comp)) return 300;

  return 20;
}

/**
 * Calculates complete match priority score with Favorites, Regional, Big Teams, and Live bonuses.
 */
export function calculateFactualMatchPriority(match, favorites = {}, regionalNationalTeamPriorityFn = null) {
  let score = getFactualCompetitionWeight(match);
  const home = match?.home?.name;
  const away = match?.away?.name;
  const homeId = String(match?.home?.id ?? "");
  const awayId = String(match?.away?.id ?? "");
  const compId = String(match?.competitionId ?? "");
  const compName = String(match?.competition || "").toLowerCase();

  // 1. Favorites
  const favTeamIds = favorites.teamIds || [];
  const favTeamNames = favorites.teamNames || [];
  const favCompIds = favorites.compIds || [];
  const favCompNames = favorites.compNames || [];

  const isHomeFav = favTeamIds.includes(homeId) || (home && favTeamNames.some((t) => home.toLowerCase().includes(t)));
  const isAwayFav = favTeamIds.includes(awayId) || (away && favTeamNames.some((t) => away.toLowerCase().includes(t)));
  const isCompFav = favCompIds.includes(compId) || (compName && favCompNames.some((c) => compName.includes(c)));

  if (isHomeFav || isAwayFav) score += 700;
  if (isCompFav) score += 500;

  // 2. Myanmar & ASEAN Regional Priority
  let regionalPriority = 0;
  if (typeof regionalNationalTeamPriorityFn === "function") {
    regionalPriority = Math.max(
      regionalNationalTeamPriorityFn(home),
      regionalNationalTeamPriorityFn(away)
    );
  }

  if (regionalPriority === 2) {
    score += 600; // Myanmar Senior National Team
  } else if (/myanmar/i.test(match?.country || match?.competition || "")) {
    score += 450; // Myanmar domestic
  } else if (regionalPriority === 1) {
    score += 320; // ASEAN National Team
  } else if (ASEAN_TOURNAMENT_REGEX.test(match?.competition || "")) {
    score += 290;
  } else if (ASEAN_LEAGUE_REGEX.test(match?.competition || "")) {
    score += 200;
  }

  // 3. Big & Elite Clubs
  const homeBig = containsClub(home, BIG_GLOBAL_CLUBS);
  const awayBig = containsClub(away, BIG_GLOBAL_CLUBS);
  if (homeBig && awayBig) score += 160;
  else if (homeBig || awayBig) score += 65;

  const homeElite = containsClub(home, ELITE_GLOBAL_CLUBS);
  const awayElite = containsClub(away, ELITE_GLOBAL_CLUBS);
  if (homeElite && awayElite) score += 70;
  else if (homeElite || awayElite) score += 30;

  // 4. Demographic Demotions (unless favorite or regional)
  const isYouth = isFactualYouthMatch(match);
  const isWomen = isFactualWomenMatch(match);
  const hasStrongPriority = isHomeFav || isAwayFav || regionalPriority > 0;

  if (isYouth && !hasStrongPriority) {
    score -= 1000; // Heavy demotion for Youth in ALL view
  }

  if (isWomen && !hasStrongPriority) {
    score -= 800; // Heavy demotion for Women in ALL view
  }

  // 5. Live match bonus
  if (match?.isLive || Boolean(match?.live)) {
    score += 40;
  }

  return score;
}
