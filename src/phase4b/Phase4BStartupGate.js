import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  loadOnboardingPreferences,
  persistAppLanguage,
  saveGuestFavorite,
  saveOnboardingPreferences,
} from "../services/onboardingStore.js";
import { reconcileGuestFavorites } from "./favoritesReconciliation.js";
import { loadScoresOverview } from "./scoresStagingApi.js";
import { getAuthStatus } from "./scoresFavoritesApi.js";

const C = {
  bg: "#080A0C",
  surface: "#101417",
  raised: "#161B1F",
  border: "#242B31",
  borderActive: "rgba(243,38,45,0.45)",
  red: "#F3262D",
  redSoft: "rgba(243,38,45,0.12)",
  text: "#FFFFFF",
  secondary: "#D4D8DB",
  muted: "#8A939A",
  amber: "#F4C84D",
  green: "#48C78E",
};

const FEATURED_COMPETITIONS = [
  { id: "39", name: "Premier League", country: "England", logo: "https://media.api-sports.io/football/leagues/39.png" },
  { id: "2", name: "UEFA Champions League", country: "Europe", logo: "https://media.api-sports.io/football/leagues/2.png" },
  { id: "140", name: "La Liga", country: "Spain", logo: "https://media.api-sports.io/football/leagues/140.png" },
  { id: "135", name: "Serie A", country: "Italy", logo: "https://media.api-sports.io/football/leagues/135.png" },
  { id: "78", name: "Bundesliga", country: "Germany", logo: "https://media.api-sports.io/football/leagues/78.png" },
  { id: "61", name: "Ligue 1", country: "France", logo: "https://media.api-sports.io/football/leagues/61.png" },
  { id: "3", name: "UEFA Europa League", country: "Europe", logo: "https://media.api-sports.io/football/leagues/3.png" },
];

const FEATURED_TEAMS = [
  { id: "33", name: "Manchester United", country: "England", logo: "https://media.api-sports.io/football/teams/33.png" },
  { id: "50", name: "Manchester City", country: "England", logo: "https://media.api-sports.io/football/teams/50.png" },
  { id: "40", name: "Liverpool", country: "England", logo: "https://media.api-sports.io/football/teams/40.png" },
  { id: "42", name: "Arsenal", country: "England", logo: "https://media.api-sports.io/football/teams/42.png" },
  { id: "49", name: "Chelsea", country: "England", logo: "https://media.api-sports.io/football/teams/49.png" },
  { id: "541", name: "Real Madrid", country: "Spain", logo: "https://media.api-sports.io/football/teams/541.png" },
  { id: "529", name: "Barcelona", country: "Spain", logo: "https://media.api-sports.io/football/teams/529.png" },
  { id: "157", name: "Bayern Munich", country: "Germany", logo: "https://media.api-sports.io/football/teams/157.png" },
  { id: "85", name: "Paris Saint-Germain", country: "France", logo: "https://media.api-sports.io/football/teams/85.png" },
  { id: "1563", name: "Myanmar National Team", country: "Myanmar", logo: "https://media.api-sports.io/football/teams/1563.png" },
];

/**
 * Premium MST Motion / Splash Screen
 */
function MotionSplash({ onFinished }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      onFinished?.();
    }, 1600);

    return () => clearTimeout(timer);
  }, [onFinished, opacity, scale]);

  return (
    <View style={s.splashRoot}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <Animated.View style={[s.splashCenter, { opacity, transform: [{ scale }] }]}>
        <Image
          source={require("../../assets/icon.png")}
          style={s.officialAppIcon}
          resizeMode="contain"
        />
        <Text style={s.splashBrand}>MYANMAR SPORTS TALK</Text>
        <Text style={s.splashTagline}>PREMIUM FOOTBALL SCORES & INSIGHTS</Text>
      </Animated.View>
    </View>
  );
}

/**
 * Step 1: Mandatory Language Selection (NO SKIP)
 */
function LanguageStep({ currentLanguage, onSelectLanguage, onContinue }) {
  const my = currentLanguage === "my";

  return (
    <SafeAreaView style={s.onboardingRoot}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={s.stepHeader}>
        <Text style={s.stepEyebrow}>STEP 1 OF 2 · REQUIRED</Text>
        <Text style={s.stepTitle}>{my ? "ဘာသာစကား ရွေးချယ်ပါ" : "Choose Language"}</Text>
        <Text style={s.stepSubtitle}>
          {my
            ? "အက်ပ်အတွင်း အသုံးပြုလိုသည့် ဘာသာစကားကို ရွေးချယ်ပေးပါ။"
            : "Select your preferred language. You can change this anytime in Settings."}
        </Text>
      </View>

      <View style={s.languageCardContainer}>
        {/* ENGLISH CARD */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: currentLanguage === "en" }}
          onPress={() => onSelectLanguage("en")}
          style={[
            s.langCard,
            currentLanguage === "en" && s.langCardSelected,
          ]}
        >
          <View style={[s.langIconWrap, currentLanguage === "en" && s.langIconWrapSelected]}>
            <Ionicons name="globe-outline" size={24} color={currentLanguage === "en" ? C.text : C.muted} />
          </View>
          <View style={s.flex}>
            <Text style={[s.langName, currentLanguage === "en" && { color: C.text }]}>English</Text>
            <Text style={s.langMeta}>Premier League, Champions League, commentary & stats</Text>
          </View>
          <Ionicons
            name={currentLanguage === "en" ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={currentLanguage === "en" ? C.red : C.muted}
          />
        </Pressable>

        {/* BURMESE CARD */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: currentLanguage === "my" }}
          onPress={() => onSelectLanguage("my")}
          style={[
            s.langCard,
            currentLanguage === "my" && s.langCardSelected,
          ]}
        >
          <View style={[s.langIconWrap, currentLanguage === "my" && s.langIconWrapSelected]}>
            <Ionicons name="football-outline" size={24} color={currentLanguage === "my" ? C.text : C.muted} />
          </View>
          <View style={s.flex}>
            <Text style={[s.langName, s.myFont, currentLanguage === "my" && { color: C.text }]}>မြန်မာစာ</Text>
            <Text style={[s.langMeta, s.mySub]}>ပွဲစဉ်ရလဒ်များ၊ ဖြစ်ရပ်မှတ်တမ်း၊ သတင်းနှင့် သုံးသပ်ချက်များ</Text>
          </View>
          <Ionicons
            name={currentLanguage === "my" ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={currentLanguage === "my" ? C.red : C.muted}
          />
        </Pressable>
      </View>

      <View style={s.stepFooter}>
        <Pressable
          accessibilityRole="button"
          disabled={!currentLanguage}
          onPress={onContinue}
          style={[s.primaryBtn, !currentLanguage && s.primaryBtnDisabled]}
        >
          <Text style={s.primaryBtnText}>{my ? "ရှေ့သို့ ဆက်သွားမည်" : "CONTINUE"}</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/**
 * Step 2: Optional Favorites Setup (CAN SKIP)
 */
function FavoritesStep({ language = "my", onFinish }) {
  const my = language === "my";
  const [tab, setTab] = useState("competitions"); // "competitions" | "teams"
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());

  const items = tab === "competitions" ? FEATURED_COMPETITIONS : FEATURED_TEAMS;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q) || (item.country || "").toLowerCase().includes(q));
  }, [items, search]);

  const toggleFavorite = useCallback(async (item) => {
    const kind = tab === "competitions" ? "competition" : "team";
    const next = new Set(selectedIds);
    const active = !next.has(item.id);
    if (active) next.add(item.id);
    else next.delete(item.id);
    setSelectedIds(next);

    await saveGuestFavorite({
      kind,
      id: item.id,
      name: item.name,
      logo: item.logo,
      country: item.country,
      active,
    }).catch(() => {});
  }, [tab, selectedIds]);

  return (
    <SafeAreaView style={s.onboardingRoot}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={s.favHeader}>
        <View style={s.flex}>
          <Text style={s.stepEyebrow}>STEP 2 OF 2 · OPTIONAL</Text>
          <Text style={s.stepTitle}>{my ? "အကြိုက်ဆုံးများ ရွေးပါ" : "Follow Favorites"}</Text>
        </View>
        <Pressable hitSlop={12} onPress={onFinish} style={s.skipBtn}>
          <Text style={s.skipBtnText}>{my ? "ကျော်မည်" : "SKIP"}</Text>
        </Pressable>
      </View>

      <Text style={s.favSubtitle}>
        {my
          ? "သင်အကြိုက်ဆုံး အသင်းနှင့် ပြိုင်ပွဲများကို ဦးစားပေး ဖော်ပြပေးပါမည်။"
          : "Matches for your favorite clubs and leagues will be prioritized on your Scores feed."}
      </Text>

      {/* Tabs */}
      <View style={s.favTabs}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "competitions" }}
          onPress={() => setTab("competitions")}
          style={[s.favTabBtn, tab === "competitions" && s.favTabBtnActive]}
        >
          <Text style={[s.favTabText, tab === "competitions" && s.favTabTextActive]}>
            {my ? "ပြိုင်ပွဲများ" : "LEAGUES"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "teams" }}
          onPress={() => setTab("teams")}
          style={[s.favTabBtn, tab === "teams" && s.favTabBtnActive]}
        >
          <Text style={[s.favTabText, tab === "teams" && s.favTabTextActive]}>
            {my ? "အသင်းများ" : "CLUBS"}
          </Text>
        </Pressable>
      </View>

      {/* Search Input */}
      <View style={s.favSearchWrap}>
        <Ionicons name="search" size={16} color={C.muted} style={{ marginLeft: 10 }} />
        <TextInput
          placeholder={my ? "ရှာဖွေရန်…" : "Search clubs & leagues…"}
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
          style={s.favSearchInput}
        />
        {search ? (
          <Pressable hitSlop={8} onPress={() => setSearch("")} style={{ paddingRight: 10 }}>
            <Ionicons name="close-circle" size={16} color={C.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* Grid / List */}
      <ScrollView contentContainerStyle={s.favListContent} showsVerticalScrollIndicator={false}>
        {filtered.map((item) => {
          const selected = selectedIds.has(item.id);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => toggleFavorite(item)}
              style={[s.favItemRow, selected && s.favItemRowSelected]}
            >
              <Image source={{ uri: item.logo }} style={s.favLogo} resizeMode="contain" />
              <View style={s.flex}>
                <Text numberOfLines={1} style={[s.favItemName, selected && { color: C.text }]}>{item.name}</Text>
                <Text style={s.favItemCountry}>{item.country}</Text>
              </View>
              <Ionicons
                name={selected ? "star" : "star-outline"}
                size={20}
                color={selected ? C.amber : C.muted}
              />
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Bottom Finish CTA */}
      <View style={s.stepFooter}>
        <Pressable accessibilityRole="button" onPress={onFinish} style={s.primaryBtn}>
          <Text style={s.primaryBtnText}>
            {selectedIds.size > 0
              ? (my ? `ပြီးပါပြီ (${selectedIds.size} ခု)` : `ENTER SCORES (${selectedIds.size} SELECTED)`)
              : (my ? "ပွဲစဉ်များ ကြည့်ရှုမည်" : "ENTER SCORES")}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/**
 * Phase 4B Startup Gate: Coordinates Motion Splash, Mandatory Language, Optional Favorites, and Restores Session
 */
export default function Phase4BStartupGate({ children }) {
  const [phase, setPhase] = useState("splash"); // "splash" | "language" | "ready"
  const [language, setLanguage] = useState(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const splashDoneRef = useRef(false);

  // 1. Standalone local preferences load (AsyncStorage, resolves in ~5ms)
  useEffect(() => {
    let active = true;

    loadOnboardingPreferences()
      .then((prefs) => {
        if (!active) return;
        const lang = prefs?.language || null;
        const isDone = Boolean(prefs?.onboardingComplete || prefs?.completed || lang);
        if (lang) {
          setLanguage(lang);
        }
        if (isDone) {
          setOnboardingCompleted(true);
        }
        setPrefsLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setPrefsLoaded(true);
      });

    // 2. Non-blocking background session & scores pre-warm
    getAuthStatus()
      .then((auth) => {
        if (active && auth?.authenticated) {
          reconcileGuestFavorites().catch(() => {});
        }
      })
      .catch(() => {});

    loadScoresOverview().catch(() => null);

    return () => {
      active = false;
    };
  }, []);

  const handleSplashDone = useCallback(() => {
    splashDoneRef.current = true;
    if (prefsLoaded) {
      if (onboardingCompleted && language) {
        setPhase("ready");
      } else if (!language) {
        setPhase("language");
      } else {
        setPhase("ready");
      }
    }
  }, [prefsLoaded, onboardingCompleted, language]);

  // If splash animation completed while preferences were still reading from disk, transition immediately once ready
  useEffect(() => {
    if (splashDoneRef.current && prefsLoaded && phase === "splash") {
      if (onboardingCompleted && language) {
        setPhase("ready");
      } else if (!language) {
        setPhase("language");
      } else {
        setPhase("ready");
      }
    }
  }, [prefsLoaded, onboardingCompleted, language, phase]);

  const handleSelectLanguage = useCallback((selected) => {
    setLanguage(selected);
  }, []);

  const handleFinishOnboarding = useCallback(async () => {
    await saveOnboardingPreferences({ completed: true });
    setOnboardingCompleted(true);
    setPhase("ready");
  }, []);

  const handleLanguageContinue = useCallback(async () => {
    const chosen = language || "my";
    await saveOnboardingPreferences({
      language: chosen,
      completed: true,
      onboardingComplete: true,
    });
    await persistAppLanguage(chosen).catch(() => {});
    setOnboardingCompleted(true);
    setPhase("ready");
  }, [language]);

  if (phase === "splash") {
    return <MotionSplash onFinished={handleSplashDone} />;
  }

  if (phase === "language") {
    return (
      <LanguageStep
        currentLanguage={language}
        onSelectLanguage={handleSelectLanguage}
        onContinue={handleLanguageContinue}
      />
    );
  }

  // Ready: Render core Scores experience directly
  return children;
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  splashRoot: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  splashCenter: {
    alignItems: "center",
  },
  officialAppIcon: {
    width: 90,
    height: 90,
    borderRadius: 20,
    marginBottom: 16,
  },
  logoCrest: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 20,
  },
  logoInner: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  logoTextMst: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  logoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.red,
    marginLeft: 2,
  },
  splashBrand: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  splashTagline: {
    fontSize: 10,
    fontWeight: "700",
    color: C.muted,
    letterSpacing: 1.2,
  },
  splashFooter: {
    position: "absolute",
    bottom: 50,
  },
  loadingBar: {
    width: 120,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.border,
    overflow: "hidden",
  },
  loadingBarFill: {
    width: 48,
    height: "100%",
    backgroundColor: C.red,
    borderRadius: 2,
  },
  onboardingRoot: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 20,
  },
  stepHeader: {
    marginTop: Platform.OS === "android" ? 35 : 20,
    marginBottom: 25,
  },
  stepEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    color: C.red,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: C.text,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 13.5,
    color: C.secondary,
    lineHeight: 20,
  },
  languageCardContainer: {
    gap: 14,
  },
  langCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    padding: 18,
    gap: 14,
  },
  langCardSelected: {
    borderColor: C.red,
    backgroundColor: C.raised,
  },
  langIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  langIconWrapSelected: {
    backgroundColor: C.redSoft,
  },
  langName: {
    fontSize: 18,
    fontWeight: "800",
    color: C.secondary,
    marginBottom: 3,
  },
  myFont: {
    fontSize: 19,
    fontWeight: "800",
  },
  langMeta: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 16,
  },
  mySub: {
    lineHeight: 18,
  },
  stepFooter: {
    marginTop: "auto",
    paddingVertical: 20,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: C.red,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  favHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Platform.OS === "android" ? 35 : 20,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
  },
  skipBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.muted,
    letterSpacing: 0.8,
  },
  favSubtitle: {
    fontSize: 13,
    color: C.secondary,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  favTabs: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  favTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  favTabBtnActive: {
    backgroundColor: C.raised,
  },
  favTabText: {
    fontSize: 11,
    fontWeight: "800",
    color: C.muted,
    letterSpacing: 0.8,
  },
  favTabTextActive: {
    color: C.red,
  },
  favSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    marginBottom: 14,
  },
  favSearchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 10,
    color: C.text,
    fontSize: 13,
  },
  favListContent: {
    gap: 8,
    paddingBottom: 20,
  },
  favItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  favItemRowSelected: {
    borderColor: C.borderActive,
    backgroundColor: C.raised,
  },
  favLogo: {
    width: 32,
    height: 32,
  },
  favItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: C.secondary,
  },
  favItemCountry: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
});
