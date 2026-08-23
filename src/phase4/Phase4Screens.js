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

export function NotificationsScreen({ goBack, openAccount, openMatch, openArticle, openPrediction, openTips, language = "my" }) {
  const my = language === "my";
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [authenticated,setAuthenticated] = useState(false);
  const [notifications,setNotifications] = useState([]);
  const [prefs,setPrefs] = useState({breakingNews:true,liveScores:true,transfers:true,predictions:true});
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");

  const load = useCallback(async (refresh=false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError(""); setMessage("");
    try {
      const auth = await getAuthStatus();
      setAuthenticated(auth.authenticated);
      if (!auth.authenticated) { setNotifications([]); return; }
      const [notificationPayload,prefPayload] = await Promise.all([getNotifications().catch(() => null),getNotificationPreferences().catch(() => null)]);
      setNotifications(normalizeNotifications(notificationPayload));
      if (prefPayload) setPrefs(normalizeNotificationPreferences(prefPayload));
    } catch (e) { setError(e?.message || (my ? "အသိပေးချက်များကို ရယူ၍မရပါ" : "Could not load notifications.")); }
    finally { setLoading(false); setRefreshing(false); }
  }, [my]);
  useEffect(() => { load(); }, [load]);

  const updatePref = async (key,value) => {
    const next = {...prefs,[key]:value}; setPrefs(next); setSaving(true); setError("");
    try { await saveNotificationPreferences(serializeNotificationPreferences(next)); }
    catch (e) { setPrefs(prefs); setError(e?.message || (my ? "ဆက်တင်သိမ်း၍ မရပါ" : "Could not save notification preference.")); }
    finally { setSaving(false); }
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setMessage(my ? "အားလုံးကို ဖတ်ပြီးအဖြစ် သတ်မှတ်ပြီးပါပြီ" : "All marked as read");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleNotificationPress = (item) => {
    const type = String(item?.type || item?.targetType || "").toLowerCase();
    if (type.includes("match") || item?.matchId) {
      openMatch?.({ id: item.matchId || item.targetId, home: { name: "Home" }, away: { name: "Away" } });
    } else if (type.includes("article") || type.includes("news") || item?.articleId) {
      openArticle?.({ id: item.articleId || item.targetId, title: item.title });
    } else if (type.includes("predict")) {
      openPrediction?.();
    } else if (type.includes("tip")) {
      openTips?.();
    }
  };

  return <View style={s.screen}>
    <Header title={my ? "အသိပေးချက်များ" : "Notifications"} subtitle={my ? "MST Score ပွဲနှင့် သတင်းအသိပေးချက်များ" : "MST Score alerts and preferences"} goBack={goBack}/>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.red} colors={[C.red]}/> }>
      {loading ? <View style={s.loading}><ActivityIndicator color={C.red}/><Text style={s.emptyText}>{my ? "အသိပေးချက်များ ဖွင့်နေသည်…" : "Loading notifications…"}</Text></View> : null}
      {!loading && !authenticated ? <Empty icon="person-circle-outline" title={my ? "MST အသိပေးချက်အတွက် အကောင့်ဝင်ပါ" : "Sign in for MST notifications"} text={my ? "အကြိုက်ဆုံးအသင်းနှင့် ပွဲရလဒ်အသိပေးချက်များ ရရှိရန် သင်၏ MST အကောင့်ကို အသုံးပြုပါ။" : "Use your MST account to sync notification preferences and alerts."} action={openAccount} actionText={my ? "အကောင့်ဝင်မည်" : "SIGN IN"}/> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
      {message ? <Text style={s.successText}>{message}</Text> : null}
      {!loading && authenticated ? <>
        <Text style={s.section}>{my ? "အသိပေးချက် ဆက်တင်များ" : "NOTIFICATION PREFERENCES"}</Text>
        <View style={s.card}>
          <ToggleRow icon="newspaper-outline" title={my ? "ထူးခြားသတင်းများ" : "Breaking News"} subtitle={my ? "အရေးကြီး MST သတင်းနှင့် ဆောင်းပါးများ" : "Important MST news and articles"} value={prefs.breakingNews} onChange={(v) => updatePref("breakingNews",v)} disabled={saving}/><View style={s.divider}/>
          <ToggleRow icon="football-outline" title={my ? "တိုက်ရိုက်ရလဒ်များ" : "Live Scores"} subtitle={my ? "ပွဲအစ၊ ဂိုးနှင့် ရလဒ်အသိပေးချက်" : "Match and score updates"} value={prefs.liveScores} onChange={(v) => updatePref("liveScores",v)} disabled={saving}/><View style={s.divider}/>
          <ToggleRow icon="swap-horizontal-outline" title={my ? "အပြောင်းအရွှေ့" : "Transfers"} subtitle={my ? "အတည်ပြု အပြောင်းအရွှေ့သတင်းများ" : "Transfer news and confirmed moves"} value={prefs.transfers} onChange={(v) => updatePref("transfers",v)} disabled={saving}/><View style={s.divider}/>
          <ToggleRow icon="trophy-outline" title={my ? "ရလဒ်ခန့်မှန်းချက်" : "Predictions"} subtitle={my ? "ခန့်မှန်းရလဒ်နှင့် ရမှတ်များ" : "Prediction results and points"} value={prefs.predictions} onChange={(v) => updatePref("predictions",v)} disabled={saving}/>
        </View>
        <View style={s.sectionRow}>
          <Text style={s.sectionInline}>{my ? "နောက်ဆုံးရ အသိပေးချက်များ" : "RECENT NOTIFICATIONS"}</Text>
          {notifications.length > 0 ? <Pressable hitSlop={8} onPress={markAllRead}><Text style={s.actionLink}>{my ? "အကုန်ဖတ်ပြီး" : "Read All"}</Text></Pressable> : null}
        </View>
        {notifications.length ? <View style={s.card}>{notifications.slice(0,30).map((item,index) => <Pressable key={`${item.id}-${index}`} style={[s.notificationRow,index !== Math.min(notifications.length,30)-1 && s.divider]} onPress={() => handleNotificationPress(item)}><View style={[s.unreadDot,item.read && {opacity:0}]}/><View style={{flex:1}}><Text style={s.notificationTitle}>{item.title}</Text>{item.body ? <Text style={s.notificationBody}>{item.body}</Text> : null}<Text style={s.notificationTime}>{timeLabel(item.createdAt)}</Text></View><Ionicons name="chevron-forward" size={16} color={C.muted2}/></Pressable>)}</View> : <Empty icon="notifications-outline" title={my ? "အသိပေးချက် မရှိသေးပါ" : "No notifications yet"} text={my ? "MST အသိပေးချက်အသစ်များ ဤနေရာတွင် ပေါ်လာပါမည်။" : "New MST alerts will appear here."}/>}
      </> : null}
    </ScrollView>
  </View>;
}

export function SettingsScreen({ goBack, openNotifications, openAccount, openFavorites, language = "my", setLanguage }) {
  const my = language === "my";
  const [auth,setAuth] = useState(null);
  const [cacheNotice,setCacheNotice] = useState("");
  const [appearance,setAppearance] = useState("Dark");

  useEffect(() => { getAuthStatus().then(setAuth).catch(() => setAuth({authenticated:false})); }, []);

  const handleClearCache = () => {
    setCacheNotice(my ? "Cache များကို အောင်မြင်စွာ ရှင်းလင်းပြီးပါပြီ" : "Cache cleared successfully");
    setTimeout(() => setCacheNotice(""), 3000);
  };

  return <View style={s.screen}>
    <Header title={my ? "ဆက်တင်များ" : "Settings"} subtitle="MST Score" goBack={goBack}/>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {cacheNotice ? <Text style={s.successText}>{cacheNotice}</Text> : null}

      <Text style={s.section}>{my ? "အကောင့်နှင့် အကြိုက်ဆုံး" : "ACCOUNT & FAVORITES"}</Text>
      <View style={s.card}>
        <Pressable onPress={openAccount} style={[s.settingsRow,s.divider]}>
          <View style={s.rowIcon}><Ionicons name="person-circle-outline" size={22} color={C.red}/></View>
          <View style={{flex:1}}><Text style={s.rowTitle}>{my ? "ကျွန်ုပ်၏ MST အကောင့်" : "My MST Account"}</Text><Text style={s.rowSub}>{auth?.authenticated ? (auth?.displayName || "Signed in") : (my ? "Favorites နှင့် Predictions များ ချိတ်ဆက်ရန် ဝင်ပါ" : "Sign in to sync favorites and predictions")}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={C.muted}/>
        </Pressable>
        <Pressable onPress={openFavorites} style={[s.settingsRow,s.divider]}>
          <View style={s.rowIcon}><Ionicons name="star-outline" size={21} color={C.gold}/></View>
          <View style={{flex:1}}><Text style={s.rowTitle}>{my ? "အကြိုက်ဆုံး အသင်းနှင့် ပြိုင်ပွဲများ" : "Favorites"}</Text><Text style={s.rowSub}>{my ? "အကြိုက်ဆုံးများကို စီမံရန်" : "Manage favorite teams and leagues"}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={C.muted}/>
        </Pressable>
        <Pressable onPress={openNotifications} style={s.settingsRow}>
          <View style={s.rowIcon}><Ionicons name="notifications-outline" size={21} color={C.text2}/></View>
          <View style={{flex:1}}><Text style={s.rowTitle}>{my ? "အသိပေးချက် ဆက်တင်များ" : "Notification Settings"}</Text><Text style={s.rowSub}>{my ? "ပွဲနှင့် သတင်းအသိပေးချက်များကို ရွေးချယ်ပါ" : "Manage MST alert preferences"}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={C.muted}/>
        </Pressable>
      </View>

      <Text style={s.section}>{my ? "အသုံးပြုမှု ဆက်တင်" : "PREFERENCES"}</Text>
      <View style={s.card}>
        <View style={[s.settingsRow,s.divider]}>
          <View style={s.rowIcon}><Ionicons name="language-outline" size={21} color={C.text2}/></View>
          <View style={{flex:1}}><Text style={s.rowTitle}>{my ? "ဘာသာစကား" : "Language"}</Text><Text style={s.rowSub}>{my ? "မြန်မာဘာသာ သို့မဟုတ် အင်္ဂလိပ်" : "Burmese or English"}</Text></View>
          <View style={s.langToggle}>
            <Pressable style={[s.langBtn,my&&s.langBtnOn]} onPress={()=>setLanguage?.("my")}><Text style={[s.langBtnText,my&&s.langBtnTextOn]}>မြန်မာ</Text></Pressable>
            <Pressable style={[s.langBtn,!my&&s.langBtnOn]} onPress={()=>setLanguage?.("en")}><Text style={[s.langBtnText,!my&&s.langBtnTextOn]}>EN</Text></Pressable>
          </View>
        </View>
        <Pressable onPress={() => setAppearance(p => p === "Dark" ? "Dark (OLED)" : "Dark")} style={[s.settingsRow,s.divider]}>
          <View style={s.rowIcon}><Ionicons name="moon-outline" size={21} color={C.text2}/></View>
          <View style={{flex:1}}><Text style={s.rowTitle}>{my ? "အသွင်အပြင် (Theme)" : "Appearance"}</Text><Text style={s.rowSub}>{my ? "Dark-first MST Premium Design" : "Dark-first MST Premium Theme"}</Text></View>
          <Text style={s.pillText}>{appearance}</Text>
        </Pressable>
        <Pressable onPress={handleClearCache} style={s.settingsRow}>
          <View style={s.rowIcon}><Ionicons name="trash-bin-outline" size={21} color={C.muted}/></View>
          <View style={{flex:1}}><Text style={s.rowTitle}>{my ? "Cache ရှင်းလင်းရန်" : "Clear Cache"}</Text><Text style={s.rowSub}>{my ? "ယာယီ သိမ်းဆည်းထားသော အချက်အလက်များ ဖျက်ရန်" : "Clear temporary local match cache"}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={C.muted}/>
        </Pressable>
      </View>

      <Text style={s.section}>{my ? "တရားဝင် ဝဘ်ဆိုက်နှင့် အချက်အလက်" : "OFFICIAL LINKS & LEGAL"}</Text>
      <View style={s.card}>
        <Pressable onPress={() => Linking.openURL(MST_SITE_URL)} style={[s.settingsRow,s.divider]}>
          <View style={s.rowIcon}><Ionicons name="globe-outline" size={21} color={C.text2}/></View>
          <View style={{flex:1}}><Text style={s.rowTitle}>myanmarsportstalk.com</Text><Text style={s.rowSub}>{my ? "တရားဝင် MST ဝဘ်ဆိုက်သို့ သွားရန်" : "Visit the official MST website"}</Text></View>
          <Ionicons name="open-outline" size={18} color={C.muted}/>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(`${MST_SITE_URL}/privacy`)} style={[s.settingsRow,s.divider]}>
          <View style={s.rowIcon}><Ionicons name="shield-checkmark-outline" size={21} color={C.text2}/></View>
          <View style={{flex:1}}><Text style={s.rowTitle}>{my ? "ကိုယ်ရေးကိုယ်တာ မူဝါဒ" : "Privacy Policy"}</Text><Text style={s.rowSub}>myanmarsportstalk.com/privacy</Text></View>
          <Ionicons name="open-outline" size={18} color={C.muted}/>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(`${MST_SITE_URL}/terms`)} style={s.settingsRow}>
          <View style={s.rowIcon}><Ionicons name="document-text-outline" size={21} color={C.text2}/></View>
          <View style={{flex:1}}><Text style={s.rowTitle}>{my ? "အသုံးပြုမှု စည်းမျဉ်းများ" : "Terms of Service"}</Text><Text style={s.rowSub}>myanmarsportstalk.com/terms</Text></View>
          <Ionicons name="open-outline" size={18} color={C.muted}/>
        </Pressable>
      </View>

      <Text style={s.section}>APP INFO</Text>
      <View style={s.card}>
        <View style={[s.settingsRow,s.divider]}>
          <View style={s.rowIcon}><Ionicons name="refresh-outline" size={21} color={C.green}/></View>
          <View style={{flex:1}}><Text style={s.rowTitle}>{my ? "တိုက်ရိုက်ရလဒ် အလိုအလျောက် Refresh" : "Live Score Auto-Refresh"}</Text><Text style={s.rowSub}>{my ? "ပွဲစဉ်များ စာမျက်နှာတွင် ၁၅ စက္ကန့်တိုင်း အလိုအလျောက် update ပြုလုပ်သည်" : "Silent 15-second background refresh while Matches is active"}</Text></View>
        </View>
        <View style={s.settingsRow}>
          <View style={s.rowIcon}><Ionicons name="phone-portrait-outline" size={21} color={C.red}/></View>
          <View style={{flex:1}}><Text style={s.rowTitle}>MST Score</Text><Text style={s.rowSub}>Version 1.5.1 · Android Build 11</Text></View>
        </View>
      </View>
    </ScrollView>
  </View>;
}

export function AboutScreen({ goBack }) {
  return <View style={s.screen}><Header title="About MST Score" subtitle="Myanmar Sports Talk" goBack={goBack}/><ScrollView contentContainerStyle={s.content}><View style={s.aboutHero}><Text style={s.mst}>MST</Text><Text style={s.aboutTitle}>MST SCORE · VERSION 1.5.1</Text><Text style={s.aboutText}>Myanmar Sports Talk's premier football application for live scores, in-depth match stats, verified news, transfer updates, score predictions, and qualified Tipsters.</Text></View><Pressable style={s.redButton} onPress={() => Linking.openURL(MST_SITE_URL)}><Text style={s.redButtonText}>OPEN MYANMARSPORTSTALK.COM</Text></Pressable></ScrollView></View>;
}

const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},content:{paddingHorizontal:16,paddingTop:12,paddingBottom:40},
  header:{minHeight:66,paddingHorizontal:16,flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:C.border2},title:{fontSize:17,fontWeight:"800",color:C.text},subtitle:{fontSize:10.5,color:C.muted,marginTop:2},
  section:{fontSize:11,fontWeight:"900",color:C.text2,marginTop:13,marginBottom:8},sectionRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:13,marginBottom:8},sectionInline:{fontSize:11,fontWeight:"900",color:C.text2},actionLink:{fontSize:11,fontWeight:"800",color:C.red},card:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,overflow:"hidden",marginBottom:8},divider:{borderBottomWidth:1,borderBottomColor:C.border2},
  row:{minHeight:64,paddingHorizontal:12,paddingVertical:9,flexDirection:"row",alignItems:"center",gap:10},settingsRow:{minHeight:62,paddingHorizontal:12,paddingVertical:9,flexDirection:"row",alignItems:"center",gap:10},rowIcon:{width:35,height:35,borderRadius:9,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},rowTitle:{fontSize:13,fontWeight:"700",color:C.text2},rowSub:{fontSize:9.5,color:C.muted,marginTop:3,lineHeight:13},
  toggle:{width:42,height:24,borderRadius:12,backgroundColor:C.border,justifyContent:"center",paddingHorizontal:3},toggleOn:{backgroundColor:C.red},toggleKnob:{width:18,height:18,borderRadius:9,backgroundColor:C.text},toggleKnobOn:{alignSelf:"flex-end"},
  loading:{minHeight:130,alignItems:"center",justifyContent:"center",gap:8},empty:{minHeight:135,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,padding:18,alignItems:"center",justifyContent:"center",gap:7,marginBottom:10},emptyTitle:{fontSize:14,fontWeight:"800",color:C.text,textAlign:"center"},emptyText:{fontSize:10.5,color:C.muted,textAlign:"center",lineHeight:15},
  redButton:{minHeight:43,backgroundColor:C.red,borderRadius:8,paddingHorizontal:16,paddingVertical:11,alignItems:"center",justifyContent:"center",marginTop:8},redButtonText:{fontSize:10.5,fontWeight:"900",color:C.text},error:{fontSize:10.5,color:C.red,backgroundColor:C.redSoft,padding:9,borderRadius:7,textAlign:"center",marginBottom:8},successText:{fontSize:10.5,color:C.green,backgroundColor:"rgba(49,198,116,0.12)",padding:9,borderRadius:7,textAlign:"center",marginBottom:8},
  notificationRow:{minHeight:70,paddingHorizontal:12,paddingVertical:10,flexDirection:"row",alignItems:"center",gap:9},unreadDot:{width:7,height:7,borderRadius:4,backgroundColor:C.red},notificationTitle:{fontSize:12.5,fontWeight:"800",color:C.text2},notificationBody:{fontSize:10.5,color:C.muted,lineHeight:14,marginTop:4},notificationTime:{fontSize:9,color:C.muted2,marginTop:5},
  aboutHero:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:14,padding:22,alignItems:"center"},mst:{fontSize:54,lineHeight:58,fontWeight:"900",fontStyle:"italic",letterSpacing:-3,color:C.red},aboutTitle:{fontSize:12,fontWeight:"900",letterSpacing:1,color:C.text,marginTop:2},aboutText:{fontSize:11,color:C.muted,textAlign:"center",lineHeight:17,marginTop:13},
  langToggle:{flexDirection:"row",backgroundColor:C.bg2,borderRadius:8,padding:2},langBtn:{minWidth:44,height:28,borderRadius:6,alignItems:"center",justifyContent:"center",paddingHorizontal:6},langBtnOn:{backgroundColor:C.red},langBtnText:{fontSize:9.5,fontWeight:"800",color:C.muted},langBtnTextOn:{color:C.text},pillText:{fontSize:10.5,fontWeight:"800",color:C.muted,backgroundColor:C.card2,paddingHorizontal:8,paddingVertical:4,borderRadius:6}
});