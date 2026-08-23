import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { extractArray, fetchCompetitionCatalog } from "../services/footballApi";
import { fetchFastFootballMatches, peekFastFootballMatches } from "../services/fastFootballApi";
import { fetchFifaMenRanking, peekFifaMenRanking } from "../services/fifaRankingApi";
import { searchFootballEntities as fetchSmartSearch } from "../services/smartSearchApi";

const C = { bg:"#080A0C", card:"#111416", card2:"#15191C", border:"#24292D", border2:"#1D2226", red:"#F3262D", text:"#FFFFFF", text2:"#D0D2D4", muted:"#92979B" };
const EMPTY_REMOTE = { teams:[], players:[], stale:false };

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

const REGIONAL_TEAM_PRIORITY = new Map([
  ["myanmar",180],["thailand",110],["vietnam",110],["viet nam",110],["indonesia",110],["malaysia",110],
  ["singapore",110],["philippines",110],["cambodia",110],["laos",110],["lao pdr",110],["brunei",110],
  ["brunei darussalam",110],["timor-leste",110],["timor leste",110],
]);

function normalized(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g," ");
}

function regionalTeamPriority(team) {
  if (!team?.national) return 0;
  return REGIONAL_TEAM_PRIORITY.get(normalized(team.name)) || 0;
}

function scoreSearchRelevance(name, query, basePriority = 0) {
  const n = normalized(name);
  const q = normalized(query);
  if (!q) return 0;
  if (n === q) return 10000 + basePriority;
  if (n.startsWith(q)) return 5000 + basePriority;
  const words = n.split(/\s+/);
  if (words.some((w) => w.startsWith(q))) return 3000 + basePriority;
  if (n.includes(q)) return 1000 + basePriority;
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

function rankingSubtitle(entry) {
  const parts = [`FIFA #${entry.rank}`];
  if (entry.confederation) parts.push(entry.confederation);
  if (Number.isFinite(Number(entry.points))) parts.push(`${Number(entry.points).toFixed(2)} pts`);
  return parts.join(" · ");
}

function rankingDateLabel(value) {
  if (!value) return "Official FIFA";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Official FIFA";
  return `Official FIFA · ${date.toLocaleDateString([], { day:"numeric", month:"short", year:"numeric" })}`;
}

function ResultRow({ icon, image, title, subtitle, onPress, accent = false }) {
  return <Pressable disabled={!onPress} style={[s.row,accent&&s.rowAccent]} onPress={onPress}>
    {image ? <Image source={{ uri:image }} resizeMode="contain" style={s.image}/> : <View style={s.icon}><Ionicons name={icon} size={22} color={accent?C.red:C.text2}/></View>}
    <View style={{flex:1}}><Text numberOfLines={1} style={[s.rowTitle,accent&&s.rowTitleAccent]}>{title}</Text>{subtitle ? <Text numberOfLines={1} style={s.rowSub}>{subtitle}</Text> : null}</View>
    {onPress ? <Ionicons name="chevron-forward" size={18} color={C.muted}/> : null}
  </Pressable>;
}

export default function SearchScreen({ goBack, openMatch, openEntity }) {
  const today = todayBangkok();
  const initial = peekFastFootballMatches(today);
  const initialRanking = peekFifaMenRanking();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(!initial);
  const [matches, setMatches] = useState(initial?.matches || []);
  const [competitions, setCompetitions] = useState([]);
  const [ranking, setRanking] = useState(initialRanking);
  const [rankingLoading, setRankingLoading] = useState(!initialRanking);
  const [rankingError, setRankingError] = useState("");
  const [remoteSearch, setRemoteSearch] = useState(EMPTY_REMOTE);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.allSettled([fetchFastFootballMatches({ date:today }), fetchCompetitionCatalog()]).then((results) => {
      if (!alive) return;
      if (results[0].status === "fulfilled") setMatches(results[0].value.matches || []);
      if (results[1].status === "fulfilled") setCompetitions(extractArray(results[1].value));
      setLoading(false);
    });
    fetchFifaMenRanking().then((value) => {
      if (!alive) return;
      setRanking(value);
      setRankingError("");
    }).catch(() => {
      if (!alive) return;
      setRankingError("Official FIFA ranking is temporarily unavailable.");
    }).finally(() => { if (alive) setRankingLoading(false); });
    return () => { alive = false; };
  }, [today]);

  useEffect(() => {
    const search = query.trim();
    if (search.length < 4) {
      setRemoteSearch(EMPTY_REMOTE);
      setRemoteLoading(false);
      setRemoteError("");
      return undefined;
    }

    let alive = true;
    let controller = null;
    const timer = setTimeout(() => {
      controller = new AbortController();
      setRemoteLoading(true);
      setRemoteError("");
      fetchSmartSearch(search, { signal:controller.signal }).then((value) => {
        if (!alive) return;
        setRemoteSearch(value || EMPTY_REMOTE);
      }).catch((error) => {
        if (!alive || error?.name === "AbortError") return;
        setRemoteSearch(EMPTY_REMOTE);
        setRemoteError("Full football search is temporarily unavailable.");
      }).finally(() => { if (alive) setRemoteLoading(false); });
    }, 450);

    return () => {
      alive = false;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [query]);

  const q = query.trim().toLowerCase();
  const data = useMemo(() => {
    if (!q) return { matches:[], teams:[], players:[], competitions:[], rankings:[] };

    const foundMatches = matches
      .map((m) => {
        const text = `${m.home?.name} ${m.away?.name} ${m.competition}`;
        const score = scoreSearchRelevance(text, q);
        return { match:m, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.match)
      .slice(0, 10);

    const teamMap = new Map();
    POPULAR_SEARCH_TEAMS.forEach((team) => teamMap.set(String(team.id), team));
    matches.forEach((m) => [m.home, m.away].forEach((team) => {
      if (team?.id && !teamMap.has(String(team.id))) teamMap.set(String(team.id), team);
    }));
    (remoteSearch.teams || []).forEach((team) => {
      if (!team?.id) return;
      const key = String(team.id), previous = teamMap.get(key) || {};
      teamMap.set(key, { ...previous, ...team, priority:previous.priority || 0 });
    });

    const foundTeams = [...teamMap.values()]
      .map((team) => {
        const basePriority = Math.max(team.priority || 0, regionalTeamPriority(team));
        return { team, score:scoreSearchRelevance(team.name, q, basePriority) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || String(a.team.name).localeCompare(String(b.team.name)))
      .map((x) => x.team)
      .slice(0, 12);

    const playerMap = new Map();
    POPULAR_SEARCH_PLAYERS.forEach((player) => playerMap.set(String(player.id), player));
    (remoteSearch.players || []).forEach((player) => {
      if (!player?.id) return;
      const key = String(player.id), previous = playerMap.get(key) || {};
      playerMap.set(key, { ...previous, ...player, priority:previous.priority || 0 });
    });
    const foundPlayers = [...playerMap.values()]
      .map((player) => ({ player, score:scoreSearchRelevance(player.name, q, player.priority || 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || String(a.player.name).localeCompare(String(b.player.name)))
      .map((x) => x.player)
      .slice(0, 12);

    const foundCompetitions = competitions
      .map((raw) => raw?.league || raw?.competition || raw)
      .filter((item) => item?.id)
      .map((item) => {
        const n = name(item);
        const isMajor = /(premier league|champions league|laliga|la liga|serie a|bundesliga|ligue 1|europa league|conference league|world cup|euro)/i.test(n);
        return { item, score:scoreSearchRelevance(n, q, isMajor ? 70 : 0) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item)
      .slice(0, 10);

    const foundRankings = (ranking?.entries || [])
      .map((entry) => {
        const text = `${entry.name} ${entry.fifaCode || ""}`;
        const basePriority = entry.aseanKey === "myanmar" ? 180 : entry.regionalPriority ? 110 : 0;
        return { entry, score:scoreSearchRelevance(text, q, basePriority) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.rank - b.entry.rank)
      .map((x) => x.entry)
      .slice(0, 10);

    return { matches:foundMatches, teams:foundTeams, players:foundPlayers, competitions:foundCompetitions, rankings:foundRankings };
  }, [q, matches, competitions, ranking, remoteSearch]);

  const total = data.matches.length + data.teams.length + data.players.length + data.competitions.length + data.rankings.length;
  const asean = ranking?.asean || [];
  const myanmar = ranking?.myanmar || null;
  const otherAsean = asean.filter((entry) => entry.aseanKey !== "myanmar");
  const searchingGlobal = q.length >= 4 && remoteLoading;

  return <View style={s.screen}>
    <View style={s.header}>
      <Pressable hitSlop={10} onPress={goBack}><Ionicons name="chevron-back" size={28} color={C.text}/></Pressable>
      <View style={s.searchBox}><Ionicons name="search-outline" size={20} color={C.muted}/><TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search teams, players, countries…" placeholderTextColor={C.muted} style={s.input}/>{searchingGlobal ? <ActivityIndicator size="small" color={C.red}/> : query ? <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={19} color={C.muted}/></Pressable> : null}</View>
    </View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {loading && !matches.length && q ? <View style={s.state}><ActivityIndicator color={C.red}/><Text style={s.stateText}>Loading football search…</Text></View> : null}
      {!q ? <>
        <View style={s.regionIntro}><View style={s.regionIcon}><Ionicons name="earth-outline" size={22} color={C.red}/></View><View style={{flex:1}}><Text style={s.stateTitle}>Myanmar & ASEAN</Text><Text style={s.stateText}>Senior national teams with verified FIFA men&apos;s ranking.</Text></View></View>
        {rankingLoading && !ranking ? <View style={s.rankingLoading}><ActivityIndicator size="small" color={C.red}/><Text style={s.stateText}>Loading official FIFA ranking…</Text></View> : null}
        {rankingError && !ranking ? <View style={s.rankingError}><Ionicons name="cloud-offline-outline" size={18} color={C.muted}/><Text style={s.stateText}>{rankingError}</Text></View> : null}
        {ranking ? <>
          <View style={s.sectionLine}><Text style={s.section}>FIFA MEN&apos;S RANKING</Text><Text style={s.source}>{rankingDateLabel(ranking.publishedAt)}</Text></View>
          {myanmar ? <View style={[s.card,s.myanmarCard]}><ResultRow icon="flag-outline" image={myanmar.flagUrl} title={`Myanmar · #${myanmar.rank}`} subtitle={rankingSubtitle(myanmar)} accent /></View> : null}
          {otherAsean.length ? <><Text style={s.section}>ASEAN NATIONAL TEAMS</Text><View style={s.card}>{otherAsean.map((entry,index) => <View key={`${entry.fifaCode || entry.name}-${entry.rank}`} style={index !== otherAsean.length-1 ? s.border : null}><ResultRow icon="flag-outline" image={entry.flagUrl} title={`${entry.name} · #${entry.rank}`} subtitle={rankingSubtitle(entry)}/></View>)}</View></> : null}
        </> : null}
      </> : null}
      {q && q.length < 4 && !total ? <View style={s.searchHint}><Ionicons name="search-outline" size={18} color={C.muted}/><Text style={s.stateText}>Type at least 4 letters for full worldwide team and player search.</Text></View> : null}
      {remoteError && q.length >= 4 ? <View style={s.searchHint}><Ionicons name="cloud-offline-outline" size={18} color={C.muted}/><Text style={s.stateText}>{remoteError}</Text></View> : null}
      {!loading && !searchingGlobal && q && !total ? <View style={s.state}><Ionicons name="search-outline" size={30} color={C.muted}/><Text style={s.stateTitle}>No results</Text><Text style={s.stateText}>Try another team, player, country or competition name.</Text></View> : null}
      {data.matches.length ? <><Text style={s.section}>MATCHES</Text><View style={s.card}>{data.matches.map((m,index) => <View key={m.id} style={index !== data.matches.length-1 ? s.border : null}><ResultRow icon="football-outline" title={`${m.home?.name} vs ${m.away?.name}`} subtitle={m.competition} onPress={() => openMatch?.(m)}/></View>)}</View></> : null}
      {data.teams.length ? <><Text style={s.section}>TEAMS</Text><View style={s.card}>{data.teams.map((team,index) => <View key={team.id} style={index !== data.teams.length-1 ? s.border : null}><ResultRow icon="shield-outline" image={team.logo} title={team.name} subtitle={team.national ? `${team.country || "National"} · National team` : team.country || "Team"} accent={regionalTeamPriority(team) === 180} onPress={() => openEntity?.("team",team)}/></View>)}</View></> : null}
      {data.players.length ? <><Text style={s.section}>PLAYERS</Text><View style={s.card}>{data.players.map((player,index) => <View key={player.id} style={index !== data.players.length-1 ? s.border : null}><ResultRow icon="person-outline" image={player.photo} title={player.name} subtitle={[player.team, player.nationality].filter(Boolean).join(" · ") || "Player"} onPress={() => openEntity?.("player",player)}/></View>)}</View></> : null}
      {data.rankings.length ? <><Text style={s.section}>FIFA NATIONAL TEAMS</Text><View style={s.card}>{data.rankings.map((entry,index) => <View key={`${entry.fifaCode || entry.name}-${entry.rank}`} style={index !== data.rankings.length-1 ? s.border : null}><ResultRow icon="flag-outline" image={entry.flagUrl} title={`${entry.name} · #${entry.rank}`} subtitle={rankingSubtitle(entry)} accent={entry.aseanKey === "myanmar"}/></View>)}</View></> : null}
      {data.competitions.length ? <><Text style={s.section}>COMPETITIONS</Text><View style={s.card}>{data.competitions.map((item,index) => <View key={item.id} style={index !== data.competitions.length-1 ? s.border : null}><ResultRow icon="trophy-outline" image={logo(item)} title={name(item)} subtitle={item.country || "Competition"} onPress={() => openEntity?.("competition",{ id:item.id, name:name(item), logo:logo(item) })}/></View>)}</View></> : null}
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},header:{minHeight:66,paddingHorizontal:14,flexDirection:"row",alignItems:"center",gap:10,borderBottomWidth:1,borderBottomColor:C.border2},searchBox:{flex:1,minHeight:44,borderWidth:1,borderColor:C.border,borderRadius:10,backgroundColor:C.card,flexDirection:"row",alignItems:"center",paddingHorizontal:11,gap:8},input:{flex:1,color:C.text,fontSize:13.5,paddingVertical:8},content:{padding:16,paddingBottom:40},section:{color:C.text2,fontSize:12,fontWeight:"900",marginTop:14,marginBottom:8},sectionLine:{marginTop:14,flexDirection:"row",alignItems:"flex-end",justifyContent:"space-between",gap:10},source:{color:C.muted,fontSize:9.5,fontWeight:"700",marginBottom:8},card:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,overflow:"hidden"},myanmarCard:{borderColor:"rgba(243,38,45,.55)"},border:{borderBottomWidth:1,borderBottomColor:C.border2},row:{minHeight:65,paddingHorizontal:12,paddingVertical:10,flexDirection:"row",alignItems:"center",gap:10},rowAccent:{backgroundColor:"rgba(243,38,45,.06)"},icon:{width:40,height:40,borderRadius:9,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},image:{width:40,height:40},rowTitle:{color:C.text2,fontSize:13.5,fontWeight:"800"},rowTitleAccent:{color:C.text},rowSub:{color:C.muted,fontSize:10.5,marginTop:3},state:{minHeight:150,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,alignItems:"center",justifyContent:"center",gap:8,padding:20},regionIntro:{minHeight:72,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,flexDirection:"row",alignItems:"center",gap:12,padding:14},regionIcon:{width:42,height:42,borderRadius:12,backgroundColor:"rgba(243,38,45,.10)",alignItems:"center",justifyContent:"center"},rankingLoading:{minHeight:62,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:9},rankingError:{minHeight:64,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,padding:12,marginTop:12},searchHint:{minHeight:52,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,flexDirection:"row",alignItems:"center",gap:9,paddingHorizontal:12,marginBottom:8},stateTitle:{color:C.text,fontSize:15,fontWeight:"800"},stateText:{color:C.muted,fontSize:11.5,lineHeight:17},
});