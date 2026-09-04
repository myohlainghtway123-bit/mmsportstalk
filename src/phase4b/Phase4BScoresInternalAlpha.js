import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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

const T = Object.freeze({
  color: {
    bg: "#080A0C",
    surface: "#101417",
    raised: "#171C20",
    border: "#293036",
    text: "#FFFFFF",
    secondary: "#D4D8DB",
    muted: "#929AA0",
    red: "#F3262D",
    redSoft: "rgba(243,38,45,0.14)",
    amber: "#F4C84D",
    green: "#48C78E",
  },
  space: { xs: 6, sm: 10, md: 16, lg: 22 },
  radius: { sm: 8, md: 13, lg: 17 },
});

const NAV_ITEMS = [
  { id: "matches", label: "Matches", icon: "football-outline", activeIcon: "football" },
  { id: "news", label: "News", icon: "newspaper-outline", activeIcon: "newspaper" },
  { id: "favorites", label: "Favorites", icon: "star-outline", activeIcon: "star" },
  { id: "tips", label: "Tips + Prediction", icon: "radio-outline", activeIcon: "radio" },
  { id: "more", label: "More", icon: "ellipsis-horizontal", activeIcon: "ellipsis-horizontal-circle" },
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
  return Array.from({ length: 10 }, (_, index) => {
    const date = new Date(center);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index - 4);
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
  if (dateKey(date) === dateKey(tomorrow)) return "Tomorrow";
  if (dateKey(date) === dateKey(yesterday)) return "Yesterday";
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

function BrandHeader({ eyebrow = "FOLLOW THE GAME", title = "MST Scores" }) {
  return (
    <View style={s.brandHeader}>
      <View style={s.brandBlock}>
        <Text style={s.brandTitle}><Text style={s.brandMst}>MST</Text> Scores</Text>
        <Text style={s.brandEyebrow}>{eyebrow}</Text>
      </View>
      <View style={s.headerIcons} pointerEvents="none">
        <Ionicons name="search-outline" size={21} color={T.color.secondary} />
        <Ionicons name="notifications-outline" size={21} color={T.color.secondary} />
        <Ionicons name="calendar-outline" size={20} color={T.color.secondary} />
      </View>
      {title !== "MST Scores" ? <Text style={s.screenName}>{title}</Text> : null}
    </View>
  );
}

function BottomNavigation({ active, onSelect }) {
  return (
    <View style={s.bottomNav}>
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
            <Ionicons name={selected ? item.activeIcon : item.icon} size={21} color={selected ? T.color.red : T.color.muted} />
            <Text numberOfLines={1} style={[s.navLabel, selected && s.navLabelActive]}>{item.label}</Text>
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
      {loading ? <ActivityIndicator color={T.color.red} /> : <Ionicons name={error ? "cloud-offline-outline" : "football-outline"} size={27} color={error ? T.color.amber : T.color.muted} />}
      <Text style={s.stateTitle}>{loading ? "Loading match data…" : error ? "Scores service unavailable" : emptyTitle}</Text>
      <Text style={s.stateText}>{loading ? "The request stops after 8 seconds if the Scores service does not respond." : error || emptyText || "The selected match view is empty."}</Text>
      {!loading && onRetry ? (
        <Pressable accessibilityRole="button" style={s.primaryButton} onPress={onRetry}>
          <Ionicons name="refresh" size={16} color={T.color.text} />
          <Text style={s.primaryButtonText}>RETRY</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function TeamMark({ name, uri, size = 30 }) {
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
        <View style={s.teamLine}><TeamMark name={match?.home_team_name} uri={match?.home_team_logo_url} size={24} /><Text numberOfLines={1} style={s.teamLineName}>{match?.home_team_name || "Home"}</Text></View>
        <View style={s.teamLine}><TeamMark name={match?.away_team_name} uri={match?.away_team_logo_url} size={24} /><Text numberOfLines={1} style={s.teamLineName}>{match?.away_team_name || "Away"}</Text></View>
      </View>
      <Text style={[s.rowScore, isLive(match) && s.liveText]}>{scoreText(match)}</Text>
      <Ionicons name="chevron-forward" size={17} color={T.color.muted} />
    </Pressable>
  );
});

function LeagueGroup({ group, onOpen }) {
  return (
    <View style={s.leagueCard}>
      <View style={s.leagueHeader}>
        <TeamMark name={group.name} uri={group.logo} size={24} />
        <Text numberOfLines={1} style={s.leagueName}>{group.name}</Text>
        <Text style={s.viewAll}>View all</Text>
      </View>
      {group.matches.map((match) => <MatchRow key={canonicalMatchId(match)} match={match} onOpen={onOpen} />)}
    </View>
  );
}

function BigMatchPreview({ match, onOpen }) {
  if (!match) return null;
  return (
    <Pressable accessibilityRole="button" onPress={() => onOpen(match)} style={s.bigMatchCard}>
      <Text style={s.bigMatchEyebrow}>BIG MATCH PREVIEW</Text>
      <View style={s.bigMatchTeams}>
        <View style={s.bigTeam}><TeamMark name={match?.home_team_name} uri={match?.home_team_logo_url} size={42} /><Text numberOfLines={2} style={s.bigTeamName}>{match?.home_team_name || "Home"}</Text></View>
        <View style={s.bigVersus}><Text style={s.bigVs}>VS</Text><Text style={s.bigKickoff}>{fullKickoff(match?.kickoff_at)}</Text></View>
        <View style={s.bigTeam}><TeamMark name={match?.away_team_name} uri={match?.away_team_logo_url} size={42} /><Text numberOfLines={2} style={s.bigTeamName}>{match?.away_team_name || "Away"}</Text></View>
      </View>
      <View style={s.previewCta}><Text style={s.previewCtaText}>MATCH CENTER</Text><Ionicons name="arrow-forward" size={15} color={T.color.text} /></View>
    </Pressable>
  );
}

function DateNavigation({ selected, onSelect }) {
  const dates = useMemo(() => dateWindow(), []);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateStrip}>
      {dates.map((date) => {
        const key = dateKey(date);
        const active = selected === key;
        return (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onSelect(key)} style={[s.dateCell, active && s.dateCellActive]}>
            <Text style={[s.dateDay, active && s.dateActiveText]}>{dayLabel(date)}</Text>
            <Text style={[s.dateNumber, active && s.dateActiveText]}>{date.getDate()}</Text>
            <Text style={[s.dateMonth, active && s.dateActiveText]}>{date.toLocaleDateString([], { month: "short" }).toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MatchesScreen({ overview, onOpenMatch, onRetry }) {
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
      <BrandHeader />
      <DateNavigation selected={selectedDate} onSelect={setSelectedDate} />
      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={overview.loading} onRefresh={onRetry} tintColor={T.color.red} colors={[T.color.red]} />}
      >
        <View style={s.sectionHeadingRow}>
          <View><Text style={s.sectionEyebrow}>MATCHES</Text><Text style={s.sectionTitle}>Follow the game</Text></View>
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
          <View key={warning.feed} style={s.inlineWarning}><Ionicons name="warning-outline" color={T.color.amber} size={16} /><Text style={s.inlineWarningText}>{warning.feed}: {warning.message}</Text></View>
        ))}
        {groups.map((group, index) => (
          <React.Fragment key={group.id}>
            <LeagueGroup group={group} onOpen={onOpenMatch} />
            {index === 0 ? <BigMatchPreview match={group.matches[0]} onOpen={onOpenMatch} /> : null}
          </React.Fragment>
        ))}
        <RequestId label="fixtures" value={overview.requestIds.fixtures} />
        <RequestId label="live" value={overview.requestIds.live} />
        <RequestId label="results" value={overview.requestIds.results} />
      </ScrollView>
    </View>
  );
}

function DependencyCard({ icon, title, text, action }) {
  return (
    <View style={s.dependencyCard}>
      <View style={s.dependencyIcon}><Ionicons name={icon} size={22} color={T.color.red} /></View>
      <View style={s.dependencyCopy}><Text style={s.dependencyTitle}>{title}</Text><Text style={s.dependencyText}>{text}</Text></View>
      {action ? <View style={s.disabledButton}><Text style={s.disabledButtonText}>{action}</Text></View> : null}
    </View>
  );
}

function ShellScreen({ title, eyebrow, active, onSelect, children }) {
  return (
    <View style={s.flex}>
      <BrandHeader title={title} eyebrow={eyebrow} />
      <ScrollView contentContainerStyle={s.scrollContent}>{children}</ScrollView>
      <BottomNavigation active={active} onSelect={onSelect} />
    </View>
  );
}

function NewsScreen({ onSelect }) {
  return (
    <ShellScreen title="News" eyebrow="MST FOOTBALL EDITORIAL" active="news" onSelect={onSelect}>
      <Phase4BNewsPanel />
      <Phase4BAdBanner />
    </ShellScreen>
  );
}

function FavoritesScreen({ onSelect, matches, onOpenMatch }) {
  const realMatches = matches.slice(0, 2);
  return (
    <ShellScreen title="Favorites" eyebrow="TEAMS · COMPETITIONS" active="favorites" onSelect={onSelect}>
      <View style={s.segmented}><View style={[s.segment, s.segmentActive]}><Text style={s.segmentActiveText}>All</Text></View><View style={s.segment}><Text style={s.segmentText}>Teams</Text></View><View style={s.segment}><Text style={s.segmentText}>Competitions</Text></View></View>
      <Phase4BFavoritesPanel />
      <View style={s.sectionHeadingRow}><Text style={s.sectionTitle}>Real matches</Text><Text style={s.matchCount}>Not personalized</Text></View>
      {realMatches.length ? <View style={s.leagueCard}>{realMatches.map((match) => <MatchRow key={canonicalMatchId(match)} match={match} onOpen={onOpenMatch} />)}</View> : <TerminalState empty emptyTitle="No matches" emptyText="There are no real matches to show here." />}
    </ShellScreen>
  );
}

function TipsPredictionScreen({ onSelect, featuredMatch, onOpenMatch }) {
  return (
    <ShellScreen title="Tips + Prediction" eyebrow="TIPS · ENTITLEMENTS · LEADERBOARDS" active="tips" onSelect={onSelect}>
      <View style={s.safetyBanner}><Ionicons name="shield-checkmark-outline" size={20} color={T.color.green} /><View style={s.dependencyCopy}><Text style={s.safetyTitle}>No prediction writes</Text><Text style={s.safetyText}>MST Scores can show the read-only Prediction leaderboard and MST Tips, but exact-score prediction creation, editing and submission stay in MST Prediction.</Text></View></View>
      <Phase4BReadOnlyHub />
      {featuredMatch ? <Phase4BMatchInsights match={featuredMatch} /> : null}
    </ShellScreen>
  );
}

function MoreScreen({ onSelect }) {
  return (
    <ShellScreen title="More" eyebrow="SEARCH · NOTIFICATIONS" active="more" onSelect={onSelect}>
      <Phase4BSearchPanel />
      <Phase4BNotificationsPanel />
      <View style={s.profileCard}><View style={s.profileAvatar}><Ionicons name="football-outline" size={28} color={T.color.red} /></View><View style={s.dependencyCopy}><Text style={s.dependencyTitle}>MST Scores</Text><Text style={s.dependencyText}>Follow the Game · account-backed favorites, notifications and read-only prediction data use existing MST services.</Text></View></View>
    </ShellScreen>
  );
}

function MatchDataSection({ title, value }) {
  const available = value !== undefined;
  return (
    <View style={s.dataSection}>
      <View style={s.dataSectionHeader}><Text style={s.dataSectionTitle}>{title}</Text><Text style={[s.availability, available && s.available]}> {available ? "AVAILABLE" : "UNAVAILABLE"} </Text></View>
      <Text style={s.dataSectionText}>{available ? sectionSummary(value) : `The current Match detail response does not provide ${title}.`}</Text>
    </View>
  );
}

function TipPreview({ tip }) {
  return (
    <View style={s.tipCard}>
      <View style={s.tipTitleRow}><Text style={s.tipTitle}>{tip.title}</Text><Text style={[s.tipAccess, tip.locked ? s.tipLocked : s.tipFree]}>{tip.locked ? "LOCKED" : "FREE"}</Text></View>
      {tip.summary ? <Text style={s.dependencyText}>{tip.summary}</Text> : null}
      <Text style={s.tipSelection}>{tip.locked ? "Selection protected by server authorization" : `Selection: ${tip.selection || "Unavailable"}`}</Text>
    </View>
  );
}

function MatchCenter({ selectedMatch, onBack }) {
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
      <View style={s.matchCenterHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Matches" hitSlop={10} onPress={onBack}><Ionicons name="chevron-back" size={27} color={T.color.text} /></Pressable>
        <View style={s.dependencyCopy}><Text style={s.matchCenterTitle}>Match Center</Text><Text selectable numberOfLines={1} style={s.canonicalId}>Canonical MST ID: {selectedId}</Text></View>
        <Ionicons name="share-social-outline" size={21} color={T.color.secondary} />
      </View>
      <ScrollView contentContainerStyle={s.matchCenterContent}>
        <TerminalState loading={state.loading} error={state.error} onRetry={retry} />
        {!state.loading && !state.error ? (
          <>
            <View style={s.matchHero}>
              <Text style={s.heroCompetition}>{match?.competition_name || "Football"}</Text>
              <Text style={s.heroKickoff}>{fullKickoff(match?.kickoff_at)}</Text>
              <View style={s.heroTeams}>
                <View style={s.heroTeam}><TeamMark name={match?.home_team_name} uri={match?.home_team_logo_url} size={52} /><Text style={s.heroTeamName}>{match?.home_team_name || "Home"}</Text></View>
                <View style={s.heroScoreWrap}><Text style={s.heroScore}>{scoreText(match)}</Text><Text style={[s.heroStatus, isLive(match) && s.liveText]}>{statusText(match)}</Text></View>
                <View style={s.heroTeam}><TeamMark name={match?.away_team_name} uri={match?.away_team_logo_url} size={52} /><Text style={s.heroTeamName}>{match?.away_team_name || "Away"}</Text></View>
              </View>
            </View>
            <Phase4BMatchFavorites match={match} />
            <Phase4BMatchVote match={match} />
            <Phase4BMatchInsights match={match} />
            <View style={s.sectionHeadingRow}><Text style={s.sectionTitle}>Match data</Text><Text style={s.matchCount}>Real Scores response</Text></View>
            {MATCH_SECTION_DEFS.map((section) => <MatchDataSection key={section.title} title={section.title} value={firstSectionValue(match, section.keys)} />)}
            <View style={s.dataSection}>
              <View style={s.dataSectionHeader}><Text style={s.dataSectionTitle}>Match Info</Text><Text style={[s.availability, s.available]}> AVAILABLE </Text></View>
              <View style={s.infoGrid}>
                <View style={s.infoCell}><Text style={s.infoLabel}>KICKOFF</Text><Text style={s.infoValue}>{fullKickoff(match?.kickoff_at)}</Text></View>
                <View style={s.infoCell}><Text style={s.infoLabel}>VENUE</Text><Text style={s.infoValue}>{match?.venue_name || "Unavailable"}</Text></View>
                <View style={s.infoCell}><Text style={s.infoLabel}>STATUS</Text><Text style={s.infoValue}>{statusText(match)}</Text></View>
                <View style={s.infoCell}><Text style={s.infoLabel}>FRESHNESS</Text><Text style={s.infoValue}>{String(match?.freshness_state || "unknown").toUpperCase()}</Text></View>
              </View>
            </View>
            <View style={s.sectionHeadingRow}><View><Text style={s.sectionEyebrow}>READ ONLY</Text><Text style={s.sectionTitle}>MST Tip Preview</Text></View><Text style={s.noWrites}>NO WRITES</Text></View>
            {state.data?.tipsError ? <View style={s.inlineWarning}><Ionicons name="warning-outline" color={T.color.amber} size={16} /><Text style={s.inlineWarningText}>{state.data.tipsError}</Text></View> : state.data?.tips?.length ? state.data.tips.map((tip) => <TipPreview key={tip.id} tip={tip} />) : <View style={s.stateCard}><Ionicons name="shield-checkmark-outline" size={26} color={T.color.muted} /><Text style={s.stateTitle}>No permitted tips for this match</Text><Text style={s.stateText}>The real tips response is empty. No selection was invented.</Text></View>}
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
  const [active, setActive] = useState("matches");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const openMatch = useCallback((match) => setSelectedMatch(match), []);
  const selectNav = useCallback((next) => { setSelectedMatch(null); setActive(next); }, []);

  useEffect(() => {
    const handleBackPress = () => {
      if (selectedMatch) {
        setSelectedMatch(null);
        return true;
      }
      if (active !== "matches") {
        setActive("matches");
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", handleBackPress);
    return () => subscription.remove();
  }, [selectedMatch, active]);

  let screen;
  if (selectedMatch) screen = <MatchCenter selectedMatch={selectedMatch} onBack={() => setSelectedMatch(null)} />;
  else if (active === "news") screen = <NewsScreen onSelect={selectNav} />;
  else if (active === "favorites") screen = <FavoritesScreen onSelect={selectNav} matches={overview.matches} onOpenMatch={openMatch} />;
  else if (active === "tips") screen = <TipsPredictionScreen onSelect={selectNav} featuredMatch={overview.matches[0]} onOpenMatch={openMatch} />;
  else if (active === "more") screen = <MoreScreen onSelect={selectNav} />;
  else screen = <MatchesScreen overview={overview} onOpenMatch={openMatch} onRetry={overview.retry} />;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.color.bg} />
      {process.env.EXPO_PUBLIC_MST_ENVIRONMENT !== "production" ? <EnvironmentBanner /> : null}
      {screen}
      {!selectedMatch && active === "matches" ? <BottomNavigation active={active} onSelect={selectNav} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.color.bg, paddingTop: StatusBar.currentHeight || 24 },
  flex: { flex: 1 },
  environmentBanner: { minHeight: 30, paddingHorizontal: 14, backgroundColor: T.color.amber, flexDirection: "row", alignItems: "center", gap: 7 },
  environmentText: { color: T.color.bg, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  environmentSub: { marginLeft: "auto", color: T.color.bg, fontSize: 8, fontWeight: "800" },
  brandHeader: { minHeight: 77, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: T.color.border, flexDirection: "row", alignItems: "center" },
  brandBlock: { flex: 1 },
  brandTitle: { color: T.color.text, fontSize: 21, fontWeight: "800" },
  brandMst: { color: T.color.red, fontWeight: "900", letterSpacing: 1 },
  brandEyebrow: { color: T.color.muted, fontSize: 8, fontWeight: "800", letterSpacing: 0.8, marginTop: 2 },
  headerIcons: { flexDirection: "row", gap: 15, alignItems: "center" },
  screenName: { position: "absolute", left: 16, bottom: 7, color: T.color.secondary, fontSize: 10, fontWeight: "800" },
  dateStrip: { paddingHorizontal: 10, paddingVertical: 9, gap: 6, borderBottomWidth: 1, borderBottomColor: T.color.border },
  dateCell: { width: 62, minHeight: 65, borderRadius: T.radius.sm, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  dateCellActive: { borderColor: T.color.red, backgroundColor: T.color.redSoft },
  dateDay: { color: T.color.muted, fontSize: 9, fontWeight: "700" },
  dateNumber: { color: T.color.secondary, fontSize: 19, fontWeight: "900", lineHeight: 23 },
  dateMonth: { color: T.color.muted, fontSize: 8, fontWeight: "800" },
  dateActiveText: { color: T.color.red },
  scrollContent: { padding: T.space.md, paddingBottom: 100 },
  sectionHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 11, marginTop: 4 },
  sectionEyebrow: { color: T.color.red, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.8 },
  sectionTitle: { color: T.color.text, fontSize: 15, fontWeight: "900", marginTop: 2 },
  matchCount: { color: T.color.muted, fontSize: 9.5 },
  stateCard: { minHeight: 145, borderRadius: T.radius.md, backgroundColor: T.color.surface, borderWidth: 1, borderColor: T.color.border, padding: 18, alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  stateTitle: { color: T.color.text, fontSize: 13, fontWeight: "800", textAlign: "center" },
  stateText: { color: T.color.muted, fontSize: 10.5, lineHeight: 15, textAlign: "center" },
  primaryButton: { minHeight: 36, borderRadius: T.radius.sm, backgroundColor: T.color.red, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  primaryButtonText: { color: T.color.text, fontSize: 9, fontWeight: "900" },
  fallbackMark: { backgroundColor: T.color.raised, borderWidth: 1, borderColor: T.color.border, alignItems: "center", justifyContent: "center" },
  fallbackMarkText: { color: T.color.secondary, fontSize: 11, fontWeight: "900" },
  leagueCard: { backgroundColor: T.color.surface, borderWidth: 1, borderColor: T.color.border, borderRadius: T.radius.md, overflow: "hidden", marginBottom: 12 },
  leagueHeader: { minHeight: 45, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderBottomColor: T.color.border },
  leagueName: { color: T.color.secondary, fontSize: 11.5, fontWeight: "900", flex: 1 },
  viewAll: { color: T.color.red, fontSize: 8.5, fontWeight: "800" },
  matchRow: { minHeight: 73, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.color.border },
  matchState: { width: 48, alignItems: "center" },
  matchStateText: { color: T.color.muted, fontSize: 9, fontWeight: "800", textAlign: "center" },
  liveText: { color: T.color.red },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.color.red, marginTop: 4 },
  matchTeams: { flex: 1, gap: 7 },
  teamLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  teamLineName: { color: T.color.secondary, fontSize: 10.5, fontWeight: "700", flex: 1 },
  rowScore: { width: 43, textAlign: "center", color: T.color.text, fontSize: 12, fontWeight: "900" },
  bigMatchCard: { borderRadius: T.radius.md, borderWidth: 1, borderColor: T.color.red, backgroundColor: "#160C0E", padding: 15, marginBottom: 12 },
  bigMatchEyebrow: { color: T.color.red, fontSize: 9, fontWeight: "900", textAlign: "center", letterSpacing: 0.8 },
  bigMatchTeams: { flexDirection: "row", alignItems: "center", marginTop: 13 },
  bigTeam: { flex: 1, alignItems: "center", gap: 6 },
  bigTeamName: { color: T.color.text, fontSize: 11, fontWeight: "800", textAlign: "center" },
  bigVersus: { width: 105, alignItems: "center" },
  bigVs: { color: T.color.text, fontSize: 17, fontWeight: "900" },
  bigKickoff: { color: T.color.muted, fontSize: 8.5, textAlign: "center", marginTop: 5 },
  previewCta: { alignSelf: "center", backgroundColor: T.color.red, borderRadius: 18, paddingHorizontal: 17, minHeight: 34, flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  previewCtaText: { color: T.color.text, fontSize: 9, fontWeight: "900" },
  inlineWarning: { minHeight: 42, borderRadius: T.radius.sm, backgroundColor: T.color.surface, borderWidth: 1, borderColor: T.color.border, padding: 10, flexDirection: "row", gap: 7, alignItems: "center", marginBottom: 10 },
  inlineWarningText: { flex: 1, color: T.color.muted, fontSize: 9.5, lineHeight: 14 },
  requestId: { color: T.color.muted, fontSize: 8, marginTop: 6 },
  bottomNav: { height: 69, borderTopWidth: 1, borderTopColor: T.color.border, backgroundColor: "#0B0E10", flexDirection: "row", paddingBottom: 4 },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 2 },
  navLabel: { color: T.color.muted, fontSize: 7.5, fontWeight: "700", textAlign: "center" },
  navLabelActive: { color: T.color.red },
  placeholderHero: { minHeight: 180, borderRadius: T.radius.lg, backgroundColor: T.color.surface, borderWidth: 1, borderColor: T.color.border, alignItems: "center", justifyContent: "center", padding: 22, gap: 9, marginBottom: 12 },
  placeholderTitle: { color: T.color.text, fontSize: 16, fontWeight: "900", textAlign: "center" },
  placeholderText: { color: T.color.muted, fontSize: 10.5, lineHeight: 16, textAlign: "center" },
  dependencyCard: { minHeight: 78, borderRadius: T.radius.md, backgroundColor: T.color.surface, borderWidth: 1, borderColor: T.color.border, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  dependencyIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: T.color.redSoft, alignItems: "center", justifyContent: "center" },
  dependencyCopy: { flex: 1 },
  dependencyTitle: { color: T.color.secondary, fontSize: 11.5, fontWeight: "800" },
  dependencyText: { color: T.color.muted, fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  disabledButton: { borderRadius: 6, borderWidth: 1, borderColor: T.color.border, backgroundColor: T.color.raised, paddingHorizontal: 7, paddingVertical: 6 },
  disabledButtonText: { color: T.color.muted, fontSize: 7.5, fontWeight: "900" },
  segmented: { minHeight: 40, flexDirection: "row", backgroundColor: T.color.surface, borderRadius: T.radius.sm, overflow: "hidden", borderWidth: 1, borderColor: T.color.border, marginBottom: 12 },
  segment: { flex: 1, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: T.color.red },
  segmentText: { color: T.color.muted, fontSize: 9.5, fontWeight: "800" },
  segmentActiveText: { color: T.color.text, fontSize: 9.5, fontWeight: "900" },
  safetyBanner: { borderRadius: T.radius.md, borderWidth: 1, borderColor: T.color.green, backgroundColor: T.color.surface, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  safetyTitle: { color: T.color.green, fontSize: 11.5, fontWeight: "900" },
  safetyText: { color: T.color.muted, fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  featuredPrediction: { borderRadius: T.radius.md, borderWidth: 1, borderColor: T.color.red, backgroundColor: T.color.surface, padding: 14, marginBottom: 12 },
  featuredPredictionTitle: { color: T.color.text, fontSize: 14, fontWeight: "900", marginTop: 6 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  disabledAction: { flex: 1, minHeight: 38, borderRadius: T.radius.sm, backgroundColor: T.color.raised, borderWidth: 1, borderColor: T.color.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  disabledActionText: { color: T.color.muted, fontSize: 8.5, fontWeight: "800" },
  outlineAction: { minHeight: 38, borderRadius: T.radius.sm, borderWidth: 1, borderColor: T.color.red, paddingHorizontal: 13, justifyContent: "center" },
  outlineActionText: { color: T.color.red, fontSize: 8.5, fontWeight: "900" },
  twoColumns: { flexDirection: "row", gap: 9, marginBottom: 10 },
  leaderboardCard: { flex: 1, minHeight: 112, borderRadius: T.radius.md, backgroundColor: T.color.surface, borderWidth: 1, borderColor: T.color.border, padding: 11 },
  leaderboardTitle: { color: T.color.secondary, fontSize: 10, fontWeight: "900" },
  leaderboardEmpty: { color: T.color.muted, fontSize: 9, lineHeight: 13, marginTop: 9 },
  scoringCard: { borderRadius: T.radius.md, backgroundColor: T.color.surface, borderWidth: 1, borderColor: T.color.border, padding: 12 },
  scoringRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 9 },
  scoreRule: { color: T.color.muted, fontSize: 8.5 },
  scorePoints: { color: T.color.red, fontWeight: "900" },
  profileCard: { minHeight: 92, borderRadius: T.radius.md, backgroundColor: T.color.surface, borderWidth: 1, borderColor: T.color.border, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  profileAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: T.color.raised, borderWidth: 1, borderColor: T.color.border, alignItems: "center", justifyContent: "center" },
  menuCard: { borderRadius: T.radius.md, backgroundColor: T.color.surface, borderWidth: 1, borderColor: T.color.border, overflow: "hidden" },
  menuRow: { minHeight: 52, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.color.border },
  menuTitle: { color: T.color.secondary, fontSize: 10.5, fontWeight: "700", flex: 1 },
  menuDetail: { color: T.color.muted, fontSize: 8, maxWidth: 115, textAlign: "right" },
  matchCenterHeader: { minHeight: 65, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: T.color.border },
  matchCenterTitle: { color: T.color.text, fontSize: 15, fontWeight: "900" },
  canonicalId: { color: T.color.muted, fontSize: 8.5, marginTop: 2 },
  matchCenterContent: { padding: T.space.md, paddingBottom: 35 },
  matchHero: { borderRadius: T.radius.lg, backgroundColor: T.color.surface, borderWidth: 1, borderColor: T.color.border, padding: 15, marginBottom: 15 },
  heroCompetition: { color: T.color.secondary, fontSize: 11, fontWeight: "900", textAlign: "center" },
  heroKickoff: { color: T.color.muted, fontSize: 9, textAlign: "center", marginTop: 4 },
  heroTeams: { flexDirection: "row", alignItems: "center", minHeight: 125, marginTop: 7 },
  heroTeam: { flex: 1, alignItems: "center", gap: 7 },
  heroTeamName: { color: T.color.text, fontSize: 11.5, fontWeight: "800", textAlign: "center" },
  heroScoreWrap: { width: 92, alignItems: "center" },
  heroScore: { color: T.color.text, fontSize: 27, fontWeight: "900" },
  heroStatus: { color: T.color.muted, fontSize: 9, fontWeight: "900", marginTop: 5 },
  dataSection: { borderRadius: T.radius.md, backgroundColor: T.color.surface, borderWidth: 1, borderColor: T.color.border, padding: 12, marginBottom: 9 },
  dataSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dataSectionTitle: { color: T.color.secondary, fontSize: 11.5, fontWeight: "900" },
  availability: { color: T.color.muted, fontSize: 7.5, fontWeight: "900", borderWidth: 1, borderColor: T.color.border, borderRadius: 5, overflow: "hidden" },
  available: { color: T.color.green, borderColor: T.color.green },
  dataSectionText: { color: T.color.muted, fontSize: 9.5, lineHeight: 14, marginTop: 8 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  infoCell: { width: "50%", padding: 7 },
  infoLabel: { color: T.color.muted, fontSize: 7.5, fontWeight: "900" },
  infoValue: { color: T.color.secondary, fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  noWrites: { color: T.color.red, fontSize: 8, fontWeight: "900", borderWidth: 1, borderColor: T.color.red, borderRadius: 5, padding: 5 },
  tipCard: { borderRadius: T.radius.md, backgroundColor: T.color.surface, borderWidth: 1, borderColor: T.color.border, padding: 12, marginBottom: 9 },
  tipTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  tipTitle: { color: T.color.secondary, fontSize: 11, fontWeight: "900", flex: 1 },
  tipAccess: { fontSize: 7.5, fontWeight: "900", borderWidth: 1, borderRadius: 5, overflow: "hidden" },
  tipLocked: { color: T.color.amber, borderColor: T.color.amber },
  tipFree: { color: T.color.green, borderColor: T.color.green },
  tipSelection: { color: T.color.muted, fontSize: 9, marginTop: 8 },
});
