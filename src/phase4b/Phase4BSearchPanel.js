import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { searchFootballEntities } from "../services/smartSearchApi";

const C = { surface:"#101417", raised:"#171C20", border:"#293036", text:"#FFFFFF", secondary:"#D4D8DB", muted:"#929AA0", red:"#F3262D", amber:"#F4C84D" };

function Mark({ uri, fallback }) {
  return uri ? <Image source={{ uri }} resizeMode="contain" style={s.image}/> : <View style={s.fallback}><Text style={s.fallbackText}>{String(fallback || "?").slice(0,1).toUpperCase()}</Text></View>;
}
function Result({ type, row }) {
  return <View style={s.row}><Mark uri={row.logo || row.photo} fallback={row.name}/><View style={s.flex}><Text numberOfLines={1} style={s.name}>{row.name}</Text><Text numberOfLines={1} style={s.meta}>{type === "Team" ? row.country || "Team" : row.nationality || "Player"}</Text></View><Text style={s.type}>{type.toUpperCase()}</Text></View>;
}

export default function Phase4BSearchPanel() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState({ loading:false, teams:[], players:[], error:"", stale:false });
  const request = useRef(0);

  useEffect(() => {
    const cleaned = query.trim();
    if (cleaned.length < 4) {
      setState({ loading:false, teams:[], players:[], error:"", stale:false });
      return;
    }
    const id = ++request.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState((current) => ({ ...current, loading:true, error:"" }));
      try {
        const result = await searchFootballEntities(cleaned, { signal:controller.signal });
        if (id !== request.current) return;
        setState({ loading:false, teams:result.teams || [], players:result.players || [], error:"", stale:Boolean(result.stale) });
      } catch (error) {
        if (error?.name === "AbortError" || id !== request.current) return;
        setState({ loading:false, teams:[], players:[], error:error?.message || "Search is unavailable.", stale:false });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const total = state.teams.length + state.players.length;
  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>SEARCH</Text><Text style={s.title}>Teams & players</Text>
      <View style={s.inputWrap}><Ionicons name="search-outline" size={17} color={C.muted}/><TextInput value={query} onChangeText={setQuery} placeholder="Type at least 4 characters" placeholderTextColor={C.muted} autoCorrect={false} style={s.input}/>{state.loading ? <ActivityIndicator size="small" color={C.red}/> : null}</View>
      {state.stale ? <Text style={s.warning}>Showing cached search data.</Text> : null}
      {state.error ? <Text style={s.warning}>{state.error}</Text> : null}
      {query.trim().length >= 4 && !state.loading && !state.error && total === 0 ? <Text style={s.empty}>No team or player result.</Text> : null}
      {state.teams.slice(0,5).map((row) => <Result key={`team-${row.id}`} type="Team" row={row}/>)}
      {state.players.slice(0,5).map((row) => <Result key={`player-${row.id}`} type="Player" row={row}/>)}
    </View>
  );
}

const s = StyleSheet.create({
  card:{ borderRadius:13, borderWidth:1, borderColor:C.border, backgroundColor:C.surface, padding:14, marginBottom:10 },
  eyebrow:{ color:C.red, fontSize:11, fontWeight:"900", letterSpacing:.7 },
  title:{ color:C.text, fontSize:16, fontWeight:"900", marginTop:3 },
  inputWrap:{ minHeight:46, borderRadius:10, borderWidth:1, borderColor:C.border, backgroundColor:C.raised, marginTop:9, paddingHorizontal:12, flexDirection:"row", alignItems:"center", gap:8 },
  input:{ flex:1, color:C.text, fontSize:14, paddingVertical:8 },
  row:{ minHeight:52, borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:C.border, flexDirection:"row", alignItems:"center", gap:10 },
  image:{ width:32, height:32 },
  fallback:{ width:32, height:32, borderRadius:16, backgroundColor:C.raised, alignItems:"center", justifyContent:"center" },
  fallbackText:{ color:C.secondary, fontSize:12, fontWeight:"900" },
  flex:{ flex:1, minWidth:0 },
  name:{ color:C.secondary, fontSize:13.5, fontWeight:"800" },
  meta:{ color:C.muted, fontSize:12, marginTop:2 },
  type:{ color:C.muted, fontSize:11, fontWeight:"900" },
  warning:{ color:C.amber, fontSize:12.5, lineHeight:17, marginTop:8 },
  empty:{ color:C.muted, fontSize:13, marginTop:9 },
});
