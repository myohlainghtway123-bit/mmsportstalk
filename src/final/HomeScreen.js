import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { isLiveMatch } from "../services/footballApi";
import { fetchFastFootballMatches, peekFastFootballMatches } from "../services/fastFootballApi";

const C = {
  bg: "#080A0C", card: "#111416", card2: "#15191C", border: "#24292D", border2: "#1D2226",
  red: "#F3262D", text: "#FFFFFF", text2: "#D0D2D4", muted: "#92979B"
};

const TABS = ["LIVE SCORES", "NEWS", "VIDEOS", "TRANSFERS"];
const COMPETITIONS = [
  { id: 39, name: "Premier League", icon: "crown-outline" },
  { id: 2, name: "Champions League", icon: "soccer" },
  { id: 140, name: "LaLiga", icon: "soccer-field" },
  { id: 135, name: "Serie A", icon: "shield-outline" },
  { id: 78, name: "Bundesliga", icon: "run-fast" },
];

function bangkokToday() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

function Logo({ uri }) {
  return uri ? <Image source={{ uri }} resizeMode="contain" style={s.teamLogo} /> : <View style={s.logoFallback}><Ionicons name="football-outline" size={26} color={C.muted}/></View>;
}

function MatchCard({ match, openMatch }) {
  const live = isLiveMatch(match);
  const hasScore = match.homeScore !== null && match.homeScore !== undefined && match.awayScore !== null && match.awayScore !== undefined;
  return <Pressable style={s.matchCard} onPress={() => openMatch?.(match)}>
    <View style={s.matchTop}>
      <Text numberOfLines={1} style={s.comp}>{match.competition}</Text>
      <View style={s.statusRow}>{live ? <View style={s.liveBadge}><Text style={s.liveText}>LIVE</Text></View> : null}<Text style={[s.minute, live && { color:C.red }]}>{match.minute || match.statusCode || "—"}</Text></View>
    </View>
    <View style={s.teamsRow}>
      <View style={s.team}><Logo uri={match.home?.logo}/><Text numberOfLines={2} style={s.teamName}>{match.home?.name}</Text></View>
      <Text style={s.score}>{hasScore ? `${match.homeScore} - ${match.awayScore}` : "VS"}</Text>
      <View style={s.team}><Logo uri={match.away?.logo}/><Text numberOfLines={2} style={s.teamName}>{match.away?.name}</Text></View>
    </View>
  </Pressable>;
}

export default function HomeScreen({ onTab, openMatch, openEntity, openScores, openNotifications, openSearch }) {
  const date = bangkokToday();
  const [state, setState] = useState(() => {
    const saved = peekFastFootballMatches(date);
    return { loading:!saved, refreshing:false, error:"", matches:saved?.matches || [] };
  });

  const load = useCallback(async (refresh=false) => {
    const saved = peekFastFootballMatches(date);
    setState((p) => ({
      ...p,
      loading: !refresh && !saved && !p.matches.length,
      refreshing: refresh,
      error: "",
      matches: saved?.matches || p.matches,
    }));
    try {
      const result = await fetchFastFootballMatches({ date, force:refresh });
      setState({ loading:false, refreshing:false, error:"", matches:result.matches || [] });
    } catch (e) {
      setState((p) => ({ ...p, loading:false, refreshing:false, error:e?.message || "Could not load live scores." }));
    }
  }, [date]);

  useEffect(() => { load(false); }, [load]);
  useEffect(() => { const timer = setInterval(() => load(true), 60000); return () => clearInterval(timer); }, [load]);

  const live = useMemo(() => state.matches.filter(isLiveMatch).slice(0,5), [state.matches]);

  return <View style={s.screen}>
    <View style={s.header}>
      <View><Text style={s.brand}>MST</Text><Text style={s.brandSub}>MYANMAR SPORTS TALK</Text></View>
      <View style={s.actions}>
        <Pressable hitSlop={8} style={s.actionBtn} onPress={openNotifications}><Ionicons name="notifications-outline" size={28} color={C.text}/><View style={s.dot}/></Pressable>
        <Pressable hitSlop={8} style={s.actionBtn} onPress={openSearch}><Ionicons name="search-outline" size={30} color={C.text}/></Pressable>
      </View>
    </View>

    <View style={s.tabs}>{TABS.map((tab) => <Pressable key={tab} style={s.tab} onPress={() => tab !== "LIVE SCORES" && onTab?.(tab)}><Text style={[s.tabText, tab === "LIVE SCORES" && s.tabTextOn]}>{tab}</Text>{tab === "LIVE SCORES" ? <View style={s.tabLine}/> : null}</Pressable>)}</View>

    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => load(true)} colors={[C.red]} tintColor={C.red}/> }>
      <View style={s.sectionRow}><View style={s.liveTitle}><View style={s.redDot}/><Text style={s.sectionTitle}>LIVE NOW</Text></View><Text style={s.count}>{live.length} {live.length === 1 ? "Match" : "Matches"}</Text></View>
      {state.loading && !state.matches.length ? <View style={s.state}><ActivityIndicator color={C.red}/><Text style={s.stateText}>Loading live scores…</Text></View> : null}
      {!state.loading && state.error && !state.matches.length ? <View style={s.state}><Ionicons name="cloud-offline-outline" size={26} color={C.muted}/><Text style={s.stateText}>{state.error}</Text><Pressable style={s.retry} onPress={() => load(true)}><Text style={s.retryText}>RETRY</Text></Pressable></View> : null}
      {!state.loading && !state.error && !live.length ? <View style={s.state}><Ionicons name="football-outline" size={28} color={C.muted}/><Text style={s.stateText}>No live matches right now.</Text></View> : null}
      {live.map((m) => <MatchCard key={m.id} match={m} openMatch={openMatch}/>) }

      <Pressable style={s.allScores} onPress={openScores}><Text style={s.allScoresText}>ALL SCORES</Text><Ionicons name="chevron-forward" size={20} color={C.text}/></Pressable>

      <Text style={s.sectionLabel}>TOP COMPETITIONS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.compStrip}>
        {COMPETITIONS.map((c) => <Pressable key={c.id} style={s.compItem} onPress={() => openEntity?.("competition", c)}><MaterialCommunityIcons name={c.icon} size={24} color={C.text}/><Text numberOfLines={2} style={s.compName}>{c.name}</Text></Pressable>)}
      </ScrollView>
      <View style={{height:24}}/>
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},
  header:{minHeight:88,paddingHorizontal:18,paddingTop:10,paddingBottom:8,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  brand:{fontSize:34,lineHeight:36,fontWeight:"900",fontStyle:"italic",letterSpacing:-2,color:C.red},
  brandSub:{fontSize:9.5,lineHeight:12,fontWeight:"900",letterSpacing:.7,color:C.text},
  actions:{flexDirection:"row",alignItems:"center",gap:8},actionBtn:{width:44,height:44,alignItems:"center",justifyContent:"center",position:"relative"},dot:{position:"absolute",right:7,top:7,width:7,height:7,borderRadius:4,backgroundColor:C.red},
  tabs:{height:50,flexDirection:"row",borderBottomWidth:1,borderBottomColor:C.border2,paddingHorizontal:10},tab:{flex:1,alignItems:"center",justifyContent:"center",position:"relative"},tabText:{fontSize:10.5,fontWeight:"800",color:C.text2},tabTextOn:{color:C.red},tabLine:{position:"absolute",bottom:0,left:7,right:7,height:3,borderRadius:2,backgroundColor:C.red},
  content:{paddingHorizontal:16,paddingTop:14},sectionRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:10},liveTitle:{flexDirection:"row",alignItems:"center",gap:9},redDot:{width:9,height:9,borderRadius:5,backgroundColor:C.red},sectionTitle:{fontSize:15,fontWeight:"900",color:C.text2},count:{fontSize:11,color:C.muted},
  matchCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:13,padding:13,marginBottom:9},matchTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8},comp:{flex:1,fontSize:10.5,fontWeight:"800",color:C.text2},statusRow:{flexDirection:"row",alignItems:"center",gap:8},liveBadge:{backgroundColor:C.red,borderRadius:6,paddingHorizontal:9,paddingVertical:6},liveText:{fontSize:10,fontWeight:"900",color:C.text},minute:{fontSize:10.5,fontWeight:"700",color:C.muted},teamsRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:13},team:{width:"35%",alignItems:"center",gap:7},teamLogo:{width:54,height:54},logoFallback:{width:54,height:54,borderRadius:27,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},teamName:{fontSize:12.5,lineHeight:16,textAlign:"center",color:C.text},score:{width:"25%",textAlign:"center",fontSize:29,fontWeight:"900",color:C.text},
  state:{minHeight:130,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,alignItems:"center",justifyContent:"center",gap:9,padding:18,marginBottom:10},stateText:{fontSize:11,color:C.muted,textAlign:"center"},retry:{backgroundColor:C.red,borderRadius:7,paddingHorizontal:16,paddingVertical:8},retryText:{fontSize:10,fontWeight:"900",color:C.text},
  allScores:{minHeight:46,backgroundColor:C.card2,borderWidth:1,borderColor:C.border2,borderRadius:10,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5,marginTop:2},allScoresText:{fontSize:11,fontWeight:"900",color:C.text},sectionLabel:{fontSize:12,fontWeight:"900",color:C.text2,marginTop:18,marginBottom:9},compStrip:{gap:8,paddingRight:8},compItem:{width:105,minHeight:78,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,padding:10,alignItems:"center",justifyContent:"center",gap:7},compName:{fontSize:9.5,lineHeight:12,textAlign:"center",fontWeight:"700",color:C.text2}
});