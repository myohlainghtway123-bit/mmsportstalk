import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { isLiveMatch } from "../services/footballApi";
import {
  fetchFastFootballMatches,
  peekFastFootballMatches,
  prefetchFastFootballMatches,
} from "../services/fastFootballApi";
import { regionalNationalTeamPriority } from "../services/regionalFootball";
import { getAuthStatus, getFavorites, getProfile, normalizeAvatarUrl, normalizeFavoritePayload } from "../services/accountApi";
import { loadOnboardingPreferences } from "../services/onboardingStore";

const MAIN_TABS = ["FOR_YOU", "LIVE", "TOP", "ALL"];
const DATE_OFFSETS = Array.from({ length: 15 }, (_, i) => i - 7);

const MAJOR_COMPETITIONS = [
  [/(world cup|euro championship|uefa euro|copa america|champions league|club world cup|afc asian cup|africa cup of nations)/i, 170],
  [/(premier league|la ?liga|serie a|bundesliga|ligue 1)/i, 140],
  [/(europa league|uefa europa)/i, 110],
  [/(conference league|fa cup|copa del rey|dfb pokal|coppa italia|coupe de france|carabao cup|efl cup)/i, 80],
];

const BIG_TEAMS = [
  "real madrid", "barcelona", "atletico madrid", "manchester united", "man utd",
  "manchester city", "man city", "liverpool", "arsenal", "chelsea",
  "tottenham", "bayern munich", "bayern", "paris saint-germain", "psg",
  "juventus", "inter", "inter milan", "ac milan",
];

const ELITE_TEAMS = [
  "borussia dortmund", "dortmund", "bayer leverkusen", "leverkusen", "napoli",
  "roma", "as roma", "aston villa", "newcastle", "newcastle united",
  "sporting cp", "benfica", "porto", "fc porto", "ajax", "al hilal", "al nassr", "inter miami",
];

const YOUTH_OBSCURE_REGEX = /\b(u17|u18|u19|u20|u21|u23|youth|juniors|reserve|reserves|primavera|oberliga|regionalliga|tercera|sub-19|sub-20|sub-21|sub-23)\b/i;
const WOMEN_REGEX = /\b(women|woman|feminine|femmes|frauen|w league|nwsl|femenina|damallsvenskan|wsl|uwcl|\(w\))\b/i;
const ASEAN_LEAGUE_REGEX = /(thai league|liga 1|v\.league|malaysia super league|singapore premier|philippines football league|cambodian premier|lao league)/i;
const ASEAN_TOURNAMENT_REGEX = /(asean|aff |sea games|shopee cup|mitsubishi electric cup|suzukicup)/i;

function containsTeam(name, list) {
  if (!name) return false;
  const n = String(name).trim().toLowerCase();
  return list.some((item) => n.includes(item));
}

function competitionWeight(title) {
  if (!title) return 10;
  for (const [regex, weight] of MAJOR_COMPETITIONS) {
    if (regex.test(title)) return weight;
  }
  if (ASEAN_TOURNAMENT_REGEX.test(title)) return 120;
  if (ASEAN_LEAGUE_REGEX.test(title)) return 70;
  return 15;
}

function isYouthMatch(match) {
  const comp = String(match?.competition || "");
  const home = String(match?.home?.name || "");
  const away = String(match?.away?.name || "");
  return YOUTH_OBSCURE_REGEX.test(comp) || YOUTH_OBSCURE_REGEX.test(home) || YOUTH_OBSCURE_REGEX.test(away);
}

function isWomenMatch(match) {
  const comp = String(match?.competition || "");
  const country = String(match?.country || "");
  const home = String(match?.home?.name || "");
  const away = String(match?.away?.name || "");
  return WOMEN_REGEX.test(comp) || WOMEN_REGEX.test(country) || WOMEN_REGEX.test(home) || WOMEN_REGEX.test(away);
}

function matchPriorityScore(match, favorites = {}) {
  let score = competitionWeight(match?.competition);
  const home = match?.home?.name, away = match?.away?.name;
  const homeId = String(match?.home?.id ?? "");
  const awayId = String(match?.away?.id ?? "");
  const compId = String(match?.competitionId ?? "");
  const compName = String(match?.competition || "").toLowerCase();

  // 1. User Favorites Priority
  const favTeamIds = favorites.teamIds || [];
  const favTeamNames = favorites.teamNames || [];
  const favCompIds = favorites.compIds || [];
  const favCompNames = favorites.compNames || [];

  const isHomeFav = favTeamIds.includes(homeId) || (home && favTeamNames.some((t) => home.toLowerCase().includes(t)));
  const isAwayFav = favTeamIds.includes(awayId) || (away && favTeamNames.some((t) => away.toLowerCase().includes(t)));
  const isCompFav = favCompIds.includes(compId) || (compName && favCompNames.some((c) => compName.includes(c)));

  if (isHomeFav || isAwayFav) score += 700;
  if (isCompFav) score += 500;

  // 2. Regional Priority (Myanmar & ASEAN)
  const regionalHome = regionalNationalTeamPriority(home);
  const regionalAway = regionalNationalTeamPriority(away);
  const regionalPriority = Math.max(regionalHome, regionalAway);

  if (regionalPriority === 2) {
    // Myanmar National Team
    score += 600;
  } else if (/myanmar/i.test(match?.country || match?.competition || "")) {
    // Myanmar domestic football (MNL, etc.)
    score += 450;
  } else if (regionalPriority === 1) {
    // ASEAN National Team
    score += 320;
  } else if (ASEAN_TOURNAMENT_REGEX.test(match?.competition || "")) {
    score += 290;
  } else if (ASEAN_LEAGUE_REGEX.test(match?.competition || "")) {
    score += 200;
  }

  // 3. Big Clubs & Elite Clubs
  const bigHome = containsTeam(home, BIG_TEAMS), bigAway = containsTeam(away, BIG_TEAMS);
  const eliteHome = containsTeam(home, ELITE_TEAMS), eliteAway = containsTeam(away, ELITE_TEAMS);

  if (bigHome && bigAway) score += 160;
  else if (bigHome || bigAway) score += 65;
  else if (eliteHome && eliteAway) score += 70;
  else if (eliteHome || eliteAway) score += 30;

  // 4. Youth / Lower Tier Penalty (unless it's favorited or Myanmar/ASEAN)
  if (isYouthMatch(match) && !isHomeFav && !isAwayFav && !isCompFav && regionalPriority === 0) {
    score -= 300;
  }

  // 5. Live status bonus
  if (isLiveMatch(match)) score += 40;

  return score;
}

function kickoffTime(match) {
  const t = match?.kickoff ? new Date(match.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

function importantMatchSort(a, b, favorites = {}) {
  const scoreDiff = matchPriorityScore(b, favorites) - matchPriorityScore(a, favorites);
  if (scoreDiff !== 0) return scoreDiff;

  const aLive = isLiveMatch(a), bLive = isLiveMatch(b);
  if (aLive !== bLive) return aLive ? -1 : 1;

  const timeDiff = kickoffTime(a) - kickoffTime(b);
  if (timeDiff !== 0) return timeDiff;

  return String(a?.home?.name || "").localeCompare(String(b?.home?.name || ""));
}

function bangkokDate(offset = 0) {
  const date = new Date(Date.now() + offset * 86400000);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  } catch (_) {
    return date.toISOString().slice(0, 10);
  }
}

function dayMeta(offset, language) {
  const d = new Date(Date.now() + offset * 86400000);
  const day = d.toLocaleDateString([], { weekday: "short" }).toUpperCase();
  const num = d.toLocaleDateString([], { day: "2-digit" });
  const month = d.toLocaleDateString([], { month: "short" }).toUpperCase();
  return { day: offset === 0 ? (language === "my" ? "ယနေ့" : "TODAY") : day, num, month };
}

function statusCode(match) {
  return String(match?.statusCode || match?.status || "").trim().toUpperCase();
}

function kickoffLabel(match, language) {
  const my = language === "my";
  const code = statusCode(match);
  if (code === "HT") return "HT";
  if (code === "P" || code === "PEN") return "PEN";
  if (code === "BT") return "BREAK";
  if (code === "SUSP" || code === "SUSPENDED") return my ? "ဆိုင်းငံ့" : "SUSP";
  if (code === "INT" || code === "INTERRUPTED") return my ? "ရပ်နား" : "INT";
  if (code === "PST" || code === "POSTPONED") return my ? "ရွှေ့ဆိုင်း" : "PST";
  if (code === "CANC" || code === "CANCELLED" || code === "CANCELED") return my ? "ဖျက်သိမ်း" : "CANC";
  if (code === "ABD" || code === "ABANDONED") return my ? "ပျက်ပြယ်" : "ABD";
  if (code === "AET") return "AET";
  if (code === "FT" || code === "FINISHED") return "FT";

  if (isLiveMatch(match)) {
    const elapsed = Number(match?.elapsed);
    if (Number.isFinite(elapsed) && elapsed >= 0) return `${elapsed}'`;
    const minute = String(match?.minute || "").trim();
    if (/^\d+(?:\+\d+)?'?$/.test(minute)) return minute.endsWith("'") ? minute : `${minute}'`;
    return "LIVE";
  }

  if (match?.kickoff) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date(match.kickoff));
      const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      if (map.hour && map.minute) return `${map.hour}:${map.minute}`;
    } catch (_) {}
  }
  return match?.minute || match?.status || (my ? "စတင်မည်" : "NS");
}

function isFinished(match) {
  const code = statusCode(match);
  return Boolean(match?.isFinished || ["FT", "AET", "PEN", "FINISHED", "ENDED"].includes(code));
}

function isUpcoming(match) {
  return !isLiveMatch(match) && !isFinished(match) && !["CANC", "ABD", "PST", "SUSP"].includes(statusCode(match));
}

// -------------------------------------------------------------
// UI SUBCOMPONENTS
// -------------------------------------------------------------

const TeamLogo = memo(function TeamLogo({ uri, name, colors }) {
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={s.teamLogo}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={[s.logoFallback, { backgroundColor: colors.panel, borderColor: colors.border2 }]}>
      <Text style={[s.logoFallbackText, { color: colors.muted }]}>
        {name ? name.slice(0, 2).toUpperCase() : "FC"}
      </Text>
    </View>
  );
});

const LeagueLogo = memo(function LeagueLogo({ uri, colors }) {
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={s.leagueLogo}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={[s.leagueLogoFallback, { backgroundColor: colors.card2 }]}>
      <Ionicons name="trophy-outline" size={13} color={colors.muted} />
    </View>
  );
});

const MatchRow = memo(function MatchRow({ match, onOpen, language, colors }) {
  const live = isLiveMatch(match);
  const finished = isFinished(match);
  const code = statusCode(match);
  const isPostponed = code === "PST" || code === "POSTPONED";
  const label = kickoffLabel(match, language);

  return (
    <Pressable
      style={[
        s.matchRow,
        {
          backgroundColor: colors.card,
          borderColor: live ? colors.red : colors.border2,
        },
        live && { backgroundColor: colors.redSoft },
      ]}
      onPress={() => onOpen?.(match)}
      android_ripple={{ color: "rgba(255,255,255,0.06)" }}
    >
      {/* Time / Status Column */}
      <View style={s.timeCol}>
        <Text
          numberOfLines={1}
          style={[
            s.timeText,
            { color: live ? colors.red : finished ? colors.muted : colors.text2 },
            live && { fontWeight: "900" },
          ]}
        >
          {label}
        </Text>
        {live ? (
          <View style={[s.liveBadgePill, { backgroundColor: colors.red }]}>
            <Text style={s.liveBadgeText}>LIVE</Text>
          </View>
        ) : isPostponed ? (
          <Text style={[s.subStatusText, { color: colors.gold }]}>
            {language === "my" ? "ရွှေ့ဆိုင်း" : "Postponed"}
          </Text>
        ) : null}
      </View>

      {/* Vertical divider */}
      <View style={[s.matchDivider, { backgroundColor: colors.border2 }]} />

      {/* Teams and Scores */}
      <View style={s.fixtureCol}>
        <View style={s.teamLine}>
          <TeamLogo uri={match?.home?.logo} name={match?.home?.name} colors={colors} />
          <Text numberOfLines={1} style={[s.teamName, { color: colors.text }]}>
            {match?.home?.name || "Home"}
          </Text>
          {match?.homeScore != null ? (
            <Text style={[s.score, { color: colors.text }]}>{match.homeScore}</Text>
          ) : null}
        </View>

        <View style={s.teamLine}>
          <TeamLogo uri={match?.away?.logo} name={match?.away?.name} colors={colors} />
          <Text numberOfLines={1} style={[s.teamName, { color: colors.text }]}>
            {match?.away?.name || "Away"}
          </Text>
          {match?.awayScore != null ? (
            <Text style={[s.score, { color: colors.text }]}>{match.awayScore}</Text>
          ) : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={14} color={colors.muted2} style={s.chevron} />
    </Pressable>
  );
});

// -------------------------------------------------------------
// MAIN HOMESCREEN COMPONENT
// -------------------------------------------------------------

export default function HomeScreen({
  language = "my",
  openMatch,
  openNotifications,
  openSearch,
  openPredictions,
  openAccount,
  openFavorites,
}) {
  const { colors } = useTheme();
  const my = language === "my";

  // Core state
  const [offset, setOffset] = useState(0);
  const [mainTab, setMainTab] = useState("FOR_YOU"); // FOR_YOU | LIVE | TOP | ALL
  const [allTypeFilter, setAllTypeFilter] = useState("ALL"); // ALL | MEN | WOMEN | YOUTH
  const [allStatusFilter, setAllStatusFilter] = useState("ALL"); // ALL | LIVE | UPCOMING | FINISHED
  const [competitionFilter, setCompetitionFilter] = useState("ALL");

  // Modals & User
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [leagueModalOpen, setLeagueModalOpen] = useState(false);
  const [leagueSearch, setLeagueSearch] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [favorites, setFavorites] = useState({ teamIds: [], teamNames: [], compIds: [], compNames: [] });
  const [hasFavorites, setHasFavorites] = useState(false);

  // Collapsible competitions in ALL tab (Set of string titles)
  const [expandedLeagues, setExpandedLeagues] = useState(new Set());

  // Data fetching state
  const date = useMemo(() => bangkokDate(offset), [offset]);
  const [state, setState] = useState(() => {
    const cached = peekFastFootballMatches(date);
    return {
      loading: !cached,
      refreshing: false,
      error: "",
      matches: cached?.matches || [],
    };
  });

  // Load User Profile & Favorites
  const loadUserAndFavorites = useCallback(async () => {
    try {
      const auth = await getAuthStatus().catch(() => ({ authenticated: false }));
      let profile = null;
      let teamIds = [];
      let teamNames = [];
      let compIds = [];
      let compNames = [];

      // Local onboarding favorites (guests & logged in)
      const prefs = await loadOnboardingPreferences().catch(() => null);
      if (prefs) {
        teamIds = [...(prefs.teams || [])];
        compIds = [...(prefs.competitions || [])];
      }

      if (auth.authenticated) {
        profile = await getProfile().catch(() => null);
        if (profile) {
          setCurrentUser({
            name: profile.name || profile.displayName || profile.email || "MST Fan",
            avatar: normalizeAvatarUrl(profile.avatarUrl || profile.avatar || profile.photoURL),
          });
        }
        const favData = await getFavorites().catch(() => null);
        const normFavs = normalizeFavoritePayload(favData);
        (normFavs.teams || []).forEach((t) => {
          if (t.id) teamIds.push(String(t.id));
          if (t.name) teamNames.push(String(t.name).toLowerCase());
        });
        (normFavs.competitions || []).forEach((c) => {
          if (c.id) compIds.push(String(c.id));
          if (c.name) compNames.push(String(c.name).toLowerCase());
        });
      } else {
        setCurrentUser(null);
      }

      const uniqueTeamIds = [...new Set(teamIds.map(String))];
      const uniqueCompIds = [...new Set(compIds.map(String))];
      const uniqueTeamNames = [...new Set(teamNames.map(String))];
      const uniqueCompNames = [...new Set(compNames.map(String))];

      setFavorites({
        teamIds: uniqueTeamIds,
        teamNames: uniqueTeamNames,
        compIds: uniqueCompIds,
        compNames: uniqueCompNames,
      });
      setHasFavorites(uniqueTeamIds.length > 0 || uniqueCompIds.length > 0);
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadUserAndFavorites();
  }, [loadUserAndFavorites]);

  // Load Matches
  const load = useCallback(
    async (force = false, isRefresh = false) => {
      setState((prev) => ({
        ...prev,
        loading: !prev.matches.length && !isRefresh,
        refreshing: isRefresh,
        error: "",
      }));
      try {
        const result = await fetchFastFootballMatches({ date, force });
        setState({
          loading: false,
          refreshing: false,
          error: "",
          matches: result?.matches || [],
        });
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          refreshing: false,
          error: err?.message || (my ? "ပွဲအချက်အလက် ရယူ၍ မရပါ" : "Unable to load match data"),
        }));
      }
    },
    [date, my],
  );

  // Date Change Hook: Reset filters and fetch data
  useEffect(() => {
    setAllStatusFilter("ALL");
    setCompetitionFilter("ALL");
    const saved = peekFastFootballMatches(date);
    setState({ loading: !saved, refreshing: false, error: "", matches: saved?.matches || [] });
    load(false, false);
  }, [date, load]);

  // Background Prefetch adjacent days
  useEffect(() => {
    const timer = setTimeout(() => {
      prefetchFastFootballMatches([bangkokDate(offset - 1), bangkokDate(offset + 1)]).catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [offset]);

  // Live match polling when on today and live matches exist
  const liveCount = useMemo(() => state.matches.filter(isLiveMatch).length, [state.matches]);

  useEffect(() => {
    if (offset !== 0 || liveCount === 0) return;
    const interval = setInterval(() => {
      load(true, false);
    }, 25000);
    return () => clearInterval(interval);
  }, [offset, liveCount, load]);

  // Expand top 3 major leagues by default when matches change
  useEffect(() => {
    if (!state.matches.length) return;
    const map = new Map();
    state.matches.forEach((m) => {
      const comp = m.competition || "Other";
      if (!map.has(comp)) map.set(comp, matchPriorityScore(m, favorites));
      else map.set(comp, Math.max(map.get(comp), matchPriorityScore(m, favorites)));
    });
    const top3 = [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
    setExpandedLeagues(new Set(top3));
  }, [state.matches, favorites]);

  // Toggle Competition Accordion
  const toggleCompetitionExpand = useCallback((title) => {
    setExpandedLeagues((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }, []);

  const expandAllCompetitions = useCallback((allTitles) => {
    setExpandedLeagues(new Set(allTitles));
  }, []);

  const collapseAllCompetitions = useCallback(() => {
    setExpandedLeagues(new Set());
  }, []);

  // -------------------------------------------------------------
  // TAB-SPECIFIC FILTERING & STRUCTURING
  // -------------------------------------------------------------

  // 1. FOR YOU: High priority curated matches feed
  const forYouMatches = useMemo(() => {
    const list = [...state.matches].sort((a, b) => importantMatchSort(a, b, favorites));
    // Filter out very obscure youth matches unless favorited or ASEAN/Myanmar
    return list.filter((m) => {
      if (isYouthMatch(m)) {
        const score = matchPriorityScore(m, favorites);
        return score > 200;
      }
      return true;
    });
  }, [state.matches, favorites]);

  // 2. LIVE: Purely live matches + fallback upcoming if empty
  const liveMatches = useMemo(() => {
    return state.matches
      .filter(isLiveMatch)
      .sort((a, b) => importantMatchSort(a, b, favorites));
  }, [state.matches, favorites]);

  const upcomingMatchesForLiveFallback = useMemo(() => {
    if (liveMatches.length > 0) return [];
    return state.matches
      .filter(isUpcoming)
      .sort((a, b) => importantMatchSort(a, b, favorites))
      .slice(0, 10);
  }, [state.matches, liveMatches.length, favorites]);

  // 3. TOP: Top 10-20 high-interest matches of the day
  const topMatches = useMemo(() => {
    const scored = state.matches
      .map((m) => ({ match: m, score: matchPriorityScore(m, favorites) }))
      .filter(({ match, score }) => {
        if (isYouthMatch(match)) return score > 250;
        return score >= 60;
      })
      .sort((a, b) => b.score - a.score || kickoffTime(a.match) - kickoffTime(b.match))
      .map((item) => item.match);

    return scored.slice(0, 20);
  }, [state.matches, favorites]);

  // 4. ALL: Complete catalog grouped by competition
  const allFilteredMatches = useMemo(() => {
    return state.matches.filter((m) => {
      // Type Filter
      if (allTypeFilter === "MEN" && (isWomenMatch(m) || isYouthMatch(m))) return false;
      if (allTypeFilter === "WOMEN" && !isWomenMatch(m)) return false;
      if (allTypeFilter === "YOUTH" && !isYouthMatch(m)) return false;

      // Status Filter
      if (allStatusFilter === "LIVE" && !isLiveMatch(m)) return false;
      if (allStatusFilter === "UPCOMING" && !isUpcoming(m)) return false;
      if (allStatusFilter === "FINISHED" && !isFinished(m)) return false;

      // Specific Competition Filter
      if (competitionFilter !== "ALL" && m.competition !== competitionFilter) return false;

      return true;
    });
  }, [state.matches, allTypeFilter, allStatusFilter, competitionFilter]);

  // Group ALL matches into SectionList sections
  const allSections = useMemo(() => {
    const map = new Map();
    for (const match of allFilteredMatches) {
      const key = match.competition || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(match);
    }
    const rows = [...map.entries()].map(([title, data]) => {
      const ordered = [...data].sort((a, b) => importantMatchSort(a, b, favorites));
      return {
        title,
        data: ordered,
        logo: ordered[0]?.competitionLogo,
        country: ordered[0]?.country,
        priority: ordered.length ? matchPriorityScore(ordered[0], favorites) : 0,
      };
    });
    rows.sort(
      (a, b) =>
        b.priority - a.priority ||
        competitionWeight(b.title) - competitionWeight(a.title) ||
        a.title.localeCompare(b.title),
    );
    return rows;
  }, [allFilteredMatches, favorites]);

  // Flattened sections for the active tab
  const activeSections = useMemo(() => {
    if (mainTab === "FOR_YOU") {
      if (!forYouMatches.length) return [];
      return [{ title: my ? "သင့်အတွက် ပွဲစဉ်များ" : "FOR YOU MATCHES", data: forYouMatches, isSimple: true }];
    }
    if (mainTab === "LIVE") {
      if (liveMatches.length > 0) {
        return [{ title: my ? "တိုက်ရိုက်ပွဲစဉ်များ" : "LIVE MATCHES", data: liveMatches, isSimple: true }];
      }
      if (upcomingMatchesForLiveFallback.length > 0) {
        return [
          {
            title: my ? "လာမည့် အရေးကြီးပွဲများ" : "UPCOMING MATCHES TODAY",
            data: upcomingMatchesForLiveFallback,
            isSimple: true,
          },
        ];
      }
      return [];
    }
    if (mainTab === "TOP") {
      if (!topMatches.length) return [];
      return [{ title: my ? "ယနေ့ အဓိကပွဲစဉ်များ" : "TOP MATCHES TODAY", data: topMatches, isSimple: true }];
    }
    // ALL Tab: Use Collapsible Competition Sections
    return allSections.map((sec) => ({
      ...sec,
      isSimple: false,
      isExpanded: expandedLeagues.has(sec.title),
      data: expandedLeagues.has(sec.title) ? sec.data : [],
      totalCount: sec.data.length,
    }));
  }, [mainTab, forYouMatches, liveMatches, upcomingMatchesForLiveFallback, topMatches, allSections, expandedLeagues, my]);

  // Calendar direct jump options (-14 days to +14 days)
  const calendarDates = useMemo(() => {
    return Array.from({ length: 29 }, (_, i) => {
      const off = i - 14;
      const d = new Date(Date.now() + off * 86400000);
      return {
        offset: off,
        dateStr: bangkokDate(off),
        weekday: d.toLocaleDateString([], { weekday: "short" }),
        dayNum: d.getDate(),
        monthStr: d.toLocaleDateString([], { month: "short" }),
        isToday: off === 0,
      };
    });
  }, []);

  // Distinct competitions list for modal search
  const visibleCompetitions = useMemo(() => {
    const list = [...new Set(state.matches.map((m) => m.competition).filter(Boolean))];
    list.sort();
    if (!leagueSearch.trim()) return list;
    const q = leagueSearch.trim().toLowerCase();
    return list.filter((name) => name.toLowerCase().includes(q));
  }, [state.matches, leagueSearch]);

  // -------------------------------------------------------------
  // RENDER HEADER COMPONENTS
  // -------------------------------------------------------------

  const header = (
    <View>
      {/* 1. TOP BRAND & ACCOUNT BAR */}
      <View style={[s.topbar, { borderBottomColor: colors.border2 }]}>
        <View>
          <Text style={[s.brand, { color: colors.text }]}>
            <Text style={[s.brandMst, { color: colors.red }]}>MST</Text> Score
          </Text>
          <Text style={[s.tagline, { color: colors.muted }]}>
            {my ? "တိုက်ရိုက်ဘောလုံး · MYANMAR SPORTS TALK" : "LIVE FOOTBALL · MYANMAR SPORTS TALK"}
          </Text>
        </View>
        <View style={s.topActions}>
          {liveCount > 0 ? (
            <Pressable
              style={[s.liveChip, { backgroundColor: colors.redSoft }]}
              onPress={() => setMainTab("LIVE")}
            >
              <View style={[s.liveChipDot, { backgroundColor: colors.red }]} />
              <Text style={[s.liveChipText, { color: colors.red }]}>{liveCount} LIVE</Text>
            </Pressable>
          ) : null}
          <Pressable hitSlop={8} style={s.iconButton} onPress={openNotifications}>
            <Ionicons name="notifications-outline" size={23} color={colors.text} />
          </Pressable>
          <Pressable hitSlop={8} style={s.avatarHeaderBtn} onPress={openAccount}>
            {currentUser?.avatar ? (
              <Image source={{ uri: currentUser.avatar }} style={s.headerAvatarImg} />
            ) : currentUser ? (
              <View style={[s.headerAvatarInitials, { backgroundColor: colors.redSoft }]}>
                <Text style={[s.headerInitialsText, { color: colors.red }]}>
                  {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : "M"}
                </Text>
              </View>
            ) : (
              <View style={[s.headerAvatarPlaceholder, { backgroundColor: colors.panel }]}>
                <Ionicons name="person-circle-outline" size={26} color={colors.text} />
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* 2. PROMINENT SEARCH BAR ENTRY */}
      <Pressable
        style={[s.searchBarEntry, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={openSearch}
      >
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <Text numberOfLines={1} style={[s.searchBarPlaceholder, { color: colors.muted }]}>
          {my ? "အသင်း၊ ပြိုင်ပွဲ၊ နိုင်ငံ၊ ကစားသမား ရှာရန်…" : "Search clubs, leagues, nations, players…"}
        </Text>
        <View style={[s.searchShortcutBadge, { backgroundColor: colors.panel, borderColor: colors.border2 }]}>
          <Text style={[s.searchShortcutText, { color: colors.muted }]}>SEARCH</Text>
        </View>
      </Pressable>

      {/* 3. COMPACT PREDICTION HERO */}
      <Pressable
        style={[s.predictionBanner, { backgroundColor: colors.card, borderColor: colors.red }]}
        onPress={openPredictions}
      >
        <View style={s.predHeaderRow}>
          <View style={[s.predBadge, { backgroundColor: colors.red }]}>
            <Ionicons name="trophy" size={11} color="#FFFFFF" />
            <Text style={s.predBadgeText}>{my ? "အခမဲ့ ခန့်မှန်းပြိုင်ပွဲ" : "FREE PREDICTIONS"}</Text>
          </View>
          <Pressable
            hitSlop={6}
            style={[s.predLeaderboardLink, { backgroundColor: colors.panel, borderColor: colors.border2 }]}
            onPress={openPredictions}
          >
            <Ionicons name="podium-outline" size={12} color={colors.gold} />
            <Text style={[s.predLeaderboardText, { color: colors.gold }]}>
              {my ? "Leaderboard" : "Leaderboard"}
            </Text>
          </Pressable>
        </View>
        <View style={s.predContent}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[s.predTitle, { color: colors.text }]}>
              {my ? "ပွဲစဉ်ရလဒ် အတိအကျ ခန့်မှန်းပါ" : "Predict Exact Scores & Win Points"}
            </Text>
            <Text numberOfLines={1} style={[s.predSub, { color: colors.muted }]}>
              {my ? "ရလဒ်မှန် ၃ မှတ် · အပတ်စဉ် & ရာသီအလိုက် ဆုများ" : "3 PTS exact hit · Weekly & Season Leaderboards"}
            </Text>
          </View>
          <View style={[s.predBtn, { backgroundColor: colors.red }]}>
            <Text style={s.predBtnText}>{my ? "ခန့်မှန်းမည်" : "PREDICT"}</Text>
            <Ionicons name="arrow-forward" size={11} color="#FFFFFF" />
          </View>
        </View>
      </Pressable>

      {/* 4. DATE NAVIGATION: STEPPER + SCROLLER + CALENDAR */}
      <View style={s.dateNavContainer}>
        <View style={s.dateStepperRow}>
          <Pressable
            style={[s.dateStepBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setOffset((v) => v - 1)}
          >
            <Ionicons name="chevron-back" size={15} color={colors.text2} />
            <Text style={[s.dateStepLabel, { color: colors.text2 }]}>{my ? "မနေ့က" : "Yesterday"}</Text>
          </Pressable>

          <Pressable
            style={[
              s.dateTodayBtn,
              {
                backgroundColor: offset === 0 ? colors.red : colors.card,
                borderColor: offset === 0 ? colors.red : colors.border,
              },
            ]}
            onPress={() => setOffset(0)}
          >
            <Text style={[s.dateTodayLabel, { color: offset === 0 ? "#FFFFFF" : colors.text }]}>
              {offset === 0 ? (my ? "ယနေ့ (TODAY)" : "TODAY") : date}
            </Text>
          </Pressable>

          <Pressable
            style={[s.dateStepBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setOffset((v) => v + 1)}
          >
            <Text style={[s.dateStepLabel, { color: colors.text2 }]}>{my ? "မနက်ဖြန်" : "Tomorrow"}</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.text2} />
          </Pressable>

          <Pressable
            style={[s.dateCalendarBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setCalendarOpen(true)}
            hitSlop={4}
          >
            <Ionicons name="calendar" size={17} color={colors.red} />
          </Pressable>
        </View>

        {/* Horizontal 15-Day Date Strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateStripContent}>
          {DATE_OFFSETS.map((x) => {
            const d = dayMeta(x, language);
            const on = offset === x;
            return (
              <Pressable
                key={x}
                style={[
                  s.dateTab,
                  {
                    backgroundColor: on ? colors.redSoft : colors.card,
                    borderColor: on ? colors.red : colors.border2,
                  },
                ]}
                onPress={() => setOffset(x)}
              >
                <Text style={[s.dateMonth, { color: on ? colors.red : colors.muted }]}>{d.month}</Text>
                <Text style={[s.dateNum, { color: on ? colors.red : colors.text }]}>{d.num}</Text>
                <Text style={[s.dateDay, { color: on ? colors.red : colors.muted }]}>{d.day}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 5. PRIMARY MAIN NAVIGATION TABS (FOR YOU | LIVE | TOP | ALL) */}
      <View style={[s.mainNavStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {MAIN_TABS.map((tabKey) => {
          const active = mainTab === tabKey;
          let label = tabKey;
          if (tabKey === "FOR_YOU") label = my ? "သင့်အတွက်" : "FOR YOU";
          else if (tabKey === "LIVE") label = my ? "တိုက်ရိုက်" : "LIVE";
          else if (tabKey === "TOP") label = my ? "TOP ပွဲများ" : "TOP";
          else if (tabKey === "ALL") label = my ? "အားလုံး" : "ALL";

          return (
            <Pressable
              key={tabKey}
              style={[
                s.mainNavTab,
                active && [s.mainNavTabActive, { backgroundColor: colors.red }],
              ]}
              onPress={() => setMainTab(tabKey)}
            >
              <Text
                style={[
                  s.mainNavText,
                  { color: active ? "#FFFFFF" : colors.text2 },
                  active && { fontWeight: "900" },
                ]}
              >
                {label}
              </Text>
              {tabKey === "LIVE" && liveCount > 0 ? (
                <View style={[s.tabLiveDot, { backgroundColor: active ? "#FFFFFF" : colors.red }]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* 6. FOR YOU: CTA TO SET FAVORITES IF USER HAS NONE */}
      {mainTab === "FOR_YOU" && !hasFavorites ? (
        <Pressable
          style={[s.favPromptCard, { backgroundColor: colors.panel, borderColor: colors.border }]}
          onPress={() => openFavorites?.()}
        >
          <View style={[s.favPromptIconWrap, { backgroundColor: colors.redSoft }]}>
            <Ionicons name="star" size={16} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.favPromptTitle, { color: colors.text }]}>
              {my ? "အကြိုက်ဆုံး အသင်းနှင့် ပြိုင်ပွဲများ ရွေးပါ" : "Personalize: Choose Favorite Teams"}
            </Text>
            <Text style={[s.favPromptSub, { color: colors.muted }]}>
              {my ? "သင့်အကြိုက်ဆုံး ပွဲများကို ထိပ်ဆုံးတွင် အမြဲတွေ့မြင်ရပါမည်" : "Rank your favorite clubs & leagues at the very top"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      ) : null}

      {/* 7. ALL TAB SUB-FILTERS (Gender/Youth + Status + League Selector) */}
      {mainTab === "ALL" ? (
        <View style={[s.allFiltersContainer, { backgroundColor: colors.panel, borderColor: colors.border2 }]}>
          {/* Match Category Filter (Men / Women / Youth) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.subFilterRow}>
            {[
              ["ALL", my ? "အမျိုးအစားအားလုံး" : "All Types"],
              ["MEN", my ? "အမျိုးသား" : "Men"],
              ["WOMEN", my ? "အမျိုးသမီး" : "Women"],
              ["YOUTH", my ? "လူငယ် / U19" : "Youth / U19"],
            ].map(([val, txt]) => {
              const on = allTypeFilter === val;
              return (
                <Pressable
                  key={val}
                  style={[
                    s.subFilterChip,
                    {
                      backgroundColor: on ? colors.red : colors.card,
                      borderColor: on ? colors.red : colors.border2,
                    },
                  ]}
                  onPress={() => setAllTypeFilter(val)}
                >
                  <Text style={[s.subFilterText, { color: on ? "#FFFFFF" : colors.text2 }]}>{txt}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Match Status Sub-Filter (All / Live / Upcoming / Finished) + Competition Selector */}
          <View style={s.subFilterBottomRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {[
                ["ALL", my ? "အားလုံး" : "All"],
                ["LIVE", my ? "တိုက်ရိုက်" : "Live"],
                ["UPCOMING", my ? "လာမည့်ပွဲ" : "Upcoming"],
                ["FINISHED", my ? "ပြီးဆုံး" : "Finished"],
              ].map(([val, txt]) => {
                const on = allStatusFilter === val;
                return (
                  <Pressable
                    key={val}
                    style={[
                      s.statusChip,
                      {
                        backgroundColor: on ? colors.redSoft : colors.card,
                        borderColor: on ? colors.red : colors.border2,
                      },
                    ]}
                    onPress={() => setAllStatusFilter(val)}
                  >
                    <Text
                      style={[
                        s.statusChipText,
                        { color: on ? colors.red : colors.muted },
                        on && { fontWeight: "900" },
                      ]}
                    >
                      {txt}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                style={[
                  s.statusChip,
                  {
                    backgroundColor: competitionFilter !== "ALL" ? colors.redSoft : colors.card,
                    borderColor: competitionFilter !== "ALL" ? colors.red : colors.border2,
                  },
                ]}
                onPress={() => setLeagueModalOpen(true)}
              >
                <Ionicons
                  name="trophy-outline"
                  size={12}
                  color={competitionFilter !== "ALL" ? colors.red : colors.muted}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    s.statusChipText,
                    { color: competitionFilter !== "ALL" ? colors.red : colors.muted },
                  ]}
                >
                  {competitionFilter === "ALL" ? (my ? "ပြိုင်ပွဲများ" : "Leagues") : competitionFilter}
                </Text>
                <Ionicons name="chevron-down" size={11} color={colors.muted} />
              </Pressable>
            </ScrollView>

            {/* Quick Expand / Collapse All */}
            <View style={s.accordionActionRow}>
              <Pressable
                hitSlop={4}
                onPress={() => expandAllCompetitions(allSections.map((s) => s.title))}
              >
                <Text style={[s.accordionActionText, { color: colors.red }]}>
                  {my ? "အားလုံးဖွင့်" : "Expand All"}
                </Text>
              </Pressable>
              <Text style={{ color: colors.muted2 }}>|</Text>
              <Pressable hitSlop={4} onPress={collapseAllCompetitions}>
                <Text style={[s.accordionActionText, { color: colors.muted }]}>
                  {my ? "အားလုံးပိတ်" : "Collapse"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* 8. LIST SUMMARY HEADER */}
      <View style={s.listSummary}>
        <Text style={[s.listSummaryTitle, { color: colors.text }]}>
          {mainTab === "FOR_YOU"
            ? my
              ? "သင့်အတွက် ရွေးချယ်ထားသော ပွဲစဉ်များ"
              : "TOP PICKS FOR YOU"
            : mainTab === "LIVE"
            ? my
              ? "ယခုတိုက်ရိုက်ကစားနေသော ပွဲများ"
              : "CURRENT LIVE FIXTURES"
            : mainTab === "TOP"
            ? my
              ? "ယနေ့ အဓိက ထိပ်တန်းပွဲစဉ်များ"
              : "FEATURED TOP FIXTURES"
            : competitionFilter !== "ALL"
            ? competitionFilter
            : my
            ? "ပြိုင်ပွဲအားလုံးအလိုက် ပွဲစဉ်များ"
            : "ALL FIXTURES BY COMPETITION"}
        </Text>
        <View style={s.summaryRight}>
          {state.loading ? <ActivityIndicator size="small" color={colors.red} /> : null}
          <Text style={[s.matchCount, { color: colors.muted }]}>
            {mainTab === "FOR_YOU"
              ? `${forYouMatches.length} ${my ? "ပွဲ" : "matches"}`
              : mainTab === "LIVE"
              ? `${liveMatches.length} ${my ? "ပွဲ" : "live"}`
              : mainTab === "TOP"
              ? `${topMatches.length} ${my ? "ပွဲ" : "matches"}`
              : `${allFilteredMatches.length} ${my ? "ပွဲ" : "matches"}`}
          </Text>
        </View>
      </View>

      {/* Error Strip if data fetch failed */}
      {state.error ? (
        <Pressable
          style={[s.errorStrip, { backgroundColor: colors.redSoft, borderColor: colors.red }]}
          onPress={() => load(true, false)}
        >
          <Ionicons name="refresh-outline" size={15} color={colors.red} />
          <Text style={[s.errorText, { color: colors.red }]}>
            {my ? "ရလဒ် update နှေးနေသည် · ပြန်စမ်းရန်နှိပ်ပါ" : "Scores delayed · tap to retry"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  // -------------------------------------------------------------
  // SECTION RENDERER
  // -------------------------------------------------------------

  const renderSectionHeader = ({ section }) => {
    if (section.isSimple) return null;

    const isExpanded = section.isExpanded;
    return (
      <Pressable
        style={[s.leagueHeader, { backgroundColor: colors.panel, borderBottomColor: colors.border2 }]}
        onPress={() => toggleCompetitionExpand(section.title)}
      >
        <LeagueLogo uri={section.logo} colors={colors} />
        <View style={s.leagueTextWrap}>
          <Text numberOfLines={1} style={[s.leagueTitle, { color: colors.text }]}>
            {section.title}
          </Text>
          {section.country ? (
            <Text numberOfLines={1} style={[s.leagueCountry, { color: colors.muted }]}>
              {section.country}
            </Text>
          ) : null}
        </View>
        <View style={[s.countBadge, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
          <Text style={[s.leagueCount, { color: colors.text2 }]}>{section.totalCount}</Text>
        </View>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={isExpanded ? colors.red : colors.muted}
        />
      </Pressable>
    );
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.bg }]}>
      <SectionList
        sections={activeSections}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <MatchRow match={item} onOpen={openMatch} language={language} colors={colors} />
        )}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !state.loading ? (
            <View style={s.empty}>
              <Ionicons
                name={mainTab === "LIVE" ? "radio-outline" : "football-outline"}
                size={32}
                color={colors.muted}
              />
              <Text style={[s.emptyTitle, { color: colors.text }]}>
                {mainTab === "LIVE"
                  ? my
                    ? "ယခုအချိန်တွင် တိုက်ရိုက်ပွဲများ မရှိသေးပါ"
                    : "No Live Matches Right Now"
                  : my
                  ? "ပွဲစဉ်များ မရှိသေးပါ"
                  : "No Matches Found"}
              </Text>
              <Text style={[s.emptyText, { color: colors.muted }]}>
                {mainTab === "LIVE"
                  ? my
                    ? "ယနေ့ လာမည့်ပွဲစဉ်များကို စောင့်ကြည့်ပါ သို့မဟုတ် အခြားရက်ကို ရွေးချယ်ပါ"
                    : "Check today's upcoming matches or select another date"
                  : my
                  ? "အခြားရက် သို့မဟုတ် filter ကို စမ်းကြည့်ပါ။"
                  : "Try selecting another date or adjusting your filters."}
              </Text>
              <Pressable
                style={[s.retryBtn, { backgroundColor: colors.redSoft, borderColor: colors.red }]}
                onPress={() => load(true, false)}
              >
                <Ionicons name="refresh" size={14} color={colors.red} />
                <Text style={[s.retryBtnText, { color: colors.red }]}>{my ? "ပြန်လည်စစ်ဆေးမည်" : "Refresh"}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.empty}>
              <ActivityIndicator color={colors.red} size="large" />
              <Text style={[s.emptyText, { color: colors.muted, marginTop: 12 }]}>
                {my ? "ပွဲများ update လုပ်နေသည်…" : "Updating match fixtures…"}
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={() => load(true, true)}
            colors={[colors.red]}
            tintColor={colors.red}
          />
        }
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        initialNumToRender={14}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={20}
        windowSize={7}
        removeClippedSubviews
      />

      {/* 9. FULL 29-DAY INTERACTIVE CALENDAR MODAL */}
      <Modal visible={calendarOpen} transparent animationType="slide" onRequestClose={() => setCalendarOpen(false)}>
        <View style={s.modalBackdrop}>
          <Pressable style={s.modalDismiss} onPress={() => setCalendarOpen(false)} />
          <View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[s.sheetHandle, { backgroundColor: colors.border2 }]} />
            <View style={[s.sheetHead, { borderBottomColor: colors.border2 }]}>
              <View>
                <Text style={[s.sheetTitle, { color: colors.text }]}>
                  {my ? "ရက်စွဲရွေးရန်" : "Choose Match Date"}
                </Text>
                <Text style={[s.sheetSub, { color: colors.muted }]}>
                  {my ? "ပွဲစဉ်များကြည့်လိုသော နေ့ရက်ကို တိုက်ရိုက်ရွေးပါ" : "Jump directly to fixtures on any date"}
                </Text>
              </View>
              <Pressable style={s.closeBtn} onPress={() => setCalendarOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            {/* Quick Navigation Stepper */}
            <View style={s.calendarControls}>
              <Pressable
                style={[s.calendarStepBtn, { backgroundColor: colors.panel, borderColor: colors.border2 }]}
                onPress={() => setOffset((v) => v - 1)}
              >
                <Ionicons name="chevron-back" size={16} color={colors.text} />
                <Text style={[s.calendarStepText, { color: colors.text }]}>{my ? "ယခင်ရက်" : "Prev Day"}</Text>
              </Pressable>
              <Pressable
                style={[
                  s.calendarTodayBtn,
                  { backgroundColor: offset === 0 ? colors.red : colors.panel, borderColor: colors.border },
                ]}
                onPress={() => {
                  setOffset(0);
                  setCalendarOpen(false);
                }}
              >
                <Text style={[s.calendarTodayText, { color: offset === 0 ? "#FFFFFF" : colors.text }]}>
                  {my ? "ယနေ့ (TODAY)" : "TODAY"}
                </Text>
              </Pressable>
              <Pressable
                style={[s.calendarStepBtn, { backgroundColor: colors.panel, borderColor: colors.border2 }]}
                onPress={() => setOffset((v) => v + 1)}
              >
                <Text style={[s.calendarStepText, { color: colors.text }]}>{my ? "နောက်ရက်" : "Next Day"}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.text} />
              </Pressable>
            </View>

            {/* Full 29-Day Calendar Grid */}
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={s.calendarGrid}>
                {calendarDates.map((item) => {
                  const on = offset === item.offset;
                  return (
                    <Pressable
                      key={item.dateStr}
                      style={[
                        s.calendarDayCard,
                        {
                          backgroundColor: on ? colors.redSoft : colors.panel,
                          borderColor: on ? colors.red : colors.border2,
                        },
                      ]}
                      onPress={() => {
                        setOffset(item.offset);
                        setCalendarOpen(false);
                      }}
                    >
                      <Text style={[s.calendarDayWeekday, { color: on ? colors.red : colors.muted }]}>
                        {item.weekday}
                      </Text>
                      <Text style={[s.calendarDayNum, { color: on ? colors.red : colors.text }]}>
                        {item.dayNum}
                      </Text>
                      <Text style={[s.calendarDayMonth, { color: on ? colors.red : colors.muted }]}>
                        {item.monthStr}
                      </Text>
                      {item.isToday ? (
                        <View style={[s.todayDot, { backgroundColor: colors.red }]} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 10. COMPETITION FILTER MODAL */}
      <Modal visible={leagueModalOpen} transparent animationType="slide" onRequestClose={() => setLeagueModalOpen(false)}>
        <View style={s.modalBackdrop}>
          <Pressable style={s.modalDismiss} onPress={() => setLeagueModalOpen(false)} />
          <View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[s.sheetHandle, { backgroundColor: colors.border2 }]} />
            <View style={[s.sheetHead, { borderBottomColor: colors.border2 }]}>
              <View>
                <Text style={[s.sheetTitle, { color: colors.text }]}>
                  {my ? "ပြိုင်ပွဲရွေးရန်" : "Filter by Competition"}
                </Text>
                <Text style={[s.sheetSub, { color: colors.muted }]}>
                  {my ? "ပွဲများကို ပြိုင်ပွဲအလိုက် စစ်ထုတ်ပါ" : "Select a competition to view only its fixtures"}
                </Text>
              </View>
              <Pressable style={s.closeBtn} onPress={() => setLeagueModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <View style={[s.searchBox, { backgroundColor: colors.panel, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={17} color={colors.muted} />
              <TextInput
                value={leagueSearch}
                onChangeText={setLeagueSearch}
                placeholder={my ? "ပြိုင်ပွဲရှာရန်" : "Search competitions"}
                placeholderTextColor={colors.muted2}
                style={[s.searchInput, { color: colors.text }]}
              />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              <Pressable
                style={[
                  s.leagueChoice,
                  { borderBottomColor: colors.border2 },
                  competitionFilter === "ALL" && { backgroundColor: colors.redSoft },
                ]}
                onPress={() => {
                  setCompetitionFilter("ALL");
                  setLeagueModalOpen(false);
                }}
              >
                <Ionicons
                  name="apps-outline"
                  size={19}
                  color={competitionFilter === "ALL" ? colors.red : colors.text2}
                />
                <Text
                  style={[
                    s.leagueChoiceText,
                    { color: competitionFilter === "ALL" ? colors.red : colors.text },
                  ]}
                >
                  {my ? "ပြိုင်ပွဲအားလုံး" : "All Competitions"}
                </Text>
                {competitionFilter === "ALL" ? <Ionicons name="checkmark" size={18} color={colors.red} /> : null}
              </Pressable>
              {visibleCompetitions.map((name) => (
                <Pressable
                  key={name}
                  style={[
                    s.leagueChoice,
                    { borderBottomColor: colors.border2 },
                    competitionFilter === name && { backgroundColor: colors.redSoft },
                  ]}
                  onPress={() => {
                    setCompetitionFilter(name);
                    setLeagueModalOpen(false);
                  }}
                >
                  <Ionicons
                    name="trophy-outline"
                    size={19}
                    color={competitionFilter === name ? colors.red : colors.text2}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      s.leagueChoiceText,
                      { color: competitionFilter === name ? colors.red : colors.text },
                    ]}
                  >
                    {name}
                  </Text>
                  {competitionFilter === name ? <Ionicons name="checkmark" size={18} color={colors.red} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// -------------------------------------------------------------
// STYLES
// -------------------------------------------------------------

const s = StyleSheet.create({
  screen: { flex: 1 },
  listContent: { paddingBottom: 48 },

  // Top bar
  topbar: {
    minHeight: 56,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  brand: { fontSize: 21, fontWeight: "900", letterSpacing: -0.5 },
  brandMst: { fontWeight: "900" },
  tagline: { fontSize: 8.5, fontWeight: "700", letterSpacing: 0.6, marginTop: 1 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  liveChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  liveChipDot: { width: 7, height: 7, borderRadius: 3.5 },
  liveChipText: { fontSize: 10, fontWeight: "900" },
  iconButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  avatarHeaderBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  headerAvatarInitials: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  headerInitialsText: { fontSize: 12, fontWeight: "900" },
  headerAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  // Search Bar
  searchBarEntry: {
    marginHorizontal: 12,
    marginTop: 8,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchBarPlaceholder: { flex: 1, fontSize: 11.5, fontWeight: "600" },
  searchShortcutBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  searchShortcutText: { fontSize: 8, fontWeight: "900" },

  // Prediction Hero
  predictionBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 13,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  predHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  predBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 6 },
  predBadgeText: { color: "#FFFFFF", fontSize: 8.5, fontWeight: "900" },
  predLeaderboardLink: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 6, borderWidth: 1 },
  predLeaderboardText: { fontSize: 8.5, fontWeight: "800" },
  predContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  predTitle: { fontSize: 12, fontWeight: "900" },
  predSub: { fontSize: 9.5, marginTop: 1 },
  predBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 },
  predBtnText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },

  // Date Navigation
  dateNavContainer: { marginTop: 8 },
  dateStepperRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 },
  dateStepBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  dateStepLabel: { fontSize: 10, fontWeight: "700" },
  dateTodayBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  dateTodayLabel: { fontSize: 10.5, fontWeight: "900" },
  dateCalendarBtn: { width: 34, height: 30, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dateStripContent: { paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  dateTab: { width: 48, height: 54, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 1 },
  dateMonth: { fontSize: 8, fontWeight: "800" },
  dateNum: { fontSize: 15, fontWeight: "900", fontVariant: ["tabular-nums"] },
  dateDay: { fontSize: 8, fontWeight: "700" },

  // Primary Tabs
  mainNavStrip: {
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    padding: 3,
    gap: 3,
  },
  mainNavTab: {
    flex: 1,
    minHeight: 34,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  mainNavTabActive: {},
  mainNavText: { fontSize: 11, fontWeight: "700" },
  tabLiveDot: { width: 5, height: 5, borderRadius: 2.5 },

  // Favorite prompt
  favPromptCard: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  favPromptIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  favPromptTitle: { fontSize: 11.5, fontWeight: "800" },
  favPromptSub: { fontSize: 9.5, marginTop: 1 },

  // All Filters
  allFiltersContainer: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 11,
    borderWidth: 1,
    padding: 8,
    gap: 6,
  },
  subFilterRow: { gap: 6 },
  subFilterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  subFilterText: { fontSize: 10, fontWeight: "800" },
  subFilterBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, paddingTop: 4 },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4.5, borderRadius: 8, borderWidth: 1 },
  statusChipText: { fontSize: 9.5, fontWeight: "700" },
  accordionActionRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 4 },
  accordionActionText: { fontSize: 9.5, fontWeight: "800" },

  // Summary
  listSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  listSummaryTitle: { fontSize: 11.5, fontWeight: "900", letterSpacing: 0.2 },
  summaryRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  matchCount: { fontSize: 10.5, fontWeight: "700" },

  // Error Strip
  errorStrip: { marginHorizontal: 12, marginVertical: 4, padding: 8, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  errorText: { fontSize: 10.5, fontWeight: "800" },

  // League Section Header
  leagueHeader: {
    minHeight: 38,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    gap: 8,
    marginTop: 6,
  },
  leagueLogo: { width: 17, height: 17 },
  leagueLogoFallback: { width: 17, height: 17, borderRadius: 8.5, alignItems: "center", justifyContent: "center" },
  leagueTextWrap: { flex: 1, minWidth: 0 },
  leagueTitle: { fontSize: 11.5, fontWeight: "900" },
  leagueCountry: { fontSize: 8.5, fontWeight: "600", marginTop: 1 },
  countBadge: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, borderWidth: 1 },
  leagueCount: { fontSize: 9, fontWeight: "800" },

  // Match Row (Compact & High-Density)
  matchRow: {
    minHeight: 56,
    marginHorizontal: 10,
    marginVertical: 2.5,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeCol: { width: 44, alignItems: "center", justifyContent: "center" },
  timeText: { fontSize: 10.5, fontWeight: "800", fontVariant: ["tabular-nums"] },
  liveBadgePill: { paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4, marginTop: 2 },
  liveBadgeText: { color: "#FFFFFF", fontSize: 7.5, fontWeight: "900" },
  subStatusText: { fontSize: 7.5, fontWeight: "800", marginTop: 1 },
  matchDivider: { width: 1, height: 32 },
  fixtureCol: { flex: 1, gap: 3, minWidth: 0 },
  teamLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  teamLogo: { width: 18, height: 18 },
  logoFallback: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 0.5 },
  logoFallbackText: { fontSize: 7.5, fontWeight: "900" },
  teamName: { flex: 1, fontSize: 11.5, fontWeight: "800" },
  score: { fontSize: 13, fontWeight: "900", fontVariant: ["tabular-nums"], minWidth: 14, textAlign: "right" },
  chevron: { marginLeft: 2 },

  // Empty State
  empty: { padding: 36, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 14.5, fontWeight: "900" },
  emptyText: { fontSize: 11, textAlign: "center", maxWidth: 280 },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, marginTop: 6 },
  retryBtnText: { fontSize: 11, fontWeight: "800" },

  // Modal Sheets
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  modalDismiss: { flex: 1 },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16, paddingBottom: 28, maxHeight: "80%" },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 10, borderBottomWidth: 1 },
  sheetTitle: { fontSize: 15, fontWeight: "900" },
  sheetSub: { fontSize: 10.5, marginTop: 2 },
  closeBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, height: 40, borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, marginVertical: 10 },
  searchInput: { flex: 1, fontSize: 11.5, fontWeight: "600" },
  leagueChoice: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, borderBottomWidth: 1 },
  leagueChoiceText: { flex: 1, fontSize: 12, fontWeight: "700" },
  calendarControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 10, gap: 8 },
  calendarStepBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  calendarStepText: { fontSize: 10, fontWeight: "800" },
  calendarTodayBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  calendarTodayText: { fontSize: 10.5, fontWeight: "900" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6, paddingVertical: 4 },
  calendarDayCard: { width: "23%", height: 64, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 1.5 },
  calendarDayWeekday: { fontSize: 8, fontWeight: "800" },
  calendarDayNum: { fontSize: 15, fontWeight: "900", fontVariant: ["tabular-nums"] },
  calendarDayMonth: { fontSize: 7.5, fontWeight: "700" },
  todayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
});