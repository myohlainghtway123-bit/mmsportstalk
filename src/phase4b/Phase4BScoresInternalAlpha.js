import React, { memo, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  loadScoresFeed,
} from "./scoresStagingApi";

const C = {
  bg: "#080A0C",
  panel: "#111416",
  panel2: "#171B1E",
  border: "#292F33",
  text: "#FFFFFF",
  text2: "#D4D7D9",
  muted: "#92999E",
  red: "#F3262D",
  redSoft: "rgba(243,38,45,0.15)",
  amber: "#F4C84D",
  green: "#48C78E",
};

const FEEDS = [
  { id: "fixtures", label: "FIXTURES" },
  { id: "live", label: "LIVE" },
  { id: "results", label: "RESULTS" },
];

function dateTime(value) {
  if (!value) return "Kickoff unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusText(match) {
  const status = String(match?.status ?? "scheduled").toUpperCase();
  if (status === "LIVE" && match?.minute != null) return `LIVE · ${match.minute}'`;
  if (status === "FINISHED") return "FULL TIME";
  return String(match?.status_detail || status).toUpperCase();
}

function scoreText(match) {
  if (match?.home_score == null || match?.away_score == null) return "VS";
  return `${match.home_score}  –  ${match.away_score}`;
}

function EnvironmentBanner() {
  return (
    <View style={s.environmentBanner} accessibilityLabel="STAGING INTERNAL build">
      <Ionicons name="flask-outline" size={16} color={C.bg} />
      <Text style={s.environmentText}>STAGING / INTERNAL</Text>
      <Text style={s.environmentSub}>REAL MST SCORES API</Text>
    </View>
  );
}

function RequestId({ label, value }) {
  if (!value) return null;
  return <Text selectable style={s.requestId}>{label} request_id: {value}</Text>;
}

function TerminalState({ loading, error, empty, onRetry }) {
  if (loading) {
    return (
      <View style={s.stateCard}>
        <ActivityIndicator color={C.red} />
        <Text style={s.stateTitle}>Loading staging data…</Text>
        <Text style={s.stateText}>This request stops after 8 seconds if the dependency does not respond.</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={s.stateCard}>
        <Ionicons name="cloud-offline-outline" size={28} color={C.amber} />
        <Text style={s.stateTitle}>Staging dependency unavailable</Text>
        <Text style={s.stateText}>{error}</Text>
        <Pressable accessibilityRole="button" style={s.retryButton} onPress={onRetry}>
          <Ionicons name="refresh" size={16} color={C.text} />
          <Text style={s.retryText}>RETRY</Text>
        </Pressable>
      </View>
    );
  }
  if (empty) {
    return (
      <View style={s.stateCard}>
        <Ionicons name="football-outline" size={28} color={C.muted} />
        <Text style={s.stateTitle}>No matches available</Text>
        <Text style={s.stateText}>The selected real staging feed is empty. Try another tab or retry.</Text>
        <Pressable accessibilityRole="button" style={s.retryButton} onPress={onRetry}>
          <Ionicons name="refresh" size={16} color={C.text} />
          <Text style={s.retryText}>RETRY</Text>
        </Pressable>
      </View>
    );
  }
  return null;
}

const MatchCard = memo(function MatchCard({ match, onOpen }) {
  const id = canonicalMatchId(match);
  const live = String(match?.status).toLowerCase() === "live";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open match ${match?.home_team_name || "Home"} versus ${match?.away_team_name || "Away"}`}
      style={[s.matchCard, live && s.liveCard]}
      onPress={() => id && onOpen(match)}
    >
      <View style={s.cardTop}>
        <Text numberOfLines={1} style={s.competition}>{match?.competition_name || "Football"}</Text>
        <Text style={[s.status, live && s.liveText]}>{statusText(match)}</Text>
      </View>
      <View style={s.teamsRow}>
        <Text numberOfLines={2} style={s.teamName}>{match?.home_team_name || "Home"}</Text>
        <Text style={[s.score, live && s.liveText]}>{scoreText(match)}</Text>
        <Text numberOfLines={2} style={[s.teamName, s.teamNameRight]}>{match?.away_team_name || "Away"}</Text>
      </View>
      <Text style={s.kickoff}>{dateTime(match?.kickoff_at)}</Text>
      <View style={s.canonicalRow}>
        <Text selectable numberOfLines={1} style={s.canonicalText}>MST match: {id}</Text>
        <Ionicons name="chevron-forward" size={17} color={C.muted} />
      </View>
    </Pressable>
  );
});

function ScoresHome({ onOpenMatch }) {
  const [feed, setFeed] = useState("fixtures");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true, matches: [], error: "", requestId: null });

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setState({ loading: true, matches: [], error: "", requestId: null });
    loadScoresFeed(feed)
      .then((result) => {
        if (!active) return;
        setState({ loading: false, matches: result.matches, error: "", requestId: result.requestId });
      })
      .catch((error) => {
        if (!active) return;
        setState({ loading: false, matches: [], error: error?.message || "Could not load staging matches.", requestId: error?.requestId || null });
      });
    return () => { active = false; };
  }, [feed, attempt]);

  return (
    <View style={s.screen}>
      <EnvironmentBanner />
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>PHASE 4B INTERNAL ALPHA</Text>
          <Text style={s.title}>MST Scores</Text>
          <Text style={s.subtitle}>Real staging fixtures, live scores and results</Text>
        </View>
        <View style={s.readOnlyBadge}><Text style={s.readOnlyText}>READ ONLY</Text></View>
      </View>

      <View style={s.tabs}>
        {FEEDS.map((item) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: feed === item.id }}
            key={item.id}
            style={[s.tab, feed === item.id && s.tabActive]}
            onPress={() => setFeed(item.id)}
          >
            <Text style={[s.tabText, feed === item.id && s.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={state.loading} onRefresh={retry} tintColor={C.red} colors={[C.red]} />}
      >
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{feed.toUpperCase()}</Text>
          <Text style={s.count}>{state.matches.length} matches</Text>
        </View>
        <TerminalState
          loading={state.loading}
          error={state.error}
          empty={!state.loading && !state.error && state.matches.length === 0}
          onRetry={retry}
        />
        {state.matches.map((match) => (
          <MatchCard key={canonicalMatchId(match)} match={match} onOpen={onOpenMatch} />
        ))}
        <RequestId label="scores" value={state.requestId} />
        <View style={s.bottomSpace} />
      </ScrollView>
    </View>
  );
}

function TipPreview({ tip }) {
  return (
    <View style={s.tipCard}>
      <View style={s.tipTitleRow}>
        <Text numberOfLines={1} style={s.tipTitle}>{tip.title}</Text>
        <View style={[s.tipAccess, tip.locked ? s.tipLocked : s.tipFree]}>
          <Ionicons name={tip.locked ? "lock-closed" : "lock-open"} size={12} color={tip.locked ? C.amber : C.green} />
          <Text style={[s.tipAccessText, { color: tip.locked ? C.amber : C.green }]}>{tip.locked ? "LOCKED" : "FREE"}</Text>
        </View>
      </View>
      {tip.summary ? <Text style={s.tipSummary}>{tip.summary}</Text> : null}
      <Text style={s.tipSelection}>{tip.locked ? "Selection protected by the server" : `Selection: ${tip.selection || "Unavailable"}`}</Text>
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
      .then((data) => {
        if (!active) return;
        setState({ loading: false, data, error: "", requestId: data.requestIds.match });
      })
      .catch((error) => {
        if (!active) return;
        setState({ loading: false, data: null, error: error?.message || "Could not load Match Center.", requestId: error?.requestId || null });
      });
    return () => { active = false; };
  }, [selectedId, attempt]);

  const match = state.data?.match || selectedMatch;
  return (
    <View style={s.screen}>
      <EnvironmentBanner />
      <View style={s.matchHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Scores" hitSlop={10} onPress={onBack}>
          <Ionicons name="chevron-back" size={28} color={C.text} />
        </Pressable>
        <View style={s.matchHeaderText}>
          <Text style={s.eyebrow}>MATCH CENTER</Text>
          <Text selectable numberOfLines={1} style={s.matchId}>Canonical MST ID: {selectedId}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <TerminalState loading={state.loading} error={state.error} onRetry={retry} />
        {!state.loading && !state.error ? (
          <>
            <View style={s.heroCard}>
              <Text style={s.competitionCenter}>{match?.competition_name || "Football"}</Text>
              <Text style={s.kickoffCenter}>{dateTime(match?.kickoff_at)}</Text>
              <View style={s.heroTeams}>
                <Text style={s.heroTeam}>{match?.home_team_name || "Home"}</Text>
                <View style={s.heroScoreWrap}>
                  <Text style={s.heroScore}>{scoreText(match)}</Text>
                  <Text style={s.heroStatus}>{statusText(match)}</Text>
                </View>
                <Text style={[s.heroTeam, s.teamNameRight]}>{match?.away_team_name || "Away"}</Text>
              </View>
              <View style={s.contextGrid}>
                <View style={s.contextItem}><Text style={s.contextLabel}>VENUE</Text><Text numberOfLines={2} style={s.contextValue}>{match?.venue_name || "Unavailable"}</Text></View>
                <View style={s.contextItem}><Text style={s.contextLabel}>QUALITY</Text><Text style={s.contextValue}>{match?.quality_score ?? "—"}</Text></View>
                <View style={s.contextItem}><Text style={s.contextLabel}>FRESHNESS</Text><Text style={s.contextValue}>{String(match?.freshness_state || "unknown").toUpperCase()}</Text></View>
              </View>
            </View>

            <View style={s.previewHeader}>
              <View>
                <Text style={s.sectionTitle}>PREDICTION / TIP PREVIEW</Text>
                <Text style={s.previewSub}>Read-only context. MST Scores cannot submit predictions.</Text>
              </View>
              <View style={s.readOnlyBadge}><Text style={s.readOnlyText}>NO WRITES</Text></View>
            </View>

            <View style={s.outcomes} pointerEvents="none">
              {["HOME", "DRAW", "AWAY"].map((outcome) => <View key={outcome} style={s.outcome}><Text style={s.outcomeText}>{outcome}</Text></View>)}
            </View>

            {state.data?.tipsError ? (
              <View style={s.inlineError}>
                <Ionicons name="alert-circle-outline" size={18} color={C.amber} />
                <Text style={s.inlineErrorText}>Tip preview unavailable: {state.data.tipsError}</Text>
              </View>
            ) : state.data?.tips?.length ? (
              state.data.tips.map((tip) => <TipPreview key={tip.id} tip={tip} />)
            ) : (
              <View style={s.emptyPreview}>
                <Ionicons name="shield-checkmark-outline" size={24} color={C.muted} />
                <Text style={s.stateTitle}>No permitted tips for this match</Text>
                <Text style={s.stateText}>The staging API returned an empty read-only preview.</Text>
              </View>
            )}

            <RequestId label="match" value={state.data?.requestIds?.match} />
            <RequestId label="tips" value={state.data?.requestIds?.tips} />
          </>
        ) : null}
        <View style={s.bottomSpace} />
      </ScrollView>
    </View>
  );
}

export default function Phase4BScoresInternalAlpha() {
  const [selectedMatch, setSelectedMatch] = useState(null);
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      {selectedMatch ? (
        <MatchCenter selectedMatch={selectedMatch} onBack={() => setSelectedMatch(null)} />
      ) : (
        <ScoresHome onOpenMatch={setSelectedMatch} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  screen: { flex: 1, backgroundColor: C.bg, paddingTop: StatusBar.currentHeight || 24 },
  environmentBanner: { minHeight: 34, paddingHorizontal: 16, backgroundColor: C.amber, flexDirection: "row", alignItems: "center", gap: 7 },
  environmentText: { color: C.bg, fontSize: 12, fontWeight: "900", letterSpacing: 1.1 },
  environmentSub: { marginLeft: "auto", color: C.bg, fontSize: 9, fontWeight: "800" },
  header: { minHeight: 108, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: C.border },
  eyebrow: { color: C.red, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.1 },
  title: { color: C.text, fontSize: 28, fontWeight: "900", marginTop: 4 },
  subtitle: { color: C.muted, fontSize: 11, marginTop: 4 },
  readOnlyBadge: { borderWidth: 1, borderColor: C.red, backgroundColor: C.redSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  readOnlyText: { color: C.red, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.7 },
  tabs: { flexDirection: "row", padding: 9, gap: 7, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, minHeight: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" },
  tabActive: { backgroundColor: C.redSoft, borderColor: C.red },
  tabText: { color: C.muted, fontSize: 10, fontWeight: "900" },
  tabTextActive: { color: C.red },
  content: { padding: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { color: C.text2, fontSize: 12, fontWeight: "900", letterSpacing: 0.6 },
  count: { color: C.muted, fontSize: 10 },
  stateCard: { minHeight: 170, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel, borderRadius: 14, alignItems: "center", justifyContent: "center", padding: 20, gap: 9 },
  stateTitle: { color: C.text, fontSize: 13, fontWeight: "800", textAlign: "center" },
  stateText: { color: C.muted, fontSize: 11, lineHeight: 16, textAlign: "center" },
  retryButton: { marginTop: 4, minHeight: 38, paddingHorizontal: 18, borderRadius: 8, backgroundColor: C.red, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  retryText: { color: C.text, fontSize: 10, fontWeight: "900" },
  matchCard: { borderWidth: 1, borderColor: C.border, backgroundColor: C.panel, borderRadius: 14, padding: 14, marginBottom: 10 },
  liveCard: { borderColor: C.red },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  competition: { color: C.text2, fontSize: 10.5, fontWeight: "800", flex: 1 },
  status: { color: C.muted, fontSize: 9, fontWeight: "900" },
  liveText: { color: C.red },
  teamsRow: { minHeight: 62, flexDirection: "row", alignItems: "center", marginTop: 8 },
  teamName: { flex: 1, color: C.text, fontSize: 13, fontWeight: "700", lineHeight: 17 },
  teamNameRight: { textAlign: "right" },
  score: { color: C.text, fontSize: 20, fontWeight: "900", marginHorizontal: 12, fontVariant: ["tabular-nums"] },
  kickoff: { color: C.muted, fontSize: 10, textAlign: "center" },
  canonicalRow: { marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, flexDirection: "row", alignItems: "center" },
  canonicalText: { color: C.muted, fontSize: 9, flex: 1 },
  requestId: { color: C.muted, fontSize: 8.5, lineHeight: 14, marginTop: 8 },
  bottomSpace: { height: 28 },
  matchHeader: { minHeight: 74, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  matchHeaderText: { flex: 1 },
  matchId: { color: C.text2, fontSize: 10, marginTop: 4 },
  heroCard: { borderWidth: 1, borderColor: C.border, backgroundColor: C.panel, borderRadius: 16, padding: 16 },
  competitionCenter: { color: C.text2, fontSize: 12, fontWeight: "900", textAlign: "center" },
  kickoffCenter: { color: C.muted, fontSize: 10, textAlign: "center", marginTop: 4 },
  heroTeams: { minHeight: 110, flexDirection: "row", alignItems: "center", marginTop: 10 },
  heroTeam: { color: C.text, flex: 1, fontSize: 15, fontWeight: "800", lineHeight: 20 },
  heroScoreWrap: { width: 98, alignItems: "center" },
  heroScore: { color: C.text, fontSize: 26, fontWeight: "900" },
  heroStatus: { color: C.red, fontSize: 9, fontWeight: "900", marginTop: 5 },
  contextGrid: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  contextItem: { flex: 1, paddingHorizontal: 5 },
  contextLabel: { color: C.muted, fontSize: 8, fontWeight: "900", textAlign: "center" },
  contextValue: { color: C.text2, fontSize: 10, fontWeight: "700", textAlign: "center", marginTop: 4 },
  previewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 22, marginBottom: 10 },
  previewSub: { color: C.muted, fontSize: 9.5, marginTop: 4 },
  outcomes: { flexDirection: "row", gap: 8, marginBottom: 10 },
  outcome: { flex: 1, minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel2, alignItems: "center", justifyContent: "center", opacity: 0.72 },
  outcomeText: { color: C.muted, fontSize: 10, fontWeight: "900" },
  tipCard: { borderWidth: 1, borderColor: C.border, backgroundColor: C.panel, borderRadius: 12, padding: 13, marginBottom: 9 },
  tipTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tipTitle: { color: C.text, fontSize: 12, fontWeight: "800", flex: 1 },
  tipAccess: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
  tipLocked: { borderColor: C.amber },
  tipFree: { borderColor: C.green },
  tipAccessText: { fontSize: 8, fontWeight: "900" },
  tipSummary: { color: C.text2, fontSize: 10.5, lineHeight: 15, marginTop: 9 },
  tipSelection: { color: C.muted, fontSize: 9.5, marginTop: 8 },
  inlineError: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel, borderRadius: 10, padding: 13 },
  inlineErrorText: { color: C.muted, fontSize: 10.5, lineHeight: 15, flex: 1 },
  emptyPreview: { borderWidth: 1, borderColor: C.border, backgroundColor: C.panel, borderRadius: 12, minHeight: 120, alignItems: "center", justifyContent: "center", gap: 7, padding: 16 },
});
