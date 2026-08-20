import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  extractArray,
  fetchCompetitionBundle,
  fetchMatchBundle,
  fetchPlayerBundle,
  fetchTeamBundle,
  flattenDisplayRows,
  isLiveMatch,
} from "../services/footballApi";
import { fetchArticle, formatContentDate } from "../services/contentApi";

const C = {
  bg: "#080A0C", card: "#111416", card2: "#15191C", border: "#24292D", border2: "#1D2226",
  red: "#F3262D", redSoft: "rgba(243,38,45,0.14)", text: "#FFFFFF", text2: "#D0D2D4", muted: "#92979B",
};

function Header({ title, goBack }) {
  return <View style={s.header}>
    <Pressable hitSlop={10} onPress={goBack}><Ionicons name="chevron-back" size={28} color={C.text} /></Pressable>
    <Text numberOfLines={1} style={s.headerTitle}>{title}</Text>
    <View style={{ width: 28 }} />
  </View>;
}

function TeamLogo({ uri, size = 62 }) {
  return uri ? <Image source={{ uri }} resizeMode="contain" style={{ width: size, height: size }} /> : <View style={[s.logoFallback, { width: size, height: size, borderRadius: size / 2 }]}><Ionicons name="football-outline" size={size * .48} color={C.muted} /></View>;
}

function State({ loading, error, retry }) {
  if (loading) return <View style={s.state}><ActivityIndicator color={C.red} /><Text style={s.stateText}>Loading MST data…</Text></View>;
  if (error) return <View style={s.state}><Ionicons name="cloud-offline-outline" size={28} color={C.muted} /><Text style={s.stateTitle}>Data unavailable</Text><Text style={s.stateText}>{error}</Text>{retry ? <Pressable style={s.redButton} onPress={retry}><Text style={s.redButtonText}>RETRY</Text></Pressable> : null}</View>;
  return null;
}

function GenericData({ value, empty = "No data available" }) {
  const rows = flattenDisplayRows(value).filter((row) => row?.value !== "[object Object]").slice(0, 70);
  if (!rows.length) return <View style={s.state}><Ionicons name="information-circle-outline" size={26} color={C.muted} /><Text style={s.stateText}>{empty}</Text></View>;
  return <View style={s.dataCard}>{rows.map((row, index) => <View key={`${row.label}-${index}`} style={[s.dataRow, index !== rows.length - 1 && s.rowBorder]}><Text numberOfLines={2} style={s.dataLabel}>{row.label}</Text><Text numberOfLines={4} style={s.dataValue}>{row.value}</Text></View>)}</View>;
}

function MatchEvents({ value }) {
  const rows = extractArray(value);
  if (!rows.length) return <GenericData value={value} empty="No match events available" />;
  return <View style={s.dataCard}>{rows.slice(0, 60).map((event, index) => {
    const minute = event?.time?.elapsed ?? event?.minute ?? event?.elapsed ?? "";
    const team = event?.team?.name ?? event?.teamName ?? "";
    const player = event?.player?.name ?? event?.playerName ?? event?.detail ?? event?.type ?? "Event";
    const detail = event?.detail ?? event?.type ?? "";
    return <View key={`${minute}-${player}-${index}`} style={[s.eventRow, index !== rows.length - 1 && s.rowBorder]}><Text style={s.eventMinute}>{minute !== "" ? `${minute}'` : "•"}</Text><View style={{ flex: 1 }}><Text style={s.eventTitle}>{player}</Text><Text style={s.eventSub}>{[team, detail].filter(Boolean).join(" · ")}</Text></View></View>;
  })}</View>;
}

export function NativeMatchScreen({ match, goBack }) {
  const [tab, setTab] = useState("OVERVIEW");
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const load = useCallback(async () => {
    if (!match?.id) return setState({ loading: false, error: "Match ID unavailable.", data: null });
    setState((p) => ({ ...p, loading: true, error: "" }));
    try { setState({ loading: false, error: "", data: await fetchMatchBundle(match.id) }); }
    catch (error) { setState({ loading: false, error: error?.message || "Could not load match.", data: null }); }
  }, [match?.id]);
  useEffect(() => { load(); }, [load]);

  const current = state.data?.detail?.match || match || {};
  const live = isLiveMatch(current);
  const hasScore = current.homeScore !== null && current.homeScore !== undefined && current.awayScore !== null && current.awayScore !== undefined;
  const tabs = ["OVERVIEW", "EVENTS", "STATS", "LINEUPS", "H2H"];

  return <View style={s.screen}>
    <Header title={current.competition || "Match"} goBack={goBack} />
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.matchHero}>
        <Text style={s.round}>{current.round || current.statusLong || "Football"}</Text>
        <View style={s.matchTeams}>
          <View style={s.team}><TeamLogo uri={current.home?.logo} /><Text numberOfLines={2} style={s.teamName}>{current.home?.name}</Text></View>
          <View style={s.scoreWrap}><Text style={s.bigScore}>{hasScore ? `${current.homeScore} - ${current.awayScore}` : "VS"}</Text><Text style={[s.matchStatus, live && { color: C.red }]}>{live ? current.minute : current.statusCode || current.minute}</Text></View>
          <View style={s.team}><TeamLogo uri={current.away?.logo} /><Text numberOfLines={2} style={s.teamName}>{current.away?.name}</Text></View>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.detailTabs}>{tabs.map((item) => <Pressable key={item} style={[s.detailTab, tab === item && s.detailTabOn]} onPress={() => setTab(item)}><Text style={[s.detailTabText, tab === item && s.detailTabTextOn]}>{item}</Text></Pressable>)}</ScrollView>
      <State loading={state.loading && !state.data} error={state.error && !state.data ? state.error : ""} retry={load} />
      {state.data ? <>
        {tab === "OVERVIEW" ? <GenericData value={{ venue: current.venue, referee: current.referee, kickoff: current.kickoff, status: current.statusLong, round: current.round }} /> : null}
        {tab === "EVENTS" ? <MatchEvents value={state.data.events} /> : null}
        {tab === "STATS" ? <GenericData value={state.data.statistics} empty="No match statistics available" /> : null}
        {tab === "LINEUPS" ? <GenericData value={state.data.lineups} empty="No lineups available" /> : null}
        {tab === "H2H" ? <GenericData value={state.data.h2h} empty="No head-to-head data available" /> : null}
      </> : null}
    </ScrollView>
  </View>;
}

function entityTitle(type, entity) {
  return entity?.name || entity?.title || (type === "competition" ? "Competition" : type === "team" ? "Team" : "Player");
}

export function NativeEntityScreen({ type, entity, goBack }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [tab, setTab] = useState("OVERVIEW");
  const title = entityTitle(type, entity);
  const tabs = type === "competition" ? ["OVERVIEW", "TABLE", "MATCHES", "TEAMS", "SCORERS"] : type === "team" ? ["OVERVIEW", "MATCHES", "SQUAD", "STATS", "TRANSFERS"] : ["OVERVIEW", "TRANSFERS", "TROPHIES", "SIDELINED"];

  const load = useCallback(async () => {
    if (!entity?.id) return setState({ loading: false, error: "Data ID unavailable.", data: null });
    setState({ loading: true, error: "", data: null });
    try {
      const data = type === "competition" ? await fetchCompetitionBundle(entity) : type === "team" ? await fetchTeamBundle(entity) : await fetchPlayerBundle(entity);
      setState({ loading: false, error: "", data });
    } catch (error) { setState({ loading: false, error: error?.message || "Could not load details.", data: null }); }
  }, [type, entity?.id]);
  useEffect(() => { load(); }, [load]);

  const source = state.data || {};
  const value = useMemo(() => {
    if (tab === "OVERVIEW") return source.profile || entity;
    const key = tab.toLowerCase();
    if (tab === "TABLE") return source.standings;
    return source[key];
  }, [tab, source, entity]);

  return <View style={s.screen}>
    <Header title={title} goBack={goBack} />
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.entityHero}>
        <TeamLogo uri={entity?.logo || entity?.photo || entity?.image} size={72} />
        <Text style={s.entityTitle}>{title}</Text>
        <Text style={s.entityType}>{type.toUpperCase()}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.detailTabs}>{tabs.map((item) => <Pressable key={item} style={[s.detailTab, tab === item && s.detailTabOn]} onPress={() => setTab(item)}><Text style={[s.detailTabText, tab === item && s.detailTabTextOn]}>{item}</Text></Pressable>)}</ScrollView>
      <State loading={state.loading} error={state.error} retry={load} />
      {!state.loading && !state.error ? <GenericData value={value} /> : null}
    </ScrollView>
  </View>;
}

export function NativeArticleScreen({ article, goBack }) {
  const [state, setState] = useState({ loading: false, error: "", article });
  useEffect(() => {
    let alive = true;
    if (!article?.slug) return;
    setState((p) => ({ ...p, loading: true, error: "" }));
    fetchArticle(article.slug).then((result) => { if (alive) setState({ loading: false, error: "", article: result.article || article }); }).catch((error) => { if (alive) setState({ loading: false, error: error?.message || "Could not load article.", article }); });
    return () => { alive = false; };
  }, [article?.slug]);
  const current = state.article || article || {};

  return <View style={s.screen}>
    <Header title="News" goBack={goBack} />
    <ScrollView contentContainerStyle={s.articleContent}>
      {current.image ? <Image source={{ uri: current.image }} style={s.articleImage} resizeMode="cover" /> : <View style={[s.articleImage, s.articleFallback]}><Text style={s.articleFallbackLogo}>MST</Text></View>}
      <Text style={s.category}>{String(current.category || "NEWS").toUpperCase()}</Text>
      <Text style={s.articleTitle}>{current.title}</Text>
      <Text style={s.meta}>{[current.author, formatContentDate(current.publishedAt)].filter(Boolean).join(" · ")}</Text>
      {state.loading ? <ActivityIndicator color={C.red} style={{ marginTop: 18 }} /> : null}
      {state.error ? <Text style={s.articleError}>{state.error}</Text> : null}
      <Text style={s.articleBody}>{current.content || current.excerpt || ""}</Text>
      {current.url ? <Pressable style={s.outlineButton} onPress={() => Linking.openURL(current.url)}><Ionicons name="open-outline" size={18} color={C.red} /><Text style={s.outlineText}>OPEN ORIGINAL ON MST WEBSITE</Text></Pressable> : null}
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { minHeight: 66, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: C.border2 },
  headerTitle: { flex: 1, color: C.text, fontSize: 15, fontWeight: "800", textAlign: "center", paddingHorizontal: 12 },
  content: { padding: 16, paddingBottom: 42 },
  matchHero: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, borderRadius: 14, padding: 15 },
  round: { color: C.muted, fontSize: 10.5, textAlign: "center" },
  matchTeams: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  team: { width: "34%", alignItems: "center", gap: 8 },
  teamName: { color: C.text, fontSize: 12.5, textAlign: "center", lineHeight: 16 },
  scoreWrap: { width: "28%", alignItems: "center" },
  bigScore: { color: C.text, fontSize: 29, fontWeight: "900" },
  matchStatus: { color: C.muted, fontSize: 10.5, fontWeight: "800", marginTop: 5 },
  logoFallback: { backgroundColor: C.card2, alignItems: "center", justifyContent: "center" },
  detailTabs: { gap: 7, paddingVertical: 13 },
  detailTab: { minWidth: 92, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 8, backgroundColor: C.card, alignItems: "center" },
  detailTabOn: { backgroundColor: C.redSoft, borderWidth: 1, borderColor: "rgba(243,38,45,.3)" },
  detailTabText: { color: C.muted, fontSize: 10, fontWeight: "800" },
  detailTabTextOn: { color: C.red },
  state: { minHeight: 120, backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, borderRadius: 12, padding: 18, alignItems: "center", justifyContent: "center", gap: 8 },
  stateTitle: { color: C.text, fontSize: 14, fontWeight: "800" },
  stateText: { color: C.muted, fontSize: 10.5, textAlign: "center", lineHeight: 15 },
  redButton: { backgroundColor: C.red, borderRadius: 7, paddingHorizontal: 18, paddingVertical: 9, marginTop: 4 },
  redButtonText: { color: C.text, fontSize: 10, fontWeight: "900" },
  dataCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, borderRadius: 11, overflow: "hidden" },
  dataRow: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", gap: 14, justifyContent: "space-between" },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border2 },
  dataLabel: { width: "43%", color: C.muted, fontSize: 10.5, textTransform: "capitalize" },
  dataValue: { width: "52%", color: C.text2, fontSize: 10.8, textAlign: "right" },
  eventRow: { minHeight: 56, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  eventMinute: { width: 40, color: C.red, fontSize: 11, fontWeight: "900" },
  eventTitle: { color: C.text2, fontSize: 12, fontWeight: "800" },
  eventSub: { color: C.muted, fontSize: 9.5, marginTop: 3 },
  entityHero: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, borderRadius: 14, padding: 20, alignItems: "center" },
  entityTitle: { color: C.text, fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 10 },
  entityType: { color: C.red, fontSize: 9.5, fontWeight: "900", marginTop: 5 },
  articleContent: { padding: 16, paddingBottom: 46 },
  articleImage: { width: "100%", height: 210, borderRadius: 13, backgroundColor: C.card2 },
  articleFallback: { alignItems: "center", justifyContent: "center" },
  articleFallbackLogo: { color: C.red, fontSize: 46, fontWeight: "900", fontStyle: "italic" },
  category: { color: C.red, fontSize: 10, fontWeight: "900", marginTop: 16 },
  articleTitle: { color: C.text, fontSize: 23, lineHeight: 31, fontWeight: "900", marginTop: 7 },
  meta: { color: C.muted, fontSize: 10, marginTop: 9 },
  articleBody: { color: C.text2, fontSize: 14, lineHeight: 24, marginTop: 18 },
  articleError: { color: C.red, fontSize: 10.5, marginTop: 12 },
  outlineButton: { minHeight: 46, borderWidth: 1, borderColor: C.border, borderRadius: 8, marginTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  outlineText: { color: C.red, fontSize: 10, fontWeight: "900" },
});
