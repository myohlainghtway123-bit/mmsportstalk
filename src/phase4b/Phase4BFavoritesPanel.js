import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getAuthStatus,
  getFavorites,
  loadGuestFavorites,
  normalizeFavoritePayload,
  readEntityFavorite,
  reconcileGuestFavorites,
  toggleEntityFavorite,
} from "./scoresFavoritesApi";
import { useTheme } from "../theme/ThemeContext";

const C = { surface:"#101417", raised:"#171C20", border:"#293036", text:"#FFFFFF", secondary:"#D4D8DB", muted:"#929AA0", red:"#F3262D", amber:"#F4C84D", green:"#48C78E" };

function entityName(row, fallback) {
  return String(row?.name || row?.title || row?.team?.name || row?.player?.name || row?.competition?.name || fallback);
}
function entityId(row) {
  return String(row?.id ?? row?.entityId ?? row?.team?.id ?? row?.player?.id ?? row?.competition?.id ?? "");
}

function Group({ title, rows, colors = C, onRemove, onSelectEntity, type }) {
  if (!rows?.length) return null;
  const entityType = type || (title.toLowerCase().startsWith("comp") ? "competition" : title.toLowerCase().startsWith("play") ? "player" : "team");
  return (
    <View style={[s.group, { backgroundColor: colors.surface || colors.card || C.surface, borderColor: colors.border }]}>
      <Text style={[s.groupTitle, { color: colors.text }]}>{title}</Text>
      {rows.slice(0, 25).map((row, index) => {
        const id = entityId(row);
        const name = entityName(row, `${title} ${index + 1}`);
        return (
          <Pressable
            key={`${title}-${id || index}`}
            accessibilityRole="button"
            accessibilityLabel={`${title}: ${name}`}
            onPress={() => onSelectEntity?.(entityType, { id, name, logo: row?.logo || row?.badge || null })}
            style={({ pressed }) => [
              s.row,
              index > 0 && [s.rowBorder, { borderTopColor: colors.border }],
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="star" size={14} color={C.amber} />
            <Text numberOfLines={1} style={[s.rowName, { color: colors.secondary || colors.text, flex: 1 }]}>
              {name}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.muted || C.muted} style={{ marginHorizontal: 4 }} />
            {onRemove ? (
              <Pressable
                hitSlop={10}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onRemove(row, title.toLowerCase());
                }}
                style={s.removeBtn}
              >
                <Ionicons name="close-circle-outline" size={17} color={colors.muted || C.muted} />
              </Pressable>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Phase4BFavoritesPanel({ onOpenSignIn, onSelectEntity, filter = "all", language = "my" }) {
  const my = language === "my";
  const [state, setState] = useState({ loading: true, authenticated: false, data: null, error: "" });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const auth = await getAuthStatus().catch(() => ({ authenticated: false }));
      if (auth.authenticated) {
        const reconciliation = await reconcileGuestFavorites().catch(() => null);
        const unifiedData = reconciliation?.finalState || normalizeFavoritePayload(await getFavorites());
        setState({ loading: false, authenticated: true, data: unifiedData, error: "" });
      } else {
        const guestData = await loadGuestFavorites();
        setState({ loading: false, authenticated: false, data: guestData, error: "" });
      }
    } catch (error) {
      const reconciliation = await reconcileGuestFavorites().catch(() => null);
      const guestData = reconciliation?.finalState || await loadGuestFavorites().catch(() => ({ teams: [], competitions: [], players: [], matches: [] }));
      setState({ loading: false, authenticated: false, data: guestData, error: "" });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleRemove = async (row, kindPlural) => {
    const kind = kindPlural.startsWith("comp") ? "competition" : kindPlural.startsWith("play") ? "player" : "team";
    const id = entityId(row);
    try {
      await toggleEntityFavorite({ type: kind, entity: { id, name: entityName(row, id) }, active: false });
      await load();
    } catch (_) {}
  };

  let colors = C;
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
  } catch {}

  if (state.loading) return <View style={[s.state, { backgroundColor: colors.surface || colors.card || C.surface, borderColor: colors.border }]}><ActivityIndicator color={colors.red || C.red}/><Text style={[s.stateText, { color: colors.muted }]}>{my ? "အကြိုက်ဆုံးများ ရယူနေပါသည်…" : "Loading favorites…"}</Text></View>;
  if (state.error && !state.data) return <View style={[s.state, { backgroundColor: colors.surface || colors.card || C.surface, borderColor: colors.border }]}><Ionicons name="warning-outline" size={22} color={C.amber}/><Text style={[s.stateText, { color: colors.muted }]}>{state.error}</Text><Pressable onPress={load} style={[s.retry, { backgroundColor: colors.raised, borderColor: colors.border }]}><Text style={[s.retryText, { color: colors.secondary || colors.text }]}>{my ? "ပြန်လည်ကြိုးစားမည်" : "Retry"}</Text></Pressable></View>;

  const data = state.data || { teams: [], competitions: [], players: [] };
  const showTeams = filter === "all" || filter === "teams";
  const showComps = filter === "all" || filter === "competitions";
  const showPlayers = filter === "all";
  const total = (showTeams ? (data.teams?.length || 0) : 0) +
                (showComps ? (data.competitions?.length || 0) : 0) +
                (showPlayers ? (data.players?.length || 0) : 0);

  return (
    <View>
      {!state.authenticated ? (
        <View style={[s.guestSyncCard, { backgroundColor: colors.surface || colors.card || C.surface, borderColor: colors.border }]}>
          <View style={s.guestSyncCopy}>
            <View style={s.guestBadgeRow}>
              <Ionicons name="phone-portrait-outline" size={13} color={colors.muted || C.muted} />
              <Text style={[s.guestBadgeText, { color: colors.muted }]}>{my ? "ဤဖုန်းတွင် သိမ်းဆည်းထားသည်" : "Saved on this device"}</Text>
            </View>
            <Text style={[s.guestSyncTitle, { color: colors.text }]}>{my ? "အကောင့်ဝင်ပြီး ချိတ်ဆက်ပါ" : "Sign in to sync across devices"}</Text>
          </View>
          {onOpenSignIn ? (
            <Pressable onPress={onOpenSignIn} style={[s.signInBtn, { backgroundColor: colors.red }]}>
              <Text style={s.signInBtnText}>{my ? "အကောင့်ဝင်ရန်" : "Sign In"}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {total ? (
        <>
          {showTeams && <Group title={my ? "အသင်းများ" : "Teams"} rows={data.teams} colors={colors} onRemove={handleRemove} onSelectEntity={onSelectEntity} type="team" />}
          {showComps && <Group title={my ? "ပြိုင်ပွဲများ" : "Competitions"} rows={data.competitions} colors={colors} onRemove={handleRemove} onSelectEntity={onSelectEntity} type="competition" />}
          {showPlayers && <Group title={my ? "ကစားသမားများ" : "Players"} rows={data.players} colors={colors} onRemove={handleRemove} onSelectEntity={onSelectEntity} type="player" />}
        </>
      ) : (
        <View style={[s.state, { backgroundColor: colors.surface || colors.card || C.surface, borderColor: colors.border }]}>
          <Ionicons name="star-outline" size={23} color={colors.muted}/>
          <Text style={[s.stateTitle, { color: colors.text }]}>
            {filter === "teams" ? (my ? "အကြိုက်ဆုံး အသင်းများ မရှိသေးပါ" : "No favorite teams yet") : filter === "competitions" ? (my ? "အကြိုက်ဆုံး ပြိုင်ပွဲများ မရှိသေးပါ" : "No favorite competitions yet") : (my ? "အကြိုက်ဆုံးများ မရှိသေးပါ" : "No saved favorites yet")}
          </Text>
          <Text style={[s.stateText, { color: colors.muted }]}>
            {filter === "teams"
              ? (my ? "ပွဲစဉ်အသေးစိတ် သို့မဟုတ် ရှာဖွေမှုမှတစ်ဆင့် အကြိုက်ဆုံးအသင်းများ ထည့်သွင်းနိုင်ပါသည်" : "Add favorite teams from match details or search.")
              : filter === "competitions"
              ? (my ? "ပွဲစဉ်အသေးစိတ် သို့မဟုတ် ရှာဖွေမှုမှတစ်ဆင့် အကြိုက်ဆုံးပြိုင်ပွဲများ ထည့်သွင်းနိုင်ပါသည်" : "Add favorite leagues & tournaments from match details or search.")
              : (my ? "အသင်း၊ ပြိုင်ပွဲနှင့် ကစားသမားများကို ကြယ်ပွင့်နှိပ်၍ အကြိုက်ဆုံးအဖြစ် ထည့်သွင်းနိုင်ပါသည်" : "Favorite teams, competitions or players by tapping the star icon on any match or team.")}
          </Text>
        </View>
      )}
    </View>
  );
}

function isValidFavoriteId(value) {
  return /^[a-zA-Z0-9_\-:.]{1,64}$/.test(String(value || "").trim());
}

function FavoriteButton({ type, entity }) {
  const id = String(entity?.id || "").trim();
  const [state, setState] = useState({ loading:true, favorite:false, requiresAuth:false, error:"" });
  const usable = isValidFavoriteId(id) && Boolean(entity?.name);

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
  ].filter(({ entity }) => isValidFavoriteId(entity.id) && entity.name), [match]);
  if (!entities.length) return null;
  return <View style={s.favoriteRow}>{entities.map(({ type, entity }) => <FavoriteButton key={`${type}-${entity.id}`} type={type} entity={entity}/>)}</View>;
}

const s = StyleSheet.create({
  state:{ minHeight:120, borderRadius:13, borderWidth:1, borderColor:C.border, backgroundColor:C.surface, alignItems:"center", justifyContent:"center", padding:16, gap:8, marginBottom:10 },
  stateTitle:{ color:C.text, fontSize:15, fontWeight:"900", textAlign:"center" },
  stateText:{ color:C.muted, fontSize:13, lineHeight:18, textAlign:"center" },
  retry:{ borderRadius:8, borderWidth:1, borderColor:C.border, backgroundColor:C.raised, paddingHorizontal:14, minHeight:38, alignItems:"center", justifyContent:"center" },
  retryText:{ color:C.secondary, fontSize:12.5, fontWeight:"900" },
  group:{ borderRadius:13, borderWidth:1, borderColor:C.border, backgroundColor:C.surface, padding:13, marginBottom:10 },
  groupTitle:{ color:C.text, fontSize:14.5, fontWeight:"900", marginBottom:6 },
  row:{ minHeight:44, flexDirection:"row", alignItems:"center", gap:8 },
  rowBorder:{ borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:C.border },
  rowName:{ color:C.secondary, fontSize:13.5, fontWeight:"700", flex:1 },
  favoriteRow:{ flexDirection:"row", flexWrap:"wrap", gap:8, marginBottom:10 },
  favoriteButton:{ minHeight:38, maxWidth:"48%", borderRadius:19, borderWidth:1, borderColor:C.border, backgroundColor:C.surface, paddingHorizontal:12, flexDirection:"row", alignItems:"center", gap:6 },
  favoriteButtonActive:{ borderColor:C.amber },
  favoriteButtonText:{ color:C.secondary, fontSize:12.5, fontWeight:"800", flexShrink:1 },
  authHint:{ color:C.amber, fontSize:10, fontWeight:"900" },
  removeBtn:{ padding:4 },
  guestSyncCard:{ borderRadius:13, borderWidth:1, borderColor:C.border, backgroundColor:C.surface, padding:14, marginBottom:12, flexDirection:"row", alignItems:"center", justifyContent:"space-between", gap:12 },
  guestSyncCopy:{ flex:1 },
  guestBadgeRow:{ flexDirection:"row", alignItems:"center", gap:5, marginBottom:3 },
  guestBadgeText:{ fontSize:11, fontWeight:"800" },
  guestSyncTitle:{ fontSize:13.5, fontWeight:"900" },
  signInBtn:{ borderRadius:8, paddingHorizontal:14, minHeight:34, alignItems:"center", justifyContent:"center" },
  signInBtnText:{ color:"#FFFFFF", fontSize:12, fontWeight:"900" },
});
