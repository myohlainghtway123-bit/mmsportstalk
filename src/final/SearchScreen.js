import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { peekFastFootballMatches } from "../services/fastFootballApi";
import { fetchFifaMenRanking, peekFifaMenRanking } from "../services/fifaRankingApi";
import { searchFootballEntities as fetchSmartSearch } from "../services/smartSearchApi";
import AsyncStorage from "@react-native-async-storage/async-storage";

const RECENT_SEARCH_KEY = "@mst_recent_searches";
const EMPTY_REMOTE = { teams: [], players: [], stale: false };

const POPULAR_SEARCH_TEAMS = [
  { id: 33, name: "Manchester United", priority: 100, country: "England" },
  { id: 50, name: "Manchester City", priority: 100, country: "England" },
  { id: 541, name: "Real Madrid", priority: 100, country: "Spain" },
  { id: 529, name: "Barcelona", priority: 100, country: "Spain" },
  { id: 40, name: "Liverpool", priority: 100, country: "England" },
  { id: 42, name: "Arsenal", priority: 100, country: "England" },
  { id: 49, name: "Chelsea", priority: 95, country: "England" },
  { id: 157, name: "Bayern Munich", priority: 95, country: "Germany" },
  { id: 85, name: "Paris Saint Germain", priority: 95, country: "France" },
  { id: 496, name: "Juventus", priority: 90, country: "Italy" },
  { id: 505, name: "Inter", priority: 90, country: "Italy" },
  { id: 489, name: "AC Milan", priority: 90, country: "Italy" },
  { id: 47, name: "Tottenham", priority: 90, country: "England" },
  { id: 165, name: "Borussia Dortmund", priority: 90, country: "Germany" },
  { id: 530, name: "Atletico Madrid", priority: 90, country: "Spain" },
];

const POPULAR_NATIONAL_TEAMS = [
  { id: 26, name: "Argentina", country: "South America" },
  { id: 6, name: "Brazil", country: "South America" },
  { id: 10, name: "England", country: "Europe" },
  { id: 2, name: "France", country: "Europe" },
  { id: 9, name: "Spain", country: "Europe" },
  { id: 25, name: "Germany", country: "Europe" },
  { id: 27, name: "Portugal", country: "Europe" },
  { id: 767, name: "Italy", country: "Europe" },
  { id: 1118, name: "Netherlands", country: "Europe" },
  { id: 12, name: "Japan", country: "Asia" },
];

const ASEAN_NATIONAL_TEAMS = [
  { id: 1563, name: "Myanmar", flag: "🇲🇲", rank: 160 },
  { id: 1568, name: "Thailand", flag: "🇹🇭", rank: 101 },
  { id: 1572, name: "Vietnam", flag: "🇻🇳", rank: 114 },
  { id: 1558, name: "Indonesia", flag: "🇮🇩", rank: 133 },
  { id: 1561, name: "Malaysia", flag: "🇲🇾", rank: 132 },
  { id: 1566, name: "Singapore", flag: "🇸🇬", rank: 161 },
  { id: 1564, name: "Philippines", flag: "🇵🇭", rank: 148 },
  { id: 1555, name: "Cambodia", flag: "🇰🇭", rank: 180 },
  { id: 1560, name: "Laos", flag: "🇱🇦", rank: 189 },
  { id: 1554, name: "Brunei", flag: "🇧🇳", rank: 194 },
  { id: 1569, name: "Timor-Leste", flag: "🇹🇱", rank: 196 },
];

function normalized(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function scoreSearchRelevance(name, query, basePriority = 0) {
  const n = normalized(name);
  const q = normalized(query);
  if (!q) return 0;
  if (n === q) return 10000 + basePriority;
  if (n.startsWith(q)) return 5000 + basePriority;
  const words = n.split(/\s+/);
  if (words.some((w) => w.startsWith(q))) return 3000 + basePriority;
  if (n.includes(q)) return 1000 + basePriority;
  return 0;
}

function todayBangkok() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

function ResultRow({ icon, image, title, subtitle, onPress, accent = false, colors }) {
  return (
    <Pressable
      style={[
        s.row,
        { backgroundColor: colors.card, borderColor: colors.border2 },
        accent && { borderColor: colors.red, backgroundColor: colors.redSoft },
      ]}
      onPress={onPress}
    >
      <View style={[s.avatar, { backgroundColor: colors.card2 }]}>
        {image ? (
          <Image source={{ uri: image }} resizeMode="contain" style={s.avatarImage} />
        ) : (
          <Ionicons name={icon || "football-outline"} size={19} color={colors.text2} />
        )}
      </View>
      <View style={s.rowBody}>
        <Text numberOfLines={1} style={[s.rowTitle, { color: colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[s.rowSub, { color: colors.muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted2} />
    </Pressable>
  );
}

export default function SearchScreen({ goBack, openEntity, language = "my" }) {
  const { colors } = useTheme();
  const my = language === "my";
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");
  const [recentSearches, setRecentSearches] = useState([]);
  const [remoteResults, setRemoteResults] = useState(EMPTY_REMOTE);
  const [fifaRanking, setFifaRanking] = useState(peekFifaMenRanking());
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchSequence = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCH_KEY)
      .then((raw) => {
        if (raw) setRecentSearches(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  const saveRecentSearch = (term) => {
    const clean = term.trim();
    if (!clean) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((x) => x.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 8);
      AsyncStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_SEARCH_KEY).catch(() => {});
  };

  useEffect(() => {
    let alive = true;
    fetchFifaMenRanking()
      .then((data) => {
        if (alive && data) setFifaRanking(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (Array.from(q).length < 3) {
      setRemoteResults(EMPTY_REMOTE);
      setLoading(false);
      setSearchError("");
      return;
    }
    const sequence = ++searchSequence.current;
    const controller = new AbortController();
    setLoading(true);
    setSearchError("");
    const timer = setTimeout(async () => {
      try {
        const result = await fetchSmartSearch(q, { signal: controller.signal });
        if (sequence === searchSequence.current) {
          setRemoteResults(result || EMPTY_REMOTE);
          setSearchError(result?.warning
            ? (my ? "ရှာဖွေမှုရလဒ်အချို့ ယာယီမရနိုင်ပါ။" : "Some search results are temporarily unavailable.")
            : "");
          setLoading(false);
        }
      } catch (error) {
        if (error?.name !== "AbortError" && sequence === searchSequence.current) {
          setSearchError(my ? "ရှာဖွေရေးဝန်ဆောင်မှု ယာယီမရနိုင်ပါ။" : "Search is temporarily unavailable.");
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [my, query]);

  const matchesPayload = peekFastFootballMatches(todayBangkok());
  const localTeams = useMemo(() => {
    const map = new Map();
    for (const team of POPULAR_SEARCH_TEAMS) {
      map.set(String(team.id), team);
    }
    const matches = matchesPayload?.matches || [];
    for (const m of matches) {
      if (m.home?.id) map.set(String(m.home.id), { id: m.home.id, name: m.home.name, logo: m.home.logo, country: m.country });
      if (m.away?.id) map.set(String(m.away.id), { id: m.away.id, name: m.away.name, logo: m.away.logo, country: m.country });
    }
    return Array.from(map.values());
  }, [matchesPayload]);

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const localMatches = localTeams
      .map((team) => ({
        ...team,
        score: scoreSearchRelevance(team.name, q, team.priority || 0),
      }))
      .filter((t) => t.score > 0);

    const remoteTeams = (remoteResults.teams || []).map((t) => ({
      id: t.id,
      name: t.name,
      logo: t.logo,
      country: t.country,
      score: scoreSearchRelevance(t.name, q, 50),
    }));

    const combined = new Map();
    for (const t of [...localMatches, ...remoteTeams]) {
      combined.set(String(t.id || t.name), t);
    }
    return Array.from(combined.values()).sort((a, b) => b.score - a.score);
  }, [query, localTeams, remoteResults.teams]);

  const filteredPlayers = useMemo(() => {
    const q = query.trim();
    const combined = new Map();
    for (const player of remoteResults.players || []) {
      const score = Math.max(
        scoreSearchRelevance(player.name, q, 50),
        scoreSearchRelevance(player.firstName, q, 40),
        scoreSearchRelevance(player.lastName, q, 40),
      );
      if (score > 0) combined.set(String(player.id), { ...player, score });
    }
    return Array.from(combined.values()).sort((a, b) => b.score - a.score).slice(0, 20);
  }, [query, remoteResults.players]);

  const visibleTeams = activeTab === "PLAYERS" ? [] : filteredTeams.slice(0, 20);
  const visiblePlayers = activeTab === "TEAMS" ? [] : filteredPlayers;
  const resultCount = visibleTeams.length + visiblePlayers.length;

  return (
    <View style={[s.screen, { backgroundColor: colors.bg }]}>
      {/* Search Header */}
      <View style={[s.header, { borderBottomColor: colors.border2 }]}>
        <Pressable hitSlop={8} style={s.backBtn} onPress={goBack}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={19} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder={my ? "အသင်း၊ ပြိုင်ပွဲ၊ နိုင်ငံ၊ ကစားသမား ရှာရန်…" : "Search clubs, leagues, nations, players…"}
            placeholderTextColor={colors.muted2}
            style={[s.input, { color: colors.text }]}
            returnKeyType="search"
            onSubmitEditing={() => saveRecentSearch(query)}
          />
          {query ? (
            <Pressable hitSlop={8} onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Recent Searches */}
        {!query && recentSearches.length > 0 ? (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={[s.sectionTitle, { color: colors.muted }]}>{my ? "လတ်တလော ရှာဖွေမှုများ" : "RECENT SEARCHES"}</Text>
              <Pressable hitSlop={8} onPress={clearRecentSearches}>
                <Text style={[s.clearText, { color: colors.red }]}>{my ? "ဖျက်မည်" : "Clear"}</Text>
              </Pressable>
            </View>
            <View style={s.recentChips}>
              {recentSearches.map((term) => (
                <Pressable
                  key={term}
                  style={[s.recentChip, { backgroundColor: colors.card, borderColor: colors.border2 }]}
                  onPress={() => setQuery(term)}
                >
                  <Ionicons name="time-outline" size={14} color={colors.muted} />
                  <Text style={[s.recentChipText, { color: colors.text2 }]}>{term}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Live Search Query Results */}
        {query ? (
          <View style={s.section}>
            <View style={s.searchTabs}>
              {["ALL", "TEAMS", "PLAYERS"].map((tab) => (
                <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[s.searchTab, { borderColor: colors.border, backgroundColor: activeTab === tab ? colors.redSoft : colors.card }]}>
                  <Text style={[s.sectionSub, { color: activeTab === tab ? colors.red : colors.muted }]}>{tab}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.sectionHead}>
              <Text style={[s.sectionTitle, { color: colors.muted }]}>
                {my ? `ရှာဖွေတွေ့ရှိချက်များ (${resultCount})` : `SEARCH RESULTS (${resultCount})`}
              </Text>
              {loading ? <ActivityIndicator size="small" color={colors.red} /> : null}
            </View>
            {searchError ? <Text style={[s.errorText, { color: colors.red }]}>{searchError}</Text> : null}
            {visibleTeams.map((team) => (
                <ResultRow
                  key={`team-${team.id || team.name}`}
                  image={team.logo}
                  title={team.name}
                  subtitle={team.country || "Club"}
                  onPress={() => {
                    saveRecentSearch(team.name);
                    openEntity?.("team", team);
                  }}
                  colors={colors}
                />
            ))}
            {visiblePlayers.map((player) => (
              <ResultRow
                key={`player-${player.id}`}
                icon="person-outline"
                image={player.photo}
                title={player.name}
                subtitle={[player.nationality, player.age ? `${player.age} yrs` : null].filter(Boolean).join(" · ") || "Player"}
                onPress={() => {
                  saveRecentSearch(player.name);
                  openEntity?.("player", player);
                }}
                colors={colors}
              />
            ))}
            {resultCount === 0 && !loading ? (
              <View style={s.noResults}>
                <Ionicons name="search-outline" size={32} color={colors.muted} />
                <Text style={[s.noResultsTitle, { color: colors.text }]}>{my ? "ရှာမတွေ့ပါ" : "No results found"}</Text>
                <Text style={[s.noResultsSub, { color: colors.muted }]}>
                  {my ? "အခြားနာမည် သို့မဟုတ် စာလုံးပေါင်း စမ်းကြည့်ပါ။" : "Check the spelling or try a different search term."}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <>
            {/* Myanmar & ASEAN Priority Nations */}
            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={[s.sectionTitle, { color: colors.red }]}>
                  {my ? "မြန်မာနှင့် အာဆီယံ နိုင်ငံ့လက်ရွေးစင်" : "MYANMAR & ASEAN NATIONAL TEAMS"}
                </Text>
                <Text style={[s.sectionSub, { color: colors.muted }]}>ASEAN Priority</Text>
              </View>
              <View style={s.aseanGrid}>
                {ASEAN_NATIONAL_TEAMS.map((nat) => (
                  <Pressable
                    key={nat.name}
                    style={[
                      s.aseanCard,
                      { backgroundColor: colors.card, borderColor: nat.name === "Myanmar" ? colors.red : colors.border2 },
                      nat.name === "Myanmar" && { backgroundColor: colors.redSoft },
                    ]}
                    onPress={() => {
                      saveRecentSearch(nat.name);
                      setQuery(nat.name);
                    }}
                  >
                    <Text style={s.aseanFlag}>{nat.flag}</Text>
                    <Text numberOfLines={1} style={[s.aseanName, { color: colors.text }]}>
                      {nat.name}
                    </Text>
                    <Text style={[s.aseanRank, { color: nat.name === "Myanmar" ? colors.red : colors.muted }]}>
                      FIFA #{nat.rank}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Major European Clubs */}
            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={[s.sectionTitle, { color: colors.muted }]}>
                  {my ? "ဥရောပ ထိပ်တန်းကလပ်အသင်းများ" : "MAJOR EUROPEAN CLUBS"}
                </Text>
                <Text style={[s.sectionSub, { color: colors.muted }]}>Top Leagues</Text>
              </View>
              {POPULAR_SEARCH_TEAMS.map((team) => (
                <ResultRow
                  key={team.id}
                  image={team.logo}
                  title={team.name}
                  subtitle={team.country}
                  onPress={() => {
                    saveRecentSearch(team.name);
                    openEntity?.("team", team);
                  }}
                  colors={colors}
                />
              ))}
            </View>

            {/* Major Global National Teams */}
            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={[s.sectionTitle, { color: colors.muted }]}>
                  {my ? "ကမ္ဘာ့ထိပ်တန်း နိုင်ငံ့လက်ရွေးစင်များ" : "GLOBAL NATIONAL TEAMS"}
                </Text>
                <Text style={[s.sectionSub, { color: colors.muted }]}>FIFA Top Ranked</Text>
              </View>
              {POPULAR_NATIONAL_TEAMS.map((team) => (
                <ResultRow
                  key={team.id}
                  image={team.logo}
                  title={team.name}
                  subtitle={team.country}
                  onPress={() => {
                    saveRecentSearch(team.name);
                    openEntity?.("team", team);
                  }}
                  colors={colors}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  inputWrap: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: { flex: 1, fontSize: 12.5, fontWeight: "600" },
  content: { padding: 14, paddingBottom: 40, gap: 18 },
  section: { gap: 8 },
  searchTabs: { flexDirection: "row", gap: 7, marginBottom: 2 },
  searchTab: { minWidth: 70, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  sectionTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  sectionSub: { fontSize: 9.5, fontWeight: "700" },
  clearText: { fontSize: 11, fontWeight: "800" },
  recentChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  recentChipText: { fontSize: 11, fontWeight: "700" },
  aseanGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 7 },
  aseanCard: {
    width: "31.8%",
    height: 74,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 4,
  },
  aseanFlag: { fontSize: 20 },
  aseanName: { fontSize: 11.5, fontWeight: "800", textAlign: "center" },
  aseanRank: { fontSize: 9, fontWeight: "700" },
  row: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 24, height: 24 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 12.5, fontWeight: "800" },
  rowSub: { fontSize: 9.5, marginTop: 1 },
  noResults: { padding: 40, alignItems: "center", justifyContent: "center", gap: 8 },
  noResultsTitle: { fontSize: 15, fontWeight: "900" },
  noResultsSub: { fontSize: 11, textAlign: "center" },
  errorText: { fontSize: 10.5, lineHeight: 15, paddingHorizontal: 4 },
});
