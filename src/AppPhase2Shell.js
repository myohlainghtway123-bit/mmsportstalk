import React, { useState } from "react";
import { Linking, Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppFull from "./AppFull";
import { AccountScreen, FavoritesScreen, PredictionScreen } from "./phase2/Phase2Screens";
import ContentScreen from "./phase3/ContentScreens";

const SITE = "https://myanmarsportstalk.com";
const C = {
  bg: "#080A0C",
  bg2: "#0B0E10",
  card: "#111416",
  border: "#24292D",
  border2: "#1D2226",
  red: "#F3262D",
  text: "#FFFFFF",
  text2: "#D0D2D4",
  muted: "#92979B",
};

const NAV = [
  ["home", "Home", "home-outline", "home"],
  ["scores", "Scores", "calendar-outline", "calendar"],
  ["favorites", "Favorites", "star-outline", "star"],
  ["prediction", "Prediction", "football-outline", "football"],
  ["more", "More", "ellipsis-horizontal", "ellipsis-horizontal"],
];

function PhaseBottomNav({ active, onChange }) {
  return (
    <View style={s.bottomNav}>
      {NAV.map(([id, label, icon, activeIcon]) => {
        const selected = active === id;
        return (
          <Pressable key={id} style={s.navItem} onPress={() => onChange(id)}>
            <Ionicons name={selected ? activeIcon : icon} size={25} color={selected ? C.red : C.muted} />
            <Text style={[s.navText, selected && s.navTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MorePhase2({ openAccount }) {
  const rows = [
    ["person-circle-outline", "My Account", "Profile, MST login and account settings", openAccount],
    ["star-outline", "Favorites", "Teams, competitions and players synced with MST", null],
    ["football-outline", "Predictions", "My picks, points and leaderboard", null],
    ["notifications-outline", "Notifications", "App notification controls are coming in Phase 4", null],
    ["globe-outline", "Myanmar Sports Talk Website", "Open myanmarsportstalk.com", () => Linking.openURL(SITE)],
  ];

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>More</Text>
          <Text style={s.subtitle}>MST account & app</Text>
        </View>
        <Ionicons name="person-circle-outline" size={31} color={C.text} />
      </View>

      <View style={s.content}>
        <Pressable style={s.accountHero} onPress={openAccount}>
          <View style={s.accountIcon}><Text style={s.mst}>MST</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.accountTitle}>My MST Account</Text>
            <Text style={s.accountText}>Sign in with the same account you use on the website.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.muted} />
        </Pressable>

        <Text style={s.section}>ACCOUNT & APP</Text>
        <View style={s.card}>
          {rows.map(([icon, title, subtitle, action], index) => (
            <Pressable
              key={title}
              style={[s.row, index !== rows.length - 1 && s.rowBorder]}
              onPress={action || undefined}
            >
              <Ionicons name={icon} size={22} color={title === "My Account" ? C.red : C.text2} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{title}</Text>
                <Text style={s.rowSub}>{subtitle}</Text>
              </View>
              {action ? <Ionicons name="chevron-forward" size={18} color={C.muted} /> : null}
            </Pressable>
          ))}
        </View>

        <Text style={s.helper}>Football discovery, team, player and competition pages remain available from Home and Scores. The user and content systems are layered on top without disturbing the working football build.</Text>
      </View>
    </View>
  );
}

export default function AppPhase2Shell() {
  const [mode, setMode] = useState(null);
  const [baseKey, setBaseKey] = useState(0);

  const goBase = () => {
    setMode(null);
    setBaseKey((value) => value + 1);
  };

  const openWebsiteEntity = (type, entity) => {
    if (!entity?.id) return;
    const route = type === "competition" ? "competition" : type;
    Linking.openURL(`${SITE}/${route}/${encodeURIComponent(entity.id)}`).catch(() => {});
  };

  if (!mode) {
    return (
      <View style={s.root}>
        <AppFull key={baseKey} />
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <View pointerEvents="box-none" style={s.topInterceptBar}>
            <View style={s.topPassThrough} pointerEvents="none" />
            <Pressable accessibilityLabel="News" style={s.topIntercept} onPress={() => setMode("content-news")} />
            <Pressable accessibilityLabel="Videos" style={s.topIntercept} onPress={() => setMode("content-videos")} />
            <Pressable accessibilityLabel="Transfers" style={s.topIntercept} onPress={() => setMode("content-transfers")} />
          </View>
          <View pointerEvents="box-none" style={s.interceptBar}>
            <View style={s.passThrough} pointerEvents="none" />
            <View style={s.passThrough} pointerEvents="none" />
            <Pressable accessibilityLabel="Favorites" style={s.intercept} onPress={() => setMode("favorites")} />
            <Pressable accessibilityLabel="Prediction" style={s.intercept} onPress={() => setMode("prediction")} />
            <Pressable accessibilityLabel="More" style={s.intercept} onPress={() => setMode("more")} />
          </View>
        </View>
      </View>
    );
  }

  const openAccount = () => setMode("account");
  const contentTab = mode === "content-videos" ? "VIDEOS" : mode === "content-transfers" ? "TRANSFERS" : "NEWS";
  const isContent = mode.startsWith("content-");

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={{ flex: 1 }}>
        {isContent ? (
          <ContentScreen
            initialTab={contentTab}
            onLiveScores={goBase}
          />
        ) : null}
        {mode === "favorites" ? (
          <FavoritesScreen
            openLeague={(entity) => openWebsiteEntity("competition", entity)}
            openTeam={(entity) => openWebsiteEntity("team", entity)}
            openPlayer={(entity) => openWebsiteEntity("player", entity)}
            openAccount={openAccount}
          />
        ) : null}
        {mode === "prediction" ? (
          <PredictionScreen
            openMatch={(match) => openWebsiteEntity("match", match)}
            openAccount={openAccount}
          />
        ) : null}
        {mode === "more" ? <MorePhase2 openAccount={openAccount} /> : null}
        {mode === "account" ? <AccountScreen goBack={() => setMode("more")} /> : null}
      </View>
      {mode !== "account" ? (
        <PhaseBottomNav
          active={isContent ? "home" : mode}
          onChange={(tab) => {
            if (tab === "home" || tab === "scores") goBase();
            else setMode(tab);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  screen: { flex: 1, backgroundColor: C.bg },
  topInterceptBar: {
    position: "absolute",
    left: 14,
    right: 14,
    top: Platform.OS === "android" ? 92 : 78,
    height: 43,
    flexDirection: "row",
  },
  topPassThrough: { flex: 1 },
  topIntercept: { flex: 1 },
  interceptBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 76,
    flexDirection: "row",
  },
  passThrough: { flex: 1 },
  intercept: { flex: 1 },
  bottomNav: {
    height: 68,
    backgroundColor: C.bg2,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: "row",
    paddingTop: 6,
    paddingBottom: 5,
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  navText: { fontSize: 10, color: C.muted },
  navTextActive: { color: C.red },
  header: {
    minHeight: 70,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: C.border2,
  },
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: C.muted, fontSize: 11, marginTop: 3 },
  content: { padding: 16 },
  accountHero: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border2,
    borderRadius: 13,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  accountIcon: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "rgba(243,38,45,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  mst: { color: C.red, fontSize: 20, fontStyle: "italic", fontWeight: "900" },
  accountTitle: { color: C.text, fontSize: 15, fontWeight: "800" },
  accountText: { color: C.muted, fontSize: 10.5, lineHeight: 15, marginTop: 4 },
  section: { color: C.text2, fontSize: 12, fontWeight: "800", marginTop: 18, marginBottom: 9 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, borderRadius: 11, overflow: "hidden" },
  row: { minHeight: 62, paddingHorizontal: 13, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 11 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border2 },
  rowTitle: { color: C.text2, fontSize: 13, fontWeight: "700" },
  rowSub: { color: C.muted, fontSize: 9.5, marginTop: 3 },
  helper: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 16, textAlign: "center" },
});
