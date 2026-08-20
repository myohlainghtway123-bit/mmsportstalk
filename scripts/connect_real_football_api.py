from pathlib import Path

path = Path("App.js")
s = path.read_text()

s = s.replace(
    'import React, { useMemo, useState } from "react";',
    'import React, { useCallback, useEffect, useMemo, useState } from "react";'
)

s = s.replace(
    '  Dimensions,\n  Platform,\n} from "react-native";',
    '  Dimensions,\n  Platform,\n  ActivityIndicator,\n  RefreshControl,\n} from "react-native";'
)

s = s.replace(
    'import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";\n',
    'import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";\nimport { fetchFootballMatches, isLiveMatch, offsetDateString } from "./src/services/footballApi";\n'
)

marker = '''// -------------------------------------------------------
// LIVE SCORE COMPONENTS
// -------------------------------------------------------
'''

hook = '''// -------------------------------------------------------
// REAL FOOTBALL DATA
// -------------------------------------------------------

function useFootballMatches(dateString) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else if (!matches.length) setLoading(true);

    try {
      const result = await fetchFootballMatches({ date: dateString });
      setMatches(result.matches);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load football data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateString, matches.length]);

  useEffect(() => {
    load(false);
    const timer = setInterval(() => load(false), 60000);
    return () => clearInterval(timer);
  }, [load]);

  return {
    matches,
    loading,
    refreshing,
    error,
    refresh: () => load(true),
    retry: () => load(false),
  };
}

function FootballFeedState({ loading, error, onRetry, emptyText }) {
  if (loading) {
    return (
      <View style={styles.footballStateCard}>
        <ActivityIndicator size="small" color={COLORS.red} />
        <Text style={styles.footballStateText}>Loading real football data…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.footballStateCard}>
        <Ionicons name="cloud-offline-outline" size={24} color={COLORS.muted} />
        <Text style={styles.footballStateTitle}>Live data unavailable</Text>
        <Text style={styles.footballStateText}>Check your connection and try again.</Text>
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>RETRY</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.footballStateCard}>
      <Ionicons name="football-outline" size={24} color={COLORS.muted} />
      <Text style={styles.footballStateTitle}>{emptyText}</Text>
      <Text style={styles.footballStateText}>Pull down to refresh the latest data.</Text>
    </View>
  );
}

'''

if hook not in s:
    s = s.replace(marker, hook + marker)

old_match = '''function MatchCard({ match, onPress }) {
  return (
    <Pressable style={styles.matchCard} onPress={() => onPress(match)}>
      <View style={styles.matchCardTop}>
        <Text style={styles.competitionLabel}>{match.competition}</Text>

        <View style={styles.liveRow}>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>{match.status}</Text>
          </View>

          <Text style={styles.minuteText}>{match.minute}</Text>
        </View>
      </View>

      <View style={styles.matchTeams}>
        <View style={styles.matchTeam}>
          <TeamLogo uri={match.home.logo} size={38} />

          <Text numberOfLines={1} style={styles.matchTeamName}>
            {match.home.name}
          </Text>
        </View>

        <View style={styles.scoreCenter}>
          <Text style={styles.bigScore}>
            {match.homeScore} - {match.awayScore}
          </Text>

          {match.aggregate ? (
            <Text style={styles.aggregateText}>{match.aggregate}</Text>
          ) : null}
        </View>

        <View style={styles.matchTeam}>
          <TeamLogo uri={match.away.logo} size={38} />

          <Text numberOfLines={1} style={styles.matchTeamName}>
            {match.away.name}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
'''

new_match = '''function MatchCard({ match, onPress }) {
  const live = isLiveMatch(match);
  const hasScore = match.homeScore !== null && match.homeScore !== undefined &&
    match.awayScore !== null && match.awayScore !== undefined;

  return (
    <Pressable style={styles.matchCard} onPress={() => onPress(match)}>
      <View style={styles.matchCardTop}>
        <Text numberOfLines={1} style={styles.competitionLabel}>{match.competition}</Text>

        <View style={styles.liveRow}>
          {live ? (
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          ) : null}

          <Text style={styles.minuteText}>
            {live ? match.minute : (match.minute || match.statusCode || match.status)}
          </Text>
        </View>
      </View>

      <View style={styles.matchTeams}>
        <View style={styles.matchTeam}>
          <TeamLogo uri={match.home.logo} size={38} />

          <Text numberOfLines={1} style={styles.matchTeamName}>
            {match.home.name}
          </Text>
        </View>

        <View style={styles.scoreCenter}>
          <Text style={styles.bigScore}>
            {hasScore ? `${match.homeScore} - ${match.awayScore}` : "VS"}
          </Text>

          {match.aggregate ? (
            <Text style={styles.aggregateText}>{match.aggregate}</Text>
          ) : null}
        </View>

        <View style={styles.matchTeam}>
          <TeamLogo uri={match.away.logo} size={38} />

          <Text numberOfLines={1} style={styles.matchTeamName}>
            {match.away.name}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
'''

if old_match not in s:
    raise SystemExit("MatchCard source block not found")
s = s.replace(old_match, new_match)

old_home = '''function HomeLiveScores({ openMatch, openLeague }) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.pageContent}
    >
      <View style={styles.liveNowRow}>
        <View style={styles.liveNowLeft}>
          <View style={styles.redDot} />
          <Text style={styles.liveNowText}>LIVE NOW</Text>
        </View>

        <Text style={styles.matchCount}>12 Matches</Text>
      </View>

      {LIVE_MATCHES.map((match) => (
        <MatchCard key={match.id} match={match} onPress={openMatch} />
      ))}

      <Pressable style={styles.allScoresButton}>
        <Text style={styles.allScoresText}>ALL LIVE SCORES</Text>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.text}
        />
      </Pressable>

      <CompetitionStrip onLeaguePress={openLeague} />

      <View style={styles.spacerLarge} />
    </ScrollView>
  );
}
'''

new_home = '''function HomeLiveScores({ openMatch, openLeague }) {
  const today = offsetDateString(0);
  const { matches, loading, refreshing, error, refresh, retry } = useFootballMatches(today);
  const liveMatches = useMemo(() => matches.filter(isLiveMatch), [matches]);
  const visibleMatches = liveMatches.slice(0, 5);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.pageContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={COLORS.red}
          colors={[COLORS.red]}
        />
      }
    >
      <View style={styles.liveNowRow}>
        <View style={styles.liveNowLeft}>
          <View style={styles.redDot} />
          <Text style={styles.liveNowText}>LIVE NOW</Text>
        </View>

        <Text style={styles.matchCount}>
          {liveMatches.length} {liveMatches.length === 1 ? "Match" : "Matches"}
        </Text>
      </View>

      {visibleMatches.length ? (
        visibleMatches.map((match) => (
          <MatchCard key={match.id} match={match} onPress={openMatch} />
        ))
      ) : (
        <FootballFeedState
          loading={loading}
          error={error}
          onRetry={retry}
          emptyText="No live matches right now"
        />
      )}

      <View style={styles.apiConnectedRow}>
        <View style={styles.apiConnectedDot} />
        <Text style={styles.apiConnectedText}>LIVE DATA · MST FOOTBALL API</Text>
      </View>

      <Pressable style={styles.allScoresButton}>
        <Text style={styles.allScoresText}>ALL LIVE SCORES</Text>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.text}
        />
      </Pressable>

      <CompetitionStrip onLeaguePress={openLeague} />

      <View style={styles.spacerLarge} />
    </ScrollView>
  );
}
'''

if old_home not in s:
    raise SystemExit("HomeLiveScores source block not found")
s = s.replace(old_home, new_home)

start = s.index('function ScoresScreen({ openMatch, openLeague }) {')
end_marker = '\n// -------------------------------------------------------\n// FAVORITES\n// -------------------------------------------------------\n'
end = s.index(end_marker, start)
old_scores = s[start:end]
new_scores = '''function ScoresScreen({ openMatch, openLeague }) {
  const [date, setDate] = useState("TODAY");
  const dateOffset = date === "YESTERDAY" ? -1 : date === "TOMORROW" ? 1 : 0;
  const selectedDate = offsetDateString(dateOffset);
  const { matches, loading, refreshing, error, refresh, retry } = useFootballMatches(selectedDate);
  const liveCount = useMemo(() => matches.filter(isLiveMatch).length, [matches]);

  return (
    <View style={styles.screen}>
      <View style={styles.simpleTopHeader}>
        <Text style={styles.pageTitle}>Scores</Text>

        <View style={styles.headerIcons}>
          <IconButton icon="calendar-outline" />
          <IconButton icon="search-outline" />
        </View>
      </View>

      <View style={styles.dateTabs}>
        {["YESTERDAY", "TODAY", "TOMORROW"].map((item) => (
          <Pressable
            key={item}
            style={[
              styles.dateTab,
              date === item && styles.dateTabActive,
            ]}
            onPress={() => setDate(item)}
          >
            <Text
              style={[
                styles.dateTabText,
                date === item && styles.dateTabTextActive,
              ]}
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pageContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={COLORS.red}
            colors={[COLORS.red]}
          />
        }
      >
        <View style={styles.liveNowRow}>
          <View style={styles.liveNowLeft}>
            {liveCount > 0 ? <View style={styles.redDot} /> : null}
            <Text style={styles.liveNowText}>{date}</Text>
          </View>

          <Text style={styles.matchCount}>
            {matches.length} {matches.length === 1 ? "match" : "matches"}
            {liveCount > 0 ? ` · ${liveCount} live` : ""}
          </Text>
        </View>

        {matches.length ? (
          matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onPress={openMatch}
            />
          ))
        ) : (
          <FootballFeedState
            loading={loading}
            error={error}
            onRetry={retry}
            emptyText={`No matches for ${date.toLowerCase()}`}
          />
        )}

        <View style={styles.apiConnectedRow}>
          <View style={styles.apiConnectedDot} />
          <Text style={styles.apiConnectedText}>DATA · MYANMARSPORTSTALK.COM</Text>
        </View>

        <CompetitionStrip onLeaguePress={openLeague} />

        <View style={styles.spacerLarge} />
      </ScrollView>
    </View>
  );
}
'''
s = s[:start] + new_scores + s[end:]

styles_anchor = '''  // LIVE ------------------------------------------------

  liveNowRow: {'''
styles_insert = '''  footballStateCard: {
    minHeight: 118,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  footballStateTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
  },

  footballStateText: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 6,
    textAlign: "center",
  },

  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.red,
  },

  retryButtonText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "800",
  },

  apiConnectedRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  apiConnectedDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.red,
  },

  apiConnectedText: {
    color: COLORS.muted2,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // LIVE ------------------------------------------------

  liveNowRow: {'''
if styles_anchor not in s:
    raise SystemExit("Styles anchor not found")
s = s.replace(styles_anchor, styles_insert)

# Guard against accidentally reverting the user's chosen visual system.
required = [
    'red: "#F3262D"',
    '<Text style={styles.logoText}>MST</Text>',
    'fetchFootballMatches',
    'MST FOOTBALL API',
    'visibleMatches = liveMatches.slice(0, 5)',
]
for item in required:
    if item not in s:
        raise SystemExit(f"Required integration marker missing: {item}")

path.write_text(s)
print("Connected App.js to real MST football API")
