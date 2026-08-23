import React, { useEffect, useRef, useState } from "react";
import { BackHandler, Linking, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "./final/HomeScreen";
import { ThemeProvider, useTheme } from "./theme/ThemeContext";
import {
  handleRateLater,
  handleRateNotNow,
  handleRateNow,
  recordAppLaunch,
  shouldShowAppRatingPrompt,
} from "./services/appRatingService";

const SITE = "https://myanmarsportstalk.com";
const YOUTUBE = "https://youtube.com/@myanmarsportstalk";
const FACEBOOK = "https://www.facebook.com/profile.php?id=61585572826885";
const TIKTOK = "https://www.tiktok.com/@myanmar.sports.talk";
const C = { bg:"#080A0C", bg2:"#0B0E10", card:"#111416", border:"#24292D", border2:"#1D2226", red:"#F3262D", gold:"#F4C84D", text:"#FFFFFF", text2:"#D0D2D4", muted:"#92979B" };

const NAV = [
  ["home", "Matches", "ပွဲများ", "football-outline", "football"],
  ["content-news", "News", "သတင်း", "newspaper-outline", "newspaper"],
  ["favorites", "Favorites", "အကြိုက်ဆုံး", "star-outline", "star"],
  ["tips", "Tips", "Tips", "diamond-outline", "diamond"],
  ["prediction", "Predict", "ခန့်မှန်း", "trophy-outline", "trophy"],
  ["more", "More", "နောက်ထပ်", "ellipsis-horizontal", "ellipsis-horizontal"]
];

function LazyContent(props) { const Screen = require("./phase3/ContentScreens").default; return <Screen {...props}/>; }
function LazyScores(props) { const Screen = require("./final/QuickScoresScreen").default; return <Screen {...props}/>; }
function LazyFavorites(props) { const Screen = require("./final/FavoritesScreenV2").default; return <Screen {...props}/>; }
function LazyTips(props) { const Screen = require("./final/TipsScreen").default; return <Screen {...props}/>; }
function LazyPrediction(props) { const Screen = require("./final/PredictionScreenV2").default; return <Screen {...props}/>; }
function LazyAccount(props) { const Screen = require("./final/AccountScreenV2").default; return <Screen {...props}/>; }
function LazyNotifications(props) { const Screen = require("./final/NotificationsScreenV2").default; return <Screen {...props}/>; }
function LazySettings(props) { const Screen = require("./final/SettingsScreenV2").default; return <Screen {...props}/>; }
function LazyAbout(props) { const Screen = require("./phase4/Phase4Screens").AboutScreen; return <Screen {...props}/>; }
function LazySearch(props) { const Screen = require("./final/SearchScreen").default; return <Screen {...props}/>; }
function LazyMatch(props) { const Screen = require("./final/NativeMatchScreenV5").default; return <Screen {...props}/>; }
function LazyEntity(props) { const Screen = require("./final/NativeEntityScreenV2").default; return <Screen {...props}/>; }
function LazyArticle(props) { const Screen = require("./final/NativeDetailScreens").NativeArticleScreen; return <Screen {...props}/>; }

function BottomNav({ active, onChange, language, colors }) {
  return <View style={[s.bottomNav, { backgroundColor: colors.bg2, borderTopColor: colors.border }]}>{NAV.map(([id,en,my,icon,activeIcon]) => {
    const selected = active === id;
    return <Pressable key={id} hitSlop={5} style={s.navItem} onPress={() => onChange(id)} android_ripple={{color:"rgba(255,255,255,.035)",borderless:true}}>
      <Ionicons name={selected ? activeIcon : icon} size={21} color={selected ? (id === "tips" ? colors.gold : colors.red) : colors.muted}/>
      <Text numberOfLines={1} style={[s.navText, { color: colors.muted }, selected && { color: id === "tips" ? colors.gold : colors.red, fontWeight: "800" }]}>{language === "my" ? my : en}</Text>
    </Pressable>;
  })}</View>;
}

function MoreScreen({ navigate, openAccount, openNotifications, language, setLanguage, colors }) {
  const my = language === "my";
  const rows = [
    ["person-circle-outline", my ? "ကျွန်ုပ်၏အကောင့်" : "My Account", my ? "MST အကောင့်နှင့် ပရိုဖိုင်" : "Profile, login and MST account", openAccount],
    ["star-outline", my ? "အကြိုက်ဆုံး" : "Favorites", my ? "အသင်း၊ ပြိုင်ပွဲနှင့် ကစားသမားများ" : "Teams, competitions and players", () => navigate("favorites")],
    ["diamond-outline", "MST Tips", my ? "Tipsters၊ Credits နှင့် premium tips" : "Tipsters, Credits and premium analysis", () => navigate("tips")],
    ["trophy-outline", my ? "ခန့်မှန်းချက်များ" : "Predictions", my ? "အခမဲ့ရလဒ်ခန့်မှန်း၊ အမှတ်နှင့် အဆင့်" : "Free score predictions, points and ranking", () => navigate("prediction")],
    ["notifications-outline", my ? "အသိပေးချက်များ" : "Notifications", my ? "သတင်း၊ တိုက်ရိုက်ရလဒ်နှင့် ပွဲအသိပေးချက်" : "News, live scores and match alerts", openNotifications],
    ["settings-outline", my ? "ဆက်တင်များ" : "Settings", my ? "App နှင့် အကောင့်ဆက်တင်" : "App and account settings", () => navigate("settings")],
    ["information-circle-outline", my ? "MST Score အကြောင်း" : "About MST Score", my ? "Myanmar Sports Talk ဘောလုံး app" : "Myanmar Sports Talk football app", () => navigate("about")]
  ];
  const socials = [
    ["logo-youtube", "YouTube", my ? "နောက်ဆုံး MST ဗီဒီယိုများ" : "Latest MST videos", YOUTUBE, colors.red],
    ["logo-facebook", "Facebook", my ? "Myanmar Sports Talk စာမျက်နှာ" : "Myanmar Sports Talk page", FACEBOOK, "#4C8BF5"],
    ["logo-tiktok", "TikTok", "@myanmar.sports.talk", TIKTOK, colors.text],
    ["globe-outline", my ? "ဝဘ်ဆိုက်" : "Website", "myanmarsportstalk.com", SITE, colors.text2]
  ];
  return <View style={[s.screen, { backgroundColor: colors.bg }]}>
    <View style={[s.header, { borderBottomColor: colors.border2 }]}><View><Text style={[s.title, { color: colors.text }]}>{my ? "နောက်ထပ်" : "More"}</Text><Text style={[s.subtitle, { color: colors.muted }]}>MST Score</Text></View><Pressable hitSlop={8} onPress={openAccount}><Ionicons name="person-circle-outline" size={31} color={colors.text}/></Pressable></View>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={[s.languageRow, { backgroundColor: colors.card, borderColor: colors.border2 }]}><View><Text style={[s.languageTitle, { color: colors.text }]}>{my ? "ဘာသာစကား" : "Language"}</Text><Text style={[s.languageSub, { color: colors.muted }]}>{my ? "မြန်မာဘာသာကို မူလဘာသာစကားအဖြစ် အသုံးပြုထားသည်" : "Choose the app interface language"}</Text></View><View style={[s.langToggle, { backgroundColor: colors.bg2 }]}><Pressable style={[s.langButton,my&&{backgroundColor:colors.red}]} onPress={()=>setLanguage("my")}><Text style={[s.langText,my&&{color:colors.text}]}>မြန်မာ</Text></Pressable><Pressable style={[s.langButton,!my&&{backgroundColor:colors.red}]} onPress={()=>setLanguage("en")}><Text style={[s.langText,!my&&{color:colors.text}]}>EN</Text></Pressable></View></View>
      <Pressable style={[s.accountHero, { backgroundColor: colors.card, borderColor: colors.border2 }]} onPress={openAccount}><View style={[s.accountIcon, { backgroundColor: colors.redSoft }]}><Text style={[s.mst, { color: colors.red }]}>MST</Text></View><View style={{flex:1}}><Text style={[s.accountTitle, { color: colors.text }]}>{my ? "ကျွန်ုပ်၏ MST အကောင့်" : "My MST Account"}</Text><Text style={[s.accountText, { color: colors.muted }]}>{my ? "ဝဘ်ဆိုက်နှင့် အကောင့်တူတူ အသုံးပြုနိုင်သည်။" : "Same account as myanmarsportstalk.com."}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted}/></Pressable>
      <Text style={[s.section, { color: colors.text2 }]}>{my ? "အကောင့်နှင့် APP" : "ACCOUNT & APP"}</Text>
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border2 }]}>{rows.map(([icon,title,subtitle,action],index) => <Pressable key={title} style={[s.row,index !== rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border2 }]} onPress={action}><Ionicons name={icon} size={22} color={icon==="diamond-outline"?colors.gold:index===0?colors.red:colors.text2}/><View style={{flex:1}}><Text style={[s.rowTitle, { color: colors.text }]}>{title}</Text><Text style={[s.rowSub, { color: colors.muted }]}>{subtitle}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted}/></Pressable>)}</View>
      <Text style={[s.section, { color: colors.text2 }]}>{my ? "MST ကို FOLLOW လုပ်ရန်" : "FOLLOW MST"}</Text>
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border2 }]}>{socials.map(([icon,title,subtitle,url,color],index) => <Pressable key={title} style={[s.row,index !== socials.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border2 }]} onPress={() => Linking.openURL(url).catch(() => {})}><Ionicons name={icon} size={22} color={color}/><View style={{flex:1}}><Text style={[s.rowTitle, { color: colors.text }]}>{title}</Text><Text style={[s.rowSub, { color: colors.muted }]}>{subtitle}</Text></View><Ionicons name="open-outline" size={18} color={colors.muted}/></Pressable>)}</View>
    </ScrollView>
  </View>;
}

function AppFinalShellV2Inner({ initialLanguage = "my", onLanguageChange } = {}) {
  const { colors } = useTheme();
  const [mode, setMode] = useState("home");
  const [selected, setSelected] = useState(null);
  const [returnMode, setReturnMode] = useState("home");
  const [language, setLanguageState] = useState(initialLanguage === "en" ? "en" : "my");
  const historyRef = useRef([]);

  const setLanguage = (lang) => {
    setLanguageState(lang);
    onLanguageChange?.(lang);
  };

  const rememberOrigin = () => {
    if (["home", "content-news", "content-transfers", "content-videos", "favorites", "tips", "prediction", "more"].includes(mode)) return mode;
    return returnMode || "home";
  };

  const goRoot = (next = "home") => {
    historyRef.current = [];
    setSelected(null);
    setReturnMode("home");
    setMode(next || "home");
  };

  const pushMode = (next, origin) => {
    const from = typeof origin === "string" ? origin : rememberOrigin();
    historyRef.current.push(from);
    setReturnMode(from);
    setMode(next);
  };

  const goHome = () => goRoot("home");

  const openMatch = (match, origin) => {
    if (!match) return;
    const from = typeof origin === "string" ? origin : rememberOrigin();
    historyRef.current.push(from);
    setReturnMode(from);
    setSelected(match);
    setMode("match");
  };

  const openEntity = (type, entity, origin) => {
    if (!entity?.id) return;
    const from = typeof origin === "string" ? origin : rememberOrigin();
    historyRef.current.push(from);
    setReturnMode(from);
    setSelected({ type, entity });
    setMode("entity");
  };

  const openArticle = (article) => {
    if (!article) return;
    const current = rememberOrigin();
    const from = current.startsWith("content-") ? current : "content-news";
    historyRef.current.push(from);
    setReturnMode(from);
    setSelected(article);
    setMode("article");
  };

  const openAccount = (origin) => pushMode("account", typeof origin === "string" ? origin : "home");
  const openNotifications = (origin) => pushMode("notifications", typeof origin === "string" ? origin : "home");
  const openSettings = (origin) => pushMode("settings", typeof origin === "string" ? origin : "home");
  const openSearch = (origin) => pushMode("search", typeof origin === "string" ? origin : "home");

  const goReturn = () => {
    const next = historyRef.current.length ? historyRef.current.pop() : (returnMode || "home");
    const parent = historyRef.current.length ? historyRef.current[historyRef.current.length - 1] : "home";
    setReturnMode(parent);
    setMode(next || "home");
  };

  const navigateMore = (target) => {
    if (target === "settings" || target === "about") pushMode(target, "more");
    else goRoot(target);
  };

  const isContent = mode.startsWith("content-");
  const contentTab = mode === "content-videos" ? "VIDEOS" : mode === "content-transfers" ? "TRANSFERS" : "NEWS";
  const isSubpage = ["account", "notifications", "settings", "about", "match", "entity", "article", "search"].includes(mode);
  const navActive = isContent ? "content-news" : mode;
  const androidInset = Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 0;

  useEffect(() => {
    const handleUrl = async (event) => {
      const url = typeof event === "string" ? event : event?.url;
      if (!url) return;
      try {
        const match = url.match(/[?&]token=([^&]+)/);
        if (match && match[1]) {
          const token = decodeURIComponent(match[1]);
          const { setSessionToken, getAuthStatus } = require("./services/accountApi");
          await setSessionToken(token);
          await getAuthStatus().catch(() => null);
          pushMode("account", mode);
          return;
        }

        const matchDeep = url.match(/mst:\/\/(?:match|fixture)\/(\d+)/i) || url.match(/[?&]matchId=(\d+)/i);
        if (matchDeep && matchDeep[1]) {
          openMatch({ id: String(matchDeep[1]) }, mode);
          return;
        }
        const articleDeep = url.match(/mst:\/\/article\/([a-zA-Z0-9_-]+)/i);
        if (articleDeep && articleDeep[1]) {
          openArticle({ slug: articleDeep[1], id: articleDeep[1] });
          return;
        }
      } catch {}
    };

    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const sub = Linking.addEventListener("url", handleUrl);
    return () => sub.remove();
  }, [mode]);

  useEffect(() => {
    let active = true;
    const handleNotificationResponse = (response) => {
      if (!active) return;
      const data = response?.notification?.request?.content?.data;
      if (!data || typeof data !== "object") return;
      const matchId = data.matchId || data.match_id || data.fixtureId;
      if (matchId) {
        openMatch({ id: String(matchId) }, mode);
        return;
      }
      const articleSlug = data.slug || data.articleSlug || data.articleId;
      if (articleSlug) {
        openArticle({ slug: String(articleSlug), id: String(articleSlug) });
        return;
      }
      if (data.type === "account") {
        openAccount(mode);
      }
    };

    try {
      const Notifications = require("expo-notifications");
      Notifications.getLastNotificationResponseAsync?.().then((res) => {
        if (res && active) handleNotificationResponse(res);
      }).catch(() => {});

      const sub = Notifications.addNotificationResponseReceivedListener?.(handleNotificationResponse);
      return () => {
        active = false;
        sub?.remove?.();
      };
    } catch {
      return () => { active = false; };
    }
  }, [mode]);

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isSubpage) {
        goReturn();
        return true;
      }
      if (mode !== "home") {
        goHome();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [mode, isSubpage, returnMode]);

  const [showRatingPrompt, setShowRatingPrompt] = useState(false);

  useEffect(() => {
    recordAppLaunch().then(() => {
      setTimeout(async () => {
        const should = await shouldShowAppRatingPrompt();
        if (should) setShowRatingPrompt(true);
      }, 3500);
    });
  }, []);

  const onRateNowPress = async () => {
    setShowRatingPrompt(false);
    await handleRateNow();
  };

  const onRateLaterPress = async () => {
    setShowRatingPrompt(false);
    await handleRateLater();
  };

  const onRateNotNowPress = async () => {
    setShowRatingPrompt(false);
    await handleRateNotNow();
  };

  return <View style={[s.root, { backgroundColor: colors.bg }]}>
    <StatusBar barStyle={colors.barStyle} backgroundColor={colors.bg}/>
    <View style={[s.body, Platform.OS === "android" ? {paddingTop:androidInset} : null]}>
      {mode === "home" ? <HomeScreen language={language} openMatch={(x) => openMatch(x, "home")} openNotifications={() => openNotifications("home")} openSearch={() => openSearch("home")} openPredictions={() => goRoot("prediction")} openAccount={() => openAccount("home")}/> : null}
      {isContent ? <LazyContent language={language} initialTab={contentTab} onLiveScores={goHome} onOpenArticle={openArticle} onNotifications={() => openNotifications(mode)} onSearch={() => openSearch(mode)}/> : null}
      {mode === "scores" ? <LazyScores language={language} openMatch={(x) => openMatch(x, "scores")}/> : null}
      {mode === "favorites" ? <LazyFavorites language={language} openLeague={(x) => openEntity("competition", x, "favorites")} openTeam={(x) => openEntity("team", x, "favorites")} openPlayer={(x) => openEntity("player", x, "favorites")} openAccount={() => openAccount("favorites")}/> : null}
      {mode === "tips" ? <LazyTips language={language} openMatch={(x) => openMatch(x, "tips")} openAccount={() => openAccount("tips")}/> : null}
      {mode === "prediction" ? <LazyPrediction language={language} openMatch={(x) => openMatch(x, "prediction")} openAccount={() => openAccount("prediction")}/> : null}
      {mode === "more" ? <MoreScreen navigate={navigateMore} openAccount={() => openAccount("more")} openNotifications={() => openNotifications("more")} language={language} setLanguage={setLanguage} colors={colors}/> : null}
      {mode === "account" ? <LazyAccount language={language} goBack={goReturn} openFavorites={() => goRoot("favorites")} openPredictions={() => goRoot("prediction")} openNotifications={() => openNotifications("account")} openSettings={() => openSettings("account")}/> : null}
      {mode === "notifications" ? <LazyNotifications language={language} goBack={goReturn} openAccount={() => openAccount("notifications")} openMatch={(x) => openMatch(x, "notifications")}/> : null}
      {mode === "settings" ? <LazySettings language={language} goBack={goReturn} openNotifications={() => openNotifications("settings")} openAccount={() => openAccount("settings")} setLanguage={setLanguage}/> : null}
      {mode === "about" ? <LazyAbout language={language} goBack={goReturn}/> : null}
      {mode === "search" ? <LazySearch language={language} goBack={goReturn} openMatch={(x) => openMatch(x, "search")} openEntity={(type, x) => openEntity(type, x, "search")}/> : null}
      {mode === "match" ? <LazyMatch language={language} match={selected} goBack={goReturn}/> : null}
      {mode === "entity" ? <LazyEntity language={language} type={selected?.type} entity={selected?.entity} goBack={goReturn} openAccount={() => openAccount("entity")}/> : null}
      {mode === "article" ? <LazyArticle language={language} article={selected} goBack={goReturn}/> : null}
    </View>
    {!isSubpage ? <BottomNav active={navActive} language={language} colors={colors} onChange={(tab) => goRoot(tab === "home" ? "home" : tab)}/> : null}

    {/* App Rating Prompt Modal (Triggers on 3rd+ Session) */}
    <Modal visible={showRatingPrompt} transparent animationType="fade" onRequestClose={onRateLaterPress}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View style={{ width: "100%", maxWidth: 340, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 20, alignItems: "center", gap: 12 }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.redSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="star" size={32} color={colors.gold} />
          </View>
          <Text style={{ fontSize: 17, fontWeight: "900", color: colors.text, textAlign: "center" }}>
            {language === "my" ? "MST Score ကို နှစ်သက်ပါသလား?" : "Enjoying MST Score?"}
          </Text>
          <Text style={{ fontSize: 11.5, lineHeight: 17, color: colors.muted, textAlign: "center" }}>
            {language === "my"
              ? "သင့်အဆင့်သတ်မှတ်ချက်သည် MST Score ကို ပိုမိုကောင်းမွန်အောင် တိုးတက်စေရန် အထောက်အကူပြုပါသည်။"
              : "Your review on Google Play helps us improve live scores and prediction features."}
          </Text>
          <View style={{ width: "100%", gap: 8, marginTop: 6 }}>
            <Pressable style={{ height: 44, borderRadius: 12, backgroundColor: colors.red, alignItems: "center", justifyContent: "center" }} onPress={onRateNowPress}>
              <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "900" }}>
                {language === "my" ? "RATE ပေးမည် (RATE NOW)" : "RATE ON GOOGLE PLAY"}
              </Text>
            </Pressable>
            <Pressable style={{ height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }} onPress={onRateLaterPress}>
              <Text style={{ color: colors.text2, fontSize: 11.5, fontWeight: "700" }}>
                {language === "my" ? "နောက်မှ ပြန်သတိပေးပါ" : "Maybe Later"}
              </Text>
            </Pressable>
            <Pressable style={{ height: 32, alignItems: "center", justifyContent: "center" }} onPress={onRateNotNowPress}>
              <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "600" }}>
                {language === "my" ? "ယခု မပေးပါ" : "Not Now"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}

export default function AppFinalShellV2(props) {
  return (
    <ThemeProvider>
      <AppFinalShellV2Inner {...props} />
    </ThemeProvider>
  );
}

const s = StyleSheet.create({
  root:{flex:1},body:{flex:1},screen:{flex:1},
  bottomNav:{height:66,borderTopWidth:1,flexDirection:"row",paddingTop:5,paddingBottom:4},navItem:{flex:1,alignItems:"center",justifyContent:"center",gap:3,paddingHorizontal:1},navText:{fontSize:8},navTextActive:{fontWeight:"800"},
  header:{minHeight:70,paddingHorizontal:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1},title:{fontSize:22,fontWeight:"800"},subtitle:{fontSize:11,marginTop:3},content:{padding:16,paddingBottom:36},
  languageRow:{minHeight:72,borderWidth:1,borderRadius:12,padding:12,marginBottom:12,flexDirection:"row",alignItems:"center",gap:12},languageTitle:{fontSize:13,fontWeight:"800"},languageSub:{fontSize:9.5,marginTop:3,maxWidth:200},langToggle:{marginLeft:"auto",flexDirection:"row",borderRadius:9,padding:3},langButton:{minWidth:50,height:32,borderRadius:7,alignItems:"center",justifyContent:"center",paddingHorizontal:8},langText:{fontSize:10,fontWeight:"900"},
  accountHero:{borderWidth:1,borderRadius:13,padding:14,flexDirection:"row",alignItems:"center",gap:12},accountIcon:{width:54,height:54,borderRadius:14,alignItems:"center",justifyContent:"center"},mst:{fontSize:20,fontStyle:"italic",fontWeight:"900"},accountTitle:{fontSize:15,fontWeight:"800"},accountText:{fontSize:10.5,lineHeight:15,marginTop:4},
  section:{fontSize:12,fontWeight:"800",marginTop:18,marginBottom:9},card:{borderWidth:1,borderRadius:11,overflow:"hidden"},row:{minHeight:62,paddingHorizontal:13,paddingVertical:9,flexDirection:"row",alignItems:"center",gap:11},rowTitle:{fontSize:13,fontWeight:"700"},rowSub:{fontSize:9.5,marginTop:3},
});
