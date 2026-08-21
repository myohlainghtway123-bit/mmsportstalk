import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getAuthStatus, MST_SITE_URL } from "../services/accountApi";
import {
  getNotifications,
  getNotificationPreferences,
  normalizeNotifications,
  normalizeNotificationPreferences,
  saveNotificationPreferences,
  serializeNotificationPreferences,
} from "../services/notificationApi";

const C = {
  bg: "#080A0C", bg2: "#0B0E10", card: "#111416", card2: "#15191C",
  border: "#24292D", border2: "#1D2226", red: "#F3262D", redSoft: "rgba(243,38,45,0.14)",
  text: "#FFFFFF", text2: "#D0D2D4", muted: "#92979B", muted2: "#666D72", green: "#31C674",
};

function Header({ title, subtitle, goBack }) {
  return <View style={s.header}>
    <Pressable hitSlop={10} onPress={goBack}><Ionicons name="chevron-back" size={28} color={C.text}/></Pressable>
    <View style={{flex:1,paddingHorizontal:12}}><Text style={s.title}>{title}</Text>{subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}</View>
    <View style={{width:28}}/>
  </View>;
}

function Empty({ icon, title, text, action, actionText }) {
  return <View style={s.empty}><Ionicons name={icon} size={30} color={C.muted}/><Text style={s.emptyTitle}>{title}</Text>{text ? <Text style={s.emptyText}>{text}</Text> : null}{action ? <Pressable style={s.redButton} onPress={action}><Text style={s.redButtonText}>{actionText}</Text></Pressable> : null}</View>;
}

function ToggleRow({ icon, title, subtitle, value, onChange, disabled }) {
  return <Pressable style={s.row} disabled={disabled} onPress={() => onChange(!value)}><View style={s.rowIcon}><Ionicons name={icon} size={21} color={C.text2}/></View><View style={{flex:1}}><Text style={s.rowTitle}>{title}</Text><Text style={s.rowSub}>{subtitle}</Text></View><View style={[s.toggle,value && s.toggleOn,disabled && {opacity:.55}]}><View style={[s.toggleKnob,value && s.toggleKnobOn]}/></View></Pressable>;
}

function timeLabel(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationsScreen({ goBack, openAccount }) {
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [authenticated,setAuthenticated] = useState(false);
  const [notifications,setNotifications] = useState([]);
  const [prefs,setPrefs] = useState({breakingNews:true,liveScores:true,transfers:true,predictions:true});
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");

  const load = useCallback(async (refresh=false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError("");
    try {
      const auth = await getAuthStatus();
      setAuthenticated(auth.authenticated);
      if (!auth.authenticated) { setNotifications([]); return; }
      const [notificationPayload,prefPayload] = await Promise.all([getNotifications().catch(() => null),getNotificationPreferences().catch(() => null)]);
      setNotifications(normalizeNotifications(notificationPayload));
      if (prefPayload) setPrefs(normalizeNotificationPreferences(prefPayload));
    } catch (e) { setError(e?.message || "Could not load notifications."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const updatePref = async (key,value) => {
    const next = {...prefs,[key]:value}; setPrefs(next); setSaving(true); setError("");
    try { await saveNotificationPreferences(serializeNotificationPreferences(next)); }
    catch (e) { setPrefs(prefs); setError(e?.message || "Could not save notification preference."); }
    finally { setSaving(false); }
  };

  return <View style={s.screen}>
    <Header title="Notifications" subtitle="MST Score alerts and preferences" goBack={goBack}/>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.red} colors={[C.red]}/> }>
      {loading ? <View style={s.loading}><ActivityIndicator color={C.red}/><Text style={s.emptyText}>Loading notifications…</Text></View> : null}
      {!loading && !authenticated ? <Empty icon="person-circle-outline" title="Sign in for MST notifications" text="Use your MST account to sync notification preferences and alerts." action={openAccount} actionText="SIGN IN"/> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
      {!loading && authenticated ? <>
        <Text style={s.section}>NOTIFICATION PREFERENCES</Text>
        <View style={s.card}>
          <ToggleRow icon="newspaper-outline" title="Breaking News" subtitle="Important MST news and articles" value={prefs.breakingNews} onChange={(v) => updatePref("breakingNews",v)} disabled={saving}/><View style={s.divider}/>
          <ToggleRow icon="football-outline" title="Live Scores" subtitle="Match and score updates" value={prefs.liveScores} onChange={(v) => updatePref("liveScores",v)} disabled={saving}/><View style={s.divider}/>
          <ToggleRow icon="swap-horizontal-outline" title="Transfers" subtitle="Transfer news and confirmed moves" value={prefs.transfers} onChange={(v) => updatePref("transfers",v)} disabled={saving}/><View style={s.divider}/>
          <ToggleRow icon="trophy-outline" title="Predictions" subtitle="Prediction results and points" value={prefs.predictions} onChange={(v) => updatePref("predictions",v)} disabled={saving}/>
        </View>
        <Text style={s.section}>RECENT NOTIFICATIONS</Text>
        {notifications.length ? <View style={s.card}>{notifications.slice(0,30).map((item,index) => <View key={`${item.id}-${index}`} style={[s.notificationRow,index !== Math.min(notifications.length,30)-1 && s.divider]}><View style={[s.unreadDot,item.read && {opacity:0}]}/><View style={{flex:1}}><Text style={s.notificationTitle}>{item.title}</Text>{item.body ? <Text style={s.notificationBody}>{item.body}</Text> : null}<Text style={s.notificationTime}>{timeLabel(item.createdAt)}</Text></View></View>)}</View> : <Empty icon="notifications-outline" title="No notifications yet" text="New MST alerts will appear here."/>}
      </> : null}
    </ScrollView>
  </View>;
}

export function SettingsScreen({ goBack, openNotifications, openAccount }) {
  const [auth,setAuth] = useState(null);
  useEffect(() => { getAuthStatus().then(setAuth).catch(() => setAuth({authenticated:false})); }, []);
  const rows = useMemo(() => [
    ["person-circle-outline","MST Account",auth?.authenticated ? "Signed in" : "Sign in to sync favorites and predictions",openAccount],
    ["notifications-outline","Notifications","Manage MST alert preferences",openNotifications],
    ["globe-outline","MST Website","myanmarsportstalk.com",() => Linking.openURL(MST_SITE_URL)],
  ], [auth,openAccount,openNotifications]);

  return <View style={s.screen}><Header title="Settings" subtitle="MST Score" goBack={goBack}/><ScrollView contentContainerStyle={s.content}>
    <Text style={s.section}>APP</Text>
    <View style={s.card}>{rows.map(([icon,title,subtitle,action],i) => <Pressable key={title} onPress={action} style={[s.settingsRow,i !== rows.length-1 && s.divider]}><View style={s.rowIcon}><Ionicons name={icon} size={21} color={title === "MST Account" ? C.red : C.text2}/></View><View style={{flex:1}}><Text style={s.rowTitle}>{title}</Text><Text style={s.rowSub}>{subtitle}</Text></View><Ionicons name="chevron-forward" size={18} color={C.muted}/></Pressable>)}</View>
    <Text style={s.section}>APP INFO</Text>
    <View style={s.card}>
      <View style={[s.settingsRow,s.divider]}><View style={s.rowIcon}><Ionicons name="refresh-outline" size={21} color={C.text2}/></View><View style={{flex:1}}><Text style={s.rowTitle}>Live score refresh</Text><Text style={s.rowSub}>Silent background refresh every 20 seconds while Matches is open</Text></View></View>
      <View style={s.settingsRow}><View style={s.rowIcon}><Ionicons name="phone-portrait-outline" size={21} color={C.text2}/></View><View style={{flex:1}}><Text style={s.rowTitle}>MST Score</Text><Text style={s.rowSub}>Version 1.1.0 · Android build 4</Text></View></View>
    </View>
  </ScrollView></View>;
}

export function AboutScreen({ goBack }) {
  return <View style={s.screen}><Header title="About MST Score" subtitle="Myanmar Sports Talk" goBack={goBack}/><ScrollView contentContainerStyle={s.content}><View style={s.aboutHero}><Text style={s.mst}>MST</Text><Text style={s.aboutTitle}>MST SCORE</Text><Text style={s.aboutText}>Myanmar Sports Talk's football app for live matches, football data, news, videos, favorites, score predictions and rankings.</Text></View><Pressable style={s.redButton} onPress={() => Linking.openURL(MST_SITE_URL)}><Text style={s.redButtonText}>OPEN MYANMARSPORTSTALK.COM</Text></Pressable></ScrollView></View>;
}

const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},content:{paddingHorizontal:16,paddingTop:12,paddingBottom:40},
  header:{minHeight:66,paddingHorizontal:16,flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:C.border2},title:{fontSize:17,fontWeight:"800",color:C.text},subtitle:{fontSize:10.5,color:C.muted,marginTop:2},
  section:{fontSize:11,fontWeight:"900",color:C.text2,marginTop:13,marginBottom:8},card:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,overflow:"hidden",marginBottom:8},divider:{borderBottomWidth:1,borderBottomColor:C.border2},
  row:{minHeight:64,paddingHorizontal:12,paddingVertical:9,flexDirection:"row",alignItems:"center",gap:10},settingsRow:{minHeight:62,paddingHorizontal:12,paddingVertical:9,flexDirection:"row",alignItems:"center",gap:10},rowIcon:{width:35,height:35,borderRadius:9,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},rowTitle:{fontSize:13,fontWeight:"700",color:C.text2},rowSub:{fontSize:9.5,color:C.muted,marginTop:3,lineHeight:13},
  toggle:{width:42,height:24,borderRadius:12,backgroundColor:C.border,justifyContent:"center",paddingHorizontal:3},toggleOn:{backgroundColor:C.red},toggleKnob:{width:18,height:18,borderRadius:9,backgroundColor:C.text},toggleKnobOn:{alignSelf:"flex-end"},
  loading:{minHeight:130,alignItems:"center",justifyContent:"center",gap:8},empty:{minHeight:135,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,padding:18,alignItems:"center",justifyContent:"center",gap:7,marginBottom:10},emptyTitle:{fontSize:14,fontWeight:"800",color:C.text,textAlign:"center"},emptyText:{fontSize:10.5,color:C.muted,textAlign:"center",lineHeight:15},
  redButton:{minHeight:43,backgroundColor:C.red,borderRadius:8,paddingHorizontal:16,paddingVertical:11,alignItems:"center",justifyContent:"center",marginTop:8},redButtonText:{fontSize:10.5,fontWeight:"900",color:C.text},error:{fontSize:10.5,color:C.red,backgroundColor:C.redSoft,padding:9,borderRadius:7,textAlign:"center",marginBottom:8},
  notificationRow:{minHeight:70,paddingHorizontal:12,paddingVertical:10,flexDirection:"row",gap:9},unreadDot:{width:7,height:7,borderRadius:4,backgroundColor:C.red,marginTop:5},notificationTitle:{fontSize:12.5,fontWeight:"800",color:C.text2},notificationBody:{fontSize:10.5,color:C.muted,lineHeight:14,marginTop:4},notificationTime:{fontSize:9,color:C.muted2,marginTop:5},
  aboutHero:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:14,padding:22,alignItems:"center"},mst:{fontSize:54,lineHeight:58,fontWeight:"900",fontStyle:"italic",letterSpacing:-3,color:C.red},aboutTitle:{fontSize:12,fontWeight:"900",letterSpacing:1,color:C.text,marginTop:2},aboutText:{fontSize:11,color:C.muted,textAlign:"center",lineHeight:17,marginTop:13},
});