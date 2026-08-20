import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  extractArray,
  extractObject,
  fetchCompetitionBundle,
  fetchFootballMatches,
  fetchMatchBundle,
  fetchPlayerBundle,
  fetchTeamBundle,
  flattenDisplayRows,
  isLiveMatch,
  normalizeFootballMatch,
  normalizePlayers,
  normalizeScorers,
  normalizeStandings,
  normalizeTeams,
  offsetDateString,
} from "./services/footballApi";

const { width } = Dimensions.get("window");

const C = {
  bg: "#080A0C",
  bg2: "#0B0E10",
  card: "#111416",
  card2: "#15191C",
  border: "#24292D",
  border2: "#1D2226",
  red: "#F3262D",
  redSoft: "rgba(243,38,45,0.14)",
  text: "#FFFFFF",
  text2: "#D0D2D4",
  muted: "#92979B",
  muted2: "#666D72",
  green: "#31C674",
  yellow: "#F5C542",
};

const POPULAR_COMPETITIONS = [
  { id: 2, name: "UEFA Champions League", country: "Europe", icon: "soccer" },
  { id: 39, name: "Premier League", country: "England", icon: "crown-outline" },
  { id: 140, name: "LaLiga", country: "Spain", icon: "soccer-field" },
  { id: 135, name: "Serie A", country: "Italy", icon: "shield-outline" },
  { id: 78, name: "Bundesliga", country: "Germany", icon: "run-fast" },
  { id: 61, name: "Ligue 1", country: "France", icon: "shield-star-outline" },
];

const POPULAR_TEAMS = [
  { id: 541, name: "Real Madrid", logo: "https://media.api-sports.io/football/teams/541.png" },
  { id: 50, name: "Manchester City", logo: "https://media.api-sports.io/football/teams/50.png" },
  { id: 529, name: "Barcelona", logo: "https://media.api-sports.io/football/teams/529.png" },
  { id: 40, name: "Liverpool", logo: "https://media.api-sports.io/football/teams/40.png" },
  { id: 42, name: "Arsenal", logo: "https://media.api-sports.io/football/teams/42.png" },
];

const DEMO_NEWS = [
  "Latest football news from Myanmar Sports Talk",
  "Transfer updates and breaking stories",
  "Match previews, analysis and opinions",
];

function useApi(key, fetcher) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const [state, setState] = useState({ loading: true, refreshing: false, error: null, data: null });

  const load = useCallback(async (refresh = false) => {
    if (!key) {
      setState({ loading: false, refreshing: false, error: "Data ID unavailable.", data: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: !refresh && !prev.data, refreshing: refresh, error: null }));
    try {
      const data = await fetcherRef.current();
      setState({ loading: false, refreshing: false, error: null, data });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, refreshing: false, error: error?.message || "Unable to load data." }));
    }
  }, [key]);

  useEffect(() => { load(false); }, [load]);
  return { ...state, reload: () => load(false), refresh: () => load(true) };
}

function TeamLogo({ uri, size = 38 }) {
  return uri ? (
    <Image source={{ uri }} resizeMode="contain" style={{ width: size, height: size }} />
  ) : (
    <View style={[styles.logoFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="football-outline" size={Math.max(16, size * 0.55)} color={C.muted} />
    </View>
  );
}

function IconButton({ icon, dot = false }) {
  return (
    <View style={styles.iconButton}>
      <Ionicons name={icon} size={26} color={C.text} />
      {dot ? <View style={styles.notificationDot} /> : null}
    </View>
  );
}

function MainHeader() {
  return (
    <View style={styles.mainHeader}>
      <View style={styles.logoWrap}>
        <Text style={styles.logoText}>MST</Text>
        <Text style={styles.logoSub}>MYANMAR SPORTS TALK</Text>
      </View>
      <View style={styles.headerIcons}>
        <IconButton icon="notifications-outline" dot />
        <IconButton icon="search-outline" />
      </View>
    </View>
  );
}

const HEADER_TABS = ["LIVE SCORES", "NEWS", "VIDEOS", "TRANSFERS"];
function HeaderTabs({ active, onChange }) {
  return (
    <View style={styles.headerTabs}>
      {HEADER_TABS.map((tab) => (
        <Pressable key={tab} style={styles.headerTab} onPress={() => onChange(tab)}>
          <Text style={[styles.headerTabText, active === tab && styles.headerTabTextActive]}>{tab}</Text>
          {active === tab ? <View style={styles.headerTabIndicator} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

const BOTTOM_TABS = [
  ["home", "Home", "home-outline", "home"],
  ["scores", "Scores", "calendar-outline", "calendar"],
  ["favorites", "Favorites", "star-outline", "star"],
  ["prediction", "Prediction", "football-outline", "football"],
  ["more", "More", "ellipsis-horizontal", "ellipsis-horizontal"],
];
function BottomNav({ active, onChange }) {
  return (
    <View style={styles.bottomNav}>
      {BOTTOM_TABS.map(([id, label, icon, activeIcon]) => {
        const selected = active === id;
        return (
          <Pressable key={id} style={styles.bottomNavItem} onPress={() => onChange(id)}>
            <Ionicons name={selected ? activeIcon : icon} size={25} color={selected ? C.red : C.muted} />
            <Text style={[styles.bottomNavText, selected && styles.bottomNavTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionHeader({ title, right }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right ? <Text style={styles.sectionRight}>{right}</Text> : null}
    </View>
  );
}

function DataState({ loading, error, empty = "No data available", retry }) {
  if (loading) {
    return <View style={styles.stateCard}><ActivityIndicator color={C.red} /><Text style={styles.stateText}>Loading real football data…</Text></View>;
  }
  if (error) {
    return (
      <View style={styles.stateCard}>
        <Ionicons name="cloud-offline-outline" size={25} color={C.muted} />
        <Text style={styles.stateTitle}>Data unavailable</Text>
        <Text style={styles.stateText}>{error}</Text>
        {retry ? <Pressable style={styles.retryButton} onPress={retry}><Text style={styles.retryText}>RETRY</Text></Pressable> : null}
      </View>
    );
  }
  return <View style={styles.stateCard}><Ionicons name="football-outline" size={25} color={C.muted} /><Text style={styles.stateTitle}>{empty}</Text></View>;
}

function GenericRows({ data, limit = 50 }) {
  const rows = flattenDisplayRows(data).slice(0, limit);
  if (!rows.length) return <DataState empty="No data available" />;
  return (
    <View style={styles.listCard}>
      {rows.map((row, index) => (
        <View key={`${row.label}-${index}`} style={[styles.infoRow, index !== rows.length - 1 && styles.rowBorder]}>
          <Text numberOfLines={2} style={styles.infoLabel}>{row.label}</Text>
          <Text numberOfLines={4} style={styles.infoValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function MatchCard({ match, onPress }) {
  const live = isLiveMatch(match);
  const hasScore = match.homeScore !== null && match.homeScore !== undefined && match.awayScore !== null && match.awayScore !== undefined;
  const finished = ["FT", "AET", "PEN"].includes(String(match.statusCode || "").toUpperCase());
  return (
    <Pressable style={styles.matchCard} onPress={() => onPress(match)}>
      <View style={styles.matchCardTop}>
        <Text numberOfLines={1} style={styles.competitionLabel}>{match.competition}</Text>
        <View style={styles.liveRow}>
          {live ? <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>LIVE</Text></View> : null}
          <Text style={[styles.minuteText, live && { color: C.red }]}>{live ? match.minute : finished ? match.statusCode : match.minute}</Text>
        </View>
      </View>
      <View style={styles.matchTeams}>
        <View style={styles.matchTeam}><TeamLogo uri={match.home?.logo} size={42} /><Text numberOfLines={1} style={styles.matchTeamName}>{match.home?.name}</Text></View>
        <View style={styles.scoreCenter}>
          <Text style={styles.bigScore}>{hasScore ? `${match.homeScore} - ${match.awayScore}` : "VS"}</Text>
          {match.aggregate ? <Text style={styles.aggregateText}>{String(match.aggregate)}</Text> : null}
        </View>
        <View style={styles.matchTeam}><TeamLogo uri={match.away?.logo} size={42} /><Text numberOfLines={1} style={styles.matchTeamName}>{match.away?.name}</Text></View>
      </View>
    </Pressable>
  );
}

function CompetitionStrip({ openLeague }) {
  return (
    <View>
      <SectionHeader title="TOP COMPETITIONS" right="See All" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.competitionStrip}>
        {POPULAR_COMPETITIONS.map((item) => (
          <Pressable key={item.id} style={styles.competitionItem} onPress={() => openLeague(item)}>
            <MaterialCommunityIcons name={item.icon} size={25} color={C.text} />
            <Text numberOfLines={2} style={styles.competitionName}>{item.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function HomeLiveScores({ openMatch, openLeague }) {
  const date = offsetDateString(0);
  const api = useApi(date, () => fetchFootballMatches({ date }));
  const matches = api.data?.matches || [];
  const live = matches.filter(isLiveMatch);
  const visible = live.slice(0, 5);

  useEffect(() => {
    const timer = setInterval(api.reload, 60000);
    return () => clearInterval(timer);
  }, [api.reload]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.pageContent}
      refreshControl={<RefreshControl refreshing={api.refreshing} onRefresh={api.refresh} colors={[C.red]} tintColor={C.red} />}
    >
      <View style={styles.liveNowRow}>
        <View style={styles.liveNowLeft}><View style={styles.redDot} /><Text style={styles.liveNowText}>LIVE NOW</Text></View>
        <Text style={styles.matchCount}>{live.length} {live.length === 1 ? "Match" : "Matches"}</Text>
      </View>
      {visible.length ? visible.map((match) => <MatchCard key={match.id} match={match} onPress={openMatch} />) : <DataState loading={api.loading} error={api.error} retry={api.reload} empty="No live matches right now" />}
      <Pressable style={styles.allScoresButton}><Text style={styles.allScoresText}>ALL LIVE SCORES</Text><Ionicons name="chevron-forward" size={21} color={C.text} /></Pressable>
      <CompetitionStrip openLeague={openLeague} />
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function SimpleEditorial({ type }) {
  const labels = type === "VIDEOS" ? ["MST Football Documentary", "Match Analysis", "Football History"] : type === "TRANSFERS" ? ["Transfer updates", "Rumours", "Confirmed deals"] : DEMO_NEWS;
  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <SectionHeader title={type} />
      {labels.map((label, index) => (
        <View key={label} style={styles.editorialCard}>
          <View style={styles.editorialIcon}><Ionicons name={type === "VIDEOS" ? "play" : type === "TRANSFERS" ? "swap-horizontal" : "newspaper-outline"} size={24} color={C.red} /></View>
          <View style={{ flex: 1 }}><Text style={styles.editorialTitle}>{label}</Text><Text style={styles.editorialMeta}>MST content connection comes after football data.</Text></View>
        </View>
      ))}
    </ScrollView>
  );
}

function HomeScreen({ openMatch, openLeague }) {
  const [tab, setTab] = useState("LIVE SCORES");
  return (
    <View style={styles.screen}>
      <MainHeader />
      <HeaderTabs active={tab} onChange={setTab} />
      <View style={{ flex: 1 }}>
        {tab === "LIVE SCORES" ? <HomeLiveScores openMatch={openMatch} openLeague={openLeague} /> : <SimpleEditorial type={tab} />}
      </View>
    </View>
  );
}

function ScoresScreen({ openMatch, openLeague }) {
  const [selected, setSelected] = useState("TODAY");
  const offset = selected === "YESTERDAY" ? -1 : selected === "TOMORROW" ? 1 : 0;
  const date = offsetDateString(offset);
  const api = useApi(date, () => fetchFootballMatches({ date }));
  const matches = api.data?.matches || [];
  return (
    <View style={styles.screen}>
      <View style={styles.simpleHeader}><Text style={styles.pageTitle}>Scores</Text><View style={styles.headerIcons}><IconButton icon="calendar-outline" /><IconButton icon="search-outline" /></View></View>
      <View style={styles.dateTabs}>{["YESTERDAY", "TODAY", "TOMORROW"].map((item) => <Pressable key={item} style={[styles.dateTab, selected === item && styles.dateTabActive]} onPress={() => setSelected(item)}><Text style={[styles.dateTabText, selected === item && styles.dateTabTextActive]}>{item}</Text></Pressable>)}</View>
      <ScrollView contentContainerStyle={styles.pageContent} refreshControl={<RefreshControl refreshing={api.refreshing} onRefresh={api.refresh} colors={[C.red]} tintColor={C.red} />}>
        <SectionHeader title={selected === "TODAY" ? "TODAY'S MATCHES" : selected} right={`${matches.length} matches`} />
        {matches.length ? matches.map((match) => <MatchCard key={match.id} match={match} onPress={openMatch} />) : <DataState loading={api.loading} error={api.error} retry={api.reload} empty="No matches found" />}
        <CompetitionStrip openLeague={openLeague} />
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function FavoritesScreen({ openLeague, openTeam, openPlayer }) {
  const [section, setSection] = useState("Leagues");
  return (
    <View style={styles.screen}>
      <View style={styles.simpleHeader}><Text style={styles.pageTitle}>Favorites</Text><IconButton icon="search-outline" /></View>
      <View style={styles.segment}>{["Leagues", "Teams", "Players"].map((x) => <Pressable key={x} style={[styles.segmentItem, section === x && styles.segmentActive]} onPress={() => setSection(x)}><Text style={[styles.segmentText, section === x && styles.segmentTextActive]}>{x}</Text></Pressable>)}</View>
      <ScrollView contentContainerStyle={styles.pageContent}>
        {section === "Leagues" ? <View style={styles.listCard}>{POPULAR_COMPETITIONS.map((league, index) => <Pressable key={league.id} style={[styles.listRow, index !== POPULAR_COMPETITIONS.length - 1 && styles.rowBorder]} onPress={() => openLeague(league)}><View style={styles.rowLeft}><MaterialCommunityIcons name={league.icon} size={22} color={C.text2} /><Text style={styles.rowText}>{league.name}</Text></View><Ionicons name="star-outline" size={19} color={C.muted} /></Pressable>)}</View> : null}
        {section === "Teams" ? <View style={styles.listCard}>{POPULAR_TEAMS.map((team, index) => <Pressable key={team.id} style={[styles.listRow, index !== POPULAR_TEAMS.length - 1 && styles.rowBorder]} onPress={() => openTeam(team)}><View style={styles.rowLeft}><TeamLogo uri={team.logo} size={28} /><Text style={styles.rowText}>{team.name}</Text></View><Ionicons name="star-outline" size={19} color={C.muted} /></Pressable>)}</View> : null}
        {section === "Players" ? <Pressable style={styles.editorialCard} onPress={() => openPlayer({ id: 1100, name: "Erling Haaland" })}><Ionicons name="person-circle-outline" size={40} color={C.text2} /><View><Text style={styles.editorialTitle}>Open player profile</Text><Text style={styles.editorialMeta}>Real profile · stats · transfers · trophies · sidelined</Text></View></Pressable> : null}
      </ScrollView>
    </View>
  );
}

function PredictionScreen({ openMatch }) {
  const today = offsetDateString(0);
  const tomorrow = offsetDateString(1);
  const todayApi = useApi(`pred-${today}`, () => fetchFootballMatches({ date: today }));
  const tomorrowApi = useApi(`pred-${tomorrow}`, () => fetchFootballMatches({ date: tomorrow }));
  const [predictions, setPredictions] = useState({});
  const matches = useMemo(() => [...(todayApi.data?.matches || []), ...(tomorrowApi.data?.matches || [])].filter((m) => !isLiveMatch(m) && !m.isFinished).slice(0, 12), [todayApi.data, tomorrowApi.data]);
  return (
    <View style={styles.screen}>
      <View style={styles.simpleHeader}><View><Text style={styles.pageTitle}>Prediction</Text><Text style={styles.pageSubtitle}>Predict before kickoff</Text></View><IconButton icon="trophy-outline" /></View>
      <ScrollView contentContainerStyle={styles.pageContent}>
        <View style={styles.notice}><Ionicons name="information-circle-outline" size={20} color={C.red} /><Text style={styles.noticeText}>These use real fixtures. Saving points to your MST account comes next.</Text></View>
        <SectionHeader title="PREDICT MATCHES" right={`${Object.keys(predictions).length}/${matches.length}`} />
        {matches.length ? matches.map((match) => {
          const selected = predictions[match.id];
          return <View key={match.id} style={styles.predictionCard}><Pressable onPress={() => openMatch(match)}><Text style={styles.competitionLabel}>{match.competition}</Text><View style={styles.predictionTeams}><View style={styles.predTeam}><TeamLogo uri={match.home.logo} size={40} /><Text numberOfLines={2} style={styles.predName}>{match.home.name}</Text></View><Text style={styles.vs}>VS</Text><View style={styles.predTeam}><TeamLogo uri={match.away.logo} size={40} /><Text numberOfLines={2} style={styles.predName}>{match.away.name}</Text></View></View></Pressable><View style={styles.predButtons}>{[["home","Home"],["draw","Draw"],["away","Away"]].map(([id,label]) => <Pressable key={id} style={[styles.predButton, selected === id && styles.predButtonActive]} onPress={() => setPredictions((p) => ({ ...p, [match.id]: id }))}><Text style={[styles.predButtonText, selected === id && styles.predButtonTextActive]}>{label}</Text></Pressable>)}</View></View>;
        }) : <DataState loading={todayApi.loading || tomorrowApi.loading} error={todayApi.error || tomorrowApi.error} empty="No upcoming fixtures" />}
      </ScrollView>
    </View>
  );
}

function MoreScreen({ openLeague, openTeam, openPlayer }) {
  return (
    <View style={styles.screen}>
      <View style={styles.simpleHeader}><Text style={styles.pageTitle}>Discover</Text><IconButton icon="search-outline" /></View>
      <ScrollView contentContainerStyle={styles.pageContent}>
        <SectionHeader title="POPULAR LEAGUES" />
        <View style={styles.listCard}>{POPULAR_COMPETITIONS.map((league, index) => <Pressable key={league.id} style={[styles.listRow, index !== POPULAR_COMPETITIONS.length - 1 && styles.rowBorder]} onPress={() => openLeague(league)}><View style={styles.rowLeft}><MaterialCommunityIcons name={league.icon} size={22} color={C.text2} /><Text style={styles.rowText}>{league.name}</Text></View><Ionicons name="chevron-forward" size={18} color={C.muted} /></Pressable>)}</View>
        <SectionHeader title="POPULAR TEAMS" />
        <View style={styles.listCard}>{POPULAR_TEAMS.map((team, index) => <Pressable key={team.id} style={[styles.listRow, index !== POPULAR_TEAMS.length - 1 && styles.rowBorder]} onPress={() => openTeam(team)}><View style={styles.rowLeft}><TeamLogo uri={team.logo} size={27} /><Text style={styles.rowText}>{team.name}</Text></View><Ionicons name="chevron-forward" size={18} color={C.muted} /></Pressable>)}</View>
        <SectionHeader title="PLAYERS" />
        <Pressable style={styles.editorialCard} onPress={() => openPlayer({ id: 1100, name: "Erling Haaland" })}><Ionicons name="people-outline" size={28} color={C.red} /><View><Text style={styles.editorialTitle}>Player profiles</Text><Text style={styles.editorialMeta}>Open a real player data page</Text></View></Pressable>
        <SectionHeader title="ACCOUNT & APP" />
        <View style={styles.listCard}>{["My Account", "Notifications", "Dark Mode", "Language", "Settings"].map((x, i) => <View key={x} style={[styles.listRow, i !== 4 && styles.rowBorder]}><Text style={styles.rowText}>{x}</Text><Ionicons name="chevron-forward" size={18} color={C.muted} /></View>)}</View>
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function eventMinute(event) {
  const t = event?.time || {};
  const m = t.elapsed ?? event?.elapsed ?? event?.minute;
  const e = t.extra ?? event?.extra;
  return m === undefined || m === null ? "" : `${m}${e ? `+${e}` : ""}'`;
}
function eventTitle(event) {
  return [event?.player?.name ?? event?.playerName, event?.type, event?.detail, event?.assist?.name ? `Assist: ${event.assist.name}` : null].filter(Boolean).join(" · ") || "Match event";
}
function MatchEvents({ payload }) {
  const events = extractArray(payload);
  if (!events.length) return <DataState empty="No match events available" />;
  return <View style={styles.listCard}>{events.map((event, index) => <View key={`${index}-${eventMinute(event)}`} style={[styles.listRow, index !== events.length - 1 && styles.rowBorder]}><Text style={styles.eventMinute}>{eventMinute(event)}</Text><View style={{ flex: 1 }}><Text style={styles.rowText}>{eventTitle(event)}</Text><Text style={styles.pageSubtitle}>{event?.team?.name || ""}</Text></View></View>)}</View>;
}

function lineupPlayers(entry) {
  const starters = entry?.startXI || entry?.startXi || entry?.starters || [];
  const subs = entry?.substitutes || entry?.subs || [];
  const map = (x, role) => { const p = x?.player || x; return { id: p?.id ?? x?.id, name: p?.name ?? x?.name ?? "Player", number: p?.number ?? x?.number, pos: p?.pos ?? p?.position ?? x?.position, role }; };
  return [...starters.map((x) => map(x, "Starting XI")), ...subs.map((x) => map(x, "Substitute"))];
}
function MatchLineups({ payload, openPlayer }) {
  const lineups = extractArray(payload);
  if (!lineups.length) return <DataState empty="Lineups not available yet" />;
  return <View>{lineups.map((entry, i) => { const players = lineupPlayers(entry); return <View key={entry?.team?.id ?? i} style={{ marginBottom: 14 }}><View style={styles.lineupHeader}><Text style={styles.lineupTeam}>{entry?.team?.name || `Team ${i + 1}`}</Text><Text style={styles.lineupFormation}>{entry?.formation || ""}</Text></View>{players.map((p, j) => <Pressable key={`${p.id}-${j}`} style={styles.lineupPlayer} onPress={() => p.id && openPlayer(p)}><Text style={styles.lineupNumber}>{p.number ?? "–"}</Text><View style={{ flex: 1 }}><Text style={styles.rowText}>{p.name}</Text><Text style={styles.pageSubtitle}>{[p.pos, p.role].filter(Boolean).join(" · ")}</Text></View></Pressable>)}</View>; })}</View>;
}

function MatchStatistics({ payload }) {
  const sides = extractArray(payload);
  if (!sides.length) return <DataState empty="Statistics not available yet" />;
  const toMap = (entry) => {
    const stats = entry?.statistics || entry?.stats || [];
    if (Array.isArray(stats)) return Object.fromEntries(stats.map((x) => [x?.type ?? x?.name, x?.value ?? x?.total]).filter(([k]) => k));
    return stats || {};
  };
  const home = toMap(sides[0]); const away = toMap(sides[1]); const labels = [...new Set([...Object.keys(home), ...Object.keys(away)])];
  if (!labels.length) return <GenericRows data={payload} limit={30} />;
  return <View style={styles.statsWrap}>{labels.map((label) => <View key={label} style={styles.statRow}><Text style={styles.statNumber}>{String(home[label] ?? "-")}</Text><Text style={styles.statName}>{label}</Text><Text style={styles.statNumber}>{String(away[label] ?? "-")}</Text></View>)}</View>;
}

function MatchH2H({ payload, openMatch }) {
  const matches = extractArray(payload).map(normalizeFootballMatch).filter((m) => m.home?.name && m.away?.name);
  if (!matches.length) return <DataState empty="H2H data unavailable" />;
  return <View>{matches.slice(0, 10).map((m) => <Pressable key={m.id} style={styles.h2hRow} onPress={() => openMatch(m)}><Text numberOfLines={1} style={styles.h2hTeam}>{m.home.name}</Text><Text style={styles.h2hScore}>{m.homeScore ?? "-"} - {m.awayScore ?? "-"}</Text><Text numberOfLines={1} style={[styles.h2hTeam, { textAlign: "right" }]}>{m.away.name}</Text></Pressable>)}</View>;
}

function MatchPlayers({ payload, openPlayer }) {
  const players = normalizePlayers(payload);
  if (!players.length) return <DataState empty="Player match data unavailable" />;
  return <View style={styles.listCard}>{players.slice(0, 50).map((p, i) => <Pressable key={`${p.id}-${i}`} style={[styles.listRow, i !== Math.min(players.length,50)-1 && styles.rowBorder]} onPress={() => openPlayer(p)}><View style={styles.rowLeft}>{p.photo ? <Image source={{ uri: p.photo }} style={styles.playerThumb} /> : null}<View><Text style={styles.rowText}>{p.name}</Text><Text style={styles.pageSubtitle}>{[p.position, p.number ? `#${p.number}` : ""].filter(Boolean).join(" · ")}</Text></View></View><Ionicons name="chevron-forward" size={18} color={C.muted} /></Pressable>)}</View>;
}

function MatchDetailScreen({ match, goBack, openMatch, openTeam, openPlayer }) {
  const current = match;
  const [tab, setTab] = useState("EVENTS");
  const api = useApi(current?.id, () => fetchMatchBundle(current.id));
  const detail = api.data?.detail?.match || current;
  const hasScore = detail?.homeScore !== null && detail?.homeScore !== undefined && detail?.awayScore !== null && detail?.awayScore !== undefined;
  const tabs = ["EVENTS", "LINEUPS", "STATISTICS", "H2H", "PLAYERS", "INJURIES"];
  return (
    <View style={styles.screen}>
      <View style={styles.detailHeader}><Pressable onPress={goBack}><Ionicons name="chevron-back" size={27} color={C.text} /></Pressable><Text numberOfLines={1} style={styles.detailHeaderTitle}>{detail?.competition || "Match"}</Text><View style={styles.headerIcons}><Ionicons name="share-outline" size={22} color={C.text} /><Ionicons name="star-outline" size={22} color={C.text} /></View></View>
      <ScrollView contentContainerStyle={styles.detailContent}>
        <Text style={styles.roundText}>{[detail?.round, detail?.venue].filter(Boolean).join(" · ") || detail?.statusLong || "Match details"}</Text>
        <View style={styles.detailScoreArea}><Pressable style={styles.detailTeam} onPress={() => detail?.home?.id && openTeam(detail.home)}><TeamLogo uri={detail?.home?.logo} size={60} /><Text numberOfLines={2} style={styles.detailTeamName}>{detail?.home?.name}</Text></Pressable><View style={styles.detailScoreCenter}><Text style={styles.detailScore}>{hasScore ? `${detail.homeScore} - ${detail.awayScore}` : "VS"}</Text><Text style={styles.detailLiveTime}>{detail?.minute || detail?.statusCode || ""}</Text>{detail?.aggregate ? <Text style={styles.aggregateText}>{String(detail.aggregate)}</Text> : null}</View><Pressable style={styles.detailTeam} onPress={() => detail?.away?.id && openTeam(detail.away)}><TeamLogo uri={detail?.away?.logo} size={60} /><Text numberOfLines={2} style={styles.detailTeamName}>{detail?.away?.name}</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailTabs}>{tabs.map((x) => <Pressable key={x} style={[styles.detailTab, { minWidth: 88 }]} onPress={() => setTab(x)}><Text style={[styles.detailTabText, tab === x && styles.detailTabTextActive]}>{x}</Text>{tab === x ? <View style={styles.detailTabIndicator} /> : null}</Pressable>)}</ScrollView>
        {api.loading && !api.data ? <DataState loading /> : null}{api.error && !api.data ? <DataState error={api.error} retry={api.reload} /> : null}
        {api.data ? <>{tab === "EVENTS" ? <MatchEvents payload={api.data.events} /> : null}{tab === "LINEUPS" ? <MatchLineups payload={api.data.lineups} openPlayer={openPlayer} /> : null}{tab === "STATISTICS" ? <MatchStatistics payload={api.data.statistics} /> : null}{tab === "H2H" ? <MatchH2H payload={api.data.h2h} openMatch={openMatch} /> : null}{tab === "PLAYERS" ? <MatchPlayers payload={api.data.players} openPlayer={openPlayer} /> : null}{tab === "INJURIES" ? <GenericRows data={api.data.injuries} limit={50} /> : null}</> : null}
        <View style={{ height: 36 }} />
      </ScrollView>
    </View>
  );
}

function LeagueTable({ rows, openTeam }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.tableWrap}><View style={styles.tableHeader}><Text style={[styles.th,{width:32}]}>#</Text><Text style={[styles.th,{width:170}]}>TEAM</Text><Text style={styles.th}>P</Text><Text style={styles.th}>W</Text><Text style={styles.th}>D</Text><Text style={styles.th}>L</Text><Text style={[styles.th,{width:50}]}>GD</Text><Text style={styles.th}>PTS</Text></View>{rows.map((r,i) => <Pressable key={`${r.rank}-${r.team}-${i}`} style={styles.tableRow} onPress={() => r.teamId && openTeam({ id:r.teamId,name:r.team,logo:r.logo })}><Text style={[styles.td,{width:32}]}>{r.rank}</Text><View style={[styles.tableTeam,{width:170}]}><TeamLogo uri={r.logo} size={25} /><Text numberOfLines={1} style={styles.tableTeamName}>{r.team}</Text></View><Text style={styles.td}>{r.p}</Text><Text style={styles.td}>{r.w}</Text><Text style={styles.td}>{r.d}</Text><Text style={styles.td}>{r.l}</Text><Text style={[styles.td,{width:50}]}>{r.gd}</Text><Text style={[styles.td,{fontWeight:"800"}]}>{r.pts}</Text></Pressable>)}</View></ScrollView>;
}

function LeagueScreen({ league, goBack, openMatch, openTeam, openPlayer }) {
  const key = league?.id ?? league?.competitionId ?? league?.name;
  const api = useApi(key, () => fetchCompetitionBundle(league));
  const [tab, setTab] = useState("TABLE");
  const profile = extractObject(api.data?.profile) || {};
  const title = profile?.league?.name || profile?.competition?.name || profile?.name || league?.name || league?.competition || "Competition";
  const logo = profile?.league?.logo || profile?.competition?.logo || profile?.logo || league?.competitionLogo;
  const standings = normalizeStandings(api.data?.standings);
  const matches = extractArray(api.data?.matches).map(normalizeFootballMatch).filter((m)=>m.home?.name&&m.away?.name);
  const teams = normalizeTeams(api.data?.teams);
  const scorers = normalizeScorers(api.data?.scorers);
  const seasons = extractArray(api.data?.seasons);
  const tabs=["TABLE","FIXTURES","TEAMS","SCORERS","SEASONS"];
  return <View style={styles.screen}><View style={styles.detailHeader}><Pressable onPress={goBack}><Ionicons name="chevron-back" size={27} color={C.text} /></Pressable><View style={styles.leagueTitleWrap}>{logo?<Image source={{uri:logo}} style={{width:30,height:30}} resizeMode="contain"/>:<MaterialCommunityIcons name="trophy-outline" size={28} color={C.text}/>}<Text numberOfLines={1} style={styles.leagueTitle}>{title}</Text></View><Ionicons name="star-outline" size={22} color={C.text}/></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leagueTabs}>{tabs.map(x=><Pressable key={x} style={[styles.leagueTab,{minWidth:84}]} onPress={()=>setTab(x)}><Text style={[styles.leagueTabText,tab===x&&styles.leagueTabTextActive]}>{x}</Text>{tab===x?<View style={styles.leagueTabIndicator}/>:null}</Pressable>)}</ScrollView><ScrollView contentContainerStyle={styles.pageContent}>{api.loading&&!api.data?<DataState loading/>:null}{api.error&&!api.data?<DataState error={api.error} retry={api.reload}/>:null}{api.data&&tab==="TABLE"?(standings.length?<LeagueTable rows={standings} openTeam={openTeam}/>:<DataState empty="Standings unavailable"/>):null}{api.data&&tab==="FIXTURES"?(matches.length?matches.map(m=><MatchCard key={m.id} match={m} onPress={openMatch}/>):<DataState empty="Fixtures unavailable"/>):null}{api.data&&tab==="TEAMS"?(teams.length?<View style={styles.listCard}>{teams.map((t,i)=><Pressable key={`${t.id}-${i}`} style={[styles.listRow,i!==teams.length-1&&styles.rowBorder]} onPress={()=>openTeam(t)}><View style={styles.rowLeft}><TeamLogo uri={t.logo} size={28}/><Text style={styles.rowText}>{t.name}</Text></View><Ionicons name="chevron-forward" size={18} color={C.muted}/></Pressable>)}</View>:<DataState empty="Teams unavailable"/>):null}{api.data&&tab==="SCORERS"?(scorers.length?scorers.map((p,i)=><Pressable key={`${p.id}-${i}`} style={styles.scorerRow} onPress={()=>openPlayer(p)}><Text style={styles.scorerRank}>{i+1}</Text><Text numberOfLines={1} style={styles.scorerName}>{p.name}</Text><Text style={styles.scorerGoals}>{p.goals}</Text></Pressable>):<DataState empty="Top scorers unavailable"/>):null}{api.data&&tab==="SEASONS"?(seasons.length?<GenericRows data={seasons}/>:<DataState empty="Season history unavailable"/>):null}<View style={{height:32}}/></ScrollView></View>;
}

function TeamScreen({ team, goBack, openMatch, openPlayer }) {
  const api = useApi(team?.id, () => fetchTeamBundle(team));
  const [tab,setTab]=useState("OVERVIEW");
  const profile = extractObject(api.data?.profile) || {};
  const normalized=normalizeTeams(api.data?.profile)[0];
  const display={id:team?.id,name:normalized?.name||profile?.team?.name||profile?.name||team?.name||"Team",logo:normalized?.logo||profile?.team?.logo||profile?.logo||team?.logo};
  const matches=extractArray(api.data?.matches).map(normalizeFootballMatch).filter(m=>m.home?.name&&m.away?.name);
  const squad=normalizePlayers(api.data?.squad);
  const tabs=["OVERVIEW","MATCHES","SQUAD","STATS","TRANSFERS","TROPHIES"];
  return <View style={styles.screen}><View style={styles.simpleHeader}><Pressable onPress={goBack}><Ionicons name="chevron-back" size={27} color={C.text}/></Pressable><View style={styles.rowLeft}><TeamLogo uri={display.logo} size={34}/><Text numberOfLines={1} style={[styles.pageTitle,{maxWidth:230}]}>{display.name}</Text></View><Ionicons name="star-outline" size={22} color={C.text}/></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leagueTabs}>{tabs.map(x=><Pressable key={x} style={[styles.leagueTab,{minWidth:92}]} onPress={()=>setTab(x)}><Text style={[styles.leagueTabText,tab===x&&styles.leagueTabTextActive]}>{x}</Text>{tab===x?<View style={styles.leagueTabIndicator}/>:null}</Pressable>)}</ScrollView><ScrollView contentContainerStyle={styles.pageContent}>{api.loading&&!api.data?<DataState loading/>:null}{api.error&&!api.data?<DataState error={api.error} retry={api.reload}/>:null}{api.data&&tab==="OVERVIEW"?<GenericRows data={api.data.profile}/>:null}{api.data&&tab==="MATCHES"?(matches.length?matches.map(m=><MatchCard key={m.id} match={m} onPress={openMatch}/>):<DataState empty="Team matches unavailable"/>):null}{api.data&&tab==="SQUAD"?(squad.length?<View style={styles.listCard}>{squad.map((p,i)=><Pressable key={`${p.id}-${i}`} style={[styles.listRow,i!==squad.length-1&&styles.rowBorder]} onPress={()=>openPlayer(p)}><View style={styles.rowLeft}>{p.photo?<Image source={{uri:p.photo}} style={styles.playerThumb}/>:null}<Text style={styles.rowText}>{p.name}</Text></View><Text style={styles.pageSubtitle}>{p.position||""}</Text></Pressable>)}</View>:<DataState empty="Squad unavailable"/>):null}{api.data&&tab==="STATS"?<GenericRows data={api.data.stats}/>:null}{api.data&&tab==="TRANSFERS"?<GenericRows data={api.data.transfers}/>:null}{api.data&&tab==="TROPHIES"?<GenericRows data={api.data.trophies}/>:null}<View style={{height:32}}/></ScrollView></View>;
}

function PlayerQuick({ value, label }) { return <View style={styles.playerQuick}><Text numberOfLines={1} style={styles.playerQuickValue}>{String(value ?? "-")}</Text><Text style={styles.playerQuickLabel}>{label}</Text></View>; }
function PlayerScreen({ player, goBack }) {
  const current=player?.id?player:{id:1100,name:"Erling Haaland"};
  const api=useApi(current.id,()=>fetchPlayerBundle(current));
  const [tab,setTab]=useState("OVERVIEW");
  const entry=extractArray(api.data?.profile)[0]||extractObject(api.data?.profile)||{};
  const person=entry?.player||entry;
  const stats=entry?.statistics||[];
  const name=person?.name||current.name||"Player";
  const photo=person?.photo||current.photo||"https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1000&q=80";
  const nationality=person?.nationality||current.nationality||"";
  const club=stats?.[0]?.team||current.team;
  const tabs=["OVERVIEW","STATS","TRANSFERS","TROPHIES","SIDELINED"];
  return <View style={styles.screen}><ScrollView><ImageBackground source={{uri:photo}} style={styles.playerHero} imageStyle={styles.playerHeroImage}><View style={styles.heroOverlay}/><View style={styles.playerHeroTop}><Pressable onPress={goBack}><Ionicons name="chevron-back" size={28} color={C.text}/></Pressable><Ionicons name="share-social-outline" size={23} color={C.text}/></View></ImageBackground><View style={styles.playerContent}><View style={styles.avatarWrap}><Image source={{uri:photo}} style={styles.avatar}/></View><Text style={styles.playerName}>{name}{nationality?` · ${nationality}`:""}</Text>{club?<View style={styles.playerClubRow}><TeamLogo uri={club.logo} size={23}/><Text style={styles.playerClub}>{club.name||""}</Text></View>:null}<View style={styles.playerQuickRow}><PlayerQuick value={person?.age} label="Age"/><PlayerQuick value={current?.number??stats?.[0]?.games?.number} label="Jersey"/><PlayerQuick value={current?.position??stats?.[0]?.games?.position} label="Position"/><PlayerQuick value={nationality} label="Country"/></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playerTabs}>{tabs.map(x=><Pressable key={x} style={[styles.playerTab,{minWidth:92}]} onPress={()=>setTab(x)}><Text style={[styles.playerTabText,tab===x&&styles.playerTabTextActive]}>{x}</Text>{tab===x?<View style={styles.playerTabIndicator}/>:null}</Pressable>)}</ScrollView>{api.loading&&!api.data?<DataState loading/>:null}{api.error&&!api.data?<DataState error={api.error} retry={api.reload}/>:null}{api.data&&tab==="OVERVIEW"?<GenericRows data={person}/>:null}{api.data&&tab==="STATS"?<GenericRows data={stats}/>:null}{api.data&&tab==="TRANSFERS"?<GenericRows data={api.data.transfers}/>:null}{api.data&&tab==="TROPHIES"?<GenericRows data={api.data.trophies}/>:null}{api.data&&tab==="SIDELINED"?<GenericRows data={api.data.sidelined}/>:null}<View style={{height:36}}/></View></ScrollView></View>;
}

export default function AppFull() {
  const [bottomTab,setBottomTab]=useState("home");
  const [route,setRoute]=useState({name:"main",params:null});
  const openMatch=(match)=>setRoute({name:"match",params:match});
  const openLeague=(league)=>setRoute({name:"league",params:league});
  const openTeam=(team)=>team?.id&&setRoute({name:"team",params:team});
  const openPlayer=(player)=>setRoute({name:"player",params:player?.id?player:{id:1100,name:"Erling Haaland"}});
  const goBack=()=>setRoute({name:"main",params:null});
  const changeBottom=(tab)=>{setBottomTab(tab);setRoute({name:"main",params:null});};
  const main=bottomTab==="scores"?<ScoresScreen openMatch={openMatch} openLeague={openLeague}/>:bottomTab==="favorites"?<FavoritesScreen openLeague={openLeague} openTeam={openTeam} openPlayer={openPlayer}/>:bottomTab==="prediction"?<PredictionScreen openMatch={openMatch}/>:bottomTab==="more"?<MoreScreen openLeague={openLeague} openTeam={openTeam} openPlayer={openPlayer}/>:<HomeScreen openMatch={openMatch} openLeague={openLeague}/>;
  return <SafeAreaView style={styles.app}><StatusBar barStyle="light-content" backgroundColor={C.bg}/><View style={{flex:1}}>{route.name==="main"?main:null}{route.name==="match"?<MatchDetailScreen match={route.params} goBack={goBack} openMatch={openMatch} openTeam={openTeam} openPlayer={openPlayer}/>:null}{route.name==="league"?<LeagueScreen league={route.params} goBack={goBack} openMatch={openMatch} openTeam={openTeam} openPlayer={openPlayer}/>:null}{route.name==="team"?<TeamScreen team={route.params} goBack={goBack} openMatch={openMatch} openPlayer={openPlayer}/>:null}{route.name==="player"?<PlayerScreen player={route.params} goBack={goBack}/>:null}</View><BottomNav active={bottomTab} onChange={changeBottom}/></SafeAreaView>;
}

const styles=StyleSheet.create({
  app:{flex:1,backgroundColor:C.bg},screen:{flex:1,backgroundColor:C.bg},pageContent:{paddingHorizontal:16,paddingTop:12},
  mainHeader:{minHeight:Platform.OS==="android"?92:78,paddingHorizontal:20,paddingTop:Platform.OS==="android"?(StatusBar.currentHeight||24)+4:7,paddingBottom:4,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  logoWrap:{width:145,justifyContent:"center"},logoText:{color:C.red,fontSize:34,lineHeight:35,fontWeight:"900",fontStyle:"italic",letterSpacing:-2},logoSub:{color:C.text,fontSize:9,lineHeight:12,fontWeight:"800",letterSpacing:.6},
  headerIcons:{flexDirection:"row",alignItems:"center",gap:12},iconButton:{width:38,height:38,alignItems:"center",justifyContent:"center",position:"relative"},notificationDot:{position:"absolute",right:7,top:5,width:7,height:7,borderRadius:4,backgroundColor:C.red,borderWidth:1,borderColor:C.bg},
  headerTabs:{flexDirection:"row",paddingHorizontal:14,borderBottomWidth:1,borderBottomColor:C.border2},headerTab:{flex:1,height:43,alignItems:"center",justifyContent:"center",position:"relative"},headerTabText:{color:C.text2,fontSize:width<370?9.5:10.5,fontWeight:"700"},headerTabTextActive:{color:C.red},headerTabIndicator:{position:"absolute",bottom:0,left:4,right:4,height:3,borderRadius:2,backgroundColor:C.red},
  bottomNav:{height:Platform.OS==="ios"?73:68,backgroundColor:C.bg2,borderTopWidth:1,borderTopColor:C.border,flexDirection:"row",paddingTop:6,paddingBottom:Platform.OS==="ios"?8:5},bottomNavItem:{flex:1,alignItems:"center",justifyContent:"center",gap:3},bottomNavText:{fontSize:10,color:C.muted},bottomNavTextActive:{color:C.red},
  simpleHeader:{minHeight:70,paddingHorizontal:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:C.border2},pageTitle:{fontSize:22,fontWeight:"800",color:C.text},pageSubtitle:{fontSize:11,color:C.muted,marginTop:2},
  sectionHeader:{marginTop:16,marginBottom:10,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},sectionTitle:{fontSize:13,fontWeight:"800",color:C.text2},sectionRight:{fontSize:12,color:C.muted},
  liveNowRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:10},liveNowLeft:{flexDirection:"row",alignItems:"center",gap:9},redDot:{width:8,height:8,borderRadius:4,backgroundColor:C.red},liveNowText:{fontSize:15,fontWeight:"800",color:C.text2},matchCount:{fontSize:12,color:C.muted},
  matchCard:{backgroundColor:C.card,borderRadius:12,padding:13,marginBottom:8,borderWidth:1,borderColor:C.border2},matchCardTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},competitionLabel:{fontSize:11,fontWeight:"800",color:C.text2,flexShrink:1},liveRow:{flexDirection:"row",alignItems:"center",gap:8},liveBadge:{backgroundColor:C.red,borderRadius:4,paddingHorizontal:7,paddingVertical:4},liveBadgeText:{fontSize:10,fontWeight:"900",color:C.text},minuteText:{fontSize:11,color:C.muted},matchTeams:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:12},matchTeam:{width:"34%",alignItems:"center",gap:6},matchTeamName:{fontSize:13,color:C.text,textAlign:"center",width:"100%"},scoreCenter:{width:"30%",alignItems:"center"},bigScore:{fontSize:31,fontWeight:"800",color:C.text},aggregateText:{fontSize:11,color:C.muted,marginTop:5},logoFallback:{backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},
  allScoresButton:{height:47,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:C.border2},allScoresText:{fontSize:12,fontWeight:"800",color:C.red},competitionStrip:{gap:10,paddingBottom:6},competitionItem:{width:84,minHeight:76,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:10,padding:9,alignItems:"center",justifyContent:"center",gap:6},competitionName:{fontSize:9.5,color:C.text2,textAlign:"center"},
  stateCard:{minHeight:110,borderRadius:12,borderWidth:1,borderColor:C.border2,backgroundColor:C.card,padding:18,alignItems:"center",justifyContent:"center",gap:7,marginBottom:10},stateTitle:{fontSize:14,fontWeight:"800",color:C.text},stateText:{fontSize:11,color:C.muted,textAlign:"center"},retryButton:{marginTop:4,backgroundColor:C.red,borderRadius:6,paddingHorizontal:18,paddingVertical:8},retryText:{fontSize:11,fontWeight:"800",color:C.text},
  editorialCard:{backgroundColor:C.card,borderRadius:12,borderWidth:1,borderColor:C.border2,padding:14,marginBottom:9,flexDirection:"row",alignItems:"center",gap:12},editorialIcon:{width:48,height:48,borderRadius:10,backgroundColor:C.redSoft,alignItems:"center",justifyContent:"center"},editorialTitle:{fontSize:14,fontWeight:"700",color:C.text},editorialMeta:{fontSize:11,color:C.muted,marginTop:4},
  dateTabs:{flexDirection:"row",paddingHorizontal:14,paddingVertical:8,gap:8,borderBottomWidth:1,borderBottomColor:C.border2},dateTab:{flex:1,borderRadius:7,paddingVertical:8,alignItems:"center"},dateTabActive:{backgroundColor:C.redSoft},dateTabText:{fontSize:10,fontWeight:"700",color:C.muted},dateTabTextActive:{color:C.red},
  segment:{margin:14,flexDirection:"row",backgroundColor:C.card,borderRadius:9,padding:3},segmentItem:{flex:1,paddingVertical:9,alignItems:"center",borderRadius:7},segmentActive:{backgroundColor:C.red},segmentText:{fontSize:11,color:C.text2},segmentTextActive:{color:C.text,fontWeight:"800"},
  listCard:{backgroundColor:C.card,borderRadius:11,borderWidth:1,borderColor:C.border2,overflow:"hidden",marginBottom:12},listRow:{minHeight:52,paddingHorizontal:13,paddingVertical:9,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},rowBorder:{borderBottomWidth:1,borderBottomColor:C.border2},rowLeft:{flexDirection:"row",alignItems:"center",gap:10,flex:1},rowText:{fontSize:13,color:C.text2,flexShrink:1},infoRow:{paddingHorizontal:13,paddingVertical:10,flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:16},infoLabel:{fontSize:11,color:C.muted,width:"45%",textTransform:"capitalize"},infoValue:{fontSize:11.5,color:C.text2,width:"50%",textAlign:"right"},playerThumb:{width:32,height:32,borderRadius:16},
  notice:{backgroundColor:C.redSoft,borderRadius:9,padding:11,flexDirection:"row",gap:8,alignItems:"center"},noticeText:{fontSize:11,color:C.text2,flex:1},predictionCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,padding:13,marginBottom:10},predictionTeams:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:14},predTeam:{width:"39%",alignItems:"center",gap:5},predName:{fontSize:12,color:C.text,textAlign:"center"},vs:{fontSize:13,fontWeight:"800",color:C.muted},predButtons:{flexDirection:"row",gap:8,marginTop:13},predButton:{flex:1,borderWidth:1,borderColor:C.border,borderRadius:7,paddingVertical:9,alignItems:"center"},predButtonActive:{backgroundColor:C.red,borderColor:C.red},predButtonText:{fontSize:11,color:C.text2},predButtonTextActive:{color:C.text,fontWeight:"800"},
  detailHeader:{minHeight:65,paddingHorizontal:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:C.border2},detailHeaderTitle:{flex:1,textAlign:"center",fontSize:14,fontWeight:"700",color:C.text,paddingHorizontal:12},detailContent:{paddingHorizontal:16,paddingTop:12},roundText:{fontSize:11,color:C.muted,textAlign:"center",marginBottom:12},detailScoreArea:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:8},detailTeam:{width:"34%",alignItems:"center",gap:7},detailTeamName:{fontSize:13,color:C.text,textAlign:"center"},detailScoreCenter:{width:"30%",alignItems:"center"},detailScore:{fontSize:32,fontWeight:"800",color:C.text},detailLiveTime:{fontSize:12,fontWeight:"700",color:C.red,marginTop:4},detailTabs:{borderBottomWidth:1,borderBottomColor:C.border2,marginTop:12},detailTab:{height:45,alignItems:"center",justifyContent:"center",position:"relative",paddingHorizontal:10},detailTabText:{fontSize:10,color:C.muted,fontWeight:"700"},detailTabTextActive:{color:C.red},detailTabIndicator:{position:"absolute",bottom:0,left:5,right:5,height:2,backgroundColor:C.red},
  eventMinute:{width:46,fontSize:11,fontWeight:"800",color:C.red},lineupHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",padding:11,backgroundColor:C.card2,borderRadius:8,marginBottom:6},lineupTeam:{fontSize:13,fontWeight:"800",color:C.text},lineupFormation:{fontSize:11,color:C.muted},lineupPlayer:{minHeight:47,flexDirection:"row",alignItems:"center",gap:10,borderBottomWidth:1,borderBottomColor:C.border2,paddingHorizontal:10},lineupNumber:{width:24,fontSize:11,fontWeight:"800",color:C.muted},
  statsWrap:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:10,overflow:"hidden"},statRow:{minHeight:46,flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:C.border2,paddingHorizontal:12},statNumber:{width:"23%",fontSize:12,fontWeight:"800",color:C.text,textAlign:"center"},statName:{width:"54%",fontSize:11,color:C.text2,textAlign:"center"},h2hRow:{minHeight:48,flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:C.border2},h2hTeam:{width:"38%",fontSize:11,color:C.text2},h2hScore:{width:"24%",textAlign:"center",fontSize:12,fontWeight:"800",color:C.text},
  leagueTitleWrap:{flex:1,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,paddingHorizontal:8},leagueTitle:{maxWidth:230,fontSize:15,fontWeight:"800",color:C.text},leagueTabs:{borderBottomWidth:1,borderBottomColor:C.border2},leagueTab:{height:43,alignItems:"center",justifyContent:"center",position:"relative",paddingHorizontal:9},leagueTabText:{fontSize:10,fontWeight:"700",color:C.muted},leagueTabTextActive:{color:C.red},leagueTabIndicator:{position:"absolute",bottom:0,left:5,right:5,height:2,backgroundColor:C.red},
  tableWrap:{minWidth:590,backgroundColor:C.card,borderRadius:9,overflow:"hidden",marginBottom:10},tableHeader:{height:38,flexDirection:"row",alignItems:"center",backgroundColor:C.card2},th:{width:50,fontSize:9,fontWeight:"800",color:C.muted,textAlign:"center"},tableRow:{minHeight:48,flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:C.border2},td:{width:50,fontSize:11,color:C.text2,textAlign:"center"},tableTeam:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:5},tableTeamName:{fontSize:11,color:C.text2,flex:1},scorerRow:{minHeight:50,flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:C.border2},scorerRank:{width:35,fontSize:12,fontWeight:"800",color:C.muted},scorerName:{flex:1,fontSize:13,color:C.text2},scorerGoals:{width:50,textAlign:"right",fontSize:14,fontWeight:"800",color:C.red},
  playerHero:{height:210,justifyContent:"space-between"},playerHeroImage:{opacity:.8},heroOverlay:{...StyleSheet.absoluteFillObject,backgroundColor:"rgba(0,0,0,0.32)"},playerHeroTop:{paddingTop:Platform.OS==="android"?(StatusBar.currentHeight||24)+8:12,paddingHorizontal:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},playerContent:{paddingHorizontal:16,paddingBottom:20},avatarWrap:{marginTop:-34,width:70,height:70,borderRadius:35,borderWidth:2,borderColor:C.text,overflow:"hidden",backgroundColor:C.card},avatar:{width:"100%",height:"100%"},playerName:{fontSize:21,fontWeight:"800",color:C.text,marginTop:9},playerClubRow:{flexDirection:"row",alignItems:"center",gap:7,marginTop:7},playerClub:{fontSize:12,color:C.text2},playerQuickRow:{flexDirection:"row",marginTop:14,borderTopWidth:1,borderBottomWidth:1,borderColor:C.border2,paddingVertical:11},playerQuick:{flex:1,alignItems:"center",borderRightWidth:1,borderRightColor:C.border2},playerQuickValue:{fontSize:12,fontWeight:"800",color:C.text,maxWidth:"90%"},playerQuickLabel:{fontSize:9,color:C.muted,marginTop:3},playerTabs:{borderBottomWidth:1,borderBottomColor:C.border2,marginTop:10},playerTab:{height:43,alignItems:"center",justifyContent:"center",position:"relative",paddingHorizontal:8},playerTabText:{fontSize:10,fontWeight:"700",color:C.muted},playerTabTextActive:{color:C.red},playerTabIndicator:{position:"absolute",bottom:0,left:5,right:5,height:2,backgroundColor:C.red},
});
