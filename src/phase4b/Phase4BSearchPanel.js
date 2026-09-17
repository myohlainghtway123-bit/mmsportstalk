import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { searchFootballEntities } from "../services/smartSearchApi";
import { useTheme } from "../theme/ThemeContext";

const C = { surface:"#101417", raised:"#171C20", border:"#293036", text:"#FFFFFF", secondary:"#D4D8DB", muted:"#929AA0", red:"#F3262D", amber:"#F4C84D" };

const FEATURED_COMPETITIONS = [
  { id: 39, name: "Premier League", country: "England", logo: "https://media.api-sports.io/football/leagues/39.png" },
  { id: 2, name: "UEFA Champions League", country: "Europe", logo: "https://media.api-sports.io/football/leagues/2.png" },
  { id: 140, name: "La Liga", country: "Spain", logo: "https://media.api-sports.io/football/leagues/140.png" },
  { id: 135, name: "Serie A", country: "Italy", logo: "https://media.api-sports.io/football/leagues/135.png" },
  { id: 78, name: "Bundesliga", country: "Germany", logo: "https://media.api-sports.io/football/leagues/78.png" },
  { id: 61, name: "Ligue 1", country: "France", logo: "https://media.api-sports.io/football/leagues/61.png" },
];

const FEATURED_TEAMS = [
  { id: 33, name: "Manchester United", country: "England", logo: "https://media.api-sports.io/football/teams/33.png" },
  { id: 50, name: "Manchester City", country: "England", logo: "https://media.api-sports.io/football/teams/50.png" },
  { id: 541, name: "Real Madrid", country: "Spain", logo: "https://media.api-sports.io/football/teams/541.png" },
  { id: 529, name: "Barcelona", country: "Spain", logo: "https://media.api-sports.io/football/teams/529.png" },
  { id: 40, name: "Liverpool", country: "England", logo: "https://media.api-sports.io/football/teams/40.png" },
  { id: 42, name: "Arsenal", country: "England", logo: "https://media.api-sports.io/football/teams/42.png" },
  { id: 49, name: "Chelsea", country: "England", logo: "https://media.api-sports.io/football/teams/49.png" },
  { id: 157, name: "Bayern Munich", country: "Germany", logo: "https://media.api-sports.io/football/teams/157.png" },
  { id: 1563, name: "Myanmar National Team", country: "Myanmar", logo: "https://media.api-sports.io/football/teams/1563.png" },
  { id: 1568, name: "Thailand National Team", country: "Thailand", logo: "https://media.api-sports.io/football/teams/1568.png" },
];

function Mark({ uri, fallback, colors = C }) {
  return uri ? (
    <Image source={{ uri }} resizeMode="contain" style={s.image} />
  ) : (
    <View style={[s.fallback, { backgroundColor: colors.raised || C.raised }]}>
      <Text style={[s.fallbackText, { color: colors.secondary || C.secondary }]}>
        {String(fallback || "?").slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

function Result({ type, row, onSelect, colors = C }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Select ${row.name}`}
      onPress={() => onSelect && onSelect(type.toLowerCase(), row)}
      style={[s.row, { borderTopColor: colors.border || C.border }]}
    >
      <Mark uri={row.logo || row.photo} fallback={row.name} colors={colors} />
      <View style={s.flex}>
        <Text numberOfLines={1} style={[s.name, { color: colors.secondary || colors.text || C.secondary }]}>
          {row.name}
        </Text>
        <Text numberOfLines={1} style={[s.meta, { color: colors.muted || C.muted }]}>
          {type === "Team" ? row.country || "Team" : type === "Competition" ? row.country || "League" : row.nationality || "Player"}
        </Text>
      </View>
      <Text style={[s.type, { color: colors.muted || C.muted }]}>{type.toUpperCase()}</Text>
      <Ionicons name="chevron-forward" size={14} color={colors.muted || C.muted} style={{ marginLeft: 6 }} />
    </Pressable>
  );
}

function MatchResult({ match, onSelect, colors = C }) {
  const home = match?.home_team_name || match?.homeTeam?.name || match?.home?.name || "Home";
  const away = match?.away_team_name || match?.awayTeam?.name || match?.away?.name || "Away";
  const comp = match?.competition_name || match?.competition?.name || "Match";
  const score = (match?.home_score != null && match?.away_score != null)
    ? `${match.home_score} - ${match.away_score}`
    : match?.status_detail || match?.status || "vs";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Match ${home} vs ${away}`}
      onPress={() => onSelect && onSelect(match)}
      style={[s.row, { borderTopColor: colors.border || C.border }]}
    >
      <View style={[s.fallback, { backgroundColor: colors.raised || C.raised }]}>
        <Ionicons name="football-outline" size={16} color={colors.red || C.red} />
      </View>
      <View style={s.flex}>
        <Text numberOfLines={1} style={[s.name, { color: colors.secondary || colors.text || C.secondary }]}>
          {home} vs {away}
        </Text>
        <Text numberOfLines={1} style={[s.meta, { color: colors.muted || C.muted }]}>
          {comp} · {score}
        </Text>
      </View>
      <Text style={[s.type, { color: colors.red || C.red }]}>MATCH</Text>
      <Ionicons name="chevron-forward" size={14} color={colors.muted || C.muted} style={{ marginLeft: 6 }} />
    </Pressable>
  );
}

export default function Phase4BSearchPanel({ onOpenEntity, onOpenMatch, matches = [], language = "my" }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState({ loading: false, teams: [], players: [], error: "", stale: false });
  const request = useRef(0);

  let colors = C;
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
  } catch {}

  useEffect(() => {
    const cleaned = query.trim();
    if (cleaned.length < 3) {
      setState({ loading: false, teams: [], players: [], error: "", stale: false });
      return;
    }
    const id = ++request.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: "" }));
        const result = await searchFootballEntities(cleaned, { signal: controller.signal });
        if (id !== request.current) return;
        setState({
          loading: false,
          teams: result.teams || [],
          players: result.players || [],
          error: "",
          stale: Boolean(result.stale),
        });
      } catch (error) {
        if (error?.name === "AbortError" || id !== request.current) return;
        setState({ loading: false, teams: [], players: [], error: error?.message || "Search is unavailable.", stale: false });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const cleanedQuery = query.trim().toLowerCase();
  const isTyping = cleanedQuery.length >= 2;

  // Filter competitions
  const matchingCompetitions = isTyping
    ? FEATURED_COMPETITIONS.filter((c) =>
        c.name.toLowerCase().includes(cleanedQuery) ||
        (c.country && c.country.toLowerCase().includes(cleanedQuery))
      )
    : [];

  // Filter matches
  const matchingMatches = isTyping && Array.isArray(matches)
    ? matches.filter((m) => {
        const h = String(m?.home_team_name || m?.homeTeam?.name || m?.home?.name || "").toLowerCase();
        const a = String(m?.away_team_name || m?.awayTeam?.name || m?.away?.name || "").toLowerCase();
        const comp = String(m?.competition_name || m?.competition?.name || "").toLowerCase();
        return h.includes(cleanedQuery) || a.includes(cleanedQuery) || comp.includes(cleanedQuery);
      }).slice(0, 6)
    : [];

  // Filter featured teams if search API returned empty
  const matchingFeaturedTeams = isTyping && state.teams.length === 0
    ? FEATURED_TEAMS.filter((t) =>
        t.name.toLowerCase().includes(cleanedQuery) ||
        (t.country && t.country.toLowerCase().includes(cleanedQuery))
      )
    : [];

  const displayTeams = state.teams.length > 0 ? state.teams.slice(0, 8) : matchingFeaturedTeams;
  const total = displayTeams.length + state.players.length + matchingCompetitions.length + matchingMatches.length;

  return (
    <View style={[s.card, { backgroundColor: colors.surface || C.surface, borderColor: colors.border || C.border }]}>
      <Text style={[s.eyebrow, { color: colors.red || C.red }]}>{language === "my" ? "ရှာဖွေရန်" : "SEARCH"}</Text>
      <Text style={[s.title, { color: colors.text || C.text }]}>{language === "my" ? "ပွဲစဉ်များ၊ လိဂ်များ၊ အသင်းများနှင့် ကစားသမားများ" : "Matches, leagues, clubs & players"}</Text>

      <View style={[s.inputWrap, { backgroundColor: colors.raised || C.raised, borderColor: colors.border || C.border }]}>
        <Ionicons name="search-outline" size={17} color={colors.muted || C.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={language === "my" ? "ပွဲစဉ်၊ အသင်း၊ ပြိုင်ပွဲ၊ ကစားသမား ရှာဖွေပါ..." : "Search matches, clubs, leagues, or players"}
          placeholderTextColor={colors.muted || C.muted}
          autoCorrect={false}
          style={[s.input, { color: colors.text || C.text }]}
        />
        {state.loading ? <ActivityIndicator size="small" color={colors.red || C.red} /> : null}
      </View>

      {state.stale ? <Text style={[s.warning, { color: colors.gold || C.amber }]}>{language === "my" ? "ယခင်မှတ်ဉာဏ်ဒေတာကို ပြသနေပါသည်။" : "Showing cached search data."}</Text> : null}
      {state.error ? <Text style={[s.warning, { color: colors.gold || C.amber }]}>{state.error}</Text> : null}

      {isTyping && !state.loading && !state.error && total === 0 ? (
        <Text style={[s.empty, { color: colors.muted || C.muted }]}>
          {language === "my" ? `"${query}" နှင့် ကိုက်ညီသော ရလဒ် မရှိပါ။` : `No results matching "${query}".`}
        </Text>
      ) : null}

      {/* Match Results */}
      {matchingMatches.map((match, idx) => (
        <MatchResult
          key={`match-${match.id || idx}`}
          match={match}
          onSelect={onOpenMatch}
          colors={colors}
        />
      ))}

      {/* Competition Results */}
      {matchingCompetitions.map((comp) => (
        <Result
          key={`comp-${comp.id}`}
          type="Competition"
          row={comp}
          onSelect={onOpenEntity}
          colors={colors}
        />
      ))}

      {/* Team Results */}
      {displayTeams.map((row) => (
        <Result key={`team-${row.id}`} type="Team" row={row} onSelect={onOpenEntity} colors={colors} />
      ))}

      {/* Player Results */}
      {state.players.slice(0, 8).map((row) => (
        <Result key={`player-${row.id}`} type="Player" row={row} onSelect={onOpenEntity} colors={colors} />
      ))}

      {/* When input is empty, show Quick Access Competitions and Popular Clubs */}
      {!isTyping ? (
        <View style={{ marginTop: 14 }}>
          <Text style={[s.popularHeading, { color: colors.muted || C.muted }]}>
            {language === "my" ? "လူကြိုက်များသော ပြိုင်ပွဲများ" : "FEATURED COMPETITIONS"}
          </Text>
          {FEATURED_COMPETITIONS.map((comp) => (
            <Result
              key={`featured-comp-${comp.id}`}
              type="Competition"
              row={comp}
              onSelect={onOpenEntity}
              colors={colors}
            />
          ))}

          <Text style={[s.popularHeading, { color: colors.muted || C.muted, marginTop: 16 }]}>
            {language === "my" ? "လူကြိုက်များသော ဘောလုံးအသင်းများ" : "FEATURED FOOTBALL CLUBS"}
          </Text>
          {FEATURED_TEAMS.map((team) => (
            <Result
              key={`featured-team-${team.id}`}
              type="Team"
              row={team}
              onSelect={onOpenEntity}
              colors={colors}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 13, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 14, marginBottom: 10 },
  eyebrow: { color: C.red, fontSize: 11, fontWeight: "900", letterSpacing: 0.7 },
  title: { color: C.text, fontSize: 16, fontWeight: "900", marginTop: 3 },
  inputWrap: { minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.raised, marginTop: 9, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 8 },
  row: { minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, flexDirection: "row", alignItems: "center", gap: 10 },
  image: { width: 32, height: 32 },
  fallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" },
  fallbackText: { color: C.secondary, fontSize: 12, fontWeight: "900" },
  flex: { flex: 1, minWidth: 0 },
  name: { color: C.secondary, fontSize: 13.5, fontWeight: "800" },
  meta: { color: C.muted, fontSize: 12, marginTop: 2 },
  type: { color: C.muted, fontSize: 11, fontWeight: "900" },
  warning: { color: C.amber, fontSize: 12.5, lineHeight: 17, marginTop: 8 },
  empty: { color: C.muted, fontSize: 13, marginTop: 12, textAlign: "center", paddingVertical: 8 },
  popularHeading: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8, marginBottom: 4 },
});

