import React, { useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "./final/HomeScreen";
import { AccountScreen, FavoritesScreen, PredictionScreen } from "./phase2/Phase2Screens";
import ContentScreen from "./phase3/ContentScreens";
import { AboutScreen, NotificationsScreen, SettingsScreen } from "./phase4/Phase4Screens";
import QuickScoresScreen from "./final/QuickScoresScreen";
import SearchScreen from "./final/SearchScreen";
import { NativeArticleScreen, NativeEntityScreen, NativeMatchScreen } from "./final/NativeDetailScreens";

const SITE = "https://myanmarsportstalk.com";
const YOUTUBE = "https://www.youtube.com/@MyanmarSportsTalk";
const FACEBOOK = "https://www.facebook.com/myanmar.sports.talk";
const TIKTOK = "https://www.tiktok.com/search?q=Myanmar%20Sports%20Talk";

const C = { bg:"#080A0C", bg2:"#0B0E10", card:"#111416", border:"#24292D", border2:"#1D2226", red:"#F3262D", text:"#FFFFFF", text2:"#D0D2D4", muted:"#92979B" };
const NAV = [
  ["home", "Home", "home-outline", "home"],
  ["scores", "Scores", "calendar-outline", "calendar"],
  ["favorites", "Favorites", "star-outline", "star"],
  ["prediction", "Prediction", "football-outline", "football"],
  ["more", "More", "ellipsis-horizontal", "ellipsis-horizontal"],
];

function BottomNav({ active, onChange }) {
  return <View style={s.bottomNav}>{NAV.map(([id,label,icon,activeIcon]) => {
    const selected = active === id;
    return <Pressable key={id} hitSlop={4} style={s.navItem} onPress={() => onChange(id)}>
      <Ionicons name={selected ? activeIcon : icon} size={25} color={selected ? C.red : C.muted}/>
      <Text style={[s.navText, selected && s.navTextActive]}>{label}</Text>
    </Pressable>;
  })}</View>;
}

function MoreScreen({ navigate, openAccount, openNotifications }) {
  const rows = [
    ["person-circle-outline", "My Account", "Profile, login and MST account", openAccount],
    ["star-outline", "Favorites", "Teams, competitions and players", () => navigate("favorites")],
    ["football-outline", "Predictions", "My picks, points and leaderboard", () => navigate("prediction")],
    ["notifications-outline", "Notifications", "News, live scores, transfers and predictions", openNotifications],
    ["settings-outline", "Settings", "App and account settings", () => navigate("settings")],
    ["information-circle-outline", "About MST", "MST Score mobile app", () => navigate("about")],
  ];
  const socials = [
    ["logo-youtube", "YouTube", "Latest MST videos", YOUTUBE, C.red],
    ["logo-facebook", "Facebook", "Myanmar Sports Talk page", FACEBOOK, "#4C8BF5"],
    ["logo-tiktok", "TikTok", "Find Myanmar Sports Talk", TIKTOK, C.text],
    ["globe-outline", "Website", "myanmarsportstalk.com", SITE, C.text2],
  ];
  return <View style={s.screen}>
    <View style={s.header}><View><Text style={s.title}>More</Text><Text style={s.subtitle}>MST Score</Text></View><Pressable hitSlop={8} onPress={openAccount}><Ionicons name="person-circle-outline" size={31} color={C.text}/></Pressable></View>
    <ScrollView contentContainerStyle={s.content}>
      <Pressable style={s.accountHero} onPress={openAccount}><View style={s.accountIcon}><Text style={s.mst}>MST</Text></View><View style={{flex:1}}><Text style={s.accountTitle}>My MST Account</Text><Text style={s.accountText}>Use the same account as myanmarsportstalk.com.</Text></View><Ionicons name="chevron-forward" size={20} color={C.muted}/></Pressable>
      <Text style={s.section}>ACCOUNT & APP</Text>
      <View style={s.card}>{rows.map(([icon,title,subtitle,action],index) => <Pressable key={title} style={[s.row,index !== rows.length - 1 && s.rowBorder]} onPress={action}><Ionicons name={icon} size={22} color={title === "My Account" ? C.red : C.text2}/><View style={{flex:1}}><Text style={s.rowTitle}>{title}</Text><Text style={s.rowSub}>{subtitle}</Text></View><Ionicons name="chevron-forward" size={18} color={C.muted}/></Pressable>)}</View>
      <Text style={s.section}>FOLLOW MST</Text>
      <View style={s.card}>{socials.map(([icon,title,subtitle,url,color],index) => <Pressable key={title} style={[s.row,index !== socials.length - 1 && s.rowBorder]} onPress={() => Linking.openURL(url).catch(() => {})}><Ionicons name={icon} size={22} color={color}/><View style={{flex:1}}><Text style={s.rowTitle}>{title}</Text><Text style={s.rowSub}>{subtitle}</Text></View><Ionicons name="open-outline" size={18} color={C.muted}/></Pressable>)}</View>
    </ScrollView>
  </View>;
}

export default function AppFinalShell() {
  const [mode,setMode] = useState("home");
  const [selected,setSelected] = useState(null);
  const [returnMode,setReturnMode] = useState("home");

  const rememberOrigin = () => mode || "home";
  const goHome = () => { setSelected(null); setReturnMode("home"); setMode("home"); };
  const openMatch = (match,origin) => { if (!match) return; setReturnMode(origin || rememberOrigin()); setSelected(match); setMode("match"); };
  const openEntity = (type,entity,origin) => { if (!entity?.id) return; setReturnMode(origin || rememberOrigin()); setSelected({type,entity}); setMode("entity"); };
  const openArticle = (article) => { if (!article) return; const origin = rememberOrigin(); setReturnMode(origin.startsWith("content-") ? origin : "content-news"); setSelected(article); setMode("article"); };
  const openAccount = (origin) => { setReturnMode(origin || rememberOrigin()); setMode("account"); };
  const openNotifications = (origin) => { setReturnMode(origin || rememberOrigin()); setMode("notifications"); };
  const openSearch = (origin) => { setReturnMode(origin || rememberOrigin()); setMode("search"); };
  const goReturn = () => setMode(returnMode || "home");
  const openTopTab = (tab) => setMode(tab === "NEWS" ? "content-news" : tab === "VIDEOS" ? "content-videos" : tab === "TRANSFERS" ? "content-transfers" : "home");

  const isContent = mode.startsWith("content-");
  const contentTab = mode === "content-videos" ? "VIDEOS" : mode === "content-transfers" ? "TRANSFERS" : "NEWS";
  const isSubpage = ["account","notifications","settings","about","match","entity","article","search"].includes(mode);
  const androidInset = Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 0;

  return <View style={s.root}>
    <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
    <View style={[s.body, Platform.OS === "android" ? {paddingTop:androidInset} : null]}>
      {mode === "home" ? <HomeScreen onTab={openTopTab} openMatch={(x) => openMatch(x,"home")} openEntity={(type,x) => openEntity(type,x,"home")} openScores={() => setMode("scores")} openNotifications={() => openNotifications("home")} openSearch={() => openSearch("home")}/> : null}
      {isContent ? <ContentScreen initialTab={contentTab} onLiveScores={goHome} onOpenArticle={openArticle} onNotifications={() => openNotifications(mode)} onSearch={() => openSearch(mode)}/> : null}
      {mode === "scores" ? <QuickScoresScreen openMatch={(x) => openMatch(x,"scores")}/> : null}
      {mode === "favorites" ? <FavoritesScreen openLeague={(x) => openEntity("competition",x,"favorites")} openTeam={(x) => openEntity("team",x,"favorites")} openPlayer={(x) => openEntity("player",x,"favorites")} openAccount={() => openAccount("favorites")}/> : null}
      {mode === "prediction" ? <PredictionScreen openMatch={(x) => openMatch(x,"prediction")} openAccount={() => openAccount("prediction")}/> : null}
      {mode === "more" ? <MoreScreen navigate={setMode} openAccount={() => openAccount("more")} openNotifications={() => openNotifications("more")}/> : null}
      {mode === "account" ? <AccountScreen goBack={goReturn}/> : null}
      {mode === "notifications" ? <NotificationsScreen goBack={goReturn} openAccount={() => openAccount("notifications")}/> : null}
      {mode === "settings" ? <SettingsScreen goBack={() => setMode("more")} openNotifications={() => openNotifications("settings")} openAccount={() => openAccount("settings")}/> : null}
      {mode === "about" ? <AboutScreen goBack={() => setMode("more")}/> : null}
      {mode === "search" ? <SearchScreen goBack={goReturn} openMatch={(x) => openMatch(x,"search")} openEntity={(type,x) => openEntity(type,x,"search")}/> : null}
      {mode === "match" ? <NativeMatchScreen match={selected} goBack={goReturn}/> : null}
      {mode === "entity" ? <NativeEntityScreen type={selected?.type} entity={selected?.entity} goBack={goReturn}/> : null}
      {mode === "article" ? <NativeArticleScreen article={selected} goBack={goReturn}/> : null}
    </View>
    {!isSubpage ? <BottomNav active={isContent ? "home" : mode} onChange={(tab) => tab === "home" ? goHome() : setMode(tab)}/> : null}
  </View>;
}

const s = StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},body:{flex:1},screen:{flex:1,backgroundColor:C.bg},
  bottomNav:{height:68,backgroundColor:C.bg2,borderTopWidth:1,borderTopColor:C.border,flexDirection:"row",paddingTop:6,paddingBottom:5},navItem:{flex:1,alignItems:"center",justifyContent:"center",gap:3},navText:{fontSize:10,color:C.muted},navTextActive:{color:C.red},
  header:{minHeight:70,paddingHorizontal:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:C.border2},title:{color:C.text,fontSize:22,fontWeight:"800"},subtitle:{color:C.muted,fontSize:11,marginTop:3},content:{padding:16,paddingBottom:36},
  accountHero:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:13,padding:14,flexDirection:"row",alignItems:"center",gap:12},accountIcon:{width:54,height:54,borderRadius:14,backgroundColor:"rgba(243,38,45,0.14)",alignItems:"center",justifyContent:"center"},mst:{color:C.red,fontSize:20,fontStyle:"italic",fontWeight:"900"},accountTitle:{color:C.text,fontSize:15,fontWeight:"800"},accountText:{color:C.muted,fontSize:10.5,lineHeight:15,marginTop:4},
  section:{color:C.text2,fontSize:12,fontWeight:"800",marginTop:18,marginBottom:9},card:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,overflow:"hidden"},row:{minHeight:62,paddingHorizontal:13,paddingVertical:9,flexDirection:"row",alignItems:"center",gap:11},rowBorder:{borderBottomWidth:1,borderBottomColor:C.border2},rowTitle:{color:C.text2,fontSize:13,fontWeight:"700"},rowSub:{color:C.muted,fontSize:9.5,marginTop:3},
});