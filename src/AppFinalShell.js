import React, { useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppFull from "./AppFull";
import { AccountScreen, FavoritesScreen, PredictionScreen } from "./phase2/Phase2Screens";
import ContentScreen from "./phase3/ContentScreens";
import { AboutScreen, NotificationsScreen, SettingsScreen } from "./phase4/Phase4Screens";
import QuickScoresScreen from "./final/QuickScoresScreen";
import { NativeArticleScreen, NativeEntityScreen, NativeMatchScreen } from "./final/NativeDetailScreens";

const SITE = "https://myanmarsportstalk.com";
const YOUTUBE = "https://www.youtube.com/@MyanmarSportsTalk";

const C = {
  bg: "#080A0C", bg2: "#0B0E10", card: "#111416", border: "#24292D", border2: "#1D2226",
  red: "#F3262D", text: "#FFFFFF", text2: "#D0D2D4", muted: "#92979B",
};

const NAV = [
  ["home", "Home", "home-outline", "home"],
  ["scores", "Scores", "calendar-outline", "calendar"],
  ["favorites", "Favorites", "star-outline", "star"],
  ["prediction", "Prediction", "football-outline", "football"],
  ["more", "More", "ellipsis-horizontal", "ellipsis-horizontal"],
];

function BottomNav({ active, onChange }) {
  return <View style={s.bottomNav}>{NAV.map(([id, label, icon, activeIcon]) => {
    const selected = active === id;
    return <Pressable key={id} hitSlop={4} style={s.navItem} onPress={() => onChange(id)}>
      <Ionicons name={selected ? activeIcon : icon} size={25} color={selected ? C.red : C.muted} />
      <Text style={[s.navText, selected && s.navTextActive]}>{label}</Text>
    </Pressable>;
  })}</View>;
}

function MoreScreen({ navigate }) {
  const rows = [
    ["person-circle-outline", "My Account", "Profile, login and MST account", () => navigate("account")],
    ["star-outline", "Favorites", "Teams, competitions and players", () => navigate("favorites")],
    ["football-outline", "Predictions", "My picks, points and leaderboard", () => navigate("prediction")],
    ["notifications-outline", "Notifications", "News, live scores, transfers and predictions", () => navigate("notifications")],
    ["settings-outline", "Settings", "App and account settings", () => navigate("settings")],
    ["information-circle-outline", "About MST", "Myanmar Sports Talk mobile app", () => navigate("about")],
  ];

  return <View style={s.screen}>
    <View style={s.header}><View><Text style={s.title}>More</Text><Text style={s.subtitle}>Myanmar Sports Talk</Text></View><Ionicons name="person-circle-outline" size={31} color={C.text}/></View>
    <ScrollView contentContainerStyle={s.content}>
      <Pressable style={s.accountHero} onPress={() => navigate("account")}>
        <View style={s.accountIcon}><Text style={s.mst}>MST</Text></View>
        <View style={{ flex: 1 }}><Text style={s.accountTitle}>My MST Account</Text><Text style={s.accountText}>Use the same account as myanmarsportstalk.com.</Text></View>
        <Ionicons name="chevron-forward" size={20} color={C.muted}/>
      </Pressable>

      <Text style={s.section}>ACCOUNT & APP</Text>
      <View style={s.card}>{rows.map(([icon, title, subtitle, action], index) => <Pressable key={title} style={[s.row, index !== rows.length - 1 && s.rowBorder]} onPress={action}>
        <Ionicons name={icon} size={22} color={title === "My Account" ? C.red : C.text2}/>
        <View style={{ flex: 1 }}><Text style={s.rowTitle}>{title}</Text><Text style={s.rowSub}>{subtitle}</Text></View>
        <Ionicons name="chevron-forward" size={18} color={C.muted}/>
      </Pressable>)}</View>

      <Text style={s.section}>MST ONLINE</Text>
      <View style={s.card}>
        <Pressable style={[s.row, s.rowBorder]} onPress={() => Linking.openURL(YOUTUBE).catch(() => {})}><Ionicons name="logo-youtube" size={22} color={C.red}/><View style={{ flex: 1 }}><Text style={s.rowTitle}>MST YouTube</Text><Text style={s.rowSub}>Watch Myanmar Sports Talk videos</Text></View><Ionicons name="open-outline" size={18} color={C.muted}/></Pressable>
        <Pressable style={s.row} onPress={() => Linking.openURL(SITE).catch(() => {})}><Ionicons name="globe-outline" size={22} color={C.text2}/><View style={{ flex: 1 }}><Text style={s.rowTitle}>MST Website</Text><Text style={s.rowSub}>myanmarsportstalk.com</Text></View><Ionicons name="open-outline" size={18} color={C.muted}/></Pressable>
      </View>
    </ScrollView>
  </View>;
}

export default function AppFinalShell() {
  const [mode, setMode] = useState(null);
  const [baseKey, setBaseKey] = useState(0);
  const [selected, setSelected] = useState(null);

  const goBase = () => { setSelected(null); setMode(null); setBaseKey((value) => value + 1); };
  const openMatch = (match) => { if (!match) return; setSelected(match); setMode("match"); };
  const openEntity = (type, entity) => { if (!entity?.id) return; setSelected({ type, entity }); setMode("entity"); };
  const openArticle = (article) => { if (!article) return; setSelected(article); setMode("article"); };

  if (!mode) {
    return <View style={s.root}>
      <AppFull key={baseKey}/>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View pointerEvents="box-none" style={s.topInterceptBar}>
          <View style={s.topPassThrough} pointerEvents="none"/>
          <Pressable accessibilityLabel="News" style={s.topIntercept} onPress={() => setMode("content-news")}/>
          <Pressable accessibilityLabel="Videos" style={s.topIntercept} onPress={() => setMode("content-videos")}/>
          <Pressable accessibilityLabel="Transfers" style={s.topIntercept} onPress={() => setMode("content-transfers")}/>
        </View>
        <View pointerEvents="box-none" style={s.interceptBar}>
          <View style={s.passThrough} pointerEvents="none"/>
          <Pressable accessibilityLabel="Scores" style={s.intercept} onPress={() => setMode("scores")}/>
          <Pressable accessibilityLabel="Favorites" style={s.intercept} onPress={() => setMode("favorites")}/>
          <Pressable accessibilityLabel="Prediction" style={s.intercept} onPress={() => setMode("prediction")}/>
          <Pressable accessibilityLabel="More" style={s.intercept} onPress={() => setMode("more")}/>
        </View>
      </View>
    </View>;
  }

  const contentTab = mode === "content-videos" ? "VIDEOS" : mode === "content-transfers" ? "TRANSFERS" : "NEWS";
  const isContent = mode.startsWith("content-");
  const isSubpage = ["account", "notifications", "settings", "about", "match", "entity", "article"].includes(mode);
  const androidInset = Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 0;
  const openAccount = () => setMode("account");

  return <View style={s.root}>
    <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
    <View style={[s.body, !isContent && Platform.OS === "android" ? { paddingTop: androidInset } : null]}>
      {isContent ? <ContentScreen initialTab={contentTab} onLiveScores={goBase} onOpenArticle={openArticle} onNotifications={() => setMode("notifications")}/> : null}
      {mode === "scores" ? <QuickScoresScreen openMatch={openMatch}/> : null}
      {mode === "favorites" ? <FavoritesScreen openLeague={(x) => openEntity("competition", x)} openTeam={(x) => openEntity("team", x)} openPlayer={(x) => openEntity("player", x)} openAccount={openAccount}/> : null}
      {mode === "prediction" ? <PredictionScreen openMatch={openMatch} openAccount={openAccount}/> : null}
      {mode === "more" ? <MoreScreen navigate={setMode}/> : null}
      {mode === "account" ? <AccountScreen goBack={() => setMode("more")}/> : null}
      {mode === "notifications" ? <NotificationsScreen goBack={() => setMode("more")} openAccount={openAccount}/> : null}
      {mode === "settings" ? <SettingsScreen goBack={() => setMode("more")} openNotifications={() => setMode("notifications")} openAccount={openAccount}/> : null}
      {mode === "about" ? <AboutScreen goBack={() => setMode("more")}/> : null}
      {mode === "match" ? <NativeMatchScreen match={selected} goBack={() => setMode("scores")}/> : null}
      {mode === "entity" ? <NativeEntityScreen type={selected?.type} entity={selected?.entity} goBack={() => setMode("favorites")}/> : null}
      {mode === "article" ? <NativeArticleScreen article={selected} goBack={() => setMode("content-news")}/> : null}
    </View>
    {!isSubpage ? <BottomNav active={isContent ? "home" : mode} onChange={(tab) => { if (tab === "home") goBase(); else setMode(tab); }}/> : null}
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1 },
  screen: { flex: 1, backgroundColor: C.bg },
  topInterceptBar: { position: "absolute", left: 14, right: 14, top: Platform.OS === "android" ? 92 : 78, height: 43, flexDirection: "row" },
  topPassThrough: { flex: 1 }, topIntercept: { flex: 1 },
  interceptBar: { position: "absolute", left: 0, right: 0, bottom: 0, height: 76, flexDirection: "row" },
  passThrough: { flex: 1 }, intercept: { flex: 1 },
  bottomNav: { height: Platform.OS === "ios" ? 73 : 68, backgroundColor: C.bg2, borderTopWidth: 1, borderTopColor: C.border, flexDirection: "row", paddingTop: 6, paddingBottom: Platform.OS === "ios" ? 8 : 5 },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }, navText: { fontSize: 10, color: C.muted }, navTextActive: { color: C.red },
  header: { minHeight: 70, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: C.border2 },
  title: { color: C.text, fontSize: 22, fontWeight: "800" }, subtitle: { color: C.muted, fontSize: 11, marginTop: 3 }, content: { padding: 16, paddingBottom: 36 },
  accountHero: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, borderRadius: 13, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  accountIcon: { width: 54, height: 54, borderRadius: 14, backgroundColor: "rgba(243,38,45,0.14)", alignItems: "center", justifyContent: "center" }, mst: { color: C.red, fontSize: 20, fontStyle: "italic", fontWeight: "900" }, accountTitle: { color: C.text, fontSize: 15, fontWeight: "800" }, accountText: { color: C.muted, fontSize: 10.5, lineHeight: 15, marginTop: 4 },
  section: { color: C.text2, fontSize: 12, fontWeight: "800", marginTop: 18, marginBottom: 9 }, card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, borderRadius: 11, overflow: "hidden" },
  row: { minHeight: 62, paddingHorizontal: 13, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 11 }, rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border2 }, rowTitle: { color: C.text2, fontSize: 13, fontWeight: "700" }, rowSub: { color: C.muted, fontSize: 9.5, marginTop: 3 },
});
