import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { extractArray, fetchCompetitionCatalog, fetchFootballMatches } from "../services/footballApi";

const C = { bg:"#080A0C", card:"#111416", card2:"#15191C", border:"#24292D", border2:"#1D2226", red:"#F3262D", text:"#FFFFFF", text2:"#D0D2D4", muted:"#92979B" };

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
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [competitions, setCompetitions] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([fetchFootballMatches({ date:todayBangkok() }), fetchCompetitionCatalog()]).then((results) => {
      if (!alive) return;
      if (results[0].status === "fulfilled") setMatches(results[0].value.matches || []);
      if (results[1].status === "fulfilled") setCompetitions(extractArray(results[1].value));
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const q = query.trim().toLowerCase();
  const data = useMemo(() => {
    if (!q) return { matches:[], teams:[], competitions:[] };
    const foundMatches = matches.filter((m) => `${m.home?.name} ${m.away?.name} ${m.competition}`.toLowerCase().includes(q)).slice(0,12);
    const teamMap = new Map();
    matches.forEach((m) => [m.home,m.away].forEach((team) => { if (team?.id && String(team.name || "").toLowerCase().includes(q)) teamMap.set(String(team.id), team); }));
    const foundCompetitions = competitions.map((raw) => raw?.league || raw?.competition || raw).filter((item) => item?.id && name(item).toLowerCase().includes(q)).slice(0,12);
    return { matches:foundMatches, teams:[...teamMap.values()].slice(0,12), competitions:foundCompetitions };
  }, [q, matches, competitions]);

  const total = data.matches.length + data.teams.length + data.competitions.length;

  return <View style={s.screen}>
    <View style={s.header}>
      <Pressable hitSlop={10} onPress={goBack}><Ionicons name="chevron-back" size={28} color={C.text}/></Pressable>
      <View style={s.searchBox}><Ionicons name="search-outline" size={20} color={C.muted}/><TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search teams, matches, competitions" placeholderTextColor={C.muted} style={s.input}/>{query ? <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={19} color={C.muted}/></Pressable> : null}</View>
    </View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {loading ? <View style={s.state}><ActivityIndicator color={C.red}/><Text style={s.stateText}>Loading football search…</Text></View> : null}
      {!loading && !q ? <View style={s.state}><Ionicons name="search-outline" size={30} color={C.muted}/><Text style={s.stateTitle}>Search MST football</Text><Text style={s.stateText}>Find today's matches, teams and competitions.</Text></View> : null}
      {!loading && q && !total ? <View style={s.state}><Ionicons name="search-outline" size={30} color={C.muted}/><Text style={s.stateTitle}>No results</Text><Text style={s.stateText}>Try another team or competition name.</Text></View> : null}
      {data.matches.length ? <><Text style={s.section}>MATCHES</Text><View style={s.card}>{data.matches.map((m,index) => <View key={m.id} style={index !== data.matches.length-1 ? s.border : null}><ResultRow icon="football-outline" title={`${m.home?.name} vs ${m.away?.name}`} subtitle={m.competition} onPress={() => openMatch?.(m)}/></View>)}</View></> : null}
      {data.teams.length ? <><Text style={s.section}>TEAMS</Text><View style={s.card}>{data.teams.map((team,index) => <View key={team.id} style={index !== data.teams.length-1 ? s.border : null}><ResultRow icon="shield-outline" image={team.logo} title={team.name} subtitle="Team" onPress={() => openEntity?.("team",team)}/></View>)}</View></> : null}
      {data.competitions.length ? <><Text style={s.section}>COMPETITIONS</Text><View style={s.card}>{data.competitions.map((item,index) => <View key={item.id} style={index !== data.competitions.length-1 ? s.border : null}><ResultRow icon="trophy-outline" image={logo(item)} title={name(item)} subtitle={item.country || "Competition"} onPress={() => openEntity?.("competition",{ id:item.id, name:name(item), logo:logo(item) })}/></View>)}</View></> : null}
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},header:{minHeight:66,paddingHorizontal:14,flexDirection:"row",alignItems:"center",gap:10,borderBottomWidth:1,borderBottomColor:C.border2},searchBox:{flex:1,minHeight:42,borderWidth:1,borderColor:C.border,borderRadius:10,backgroundColor:C.card,flexDirection:"row",alignItems:"center",paddingHorizontal:11,gap:8},input:{flex:1,color:C.text,fontSize:12.5,paddingVertical:8},content:{padding:16,paddingBottom:40},section:{color:C.text2,fontSize:11,fontWeight:"900",marginTop:14,marginBottom:8},card:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,overflow:"hidden"},border:{borderBottomWidth:1,borderBottomColor:C.border2},row:{minHeight:61,paddingHorizontal:12,paddingVertical:8,flexDirection:"row",alignItems:"center",gap:10},icon:{width:38,height:38,borderRadius:9,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},image:{width:38,height:38},rowTitle:{color:C.text2,fontSize:12.5,fontWeight:"800"},rowSub:{color:C.muted,fontSize:9.5,marginTop:3},state:{minHeight:150,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,alignItems:"center",justifyContent:"center",gap:8,padding:20},stateTitle:{color:C.text,fontSize:14,fontWeight:"800"},stateText:{color:C.muted,fontSize:10.5,textAlign:"center"},
});
