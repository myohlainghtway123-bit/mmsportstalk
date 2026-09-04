import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getNotifications, markAllNotificationsRead, normalizeNotifications } from "../services/notificationApi";
import { registerDeviceForPush } from "../services/matchEngagementApi";

const C = { surface:"#101417", raised:"#171C20", border:"#293036", text:"#FFFFFF", secondary:"#D4D8DB", muted:"#929AA0", red:"#F3262D", amber:"#F4C84D", green:"#48C78E" };

export default function Phase4BNotificationsPanel() {
  const [state, setState] = useState({ loading:true, rows:[], error:"", push:"" });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading:true, error:"" }));
    try {
      const payload = await getNotifications({ sync:true, limit:20 });
      setState((current) => ({ ...current, loading:false, rows:normalizeNotifications(payload), error:"" }));
    } catch (error) {
      setState((current) => ({ ...current, loading:false, rows:[], error:error?.message || "Notifications are unavailable." }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      await load();
    } catch (error) {
      setState((current) => ({ ...current, error:error?.message || "Could not mark notifications read." }));
    }
  };

  const enablePush = async () => {
    setState((current) => ({ ...current, push:"Enabling…" }));
    try {
      const result = await registerDeviceForPush();
      setState((current) => ({ ...current, push:result?.token ? "Push notifications enabled on this device." : "Push registration completed." }));
    } catch (error) {
      setState((current) => ({ ...current, push:error?.message || "Push notifications could not be enabled." }));
    }
  };

  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={s.flex}><Text style={s.eyebrow}>NOTIFICATIONS</Text><Text style={s.title}>Match & MST alerts</Text></View>
        <Pressable onPress={enablePush} style={s.action}><Ionicons name="notifications-outline" size={13} color={C.secondary}/><Text style={s.actionText}>Enable</Text></Pressable>
      </View>
      {state.loading ? <ActivityIndicator color={C.red} style={s.loader}/> : state.rows.length ? state.rows.slice(0, 6).map((row, index) => (
        <View key={String(row.id)} style={[s.row, index > 0 && s.rowBorder]}>
          <View style={[s.dot, row.read && s.dotRead]}/>
          <View style={s.flex}><Text numberOfLines={1} style={s.rowTitle}>{row.title}</Text>{row.body ? <Text numberOfLines={2} style={s.rowBody}>{row.body}</Text> : null}</View>
        </View>
      )) : <Text style={s.empty}>{state.error || "No notifications available."}</Text>}
      {state.rows.some((row) => !row.read) ? <Pressable onPress={markAll} style={s.markAll}><Text style={s.markAllText}>Mark all read</Text></Pressable> : null}
      {state.push ? <Text style={[s.note, { color: state.push.includes("enabled") || state.push.includes("completed") ? C.green : C.muted }]}>{state.push}</Text> : null}
      {state.error && state.rows.length ? <Text style={s.error}>{state.error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card:{ borderRadius:13, borderWidth:1, borderColor:C.border, backgroundColor:C.surface, padding:12, marginBottom:10 },
  header:{ flexDirection:"row", alignItems:"center", gap:8 },
  flex:{ flex:1, minWidth:0 },
  eyebrow:{ color:C.red, fontSize:8, fontWeight:"900", letterSpacing:.7 },
  title:{ color:C.text, fontSize:11.5, fontWeight:"900", marginTop:3 },
  action:{ minHeight:31, borderRadius:8, borderWidth:1, borderColor:C.border, backgroundColor:C.raised, paddingHorizontal:9, flexDirection:"row", alignItems:"center", gap:4 },
  actionText:{ color:C.secondary, fontSize:8, fontWeight:"900" },
  loader:{ marginVertical:18 },
  row:{ minHeight:48, flexDirection:"row", alignItems:"center", gap:8 },
  rowBorder:{ borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:C.border },
  dot:{ width:7, height:7, borderRadius:4, backgroundColor:C.red },
  dotRead:{ backgroundColor:C.muted },
  rowTitle:{ color:C.secondary, fontSize:9.5, fontWeight:"800" },
  rowBody:{ color:C.muted, fontSize:8.5, lineHeight:12, marginTop:2 },
  empty:{ color:C.muted, fontSize:9, lineHeight:14, marginTop:10 },
  markAll:{ alignSelf:"flex-start", marginTop:8 },
  markAllText:{ color:C.red, fontSize:8.5, fontWeight:"900" },
  note:{ fontSize:8.5, lineHeight:13, marginTop:8 },
  error:{ color:C.amber, fontSize:8.5, lineHeight:13, marginTop:8 },
});
