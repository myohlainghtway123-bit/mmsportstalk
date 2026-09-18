import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  ToastAndroid,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  canonicalMatchId,
  loadMatchCenter,
  loadScoresForDate,
  loadScoresOverview,
} from "./scoresStagingApi";
import Phase4BMatchVote from "./Phase4BMatchVote";
import Phase4BMatchInsights from "./Phase4BMatchInsights";
import Phase4BReadOnlyHub from "./Phase4BReadOnlyHub";
import Phase4BFavoritesPanel, { Phase4BMatchFavorites } from "./Phase4BFavoritesPanel";
import Phase4BNotificationsPanel from "./Phase4BNotificationsPanel";
import Phase4BSearchPanel from "./Phase4BSearchPanel";
import Phase4BNewsPanel from "./Phase4BNewsPanel";
import Phase4BAdBanner from "./Phase4BAdBanner";
import ScreenHeader from "../components/ScreenHeader";
import SettingsScreenV2 from "../final/SettingsScreenV2";
import MatchOddsCard from "../final/MatchOddsCard";
import NativeEntityScreenV2 from "../final/NativeEntityScreenV2";
import { getAuthStatus, getFavorites } from "./scoresFavoritesApi";
import Phase4BMatchPreviewScreen from "./Phase4BMatchPreviewScreen";
import Phase4BSearchScreen from "./Phase4BSearchScreen";
import Phase4BProfileScreen from "./Phase4BProfileScreen";
import Phase4BAuthModal from "./Phase4BAuthModal.js";
import Phase4BStartupGate from "./Phase4BStartupGate.js";
import Phase4BRewardedPrediction from "./Phase4BRewardedPrediction";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadOnboardingPreferences, persistAppLanguage, subscribeAppLanguage } from "../services/onboardingStore.js";
import { t } from "../i18n/translations";
import { ThemeProvider, useTheme } from "../theme/ThemeContext";
import { trackEvent } from "../services/analytics.js";
import { ErrorBoundary, initCrashReporter, logBreadcrumb, setCrashRouteContext } from "../services/crashReporter.js";

const T = Object.freeze({
  color: {
    bg: "#000000",
    surface: "#121214",
    raised: "#18181C",
    border: "#202024",
    borderSub: "#18181C",
    text: "#FFFFFF",
    secondary: "#C4C4CC",
    muted: "#787882",
    red: "#E50914",
    redSoft: "rgba(229,9,20,0.14)",
    redPulse: "rgba(229,9,20,0.35)",
    amber: "#F59E0B",
    green: "#10B981",
    greenSoft: "rgba(16,185,129,0.15)",
    scoreBg: "#18181C",
  },
  space: { xs: 5, sm: 9, md: 14, lg: 20 },
  radius: { xs: 4, sm: 6, md: 10, lg: 16 },
});

const NAV_ITEMS = [
  { id: "matches", label: "Matches", icon: "football-outline", activeIcon: "football" },
  { id: "news", label: "News", icon: "newspaper-outline", activeIcon: "newspaper" },
  { id: "favorites", label: "Favorites", icon: "star-outline", activeIcon: "star" },
  { id: "tips", label: "Tips", icon: "diamond-outline", activeIcon: "diamond" },
  { id: "settings", label: "Settings", icon: "settings-outline", activeIcon: "settings" },
];

const MATCH_SECTION_DEFS = [
  { title: "Stats", keys: ["stats", "statistics"] },
  { title: "Lineups", keys: ["lineups", "lineup"] },
  { title: "Events", keys: ["events"] },
  { title: "xG", keys: ["xg", "expected_goals"] },
  { title: "H2H", keys: ["h2h", "head_to_head"] },
  { title: "Form", keys: ["form", "team_form"] },
  { title: "Standings", keys: ["standings"] },
];

function dateKey(value) {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateWindow(center = new Date(), pastDays = 30, futureDays = 30) {
  const total = pastDays + 1 + futureDays;
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(center);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + (index - pastDays));
    return date;
  });
}

function dayLabel(date, language = "en") {
  const today = dateKey(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dk = dateKey(date);
  if (language === "my") {
    if (dk === today) return t("today", "my");
    if (dk === dateKey(tomorrow)) return t("tomorrow", "my");
    if (dk === dateKey(yesterday)) return t("yesterday", "my");
    const weekdays = [t("sun", "my"), t("mon", "my"), t("tue", "my"), t("wed", "my"), t("thu", "my"), t("fri", "my"), t("sat", "my")];
    return weekdays[date.getDay()] || "—";
  }
  if (dk === today) return "Today";
  if (dk === dateKey(tomorrow)) return "Tom";
  if (dk === dateKey(yesterday)) return "Yest";
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function kickoffText(value) {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function MatchListSkeleton({ isDark = true }) {
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
      {[1, 2, 3].map((i) => (
        <View
          key={`skel-${i}`}
          style={{
            borderRadius: 10,
            backgroundColor: isDark ? "#121214" : "#FFFFFF",
            borderWidth: 1,
            borderColor: isDark ? "#1A1A1E" : "#E5E7EB",
            marginBottom: 12,
            padding: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: isDark ? "#222228" : "#E5E7EB" }} />
            <View style={{ width: 140, height: 14, borderRadius: 4, backgroundColor: isDark ? "#222228" : "#E5E7EB" }} />
          </View>
          {[1, 2].map((r) => (
            <View key={`skel-row-${r}`} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10 }}>
              <View style={{ width: 44, height: 14, borderRadius: 4, backgroundColor: isDark ? "#1A1A20" : "#F3F4F6" }} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ width: "70%", height: 12, borderRadius: 3, backgroundColor: isDark ? "#1A1A20" : "#F3F4F6" }} />
                <View style={{ width: "55%", height: 12, borderRadius: 3, backgroundColor: isDark ? "#1A1A20" : "#F3F4F6" }} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function fullKickoff(value) {
  if (!value) return "Kickoff unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Kickoff unavailable";
  return date.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

function statusText(match, language = "en") {
  const status = String(match?.status || "scheduled").toLowerCase();
  if (["live", "in_play", "1h", "2h"].includes(status)) {
    return match?.minute == null
      ? (language === "my" ? "တိုက်ရိုက်" : "LIVE")
      : (language === "my" ? `တိုက်ရိုက် ${match.minute}'` : `LIVE ${match.minute}'`);
  }
  if (["ht", "halftime"].includes(status)) return language === "my" ? "ပထမပိုင်း" : "HT";
  if (["finished", "ft"].includes(status)) return language === "my" ? "ပြီးဆုံး" : "FT";
  if (["postponed"].includes(status)) return language === "my" ? "ရွှေ့ဆိုင်း" : "POSTPONED";
  return String(match?.status_detail || status).toUpperCase();
}

function isLive(match) {
  return ["live", "in_play", "1h", "2h", "ht", "halftime"].includes(String(match?.status || "").toLowerCase());
}

function isFinished(match) {
  return ["finished", "ft"].includes(String(match?.status || "").toLowerCase());
}

function scoreText(match) {
  if (match?.home_score == null || match?.away_score == null) return "vs";
  return `${match.home_score} - ${match.away_score}`;
}

function matchStateText(match, language = "en") {
  return isLive(match) || isFinished(match) ? statusText(match, language) : kickoffText(match?.kickoff_at);
}

const MAJOR_LEAGUE_PATTERNS = [
  // Tier 1: Continental & World Elite
  { regex: /champions league|uefa cl/i, score: 2000 },
  { regex: /world cup/i, score: 1950 },
  { regex: /euro(pean)? championship/i, score: 1900 },
  { regex: /europa league/i, score: 1800 },
  { regex: /conference league/i, score: 1700 },
  { regex: /copa america/i, score: 1650 },
  { regex: /afc champions league/i, score: 1600 },

  // Tier 2: Top 5 European Leagues
  // "Premier League" strictly means English Premier League only, never generic leagues with "Premier League" in their name
  {
    regex: /^(english\s+)?premier\s+league$|premier\s+league\s*[-–]\s*england|\bepl\b/i,
    exclude: /russia|egypt|kuwait|ghana|ukraine|bosnia|kazakhstan|malta|wales|singapore|nigeria|israel|ethiopia|kenya/i,
    score: 1500,
  },
  { regex: /la liga|primera divisi[oó]n/i, score: 1450 },
  { regex: /serie a/i, score: 1400 },
  { regex: /bundesliga/i, score: 1350 },
  { regex: /ligue 1/i, score: 1300 },

  // Tier 3: Prestigious Domestic Cups
  { regex: /fa cup/i, score: 1200 },
  { regex: /copa del rey/i, score: 1150 },
  { regex: /coppa italia/i, score: 1100 },
  { regex: /dfb.*pokal/i, score: 1050 },
  { regex: /coupe de france/i, score: 1000 },
  { regex: /carabao|efl cup/i, score: 950 },

  // Tier 4: Major Global & Continental Leagues
  { regex: /saudi pro/i, score: 900 },
  { regex: /major league soccer|mls/i, score: 850 },
  { regex: /copa libertadores/i, score: 820 },
  { regex: /eredivisie/i, score: 800 },
  { regex: /primeira liga/i, score: 780 },
  { regex: /brasileir[aã]o/i, score: 750 },
  { regex: /championship/i, score: 700 },
];

const BIG_TEAM_PATTERNS = [
  /real madrid/i,
  /barcelona/i,
  /manchester (city|united)/i,
  /arsenal/i,
  /liverpool/i,
  /chelsea/i,
  /tottenham/i,
  /bayern (munich|m[uü]nchen)/i,
  /borussia dortmund|bvb/i,
  /paris saint[- ]germain|psg/i,
  /juventus/i,
  /inter( milan)?/i,
  /ac milan/i,
  /atletico( de)? madrid/i,
  /napoli/i,
  /bayer leverkusen/i,
  /al[- ]nassr|al[- ]hilal|al[- ]ittihad/i,
  /inter miami/i,
];

function isBigTeam(name) {
  if (!name) return false;
  return BIG_TEAM_PATTERNS.some((p) => p.test(name));
}

function matchHasBigTeam(match) {
  const home = String(match?.home_team_name || match?.homeTeam?.name || match?.home?.name || "");
  const away = String(match?.away_team_name || match?.awayTeam?.name || match?.away?.name || "");
  return isBigTeam(home) || isBigTeam(away);
}

function getCompetitionScore(compName, matches = []) {
  let score = 100;
  const name = String(compName || "").trim();
  for (const item of MAJOR_LEAGUE_PATTERNS) {
    if (item.regex.test(name)) {
      if (item.exclude && item.exclude.test(name)) {
        continue;
      }
      score = item.score;
      break;
    }
  }

  // Bonus if group contains big teams (+300)
  if (matches.some(matchHasBigTeam)) {
    score += 300;
  }

  // Extra bonus if group has active live matches (+400)
  if (matches.some(isLive)) {
    score += 400;
  }

  return score;
}

function groupByCompetition(matches) {
  const groups = new Map();
  for (const match of matches) {
    const id = String(match?.competition_id || match?.competition_name || "football");
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        name: match?.competition_name || "Football",
        logo: match?.competition_logo_url || null,
        matches: [],
      });
    }
    groups.get(id).matches.push(match);
  }

  const list = [...groups.values()];

  // Sort matches within each competition: live matches first, then big teams, then kickoff time
  for (const group of list) {
    group.matches.sort((a, b) => {
      const aLive = isLive(a) ? 1 : 0;
      const bLive = isLive(b) ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;

      const aBig = matchHasBigTeam(a) ? 1 : 0;
      const bBig = matchHasBigTeam(b) ? 1 : 0;
      if (aBig !== bBig) return bBig - aBig;

      return String(a?.kickoff_at || "").localeCompare(String(b?.kickoff_at || ""));
    });

    group.score = getCompetitionScore(group.name, group.matches);
  }

  // Sort competitions by priority score descending: Big Leagues & Big Teams & Live Competitions first!
  list.sort((a, b) => b.score - a.score);

  return list;
}

function nearestAvailableDate(matches) {
  const now = Date.now();
  const dated = matches
    .map((match) => ({ key: dateKey(match?.kickoff_at), time: new Date(match?.kickoff_at).getTime() }))
    .filter(({ key, time }) => key && Number.isFinite(time))
    .sort((a, b) => Math.abs(a.time - now) - Math.abs(b.time - now));
  return dated[0]?.key || dateKey(new Date());
}

function firstSectionValue(match, keys) {
  return keys.map((key) => match?.[key]).find((value) => (
    Array.isArray(value) ? value.length > 0 : value && typeof value === "object" ? Object.keys(value).length > 0 : value != null
  ));
}

function sectionSummary(value) {
  if (Array.isArray(value)) return `${value.length} record${value.length === 1 ? "" : "s"} available.`;
  if (value && typeof value === "object") return `${Object.keys(value).length} field${Object.keys(value).length === 1 ? "" : "s"} available.`;
  return value == null ? "" : String(value);
}

function EnvironmentBanner() {
  let colors = {};
  let isDark = true;
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
    if (theme?.isDark !== undefined) isDark = theme.isDark;
  } catch {}

  return (
    <View
      style={[
        s.environmentBanner,
        {
          backgroundColor: isDark ? "#0D0D10" : "#E2E8F0",
          borderBottomColor: colors.border || (isDark ? "#1A1A1F" : "#CBD5E1"),
        },
      ]}
      accessibilityLabel="STAGING INTERNAL build"
    >
      <View style={s.envDot} />
      <Text style={[s.environmentText, { color: isDark ? "#A1A1AA" : "#4B5563" }]}>BETA</Text>
      <Text style={[s.environmentSub, { color: isDark ? "#71717A" : "#64748B" }]}>SCORES STAGING</Text>
    </View>
  );
}

const HomeBrandHeader = memo(function HomeBrandHeader({ onOpenSearch, onOpenProfile, userAvatar, language = "my" }) {
  let colors = { bg: "#000000", border: "#18181C", text: "#FFFFFF", secondary: "#C4C4CC" };
  let isDark = true;
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
    if (theme?.isDark !== undefined) isDark = theme.isDark;
  } catch {}

  return (
    <View
      style={[
        s.homeBrandHeader,
        {
          backgroundColor: colors.bg,
          borderBottomColor: colors.border || (isDark ? "#18181C" : "#E2E8F0"),
        },
      ]}
      accessibilityRole="header"
    >
      <View style={s.brandLeft}>
        <View style={s.brandRedBar} />
        <Text style={s.brandWordMST}>MST</Text>
        <Text style={[s.brandWordScores, { color: colors.text }]}>SCORES</Text>
      </View>
      <View style={s.brandRight}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search teams, players or matches"
          onPress={onOpenSearch}
          style={s.headerIconButton}
        >
          <Ionicons name="search" size={20} color={colors.secondary || "#C4C4CC"} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account and Profile"
          onPress={onOpenProfile}
          style={s.headerIconButton}
        >
          {userAvatar ? (
            <Image source={{ uri: userAvatar }} style={s.headerAvatarSmall} />
          ) : (
            <Ionicons name="person-circle-outline" size={26} color={colors.secondary || "#C4C4CC"} />
          )}
        </Pressable>
      </View>
    </View>
  );
});

const MstQuickBar = memo(function MstQuickBar({ onSelectNav, onOpenPrediction, onOpenSocial, language = "my" }) {
  let colors = { bg: "#000000", border: "#18181C", surface: "#121214", text: "#E4E4E7" };
  let isDark = true;
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
    if (theme?.isDark !== undefined) isDark = theme.isDark;
  } catch {}

  return (
    <View
      style={[
        s.quickBarWrap,
        {
          backgroundColor: colors.bg,
          borderBottomColor: colors.border || (isDark ? "#18181C" : "#E2E8F0"),
        },
      ]}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickBarScroll}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open MST Prediction"
          onPress={onOpenPrediction}
          style={({ pressed }) => [
            s.quickPill,
            {
              backgroundColor: isDark ? (colors.surface || "#121214") : (colors.card || "#FFFFFF"),
              borderColor: colors.border || (isDark ? "#1C1C20" : "#D5DAE0"),
            },
            pressed && { opacity: 0.75 },
          ]}
        >
          <View style={[s.quickIconCircle, { backgroundColor: "rgba(245,158,11,0.18)" }]}>
            <Ionicons name="trophy" size={13} color="#F59E0B" />
          </View>
          <Text numberOfLines={1} style={[s.quickPillText, { color: colors.text }]}>
            {language === "my" ? "ခန့်မှန်းချက်" : "Predict"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open VIP Tips"
          onPress={() => onSelectNav?.("tips")}
          style={({ pressed }) => [
            s.quickPill,
            {
              backgroundColor: isDark ? (colors.surface || "#121214") : (colors.card || "#FFFFFF"),
              borderColor: colors.border || (isDark ? "#1C1C20" : "#D5DAE0"),
            },
            pressed && { opacity: 0.75 },
          ]}
        >
          <View style={[s.quickIconCircle, { backgroundColor: "rgba(6,182,212,0.18)" }]}>
            <Ionicons name="diamond" size={13} color="#06B6D4" />
          </View>
          <Text numberOfLines={1} style={[s.quickPillText, { color: colors.text }]}>
            {language === "my" ? "VIP Tips" : "VIP Tips"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Football News"
          onPress={() => onSelectNav?.("news")}
          style={({ pressed }) => [
            s.quickPill,
            {
              backgroundColor: isDark ? (colors.surface || "#121214") : (colors.card || "#FFFFFF"),
              borderColor: colors.border || (isDark ? "#1C1C20" : "#D5DAE0"),
            },
            pressed && { opacity: 0.75 },
          ]}
        >
          <View style={[s.quickIconCircle, { backgroundColor: "rgba(16,185,129,0.18)" }]}>
            <Ionicons name="newspaper" size={13} color="#10B981" />
          </View>
          <Text numberOfLines={1} style={[s.quickPillText, { color: colors.text }]}>
            {language === "my" ? "သတင်း" : "News"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Follow MST on Social"
          onPress={onOpenSocial}
          style={({ pressed }) => [
            s.quickPill,
            {
              backgroundColor: isDark ? (colors.surface || "#121214") : (colors.card || "#FFFFFF"),
              borderColor: colors.border || (isDark ? "#1C1C20" : "#D5DAE0"),
            },
            pressed && { opacity: 0.75 },
          ]}
        >
          <View style={[s.quickIconCircle, { backgroundColor: "rgba(59,130,246,0.18)" }]}>
            <Ionicons name="logo-facebook" size={13} color="#3B82F6" />
          </View>
          <Text numberOfLines={1} style={[s.quickPillText, { color: colors.text }]}>
            {language === "my" ? "MST Social" : "Follow MST"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
});

const BottomNavigation = memo(function BottomNavigation({ active, onSelect, language = "my" }) {
  let colors = { bg: "#000000", border: "#18181C", surface: "#000000", red: T.color.red, muted: "#71717A" };
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
  } catch {}

  return (
    <View style={[s.bottomNav, { backgroundColor: colors.bg || "#000000", borderTopColor: colors.border || "#18181C" }]} accessibilityRole="tablist">
      {NAV_ITEMS.map((item) => {
        const selected = active === item.id;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={s.navItem}
          >
            <Ionicons
              name={selected ? item.activeIcon : item.icon}
              size={21}
              color={selected ? T.color.red : colors.muted}
            />
            <Text numberOfLines={1} style={[s.navLabel, { color: selected ? T.color.red : colors.muted }, selected && s.navLabelActive]}>
              {t(item.id, language) || item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

function RequestId({ label, value }) {
  if (!value) return null;
  return <Text selectable style={s.requestId}>{label} request_id: {value}</Text>;
}

function TerminalState({ loading, error, empty, emptyTitle = "No matches available", emptyText, onRetry, language = "en" }) {
  if (!loading && !error && !empty) return null;
  let colors = { surface: T.color.surface, border: T.color.border, text: T.color.text, muted: T.color.muted };
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
  } catch {}

  return (
    <View style={[s.stateCard, { backgroundColor: colors.surface || colors.card || T.color.surface, borderColor: colors.border }]}>
      {loading ? (
        <ActivityIndicator color={colors.red || T.color.red} />
      ) : (
        <Ionicons
          name={error ? "cloud-offline-outline" : "football-outline"}
          size={27}
          color={error ? (colors.gold || T.color.amber) : colors.muted}
        />
      )}
      <Text style={[s.stateTitle, { color: colors.text }]}>
        {loading
          ? (language === "my" ? t("loadingMatchData", "my") : "Loading match data…")
          : error
            ? (language === "my" ? t("scoresServiceUnavailable", "my") : "Scores service unavailable")
            : emptyTitle}
      </Text>
      <Text style={[s.stateText, { color: colors.muted }]}>
        {loading
          ? (language === "my" ? t("loadingTimeoutMsg", "my") : "The request stops after 8 seconds if the Scores service does not respond.")
          : error || emptyText || (language === "my" ? "ရွေးချယ်ထားသော ပွဲစဉ်များ မရှိသေးပါ။" : "The selected match view is empty.")}
      </Text>
      {!loading && onRetry ? (
        <Pressable accessibilityRole="button" style={[s.primaryButton, { backgroundColor: colors.red || T.color.red }]} onPress={onRetry}>
          <Ionicons name="refresh" size={16} color="#FFFFFF" />
          <Text style={[s.primaryButtonText, { color: "#FFFFFF" }]}>{language === "my" ? t("retry", "my") : "RETRY"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const KNOWN_TEAM_LOGOS = {
  "arsenal": "https://media.api-sports.io/football/teams/42.png",
  "chelsea": "https://media.api-sports.io/football/teams/49.png",
  "liverpool": "https://media.api-sports.io/football/teams/40.png",
  "manchester united": "https://media.api-sports.io/football/teams/33.png",
  "man utd": "https://media.api-sports.io/football/teams/33.png",
  "manchester city": "https://media.api-sports.io/football/teams/50.png",
  "man city": "https://media.api-sports.io/football/teams/50.png",
  "tottenham": "https://media.api-sports.io/football/teams/47.png",
  "tottenham hotspur": "https://media.api-sports.io/football/teams/47.png",
  "real madrid": "https://media.api-sports.io/football/teams/541.png",
  "barcelona": "https://media.api-sports.io/football/teams/529.png",
  "atletico madrid": "https://media.api-sports.io/football/teams/530.png",
  "atlético madrid": "https://media.api-sports.io/football/teams/530.png",
  "bayern munich": "https://media.api-sports.io/football/teams/157.png",
  "bayern": "https://media.api-sports.io/football/teams/157.png",
  "borussia dortmund": "https://media.api-sports.io/football/teams/165.png",
  "dortmund": "https://media.api-sports.io/football/teams/165.png",
  "paris saint-germain": "https://media.api-sports.io/football/teams/85.png",
  "psg": "https://media.api-sports.io/football/teams/85.png",
  "inter": "https://media.api-sports.io/football/teams/505.png",
  "inter milan": "https://media.api-sports.io/football/teams/505.png",
  "ac milan": "https://media.api-sports.io/football/teams/489.png",
  "milan": "https://media.api-sports.io/football/teams/489.png",
  "juventus": "https://media.api-sports.io/football/teams/496.png",
  "aston villa": "https://media.api-sports.io/football/teams/66.png",
  "newcastle": "https://media.api-sports.io/football/teams/34.png",
  "bayer leverkusen": "https://media.api-sports.io/football/teams/168.png",
  "leverkusen": "https://media.api-sports.io/football/teams/168.png",
};

const KNOWN_COMP_LOGOS = {
  "premier league": "https://media.api-sports.io/football/leagues/39.png",
  "uefa champions league": "https://media.api-sports.io/football/leagues/2.png",
  "champions league": "https://media.api-sports.io/football/leagues/2.png",
  "la liga": "https://media.api-sports.io/football/leagues/140.png",
  "serie a": "https://media.api-sports.io/football/leagues/135.png",
  "bundesliga": "https://media.api-sports.io/football/leagues/78.png",
  "ligue 1": "https://media.api-sports.io/football/leagues/61.png",
  "uefa europa league": "https://media.api-sports.io/football/leagues/3.png",
  "europa league": "https://media.api-sports.io/football/leagues/3.png",
  "fifa world cup": "https://media.api-sports.io/football/leagues/1.png",
  "world cup": "https://media.api-sports.io/football/leagues/1.png",
};

function TeamMark({ name, uri, size = 24 }) {
  const [failed, setFailed] = useState(false);
  const cleanName = String(name || "").trim().toLowerCase();
  const effectiveUri = (!failed && uri) ? uri : (KNOWN_TEAM_LOGOS[cleanName] || KNOWN_COMP_LOGOS[cleanName] || null);

  if (effectiveUri) {
    return (
      <Image
        source={{ uri: effectiveUri }}
        style={{ width: size, height: size }}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    );
  }
  const initials = String(name || "?").trim().slice(0, 2).toUpperCase();
  return (
    <View style={[s.fallbackMark, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.fallbackMarkText, { fontSize: size < 22 ? 9 : 11 }]}>{initials}</Text>
    </View>
  );
}

const MatchRow = memo(function MatchRow({ match, onOpen, language = "en" }) {
  let colors = { text: "#111827", muted: "#6B7280", border: "#E5E7EB", red: T.color.red, surface: "#FFFFFF", card: "#FFFFFF" };
  let isDark = false;
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
    if (theme?.isDark !== undefined) isDark = theme.isDark;
  } catch {}

  const id = canonicalMatchId(match);
  const live = isLive(match);
  const finished = isFinished(match);

  const red = colors.red || T.color.red;
  const textColor = isDark ? (colors.text || "#FFFFFF") : "#111827";
  const mutedColor = isDark ? (colors.muted || "#8E8E93") : "#8E9297";

  const statusStr = String(match?.status || match?.statusCode || "").trim().toLowerCase();
  const isPostponed = ["pst", "postponed", "delayed"].includes(statusStr);
  const isCancelled = ["canc", "cancelled", "canceled"].includes(statusStr);
  const isAbandoned = ["abd", "abandoned", "interrupted"].includes(statusStr);

  let timeLabel = "";
  let statusColor = textColor;
  if (isPostponed) {
    timeLabel = "PST";
    statusColor = colors.gold || T.color.amber;
  } else if (isCancelled) {
    timeLabel = "CANC";
    statusColor = red;
  } else if (isAbandoned) {
    timeLabel = "ABD";
    statusColor = red;
  } else if (live) {
    if (["ht", "halftime"].includes(statusStr)) timeLabel = "HT";
    else if (match?.minute != null) timeLabel = `${match.minute}'`;
    else timeLabel = "LIVE";
    statusColor = red;
  } else if (finished) {
    timeLabel = "FT";
    statusColor = mutedColor;
  } else {
    timeLabel = kickoffText(match?.kickoff_at || match?.kickoff);
    statusColor = textColor;
  }

  const homeScoreVal = match?.home_score ?? match?.homeScore;
  const awayScoreVal = match?.away_score ?? match?.awayScore;
  const hasScores = !isPostponed && !isCancelled && !isAbandoned && (live || finished) && homeScoreVal != null && awayScoreVal != null;

  const homeWin = finished && hasScores && Number(homeScoreVal) > Number(awayScoreVal);
  const awayWin = finished && hasScores && Number(awayScoreVal) > Number(homeScoreVal);

  const homeName = match?.home_team_name || match?.homeTeam?.name || match?.home?.name || "Home";
  const awayName = match?.away_team_name || match?.awayTeam?.name || match?.away?.name || "Away";
  const homeLogo = match?.home_team_logo_url || match?.homeTeam?.logo || match?.home?.logo;
  const awayLogo = match?.away_team_logo_url || match?.awayTeam?.logo || match?.away?.logo;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${homeName} vs ${awayName}`}
      onPress={() => id && onOpen(match)}
      style={({ pressed }) => [
        s.fotmobRow,
        {
          backgroundColor: isDark ? (colors.surface || "#121214") : "#FFFFFF",
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      {/* Live Accent Bar on left edge */}
      {live && <View style={[s.liveAccentBar, { backgroundColor: red }]} />}

      {/* Time / Status Column (52dp fixed) */}
      <View style={s.fotmobTimeCol}>
        <Text
          numberOfLines={1}
          style={[
            s.fotmobTimeText,
            { color: statusColor },
            (live || isPostponed || isCancelled) && { fontWeight: "900" },
          ]}
        >
          {timeLabel}
        </Text>
        {live && (
          <View style={[s.fotmobLivePill, { backgroundColor: red }]}>
            <Text style={s.fotmobLivePillText}>LIVE</Text>
          </View>
        )}
      </View>

      {/* Vertical divider */}
      <View style={[s.fotmobDivider, { backgroundColor: isDark ? "#22222A" : "#F0F2F5" }]} />

      {/* Teams and Scores (FotMob Stacked Layout - Full Width!) */}
      <View style={s.fotmobTeamsCol}>
        {/* Home Team */}
        <View style={s.fotmobTeamRow}>
          <TeamMark name={homeName} uri={homeLogo} size={20} />
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              s.fotmobTeamText,
              {
                color: homeWin ? textColor : (finished ? mutedColor : textColor),
                fontWeight: homeWin ? "800" : (live ? "700" : "600"),
              },
            ]}
          >
            {homeName}
          </Text>
          {hasScores && (
            <Text style={[s.fotmobScoreNum, { color: homeWin ? textColor : mutedColor, fontWeight: homeWin ? "900" : "600" }]}>
              {homeScoreVal}
            </Text>
          )}
        </View>

        {/* Away Team */}
        <View style={s.fotmobTeamRow}>
          <TeamMark name={awayName} uri={awayLogo} size={20} />
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              s.fotmobTeamText,
              {
                color: awayWin ? textColor : (finished ? mutedColor : textColor),
                fontWeight: awayWin ? "800" : (live ? "700" : "600"),
              },
            ]}
          >
            {awayName}
          </Text>
          {hasScores && (
            <Text style={[s.fotmobScoreNum, { color: awayWin ? textColor : mutedColor, fontWeight: awayWin ? "900" : "600" }]}>
              {awayScoreVal}
            </Text>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={14} color={mutedColor} style={s.fotmobChevron} />
    </Pressable>
  );
});

const LeagueGroup = memo(function LeagueGroup({ group, isCollapsed = false, onToggleCollapse, onOpen, onOpenEntity, language = "en" }) {
  let colors = { surface: "#FFFFFF", border: "#E5E7EB", secondary: "#6B7280", muted: "#8E9297", text: "#111827", card: "#FFFFFF" };
  let isDark = false;
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
    if (theme?.isDark !== undefined) isDark = theme.isDark;
  } catch {}

  const liveCount = group.matches.filter(isLive).length;

  return (
    <View
      style={[
        s.leagueCard,
        {
          backgroundColor: isDark ? (colors.surface || "#121214") : "#FFFFFF",
          borderColor: isDark ? "#202026" : "#E5E7EB",
        },
      ]}
    >
      <Pressable
        onPress={() => onToggleCollapse?.(group.id)}
        style={[
          s.leagueHeader,
          {
            backgroundColor: isDark ? "#17171C" : "#F8F9FA",
            borderBottomColor: isDark ? "#202026" : "#EBECEF",
          },
        ]}
      >
        <TeamMark name={group.name} uri={group.logo} size={20} />
        <Text numberOfLines={1} style={[s.leagueName, { color: isDark ? "#FFFFFF" : "#111827" }]}>
          {group.name}
        </Text>
        {liveCount > 0 && (
          <View style={s.leagueLivePill}>
            <View style={s.leagueLiveDot} />
            <Text style={s.leagueLivePillText}>{liveCount} LIVE</Text>
          </View>
        )}
        <View style={[s.leagueCountBadge, { backgroundColor: isDark ? "#22222A" : "#EAEDF2", borderColor: isDark ? "#2A2A34" : "#DDE1E6" }]}>
          <Text style={[s.leagueCountText, { color: isDark ? "#A1A1AA" : "#5A636E" }]}>
            {group.matches.length}
          </Text>
        </View>
        <Ionicons
          name={isCollapsed ? "chevron-down" : "chevron-up"}
          size={16}
          color={isDark ? "#A1A1AA" : "#6B7280"}
          style={{ marginLeft: 2 }}
        />
      </Pressable>
      {!isCollapsed && group.matches.map((match, idx) => (
        <View key={canonicalMatchId(match)}>
          {idx > 0 && (
            <View
              style={[
                s.matchDivider,
                { backgroundColor: isDark ? "#1C1C22" : "#F0F2F5" },
              ]}
            />
          )}
          <MatchRow match={match} onOpen={onOpen} language={language} />
        </View>
      ))}
    </View>
  );
});

const BigMatchPreview = memo(function BigMatchPreview({ match, onOpenPreview, onOpenMatch, language = "my" }) {
  if (!match) return null;
  let colors = { surface: T.color.surface, border: T.color.border, secondary: T.color.secondary, muted: T.color.muted, text: T.color.text, card: T.color.surface };
  let isDark = true;
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
    if (theme?.isDark !== undefined) isDark = theme.isDark;
  } catch {}

  const homeName = match?.home_team_name || "Home";
  const awayName = match?.away_team_name || "Away";

  return (
    <View
      style={[
        s.bigMatchCard,
        {
          backgroundColor: isDark ? (colors.surface || "#121214") : (colors.card || "#FFFFFF"),
          borderColor: colors.border || (isDark ? "#1C1C20" : "#D5DAE0"),
        },
      ]}
    >
      <View style={s.bigMatchHeaderRow}>
        <View style={s.bigMatchTagWrap}>
          <View style={s.bigMatchTagDot} />
          <Text style={s.bigMatchEyebrow}>MST MATCH PREVIEW</Text>
        </View>
        <Text style={[s.bigMatchComp, { color: colors.muted }]}>{match?.competition_name || "Football"}</Text>
      </View>
      <View style={s.bigMatchTeams}>
        <View style={s.bigTeam}>
          <TeamMark name={homeName} uri={match?.home_team_logo_url} size={42} />
          <Text numberOfLines={2} style={[s.bigTeamName, { color: colors.text }]}>
            {homeName}
          </Text>
        </View>
        <View style={s.bigVersus}>
          <Text style={s.bigVs}>VS</Text>
          <Text style={[s.bigKickoff, { color: colors.muted }]}>{fullKickoff(match?.kickoff_at)}</Text>
        </View>
        <View style={s.bigTeam}>
          <TeamMark name={awayName} uri={match?.away_team_logo_url} size={42} />
          <Text numberOfLines={2} style={[s.bigTeamName, { color: colors.text }]}>
            {awayName}
          </Text>
        </View>
      </View>
      <View style={s.bigMatchActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpenPreview(match)}
          style={s.previewCta}
        >
          <Ionicons name="document-text-outline" size={14} color="#FFFFFF" />
          <Text style={s.previewCtaText}>{t("readFullPreview", language)}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpenMatch(match)}
          style={[
            s.matchCenterCta,
            {
              backgroundColor: isDark ? "#18181C" : "#F3F5F8",
              borderColor: colors.border || (isDark ? "#202024" : "#D5DAE0"),
            },
          ]}
        >
          <Ionicons name="football-outline" size={14} color={colors.secondary || T.color.secondary} />
          <Text style={[s.matchCenterCtaText, { color: colors.text }]}>{t("matchCenter", language)}</Text>
        </Pressable>
      </View>
    </View>
  );
});

const DateNavigation = memo(function DateNavigation({ selected, onSelect, language = "my" }) {
  const dates = useMemo(() => dateWindow(new Date(), 45, 45), []);
  const todayKey = dateKey(new Date());
  const scrollRef = useRef(null);
  const { width: windowWidth } = useWindowDimensions();
  const CELL_WIDTH = 48;
  const GAP = 6;
  const totalCellWidth = CELL_WIDTH + GAP;
  const todayIndex = 45; // index of today in 45 past, today, 45 future

  let colors = { bg: "#000000", border: "#18181C", surface: "#16161A", text: "#FFFFFF", muted: "#71717A", red: T.color.red };
  let isDark = true;
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
    if (theme?.isDark !== undefined) isDark = theme.isDark;
  } catch {}

  const [containerWidth, setContainerWidth] = useState(windowWidth);

  // When contentContainer has paddingHorizontal: (containerWidth - CELL_WIDTH) / 2,
  // the first item (idx = 0) is centered at x = 0.
  // Therefore, item idx is centered at EXACTLY x = idx * totalCellWidth!
  const getCenterOffset = useCallback((key) => {
    const idx = dates.findIndex((d) => dateKey(d) === key);
    const useIdx = idx >= 0 ? idx : todayIndex;
    return useIdx * totalCellWidth;
  }, [dates, todayIndex, totalCellWidth]);

  const initialOffset = useMemo(() => {
    return getCenterOffset(selected || todayKey);
  }, [getCenterOffset, selected, todayKey]);

  const centerDate = useCallback((key, animated = true) => {
    if (scrollRef.current) {
      const targetOffset = getCenterOffset(key);
      scrollRef.current.scrollTo({ x: targetOffset, animated });
    }
  }, [getCenterOffset]);

  // Re-center whenever selected date changes, with staggered retries for Android layout
  useEffect(() => {
    centerDate(selected || todayKey, false);
    const t1 = setTimeout(() => centerDate(selected || todayKey, false), 50);
    const t2 = setTimeout(() => centerDate(selected || todayKey, false), 150);
    const t3 = setTimeout(() => centerDate(selected || todayKey, true), 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [selected, todayKey, centerDate]);

  const handleContentSizeChange = useCallback(() => {
    centerDate(selected || todayKey, false);
  }, [centerDate, selected, todayKey]);

  const handleLayout = (e) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      setContainerWidth(w);
      centerDate(selected || todayKey, false);
    }
  };

  const hPad = Math.max(8, (containerWidth - CELL_WIDTH) / 2);

  return (
    <View style={[s.dateNavWrapper, { backgroundColor: colors.bg, borderBottomColor: colors.border || (isDark ? "#18181C" : "#E2E8F0") }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: initialOffset, y: 0 }}
        contentContainerStyle={[s.dateStrip, { paddingHorizontal: hPad }]}
        onLayout={handleLayout}
        onContentSizeChange={handleContentSizeChange}
        decelerationRate="fast"
        scrollEventThrottle={16}
      >
        {dates.map((date) => {
          const key = dateKey(date);
          const active = selected === key;
          const isToday = key === todayKey;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(key)}
              style={[
                s.dateCell,
                active && [
                  s.dateCellActive,
                  {
                    backgroundColor: isDark ? "#16161A" : "#FFFFFF",
                    borderColor: isDark ? "#282830" : colors.border,
                  },
                ],
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  s.dateDayText,
                  { color: colors.muted },
                  active && [s.dateDayTextActive, { color: colors.red || T.color.red }],
                ]}
              >
                {isToday ? (language === "my" ? "ယနေ့" : "TODAY") : dayLabel(date, language).toUpperCase()}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  s.dateNumText,
                  { color: isDark ? "#A1A1AA" : "#374151" },
                  active && [s.dateNumTextActive, { color: colors.text }],
                ]}
              >
                {date.getDate()}
              </Text>
              {active && <View style={[s.dateActiveLine, { backgroundColor: colors.red || T.color.red }]} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

function MatchesScreen({
  overview,
  onOpenMatch,
  onOpenPreview,
  onOpenEntity,
  onRetry,
  onOpenSearch,
  onOpenProfile,
  onSelectNav,
  onOpenPrediction,
  onOpenSocial,
  userAvatar,
  language = "my",
  todayResetTrigger = 0,
}) {
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [dateMatches, setDateMatches] = useState({});
  const [dateLoading, setDateLoading] = useState(false);
  const [filter, setFilter] = useState("all"); // "all" | "live" | "favorites"
  const [favData, setFavData] = useState({ teams: [], matches: [] });

  useEffect(() => {
    if (todayResetTrigger > 0) {
      setSelectedDate(dateKey(new Date()));
    }
  }, [todayResetTrigger]);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    let alive = true;
    getFavorites()
      .then((favs) => {
        if (alive && favs) setFavData(favs);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    if (dateMatches[selectedDate]) return;

    // 1. Immediately read from local disk cache to eliminate cold loading delay
    AsyncStorage.getItem(`mst:cache:matches:${selectedDate}`)
      .then((cached) => {
        if (!alive || !cached) return;
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDateMatches((prev) => ({ ...prev, [selectedDate]: parsed }));
          }
        } catch (_) {}
      })
      .catch(() => {});

    // 2. Silently fetch fresh data from backend
    setDateLoading(true);
    loadScoresForDate(selectedDate)
      .then((result) => {
        if (!alive) return;
        const fresh = result?.matches || [];
        setDateMatches((prev) => ({ ...prev, [selectedDate]: fresh }));
        if (fresh.length > 0) {
          AsyncStorage.setItem(`mst:cache:matches:${selectedDate}`, JSON.stringify(fresh)).catch(() => {});
        }
      })
      .catch(() => {
        if (!alive) return;
        const fallback = overview.matches.filter((match) => dateKey(match?.kickoff_at) === selectedDate);
        if (fallback.length > 0) {
          setDateMatches((prev) => ({ ...prev, [selectedDate]: fallback }));
        }
      })
      .finally(() => {
        if (alive) setDateLoading(false);
      });

    return () => { alive = false; };
  }, [selectedDate, overview.matches]);

  const selectedMatches = useMemo(() => {
    if (dateMatches[selectedDate]) return dateMatches[selectedDate];
    return overview.matches.filter((match) => dateKey(match?.kickoff_at) === selectedDate);
  }, [dateMatches, overview.matches, selectedDate]);

  const filteredMatches = useMemo(() => {
    let list = selectedMatches;
    if (filter === "live") {
      list = list.filter(isLive);
    } else if (filter === "favorites") {
      const favTeamIds = new Set((favData?.teams || []).map((t) => String(t.id)));
      const favMatchIds = new Set((favData?.matches || []).map((m) => String(m.id)));
      list = list.filter((m) =>
        favTeamIds.has(String(m?.home_team_id)) ||
        favTeamIds.has(String(m?.away_team_id)) ||
        favMatchIds.has(canonicalMatchId(m))
      );
    }
    return list;
  }, [selectedMatches, filter, favData]);

  const [collapsedLeagues, setCollapsedLeagues] = useState(() => new Set());
  const toggleLeague = useCallback((id) => {
    setCollapsedLeagues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const featuredMatch = useMemo(() => {
    return filteredMatches.find((m) => isLive(m) || matchHasBigTeam(m)) || filteredMatches[0] || null;
  }, [filteredMatches]);

  const groups = useMemo(() => {
    const list = groupByCompetition(filteredMatches);
    return list;
  }, [filteredMatches]);

  // Performance optimization: auto-collapse minor leagues beyond top 6 to prevent mounting 300+ views at once
  useEffect(() => {
    if (groups.length > 6) {
      setCollapsedLeagues((prev) => {
        const next = new Set(prev);
        for (let i = 6; i < groups.length; i++) {
          next.add(groups[i].id);
        }
        return next;
      });
    }
  }, [groups]);

  const handleRefresh = useCallback(async () => {
    setDateLoading(true);
    try {
      const result = await loadScoresForDate(selectedDate);
      const fresh = result?.matches || [];
      setDateMatches((prev) => ({ ...prev, [selectedDate]: fresh }));
      if (fresh.length > 0) {
        AsyncStorage.setItem(`mst:cache:matches:${selectedDate}`, JSON.stringify(fresh)).catch(() => {});
      }
      if (onRetry) await Promise.resolve(onRetry()).catch(() => {});
    } finally {
      setDateLoading(false);
    }
  }, [selectedDate, onRetry]);

  const handlePrevDate = useCallback(() => {
    const parts = (selectedDate || "").split("-").map(Number);
    const d = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0) : new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(dateKey(d));
  }, [selectedDate]);

  const handleNextDate = useCallback(() => {
    const parts = (selectedDate || "").split("-").map(Number);
    const d = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0) : new Date();
    d.setDate(d.getDate() + 1);
    setSelectedDate(dateKey(d));
  }, [selectedDate]);

  const onTouchStart = (e) => {
    touchStartX.current = e.nativeEvent.pageX;
    touchStartY.current = e.nativeEvent.pageY;
  };

  const onTouchEnd = (e) => {
    const dx = e.nativeEvent.pageX - touchStartX.current;
    const dy = e.nativeEvent.pageY - touchStartY.current;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0) handlePrevDate();
      else handleNextDate();
    }
  };

  let colors = { surface: "#FFFFFF", border: "#E5E7EB", secondary: "#6B7280", muted: "#8E9297", text: "#111827", card: "#FFFFFF", red: T.color.red };
  let isDark = true;
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
    if (theme?.isDark !== undefined) isDark = theme.isDark;
  } catch {}

  return (
    <View style={s.flex}>
      <HomeBrandHeader
        onOpenSearch={onOpenSearch}
        onOpenProfile={onOpenProfile}
        userAvatar={userAvatar}
        language={language}
      />
      <DateNavigation selected={selectedDate} onSelect={setSelectedDate} language={language} />
      <MstQuickBar
        onSelectNav={onSelectNav}
        onOpenPrediction={onOpenPrediction}
        onOpenSocial={onOpenSocial}
        language={language}
      />
      <View
        style={s.flex}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <ScrollView
          nestedScrollEnabled
          contentContainerStyle={s.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={dateLoading}
              onRefresh={handleRefresh}
              tintColor={T.color.red}
              colors={[T.color.red]}
            />
          }
        >
          <View style={s.filterRow}>
            <View style={s.filterChipsGroup}>
              {[
                { id: "all", label: t("allMatches", language) },
                { id: "live", label: t("liveOnly", language) },
                { id: "favorites", label: t("favorites", language) },
              ].map((f) => {
                const active = filter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setFilter(f.id)}
                    style={[
                      s.filterChip,
                      {
                        backgroundColor: active
                          ? (colors.red || T.color.red)
                          : (isDark ? "#121214" : "#FFFFFF"),
                        borderColor: active
                          ? (colors.red || T.color.red)
                          : (isDark ? "#1C1C20" : "#E5E7EB"),
                      },
                    ]}
                  >
                    {f.id === "live" && <View style={[s.filterLiveDot, active && s.filterLiveDotActive]} />}
                    <Text
                      style={[
                        s.filterChipText,
                        { color: active ? "#FFFFFF" : (isDark ? "#A1A1AA" : "#4B5563") },
                        active && s.filterChipTextActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {filteredMatches.length > 0 ? (
              <Text style={[s.matchCountCompact, { color: isDark ? "#71717A" : "#6B7280" }]}>
                {t("matchesCount", language, { count: filteredMatches.length })}
              </Text>
            ) : null}
          </View>

          {filteredMatches.length === 0 && (overview.loading || dateLoading) ? (
            <MatchListSkeleton isDark={isDark} />
          ) : (
            <TerminalState
              loading={false}
              error={overview.error}
              empty={!overview.loading && !dateLoading && !overview.error && filteredMatches.length === 0}
              emptyTitle={
                language === "my"
                  ? (filter === "live" ? "တိုက်ရိုက်ပွဲစဉ်များ မရှိသေးပါ" : filter === "favorites" ? "အကြိုက်ဆုံးပွဲစဉ်များ မရှိသေးပါ" : t("noMatchesScheduled", language))
                  : (filter === "live" ? "No live matches" : filter === "favorites" ? "No favorite matches" : "No matches scheduled")
              }
              emptyText={
                language === "my"
                  ? (filter === "live"
                      ? "လတ်တလော တိုက်ရိုက်ကစားနေသော ပွဲစဉ် မရှိသေးပါ။ ပွဲစဉ်အားလုံးကို ကြည့်ရှုရန် 'ပွဲအားလုံး' ကို နှိပ်ပါ။"
                      : filter === "favorites"
                        ? "သင် အကြိုက်ဆုံးအဖြစ် ရွေးထားသော အသင်းများ ယနေ့ ပွဲစဉ်မရှိသေးပါ။ အသင်းများကို အကြိုက်ဆုံးစာရင်း ထည့်သွင်းရန် ကြယ်ပွင့်ကို နှိပ်ပါ။"
                        : t("noMatchesSub", language))
                  : (filter === "live"
                      ? "No matches are live right now. Switch to 'All Matches' to view the full fixture schedule."
                      : filter === "favorites"
                        ? "None of your favorited teams are playing on this date. Tap the star on any match or team to follow."
                        : "No real match is scheduled for this date. Choose another date or retry.")
              }
              onRetry={handleRefresh}
              language={language}
            />
          )}

          {featuredMatch && filter === "all" && groups.length > 0 && (
            <BigMatchPreview
              match={featuredMatch}
              onOpenPreview={onOpenPreview}
              onOpenMatch={onOpenMatch}
              language={language}
            />
          )}

          {groups.map((group, idx) => {
            // Distribute multiple AdMob units throughout the match list after league sections
            // Frequency limit: placed after 2nd league (idx 1), 5th league (idx 4), and 9th league (idx 8) - max 3 banners
            const renderAd = idx === 1 || idx === 4 || idx === 8;
            return (
              <React.Fragment key={group.id}>
                <LeagueGroup
                  group={group}
                  isCollapsed={collapsedLeagues.has(group.id)}
                  onToggleCollapse={toggleLeague}
                  onOpen={onOpenMatch}
                  onOpenEntity={onOpenEntity}
                  language={language}
                />
                {renderAd && <Phase4BAdBanner />}
              </React.Fragment>
            );
          })}
          {groups.length === 1 && <Phase4BAdBanner />}
        </ScrollView>
      </View>
    </View>
  );
}

function NewsScreen({ onOpenSearch, onOpenProfile, userAvatar, language = "my" }) {
  return (
    <View style={s.flex}>
      <ScreenHeader
        title={t("news", language)}
        subtitle={language === "my" ? "MST ဘောလုံးသတင်းများ" : "MST FOOTBALL EDITORIAL"}
        showMstBrand
        rightElement={
          <View style={s.headerActions}>
            <Pressable hitSlop={8} onPress={onOpenSearch} style={s.headerActionBtn}>
              <Ionicons name="search-outline" size={19} color={T.color.secondary} />
            </Pressable>
            <Pressable hitSlop={8} onPress={onOpenProfile} style={s.headerActionBtn}>
              {userAvatar ? (
                <Image source={{ uri: userAvatar }} style={s.headerAvatarSmall} />
              ) : (
                <Ionicons name="person-circle-outline" size={22} color={T.color.secondary} />
              )}
            </Pressable>
          </View>
        }
      />
      <ScrollView nestedScrollEnabled contentContainerStyle={s.scrollContent}>
        <Phase4BNewsPanel />
        <Phase4BAdBanner />
      </ScrollView>
    </View>
  );
}

function FavoritesScreen({ matches, onOpenMatch, onOpenSearch, onOpenProfile, userAvatar, onOpenEntity, onOpenSignIn, language = "my" }) {
  const [filter, setFilter] = useState("all"); // "all" | "teams" | "competitions"
  const realMatches = matches.slice(0, 2);
  let colors = T.color;
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
  } catch {}

  return (
    <View style={s.flex}>
      <ScreenHeader
        title={t("favorites", language)}
        subtitle={language === "my" ? "အသင်းများ · ပြိုင်ပွဲများ" : "TEAMS · COMPETITIONS"}
        showMstBrand
        rightElement={
          <View style={s.headerActions}>
            <Pressable hitSlop={8} onPress={onOpenSearch} style={s.headerActionBtn}>
              <Ionicons name="search-outline" size={19} color={colors.secondary || T.color.secondary} />
            </Pressable>
            <Pressable hitSlop={8} onPress={onOpenProfile} style={s.headerActionBtn}>
              {userAvatar ? (
                <Image source={{ uri: userAvatar }} style={s.headerAvatarSmall} />
              ) : (
                <Ionicons name="person-circle-outline" size={22} color={colors.secondary || T.color.secondary} />
              )}
            </Pressable>
          </View>
        }
      />
      <ScrollView nestedScrollEnabled contentContainerStyle={s.scrollContent}>
        <View style={[s.segmented, { backgroundColor: colors.surface || colors.card || T.color.surface, borderColor: colors.border }]}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === "all" }}
            onPress={() => setFilter("all")}
            style={[s.segment, filter === "all" && [s.segmentActive, { backgroundColor: colors.red }]]}
          >
            <Text style={filter === "all" ? s.segmentActiveText : [s.segmentText, { color: colors.muted }]}>{t("all", language)}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === "teams" }}
            onPress={() => setFilter("teams")}
            style={[s.segment, filter === "teams" && [s.segmentActive, { backgroundColor: colors.red }]]}
          >
            <Text style={filter === "teams" ? s.segmentActiveText : [s.segmentText, { color: colors.muted }]}>{t("teams", language)}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === "competitions" }}
            onPress={() => setFilter("competitions")}
            style={[s.segment, filter === "competitions" && [s.segmentActive, { backgroundColor: colors.red }]]}
          >
            <Text style={filter === "competitions" ? s.segmentActiveText : [s.segmentText, { color: colors.muted }]}>{t("competitions", language)}</Text>
          </Pressable>
        </View>
        <Phase4BFavoritesPanel
          filter={filter}
          onSelectEntity={onOpenEntity}
          onOpenSignIn={onOpenSignIn}
          language={language}
        />
        <View style={s.sectionHeadingRow}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>{t("realMatches", language)}</Text>
          <Text style={[s.matchCount, { color: colors.muted }]}>{t("notPersonalized", language)}</Text>
        </View>
        {realMatches.length ? (
          <View style={s.leagueCard}>
            {realMatches.map((match) => (
              <MatchRow key={canonicalMatchId(match)} match={match} onOpen={onOpenMatch} language={language} />
            ))}
          </View>
        ) : (
          <TerminalState
            empty
            emptyTitle={language === "my" ? "ပွဲစဉ် မရှိပါ" : "No matches"}
            emptyText={language === "my" ? "ဤနေရာတွင် ပြသရန် ပွဲစဉ် မရှိသေးပါ။" : "There are no real matches to show here."}
            language={language}
          />
        )}
      </ScrollView>
    </View>
  );
}

function TipsScreen({ featuredMatch, onOpenSearch, onOpenProfile, userAvatar, language = "my" }) {
  return (
    <View style={s.flex}>
      <ScreenHeader
        title="Tips"
        subtitle={language === "my" ? "TIPS · TIPSTERS · အဆင့်သတ်မှတ်ချက်" : "TIPS · TIPSTERS · LEADERBOARDS"}
        showMstBrand
        rightElement={
          <View style={s.headerActions}>
            <Pressable hitSlop={8} onPress={onOpenSearch} style={s.headerActionBtn}>
              <Ionicons name="search-outline" size={19} color={T.color.secondary} />
            </Pressable>
            <Pressable hitSlop={8} onPress={onOpenProfile} style={s.headerActionBtn}>
              {userAvatar ? (
                <Image source={{ uri: userAvatar }} style={s.headerAvatarSmall} />
              ) : (
                <Ionicons name="person-circle-outline" size={22} color={T.color.secondary} />
              )}
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={s.scrollContent}>
        <Phase4BReadOnlyHub language={language} />
        {featuredMatch ? <Phase4BMatchInsights match={featuredMatch} language={language} /> : null}
      </ScrollView>
    </View>
  );
}

function MatchDataSection({ title, value }) {
  const available = value !== undefined;
  return (
    <View style={s.dataSection}>
      <View style={s.dataSectionHeader}>
        <Text style={s.dataSectionTitle}>{title}</Text>
        <Text style={[s.availability, available && s.available]}>
          {" "}{available ? "AVAILABLE" : "UNAVAILABLE"}{" "}
        </Text>
      </View>
      <Text style={s.dataSectionText}>
        {available ? sectionSummary(value) : `The current Match detail response does not provide ${title}.`}
      </Text>
    </View>
  );
}

function TipPreview({ tip }) {
  return (
    <View style={s.tipCard}>
      <View style={s.tipTitleRow}>
        <Text style={s.tipTitle}>{tip.title}</Text>
        <Text style={[s.tipAccess, tip.locked ? s.tipLocked : s.tipFree]}>
          {tip.locked ? "LOCKED" : "FREE"}
        </Text>
      </View>
      {tip.summary ? <Text style={s.dependencyText}>{tip.summary}</Text> : null}
      <Text style={s.tipSelection}>
        {tip.locked ? "Selection protected by server authorization" : `Selection: ${tip.selection || "Unavailable"}`}
      </Text>
    </View>
  );
}

function StatBar({ label, homeVal, awayVal, colors }) {
  const h = Number(String(homeVal || "0").replace("%", "")) || 0;
  const a = Number(String(awayVal || "0").replace("%", "")) || 0;
  const total = h + a || 1;
  const homePct = Math.round((h / total) * 100);
  const awayPct = 100 - homePct;

  return (
    <View style={s.statRow}>
      <View style={s.statLabelRow}>
        <Text style={[s.statVal, { color: colors.text }]}>{homeVal ?? "—"}</Text>
        <Text style={[s.statLabel, { color: colors.muted }]}>{label}</Text>
        <Text style={[s.statVal, { color: colors.text }]}>{awayVal ?? "—"}</Text>
      </View>
      <View style={[s.statBarTrack, { backgroundColor: colors.raised || T.color.raised }]}>
        <View style={[s.statBarHome, { width: `${homePct}%`, backgroundColor: colors.red || T.color.red }]} />
        <View style={[s.statBarAway, { width: `${awayPct}%`, backgroundColor: colors.secondary || "#D7DBDF" }]} />
      </View>
    </View>
  );
}

function MatchCenter({ selectedMatch, onBack, onOpenPreview, onOpenEntity, language = "my" }) {
  const selectedId = canonicalMatchId(selectedMatch);
  const [tab, setTab] = useState("overview"); // "overview" | "timeline" | "lineups" | "stats" | "h2h" | "table" | "odds"
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: "", requestId: null });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  let colors = { surface: T.color.surface, border: T.color.border, text: T.color.text, muted: T.color.muted, secondary: T.color.secondary, red: T.color.red, raised: T.color.raised };
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
  } catch {}

  useEffect(() => {
    let active = true;
    setState({ loading: true, data: null, error: "", requestId: null });
    loadMatchCenter(selectedId)
      .then((data) => active && setState({ loading: false, data, error: "", requestId: data.requestIds.match }))
      .catch((error) => active && setState({ loading: false, data: null, error: error?.message || "Could not load Match Center.", requestId: error?.requestId || null }));
    return () => { active = false; };
  }, [attempt, selectedId]);

  const match = state.data?.match || selectedMatch;
  const preview = state.data?.preview;

  const openHomeTeam = () => {
    if (onOpenEntity && (match?.home_team_id || match?.home_team_name)) {
      onOpenEntity("team", { id: match?.home_team_id, name: match?.home_team_name, logo: match?.home_team_logo_url });
    }
  };

  const openAwayTeam = () => {
    if (onOpenEntity && (match?.away_team_id || match?.away_team_name)) {
      onOpenEntity("team", { id: match?.away_team_id, name: match?.away_team_name, logo: match?.away_team_logo_url });
    }
  };

  const openCompetition = () => {
    if (onOpenEntity && (match?.competition_id || match?.competition_name)) {
      onOpenEntity("competition", { id: match?.competition_id, name: match?.competition_name, logo: match?.competition_logo_url });
    }
  };

  const openPredictionApp = () => {
    Linking.openURL("mstprediction://").catch(() => {
      Linking.openURL("https://prediction.myanmarsportstalk.com").catch(() => {});
    });
  };

  // Extract facts from preview sections if present
  const previewSections = Array.isArray(preview?.sections) ? preview.sections : [];
  const getSectionFacts = (key) => {
    const sec = previewSections.find((s) => s?.key === key);
    return Array.isArray(sec?.facts) ? sec.facts : [];
  };

  const statsFacts = getSectionFacts("keyStatistics");
  const lineupsFacts = getSectionFacts("expectedStartingXi");
  const h2hFacts = getSectionFacts("headToHead");
  const formFacts = getSectionFacts("recentForm");
  const standingsFacts = getSectionFacts("competitionSituation");

  // Parse raw match events or timeline
  const matchEvents = Array.isArray(match?.events) ? match.events : [];
  const matchLineups = match?.lineups || null;
  const matchStats = match?.statistics || match?.stats || null;

  // Commentary feed items
  const commentaryList = useMemo(() => {
    const list = [];
    if (Array.isArray(matchEvents)) {
      for (const ev of matchEvents) {
        const detailStr = String(ev?.detail || "");
        const minute = ev?.time?.elapsed || ev?.minute || ev?.time || null;
        let text = detailStr;
        if (detailStr.includes(" — ")) {
          text = detailStr.split(" — ")[1];
        }
        text = text.replace(/\s*\[coords:\s*[\d.]+,[\d.]+\]/, "").trim();
        if (text) {
          list.push({
            minute,
            title: ev?.player?.name || ev?.playerName || ev?.player || (ev?.type ? String(ev.type).toUpperCase() : ""),
            text,
            type: ev?.type || "event",
          });
        }
      }
    }
    if (Array.isArray(match?.commentaries)) {
      for (const c of match.commentaries) {
        list.push({
          minute: c?.minute || c?.time || null,
          title: c?.title || "",
          text: String(c?.text || c?.commentary || "").trim(),
          type: "commentary",
        });
      }
    }
    return list;
  }, [matchEvents, match?.commentaries]);

  // Real Sportradar XY coordinates shot map
  const shotsWithCoords = useMemo(() => {
    if (!Array.isArray(matchEvents)) return [];
    return matchEvents
      .map((ev, idx) => {
        const detailStr = String(ev?.detail || "");
        const m = detailStr.match(/\[coords:\s*([\d.]+),([\d.]+)\]/);
        if (!m) return null;
        const x = parseFloat(m[1]);
        const y = parseFloat(m[2]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        const isGoal = String(ev?.type).toLowerCase() === "goal" || detailStr.toLowerCase().includes("goal");
        return {
          id: ev?.id || `shot-${idx}`,
          minute: ev?.time?.elapsed || ev?.minute || ev?.time || "—",
          x: Math.min(Math.max(x, 5), 95),
          y: Math.min(Math.max(y, 8), 92),
          player: ev?.player?.name || ev?.playerName || ev?.player || "Player",
          team: ev?.team?.name || (ev?.team === "home" ? match?.home_team_name : match?.away_team_name) || "Team",
          isGoal,
          detail: detailStr.replace(/\s*\[coords:.*?\]/, "").trim(),
        };
      })
      .filter(Boolean);
  }, [matchEvents, match?.home_team_name, match?.away_team_name]);

  return (
    <View style={s.flex}>
      <ScreenHeader
        title={match?.competition_name || "Match Center"}
        subtitle={match?.round || (language === "my" ? "ပွဲစဉ်အချက်အလက်" : "MATCH DETAILS")}
        onBack={onBack}
        rightElement={
          <Pressable hitSlop={10} style={s.headerActionBtn}>
            <Ionicons name="share-social-outline" size={20} color={colors.secondary || T.color.secondary} />
          </Pressable>
        }
      />

      {/* Sub-tab Navigation: OVERVIEW | TIMELINE | COMMENTARY | LINEUPS | STATS | SHOT MAP | H2H | TABLE | ODDS */}
      <View style={[s.mcTabContainer, { backgroundColor: colors.surface || T.color.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.mcTabStrip}>
          {[
            { id: "overview", label: t("mcOverview", language) },
            { id: "timeline", label: t("mcTimeline", language) },
            { id: "commentary", label: t("mcCommentary", language) },
            { id: "lineups", label: t("mcLineups", language) },
            { id: "stats", label: t("mcStats", language) },
            { id: "shotmap", label: t("mcShotMap", language) },
            { id: "h2h", label: t("mcH2H", language) },
            { id: "table", label: t("mcTable", language) },
            { id: "odds", label: t("mcOdds", language) },
          ].map((tItem) => {
            const active = tab === tItem.id;
            return (
              <Pressable
                key={tItem.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setTab(tItem.id);
                  trackEvent("match_center_tab_viewed", { matchId: selectedId, tab: tItem.id });
                }}
                style={[s.mcTabBtn, active && [s.mcTabBtnActive, { borderBottomColor: colors.red || T.color.red }]]}
              >
                <Text style={[s.mcTabText, { color: active ? (colors.text || "#FFFFFF") : (colors.muted || "#7E8890") }, active && s.mcTabTextActive]}>
                  {tItem.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={s.matchCenterContent}>
        <TerminalState loading={state.loading} error={state.error} onRetry={retry} language={language} />
        {!state.loading && !state.error ? (
          <>
            {/* HERO CARD - ALWAYS VISIBLE ACROSS ALL TABS */}
            <View style={[s.matchHero, { backgroundColor: colors.surface || T.color.surface, borderColor: colors.border }]}>
              <Pressable onPress={openCompetition} style={{ alignItems: "center" }}>
                <Text style={[s.heroCompetition, { color: colors.secondary || colors.text }]}>{match?.competition_name || "Football"}</Text>
              </Pressable>
              <Text style={[s.heroKickoff, { color: colors.muted }]}>{fullKickoff(match?.kickoff_at)}</Text>
              <View style={s.heroTeams}>
                <Pressable onPress={openHomeTeam} style={s.heroTeam}>
                  <TeamMark name={match?.home_team_name} uri={match?.home_team_logo_url} size={48} />
                  <Text numberOfLines={2} style={[s.heroTeamName, { color: colors.text }]}>{match?.home_team_name || "Home"}</Text>
                </Pressable>
                <View style={s.heroScoreWrap}>
                  <Text style={[s.heroScore, { color: colors.text }]}>{scoreText(match)}</Text>
                  <Text style={[s.heroStatus, isLive(match) && s.liveText]}>{statusText(match, language)}</Text>
                </View>
                <Pressable onPress={openAwayTeam} style={s.heroTeam}>
                  <TeamMark name={match?.away_team_name} uri={match?.away_team_logo_url} size={48} />
                  <Text numberOfLines={2} style={[s.heroTeamName, { color: colors.text }]}>{match?.away_team_name || "Away"}</Text>
                </Pressable>
              </View>
            </View>

            {/* TAB 1: OVERVIEW */}
            {tab === "overview" ? (
              <>
                {/* Compact Match Odds Card */}
                <MatchOddsCard
                  match={match}
                  compact
                  onOpenFull={() => setTab("odds")}
                />

                {/* Professional Match Preview CTA */}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenPreview(match)}
                  style={[s.matchCenterPreviewBanner, { backgroundColor: colors.surface || T.color.surface, borderColor: colors.border }]}
                >
                  <View style={s.matchCenterPreviewIcon}>
                    <Ionicons name="document-text" size={20} color={colors.red || T.color.red} />
                  </View>
                  <View style={s.flex}>
                    <Text style={[s.matchCenterPreviewTitle, { color: colors.text }]}>{t("previewCtaTitle", language)}</Text>
                    <Text style={[s.matchCenterPreviewSub, { color: colors.muted }]}>
                      {t("previewCtaSub", language)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>

                <Phase4BMatchFavorites match={match} />
                <Phase4BMatchVote match={match} />
                <Phase4BMatchInsights match={match} />

                {/* Rewarded Video MST Prediction for Major Matches */}
                {(matchHasBigTeam(match) || isBigTeam(match?.home_team_name) || isBigTeam(match?.away_team_name)) && (
                  <Phase4BRewardedPrediction
                    match={match}
                    language={language}
                    colors={colors}
                  />
                )}

                {/* Match Information */}
                <View style={[s.dataSection, { backgroundColor: colors.surface || T.color.surface, borderColor: colors.border }]}>
                  <View style={s.dataSectionHeader}>
                    <Text style={[s.dataSectionTitle, { color: colors.secondary || colors.text }]}>{t("matchInfo", language)}</Text>
                    <Text style={[s.availability, s.available]}>VERIFIED</Text>
                  </View>
                  <View style={s.infoGrid}>
                    <View style={s.infoCell}>
                      <Text style={s.infoLabel}>{language === "my" ? "ပွဲစချိန်" : "KICKOFF"}</Text>
                      <Text style={[s.infoValue, { color: colors.secondary || colors.text }]}>{fullKickoff(match?.kickoff_at)}</Text>
                    </View>
                    <View style={s.infoCell}>
                      <Text style={s.infoLabel}>{language === "my" ? "ဘောလုံးကွင်း" : "VENUE"}</Text>
                      <Text style={[s.infoValue, { color: colors.secondary || colors.text }]}>{match?.venue_name || "Unavailable"}</Text>
                    </View>
                    <View style={s.infoCell}>
                      <Text style={s.infoLabel}>{language === "my" ? "အခြေအနေ" : "STATUS"}</Text>
                      <Text style={[s.infoValue, { color: colors.secondary || colors.text }]}>{statusText(match, language)}</Text>
                    </View>
                    <View style={s.infoCell}>
                      <Text style={s.infoLabel}>{language === "my" ? "ပြိုင်ပွဲ" : "COMPETITION"}</Text>
                      <Text style={[s.infoValue, { color: colors.secondary || colors.text }]}>{match?.competition_name || "Football"}</Text>
                    </View>
                  </View>
                </View>

                {/* Companion MST Prediction CTA Banner */}
                <View style={[s.mcPredictionCard, { backgroundColor: colors.surface || T.color.surface, borderColor: colors.border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Ionicons name="trophy" size={14} color={colors.red || T.color.red} />
                    <Text style={[s.mcPredictionEyebrow, { color: colors.red || T.color.red }]}>MST PREDICTION ECOSYSTEM</Text>
                  </View>
                  <Text style={[s.mcPredictionTitle, { color: colors.text }]}>{language === "my" ? "ရလဒ်မှန် ခန့်မှန်းပါ" : "Predict the Exact Score"}</Text>
                  <Text style={[s.mcPredictionDesc, { color: colors.muted }]}>
                    {language === "my" ? "ရလဒ်မှန် = ၃ မှတ် · အနိုင်/သရေမှန် = ၁ မှတ်။ MST Prediction တွင် အမှတ်ရယူပါ။" : "Exact Score = 3 pts · Result Only = 1 pt. Make your pick in the MST Prediction companion app."}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open MST Prediction app"
                    onPress={openPredictionApp}
                    style={[s.mcPredictionBtn, { backgroundColor: colors.red || T.color.red }]}
                  >
                    <Ionicons name="open-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={s.mcPredictionBtnText}>{language === "my" ? "MST PREDICTION ဖွင့်မည်" : "OPEN MST PREDICTION"}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            {/* TAB 2: TIMELINE */}
            {tab === "timeline" ? (
              <View style={[s.cardTabWrap, { backgroundColor: colors.surface || T.color.surface, borderColor: colors.border }]}>
                <Text style={[s.cardTabTitle, { color: colors.text }]}>{language === "my" ? "ပွဲစဉ် ဖြစ်ရပ်မှတ်တမ်း" : "Match Timeline"}</Text>
                {matchEvents.length ? (
                  matchEvents.map((event, idx) => (
                    <View key={`event-${idx}`} style={[s.timelineItem, idx > 0 && [s.timelineBorder, { borderTopColor: colors.border }]]}>
                      <Text style={[s.timelineMin, { color: colors.red || T.color.red }]}>{event.time?.elapsed || event.minute || event.time || "—"}'</Text>
                      <View style={s.timelineIconWrap}>
                        <Ionicons
                          name={
                            String(event.type).toLowerCase() === "goal" ? "football" :
                            String(event.type).toLowerCase().includes("card") ? "square" :
                            String(event.type).toLowerCase() === "subst" ? "swap-horizontal" : "radio-button-on"
                          }
                          size={15}
                          color={
                            String(event.detail || "").toLowerCase().includes("red") ? T.color.red :
                            String(event.detail || "").toLowerCase().includes("yellow") ? T.color.amber :
                            String(event.type).toLowerCase() === "goal" ? T.color.green : colors.secondary
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.timelinePlayer, { color: colors.text }]}>{event.player?.name || event.playerName || event.detail || "Event"}</Text>
                        <Text style={[s.timelineDetail, { color: colors.muted }]}>{event.team?.name ? `${event.team.name} · ` : ""}{event.detail || event.type}</Text>
                      </View>
                    </View>
                  ))
                ) : isLive(match) ? (
                  <View style={s.tabEmptyState}>
                    <Ionicons name="timer-outline" size={24} color={colors.muted} />
                    <Text style={[s.tabEmptyText, { color: colors.muted }]}>Match is in progress. Key events will appear live as they happen.</Text>
                  </View>
                ) : isFinished(match) ? (
                  <View style={s.tabEmptyState}>
                    <Ionicons name="information-circle-outline" size={24} color={colors.muted} />
                    <Text style={[s.tabEmptyText, { color: colors.muted }]}>Timeline events are not available for this finished match.</Text>
                  </View>
                ) : (
                  <View style={s.tabEmptyState}>
                    <Ionicons name="hourglass-outline" size={24} color={colors.muted} />
                    <Text style={[s.tabEmptyText, { color: colors.muted }]}>Match has not started yet. Timeline events will update live once the game kicks off.</Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* TAB: COMMENTARY */}
            {tab === "commentary" ? (
              <View style={[s.cardTabWrap, { backgroundColor: colors.surface || T.color.surface, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={[s.cardTabTitle, { color: colors.text, marginBottom: 0 }]}>{t("mcCommentary", language)}</Text>
                  <Text style={[s.availability, s.available]}>VERIFIED FEED</Text>
                </View>
                {commentaryList.length ? (
                  commentaryList.map((comm, idx) => (
                    <View key={`comm-${idx}`} style={[s.timelineItem, idx > 0 && [s.timelineBorder, { borderTopColor: colors.border }]]}>
                      <View style={[s.commMinBadge, { backgroundColor: colors.redSoft || T.color.redSoft, borderColor: colors.red || T.color.red }]}>
                        <Text style={[s.commMinText, { color: colors.red || T.color.red }]}>{comm.minute ? `${comm.minute}'` : "•"}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        {comm.title ? (
                          <Text style={[s.commTitle, { color: colors.text }]}>{comm.title}</Text>
                        ) : null}
                        <Text style={[s.commText, { color: colors.secondary || colors.text }]}>{comm.text}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={s.tabEmptyState}>
                    <Ionicons name="chatbubbles-outline" size={26} color={colors.muted} />
                    <Text style={[s.tabEmptyText, { color: colors.muted }]}>
                      {language === "my"
                        ? "ဤပွဲစဉ်အတွက် တိုက်ရိုက် သုံးသပ်ချက် မရရှိနိုင်သေးပါ။ အဓိက ဖြစ်ရပ်များကို Timeline တွင် ဆက်လက် ကြည့်ရှုနိုင်ပါသည်။"
                        : "Live text commentary is not available for this fixture. Key timeline events remain accessible in the Timeline tab."}
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* TAB 3: LINEUPS & FORMATION */}
            {tab === "lineups" ? (
              <View style={[s.cardTabWrap, { backgroundColor: colors.surface || T.color.surface, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={[s.cardTabTitle, { color: colors.text, marginBottom: 0 }]}>{t("mcLineups", language)}</Text>
                  <Text style={[s.availability, s.available]}>VERIFIED</Text>
                </View>

                {/* Pitch Formation Diagram */}
                <View style={s.pitchContainer}>
                  <View style={s.pitchGrass}>
                    <View style={s.pitchCenterLine} />
                    <View style={s.pitchCenterCircle} />
                    <View style={s.pitchPenaltyBoxTop} />
                    <View style={s.pitchPenaltyBoxBottom} />
                    <View style={s.pitchHalfTop}>
                      <Text style={s.pitchTeamLabel}>{match?.away_team_name || "Away"}</Text>
                    </View>
                    <View style={s.pitchHalfBottom}>
                      <Text style={s.pitchTeamLabel}>{match?.home_team_name || "Home"}</Text>
                    </View>
                  </View>
                </View>

                {lineupsFacts.length ? (
                  lineupsFacts.map((fact, idx) => (
                    <View key={`lineup-fact-${idx}`} style={[s.factRow, { borderTopColor: colors.border }]}>
                      <Text style={[s.factLabel, { color: colors.muted }]}>{fact.label}</Text>
                      <Text style={[s.factValue, { color: colors.secondary || colors.text }]}>{fact.value}</Text>
                    </View>
                  ))
                ) : matchLineups ? (
                  <Text style={[s.tabEmptyText, { color: colors.muted }]}>Lineup details confirmed by provider.</Text>
                ) : (
                  <View style={s.tabEmptyState}>
                    <Ionicons name="people-outline" size={24} color={colors.muted} />
                    <Text style={[s.tabEmptyText, { color: colors.muted }]}>
                      Confirmed lineups are announced approximately 60 minutes before kickoff.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* TAB 4: STATS */}
            {tab === "stats" ? (
              <View style={[s.cardTabWrap, { backgroundColor: colors.surface || T.color.surface, borderColor: colors.border }]}>
                <Text style={[s.cardTabTitle, { color: colors.text }]}>Match Statistics</Text>
                {statsFacts.length ? (
                  statsFacts.map((fact, idx) => (
                    <View key={`stat-fact-${idx}`} style={[s.factRow, { borderTopColor: colors.border }]}>
                      <Text style={[s.factLabel, { color: colors.muted }]}>{fact.label}</Text>
                      <Text style={[s.factValue, { color: colors.secondary || colors.text }]}>{fact.value}</Text>
                    </View>
                  ))
                ) : matchStats ? (
                  <>
                    <StatBar label="Possession" homeVal={matchStats.home?.possession || "50%"} awayVal={matchStats.away?.possession || "50%"} colors={colors} />
                    <StatBar label="Shots on Target" homeVal={matchStats.home?.shotsOnTarget || "0"} awayVal={matchStats.away?.shotsOnTarget || "0"} colors={colors} />
                    <StatBar label="Total Shots" homeVal={matchStats.home?.totalShots || "0"} awayVal={matchStats.away?.totalShots || "0"} colors={colors} />
                    <StatBar label="Corner Kicks" homeVal={matchStats.home?.corners || "0"} awayVal={matchStats.away?.corners || "0"} colors={colors} />
                    <StatBar label="Fouls" homeVal={matchStats.home?.fouls || "0"} awayVal={matchStats.away?.fouls || "0"} colors={colors} />
                    <StatBar label="Yellow Cards" homeVal={matchStats.home?.yellowCards || "0"} awayVal={matchStats.away?.yellowCards || "0"} colors={colors} />
                    <StatBar label="Red Cards" homeVal={matchStats.home?.redCards || "0"} awayVal={matchStats.away?.redCards || "0"} colors={colors} />
                    <StatBar label="Passes" homeVal={matchStats.home?.passes || "—"} awayVal={matchStats.away?.passes || "—"} colors={colors} />
                    <StatBar label="Pass Accuracy" homeVal={matchStats.home?.passAccuracy || "—"} awayVal={matchStats.away?.passAccuracy || "—"} colors={colors} />
                    <StatBar label="Tackles" homeVal={matchStats.home?.tackles || "—"} awayVal={matchStats.away?.tackles || "—"} colors={colors} />
                  </>
                ) : (
                  <View style={s.tabEmptyState}>
                    <Ionicons name="bar-chart-outline" size={24} color={colors.muted} />
                    <Text style={[s.tabEmptyText, { color: colors.muted }]}>
                      Detailed statistics will update live during play as verified by the provider.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* TAB: SHOT MAP */}
            {tab === "shotmap" ? (
              <View style={[s.cardTabWrap, { backgroundColor: colors.surface || T.color.surface, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={[s.cardTabTitle, { color: colors.text, marginBottom: 0 }]}>{t("mcShotMap", language)}</Text>
                  <Text style={[s.availability, shotsWithCoords.length ? s.available : s.unavailable]}>
                    {shotsWithCoords.length ? `${shotsWithCoords.length} SHOTS MAPPED` : "EXTENDED ONLY"}
                  </Text>
                </View>

                {shotsWithCoords.length ? (
                  <>
                    <View style={s.pitchContainer}>
                      <View style={s.pitchGrass}>
                        <View style={s.pitchCenterLine} />
                        <View style={s.pitchCenterCircle} />
                        <View style={s.pitchPenaltyBoxTop} />
                        <View style={s.pitchPenaltyBoxBottom} />

                        {shotsWithCoords.map((shot, idx) => (
                          <View
                            key={shot.id || `shot-${idx}`}
                            style={[
                              s.shotMarker,
                              {
                                left: `${shot.x}%`,
                                top: `${shot.y}%`,
                                backgroundColor: shot.isGoal ? "#48C78E" : "#F4C84D",
                              },
                            ]}
                          >
                            <Ionicons
                              name={shot.isGoal ? "football" : "radio-button-on"}
                              size={shot.isGoal ? 12 : 8}
                              color="#0D1013"
                            />
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Legend */}
                    <View style={s.shotLegendRow}>
                      <View style={s.shotLegendItem}>
                        <View style={[s.shotDot, { backgroundColor: "#48C78E" }]} />
                        <Text style={[s.shotLegendText, { color: colors.text }]}>Goal</Text>
                      </View>
                      <View style={s.shotLegendItem}>
                        <View style={[s.shotDot, { backgroundColor: "#F4C84D" }]} />
                        <Text style={[s.shotLegendText, { color: colors.text }]}>Shot / Saved</Text>
                      </View>
                    </View>

                    {/* Shot List */}
                    <View style={{ marginTop: 12 }}>
                      {shotsWithCoords.map((shot, idx) => (
                        <View key={`shot-detail-${idx}`} style={[s.factRow, { borderTopColor: colors.border }]}>
                          <Text style={[s.factLabel, { color: colors.muted }]}>{shot.minute}' · {shot.player}</Text>
                          <Text style={[s.factValue, { color: shot.isGoal ? "#48C78E" : colors.secondary }]}>
                            {shot.isGoal ? "GOAL" : "Shot"} ({shot.team})
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <View style={s.tabEmptyState}>
                    <Ionicons name="football-outline" size={26} color={colors.muted} />
                    <Text style={[s.tabEmptyText, { color: colors.muted }]}>
                      {language === "my"
                        ? "ဤပွဲစဉ်အတွက် တိုက်ရိုက်ကန်ချက် နေရာအမှတ်အသားများ မရရှိနိုင်ပါ။ (Sportradar Extended Base လွှမ်းခြုံမှုရှိသော ပွဲများတွင်သာ ရရှိနိုင်ပါသည်)"
                        : "Shot map coordinate data is only available for fixtures covered by live extended tracking."}
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* TAB 5: H2H */}
            {tab === "h2h" ? (
              <View style={[s.cardTabWrap, { backgroundColor: colors.surface || T.color.surface, borderColor: colors.border }]}>
                <Text style={[s.cardTabTitle, { color: colors.text }]}>Head-to-Head & Form</Text>
                {h2hFacts.length ? (
                  h2hFacts.map((fact, idx) => (
                    <View key={`h2h-fact-${idx}`} style={[s.factRow, { borderTopColor: colors.border }]}>
                      <Text style={[s.factLabel, { color: colors.muted }]}>{fact.label}</Text>
                      <Text style={[s.factValue, { color: colors.secondary || colors.text }]}>{fact.value}</Text>
                    </View>
                  ))
                ) : formFacts.length ? (
                  formFacts.map((fact, idx) => (
                    <View key={`form-fact-${idx}`} style={[s.factRow, { borderTopColor: colors.border }]}>
                      <Text style={[s.factLabel, { color: colors.muted }]}>{fact.label}</Text>
                      <Text style={[s.factValue, { color: colors.secondary || colors.text }]}>{fact.value}</Text>
                    </View>
                  ))
                ) : (
                  <View style={s.tabEmptyState}>
                    <Ionicons name="git-compare-outline" size={24} color={colors.muted} />
                    <Text style={[s.tabEmptyText, { color: colors.muted }]}>
                      Head-to-head records will appear once verified by the football system.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* TAB 6: TABLE / STANDINGS */}
            {tab === "table" ? (
              <View style={[s.cardTabWrap, { backgroundColor: colors.surface || T.color.surface, borderColor: colors.border }]}>
                <Text style={[s.cardTabTitle, { color: colors.text }]}>Competition Standings</Text>
                {standingsFacts.length ? (
                  standingsFacts.map((fact, idx) => (
                    <View key={`standings-fact-${idx}`} style={[s.factRow, { borderTopColor: colors.border }]}>
                      <Text style={[s.factLabel, { color: colors.muted }]}>{fact.label}</Text>
                      <Text style={[s.factValue, { color: colors.secondary || colors.text }]}>{fact.value}</Text>
                    </View>
                  ))
                ) : (
                  <View style={s.tabEmptyState}>
                    <Ionicons name="list-outline" size={24} color={colors.muted} />
                    <Text style={[s.tabEmptyText, { color: colors.muted }]}>
                      Standings are not available for this competition.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* TAB 7: ODDS */}
            {tab === "odds" ? (
              <MatchOddsCard match={match} compact={false} />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function useScoresOverview() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true, matches: [], requestIds: {}, warnings: [], error: "" });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    loadScoresOverview()
      .then((result) => active && setState({ loading: false, matches: result.matches, requestIds: result.requestIds, warnings: result.warnings, error: "" }))
      .catch((error) => active && setState({ loading: false, matches: [], requestIds: {}, warnings: [], error: error?.message || "Could not load matches." }));
    return () => { active = false; };
  }, [attempt]);
  return { ...state, retry };
}

export default function Phase4BScoresInternalAlpha() {
  useEffect(() => {
    initCrashReporter({ release: "staging" });
    logBreadcrumb("app", "MST Scores opened");
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Phase4BStartupGate>
          <Phase4BScoresInternalAlphaContent />
        </Phase4BStartupGate>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function Phase4BScoresInternalAlphaContent() {
  const { colors, isDark } = useTheme();
  const overview = useScoresOverview();
  const { width: screenWidth } = useWindowDimensions();
  const lastBackPressRef = useRef(0);

  const [active, setActive] = useState("matches"); // "matches" | "news" | "favorites" | "tips" | "settings"
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [previewMatch, setPreviewMatch] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null); // { type, entity }
  const [subScreen, setSubScreen] = useState(null); // null | "search" | "profile" | "settings"
  const [userAvatar, setUserAvatar] = useState(null);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [language, setLanguage] = useState("my");

  const loadUserData = useCallback(() => {
    getAuthStatus()
      .then((status) => {
        const avatar = status?.user?.avatar || status?.user?.avatarUrl;
        if (avatar) setUserAvatar(avatar);
      })
      .catch(() => {});
  }, []);

  // Load user avatar for top header
  useEffect(() => {
    loadUserData();
  }, [subScreen, loadUserData]);

  useEffect(() => {
    const route = subScreen || (selectedMatch ? "match_center" : selectedEntity ? `entity_${selectedEntity?.type}` : active);
    setCrashRouteContext(route);
    logBreadcrumb("navigation", `Screen viewed: ${route}`);
  }, [active, subScreen, selectedMatch, selectedEntity]);

  useEffect(() => {
    loadOnboardingPreferences()
      .then((prefs) => {
        if (prefs?.language === "en" || prefs?.language === "my") {
          setLanguage(prefs.language);
        }
      })
      .catch(() => {});
    const unsub = subscribeAppLanguage((lang) => {
      if (lang === "en" || lang === "my") {
        setLanguage(lang);
      }
    });
    return () => unsub();
  }, []);

  const handleSetLanguage = useCallback((nextLang) => {
    const clean = nextLang === "en" ? "en" : "my";
    setLanguage(clean);
    persistAppLanguage(clean).catch(() => {});
  }, []);

  const openMatch = useCallback((match) => {
    setPreviewMatch(null);
    setSelectedEntity(null);
    setSubScreen(null);
    setSelectedMatch(match);
  }, []);

  const openPreview = useCallback((match) => {
    setSelectedEntity(null);
    setSubScreen(null);
    setPreviewMatch(match);
  }, []);

  const openSearch = useCallback(() => {
    setSelectedEntity(null);
    setSubScreen("search");
  }, []);

  const openProfile = useCallback(() => {
    setSelectedEntity(null);
    setSubScreen("profile");
  }, []);

  const openPredictionApp = useCallback(() => {
    Linking.openURL("mstprediction://").catch(() => {
      Linking.openURL("https://prediction.myanmarsportstalk.com").catch(() => {});
    });
  }, []);

  const openSocialLink = useCallback(() => {
    Linking.openURL("https://www.facebook.com/profile.php?id=61585572826885").catch(() => {
      Linking.openURL("https://myanmarsportstalk.com").catch(() => {});
    });
  }, []);

  const [todayResetCounter, setTodayResetCounter] = useState(0);
  const resetToToday = useCallback(() => {
    setTodayResetCounter((c) => c + 1);
  }, []);

  const selectNav = useCallback((next) => {
    setPreviewMatch(null);
    setSelectedMatch(null);
    setSelectedEntity(null);
    setSubScreen(null);
    setActive(next);
    if (next === "matches") {
      resetToToday();
    }
  }, [resetToToday]);

  // Global Android hardware Back navigation hierarchy & double-press root exit
  useEffect(() => {
    const handleHardwareBack = () => {
      // 0. Auth Modal open -> close modal
      if (authModalVisible) {
        setAuthModalVisible(false);
        return true;
      }
      // 0.5. Entity screen open -> close entity
      if (selectedEntity) {
        setSelectedEntity(null);
        return true;
      }
      // 1. In-App Match Preview open -> close preview
      if (previewMatch) {
        setPreviewMatch(null);
        return true;
      }
      // 2. Secondary SubScreen (search, profile, settings) -> close subscreen
      if (subScreen) {
        setSubScreen(null);
        return true;
      }
      // 3. Match Center open -> return to Matches
      if (selectedMatch) {
        setSelectedMatch(null);
        resetToToday();
        return true;
      }
      // 4. Secondary main screens (news, favorites, tips, settings) -> return to Matches
      if (active !== "matches") {
        selectNav("matches");
        return true;
      }

      // 5. At TRUE ROOT (Matches screen with no overlays) -> Double-back exit behavior
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        return false; // Exit app on rapid second press
      }
      lastBackPressRef.current = now;
      if (Platform.OS === "android") {
        ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
      }
      return true; // Prevent immediate app exit
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", handleHardwareBack);
    return () => subscription.remove();
  }, [authModalVisible, selectedEntity, previewMatch, subScreen, selectedMatch, active, selectNav]);

  // Render secondary screens if active
  let content;
  if (selectedEntity) {
    content = (
      <NativeEntityScreenV2
        type={selectedEntity.type}
        entity={selectedEntity.entity}
        goBack={() => setSelectedEntity(null)}
        openAccount={() => setAuthModalVisible(true)}
      />
    );
  } else if (previewMatch) {
    content = (
      <Phase4BMatchPreviewScreen
        match={previewMatch}
        onBack={() => setPreviewMatch(null)}
        onOpenMatchCenter={(m) => {
          setPreviewMatch(null);
          setSelectedMatch(m);
        }}
      />
    );
  } else if (subScreen === "search") {
    content = (
      <Phase4BSearchScreen
        onBack={() => setSubScreen(null)}
        onOpenEntity={(type, entity) => setSelectedEntity({ type, entity })}
        onOpenMatch={(m) => {
          setSubScreen(null);
          setSelectedMatch(m);
        }}
        matches={overview.matches}
        language={language}
      />
    );
  } else if (subScreen === "profile") {
    content = (
      <Phase4BProfileScreen
        onBack={() => setSubScreen(null)}
        onOpenSignIn={() => setAuthModalVisible(true)}
        language={language}
      />
    );
  } else if (subScreen === "settings" || active === "settings") {
    content = (
      <SettingsScreenV2
        goBack={() => {
          if (subScreen === "settings") setSubScreen(null);
          else selectNav("matches");
        }}
        openProfile={() => setSubScreen("profile")}
        onOpenSignIn={() => setAuthModalVisible(true)}
        openAccount={() => setAuthModalVisible(true)}
        language={language}
        setLanguage={handleSetLanguage}
      />
    );
  } else if (selectedMatch) {
    content = (
      <MatchCenter
        selectedMatch={selectedMatch}
        onBack={() => {
          setSelectedMatch(null);
          resetToToday();
        }}
        onOpenPreview={openPreview}
        onOpenEntity={(type, entity) => setSelectedEntity({ type, entity })}
        language={language}
      />
    );
  } else if (active === "tips") {
    content = (
      <TipsScreen
        featuredMatch={overview.matches[0]}
        onOpenSearch={openSearch}
        onOpenProfile={openProfile}
        userAvatar={userAvatar}
        language={language}
      />
    );
  } else {
    // Primary core tab sequence: Matches, News, Favorites (instant switching, zero lag)
    content = (
      <View style={s.flex}>
        <View style={[s.flex, active === "matches" ? null : { display: "none" }]}>
          <MatchesScreen
            overview={overview}
            onOpenMatch={openMatch}
            onOpenPreview={openPreview}
            onOpenEntity={(type, entity) => setSelectedEntity({ type, entity })}
            onRetry={overview.retry}
            onOpenSearch={openSearch}
            onOpenProfile={openProfile}
            onSelectNav={selectNav}
            onOpenPrediction={openPredictionApp}
            onOpenSocial={openSocialLink}
            userAvatar={userAvatar}
            language={language}
            todayResetTrigger={todayResetCounter}
          />
        </View>
        <View style={[s.flex, active === "news" ? null : { display: "none" }]}>
          <NewsScreen
            onOpenSearch={openSearch}
            onOpenProfile={openProfile}
            userAvatar={userAvatar}
            language={language}
          />
        </View>
        <View style={[s.flex, active === "favorites" ? null : { display: "none" }]}>
          <FavoritesScreen
            matches={overview.matches}
            onOpenMatch={openMatch}
            onOpenSearch={openSearch}
            onOpenProfile={openProfile}
            userAvatar={userAvatar}
            onOpenEntity={(type, entity) => setSelectedEntity({ type, entity })}
            onOpenSignIn={() => setAuthModalVisible(true)}
            language={language}
          />
        </View>
      </View>
    );
  }

  const showFooter = !previewMatch && !selectedMatch && !selectedEntity && subScreen !== "search" && subScreen !== "profile";

  return (
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />
      {process.env.EXPO_PUBLIC_MST_ENVIRONMENT !== "production" ? <EnvironmentBanner /> : null}
      <View style={s.flex}>{content}</View>
      {showFooter ? (
        <BottomNavigation
          active={active}
          onSelect={(id) => {
            if (id === "matches") {
              resetToToday();
            }
            selectNav(id);
          }}
          language={language}
        />
      ) : null}
      <Phase4BAuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onSuccess={() => {
          setAuthModalVisible(false);
          loadUserData();
        }}
        language={language}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.color.bg,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) : 0,
  },
  flex: { flex: 1 },
  environmentBanner: {
    height: 18,
    backgroundColor: "#0D0D10",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1A1A1F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  envDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: T.color.red,
  },
  environmentText: { color: "#A1A1AA", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.6 },
  environmentSub: { color: "#71717A", fontSize: 9, fontWeight: "700" },
  homeBrandHeader: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#18181C",
    backgroundColor: "#000000",
  },
  brandLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandRedBar: { width: 3, height: 18, borderRadius: 1.5, backgroundColor: T.color.red },
  brandWordMST: { color: T.color.red, fontSize: 19, fontWeight: "900", letterSpacing: 0.8 },
  brandWordScores: { color: "#FFFFFF", fontSize: 17, fontWeight: "800", letterSpacing: 0.5 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T.color.red,
  },
  headerAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.color.border,
  },
  quickBarWrap: {
    height: 48,
    backgroundColor: "#000000",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#18181C",
  },
  quickBarScroll: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 8,
  },
  quickPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#121214",
    borderWidth: 1,
    borderColor: "#1C1C20",
  },
  quickPillPressed: {
    backgroundColor: "#1A1A1E",
  },
  quickIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  quickPillText: {
    color: "#E4E4E7",
    fontSize: 11.5,
    fontWeight: "700",
  },
  dateNavWrapper: {
    height: 56,
    backgroundColor: "#000000",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#18181C",
  },
  dateStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 56,
  },
  dateCell: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  dateCellActive: {
    backgroundColor: "#16161A",
    borderWidth: 1,
    borderColor: "#282830",
  },
  dateDayText: { color: "#71717A", fontSize: 9.5, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  dateDayTextActive: { color: T.color.red, fontWeight: "900" },
  dateNumText: { color: "#A1A1AA", fontSize: 16, fontWeight: "800", marginTop: 1 },
  dateNumTextActive: { color: "#FFFFFF", fontWeight: "900" },
  dateActiveLine: {
    position: "absolute",
    bottom: 3,
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: T.color.red,
  },
  scrollContent: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 90 },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 2,
  },
  filterChipsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#1C1C20",
    backgroundColor: "#121214",
  },
  filterChipActive: {
    backgroundColor: T.color.red,
    borderColor: T.color.red,
  },
  filterLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.color.red,
  },
  filterLiveDotActive: {
    backgroundColor: "#FFFFFF",
  },
  filterChipText: { color: "#A1A1AA", fontSize: 11.5, fontWeight: "700" },
  filterChipTextActive: { color: "#FFFFFF", fontWeight: "900" },
  matchCountCompact: {
    color: "#71717A",
    fontSize: 11.5,
    fontWeight: "800",
  },
  stateCard: {
    minHeight: 125,
    borderRadius: T.radius.md,
    backgroundColor: T.color.surface,
    borderWidth: 1,
    borderColor: T.color.border,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  stateTitle: { color: T.color.text, fontSize: 15, fontWeight: "800", textAlign: "center" },
  stateText: { color: T.color.muted, fontSize: 12.5, lineHeight: 18, textAlign: "center" },
  primaryButton: {
    minHeight: 38,
    borderRadius: T.radius.sm,
    backgroundColor: T.color.red,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  primaryButtonText: { color: T.color.text, fontSize: 12.5, fontWeight: "900" },
  fallbackMark: {
    backgroundColor: T.color.raised,
    borderWidth: 1,
    borderColor: T.color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackMarkText: { color: T.color.secondary, fontSize: 11, fontWeight: "900" },
  leagueCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 10,
  },
  leagueHeader: {
    height: 42,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leagueName: { fontSize: 13.5, fontWeight: "700", flex: 1, letterSpacing: 0.2 },
  leagueLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(229,9,20,0.18)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(229,9,20,0.4)",
  },
  leagueLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: T.color.red,
  },
  leagueLivePillText: { color: T.color.red, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.5 },
  matchDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 12 },
  viewAll: { color: T.color.muted, fontSize: 12, fontWeight: "800" },
  fotmobRow: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  fotmobTimeCol: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  fotmobTimeText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  fotmobLivePill: {
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  fotmobLivePillText: {
    color: "#FFFFFF",
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  fotmobDivider: {
    width: 1,
    alignSelf: "stretch",
    marginHorizontal: 8,
    marginVertical: 2,
  },
  fotmobTeamsCol: {
    flex: 1,
    gap: 6,
    justifyContent: "center",
  },
  fotmobTeamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  fotmobTeamText: {
    flex: 1,
    fontSize: 13,
  },
  fotmobScoreNum: {
    fontSize: 13.5,
    paddingHorizontal: 4,
    minWidth: 18,
    textAlign: "right",
  },
  fotmobChevron: {
    marginLeft: 4,
  },
  leagueCountBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderWidth: 1,
    marginLeft: "auto",
    marginRight: 4,
  },
  leagueCountText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  matchRow: {
    height: 44,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  liveAccentBar: {
    position: "absolute",
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 1.5,
  },
  statusColumn: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  rightBalanceColumn: {
    width: 24,
  },
  liveStatusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  finishedStatusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  homeSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 4,
  },
  awaySide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  teamLogoBox: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  teamNameSingle: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: -0.25,
  },
  scoreCenter: {
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 1,
  },
  scoreTextSingle: {
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  scoreVsSingle: {
    fontSize: 11.5,
    fontWeight: "600",
    textAlign: "center",
  },
  kickoffCenterText: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  bigMatchCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1C1C20",
    borderLeftWidth: 3,
    borderLeftColor: T.color.red,
    backgroundColor: "#121214",
    padding: 14,
    marginBottom: 10,
  },
  bigMatchHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bigMatchTagWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  bigMatchTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.color.red,
  },
  bigMatchEyebrow: { color: T.color.red, fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  bigMatchComp: { color: "#71717A", fontSize: 11.5, fontWeight: "700" },
  bigMatchTeams: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  bigTeam: { flex: 1, alignItems: "center", gap: 6 },
  bigTeamName: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", textAlign: "center" },
  bigVersus: { width: 80, alignItems: "center" },
  bigVs: { color: T.color.red, fontSize: 15, fontWeight: "900" },
  bigKickoff: { color: "#71717A", fontSize: 11, textAlign: "center", marginTop: 3 },
  bigMatchActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  previewCta: {
    flex: 1,
    backgroundColor: T.color.red,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  previewCtaText: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "900", letterSpacing: 0.4 },
  matchCenterCta: {
    flex: 1,
    backgroundColor: "#18181C",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#202024",
    paddingHorizontal: 12,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  matchCenterCtaText: { color: "#C4C4CC", fontSize: 11.5, fontWeight: "800", letterSpacing: 0.4 },
  inlineWarning: {
    minHeight: 42,
    borderRadius: T.radius.sm,
    backgroundColor: T.color.surface,
    borderWidth: 1,
    borderColor: T.color.border,
    padding: 10,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    marginBottom: 10,
  },
  inlineWarningText: { flex: 1, color: T.color.muted, fontSize: 12, lineHeight: 16 },
  requestId: { color: T.color.muted, fontSize: 10, marginTop: 6 },
  bottomNav: {
    height: Platform.OS === "ios" ? 78 : 72,
    borderTopWidth: 1,
    borderTopColor: "#18181C",
    backgroundColor: "#000000",
    flexDirection: "row",
    paddingBottom: Platform.OS === "ios" ? 14 : 16,
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 2 },
  navLabel: { color: "#71717A", fontSize: 11, fontWeight: "700", textAlign: "center" },
  navLabelActive: { color: T.color.red, fontWeight: "900" },
  dependencyCopy: { flex: 1 },
  dependencyTitle: { color: T.color.secondary, fontSize: 13.5, fontWeight: "800" },
  dependencyText: { color: T.color.muted, fontSize: 12, lineHeight: 16, marginTop: 3 },
  segmented: {
    minHeight: 38,
    flexDirection: "row",
    backgroundColor: T.color.surface,
    borderRadius: T.radius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: T.color.border,
    marginBottom: 12,
  },
  segment: { flex: 1, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: T.color.red },
  segmentText: { color: T.color.muted, fontSize: 12.5, fontWeight: "800" },
  segmentActiveText: { color: T.color.text, fontSize: 12.5, fontWeight: "900" },
  matchCenterContent: { padding: T.space.md, paddingBottom: 35 },
  matchHero: {
    borderRadius: T.radius.lg,
    backgroundColor: T.color.surface,
    borderWidth: 1,
    borderColor: T.color.border,
    padding: 14,
    marginBottom: 12,
  },
  heroCompetition: { color: T.color.secondary, fontSize: 13.5, fontWeight: "900", textAlign: "center" },
  heroKickoff: { color: T.color.muted, fontSize: 12, textAlign: "center", marginTop: 3 },
  heroTeams: { flexDirection: "row", alignItems: "center", minHeight: 100, marginTop: 6 },
  heroTeam: { flex: 1, alignItems: "center", gap: 6 },
  heroTeamName: { color: T.color.text, fontSize: 13.5, fontWeight: "800", textAlign: "center" },
  heroScoreWrap: { width: 88, alignItems: "center" },
  heroScore: { color: T.color.text, fontSize: 26, fontWeight: "900" },
  heroStatus: { color: T.color.muted, fontSize: 12, fontWeight: "900", marginTop: 4 },
  matchCenterPreviewBanner: {
    borderRadius: T.radius.md,
    backgroundColor: T.color.surface,
    borderWidth: 1,
    borderColor: T.color.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 12,
  },
  matchCenterPreviewIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: T.color.redSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  matchCenterPreviewTitle: { color: T.color.text, fontSize: 13.5, fontWeight: "800" },
  matchCenterPreviewSub: { color: T.color.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  dataSection: {
    borderRadius: T.radius.md,
    backgroundColor: T.color.surface,
    borderWidth: 1,
    borderColor: T.color.border,
    padding: 12,
    marginBottom: 9,
  },
  dataSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dataSectionTitle: { color: T.color.secondary, fontSize: 13.5, fontWeight: "900" },
  availability: {
    color: T.color.muted,
    fontSize: 10,
    fontWeight: "900",
    borderWidth: 1,
    borderColor: T.color.border,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: "hidden",
  },
  available: { color: T.color.green, borderColor: T.color.green },
  dataSectionText: { color: T.color.muted, fontSize: 12.5, lineHeight: 17, marginTop: 7 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 7 },
  infoCell: { width: "50%", padding: 6 },
  infoLabel: { color: T.color.muted, fontSize: 11, fontWeight: "900" },
  infoValue: { color: T.color.secondary, fontSize: 12.5, lineHeight: 16, marginTop: 2 },
  noWrites: {
    color: T.color.muted,
    fontSize: 10,
    fontWeight: "900",
    borderWidth: 1,
    borderColor: T.color.border,
    borderRadius: 5,
    padding: 4,
  },
  tipCard: {
    borderRadius: T.radius.md,
    backgroundColor: T.color.surface,
    borderWidth: 1,
    borderColor: T.color.border,
    padding: 12,
    marginBottom: 9,
  },
  tipTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  tipTitle: { color: T.color.secondary, fontSize: 13.5, fontWeight: "900", flex: 1 },
  tipAccess: { fontSize: 10, fontWeight: "900", borderWidth: 1, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, overflow: "hidden" },
  tipLocked: { color: T.color.amber, borderColor: T.color.amber },
  tipFree: { color: T.color.green, borderColor: T.color.green },
  tipSelection: { color: T.color.muted, fontSize: 12, marginTop: 7 },

  todayShortcut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: T.color.redSoft,
  },
  todayShortcutText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  mcTabContainer: {
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: T.color.border,
    backgroundColor: T.color.surface,
  },
  mcTabStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 4,
  },
  mcTabBtn: {
    height: 44,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  mcTabBtnActive: {
    borderBottomColor: T.color.red,
  },
  mcTabText: { fontSize: 11.5, fontWeight: "800", color: T.color.muted, letterSpacing: 0.4 },
  mcTabTextActive: { color: T.color.text, fontWeight: "900" },
  mcPredictionCard: {
    borderRadius: T.radius.md,
    backgroundColor: T.color.surface,
    borderWidth: 1,
    borderColor: T.color.border,
    padding: 14,
    marginBottom: 10,
  },
  mcPredictionEyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  mcPredictionTitle: { color: T.color.text, fontSize: 15, fontWeight: "900", marginTop: 4, marginBottom: 4 },
  mcPredictionDesc: { color: T.color.muted, fontSize: 12, lineHeight: 16, marginBottom: 10 },
  mcPredictionBtn: {
    height: 38,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  mcPredictionBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", letterSpacing: 0.4 },
  cardTabWrap: {
    borderRadius: T.radius.md,
    backgroundColor: T.color.surface,
    borderWidth: 1,
    borderColor: T.color.border,
    padding: 14,
    marginBottom: 10,
  },
  cardTabTitle: { color: T.color.text, fontSize: 15, fontWeight: "900", marginBottom: 12 },
  tabEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  tabEmptyText: { color: T.color.muted, fontSize: 12.5, textAlign: "center", lineHeight: 17, paddingHorizontal: 16 },
  timelineItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  timelineBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.color.border },
  timelineMin: { width: 34, fontSize: 13, fontWeight: "900", textAlign: "right" },
  timelineIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: T.color.raised, alignItems: "center", justifyContent: "center" },
  timelinePlayer: { fontSize: 13, fontWeight: "800" },
  timelineDetail: { fontSize: 11, marginTop: 2 },
  statRow: { marginBottom: 12 },
  statLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  statVal: { fontSize: 13, fontWeight: "900", width: 44, textAlign: "center" },
  statLabel: { fontSize: 11.5, fontWeight: "700", flex: 1, textAlign: "center" },
  statBarTrack: { height: 6, borderRadius: 3, flexDirection: "row", overflow: "hidden", backgroundColor: T.color.raised },
  statBarHome: { height: "100%" },
  statBarAway: { height: "100%" },
  factRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.color.border },
  factLabel: { fontSize: 12, flex: 1 },
  factValue: { fontSize: 12, fontWeight: "800", flex: 1, textAlign: "right" },
  commMinBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 32,
  },
  commMinText: { fontSize: 11, fontWeight: "900" },
  commTitle: { fontSize: 13, fontWeight: "800", marginBottom: 2 },
  commText: { fontSize: 12, lineHeight: 17 },
  pitchContainer: {
    width: "100%",
    height: 230,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#204626",
  },
  pitchGrass: {
    flex: 1,
    backgroundColor: "#132D18",
    position: "relative",
  },
  pitchCenterLine: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  pitchCenterCircle: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 60,
    height: 60,
    marginTop: -30,
    marginLeft: -30,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  pitchPenaltyBoxTop: {
    position: "absolute",
    top: 0,
    left: "25%",
    right: "25%",
    height: 40,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  pitchPenaltyBoxBottom: {
    position: "absolute",
    bottom: 0,
    left: "25%",
    right: "25%",
    height: 40,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  pitchHalfTop: {
    position: "absolute",
    top: 6,
    left: 8,
    right: 8,
    bottom: "50%",
    justifyContent: "space-around",
    alignItems: "center",
  },
  pitchHalfBottom: {
    position: "absolute",
    top: "50%",
    left: 8,
    right: 8,
    bottom: 6,
    justifyContent: "space-around",
    alignItems: "center",
  },
  pitchTeamLabel: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "rgba(255, 255, 255, 0.6)",
    letterSpacing: 0.6,
  },
  shotMarker: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    marginTop: -10,
    marginLeft: -10,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  shotLegendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 8,
  },
  shotLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  shotDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  shotLegendText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
