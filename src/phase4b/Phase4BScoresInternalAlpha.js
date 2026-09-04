import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
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
import Phase4BMatchPreviewScreen from "./Phase4BMatchPreviewScreen";
import Phase4BSearchScreen from "./Phase4BSearchScreen";
import Phase4BProfileScreen from "./Phase4BProfileScreen";
import { getAuthStatus } from "../services/accountApi";

const T = Object.freeze({
  color: {
    bg: "#080A0C",
    surface: "#101417",
    raised: "#161B1F",
    border: "#22272B",
    text: "#FFFFFF",
    secondary: "#D4D8DB",
    muted: "#88929A",
    red: "#F3262D",
    redSoft: "rgba(243,38,45,0.12)",
    amber: "#F4C84D",
    green: "#48C78E",
  },
  space: { xs: 6, sm: 10, md: 16, lg: 22 },
  radius: { sm: 6, md: 12, lg: 16 },
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

function dateWindow(center = new Date()) {
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(center);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index - 6);
    return date;
  });
}

function dayLabel(date) {
  const today = dateKey(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey(date) === today) return "Today";
  if (dateKey(date) === dateKey(tomorrow)) return "Tom";
  if (dateKey(date) === dateKey(yesterday)) return "Yest";
  return date.toLocaleDateString([], { weekday: "short" });
}

function kickoffText(value) {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fullKickoff(value) {
  if (!value) return "Kickoff unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Kickoff unavailable";
  return date.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusText(match) {
  const status = String(match?.status || "scheduled").toLowerCase();
  if (["live", "in_play", "1h", "2h"].includes(status)) return match?.minute == null ? "LIVE" : `LIVE ${match.minute}'`;
  if (["ht", "halftime"].includes(status)) return "HT";
  if (["finished", "ft"].includes(status)) return "FT";
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

function matchStateText(match) {
  return isLive(match) || isFinished(match) ? statusText(match) : kickoffText(match?.kickoff_at);
}

function groupByCompetition(matches) {
  const groups = new Map();
  for (const match of matches) {
    const id = String(match?.competition_id || match?.competition_name || "football");
    if (!groups.has(id)) groups.set(id, { id, name: match?.competition_name || "Football", logo: match?.competition_logo_url || null, matches: [] });
    groups.get(id).matches.push(match);
  }
  return [...groups.values()];
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
  return (
    <View style={s.environmentBanner} accessibilityLabel="STAGING INTERNAL build">
      <Ionicons name="flask-outline" size={14} color={T.color.bg} />
      <Text style={s.environmentText}>STAGING / INTERNAL</Text>
      <Text style={s.environmentSub}>REAL SCORES API · NO PRODUCTION</Text>
    </View>
  );
}

function HomeBrandHeader({ onOpenSearch, onOpenProfile, userAvatar }) {
  return (
    <View style={s.homeBrandHeader} accessibilityRole="header">
      <View style={s.brandBlock}>
        <View style={s.brandTitleRow}>
          <View style={s.brandBadge}>
            <Text style={s.brandMst}>MST</Text>
          </View>
          <Text style={s.brandTitle}>Scores</Text>
        </View>
        <Text style={s.brandEyebrow}>FOLLOW THE GAME</Text>
      </View>
      <View style={s.headerActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search teams and players"
          hitSlop={10}
          onPress={onOpenSearch}
          style={s.headerBtn}
        >
          <Ionicons name="search-outline" size={20} color={T.color.secondary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open user profile"
          hitSlop={10}
          onPress={onOpenProfile}
          style={s.headerBtn}
        >
          {userAvatar ? (
            <Image
              source={{ uri: userAvatar }}
              style={s.headerAvatar}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="person-circle-outline" size={24} color={T.color.secondary} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function BottomNavigation({ active, onSelect }) {
  return (
    <View style={s.bottomNav} accessibilityRole="tablist">
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
              color={selected ? T.color.red : T.color.muted}
            />
            <Text numberOfLines={1} style={[s.navLabel, selected && s.navLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RequestId({ label, value }) {
  if (!value) return null;
  return <Text selectable style={s.requestId}>{label} request_id: {value}</Text>;
}

function TerminalState({ loading, error, empty, emptyTitle = "No matches available", emptyText, onRetry }) {
  if (!loading && !error && !empty) return null;
  return (
    <View style={s.stateCard}>
      {loading ? (
        <ActivityIndicator color={T.color.red} />
      ) : (
        <Ionicons
          name={error ? "cloud-offline-outline" : "football-outline"}
          size={27}
          color={error ? T.color.amber : T.color.muted}
        />
      )}
      <Text style={s.stateTitle}>
        {loading ? "Loading match data…" : error ? "Scores service unavailable" : emptyTitle}
      </Text>
      <Text style={s.stateText}>
        {loading
          ? "The request stops after 8 seconds if the Scores service does not respond."
          : error || emptyText || "The selected match view is empty."}
      </Text>
      {!loading && onRetry ? (
        <Pressable accessibilityRole="button" style={s.primaryButton} onPress={onRetry}>
          <Ionicons name="refresh" size={16} color={T.color.text} />
          <Text style={s.primaryButtonText}>RETRY</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function TeamMark({ name, uri, size = 28 }) {
  if (uri) return <Image source={{ uri }} resizeMode="contain" style={{ width: size, height: size }} />;
  return (
    <View style={[s.fallbackMark, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={s.fallbackMarkText}>{String(name || "M").trim().slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

const MatchRow = memo(function MatchRow({ match, onOpen }) {
  const id = canonicalMatchId(match);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${match?.home_team_name || "Home"} versus ${match?.away_team_name || "Away"}`}
      onPress={() => id && onOpen(match)}
      style={s.matchRow}
    >
      <View style={s.matchState}>
        <Text style={[s.matchStateText, isLive(match) && s.liveText]}>{matchStateText(match)}</Text>
        {isLive(match) ? <View style={s.liveDot} /> : null}
      </View>
      <View style={s.matchTeams}>
        <View style={s.teamLine}>
          <TeamMark name={match?.home_team_name} uri={match?.home_team_logo_url} size={22} />
          <Text numberOfLines={1} style={s.teamLineName}>
            {match?.home_team_name || "Home"}
          </Text>
        </View>
        <View style={s.teamLine}>
          <TeamMark name={match?.away_team_name} uri={match?.away_team_logo_url} size={22} />
          <Text numberOfLines={1} style={s.teamLineName}>
            {match?.away_team_name || "Away"}
          </Text>
        </View>
      </View>
      <Text style={[s.rowScore, isLive(match) && s.liveText]}>{scoreText(match)}</Text>
      <Ionicons name="chevron-forward" size={16} color={T.color.muted} />
    </Pressable>
  );
});

function LeagueGroup({ group, onOpen }) {
  return (
    <View style={s.leagueCard}>
      <View style={s.leagueHeader}>
        <TeamMark name={group.name} uri={group.logo} size={22} />
        <Text numberOfLines={1} style={s.leagueName}>
          {group.name}
        </Text>
        <Text style={s.viewAll}>View all</Text>
      </View>
      {group.matches.map((match) => (
        <MatchRow key={canonicalMatchId(match)} match={match} onOpen={onOpen} />
      ))}
    </View>
  );
}

function BigMatchPreview({ match, onOpenPreview, onOpenMatch }) {
  if (!match) return null;
  return (
    <View style={s.bigMatchCard}>
      <View style={s.bigMatchHeaderRow}>
        <Text style={s.bigMatchEyebrow}>BIG MATCH PREVIEW</Text>
        <Text style={s.bigMatchComp}>{match?.competition_name || "Football"}</Text>
      </View>
      <View style={s.bigMatchTeams}>
        <View style={s.bigTeam}>
          <TeamMark name={match?.home_team_name} uri={match?.home_team_logo_url} size={40} />
          <Text numberOfLines={2} style={s.bigTeamName}>
            {match?.home_team_name || "Home"}
          </Text>
        </View>
        <View style={s.bigVersus}>
          <Text style={s.bigVs}>VS</Text>
          <Text style={s.bigKickoff}>{fullKickoff(match?.kickoff_at)}</Text>
        </View>
        <View style={s.bigTeam}>
          <TeamMark name={match?.away_team_name} uri={match?.away_team_logo_url} size={40} />
          <Text numberOfLines={2} style={s.bigTeamName}>
            {match?.away_team_name || "Away"}
          </Text>
        </View>
      </View>
      <View style={s.bigMatchActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpenPreview(match)}
          style={s.previewCta}
        >
          <Ionicons name="document-text-outline" size={14} color={T.color.text} />
          <Text style={s.previewCtaText}>READ FULL PREVIEW</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpenMatch(match)}
          style={s.matchCenterCta}
        >
          <Ionicons name="football-outline" size={14} color={T.color.secondary} />
          <Text style={s.matchCenterCtaText}>MATCH CENTER</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DateNavigation({ selected, onSelect }) {
  const dates = useMemo(() => dateWindow(), []);

  const handlePrev = useCallback(() => {
    const parts = (selected || "").split("-").map(Number);
    const d = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0) : new Date();
    d.setDate(d.getDate() - 1);
    onSelect(dateKey(d));
  }, [selected, onSelect]);

  const handleNext = useCallback(() => {
    const parts = (selected || "").split("-").map(Number);
    const d = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0) : new Date();
    d.setDate(d.getDate() + 1);
    onSelect(dateKey(d));
  }, [selected, onSelect]);

  return (
    <View style={s.compactDateContainer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous date"
        hitSlop={10}
        onPress={handlePrev}
        style={s.dateArrowBtn}
      >
        <Ionicons name="chevron-back" size={15} color={T.color.secondary} />
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.dateStrip}
      >
        {dates.map((date) => {
          const key = dateKey(date);
          const active = selected === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(key)}
              style={[s.dateCell, active && s.dateCellActive]}
            >
              <Text style={[s.dateDay, active && s.dateActiveDay]}>
                {dayLabel(date).toUpperCase()}
              </Text>
              <Text style={[s.dateNumber, active && s.dateActiveNumber]}>
                {date.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next date"
        hitSlop={10}
        onPress={handleNext}
        style={s.dateArrowBtn}
      >
        <Ionicons name="chevron-forward" size={15} color={T.color.secondary} />
      </Pressable>
    </View>
  );
}

function MatchesScreen({
  overview,
  onOpenMatch,
  onOpenPreview,
  onRetry,
  onOpenSearch,
  onOpenProfile,
  userAvatar,
}) {
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [didSelectFallback, setDidSelectFallback] = useState(false);

  useEffect(() => {
    if (!overview.loading && !didSelectFallback && overview.matches.length) {
      const todayHasMatches = overview.matches.some((match) => dateKey(match?.kickoff_at) === selectedDate);
      if (!todayHasMatches) setSelectedDate(nearestAvailableDate(overview.matches));
      setDidSelectFallback(true);
    }
  }, [didSelectFallback, overview.loading, overview.matches, selectedDate]);

  const selectedMatches = useMemo(
    () => overview.matches.filter((match) => dateKey(match?.kickoff_at) === selectedDate),
    [overview.matches, selectedDate],
  );
  const groups = useMemo(() => groupByCompetition(selectedMatches), [selectedMatches]);

  return (
    <View style={s.flex}>
      <HomeBrandHeader
        onOpenSearch={onOpenSearch}
        onOpenProfile={onOpenProfile}
        userAvatar={userAvatar}
      />
      <DateNavigation selected={selectedDate} onSelect={setSelectedDate} />
      <ScrollView
        nestedScrollEnabled
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={overview.loading}
            onRefresh={onRetry}
            tintColor={T.color.red}
            colors={[T.color.red]}
          />
        }
      >
        <View style={s.sectionHeadingRow}>
          <View>
            <Text style={s.sectionEyebrow}>MATCHES</Text>
            <Text style={s.sectionTitle}>Follow the game</Text>
          </View>
          <Text style={s.matchCount}>{selectedMatches.length} matches</Text>
        </View>
        <TerminalState
          loading={overview.loading}
          error={overview.error}
          empty={!overview.loading && !overview.error && selectedMatches.length === 0}
          emptyText="No real match is scheduled for this date. Choose another date or retry."
          onRetry={onRetry}
        />
        {overview.warnings.map((warning) => (
          <View key={warning.feed} style={s.inlineWarning}>
            <Ionicons name="warning-outline" color={T.color.amber} size={16} />
            <Text style={s.inlineWarningText}>
              {warning.feed}: {warning.message}
            </Text>
          </View>
        ))}
        {groups.map((group, index) => (
          <React.Fragment key={group.id}>
            <LeagueGroup group={group} onOpen={onOpenMatch} />
            {index === 0 ? (
              <BigMatchPreview
                match={group.matches[0]}
                onOpenPreview={onOpenPreview}
                onOpenMatch={onOpenMatch}
              />
            ) : null}
          </React.Fragment>
        ))}
        <RequestId label="fixtures" value={overview.requestIds.fixtures} />
        <RequestId label="live" value={overview.requestIds.live} />
        <RequestId label="results" value={overview.requestIds.results} />
      </ScrollView>
    </View>
  );
}

function NewsScreen({ onOpenSearch, onOpenProfile, userAvatar }) {
  return (
    <View style={s.flex}>
      <ScreenHeader
        title="News"
        subtitle="MST FOOTBALL EDITORIAL"
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

function FavoritesScreen({ matches, onOpenMatch, onOpenSearch, onOpenProfile, userAvatar }) {
  const realMatches = matches.slice(0, 2);
  return (
    <View style={s.flex}>
      <ScreenHeader
        title="Favorites"
        subtitle="TEAMS · COMPETITIONS"
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
        <View style={s.segmented}>
          <View style={[s.segment, s.segmentActive]}>
            <Text style={s.segmentActiveText}>All</Text>
          </View>
          <View style={s.segment}>
            <Text style={s.segmentText}>Teams</Text>
          </View>
          <View style={s.segment}>
            <Text style={s.segmentText}>Competitions</Text>
          </View>
        </View>
        <Phase4BFavoritesPanel />
        <View style={s.sectionHeadingRow}>
          <Text style={s.sectionTitle}>Real matches</Text>
          <Text style={s.matchCount}>Not personalized</Text>
        </View>
        {realMatches.length ? (
          <View style={s.leagueCard}>
            {realMatches.map((match) => (
              <MatchRow key={canonicalMatchId(match)} match={match} onOpen={onOpenMatch} />
            ))}
          </View>
        ) : (
          <TerminalState
            empty
            emptyTitle="No matches"
            emptyText="There are no real matches to show here."
          />
        )}
      </ScrollView>
    </View>
  );
}

function TipsScreen({ featuredMatch, onOpenSearch, onOpenProfile, userAvatar }) {
  return (
    <View style={s.flex}>
      <ScreenHeader
        title="Tips"
        subtitle="TIPS · TIPSTERS · LEADERBOARDS"
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
        <Phase4BReadOnlyHub />
        {featuredMatch ? <Phase4BMatchInsights match={featuredMatch} /> : null}
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

function MatchCenter({ selectedMatch, onBack, onOpenPreview }) {
  const selectedId = canonicalMatchId(selectedMatch);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: "", requestId: null });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setState({ loading: true, data: null, error: "", requestId: null });
    loadMatchCenter(selectedId)
      .then((data) => active && setState({ loading: false, data, error: "", requestId: data.requestIds.match }))
      .catch((error) => active && setState({ loading: false, data: null, error: error?.message || "Could not load Match Center.", requestId: error?.requestId || null }));
    return () => { active = false; };
  }, [attempt, selectedId]);

  const match = state.data?.match || selectedMatch;
  return (
    <View style={s.flex}>
      <ScreenHeader
        title={match?.competition_name || "Match Center"}
        subtitle={selectedId ? `MST ID: ${selectedId}` : "MATCH DETAILS"}
        onBack={onBack}
        rightElement={
          <Pressable hitSlop={10} style={s.headerActionBtn}>
            <Ionicons name="share-social-outline" size={20} color={T.color.secondary} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={s.matchCenterContent}>
        <TerminalState loading={state.loading} error={state.error} onRetry={retry} />
        {!state.loading && !state.error ? (
          <>
            <View style={s.matchHero}>
              <Text style={s.heroCompetition}>{match?.competition_name || "Football"}</Text>
              <Text style={s.heroKickoff}>{fullKickoff(match?.kickoff_at)}</Text>
              <View style={s.heroTeams}>
                <View style={s.heroTeam}>
                  <TeamMark name={match?.home_team_name} uri={match?.home_team_logo_url} size={48} />
                  <Text style={s.heroTeamName}>{match?.home_team_name || "Home"}</Text>
                </View>
                <View style={s.heroScoreWrap}>
                  <Text style={s.heroScore}>{scoreText(match)}</Text>
                  <Text style={[s.heroStatus, isLive(match) && s.liveText]}>{statusText(match)}</Text>
                </View>
                <View style={s.heroTeam}>
                  <TeamMark name={match?.away_team_name} uri={match?.away_team_logo_url} size={48} />
                  <Text style={s.heroTeamName}>{match?.away_team_name || "Away"}</Text>
                </View>
              </View>
            </View>

            {/* In-App Professional Match Preview CTA */}
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpenPreview(match)}
              style={s.matchCenterPreviewBanner}
            >
              <View style={s.matchCenterPreviewIcon}>
                <Ionicons name="document-text" size={20} color={T.color.red} />
              </View>
              <View style={s.flex}>
                <Text style={s.matchCenterPreviewTitle}>Read Professional Match Preview</Text>
                <Text style={s.matchCenterPreviewSub}>
                  Full in-app verified analysis, starting lineups, H2H facts and statistics
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={T.color.muted} />
            </Pressable>

            <Phase4BMatchFavorites match={match} />
            <Phase4BMatchVote match={match} />
            <Phase4BMatchInsights match={match} />
            <View style={s.sectionHeadingRow}>
              <Text style={s.sectionTitle}>Match data</Text>
              <Text style={s.matchCount}>Real Scores response</Text>
            </View>
            {MATCH_SECTION_DEFS.map((section) => (
              <MatchDataSection key={section.title} title={section.title} value={firstSectionValue(match, section.keys)} />
            ))}
            <View style={s.dataSection}>
              <View style={s.dataSectionHeader}>
                <Text style={s.dataSectionTitle}>Match Info</Text>
                <Text style={[s.availability, s.available]}> AVAILABLE </Text>
              </View>
              <View style={s.infoGrid}>
                <View style={s.infoCell}>
                  <Text style={s.infoLabel}>KICKOFF</Text>
                  <Text style={s.infoValue}>{fullKickoff(match?.kickoff_at)}</Text>
                </View>
                <View style={s.infoCell}>
                  <Text style={s.infoLabel}>VENUE</Text>
                  <Text style={s.infoValue}>{match?.venue_name || "Unavailable"}</Text>
                </View>
                <View style={s.infoCell}>
                  <Text style={s.infoLabel}>STATUS</Text>
                  <Text style={s.infoValue}>{statusText(match)}</Text>
                </View>
                <View style={s.infoCell}>
                  <Text style={s.infoLabel}>FRESHNESS</Text>
                  <Text style={s.infoValue}>{String(match?.freshness_state || "unknown").toUpperCase()}</Text>
                </View>
              </View>
            </View>
            <View style={s.sectionHeadingRow}>
              <View>
                <Text style={s.sectionEyebrow}>READ ONLY</Text>
                <Text style={s.sectionTitle}>MST Tip Preview</Text>
              </View>
              <Text style={s.noWrites}>NO WRITES</Text>
            </View>
            {state.data?.tipsError ? (
              <View style={s.inlineWarning}>
                <Ionicons name="warning-outline" color={T.color.amber} size={16} />
                <Text style={s.inlineWarningText}>{state.data.tipsError}</Text>
              </View>
            ) : state.data?.tips?.length ? (
              state.data.tips.map((tip) => <TipPreview key={tip.id} tip={tip} />)
            ) : (
              <View style={s.stateCard}>
                <Ionicons name="shield-checkmark-outline" size={26} color={T.color.muted} />
                <Text style={s.stateTitle}>No permitted tips for this match</Text>
                <Text style={s.stateText}>The real tips response is empty. No selection was invented.</Text>
              </View>
            )}
            <RequestId label="match" value={state.data?.requestIds?.match} />
            <RequestId label="tips" value={state.data?.requestIds?.tips} />
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
  const overview = useScoresOverview();
  const { width: screenWidth } = useWindowDimensions();
  const pagerRef = useRef(null);
  const lastBackPressRef = useRef(0);

  const [active, setActive] = useState("matches"); // "matches" | "news" | "favorites" | "tips" | "settings"
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [previewMatch, setPreviewMatch] = useState(null);
  const [subScreen, setSubScreen] = useState(null); // null | "search" | "profile" | "settings"
  const [userAvatar, setUserAvatar] = useState(null);

  // Load user avatar for top header
  useEffect(() => {
    getAuthStatus()
      .then((status) => {
        const avatar = status?.user?.avatar || status?.user?.avatarUrl;
        if (avatar) setUserAvatar(avatar);
      })
      .catch(() => {});
  }, [subScreen]);

  const openMatch = useCallback((match) => {
    setPreviewMatch(null);
    setSubScreen(null);
    setSelectedMatch(match);
  }, []);

  const openPreview = useCallback((match) => {
    setSubScreen(null);
    setPreviewMatch(match);
  }, []);

  const openSearch = useCallback(() => {
    setSubScreen("search");
  }, []);

  const openProfile = useCallback(() => {
    setSubScreen("profile");
  }, []);

  const selectNav = useCallback((next) => {
    setPreviewMatch(null);
    setSelectedMatch(null);
    setSubScreen(null);
    setActive(next);

    // Scroll horizontal pager if navigating to core content screens
    if (next === "matches") {
      pagerRef.current?.scrollTo({ x: 0 * screenWidth, animated: true });
    } else if (next === "news") {
      pagerRef.current?.scrollTo({ x: 1 * screenWidth, animated: true });
    } else if (next === "favorites") {
      pagerRef.current?.scrollTo({ x: 2 * screenWidth, animated: true });
    }
  }, [screenWidth]);

  // Global Android hardware Back navigation hierarchy & double-press root exit
  useEffect(() => {
    const handleHardwareBack = () => {
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
  }, [previewMatch, subScreen, selectedMatch, active, selectNav]);

  // Render secondary screens if active
  let content;
  if (previewMatch) {
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
    content = <Phase4BSearchScreen onBack={() => setSubScreen(null)} />;
  } else if (subScreen === "profile") {
    content = <Phase4BProfileScreen onBack={() => setSubScreen(null)} />;
  } else if (subScreen === "settings" || active === "settings") {
    content = (
      <SettingsScreenV2
        goBack={() => {
          if (subScreen === "settings") setSubScreen(null);
          else selectNav("matches");
        }}
        openProfile={() => setSubScreen("profile")}
      />
    );
  } else if (selectedMatch) {
    content = (
      <MatchCenter
        selectedMatch={selectedMatch}
        onBack={() => setSelectedMatch(null)}
        onOpenPreview={openPreview}
      />
    );
  } else if (active === "tips") {
    content = (
      <TipsScreen
        featuredMatch={overview.matches[0]}
        onOpenSearch={openSearch}
        onOpenProfile={openProfile}
        userAvatar={userAvatar}
      />
    );
  } else {
    // Primary swipe-enabled content sequence: Matches ↔ News ↔ Favorites
    content = (
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        nestedScrollEnabled
        onMomentumScrollEnd={(event) => {
          const offsetX = event.nativeEvent.contentOffset.x;
          const pageIndex = Math.round(offsetX / screenWidth);
          if (pageIndex === 0 && active !== "matches") setActive("matches");
          else if (pageIndex === 1 && active !== "news") setActive("news");
          else if (pageIndex === 2 && active !== "favorites") setActive("favorites");
        }}
        style={s.flex}
        contentContainerStyle={{ width: screenWidth * 3 }}
      >
        <View style={{ width: screenWidth, flex: 1 }}>
          <MatchesScreen
            overview={overview}
            onOpenMatch={openMatch}
            onOpenPreview={openPreview}
            onRetry={overview.retry}
            onOpenSearch={openSearch}
            onOpenProfile={openProfile}
            userAvatar={userAvatar}
          />
        </View>
        <View style={{ width: screenWidth, flex: 1 }}>
          <NewsScreen
            onOpenSearch={openSearch}
            onOpenProfile={openProfile}
            userAvatar={userAvatar}
          />
        </View>
        <View style={{ width: screenWidth, flex: 1 }}>
          <FavoritesScreen
            matches={overview.matches}
            onOpenMatch={openMatch}
            onOpenSearch={openSearch}
            onOpenProfile={openProfile}
            userAvatar={userAvatar}
          />
        </View>
      </ScrollView>
    );
  }

  const showFooter = !previewMatch && !selectedMatch && subScreen !== "search" && subScreen !== "profile";

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.color.bg} />
      {process.env.EXPO_PUBLIC_MST_ENVIRONMENT !== "production" ? <EnvironmentBanner /> : null}
      <View style={s.flex}>{content}</View>
      {showFooter ? (
        <BottomNavigation active={active} onSelect={selectNav} />
      ) : null}
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
    minHeight: 26,
    backgroundColor: T.color.amber,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: T.space.md,
    gap: 8,
  },
  environmentText: { color: T.color.bg, fontSize: 11.5, fontWeight: "900", letterSpacing: 0.6 },
  environmentSub: { color: T.color.bg, fontSize: 10, fontWeight: "700" },
  homeBrandHeader: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: T.space.md,
    borderBottomWidth: 1,
    borderBottomColor: T.color.border,
    backgroundColor: T.color.bg,
  },
  brandBlock: { gap: 1 },
  brandTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  brandBadge: {
    backgroundColor: T.color.redSoft,
    borderWidth: 1,
    borderColor: T.color.red,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  brandMst: { color: T.color.red, fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  brandTitle: { color: T.color.text, fontSize: 20, fontWeight: "900", letterSpacing: 0.2 },
  brandEyebrow: { color: T.color.muted, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.6 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
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
    borderWidth: 1,
    borderColor: T.color.border,
  },
  headerAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.color.border,
  },
  compactDateContainer: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: T.color.border,
    backgroundColor: T.color.bg,
    paddingHorizontal: 4,
  },
  dateArrowBtn: {
    width: 30,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  dateStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 2,
    gap: 5,
  },
  dateCell: {
    width: 48,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.color.surface,
  },
  dateCellActive: {
    borderColor: T.color.red,
    backgroundColor: T.color.red,
  },
  dateDay: { color: T.color.muted, fontSize: 9.5, fontWeight: "800" },
  dateNumber: { color: T.color.secondary, fontSize: 13, fontWeight: "900", lineHeight: 15, marginTop: 1 },
  dateActiveDay: { color: "rgba(255,255,255,0.9)" },
  dateActiveNumber: { color: "#FFFFFF" },
  scrollContent: { padding: T.space.md, paddingBottom: 90 },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
    marginTop: 2,
  },
  sectionEyebrow: { color: T.color.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  sectionTitle: { color: T.color.text, fontSize: 17, fontWeight: "900", marginTop: 1 },
  matchCount: { color: T.color.muted, fontSize: 12.5 },
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
    backgroundColor: T.color.surface,
    borderWidth: 1,
    borderColor: T.color.border,
    borderRadius: T.radius.md,
    overflow: "hidden",
    marginBottom: 10,
  },
  leagueHeader: {
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: T.color.border,
  },
  leagueName: { color: T.color.secondary, fontSize: 13.5, fontWeight: "900", flex: 1 },
  viewAll: { color: T.color.muted, fontSize: 12, fontWeight: "800" },
  matchRow: {
    minHeight: 68,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.color.border,
  },
  matchState: { width: 50, alignItems: "center" },
  matchStateText: { color: T.color.muted, fontSize: 11.5, fontWeight: "800", textAlign: "center" },
  liveText: { color: T.color.red },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.color.red, marginTop: 3 },
  matchTeams: { flex: 1, gap: 5 },
  teamLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  teamLineName: { color: T.color.secondary, fontSize: 13.5, fontWeight: "700", flex: 1 },
  rowScore: { width: 42, textAlign: "center", color: T.color.text, fontSize: 14, fontWeight: "900" },
  bigMatchCard: {
    borderRadius: T.radius.md,
    borderWidth: 1,
    borderColor: T.color.border,
    backgroundColor: T.color.surface,
    padding: 14,
    marginBottom: 11,
  },
  bigMatchHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bigMatchEyebrow: { color: T.color.red, fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  bigMatchComp: { color: T.color.muted, fontSize: 11.5, fontWeight: "700" },
  bigMatchTeams: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  bigTeam: { flex: 1, alignItems: "center", gap: 5 },
  bigTeamName: { color: T.color.text, fontSize: 13, fontWeight: "800", textAlign: "center" },
  bigVersus: { width: 90, alignItems: "center" },
  bigVs: { color: T.color.red, fontSize: 16, fontWeight: "900" },
  bigKickoff: { color: T.color.muted, fontSize: 11.5, textAlign: "center", marginTop: 3 },
  bigMatchActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
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
  previewCtaText: { color: T.color.text, fontSize: 11.5, fontWeight: "900", letterSpacing: 0.4 },
  matchCenterCta: {
    flex: 1,
    backgroundColor: T.color.raised,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.color.border,
    paddingHorizontal: 12,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  matchCenterCtaText: { color: T.color.secondary, fontSize: 11.5, fontWeight: "800", letterSpacing: 0.4 },
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
    height: Platform.OS === "ios" ? 78 : 62,
    borderTopWidth: 1,
    borderTopColor: "#1E2429",
    backgroundColor: "#0A0D0F",
    flexDirection: "row",
    paddingBottom: Platform.OS === "ios" ? 14 : 6,
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 2 },
  navLabel: { color: "#7E8890", fontSize: 11, fontWeight: "700", textAlign: "center" },
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
});
