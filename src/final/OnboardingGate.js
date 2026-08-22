import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  loadOnboardingPreferences,
  persistAppLanguage,
  saveOnboardingPreferences,
  syncStoredOnboardingFavorites,
} from "../services/onboardingStore";
import { getAuthStatus, setFavorite } from "../services/accountApi";

const C = {
  bg: "#07090B",
  card: "#101418",
  card2: "#151A1F",
  border: "#262C32",
  red: "#F32735",
  redSoft: "rgba(243,39,53,.15)",
  text: "#F7F8F9",
  text2: "#D8DCE0",
  muted: "#8B9299",
  green: "#28C878",
};

const TEAMS = [
  [33, "Manchester United"], [50, "Manchester City"], [40, "Liverpool"], [42, "Arsenal"],
  [49, "Chelsea"], [47, "Tottenham"], [541, "Real Madrid"], [529, "Barcelona"],
  [530, "Atlético Madrid"], [157, "Bayern Munich"], [85, "PSG"], [496, "Juventus"],
  [505, "Inter"], [489, "AC Milan"], [492, "Napoli"], [165, "Dortmund"],
];
const COMPETITIONS = [
  [39, "Premier League"], [2, "Champions League"], [140, "La Liga"], [135, "Serie A"],
  [78, "Bundesliga"], [61, "Ligue 1"], [3, "Europa League"],
];

const teamLogo = (id) => `https://media.api-sports.io/football/teams/${id}.png`;
const leagueLogo = (id) => `https://media.api-sports.io/football/leagues/${id}.png`;

function ChoiceCard({ selected, onPress, title, subtitle, icon }) {
  return (
    <Pressable onPress={onPress} style={[s.languageCard, selected && s.languageCardOn]}>
      <View style={[s.languageIcon, selected && s.languageIconOn]}>
        <Ionicons name={icon} size={25} color={selected ? C.text : C.red} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.languageTitle}>{title}</Text>
        <Text style={s.languageSub}>{subtitle}</Text>
      </View>
      <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={25} color={selected ? C.red : C.muted} />
    </Pressable>
  );
}

function SelectTile({ id, name, selected, onPress, type }) {
  const [imageFailed, setImageFailed] = useState(false);
  const uri = type === "team" ? teamLogo(id) : leagueLogo(id);
  return (
    <Pressable onPress={onPress} style={[s.tile, selected && s.tileOn]}>
      <View style={s.logoWrap}>
        {!imageFailed ? (
          <Image source={{ uri }} style={s.logo} resizeMode="contain" onError={() => setImageFailed(true)} />
        ) : (
          <Text style={s.logoFallback}>{String(name).slice(0, 2).toUpperCase()}</Text>
        )}
      </View>
      <Text numberOfLines={2} style={[s.tileName, selected && { color: C.text }]}>{name}</Text>
      {selected ? <View style={s.check}><Ionicons name="checkmark" size={12} color="#fff" /></View> : null}
    </Pressable>
  );
}

function SplashMotion({ done }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.78)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, speed: 8, bounciness: 5, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.25, duration: 650, useNativeDriver: true }),
      ]),
    ]).start();
    const timer = setTimeout(done, 1500);
    return () => clearTimeout(timer);
  }, [done, glow, opacity, scale]);

  return (
    <View style={s.splash}>
      <Animated.View style={[s.glow, { opacity: glow, transform: [{ scale }] }]} />
      <Animated.Image source={require("../../assets/icon.png")} resizeMode="contain" style={[s.splashLogo, { opacity, transform: [{ scale }] }]} />
      <Animated.Text style={[s.splashBrand, { opacity }]}>MST SCORE</Animated.Text>
    </View>
  );
}

export default function OnboardingGate({ children }) {
  const [phase, setPhase] = useState("splash");
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefs] = useState(null);
  const [languageChoice, setLanguageChoice] = useState(null);
  const [teams, setTeams] = useState([]);
  const [competitions, setCompetitions] = useState([]);

  useEffect(() => {
    loadOnboardingPreferences().then((value) => {
      setPrefs(value);
      setLanguageChoice(value.language);
      setTeams(value.teams || []);
      setCompetitions(value.competitions || []);
      setLoaded(true);
    });
  }, []);

  const finishSplash = () => {
    if (!loaded) {
      const wait = setInterval(() => {
        if (loaded) {
          clearInterval(wait);
          setPhase(prefs?.completed ? "app" : "language");
        }
      }, 50);
      setTimeout(() => clearInterval(wait), 2500);
      return;
    }
    setPhase(prefs?.completed ? "app" : "language");
  };

  useEffect(() => {
    if (phase === "splash" || !loaded) return;
  }, [loaded, phase]);

  const my = languageChoice === "my";
  const androidTop = Platform.OS === "android" ? Math.max(StatusBar.currentHeight || 0, 20) : 0;
  const teamSet = useMemo(() => new Set(teams.map(String)), [teams]);
  const competitionSet = useMemo(() => new Set(competitions.map(String)), [competitions]);
  const toggle = (kind, id) => {
    const sid = String(id);
    const setter = kind === "team" ? setTeams : setCompetitions;
    setter((current) => current.map(String).includes(sid) ? current.filter((x) => String(x) !== sid) : [...current, sid]);
  };

  const chooseLanguage = async () => {
    if (!languageChoice) return;
    const next = await saveOnboardingPreferences({ language: languageChoice, completed: false });
    setPrefs(next);
    setPhase("favorites");
  };

  const complete = async (skip = false) => {
    const next = await saveOnboardingPreferences({
      completed: true,
      language: languageChoice || "my",
      teams: skip ? [] : teams,
      competitions: skip ? [] : competitions,
      favoritesSynced: false,
      completedAt: new Date().toISOString(),
    });
    setPrefs(next);
    setPhase("app");
    getAuthStatus()
      .then((status) => status?.authenticated ? syncStoredOnboardingFavorites(setFavorite) : false)
      .catch(() => false);
  };

  const setLanguage = (value) => {
    const next = value === "en" ? "en" : "my";
    setLanguageChoice(next);
    setPrefs((p) => ({ ...(p || {}), language: next }));
    persistAppLanguage(next).catch(() => {});
  };

  if (phase === "splash") {
    return <SplashMotion done={() => {
      loadOnboardingPreferences().then((latest) => {
        setPrefs(latest);
        setLanguageChoice(latest.language);
        setTeams(latest.teams || []);
        setCompetitions(latest.competitions || []);
        setLoaded(true);
        setPhase(latest.completed ? "app" : "language");
      });
    }} />;
  }

  if (phase === "language") {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={s.onboardingHeader}>
          <Text style={s.step}>1 / 2</Text>
          <Text style={s.title}>Choose your language</Text>
          <Text style={s.mmTitle}>ဘာသာစကား ရွေးပါ</Text>
          <Text style={s.subtitle}>A language must be selected before you continue. You can change it later in More.</Text>
        </View>
        <View style={s.languageList}>
          <ChoiceCard selected={languageChoice === "my"} onPress={() => setLanguageChoice("my")} title="မြန်မာ" subtitle="MST Score ကို မြန်မာဘာသာဖြင့် အသုံးပြုမည်" icon="language-outline" />
          <ChoiceCard selected={languageChoice === "en"} onPress={() => setLanguageChoice("en")} title="English" subtitle="Use MST Score in English" icon="globe-outline" />
        </View>
        <View style={s.bottom}>
          <Pressable disabled={!languageChoice} onPress={chooseLanguage} style={[s.primary, !languageChoice && s.primaryDisabled]}>
            <Text style={s.primaryText}>{languageChoice === "my" ? "ဆက်လုပ်ရန်" : "Continue"}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
          <Text style={s.required}>Required · No skip</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "favorites") {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={[s.favoriteTop, { paddingTop: androidTop + 10 }]}>
          <View style={s.favoriteTopRow}>
            <Text style={[s.step, s.favoriteStep]}>2 / 2</Text>
            <Pressable onPress={() => complete(true)} hitSlop={10} style={s.skipButton}><Text style={s.skip}>{my ? "ကျော်ရန်" : "Skip"}</Text></Pressable>
          </View>
          <Text numberOfLines={2} maxFontSizeMultiplier={1.15} style={s.favoriteTitle}>{my ? "သင်နှစ်သက်ရာကို ရွေးပါ" : "Choose your favorites"}</Text>
          <Text maxFontSizeMultiplier={1.15} style={s.favoriteSub}>{my ? "အသင်းနဲ့ ပြိုင်ပွဲတွေကိုရွေးပြီး MST Score ကို သင့်အတွက် ပိုကိုက်ညီအောင်လုပ်ပါ။" : "Pick teams and competitions to personalize MST Score. You can change them later."}</Text>
        </View>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{my ? "အကြိုက်ဆုံးအသင်း" : "Favorite teams"}</Text>
            <Text style={s.selectedCount}>{teams.length} {my ? "ရွေးထား" : "selected"}</Text>
          </View>
          <View style={s.grid}>{TEAMS.map(([id, name]) => <SelectTile key={`t-${id}`} id={id} name={name} type="team" selected={teamSet.has(String(id))} onPress={() => toggle("team", id)} />)}</View>
          <View style={[s.sectionHead, { marginTop: 24 }]}>
            <Text style={s.sectionTitle}>{my ? "အကြိုက်ဆုံးပြိုင်ပွဲ" : "Favorite competitions"}</Text>
            <Text style={s.selectedCount}>{competitions.length} {my ? "ရွေးထား" : "selected"}</Text>
          </View>
          <View style={s.grid}>{COMPETITIONS.map(([id, name]) => <SelectTile key={`c-${id}`} id={id} name={name} type="competition" selected={competitionSet.has(String(id))} onPress={() => toggle("competition", id)} />)}</View>
          <Text style={s.moreLater}>{my ? "နောက်ပိုင်း Favorites ထဲမှာ အသင်းနဲ့ ပြိုင်ပွဲတွေ ထပ်ထည့်နိုင်ပါတယ်။" : "You can add more teams and competitions later from Favorites."}</Text>
        </ScrollView>
        <View style={s.finishBar}>
          <Pressable onPress={() => complete(false)} style={s.primary}>
            <Text style={s.primaryText}>{my ? "MST Score စတင်ရန်" : "Start MST Score"}</Text>
            <Ionicons name="football" size={18} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const language = prefs?.language === "en" ? "en" : "my";
  return typeof children === "function" ? children({ language, setLanguage }) : children;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  splash: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: C.redSoft },
  splashLogo: { width: 196, height: 196, borderRadius: 42 },
  splashBrand: { color: C.text, fontSize: 13, letterSpacing: 5, fontWeight: "900", marginTop: 22 },
  onboardingHeader: { paddingHorizontal: 22, paddingTop: 44 },
  step: { color: C.red, fontSize: 11, fontWeight: "900", letterSpacing: 1.2, marginBottom: 12 },
  title: { color: C.text, fontSize: 30, fontWeight: "900", letterSpacing: -0.8 },
  mmTitle: { color: C.text2, fontSize: 20, fontWeight: "800", marginTop: 7 },
  subtitle: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 13, maxWidth: 340 },
  languageList: { paddingHorizontal: 20, paddingTop: 32, gap: 12 },
  languageCard: { minHeight: 88, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, flexDirection: "row", alignItems: "center", gap: 14 },
  languageCardOn: { borderColor: C.red, backgroundColor: C.redSoft },
  languageIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: "rgba(243,39,53,.10)", alignItems: "center", justifyContent: "center" },
  languageIconOn: { backgroundColor: C.red },
  languageTitle: { color: C.text, fontSize: 17, fontWeight: "900" },
  languageSub: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  bottom: { marginTop: "auto", paddingHorizontal: 20, paddingBottom: 28, alignItems: "center" },
  primary: { minHeight: 54, width: "100%", borderRadius: 14, backgroundColor: C.red, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9 },
  primaryDisabled: { opacity: 0.32 },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  required: { color: C.muted, fontSize: 10, marginTop: 10 },
  favoriteTop: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  favoriteTopRow: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 },
  favoriteStep: { marginBottom: 0 },
  favoriteTitle: { color: C.text, fontSize: 25, lineHeight: 34, fontWeight: "900", flexShrink: 1 },
  favoriteSub: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 7, maxWidth: 360 },
  skipButton: { minWidth: 58, minHeight: 32, alignItems: "flex-end", justifyContent: "center" },
  skip: { color: C.red, fontSize: 13, fontWeight: "900" },
  scroll: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 132 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { color: C.text, fontSize: 15, fontWeight: "900" },
  selectedCount: { color: C.muted, fontSize: 10, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  tile: { width: "48.5%", minHeight: 112, borderRadius: 13, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: "center", justifyContent: "center", padding: 8, position: "relative" },
  tileOn: { borderColor: C.red, backgroundColor: C.redSoft },
  logoWrap: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#F5F6F7", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 8 },
  logo: { width: 36, height: 36 },
  logoFallback: { color: "#111", fontWeight: "900", fontSize: 12 },
  tileName: { color: C.text2, fontSize: 9.5, fontWeight: "800", textAlign: "center", lineHeight: 13 },
  check: { position: "absolute", top: 7, right: 7, width: 20, height: 20, borderRadius: 10, backgroundColor: C.red, alignItems: "center", justifyContent: "center" },
  moreLater: { color: C.muted, fontSize: 10.5, lineHeight: 16, textAlign: "center", marginTop: 22, paddingHorizontal: 20 },
  finishBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20, backgroundColor: "rgba(7,9,11,.97)", borderTopWidth: 1, borderTopColor: C.border },
});
