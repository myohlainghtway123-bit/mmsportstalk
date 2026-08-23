import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { extractArray, fetchCompetitionCatalog } from "../services/footballApi";
import { fetchFastFootballMatches, peekFastFootballMatches } from "../services/fastFootballApi";

const C = { bg:"#080A0C", card:"#111416", card2:"#15191C", border:"#24292D", border2:"#1D2226", red:"#F3262D", text:"#FFFFFF", text2:"#D0D2D4", muted:"#92979B" };

const POPULAR_SEARCH_TEAMS = [
  { id: 33, name: "Manchester United", logo: "https://media.api-sports.io/football/teams/33.png", priority: 100 },
  { id: 50, name: "Manchester City", logo: "https://media.api-sports.io/football/teams/50.png", priority: 100 },
  { id: 541, name: "Real Madrid", logo: "https://media.api-sports.io/football/teams/541.png", priority: 100 },
  { id: 529, name: "Barcelona", logo: "https://media.api-sports.io/football/teams/529.png", priority: 100 },
  { id: 40, name: "Liverpool", logo: "https://media.api-sports.io/football/teams/40.png", priority: 100 },
  { id: 42, name: "Arsenal", logo: "https://media.api-sports.io/football/teams/42.png", priority: 100 },
  { id: 49, name: "Chelsea", logo: "https://media.api-sports.io/football/teams/49.png", priority: 95 },
  { id: 157, name: "Bayern Munich", logo: "https://media.api-sports.io/football/teams/157.png", priority: 95 },
  { id: 85, name: "Paris Saint Germain", logo: "https://media.api-sports.io/football/teams/85.png", priority: 95 },
  { id: 496, name: "Juventus", logo: "https://media.api-sports.io/football/teams/496.png", priority: 90 },
  { id: 505, name: "Inter", logo: "https://media.api-sports.io/football/teams/505.png", priority: 90 },
  { id: 489, name: "AC Milan", logo: "https://media.api-sports.io/football/teams/489.png", priority: 90 },
  { id: 47, name: "Tottenham", logo: "https://media.api-sports.io/football/teams/47.png", priority: 90 },
  { id: 165, name: "Borussia Dortmund", logo: "https://media.api-sports.io/football/teams/165.png", priority: 90 },
  { id: 530, name: "Atletico Madrid", logo: "https://media.api-sports.io/football/teams/530.png", priority: 90 },
];

const POPULAR_SEARCH_PLAYERS = [
  { id: 874, name: "Cristiano Ronaldo", team: "Al Nassr", nationality: "Portugal", priority: 100 },
  { id: 154, name: "Lionel Messi", team: "Inter Miami", nationality: "Argentina", priority: 100 },
  { id: 1100, name: "Erling Haaland", team: "Manchester City", nationality: "Norway", priority: 100 },
  { id: 278, name: "Kylian Mbappé", team: "Real Madrid", nationality: "France", priority: 100 },
  { id: 306, name: "Mohamed Salah", team: "Liverpool", nationality: "Egypt", priority: 95 },
  { id: 629, name: "Kevin De Bruyne", team: "Manchester City", nationality: "Belgium", priority: 95 },
  { id: 161928, name: "Jude Bellingham", team: "Real Madrid", nationality: "England", priority: 95 },
  { id: 762, name: "Vinicius Junior", team: "Real Madrid", nationality: "Brazil", priority: 95 },
  { id: 184, name: "Harry Kane", team: "Bayern Munich", nationality: "England", priority: 95 },
  { id: 282, name: "Bukayo Saka", team: "Arsenal", nationality: "England", priority: 90 },
];

function scoreSearchRelevance(name, query, basePriority = 0) {
  const n = String(name || "").toLowerCase();
  const q = String(query || "").toLowerCase();
  if (n === q) return 1000 + basePriority;
  if (n.startsWith(q)) return 500 + basePriority;
  const words = n.split(/\s+/);
  if (words.some((w) => w.startsWith(q))) return 300 + basePriority;
  if (n.includes(q)) return 100 + basePriority;
  return 0;
}

function todayBangkok() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Bangkok", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(new Date());
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  } catch (_) { return new Date().toISOString().slice(0,10); }
}

function logo(value) {
  return value?.logo || value?.image || value?.crest || null;
}

function name(value) {
  return value?.name || value?.title || value?.competition || value?.leagueName || "Football";
}

function ResultRow({ icon, image, title, subtitle, onPress }) {
  return <Pressable style={s.row} onPress={onPress}>
    {image ? <Image source={{ uri:image }} resizeMode="contain" style={s.image}/> : <View style={s.icon}><Ionicons name={icon} size={22} color={C.text2}/></View>}
    <View style={{flex:1}}><Text numberOfLines={1} style={s.rowTitle}>{title}</Text>{subtitle ? <Text numberOfLines={1} style={s.rowSub}>{subtitle}</Text> : null}</View>
    <Ionicons name="chevron-forward" size={18} color={C.muted}/>
  </Pressable>;
}

export default function SearchScreen({ goBack, openMatch, openEntity }) {
  const today = todayBangkok();
  const initial = peekFastFootballMatches(today);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(!initial);
  const [matches, setMatches] = useState(initial?.matches || []);
  const [competitions, setCompetitions] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([fetchFastFootballMatches({ date:today }), fetchCompetitionCatalog()]).then((results) => {
      if (!alive) return;
      if (results[0].status === "fulfilled") setMatches(results[0].value.matches || []);
      if (results[1].status === "fulfilled") setCompetitions(extractArray(results[1].value));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [today]);

  const q = query.trim().toLowerCase();
  const data = useMemo(() => {
    if (!q) return { matches:[], teams:[], players:[], competitions:[] };

    // Matches
    const foundMatches = matches
      .map((m) => {
        const text = `${m.home?.name} ${m.away?.name} ${m.competition}`.toLowerCase();
        const score = scoreSearchRelevance(text, q);
        return { match: m, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.match)
      .slice(0, 10);

    // Teams (combining popular index + today's fixture teams)
    const teamMap = new Map();
    POPULAR_SEARCH_TEAMS.forEach((t) => teamMap.set(String(t.id), t));
    matches.forEach((m) => [m.home, m.away].forEach((team) => {
      if (team?.id && !teamMap.has(String(team.id))) teamMap.set(String(team.id), team);
    }));

    const foundTeams = [...teamMap.values()]
      .map((team) => {
        const basePriority = team.priority || 0;
        const score = scoreSearchRelevance(team.name, q, basePriority);
        return { team, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.team)
      .slice(0, 10);

    // Players (popular stars search)
    const foundPlayers = POPULAR_SEARCH_PLAYERS
      .map((player) => {
        const score = scoreSearchRelevance(player.name, q, player.priority);
        return { player, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.player)
      .slice(0, 8);

    // Competitions
    const foundCompetitions = competitions
      .map((raw) => raw?.league || raw?.competition || raw)
      .filter((item) => item?.id)
      .map((item) => {
        const n = name(item);
        const isMajor = /(premier league|champions league|laliga|serie a|bundesliga|world cup|euro)/i.test(n);
        const score = scoreSearchRelevance(n, q, isMajor ? 50 : 0);
        return { item, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item)
      .slice(0, 10);

    return { matches: foundMatches, teams: foundTeams, players: foundPlayers, competitions: foundCompetitions };
  }, [q, matches, competitions]);

  const total = data.matches.length + data.teams.length + data.players.length + data.competitions.length;

  return <View style={s.screen}>
    <View style={s.header}>
      <Pressable hitSlop={10} onPress={goBack}><Ionicons name="chevron-back" size={28} color={C.text}/></Pressable>
      <View style={s.searchBox}><Ionicons name="search-outline" size={20} color={C.muted}/><TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search teams, matches, competitions" placeholderTextColor={C.muted} style={s.input}/>{query ? <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={19} color={C.muted}/></Pressable> : null}</View>
    </View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {loading && !matches.length ? <View style={s.state}><ActivityIndicator color={C.red}/><Text style={s.stateText}>Loading football search…</Text></View> : null}
      {!loading && !q ? <View style={s.state}><Ionicons name="search-outline" size={30} color={C.muted}/><Text style={s.stateTitle}>Search MST football</Text><Text style={s.stateText}>Find today's matches, teams and competitions.</Text></View> : null}
      {!loading && q && !total ? <View style={s.state}><Ionicons name="search-outline" size={30} color={C.muted}/><Text style={s.stateTitle}>No results</Text><Text style={s.stateText}>Try another team or competition name.</Text></View> : null}
      {data.matches.length ? <><Text style={s.section}>MATCHES</Text><View style={s.card}>{data.matches.map((m,index) => <View key={m.id} style={index !== data.matches.length-1 ? s.border : null}><ResultRow icon="football-outline" title={`${m.home?.name} vs ${m.away?.name}`} subtitle={m.competition} onPress={() => openMatch?.(m)}/></View>)}</View></> : null}
      {data.teams.length ? <><Text style={s.section}>TEAMS</Text><View style={s.card}>{data.teams.map((team,index) => <View key={team.id} style={index !== data.teams.length-1 ? s.border : null}><ResultRow icon="shield-outline" image={team.logo} title={team.name} subtitle="Team" onPress={() => openEntity?.("team",team)}/></View>)}</View></> : null}
      {data.players.length ? <><Text style={s.section}>PLAYERS</Text><View style={s.card}>{data.players.map((player,index) => <View key={player.id} style={index !== data.players.length-1 ? s.border : null}><ResultRow icon="person-outline" title={player.name} subtitle={[player.team, player.nationality].filter(Boolean).join(" · ") || "Player"} onPress={() => openEntity?.("player",player)}/></View>)}</View></> : null}
      {data.competitions.length ? <><Text style={s.section}>COMPETITIONS</Text><View style={s.card}>{data.competitions.map((item,index) => <View key={item.id} style={index !== data.competitions.length-1 ? s.border : null}><ResultRow icon="trophy-outline" image={logo(item)} title={name(item)} subtitle={item.country || "Competition"} onPress={() => openEntity?.("competition",{ id:item.id, name:name(item), logo:logo(item) })}/></View>)}</View></> : null}
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},header:{minHeight:66,paddingHorizontal:14,flexDirection:"row",alignItems:"center",gap:10,borderBottomWidth:1,borderBottomColor:C.border2},searchBox:{flex:1,minHeight:42,borderWidth:1,borderColor:C.border,borderRadius:10,backgroundColor:C.card,flexDirection:"row",alignItems:"center",paddingHorizontal:11,gap:8},input:{flex:1,color:C.text,fontSize:12.5,paddingVertical:8},content:{padding:16,paddingBottom:40},section:{color:C.text2,fontSize:11,fontWeight:"900",marginTop:14,marginBottom:8},card:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,overflow:"hidden"},border:{borderBottomWidth:1,borderBottomColor:C.border2},row:{minHeight:61,paddingHorizontal:12,paddingVertical:8,flexDirection:"row",alignItems:"center",gap:10},icon:{width:38,height:38,borderRadius:9,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},image:{width:38,height:38},rowTitle:{color:C.text2,fontSize:12.5,fontWeight:"800"},rowSub:{color:C.muted,fontSize:9.5,marginTop:3},state:{minHeight:150,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,alignItems:"center",justifyContent:"center",gap:8,padding:20},stateTitle:{color:C.text,fontSize:14,fontWeight:"800"},stateText:{color:C.muted,fontSize:10.5,textAlign:"center"},
});