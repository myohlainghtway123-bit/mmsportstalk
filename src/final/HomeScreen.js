import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { getAuthStatus, getProfile, normalizeAvatarUrl } from "../services/accountApi";

const FILTERS = ["ALL", "LIVE", "UPCOMING", "FINISHED"];
const DATE_OFFSETS = Array.from({ length: 15 }, (_, i) => i - 7);
const POPULAR = [
  "Premier League",
  "Champions League",
  "Europa League",
  "LaLiga",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
];

const MAJOR_COMPETITIONS = [
  [/(world cup|euro championship|uefa euro|copa america|champions league|club world cup)/i, 120],
  [/(premier league|la ?liga|serie a|bundesliga|ligue 1)/i, 90],
  [/(europa league)/i, 80],
  [/(conference league)/i, 65],
  [/(fa cup|copa del rey|coppa italia|dfb pokal|coupe de france)/i, 58],
];

const BIG_TEAMS = [
  "real madrid", "barcelona", "atletico madrid", "manchester united", "man utd",
  "manchester city", "man city", "liverpool", "arsenal", "chelsea", "tottenham", "spurs",
  "bayern munich", "bayern münchen", "borussia dortmund", "dortmund", "paris saint germain",
  "paris saint-germain", "psg", "juventus", "inter", "inter milan", "internazionale",
  "ac milan", "milan", "napoli", "roma", "benfica", "porto", "sporting cp", "ajax",
  "feyenoord", "celtic", "rangers", "argentina", "brazil", "england", "france",
  "spain", "germany", "portugal", "italy", "netherlands", "belgium", "croatia", "uruguay",
  "japan", "south korea",
];

const ELITE_TEAMS = [
  "real madrid", "barcelona", "manchester united", "man utd", "manchester city", "man city",
  "liverpool", "arsenal", "chelsea", "bayern munich", "bayern münchen", "paris saint germain",
  "paris saint-germain", "psg", "juventus", "inter", "inter milan", "ac milan", "milan",
  "argentina", "brazil", "england", "france", "spain", "germany", "portugal", "italy",
];

function normalizedName(value) {
  return String(value || "").trim().toLowerCase();
}
function containsTeam(name, list) {
  const n = normalizedName(name);
  return list.some((team) => n === team || n.includes(team));
}
function competitionWeight(name) {
  for (const [pattern, score] of MAJOR_COMPETITIONS) {
    if (pattern.test(String(name || ""))) return score;
  }
  return 0;
}
function matchPriorityScore(match) {
  let score = competitionWeight(match?.competition);
  const home = match?.home?.name, away = match?.away?.name;
  const bigHome = containsTeam(home, BIG_TEAMS), bigAway = containsTeam(away, BIG_TEAMS);
  const eliteHome = containsTeam(home, ELITE_TEAMS), eliteAway = containsTeam(away, ELITE_TEAMS);
  const regionalPriority = Math.max(regionalNationalTeamPriority(home), regionalNationalTeamPriority(away));
  if (bigHome) score += 38;
  if (bigAway) score += 38;
  if (eliteHome) score += 18;
  if (eliteAway) score += 18;
  if (bigHome && bigAway) score += 115;
  if (eliteHome && eliteAway) score += 55;
  if (regionalPriority === 2) score += 420;
  else if (regionalPriority === 1) score += 260;
  if (isLiveMatch(match)) score += 12;
  return score;
}
function kickoffTime(match) {
  const t = match?.kickoff ? new Date(match.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}
function importantMatchSort(a, b) {
  return (
    matchPriorityScore(b) - matchPriorityScore(a) ||
    kickoffTime(a) - kickoffTime(b) ||
    String(a?.home?.name || "").localeCompare(String(b?.home?.name || ""))
  );
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

function kickoffLabel(match) {
  const code = statusCode(match);
  if (code === "HT") return "HT";
  if (code === "P") return "PEN";
  if (code === "BT") return "BREAK";
  if (code === "SUSP" || code === "SUSPENDED") return "SUSP";
  if (code === "INT" || code === "INTERRUPTED") return "INT";
  if (code === "PST" || code === "POSTPONED") return "PST";
  if (code === "CANC" || code === "CANCELLED" || code === "CANCELED") return "CANC";
  if (code === "ABD" || code === "ABANDONED") return "ABD";
  if (code === "AET") return "AET";
  if (code === "PEN") return "PEN";
  if (code === "FT" || code === "FINISHED") return "FT";
  if (isLiveMatch(match)) {
    const elapsed = Number(match?.elapsed);
    if (Number.isFinite(elapsed) && elapsed >= 0) return `${elapsed}'`;
    const minute = String(match?.minute || "").trim();
    if (/^\d+(?:\+\d+)?'?$/.test(minute)) return minute.endsWith("'") ? minute : `${minute}'`;
    return code && code !== "NS" ? code : "LIVE";
  }
  if (!match?.kickoff) return code || "—";
  const d = new Date(match.kickoff);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isFinished(match) {
  return ["FT", "AET", "PEN", "FINISHED"].includes(statusCode(match));
}
function isUpcoming(match) {
  if (isLiveMatch(match) || isFinished(match)) return false;
  const t = match.kickoff ? new Date(match.kickoff).getTime() : NaN;
  return !Number.isFinite(t) || t > Date.now();
}

function TeamLogo({ uri, colors }) {
  return uri ? (
    <Image source={{ uri }} resizeMode="contain" style={s.teamLogo} fadeDuration={0} />
  ) : (
    <View style={[s.logoFallback, { backgroundColor: colors.card2 }]}>
      <Ionicons name="football-outline" size={14} color={colors.muted} />
    </View>
  );
}

function LeagueLogo({ uri, colors }) {
  return uri ? (
    <Image source={{ uri }} resizeMode="contain" style={s.leagueLogo} fadeDuration={0} />
  ) : (
    <View style={[s.leagueLogoFallback, { backgroundColor: colors.card2 }]}>
      <Ionicons name="trophy-outline" size={13} color={colors.text2} />
    </View>
  );
}

const MatchRow = memo(function MatchRow({ match, onOpen, colors }) {
  const live = isLiveMatch(match);
  const finished = isFinished(match);
  const scoreExpected = live || finished || match.homeScore != null || match.awayScore != null;

  return (
    <Pressable
      style={[s.matchRow, { backgroundColor: colors.card, borderColor: colors.border2 }]}
      onPress={() => onOpen?.(match)}
      android_ripple={{ color: colors.border }}
    >
      <View style={s.timeCol}>
        <Text
          style={[
            s.timeText,
            { color: colors.text2 },
            live && { color: colors.red, fontWeight: "900" },
            finished && { color: colors.muted },
          ]}
        >
          {kickoffLabel(match)}
        </Text>
        {live ? <View style={[s.livePulse, { backgroundColor: colors.red }]} /> : null}
      </View>
      <View style={s.fixtureCol}>
        <View style={s.teamLine}>
          <TeamLogo uri={match.home?.logo} colors={colors} />
          <Text numberOfLines={1} style={[s.teamName, { color: colors.text }]}>
            {match.home?.name || "Home"}
          </Text>
          <Text style={[s.score, { color: colors.text }, live && { color: colors.red }]}>
            {match.homeScore != null ? match.homeScore : scoreExpected ? "—" : ""}
          </Text>
        </View>
        <View style={s.teamLine}>
          <TeamLogo uri={match.away?.logo} colors={colors} />
          <Text numberOfLines={1} style={[s.teamName, { color: colors.text }]}>
            {match.away?.name || "Away"}
          </Text>
          <Text style={[s.score, { color: colors.text }, live && { color: colors.red }]}>
            {match.awayScore != null ? match.awayScore : scoreExpected ? "—" : ""}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.muted2} />
    </Pressable>
  );
});

export default function HomeScreen({
  openMatch,
  openNotifications,
  openSearch,
  openPredictions,
  openAccount,
  language = "my",
}) {
  const { colors } = useTheme();
  const my = language === "my";
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("ALL");
  const [competition, setCompetition] = useState("ALL");
  const [leagueOpen, setLeagueOpen] = useState(false);
  const [leagueSearch, setLeagueSearch] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchUser = async () => {
      try {
        const status = await getAuthStatus().catch(() => null);
        if (!mounted) return;
        if (status?.authenticated) {
          const profile = await getProfile().catch(() => null);
          const u = status.user || profile?.data?.profile || profile?.profile || profile;
          setCurrentUser({
            name: u?.displayName || u?.name || "MST User",
            avatar: normalizeAvatarUrl(u?.avatar || u?.avatarUrl || u?.image),
          });
        } else {
          setCurrentUser(null);
        }
      } catch {
        if (mounted) setCurrentUser(null);
      }
    };
    fetchUser();
    return () => { mounted = false; };
  }, []);

  const date = bangkokDate(offset);
  const [state, setState] = useState(() => {
    const saved = peekFastFootballMatches(date);
    return { loading: !saved, refreshing: false, error: "", matches: saved?.matches || [] };
  });

  const load = useCallback(
    async (force = false, silent = false) => {
      const saved = peekFastFootballMatches(date);
      if (!silent) {
        setState((p) => ({
          ...p,
          loading: !force && !saved && !p.matches.length,
          refreshing: force,
          error: "",
          matches: saved?.matches || p.matches,
        }));
      }
      try {
        const result = await fetchFastFootballMatches({ date, force });
        setState({ loading: false, refreshing: false, error: "", matches: result.matches || [] });
      } catch (e) {
        setState((p) => ({ ...p, loading: false, refreshing: false, error: e?.message || "Could not update matches." }));
      }
    },
    [date],
  );

  useEffect(() => {
    setFilter("ALL");
    setCompetition("ALL");
  }, [date]);

  useEffect(() => {
    const saved = peekFastFootballMatches(date);
    setState({ loading: !saved, refreshing: false, error: "", matches: saved?.matches || [] });
    load(false, false);
  }, [date, load]);

  useEffect(() => {
    prefetchFastFootballMatches([bangkokDate(offset - 1), bangkokDate(offset), bangkokDate(offset + 1)]);
  }, [offset]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (offset === 0) load(true, true);
    }, 15000);
    return () => clearInterval(timer);
  }, [load, offset]);

  const liveCount = useMemo(() => state.matches.filter(isLiveMatch).length, [state.matches]);
  const competitions = useMemo(() => {
    const values = [...new Set(state.matches.map((m) => m.competition).filter(Boolean))];
    return values.sort((a, b) => {
      const ai = POPULAR.findIndex((x) => String(a).includes(x));
      const bi = POPULAR.findIndex((x) => String(b).includes(x));
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || String(a).localeCompare(String(b));
    });
  }, [state.matches]);

  const visibleCompetitions = useMemo(() => {
    const q = leagueSearch.trim().toLowerCase();
    return q ? competitions.filter((x) => String(x).toLowerCase().includes(q)) : competitions;
  }, [competitions, leagueSearch]);

  const filtered = useMemo(
    () =>
      state.matches.filter((m) => {
        const statusOk =
          filter === "ALL"
            ? true
            : filter === "LIVE"
            ? isLiveMatch(m)
            : filter === "UPCOMING"
            ? isUpcoming(m)
            : isFinished(m);
        const leagueOk = competition === "ALL" || m.competition === competition;
        return statusOk && leagueOk;
      }),
    [state.matches, filter, competition],
  );

  const sections = useMemo(() => {
    const map = new Map();
    for (const match of filtered) {
      const key = match.competition || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(match);
    }
    const rows = [...map.entries()].map(([title, data]) => {
      const ordered = [...data].sort(importantMatchSort);
      return {
        title,
        data: ordered,
        logo: ordered[0]?.competitionLogo,
        country: ordered[0]?.country,
        priority: ordered.length ? matchPriorityScore(ordered[0]) : 0,
      };
    });
    rows.sort(
      (a, b) =>
        b.priority - a.priority ||
        competitionWeight(b.title) - competitionWeight(a.title) ||
        a.title.localeCompare(b.title),
    );
    return rows;
  }, [filtered]);

  const filterLabel = (value) =>
    my ? ({ ALL: "အားလုံး", LIVE: "တိုက်ရိုက်", UPCOMING: "လာမည့်ပွဲ", FINISHED: "ပြီးဆုံး" }[value] || value) : value;

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

  const header = (
    <>
      {/* Top Brand Bar */}
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
            <View style={[s.liveChip, { backgroundColor: colors.redSoft }]}>
              <View style={[s.liveChipDot, { backgroundColor: colors.red }]} />
              <Text style={[s.liveChipText, { color: colors.red }]}>{liveCount} LIVE</Text>
            </View>
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

      {/* Prominent Search Bar Entry */}
      <Pressable
        style={[s.searchBarEntry, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={openSearch}
      >
        <Ionicons name="search-outline" size={19} color={colors.muted} />
        <Text style={[s.searchBarPlaceholder, { color: colors.muted }]}>
          {my ? "အသင်း၊ ပြိုင်ပွဲ၊ နိုင်ငံ၊ ကစားသမား ရှာရန်…" : "Search clubs, leagues, nations, players…"}
        </Text>
        <View style={[s.searchShortcutBadge, { backgroundColor: colors.panel, borderColor: colors.border2 }]}>
          <Text style={[s.searchShortcutText, { color: colors.muted }]}>SEARCH</Text>
        </View>
      </Pressable>

      {/* Prominent Prediction Banner */}
      <Pressable
        style={[s.predictionBanner, { backgroundColor: colors.card, borderColor: colors.red }]}
        onPress={openPredictions}
      >
        <View style={[s.predBadge, { backgroundColor: colors.red }]}>
          <Ionicons name="trophy" size={13} color="#FFFFFF" />
          <Text style={s.predBadgeText}>{my ? "အခမဲ့ ခန့်မှန်းပြိုင်ပွဲ" : "FREE PREDICTION"}</Text>
        </View>
        <View style={s.predContent}>
          <View style={{ flex: 1 }}>
            <Text style={[s.predTitle, { color: colors.text }]}>
              {my ? "ပွဲစဉ်ရလဒ် အတိအကျ ခန့်မှန်းပါ" : "Predict Exact Scores & Win"}
            </Text>
            <Text style={[s.predSub, { color: colors.muted }]}>
              {my ? "ရလဒ်မှန် ၃ မှတ် · အပတ်စဉ် Leaderboard ဝင်ပါ" : "3 PTS exact hit · Weekly & Season Leaderboards"}
            </Text>
          </View>
          <View style={[s.predBtn, { backgroundColor: colors.red }]}>
            <Text style={s.predBtnText}>{my ? "ခန့်မှန်းမည်" : "PREDICT"}</Text>
            <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
          </View>
        </View>
      </Pressable>

      {/* Date Bar with Tapable Calendar Picker Icon */}
      <View style={s.dateWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateContent}>
          {DATE_OFFSETS.map((x) => {
            const d = dayMeta(x, language);
            const on = offset === x;
            return (
              <Pressable
                key={x}
                style={[
                  s.dateTab,
                  { backgroundColor: on ? colors.redSoft : colors.card, borderColor: on ? colors.red : colors.border },
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
        <Pressable
          style={[s.calendarButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setCalendarOpen(true)}
          hitSlop={6}
        >
          <Ionicons name="calendar" size={20} color={colors.red} />
        </Pressable>
      </View>

      {/* Filters Strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterBar}>
        {FILTERS.map((x) => {
          const on = filter === x;
          return (
            <Pressable
              key={x}
              style={[
                s.filter,
                { backgroundColor: on ? colors.red : colors.card, borderColor: on ? colors.red : colors.border },
              ]}
              onPress={() => setFilter(x)}
            >
              <Text style={[s.filterText, { color: on ? "#FFFFFF" : colors.text2 }]}>{filterLabel(x)}</Text>
              {x === "LIVE" && liveCount > 0 ? (
                <View style={[s.filterBadge, { backgroundColor: on ? "#FFFFFF" : colors.redSoft }]}>
                  <Text style={[s.filterBadgeText, { color: on ? colors.red : colors.red }]}>{liveCount}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        <Pressable
          style={[
            s.filter,
            s.leagueFilter,
            {
              backgroundColor: competition !== "ALL" ? colors.redSoft : colors.card,
              borderColor: competition !== "ALL" ? colors.red : colors.border,
            },
          ]}
          onPress={() => setLeagueOpen(true)}
        >
          <Ionicons name="trophy-outline" size={14} color={competition !== "ALL" ? colors.red : colors.text2} />
          <Text numberOfLines={1} style={[s.filterText, { color: competition !== "ALL" ? colors.red : colors.text2 }]}>
            {competition === "ALL" ? (my ? "ပြိုင်ပွဲများ" : "COMPETITIONS") : competition}
          </Text>
          <Ionicons name="chevron-down" size={13} color={colors.muted} />
        </Pressable>
      </ScrollView>

      {/* Matches Summary Title */}
      <View style={s.listSummary}>
        <Text style={[s.listSummaryTitle, { color: colors.text }]}>
          {offset === 0 && filter === "ALL" && competition === "ALL"
            ? my
              ? "ဒီနေ့ပွဲများ"
              : "TODAY'S MATCHES"
            : competition !== "ALL"
            ? competition
            : filterLabel(filter)}
        </Text>
        <View style={s.summaryRight}>
          {state.loading ? <ActivityIndicator size="small" color={colors.red} /> : null}
          <Text style={[s.matchCount, { color: colors.muted }]}>
            {filtered.length} {my ? "ပွဲ" : "matches"}
          </Text>
        </View>
      </View>

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
    </>
  );

  return (
    <View style={[s.screen, { backgroundColor: colors.bg }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <MatchRow match={item} onOpen={openMatch} colors={colors} />}
        renderSectionHeader={({ section }) => (
          <View style={[s.leagueHeader, { backgroundColor: colors.panel, borderBottomColor: colors.border2 }]}>
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
            <Text style={[s.leagueCount, { color: colors.muted }]}>{section.data.length}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.muted2} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !state.loading ? (
            <View style={s.empty}>
              <Ionicons name="football-outline" size={28} color={colors.muted} />
              <Text style={[s.emptyTitle, { color: colors.text }]}>{my ? "ပွဲမရှိသေးပါ" : "No matches found"}</Text>
              <Text style={[s.emptyText, { color: colors.muted }]}>
                {my ? "အခြားရက် သို့မဟုတ် filter ကို စမ်းကြည့်ပါ။" : "Try another date or filter."}
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
            onRefresh={() => load(true, false)}
            colors={[colors.red]}
            tintColor={colors.red}
          />
        }
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        initialNumToRender={18}
        maxToRenderPerBatch={14}
        updateCellsBatchingPeriod={16}
        windowSize={8}
        removeClippedSubviews
      />

      {/* Interactive Match Calendar Modal */}
      <Modal visible={calendarOpen} transparent animationType="slide" onRequestClose={() => setCalendarOpen(false)}>
        <View style={s.modalBackdrop}>
          <Pressable style={s.modalDismiss} onPress={() => setCalendarOpen(false)} />
          <View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[s.sheetHandle, { backgroundColor: colors.border2 }]} />
            <View style={[s.sheetHead, { borderBottomColor: colors.border2 }]}>
              <View>
                <Text style={[s.sheetTitle, { color: colors.text }]}>{my ? "ရက်စွဲရွေးရန်" : "Choose Match Date"}</Text>
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
                <Ionicons name="chevron-back" size={18} color={colors.text} />
                <Text style={[s.calendarStepText, { color: colors.text }]}>{my ? "ယခင်ရက်" : "Prev Day"}</Text>
              </Pressable>
              <Pressable
                style={[s.calendarTodayBtn, { backgroundColor: offset === 0 ? colors.red : colors.panel, borderColor: colors.border }]}
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
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
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

      {/* Competition Filter Modal */}
      <Modal visible={leagueOpen} transparent animationType="slide" onRequestClose={() => setLeagueOpen(false)}>
        <View style={s.modalBackdrop}>
          <Pressable style={s.modalDismiss} onPress={() => setLeagueOpen(false)} />
          <View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[s.sheetHandle, { backgroundColor: colors.border2 }]} />
            <View style={[s.sheetHead, { borderBottomColor: colors.border2 }]}>
              <View>
                <Text style={[s.sheetTitle, { color: colors.text }]}>{my ? "ပြိုင်ပွဲရွေးရန်" : "Choose Competition"}</Text>
                <Text style={[s.sheetSub, { color: colors.muted }]}>
                  {my ? "ပွဲများကို ပြိုင်ပွဲအလိုက် စစ်ထုတ်ပါ" : "Filter matches by competition"}
                </Text>
              </View>
              <Pressable style={s.closeBtn} onPress={() => setLeagueOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <View style={[s.searchBox, { backgroundColor: colors.panel, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <TextInput
                value={leagueSearch}
                onChangeText={setLeagueSearch}
                placeholder={my ? "ပြိုင်ပွဲရှာရန်" : "Search competitions"}
                placeholderTextColor={colors.muted2}
                style={[s.searchInput, { color: colors.text }]}
              />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <Pressable
                style={[
                  s.leagueChoice,
                  { borderBottomColor: colors.border2 },
                  competition === "ALL" && { backgroundColor: colors.redSoft },
                ]}
                onPress={() => {
                  setCompetition("ALL");
                  setLeagueOpen(false);
                }}
              >
                <Ionicons name="apps-outline" size={20} color={competition === "ALL" ? colors.red : colors.text2} />
                <Text style={[s.leagueChoiceText, { color: competition === "ALL" ? colors.red : colors.text }]}>
                  {my ? "ပြိုင်ပွဲအားလုံး" : "All Competitions"}
                </Text>
                {competition === "ALL" ? <Ionicons name="checkmark" size={20} color={colors.red} /> : null}
              </Pressable>
              {visibleCompetitions.map((name) => (
                <Pressable
                  key={name}
                  style={[
                    s.leagueChoice,
                    { borderBottomColor: colors.border2 },
                    competition === name && { backgroundColor: colors.redSoft },
                  ]}
                  onPress={() => {
                    setCompetition(name);
                    setLeagueOpen(false);
                  }}
                >
                  <Ionicons name="trophy-outline" size={20} color={competition === name ? colors.red : colors.text2} />
                  <Text numberOfLines={1} style={[s.leagueChoiceText, { color: competition === name ? colors.red : colors.text }]}>
                    {name}
                  </Text>
                  {competition === name ? <Ionicons name="checkmark" size={20} color={colors.red} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  listContent: { paddingBottom: 40 },
  topbar: {
    minHeight: 60,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  brand: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  brandMst: { fontWeight: "900" },
  tagline: { fontSize: 8.8, fontWeight: "700", letterSpacing: 0.6, marginTop: 2 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  liveChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  liveChipDot: { width: 7, height: 7, borderRadius: 3.5 },
  liveChipText: { fontSize: 10, fontWeight: "900" },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  avatarHeaderBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  headerAvatarInitials: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  headerInitialsText: { fontSize: 12, fontWeight: "900" },
  headerAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  searchBarEntry: {
    marginHorizontal: 12,
    marginTop: 10,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchBarPlaceholder: { flex: 1, fontSize: 11.5, fontWeight: "600" },
  searchShortcutBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  searchShortcutText: { fontSize: 8, fontWeight: "900" },
  predictionBanner: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  predBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  predBadgeText: { color: "#FFFFFF", fontSize: 8.5, fontWeight: "900" },
  predContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  predTitle: { fontSize: 12.8, fontWeight: "900" },
  predSub: { fontSize: 9.5, marginTop: 2 },
  predBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  predBtnText: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "900" },
  dateWrap: { flexDirection: "row", alignItems: "center", paddingLeft: 12, paddingRight: 6, marginTop: 10 },
  dateContent: { gap: 6, paddingRight: 10 },
  dateTab: { width: 50, height: 58, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 1 },
  dateMonth: { fontSize: 8.5, fontWeight: "800" },
  dateNum: { fontSize: 16, fontWeight: "900", fontVariant: ["tabular-nums"] },
  dateDay: { fontSize: 8.5, fontWeight: "700" },
  calendarButton: { width: 50, height: 58, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  filterBar: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  filter: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
  filterText: { fontSize: 10.8, fontWeight: "800" },
  filterBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9 },
  filterBadgeText: { fontSize: 9, fontWeight: "900" },
  leagueFilter: { gap: 6 },
  listSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 6 },
  listSummaryTitle: { fontSize: 13, fontWeight: "900" },
  summaryRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  matchCount: { fontSize: 11, fontWeight: "700" },
  errorStrip: { marginHorizontal: 12, marginVertical: 6, padding: 10, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  errorText: { fontSize: 11, fontWeight: "800" },
  leagueHeader: { minHeight: 38, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, gap: 8 },
  leagueLogo: { width: 18, height: 18 },
  leagueLogoFallback: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  leagueTextWrap: { flex: 1, minWidth: 0 },
  leagueTitle: { fontSize: 11.5, fontWeight: "900" },
  leagueCountry: { fontSize: 8.5, fontWeight: "600", marginTop: 1 },
  leagueCount: { fontSize: 10, fontWeight: "800" },
  matchRow: { minHeight: 56, marginHorizontal: 10, marginVertical: 3, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  timeCol: { width: 44, alignItems: "center", justifyContent: "center" },
  timeText: { fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
  livePulse: { width: 5, height: 5, borderRadius: 2.5, marginTop: 3 },
  fixtureCol: { flex: 1, gap: 4, minWidth: 0 },
  teamLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  teamLogo: { width: 20, height: 20 },
  logoFallback: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  teamName: { flex: 1, fontSize: 12.2, fontWeight: "800" },
  score: { fontSize: 14, fontWeight: "900", fontVariant: ["tabular-nums"], minWidth: 16, textAlign: "right" },
  empty: { padding: 40, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "900" },
  emptyText: { fontSize: 11, textAlign: "center" },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, marginTop: 8 },
  retryBtnText: { fontSize: 11.5, fontWeight: "800" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalDismiss: { flex: 1 },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16, paddingBottom: 30, maxHeight: "80%" },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottomWidth: 1 },
  sheetTitle: { fontSize: 16, fontWeight: "900" },
  sheetSub: { fontSize: 11, marginTop: 2 },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, marginVertical: 12 },
  searchInput: { flex: 1, fontSize: 12, fontWeight: "600" },
  leagueChoice: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderBottomWidth: 1 },
  leagueChoiceText: { flex: 1, fontSize: 12.5, fontWeight: "700" },
  calendarControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 12, gap: 8 },
  calendarStepBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  calendarStepText: { fontSize: 10.5, fontWeight: "800" },
  calendarTodayBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  calendarTodayText: { fontSize: 11, fontWeight: "900" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 7, paddingVertical: 4 },
  calendarDayCard: { width: "23%", height: 68, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  calendarDayWeekday: { fontSize: 8.5, fontWeight: "800" },
  calendarDayNum: { fontSize: 16, fontWeight: "900", fontVariant: ["tabular-nums"] },
  calendarDayMonth: { fontSize: 8, fontWeight: "700" },
  todayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
});