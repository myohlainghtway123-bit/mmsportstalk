import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getAuthStatus, getFavorites, normalizeFavoritePayload } from "../services/accountApi";
import { readEntityFavorite, toggleEntityFavorite } from "../services/entityFavorite";

const C = { surface:"#101417", raised:"#171C20", border:"#293036", text:"#FFFFFF", secondary:"#D4D8DB", muted:"#929AA0", red:"#F3262D", amber:"#F4C84D", green:"#48C78E" };

function entityName(row, fallback) {
  return String(row?.name || row?.title || row?.team?.name || row?.player?.name || row?.competition?.name || fallback);
}
function entityId(row) {
  return String(row?.id ?? row?.entityId ?? row?.team?.id ?? row?.player?.id ?? row?.competition?.id ?? "");
}

function Group({ title, rows }) {
  if (!rows?.length) return null;
  return (
    <View style={s.group}>
      <Text style={s.groupTitle}>{title}</Text>
      {rows.slice(0, 10).map((row, index) => (
        <View key={`${title}-${entityId(row) || index}`} style={[s.row, index > 0 && s.rowBorder]}>
          <Ionicons name="star" size={14} color={C.amber}/>
          <Text numberOfLines={1} style={s.rowName}>{entityName(row, `${title} ${index + 1}`)}</Text>
        </View>
      ))}
    </View>
  );
}

export default function Phase4BFavoritesPanel() {
  const [state, setState] = useState({ loading:true, authenticated:null, data:null, error:"" });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading:true, error:"" }));
    try {
      const auth = await getAuthStatus();
      if (!auth.authenticated) {
        setState({ loading:false, authenticated:false, data:null, error:"" });
        return;
      }
      const payload = await getFavorites();
      setState({ loading:false, authenticated:true, data:normalizeFavoritePayload(payload), error:"" });
    } catch (error) {
      setState({ loading:false, authenticated:null, data:null, error:error?.message || "Favorites are unavailable." });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (state.loading) return <View style={s.state}><ActivityIndicator color={C.red}/><Text style={s.stateText}>Loading favorites…</Text></View>;
  if (state.authenticated === false) return <View style={s.state}><Ionicons name="person-circle-outline" size={24} color={C.muted}/><Text style={s.stateTitle}>Sign in to sync favorites</Text><Text style={s.stateText}>The existing MST account favorites service is connected; an authenticated session is required for cross-device favorites.</Text></View>;
  if (state.error) return <View style={s.state}><Ionicons name="warning-outline" size={22} color={C.amber}/><Text style={s.stateText}>{state.error}</Text><Pressable onPress={load} style={s.retry}><Text style={s.retryText}>Retry</Text></Pressable></View>;

  const data = state.data || { teams:[], competitions:[], players:[] };
  const total = data.teams.length + data.competitions.length + data.players.length;
  return (
    <View>
      {total ? <><Group title="Teams" rows={data.teams}/><Group title="Competitions" rows={data.competitions}/><Group title="Players" rows={data.players}/></> : <View style={s.state}><Ionicons name="star-outline" size={23} color={C.muted}/><Text style={s.stateTitle}>No saved favorites yet</Text><Text style={s.stateText}>Favorite teams, competitions or players will appear here.</Text></View>}
    </View>
  );
}

function numeric(value) {
  return /^\d{1,12}$/.test(String(value || ""));
}

function FavoriteButton({ type, entity }) {
  const id = String(entity?.id || "");
  const [state, setState] = useState({ loading:true, favorite:false, requiresAuth:false, error:"" });
  const usable = numeric(id) && Boolean(entity?.name);

  const load = useCallback(async () => {
    if (!usable) {
      setState({ loading:false, favorite:false, requiresAuth:false, error:"" });
      return;
    }
    try {
      const result = await readEntityFavorite(type, id);
      setState({ loading:false, favorite:Boolean(result.favorite), requiresAuth:false, error:"" });
    } catch (error) {
      setState({ loading:false, favorite:false, requiresAuth:false, error:error?.message || "Favorite unavailable" });
    }
  }, [id, type, usable]);

  useEffect(() => { load(); }, [load]);
  const toggle = async () => {
    if (!usable || state.loading) return;
    const next = !state.favorite;
    setState((current) => ({ ...current, loading:true, error:"" }));
    try {
      const result = await toggleEntityFavorite({ type, entity, active:next, name:entity.name, imageUrl:entity.logo || entity.photo || null });
      setState({ loading:false, favorite:Boolean(result.favorite), requiresAuth:Boolean(result.requiresAuth), error:"" });
    } catch (error) {
      setState((current) => ({ ...current, loading:false, error:error?.message || "Could not update favorite" }));
    }
  };

  if (!usable) return null;
  return (
    <Pressable disabled={state.loading} onPress={toggle} style={[s.favoriteButton, state.favorite && s.favoriteButtonActive]}>
      {state.loading ? <ActivityIndicator size="small" color={C.red}/> : <Ionicons name={state.favorite ? "star" : "star-outline"} size={15} color={state.favorite ? C.amber : C.secondary}/>} 
      <Text numberOfLines={1} style={s.favoriteButtonText}>{entity.name}</Text>
      {state.requiresAuth ? <Text style={s.authHint}>SIGN IN</Text> : null}
    </Pressable>
  );
}

export function Phase4BMatchFavorites({ match }) {
  const entities = useMemo(() => [
    { type:"team", entity:{ id:match?.home_team_id, name:match?.home_team_name, logo:match?.home_team_logo_url } },
    { type:"competition", entity:{ id:match?.competition_id, name:match?.competition_name, logo:match?.competition_logo_url } },
    { type:"team", entity:{ id:match?.away_team_id, name:match?.away_team_name, logo:match?.away_team_logo_url } },
  ].filter(({ entity }) => numeric(entity.id) && entity.name), [match]);
  if (!entities.length) return null;
  return <View style={s.favoriteRow}>{entities.map(({ type, entity }) => <FavoriteButton key={`${type}-${entity.id}`} type={type} entity={entity}/>)}</View>;
}

const s = StyleSheet.create({
  state:{ minHeight:110, borderRadius:13, borderWidth:1, borderColor:C.border, backgroundColor:C.surface, alignItems:"center", justifyContent:"center", padding:15, gap:7, marginBottom:10 },
  stateTitle:{ color:C.text, fontSize:11, fontWeight:"900", textAlign:"center" },
  stateText:{ color:C.muted, fontSize:9, lineHeight:14, textAlign:"center" },
  retry:{ borderRadius:8, borderWidth:1, borderColor:C.border, backgroundColor:C.raised, paddingHorizontal:11, paddingVertical:7 },
  retryText:{ color:C.secondary, fontSize:8, fontWeight:"900" },
  group:{ borderRadius:13, borderWidth:1, borderColor:C.border, backgroundColor:C.surface, padding:11, marginBottom:9 },
  groupTitle:{ color:C.text, fontSize:11, fontWeight:"900", marginBottom:5 },
  row:{ minHeight:39, flexDirection:"row", alignItems:"center", gap:7 },
  rowBorder:{ borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:C.border },
  rowName:{ color:C.secondary, fontSize:9.5, fontWeight:"700", flex:1 },
  favoriteRow:{ flexDirection:"row", flexWrap:"wrap", gap:7, marginBottom:10 },
  favoriteButton:{ minHeight:34, maxWidth:"48%", borderRadius:17, borderWidth:1, borderColor:C.border, backgroundColor:C.surface, paddingHorizontal:10, flexDirection:"row", alignItems:"center", gap:5 },
  favoriteButtonActive:{ borderColor:C.amber },
  favoriteButtonText:{ color:C.secondary, fontSize:8.5, fontWeight:"800", flexShrink:1 },
  authHint:{ color:C.amber, fontSize:6.5, fontWeight:"900" },
});
