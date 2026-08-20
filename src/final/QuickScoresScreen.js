import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { isLiveMatch } from "../services/footballApi";
import { fetchFastFootballMatches, peekFastFootballMatches } from "../services/fastFootballApi";

const C = {
  bg: "#080A0C",
  card: "#111416",
  card2: "#15191C",
  border: "#24292D",
  border2: "#1D2226",
  red: "#F3262D",
  redSoft: "rgba(243,38,45,0.14)",
  text: "#FFFFFF",
  text2: "#D0D2D4",
  muted: "#92979B",
};

const DAY_TABS = ["YESTERDAY", "TODAY", "TOMORROW"];
const POPULAR = ["Premier League", "UEFA Champions League", "LaLiga", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "Europa League"];

function bangkokDate(offset = 0) {
  const date = new Date(Date.now() + offset * 86400000);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch (_) {
    return date.toISOString().slice(0, 10);
  }
}

function useMatches(date) {
  const [state, setState] = useState(() => {
    const saved = peekFastFootballMatches(date);
    return { loading: !saved, refreshing: false, error: "", matches: saved?.matches || [] };
  });

  const load = useCallback(async (refresh = false) => {
    const saved = peekFastFootballMatches(date);
    setState((prev) => ({
      ...prev,
      loading: !refresh && !saved,
      refreshing: refresh,
      error: "",
      matches: saved?.matches || (refresh ? prev.matches : []),
    }));
    try {
      const result = await fetchFastFootballMatches({ date, force: refresh });
      setState({ loading: false, refreshing: false, error: "", matches: result.matches || [] });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, refreshing: false, error: error?.message || "Could not load matches." }));
    }
  }, [date]);

  useEffect(() => { load(false); }, [load]);
  return { ...state, reload: () => load(true), refresh: () => load(true) };
}

function TeamLogo({ uri }) {
  return uri ? (
    <Image source={{ uri }} resizeMode="contain" style={s.logo} />
  ) : (
    <View style={s.logoFallback}><Ionicons name="football-outline" size={28} color={C.muted} /></View>
  );
}

function statusText(match) {
  if (isLiveMatch(match)) return match.minute || "LIVE";
  if (["FT", "AET", "PEN"].includes(String(match.statusCode || "").toUpperCase())) return match.statusCode;
  return match.minute || "—";
}

function MatchCard({ match, onOpen }) {
  const live = isLiveMatch(match);
  const hasScore = match.homeScore !== null && match.homeScore !== undefined && match.awayScore !== null && match.awayScore !== undefined;
  return (
    <Pressable style={s.card} onPress={() => onOpen?.(match)}>
      <View style={s.cardTop}>
        <Text numberOfLines={1} style={s.comp}>{match.competition}</Text>
        <View style={s.statusWrap}>
          {live ? <View style={s.liveBadge}><Text style={s.liveText}>LIVE</Text></View> : null}
          <Text style={[s.time, live && { color: C.red }]}>{statusText(match)}</Text>
        </View>
      </View>
      <View style={s.matchRow}>
        <View style={s.teamBox}>
          <TeamLogo uri={match.home?.logo} />
          <Text numberOfLines={2} style={s.teamName}>{match.home?.name || "Home"}</Text>
        </View>
        <View style={s.scoreCenter}>
          <Text style={s.score}>{hasScore ? `${match.homeScore} - ${match.awayScore}` : "VS"}</Text>
        </View>
        <View style={s.teamBox}>
          <TeamLogo uri={match.away?.logo} />
          <Text numberOfLines={2} style={s.teamName}>{match.away?.name || "Away"}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function QuickScoresScreen({ openMatch }) {
  const [tab, setTab] = useState("TODAY");
  const offset = tab === "YESTERDAY" ? -1 : tab === "TOMORROW" ? 1 : 0;
  const date = bangkokDate(offset);
  const api = useMatches(date);

  const matches = useMemo(() => [...api.matches].sort((a, b) => {
    const ai = POPULAR.findIndex((name) => String(a.competition || "").includes(name));
    const bi = POPULAR.findIndex((name) => String(b.competition || "").includes(name));
    const ap = ai === -1 ? 999 : ai;
    const bp = bi === -1 ? 999 : bi;
    if (ap !== bp) return ap - bp;
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    return 0;
  }), [api.matches]);

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Scores</Text>
          <Text style={s.sub}>{date}</Text>
        </View>
        <Ionicons name="calendar-outline" size={27} color={C.text} />
      </View>

      <View style={s.tabs}>
        {DAY_TABS.map((item) => (
          <Pressable
            key={item}
            hitSlop={6}
            style={[s.tab, tab === item && s.tabOn]}
            onPress={() => setTab(item)}
          >
            <Text style={[s.tabText, tab === item && s.tabTextOn]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={api.refreshing} onRefresh={api.refresh} tintColor={C.red} colors={[C.red]} />}
      >
        <View style={s.section}>
          <Text style={s.sectionTitle}>{tab === "TODAY" ? "TODAY'S MATCHES" : tab}</Text>
          <Text style={s.count}>{matches.length} matches</Text>
        </View>

        {api.loading && !matches.length ? <View style={s.state}><ActivityIndicator color={C.red} /><Text style={s.stateText}>Loading {tab.toLowerCase()} matches…</Text></View> : null}
        {!api.loading && api.error && !matches.length ? <View style={s.state}><Ionicons name="cloud-offline-outline" size={25} color={C.muted} /><Text style={s.stateText}>{api.error}</Text><Pressable style={s.retry} onPress={api.reload}><Text style={s.retryText}>RETRY</Text></Pressable></View> : null}
        {!api.loading && !api.error && !matches.length ? <View style={s.state}><Ionicons name="football-outline" size={25} color={C.muted} /><Text style={s.stateText}>No matches found for {date}.</Text></View> : null}
        {matches.map((match) => <MatchCard key={`${date}-${match.id}`} match={match} onOpen={openMatch} />)}
        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { minHeight: 70, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: C.border2 },
  title: { fontSize: 22, fontWeight: "800", color: C.text },
  sub: { fontSize: 10.5, color: C.muted, marginTop: 3 },
  tabs: { flexDirection: "row", padding: 8, gap: 7, borderBottomWidth: 1, borderBottomColor: C.border2 },
  tab: { flex: 1, minHeight: 45, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  tabOn: { backgroundColor: C.redSoft },
  tabText: { fontSize: 10, fontWeight: "800", color: C.muted },
  tabTextOn: { color: C.red },
  content: { paddingHorizontal: 16, paddingTop: 14 },
  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 12.5, fontWeight: "900", color: C.text2 },
  count: { fontSize: 10.5, color: C.muted },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, borderRadius: 13, padding: 13, marginBottom: 9 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  comp: { flex: 1, fontSize: 10.5, fontWeight: "800", color: C.text2 },
  statusWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveBadge: { backgroundColor: C.red, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 6 },
  liveText: { color: C.text, fontSize: 10, fontWeight: "900" },
  time: { fontSize: 10.5, color: C.muted, fontWeight: "700" },
  matchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 13 },
  teamBox: { width: "35%", alignItems: "center", gap: 7 },
  logo: { width: 54, height: 54 },
  logoFallback: { width: 54, height: 54, borderRadius: 27, backgroundColor: C.card2, alignItems: "center", justifyContent: "center" },
  teamName: { color: C.text, fontSize: 12.5, textAlign: "center", lineHeight: 16 },
  scoreCenter: { width: "25%", alignItems: "center" },
  score: { color: C.text, fontSize: 29, fontWeight: "900" },
  state: { minHeight: 130, backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 9, padding: 18 },
  stateText: { fontSize: 11, color: C.muted, textAlign: "center" },
  retry: { backgroundColor: C.red, borderRadius: 7, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontSize: 10, fontWeight: "900", color: C.text },
});