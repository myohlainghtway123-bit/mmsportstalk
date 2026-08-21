import React, { useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "./final/HomeScreen";

const SITE = "https://myanmarsportstalk.com";
const YOUTUBE = "https://www.youtube.com/@MyanmarSportsTalk";
const FACEBOOK = "https://www.facebook.com/myanmar.sports.talk";
const TIKTOK = "https://www.tiktok.com/search?q=Myanmar%20Sports%20Talk";

const C = { bg:"#080A0C", bg2:"#0B0E10", card:"#111416", border:"#24292D", border2:"#1D2226", red:"#F3262D", text:"#FFFFFF", text2:"#D0D2D4", muted:"#92979B" };
const NAV = [
  ["home", "Matches", "football-outline", "football"],
  ["content-news", "News", "newspaper-outline", "newspaper"],
  ["favorites", "Favorites", "star-outline", "star"],
  ["prediction", "Predict", "trophy-outline", "trophy"],
  ["more", "More", "ellipsis-horizontal", "ellipsis-horizontal"],
];

function LazyContent(props) { const Screen = require("./phase3/ContentScreens").default; return <Screen {...props}/>; }
function LazyScores(props) { const Screen = require("./final/QuickScoresScreen").default; return <Screen {...props}/>; }
function LazyFavorites(props) { const Screen = require("./phase2/Phase2Screens").FavoritesScreen; return <Screen {...props}/>; }
function LazyPrediction(props) { const Screen = require("./final/PredictionScreenV2").default; return <Screen {...props}/>; }
function LazyAccount(props) { const Screen = require("./phase2/Phase2Screens").AccountScreen; return <Screen {...props}/>; }
function LazyNotifications(props) { const Screen = require("./phase4/Phase4Screens").NotificationsScreen; return <Screen {...props}/>; }
function LazySettings(props) { const Screen = require("./phase4/Phase4Screens").SettingsScreen; return <Screen {...props}/>; }
function LazyAbout(props) { const Screen = require("./phase4/Phase4Screens").AboutScreen; return <Screen {...props}/>; }
function LazySearch(props) { const Screen = require("./final/SearchScreen").default; return <Screen {...props}/>; }
function LazyMatch(props) { const Screen = require("./final/NativeMatchScreenV2").default; return <Screen {...props}/>; }
function LazyEntity(props) { const Screen = require("./final/NativeEntityScreenV2").default; return <Screen {...props}/>; }
function LazyArticle(props) { const Screen = require("./final/NativeDetailScreens").NativeArticleScreen; return <Screen {...props}/>; }

function BottomNav({ active, onChange }) {
  return <View style={s.bottomNav}>{NAV.map(([id,label,icon,activeIcon]) => {
    const selected = active === id;
    return <Pressable key={id} hitSlop={5} style={s.navItem} onPress={() => onChange(id)} android_ripple={{color:"rgba(255,255,255,.035)",borderless:true}}>
      <Ionicons name={selected ? activeIcon : icon} size={23} color={selected ? C.red : C.muted}/>
      <Text style={[s.navText, selected && s.navTextActive]}>{label}</Text>
    </Pressable>;
  })}</View>;
}

function MoreScreen({ navigate, openAccount, openNotifications }) {
  const rows = [
    ["person-circle-outline", "My Account", "Profile, login and MST account", openAccount],
    ["star-outline", "Favorites", "Teams, competitions and players", () => navigate("favorites")],
    ["trophy-outline", "Predictions", "Score predictions, points and ranking", () => navigate("prediction")],
    ["notifications-outline", "Notifications", "News, live scores, transfers and predictions", openNotifications],
    ["settings-outline", "Settings", "App and account settings", () => navigate("settings")],
    ["information-circle-outline", "About MST Score", "Myanmar Sports Talk football app", () => navigate("about")],
  ];
  const socials = [
    ["logo-youtube", "YouTube", "Latest MST videos", YOUTUBE, C.red],
    ["logo-facebook", "Facebook", "Myanmar Sports Talk page", FACEBOOK, "#4C8BF5"],
    ["logo-tiktok", "TikTok", "Find Myanmar Sports Talk", TIKTOK, C.text],
    ["globe-outline", "Website", "myanmarsportstalk.com", SITE, C.text2],
  ];
  return <View style={s.screen}>
    <View style={s.header}><View><Text style={s.title}>More</Text><Text style={s.subtitle}>MST Score</Text></View><Pressable hitSlop={8} onPress={openAccount}><Ionicons name="person-circle-outline" size={31} color={C.text}/></Pressable></View>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Pressable style={s.accountHero} onPress={openAccount}><View style={s.accountIcon}><Text style={s.mst}>MST</Text></View><View style={{flex:1}}><Text style={s.accountTitle}>My MST Account</Text><Text style={s.accountText}>Same account as myanmarsportstalk.com.</Text></View><Ionicons name="chevron-forward" size={20} color={C.muted}/></Pressable>
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
  const navActive = isContent ? "content-news" : mode;
  const androidInset = Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 0;

  return <View style={s.root}>
    <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
    <View style={[s.body, Platform.OS === "android" ? {paddingTop:androidInset} : null]}>
      {mode === "home" ? <HomeScreen onTab={openTopTab} openMatch={(x) => openMatch(x,"home")} openEntity={(type,x) => openEntity(type,x,"home")} openScores={() => setMode("scores")} openNotifications={() => openNotifications("home")} openSearch={() => openSearch("home")}/> : null}
      {isContent ? <LazyContent initialTab={contentTab} onLiveScores={goHome} onOpenArticle={openArticle} onNotifications={() => openNotifications(mode)} onSearch={() => openSearch(mode)}/> : null}
      {mode === "scores" ? <LazyScores openMatch={(x) => openMatch(x,"scores")}/> : null}
      {mode === "favorites" ? <LazyFavorites openLeague={(x) => openEntity("competition",x,"favorites")} openTeam={(x) => openEntity("team",x,"favorites")} openPlayer={(x) => openEntity("player",x,"favorites")} openAccount={() => openAccount("favorites")}/> : null}
      {mode === "prediction" ? <LazyPrediction openMatch={(x) => openMatch(x,"prediction")} openAccount={() => openAccount("prediction")}/> : null}
      {mode === "more" ? <MoreScreen navigate={setMode} openAccount={() => openAccount("more")} openNotifications={() => openNotifications("more")}/> : null}
      {mode === "account" ? <LazyAccount goBack={goReturn}/> : null}
      {mode === "notifications" ? <LazyNotifications goBack={goReturn} openAccount={() => openAccount("notifications")}/> : null}
      {mode === "settings" ? <LazySettings goBack={() => setMode("more")} openNotifications={() => openNotifications("settings")} openAccount={() => openAccount("settings")}/> : null}
      {mode === "about" ? <LazyAbout goBack={() => setMode("more")}/> : null}
      {mode === "search" ? <LazySearch goBack={goReturn} openMatch={(x) => openMatch(x,"search")} openEntity={(type,x) => openEntity(type,x,"search")}/> : null}
      {mode === "match" ? <LazyMatch match={selected} goBack={goReturn}/> : null}
      {mode === "entity" ? <LazyEntity type={selected?.type} entity={selected?.entity} goBack={goReturn}/> : null}
      {mode === "article" ? <LazyArticle article={selected} goBack={goReturn}/> : null}
    </View>
    {!isSubpage ? <BottomNav active={navActive} onChange={(tab) => tab === "home" ? goHome() : setMode(tab)}/> : null}
  </View>;
}

const s = StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},body:{flex:1},screen:{flex:1,backgroundColor:C.bg},
  bottomNav:{height:66,backgroundColor:C.bg2,borderTopWidth:1,borderTopColor:C.border,flexDirection:"row",paddingTop:5,paddingBottom:4},navItem:{flex:1,alignItems:"center",justifyContent:"center",gap:3},navText:{fontSize:9.5,color:C.muted},navTextActive:{color:C.red},
  header:{minHeight:70,paddingHorizontal:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:C.border2},title:{color:C.text,fontSize:22,fontWeight:"800"},subtitle:{color:C.muted,fontSize:11,marginTop:3},content:{padding:16,paddingBottom:36},
  accountHero:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:13,padding:14,flexDirection:"row",alignItems:"center",gap:12},accountIcon:{width:54,height:54,borderRadius:14,backgroundColor:"rgba(243,38,45,0.14)",alignItems:"center",justifyContent:"center"},mst:{color:C.red,fontSize:20,fontStyle:"italic",fontWeight:"900"},accountTitle:{color:C.text,fontSize:15,fontWeight:"800"},accountText:{color:C.muted,fontSize:10.5,lineHeight:15,marginTop:4},
  section:{color:C.text2,fontSize:12,fontWeight:"800",marginTop:18,marginBottom:9},card:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,overflow:"hidden"},row:{minHeight:62,paddingHorizontal:13,paddingVertical:9,flexDirection:"row",alignItems:"center",gap:11},rowBorder:{borderBottomWidth:1,borderBottomColor:C.border2},rowTitle:{color:C.text2,fontSize:13,fontWeight:"700"},rowSub:{color:C.muted,fontSize:9.5,marginTop:3},
});