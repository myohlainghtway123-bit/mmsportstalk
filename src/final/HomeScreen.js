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
  prefetchRecentPastMatches,
} from "../services/fastFootballApi";
import { regionalNationalTeamPriority } from "../services/regionalFootball";
import {
  extractUser,
  getAuthStatus,
  getFavorites,
  getProfile,
  normalizeAvatarUrl,
  normalizeFavoritePayload,
} from "../services/accountApi";
import { loadOnboardingPreferences } from "../services/onboardingStore";

import {
  calculateFactualMatchPriority,
  getFactualCompetitionKey,
  getFactualCompetitionWeight,
  isFactualWomenMatch,
  isFactualYouthMatch,
  isPremierLeagueEngland,
} from "../services/footballClassification";

function kickoffTime(match) {
  const t = match?.kickoff ? new Date(match.kickoff).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function importantMatchSort(a, b, favorites = {}) {
  // 1. Live status first
  const aLive = isLiveMatch(a), bLive = isLiveMatch(b);
  if (aLive !== bLive) return aLive ? -1 : 1;

  // 2. Priority score (Big matches, favorites, regional, top leagues)
  const aScore = calculateFactualMatchPriority(a, favorites, regionalNationalTeamPriority);
  const bScore = calculateFactualMatchPriority(b, favorites, regionalNationalTeamPriority);
  if (aScore !== bScore) return bScore - aScore;

  // 3. Kickoff chronological order
  return kickoffTime(a) - kickoffTime(b);
}

function bangkokDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  } catch (_) {
    return d.toISOString().slice(0, 10);
  }
}

function dayMeta(offsetDays, language) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const isToday = offsetDays === 0;
  return {
    num: d.getDate(),
    day: isToday
      ? language === "my" ? "ယနေ့" : "TODAY"
      : d.toLocaleDateString([], { weekday: "short" }).toUpperCase(),
    month: d.toLocaleDateString([], { month: "short" }).toUpperCase(),
    isToday,
  };
}

function isUpcoming(match) {
  const status = String(match?.statusCode ?? match?.status ?? "").toUpperCase();
  return ["NS", "TBD", "SCHEDULED", "NOT_STARTED", "UPCOMING"].includes(status) && !isLiveMatch(match);
}

function isFinished(match) {
  const status = String(match?.statusCode ?? match?.status ?? "").toUpperCase();
  return ["FT", "AET", "PEN", "FINISHED", "AOT"].includes(status);
}

// -------------------------------------------------------------
// COMPACT SUB-COMPONENTS
// -------------------------------------------------------------

const TeamLogo = memo(function TeamLogo({ uri, name, colors }) {
  const [err, setErr] = useState(false);
  if (!uri || err) {
    const letter = (name || "?").trim().slice(0, 1).toUpperCase();
    return (
      <View style={[s.logoFallback, { backgroundColor: colors.panel, borderColor: colors.border2 }]}>
        <Text style={[s.logoFallbackText, { color: colors.muted }]}>{letter}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={s.teamLogo}
      resizeMode="contain"
      onError={() => setErr(true)}
    />
  );
});

const LeagueLogo = memo(function LeagueLogo({ uri, colors }) {
  const [err, setErr] = useState(false);
  if (!uri || err) {
    return (
      <View style={[s.leagueLogoFallback, { backgroundColor: colors.redSoft }]}>
        <Ionicons name="trophy-outline" size={11} color={colors.red} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={s.leagueLogo}
      resizeMode="contain"
      onError={() => setErr(true)}
    />
  );
});

const MatchRow = memo(function MatchRow({ match, onOpen, colors, language }) {
  const live = isLiveMatch(match);
  const statusUpper = String(match?.statusCode ?? match?.status ?? "").toUpperCase();
  const finished = isFinished(match);
  const isPostponed = ["PST", "POSTPONED", "CANC", "CANCELLED", "ABAN", "ABANDONED"].includes(statusUpper);

  let label = match?.time || "";
  if (!label) {
    if (match?.kickoff) {
      try {
        const d = new Date(match.kickoff);
        label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
      } catch (_) {
        label = match?.status || "—";
      }
    } else {
      label = match?.status || "—";
    }
  }
  if (live && match?.minute) {
    label = `${match.minute}'`;
  } else if (live) {
    label = "LIVE";
  }

  return (
    <Pressable
      style={[
        s.matchRow,
        {
          backgroundColor: colors.card,
          borderColor: live ? colors.red : colors.border,
        },
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
  const [typeFilter, setTypeFilter] = useState("ALL"); // ALL | LIVE | MEN | WOMEN | YOUTH
  const [competitionFilter, setCompetitionFilter] = useState("ALL");

  // Modals & UI
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [leagueSearchModalOpen, setLeagueSearchModalOpen] = useState(false);
  const [leagueSearch, setLeagueSearch] = useState("");
  const [expandedLeagues, setExpandedLeagues] = useState(() => new Set());
  const dateStripRef = useRef(null);

  // User & Favorites
  const [currentUser, setCurrentUser] = useState(null);
  const [favorites, setFavorites] = useState({ teamIds: [], compIds: [], teamNames: [], compNames: [] });
  const [hasFavorites, setHasFavorites] = useState(false);

  const date = useMemo(() => bangkokDate(offset), [offset]);

  // Center active date tab in strip
  useEffect(() => {
    const index = offset + 7;
    const targetX = Math.max(0, index * 52 - 90);
    const t = setTimeout(() => {
      dateStripRef.current?.scrollTo({ x: targetX, animated: true });
    }, 100);
    return () => clearTimeout(t);
  }, [offset]);

  // Data fetching state
  const [state, setState] = useState(() => {
    const cached = peekFastFootballMatches(bangkokDate(0));
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

      // Local onboarding favorites
      const prefs = await loadOnboardingPreferences().catch(() => null);
      if (prefs) {
        teamIds = [...(prefs.teams || [])];
        compIds = [...(prefs.competitions || [])];
      }

      if (auth.authenticated) {
        profile = await getProfile().catch(() => null);
        const parsed = extractUser(profile) || extractUser(auth.user) || extractUser(auth.payload);
        if (parsed) {
          setCurrentUser({
            name: parsed.name || parsed.displayName || parsed.email || "MST Fan",
            avatar: parsed.avatar || parsed.avatarUrl || null,
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

  // Date Change Hook
  useEffect(() => {
    setCompetitionFilter("ALL");
    const saved = peekFastFootballMatches(date);
    setState({ loading: !saved, refreshing: false, error: "", matches: saved?.matches || [] });
    load(false, false);
  }, [date, load]);

  // Background Prefetch adjacent days
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        prefetchFastFootballMatches([bangkokDate(offset - 1), bangkokDate(offset + 1)]);
      } catch (_) {}
    }, 1200);
    return () => clearTimeout(timer);
  }, [offset]);

  // Live match count
  const liveMatchesList = useMemo(() => state.matches.filter(isLiveMatch), [state.matches]);
  const liveCount = liveMatchesList.length;

  // Live polling
  useEffect(() => {
    if (offset !== 0 || liveCount === 0) return;
    const interval = setInterval(() => {
      load(true, false);
    }, 25000);
    return () => clearInterval(interval);
  }, [offset, liveCount, load]);

  // Expand top major leagues by default when matches change
  useEffect(() => {
    if (!state.matches.length) return;
    const map = new Map();
    state.matches.forEach((m) => {
      const comp = m.competition || "Other";
      const score = matchPriorityScore(m, favorites);
      if (!map.has(comp)) map.set(comp, score);
      else map.set(comp, Math.max(map.get(comp), score));
    });
    // Top 5 leagues by priority score
    const topLeagues = [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
    setExpandedLeagues(new Set(topLeagues));
  }, [state.matches, favorites]);

  // Toggle Accordion
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
  // MATCH FILTERING & PRIORITY STRUCTURING
  // -------------------------------------------------------------

  const filteredMatches = useMemo(() => {
    return state.matches.filter((m) => {
      if (typeFilter === "LIVE" && !isLiveMatch(m)) return false;
      if (typeFilter === "MEN" && (isFactualWomenMatch(m) || isFactualYouthMatch(m))) return false;
      if (typeFilter === "WOMEN" && !isFactualWomenMatch(m)) return false;
      if (typeFilter === "YOUTH" && !isFactualYouthMatch(m)) return false;
      if (competitionFilter !== "ALL" && m.competition !== competitionFilter) return false;
      return true;
    });
  }, [state.matches, typeFilter, competitionFilter]);

  // Group into sections with Big Match Priority sorting
  const sections = useMemo(() => {
    const map = new Map();
    for (const match of filteredMatches) {
      const key = getFactualCompetitionKey(match);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(match);
    }

    const rows = [...map.entries()].map(([groupKey, data]) => {
      // Sort matches within each competition by Big Match Priority
      const ordered = [...data].sort((a, b) => importantMatchSort(a, b, favorites));
      // Max match priority in this league
      const maxScore = ordered.reduce(
        (max, m) => Math.max(max, calculateFactualMatchPriority(m, favorites, regionalNationalTeamPriority)),
        0
      );
      const hasLiveInLeague = ordered.some(isLiveMatch);
      const first = ordered[0];

      return {
        groupKey,
        title: first?.competition || groupKey,
        data: ordered,
        logo: first?.competitionLogo,
        country: first?.country,
        priority: maxScore + (hasLiveInLeague ? 100 : 0),
      };
    });

    // Sort competitions: Highest priority / big leagues / leagues with live games first!
    rows.sort(
      (a, b) =>
        b.priority - a.priority ||
        getFactualCompetitionWeight(b.data[0]) - getFactualCompetitionWeight(a.data[0]) ||
        a.title.localeCompare(b.title),
    );

    return rows.map((sec) => ({
      ...sec,
      isExpanded: expandedLeagues.has(sec.title) || expandedLeagues.has(sec.groupKey),
      data: expandedLeagues.has(sec.title) || expandedLeagues.has(sec.groupKey) ? sec.data : [],
      totalCount: sec.data.length,
    }));
  }, [filteredMatches, favorites, expandedLeagues]);

  const allLeagueTitles = useMemo(() => {
    return [...new Set(filteredMatches.map((m) => m.competition).filter(Boolean))];
  }, [filteredMatches]);

  // Calendar dates
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
      {/* 1. TOP BRAND & ACTION BAR (Search, Notifications, Avatar) */}
      <View style={[s.topbar, { borderBottomColor: colors.border2 }]}>
        <View style={s.brandWrap}>
          <Text style={[s.brand, { color: colors.text }]}>
            <Text style={[s.brandMst, { color: colors.red }]}>MST</Text> Score
          </Text>
          <Text style={[s.tagline, { color: colors.muted }]}>
            {my ? "တိုက်ရိုက်ဘောလုံး · MYANMAR SPORTS TALK" : "LIVE FOOTBALL · MYANMAR SPORTS TALK"}
          </Text>
        </View>
        <View style={s.topActions}>
          <Pressable hitSlop={8} style={[s.topActionBtn, { backgroundColor: colors.card, borderColor: colors.border2 }]} onPress={openSearch}>
            <Ionicons name="search-outline" size={19} color={colors.text} />
          </Pressable>
          <Pressable hitSlop={8} style={[s.topActionBtn, { backgroundColor: colors.card, borderColor: colors.border2 }]} onPress={openNotifications}>
            <Ionicons name="notifications-outline" size={19} color={colors.text} />
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

      {/* 2. COMPACT PREDICTION HERO */}
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

      {/* 4. CONSOLIDATED SINGLE-ROW DATE BAR (Calendar Button + 15-Day Strip) */}
      <View style={s.singleDateBar}>
        {/* Calendar Picker Button */}
        <Pressable
          style={[s.calendarQuickBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setCalendarOpen(true)}
          hitSlop={4}
        >
          <Ionicons name="calendar" size={17} color={colors.red} />
          <Text style={[s.calendarQuickText, { color: colors.text }]}>{date}</Text>
        </Pressable>

        {/* 15-Day Date Strip */}
        <ScrollView
          ref={dateStripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.dateStripContent}
        >
          {DATE_OFFSETS.map((x) => {
            const d = dayMeta(x, language);
            const on = offset === x;
            return (
              <Pressable
                key={x}
                style={[
                  s.dateTab,
                  {
                    backgroundColor: on ? colors.red : colors.card,
                    borderColor: on ? colors.red : colors.border2,
                  },
                ]}
                onPress={() => setOffset(x)}
              >
                <Text style={[s.dateMonth, { color: on ? "#FFFFFF" : colors.muted }]}>{d.month}</Text>
                <Text style={[s.dateNum, { color: on ? "#FFFFFF" : colors.text }]}>{d.num}</Text>
                <Text style={[s.dateDay, { color: on ? "#FFFFFF" : colors.muted }]}>{d.day}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 5. SLIM MATCH TYPE & ACCORDION ACTION BAR */}
      <View style={s.filterActionBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRowContent}>
          {[
            ["ALL", my ? "အားလုံး" : "All"],
            ["LIVE", liveCount > 0 ? `${my ? "တိုက်ရိုက်" : "Live"} (${liveCount})` : my ? "တိုက်ရိုက်" : "Live"],
            ["MEN", my ? "အမျိုးသား" : "Men"],
            ["WOMEN", my ? "အမျိုးသမီး" : "Women"],
            ["YOUTH", my ? "လူငယ်" : "Youth"],
          ].map(([val, txt]) => {
            const on = typeFilter === val;
            return (
              <Pressable
                key={val}
                style={[
                  s.subFilterChip,
                  {
                    backgroundColor: on ? colors.red : colors.card,
                    borderColor: on ? colors.red : colors.border,
                  },
                ]}
                onPress={() => setTypeFilter(val)}
              >
                {val === "LIVE" && liveCount > 0 ? (
                  <View style={[s.chipLiveDot, { backgroundColor: on ? "#FFFFFF" : colors.red }]} />
                ) : null}
                <Text style={[s.subFilterText, { color: on ? "#FFFFFF" : colors.text2 }]}>{txt}</Text>
              </Pressable>
            );
          })}

          {/* Expand / Collapse Accordion Controls */}
          <Pressable
            style={[s.accordionActionChip, { backgroundColor: colors.card, borderColor: colors.border2 }]}
            onPress={() => expandAllCompetitions(allLeagueTitles)}
          >
            <Text style={[s.accordionActionText, { color: colors.text2 }]}>
              {my ? "အားလုံးဖွင့်" : "Expand All"}
            </Text>
          </Pressable>

          <Pressable
            style={[s.accordionActionChip, { backgroundColor: colors.card, borderColor: colors.border2 }]}
            onPress={collapseAllCompetitions}
          >
            <Text style={[s.accordionActionText, { color: colors.muted }]}>
              {my ? "အားလုံးပိတ်" : "Collapse"}
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* 6. FAVORITE PROMPT CARD (Subtle if no favorites) */}
      {!hasFavorites ? (
        <Pressable
          style={[s.favPromptCard, { backgroundColor: colors.panel, borderColor: colors.border }]}
          onPress={() => openFavorites?.()}
        >
          <View style={[s.favPromptIconWrap, { backgroundColor: colors.redSoft }]}>
            <Ionicons name="star" size={14} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.favPromptTitle, { color: colors.text }]}>
              {my ? "အကြိုက်ဆုံး အသင်းနှင့် ပြိုင်ပွဲများ ရွေးပါ" : "Personalize: Choose Favorite Teams"}
            </Text>
            <Text style={[s.favPromptSub, { color: colors.muted }]}>
              {my ? "သင့်အကြိုက်ဆုံး ပွဲများကို ထိပ်ဆုံးတွင် အမြဲတွေ့မြင်ရပါမည်" : "Rank your favorite clubs & leagues at the very top"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={colors.muted} />
        </Pressable>
      ) : null}

      {/* 7. FEED SUMMARY ROW */}
      <View style={s.listSummary}>
        <Text style={[s.listSummaryTitle, { color: colors.text2 }]}>
          {typeFilter === "LIVE"
            ? (my ? "ယခု တိုက်ရိုက်ပွဲစဉ်များ" : "LIVE FIXTURES NOW")
            : (my ? "ပွဲစဉ်များ (အရေးကြီးပွဲ ဦးစားပေး)" : "MATCH FIXTURES (BIG MATCHES FIRST)")}
        </Text>
        <View style={s.summaryRight}>
          {state.loading ? (
            <ActivityIndicator size="small" color={colors.red} />
          ) : (
            <Text style={[s.matchCount, { color: colors.muted }]}>
              {filteredMatches.length} {my ? "ပွဲ" : "matches"}
            </Text>
          )}
        </View>
      </View>

      {state.error ? (
        <View style={[s.errorStrip, { backgroundColor: colors.redSoft, borderColor: colors.red }]}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.red} />
          <Text style={[s.errorText, { color: colors.red }]}>{state.error}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.bg }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <MatchRow
            match={item}
            onOpen={openMatch}
            colors={colors}
            language={language}
          />
        )}
        renderSectionHeader={({ section }) => {
          const isExp = section.isExpanded;
          return (
            <Pressable
              style={[
                s.leagueHeader,
                {
                  backgroundColor: colors.bg,
                  borderBottomColor: colors.border2,
                },
              ]}
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

              <View
                style={[
                  s.countBadge,
                  {
                    backgroundColor: isExp ? colors.redSoft : colors.card,
                    borderColor: isExp ? colors.red : colors.border2,
                  },
                ]}
              >
                <Text style={[s.leagueCount, { color: isExp ? colors.red : colors.muted }]}>
                  {section.totalCount}
                </Text>
              </View>

              <Ionicons
                name={isExp ? "chevron-up" : "chevron-down"}
                size={14}
                color={isExp ? colors.red : colors.muted}
              />
            </Pressable>
          );
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          state.loading ? (
            <View style={s.empty}>
              <ActivityIndicator size="large" color={colors.red} />
              <Text style={[s.emptyText, { color: colors.muted, marginTop: 12 }]}>
                {my ? "ပွဲစဉ်များ ရယူနေပါသည်…" : "Loading match fixtures…"}
              </Text>
            </View>
          ) : (
            <View style={s.empty}>
              <Ionicons name="football-outline" size={44} color={colors.muted2} />
              <Text style={[s.emptyTitle, { color: colors.text }]}>
                {typeFilter === "LIVE"
                  ? (my ? "ယခု တိုက်ရိုက်ပွဲစဉ် မရှိသေးပါ" : "No live matches right now")
                  : (my ? "ဤရက်စွဲတွင် ပွဲစဉ် မရှိပါ" : "No matches found for this date")}
              </Text>
              <Text style={[s.emptyText, { color: colors.muted }]}>
                {typeFilter === "LIVE"
                  ? (my ? "လာမည့်ပွဲများကို စစ်ဆေးရန် All filter သို့ ပြောင်းပါ" : "Switch to 'All' to see upcoming fixtures")
                  : (my ? "အခြားရက်စွဲတစ်ခုကို ရွေးချယ်ကြည့်ပါ" : "Select another date on the calendar above")}
              </Text>
              <Pressable
                style={[s.retryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => (typeFilter === "LIVE" ? setTypeFilter("ALL") : load(true, false))}
              >
                <Ionicons name="refresh-outline" size={14} color={colors.text} />
                <Text style={[s.retryBtnText, { color: colors.text }]}>
                  {typeFilter === "LIVE" ? (my ? "ပွဲစဉ်အားလုံးကြည့်မည်" : "View All Matches") : (my ? "ပြန်လည်စစ်ဆေးမည်" : "Retry")}
                </Text>
              </Pressable>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={() => load(true, true)}
            tintColor={colors.red}
            colors={[colors.red]}
          />
        }
        contentContainerStyle={s.listContent}
        initialNumToRender={14}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        stickySectionHeadersEnabled={false}
      />

      {/* 29-DAY MODAL CALENDAR SHEET */}
      <Modal
        visible={calendarOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <Pressable style={s.modalDismiss} onPress={() => setCalendarOpen(false)} />
          <View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[s.sheetHandle, { backgroundColor: colors.border2 }]} />
            <View style={[s.sheetHead, { borderBottomColor: colors.border2 }]}>
              <View>
                <Text style={[s.sheetTitle, { color: colors.text }]}>
                  {my ? "ရက်စွဲ ရွေးချယ်ပါ" : "Choose Match Date"}
                </Text>
                <Text style={[s.sheetSub, { color: colors.muted }]}>
                  {my ? "မည်သည့်ရက်စွဲမဆို တိုက်ရိုက်ကြည့်ရှုပါ" : "Jump directly to fixtures on any date"}
                </Text>
              </View>
              <Pressable hitSlop={8} style={s.closeBtn} onPress={() => setCalendarOpen(false)}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Quick Jump Buttons */}
              <View style={s.calendarControls}>
                <Pressable
                  style={[s.calendarStepBtn, { backgroundColor: colors.panel, borderColor: colors.border2 }]}
                  onPress={() => {
                    setOffset((v) => v - 1);
                    setCalendarOpen(false);
                  }}
                >
                  <Ionicons name="chevron-back" size={14} color={colors.text2} />
                  <Text style={[s.calendarStepText, { color: colors.text2 }]}>{my ? "မနေ့က" : "Prev Day"}</Text>
                </Pressable>

                <Pressable
                  style={[
                    s.calendarTodayBtn,
                    {
                      backgroundColor: offset === 0 ? colors.red : colors.panel,
                      borderColor: offset === 0 ? colors.red : colors.border2,
                    },
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
                  onPress={() => {
                    setOffset((v) => v + 1);
                    setCalendarOpen(false);
                  }}
                >
                  <Text style={[s.calendarStepText, { color: colors.text2 }]}>{my ? "မနက်ဖြန်" : "Next Day"}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.text2} />
                </Pressable>
              </View>

              {/* 29-Day Calendar Grid */}
              <View style={s.calendarGrid}>
                {calendarDates.map((item) => {
                  const isSelected = offset === item.offset;
                  return (
                    <Pressable
                      key={item.offset}
                      style={[
                        s.calendarDayCard,
                        {
                          backgroundColor: isSelected ? colors.redSoft : colors.panel,
                          borderColor: isSelected ? colors.red : colors.border2,
                        },
                      ]}
                      onPress={() => {
                        setOffset(item.offset);
                        setCalendarOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          s.calendarDayWeekday,
                          { color: isSelected ? colors.red : colors.muted },
                        ]}
                      >
                        {item.weekday}
                      </Text>
                      <Text
                        style={[
                          s.calendarDayNum,
                          { color: isSelected ? colors.red : colors.text },
                        ]}
                      >
                        {item.dayNum}
                      </Text>
                      <Text
                        style={[
                          s.calendarDayMonth,
                          { color: isSelected ? colors.red : colors.muted },
                        ]}
                      >
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
    </View>
  );
}

// -------------------------------------------------------------
// STYLES
// -------------------------------------------------------------

const s = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 32 },

  // Top Bar
  topbar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  brandWrap: { flex: 1 },
  brand: { fontSize: 20, fontWeight: "900", letterSpacing: 0.3 },
  brandMst: { fontWeight: "900" },
  tagline: { fontSize: 8.5, fontWeight: "800", marginTop: 1, letterSpacing: 0.4 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  topActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHeaderBtn: { padding: 1 },
  headerAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  headerAvatarInitials: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  headerInitialsText: { fontSize: 11.5, fontWeight: "900" },
  headerAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  // Prediction Hero
  predictionBanner: {
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    gap: 4,
  },
  predHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  predBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  predBadgeText: { color: "#FFFFFF", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.4 },
  predLeaderboardLink: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 0.5 },
  predLeaderboardText: { fontSize: 8.5, fontWeight: "800" },
  predContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  predTitle: { fontSize: 11.5, fontWeight: "900" },
  predSub: { fontSize: 9, marginTop: 1 },
  predBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4.5, borderRadius: 6 },
  predBtnText: { color: "#FFFFFF", fontSize: 8.5, fontWeight: "900" },

  // Consolidated Single Date Bar
  singleDateBar: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  calendarQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    minHeight: 48,
  },
  calendarQuickText: { fontSize: 10.5, fontWeight: "900" },
  dateStripContent: { gap: 6 },
  dateTab: {
    width: 46,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 0.5,
  },
  dateMonth: { fontSize: 7.5, fontWeight: "800" },
  dateNum: { fontSize: 14, fontWeight: "900", fontVariant: ["tabular-nums"] },
  dateDay: { fontSize: 7.5, fontWeight: "700" },

  // Filter Action Bar
  filterActionBar: {
    marginTop: 8,
    paddingHorizontal: 12,
  },
  filterRowContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  subFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipLiveDot: { width: 5, height: 5, borderRadius: 2.5 },
  subFilterText: { fontSize: 10, fontWeight: "800" },
  accordionActionChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  accordionActionText: { fontSize: 9.5, fontWeight: "800" },

  // Favorite prompt
  favPromptCard: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 9,
    borderWidth: 1,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  favPromptIconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  favPromptTitle: { fontSize: 11, fontWeight: "800" },
  favPromptSub: { fontSize: 9, marginTop: 1 },

  // Summary
  listSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  listSummaryTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 0.2 },
  summaryRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  matchCount: { fontSize: 10.5, fontWeight: "700" },

  // Error Strip
  errorStrip: {
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
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
  emptyTitle: { fontSize: 14, fontWeight: "900" },
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
  calendarControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 10, gap: 8 },
  calendarStepBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  calendarStepText: { fontSize: 10, fontWeight: "800" },
  calendarTodayBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  calendarTodayText: { fontSize: 10.5, fontWeight: "900" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6, paddingVertical: 4 },
  calendarDayCard: { width: "23%", height: 60, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 1 },
  calendarDayWeekday: { fontSize: 7.5, fontWeight: "800" },
  calendarDayNum: { fontSize: 14, fontWeight: "900", fontVariant: ["tabular-nums"] },
  calendarDayMonth: { fontSize: 7, fontWeight: "700" },
  todayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
});