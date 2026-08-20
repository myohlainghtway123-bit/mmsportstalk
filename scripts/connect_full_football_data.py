from pathlib import Path

path = Path("App.js")
s = path.read_text()

old_import = 'import { fetchFootballMatches, isLiveMatch, offsetDateString } from "./src/services/footballApi";'
new_import = '''import {
  fetchFootballMatches,
  isLiveMatch,
  offsetDateString,
  fetchMatchBundle,
  fetchCompetitionBundle,
  fetchTeamBundle,
  fetchPlayerBundle,
  extractArray,
  extractObject,
  flattenDisplayRows,
  normalizeFootballMatch,
  normalizeStandings,
  normalizePlayers,
  normalizeTeams,
  normalizeScorers,
} from "./src/services/footballApi";'''
if old_import not in s:
    raise SystemExit("footballApi import not found")
s = s.replace(old_import, new_import, 1)

start_marker = '''// -------------------------------------------------------
// MATCH DETAIL
// -------------------------------------------------------'''
end_marker = '''// -------------------------------------------------------
// APP
// -------------------------------------------------------'''
start = s.find(start_marker)
end = s.find(end_marker)
if start < 0 or end < 0 or end <= start:
    raise SystemExit("full football section markers not found")

new_section = r'''// -------------------------------------------------------
// REAL FOOTBALL DETAIL SCREENS
// -------------------------------------------------------

function ApiPanel({ loading, error, emptyText = "No data available", onRetry }) {
  if (loading) {
    return (
      <View style={styles.footballStateCard}>
        <ActivityIndicator size="small" color={COLORS.red} />
        <Text style={styles.footballStateText}>Loading MST football data…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.footballStateCard}>
        <Ionicons name="cloud-offline-outline" size={24} color={COLORS.muted} />
        <Text style={styles.footballStateTitle}>Data unavailable</Text>
        <Text style={styles.footballStateText}>{error}</Text>
        {onRetry ? (
          <Pressable style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>RETRY</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.footballStateCard}>
      <Ionicons name="football-outline" size={24} color={COLORS.muted} />
      <Text style={styles.footballStateTitle}>{emptyText}</Text>
    </View>
  );
}

function RealDataRows({ data, limit = 30 }) {
  const rows = flattenDisplayRows(data).slice(0, limit);
  if (!rows.length) return <ApiPanel emptyText="No data available" />;

  return (
    <View style={styles.playerInfoCard}>
      {rows.map((row, index) => (
        <View
          key={`${row.label}-${index}`}
          style={[
            styles.playerInfoRow,
            index !== rows.length - 1 && styles.playerInfoRowBorder,
          ]}
        >
          <Text numberOfLines={2} style={styles.playerInfoLabel}>{row.label}</Text>
          <Text numberOfLines={3} style={styles.playerInfoValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function useBundle(loader, key) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(async () => {
    if (!key) {
      setState({ loading: false, error: "ID is unavailable.", data: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await loader();
      setState({ loading: false, error: null, data });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "Unable to load data.",
        data: null,
      });
    }
  }, [key, loader]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

function eventMinute(event) {
  const time = event?.time ?? {};
  const elapsed = time?.elapsed ?? event?.elapsed ?? event?.minute ?? event?.minutes;
  const extra = time?.extra ?? event?.extra;
  if (elapsed === undefined || elapsed === null) return event?.status ?? "";
  return `${elapsed}${extra ? `+${extra}` : ""}'`;
}

function eventText(event) {
  const player = event?.player?.name ?? event?.playerName ?? event?.player ?? "";
  const assist = event?.assist?.name ?? event?.assistName ?? "";
  const type = event?.type ?? event?.detail ?? event?.event ?? "Event";
  const detail = event?.detail && event?.detail !== type ? event.detail : "";
  return [player, type, detail, assist ? `Assist: ${assist}` : ""].filter(Boolean).join(" · ");
}

function MatchEventsReal({ payload }) {
  const events = extractArray(payload);
  if (!events.length) return <ApiPanel emptyText="No match events available" />;
  return (
    <View style={styles.listCard}>
      {events.map((event, index) => (
        <View
          key={`${event?.id ?? index}-${eventMinute(event)}`}
          style={[styles.listRow, index !== events.length - 1 && styles.listRowBorder]}
        >
          <Text style={[styles.eventMinute, { width: 46 }]}>{eventMinute(event)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.listRowText}>{eventText(event)}</Text>
            <Text style={styles.pageSubtitle}>
              {event?.team?.name ?? event?.teamName ?? ""}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function lineupPlayers(entry) {
  const starters = entry?.startXI ?? entry?.startXi ?? entry?.startingXI ?? entry?.starters ?? [];
  const substitutes = entry?.substitutes ?? entry?.subs ?? [];
  const normalize = (item, role) => {
    const p = item?.player ?? item;
    return {
      id: p?.id ?? item?.id,
      name: p?.name ?? item?.name ?? "Player",
      number: p?.number ?? item?.number,
      position: p?.pos ?? p?.position ?? item?.position,
      role,
      photo: p?.photo ?? item?.photo,
    };
  };
  return [
    ...starters.map((item) => normalize(item, "Starting XI")),
    ...substitutes.map((item) => normalize(item, "Substitute")),
  ];
}

function MatchLineupsReal({ payload, openPlayer }) {
  const lineups = extractArray(payload);
  if (!lineups.length) return <ApiPanel emptyText="Lineups not available yet" />;

  return (
    <View>
      {lineups.map((entry, sideIndex) => {
        const team = entry?.team ?? {};
        const players = lineupPlayers(entry);
        return (
          <View key={`${team?.id ?? sideIndex}`} style={{ marginBottom: 16 }}>
            <View style={styles.lineupHeader}>
              <Text style={styles.lineupTeam}>{team?.name ?? `Team ${sideIndex + 1}`}</Text>
              <Text style={styles.lineupFormation}>{entry?.formation ?? ""}</Text>
            </View>
            {players.length ? players.map((player, index) => (
              <Pressable
                key={`${player.id ?? player.name}-${index}`}
                style={styles.lineupPlayer}
                onPress={() => player.id && openPlayer(player)}
              >
                <Text style={styles.lineupNumber}>{player.number ?? "–"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineupPlayerName}>{player.name}</Text>
                  <Text style={styles.pageSubtitle}>{[player.position, player.role].filter(Boolean).join(" · ")}</Text>
                </View>
              </Pressable>
            )) : <ApiPanel emptyText="No player list available" />}
          </View>
        );
      })}
    </View>
  );
}

function MatchStatisticsReal({ payload }) {
  const sides = extractArray(payload);
  if (!sides.length) return <ApiPanel emptyText="Statistics not available yet" />;

  const homeStats = sides[0]?.statistics ?? sides[0]?.stats ?? [];
  const awayStats = sides[1]?.statistics ?? sides[1]?.stats ?? [];
  const mapStats = (stats) => Object.fromEntries(
    (Array.isArray(stats) ? stats : Object.entries(stats).map(([type, value]) => ({ type, value })))
      .map((item) => [item?.type ?? item?.name ?? item?.key, item?.value ?? item?.total ?? item?.val])
      .filter(([key]) => key)
  );
  const home = mapStats(homeStats);
  const away = mapStats(awayStats);
  const labels = Array.from(new Set([...Object.keys(home), ...Object.keys(away)]));

  if (!labels.length) return <RealDataRows data={payload} limit={25} />;

  return (
    <View style={styles.statsWrap}>
      {labels.map((label) => (
        <View key={label} style={styles.statRow}>
          <Text style={styles.statNumber}>{String(home[label] ?? "-")}</Text>
          <Text style={styles.statName}>{label}</Text>
          <Text style={styles.statNumber}>{String(away[label] ?? "-")}</Text>
        </View>
      ))}
    </View>
  );
}

function MatchH2HReal({ payload, openMatch }) {
  const matches = extractArray(payload).map(normalizeFootballMatch).filter((m) => m?.home?.name && m?.away?.name);
  if (!matches.length) return <ApiPanel emptyText="No H2H data available" />;
  return (
    <View>
      <SectionHeader title="HEAD TO HEAD" />
      {matches.slice(0, 10).map((match) => (
        <Pressable key={match.id} style={styles.h2hRow} onPress={() => openMatch(match)}>
          <Text numberOfLines={1} style={styles.h2hTeam}>{match.home.name}</Text>
          <Text style={styles.h2hScore}>
            {match.homeScore ?? "-"} - {match.awayScore ?? "-"}
          </Text>
          <Text numberOfLines={1} style={[styles.h2hTeam, styles.h2hTeamRight]}>{match.away.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function MatchPlayersReal({ payload, openPlayer }) {
  const players = normalizePlayers(payload);
  if (!players.length) return <ApiPanel emptyText="Player match data unavailable" />;
  return (
    <View style={styles.listCard}>
      {players.slice(0, 50).map((player, index) => (
        <Pressable
          key={`${player.id}-${index}`}
          style={[styles.listRow, index !== Math.min(players.length, 50) - 1 && styles.listRowBorder]}
          onPress={() => openPlayer(player)}
        >
          <View style={styles.listRowLeft}>
            {player.photo ? <Image source={{ uri: player.photo }} style={{ width: 32, height: 32, borderRadius: 16 }} /> : null}
            <View>
              <Text style={styles.listRowText}>{player.name}</Text>
              <Text style={styles.pageSubtitle}>{[player.position, player.number ? `#${player.number}` : ""].filter(Boolean).join(" · ")}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
        </Pressable>
      ))}
    </View>
  );
}

function MatchDetailScreen({ match, goBack, openMatch, openTeam, openPlayer }) {
  const [tab, setTab] = useState("EVENTS");
  const current = match || LIVE_MATCHES[0];
  const loader = useCallback(() => fetchMatchBundle(current?.id), [current?.id]);
  const { data: bundle, loading, error, reload } = useBundle(loader, current?.id);
  const detail = bundle?.detail?.match ?? current;
  const hasScore = detail?.homeScore !== null && detail?.homeScore !== undefined && detail?.awayScore !== null && detail?.awayScore !== undefined;
  const tabs = ["EVENTS", "LINEUPS", "STATISTICS", "H2H", "PLAYERS", "INJURIES"];

  return (
    <View style={styles.screen}>
      <View style={styles.detailHeader}>
        <Pressable onPress={goBack} style={styles.detailHeaderButton}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </Pressable>
        <Text numberOfLines={1} style={styles.detailHeaderTitle}>{detail?.competition ?? "Match"}</Text>
        <View style={styles.detailHeaderActions}>
          <Ionicons name="share-outline" size={22} color={COLORS.text} />
          <Ionicons name="star-outline" size={22} color={COLORS.text} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
        <Text style={styles.roundText}>{[detail?.round, detail?.venue].filter(Boolean).join(" · ") || detail?.statusLong || "Match details"}</Text>

        <View style={styles.detailScoreArea}>
          <Pressable style={styles.detailTeam} onPress={() => detail?.home?.id && openTeam(detail.home)}>
            <TeamLogo uri={detail?.home?.logo} size={61} />
            <Text style={styles.detailTeamName}>{detail?.home?.name}</Text>
          </Pressable>

          <View style={styles.detailScoreCenter}>
            <Text style={styles.detailScore}>{hasScore ? `${detail.homeScore} - ${detail.awayScore}` : "VS"}</Text>
            <Text style={styles.detailLiveTime}>{detail?.minute ?? detail?.statusCode ?? ""}</Text>
            {detail?.aggregate ? <Text style={styles.aggregateText}>{String(detail.aggregate)}</Text> : null}
          </View>

          <Pressable style={styles.detailTeam} onPress={() => detail?.away?.id && openTeam(detail.away)}>
            <TeamLogo uri={detail?.away?.logo} size={61} />
            <Text style={styles.detailTeamName}>{detail?.away?.name}</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matchDetailTabs}>
          {tabs.map((item) => (
            <Pressable key={item} style={[styles.matchDetailTab, { minWidth: 88 }]} onPress={() => setTab(item)}>
              <Text numberOfLines={1} style={[styles.matchDetailTabText, tab === item && styles.matchDetailTabTextActive]}>{item}</Text>
              {tab === item && <View style={styles.matchDetailTabIndicator} />}
            </Pressable>
          ))}
        </ScrollView>

        {loading && !bundle ? <ApiPanel loading /> : null}
        {error && !bundle ? <ApiPanel error={error} onRetry={reload} /> : null}
        {!loading && bundle ? (
          <>
            {tab === "EVENTS" && <MatchEventsReal payload={bundle.events} />}
            {tab === "LINEUPS" && <MatchLineupsReal payload={bundle.lineups} openPlayer={openPlayer} />}
            {tab === "STATISTICS" && <MatchStatisticsReal payload={bundle.statistics} />}
            {tab === "H2H" && <MatchH2HReal payload={bundle.h2h} openMatch={openMatch} />}
            {tab === "PLAYERS" && <MatchPlayersReal payload={bundle.players} openPlayer={openPlayer} />}
            {tab === "INJURIES" && <RealDataRows data={bundle.injuries} limit={40} />}
          </>
        ) : null}
        <View style={styles.spacerLarge} />
      </ScrollView>
    </View>
  );
}

// -------------------------------------------------------
// COMPETITION / LEAGUE
// -------------------------------------------------------

function LeagueScreen({ league, goBack, openMatch, openTeam, openPlayer }) {
  const [tab, setTab] = useState("TABLE");
  const loader = useCallback(() => fetchCompetitionBundle(league), [league?.id, league?.competitionId, league?.name]);
  const key = league?.competitionId ?? league?.id ?? league?.name;
  const { data: bundle, loading, error, reload } = useBundle(loader, key);
  const profile = extractObject(bundle?.profile);
  const title = profile?.league?.name ?? profile?.competition?.name ?? profile?.name ?? league?.name ?? league?.competition ?? "Competition";
  const logo = profile?.league?.logo ?? profile?.competition?.logo ?? profile?.logo ?? league?.logo ?? league?.competitionLogo;
  const tabs = ["TABLE", "FIXTURES", "TEAMS", "SCORERS", "SEASONS"];
  const standings = normalizeStandings(bundle?.standings);
  const fixtures = extractArray(bundle?.matches).map(normalizeFootballMatch).filter((m) => m?.home?.name && m?.away?.name);
  const teams = normalizeTeams(bundle?.teams);
  const scorers = normalizeScorers(bundle?.scorers);
  const seasons = extractArray(bundle?.seasons);

  return (
    <View style={styles.screen}>
      <View style={styles.leagueHeader}>
        <Pressable onPress={goBack}><Ionicons name="chevron-back" size={27} color={COLORS.text} /></Pressable>
        <View style={styles.leagueTitleWrap}>
          {logo ? <Image source={{ uri: logo }} style={{ width: 30, height: 30 }} resizeMode="contain" /> : <MaterialCommunityIcons name="trophy-outline" size={29} color={COLORS.text} />}
          <Text numberOfLines={1} style={styles.leagueTitle}>{title}</Text>
        </View>
        <Ionicons name="star-outline" size={23} color={COLORS.text} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leagueTabs}>
        {tabs.map((item) => (
          <Pressable key={item} style={[styles.leagueTab, { minWidth: 82 }]} onPress={() => setTab(item)}>
            <Text style={[styles.leagueTabText, tab === item && styles.leagueTabTextActive]}>{item}</Text>
            {tab === item && <View style={styles.leagueTabIndicator} />}
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageContent}>
        {loading && !bundle ? <ApiPanel loading /> : null}
        {error && !bundle ? <ApiPanel error={error} onRetry={reload} /> : null}

        {!loading && bundle && tab === "TABLE" && (
          standings.length ? <LeagueTable rows={standings} openTeam={openTeam} /> : <ApiPanel emptyText="Standings unavailable" />
        )}

        {!loading && bundle && tab === "FIXTURES" && (
          fixtures.length ? fixtures.map((match) => <MatchCard key={match.id} match={match} onPress={openMatch} />) : <ApiPanel emptyText="Fixtures unavailable" />
        )}

        {!loading && bundle && tab === "TEAMS" && (
          teams.length ? (
            <View style={styles.listCard}>
              {teams.map((team, index) => (
                <Pressable key={`${team.id}-${index}`} style={[styles.listRow, index !== teams.length - 1 && styles.listRowBorder]} onPress={() => openTeam(team)}>
                  <View style={styles.listRowLeft}><TeamLogo uri={team.logo} size={28} /><Text style={styles.listRowText}>{team.name}</Text></View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
                </Pressable>
              ))}
            </View>
          ) : <ApiPanel emptyText="Teams unavailable" />
        )}

        {!loading && bundle && tab === "SCORERS" && (
          scorers.length ? scorers.map((player, index) => (
            <Pressable key={`${player.id}-${index}`} style={styles.topScorerRow} onPress={() => openPlayer(player)}>
              <Text style={styles.scorerRank}>{index + 1}</Text>
              <Text numberOfLines={1} style={styles.topScorerName}>{player.name}</Text>
              <Text style={styles.topScorerGoals}>{player.goals}</Text>
            </Pressable>
          )) : <ApiPanel emptyText="Top scorers unavailable" />
        )}

        {!loading && bundle && tab === "SEASONS" && (
          seasons.length ? <RealDataRows data={seasons} limit={40} /> : <ApiPanel emptyText="Season history unavailable" />
        )}

        <View style={styles.spacerLarge} />
      </ScrollView>
    </View>
  );
}

function LeagueTable({ rows, openTeam }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.tableWrap}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: 32 }]}>#</Text>
          <Text style={[styles.tableHeaderCell, { width: 185 }]}>TEAM</Text>
          <Text style={styles.tableHeaderCell}>P</Text><Text style={styles.tableHeaderCell}>W</Text><Text style={styles.tableHeaderCell}>D</Text><Text style={styles.tableHeaderCell}>L</Text>
          <Text style={[styles.tableHeaderCell, { width: 50 }]}>GD</Text><Text style={styles.tableHeaderCell}>PTS</Text>
        </View>
        {rows.map((row, index) => (
          <Pressable key={`${row.rank}-${row.team}-${index}`} style={styles.tableRow} onPress={() => row.teamId && openTeam({ id: row.teamId, name: row.team, logo: row.logo })}>
            <Text style={[styles.tableCell, { width: 32 }]}>{row.rank}</Text>
            <View style={[styles.tableTeamCell, { width: 185 }]}><TeamLogo uri={row.logo} size={27} /><Text numberOfLines={1} style={styles.tableTeamName}>{row.team}</Text></View>
            <Text style={styles.tableCell}>{row.p}</Text><Text style={styles.tableCell}>{row.w}</Text><Text style={styles.tableCell}>{row.d}</Text><Text style={styles.tableCell}>{row.l}</Text>
            <Text style={[styles.tableCell, { width: 50 }]}>{row.gd}</Text><Text style={[styles.tableCell, styles.tablePoints]}>{row.pts}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

// -------------------------------------------------------
// TEAM PROFILE
// -------------------------------------------------------

function TeamScreen({ team, goBack, openMatch, openPlayer }) {
  const [tab, setTab] = useState("OVERVIEW");
  const loader = useCallback(() => fetchTeamBundle(team), [team?.id]);
  const { data: bundle, loading, error, reload } = useBundle(loader, team?.id);
  const profilePayload = bundle?.profile;
  const profileEntry = extractObject(profilePayload) ?? {};
  const normalized = normalizeTeams(profilePayload)[0];
  const displayTeam = normalized ?? {
    id: team?.id,
    name: profileEntry?.team?.name ?? profileEntry?.name ?? team?.name ?? "Team",
    logo: profileEntry?.team?.logo ?? profileEntry?.logo ?? team?.logo,
    country: profileEntry?.team?.country ?? profileEntry?.country,
  };
  const tabs = ["OVERVIEW", "MATCHES", "SQUAD", "STATS", "TRANSFERS", "TROPHIES"];
  const matches = extractArray(bundle?.matches).map(normalizeFootballMatch).filter((m) => m?.home?.name && m?.away?.name);
  const squad = normalizePlayers(bundle?.squad);

  return (
    <View style={styles.screen}>
      <View style={styles.simpleTopHeader}>
        <Pressable onPress={goBack}><Ionicons name="chevron-back" size={27} color={COLORS.text} /></Pressable>
        <View style={styles.listRowLeft}><TeamLogo uri={displayTeam.logo} size={34} /><Text numberOfLines={1} style={styles.pageTitle}>{displayTeam.name}</Text></View>
        <Ionicons name="star-outline" size={22} color={COLORS.text} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leagueTabs}>
        {tabs.map((item) => (
          <Pressable key={item} style={[styles.leagueTab, { minWidth: 92 }]} onPress={() => setTab(item)}>
            <Text style={[styles.leagueTabText, tab === item && styles.leagueTabTextActive]}>{item}</Text>
            {tab === item && <View style={styles.leagueTabIndicator} />}
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageContent}>
        {loading && !bundle ? <ApiPanel loading /> : null}
        {error && !bundle ? <ApiPanel error={error} onRetry={reload} /> : null}
        {!loading && bundle && tab === "OVERVIEW" && <RealDataRows data={bundle.profile} limit={35} />}
        {!loading && bundle && tab === "MATCHES" && (matches.length ? matches.map((match) => <MatchCard key={match.id} match={match} onPress={openMatch} />) : <ApiPanel emptyText="Team matches unavailable" />)}
        {!loading && bundle && tab === "SQUAD" && (
          squad.length ? (
            <View style={styles.listCard}>{squad.map((player, index) => (
              <Pressable key={`${player.id}-${index}`} style={[styles.listRow, index !== squad.length - 1 && styles.listRowBorder]} onPress={() => openPlayer(player)}>
                <View style={styles.listRowLeft}>{player.photo ? <Image source={{ uri: player.photo }} style={{ width: 32, height: 32, borderRadius: 16 }} /> : null}<Text style={styles.listRowText}>{player.name}</Text></View>
                <Text style={styles.moreRightText}>{player.position ?? ""}</Text>
              </Pressable>
            ))}</View>
          ) : <ApiPanel emptyText="Squad unavailable" />
        )}
        {!loading && bundle && tab === "STATS" && <RealDataRows data={bundle.stats} limit={50} />}
        {!loading && bundle && tab === "TRANSFERS" && <RealDataRows data={bundle.transfers} limit={50} />}
        {!loading && bundle && tab === "TROPHIES" && <RealDataRows data={bundle.trophies} limit={50} />}
        <View style={styles.spacerLarge} />
      </ScrollView>
    </View>
  );
}

// -------------------------------------------------------
// PLAYER PROFILE
// -------------------------------------------------------

function PlayerScreen({ player, goBack }) {
  const [tab, setTab] = useState("OVERVIEW");
  const current = player?.id ? player : { id: 1100, name: "Erling Haaland" };
  const loader = useCallback(() => fetchPlayerBundle(current), [current?.id]);
  const { data: bundle, loading, error, reload } = useBundle(loader, current?.id);
  const entry = extractArray(bundle?.profile)[0] ?? extractObject(bundle?.profile) ?? {};
  const person = entry?.player ?? entry;
  const stats = entry?.statistics ?? [];
  const name = person?.name ?? current?.name ?? "Player";
  const photo = person?.photo ?? current?.photo ?? PLAYER_IMAGE;
  const nationality = person?.nationality ?? current?.nationality ?? "";
  const team = stats?.[0]?.team ?? current?.team ?? null;
  const tabs = ["OVERVIEW", "STATS", "TRANSFERS", "TROPHIES", "SIDELINED"];

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ImageBackground source={{ uri: photo || PLAYER_IMAGE }} style={styles.playerHero} imageStyle={styles.playerHeroImage}>
          <View style={styles.playerHeroOverlay} />
          <View style={styles.playerHeroTop}>
            <Pressable onPress={goBack}><Ionicons name="chevron-back" size={28} color={COLORS.text} /></Pressable>
            <Ionicons name="share-social-outline" size={23} color={COLORS.text} />
          </View>
        </ImageBackground>

        <View style={styles.playerContent}>
          <View style={styles.playerAvatarWrap}><Image source={{ uri: photo || PLAYER_IMAGE }} style={styles.playerAvatar} /></View>
          <Text style={styles.playerName}>{name}{nationality ? ` · ${nationality}` : ""}</Text>
          {team ? <View style={styles.playerClubRow}><TeamLogo uri={team?.logo} size={23} /><Text style={styles.playerClub}>{team?.name ?? ""}</Text></View> : null}

          <View style={styles.playerQuickStats}>
            <PlayerQuickStat value={String(person?.age ?? "-")} label="Age" />
            <PlayerQuickStat value={String(current?.number ?? stats?.[0]?.games?.number ?? "-")} label="Jersey" />
            <PlayerQuickStat value={String(current?.position ?? stats?.[0]?.games?.position ?? "-")} label="Position" />
            <PlayerQuickStat value={String(nationality || "-")} label="Country" />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playerTabs}>
            {tabs.map((item) => (
              <Pressable key={item} style={[styles.playerTab, { minWidth: 92 }]} onPress={() => setTab(item)}>
                <Text style={[styles.playerTabText, tab === item && styles.playerTabTextActive]}>{item}</Text>
                {tab === item && <View style={styles.playerTabIndicator} />}
              </Pressable>
            ))}
          </ScrollView>

          {loading && !bundle ? <ApiPanel loading /> : null}
          {error && !bundle ? <ApiPanel error={error} onRetry={reload} /> : null}
          {!loading && bundle && tab === "OVERVIEW" && <RealDataRows data={person} limit={30} />}
          {!loading && bundle && tab === "STATS" && <RealDataRows data={stats} limit={50} />}
          {!loading && bundle && tab === "TRANSFERS" && <RealDataRows data={bundle.transfers} limit={50} />}
          {!loading && bundle && tab === "TROPHIES" && <RealDataRows data={bundle.trophies} limit={50} />}
          {!loading && bundle && tab === "SIDELINED" && <RealDataRows data={bundle.sidelined} limit={50} />}
          <View style={styles.spacerLarge} />
        </View>
      </ScrollView>
    </View>
  );
}

function PlayerQuickStat({ value, label }) {
  return (
    <View style={styles.playerQuickStat}>
      <Text numberOfLines={1} style={styles.playerQuickValue}>{value}</Text>
      <Text style={styles.playerQuickLabel}>{label}</Text>
    </View>
  );
}

'''

s = s[:start] + new_section + s[end:]

old_open_player = '''  const openPlayer = () => {
    setRoute({
      name: "player",
      params: null,
    });
  };
'''
new_open_player = '''  const openPlayer = (player) => {
    setRoute({
      name: "player",
      params: player?.id ? player : { id: 1100, name: "Erling Haaland" },
    });
  };

  const openTeam = (team) => {
    if (!team?.id) return;
    setRoute({
      name: "team",
      params: team,
    });
  };
'''
if old_open_player not in s:
    raise SystemExit("openPlayer block not found")
s = s.replace(old_open_player, new_open_player, 1)

old_match_route = '''        {route.name === "match" && (
          <MatchDetailScreen
            match={route.params}
            goBack={goBack}
          />
        )}
'''
new_match_route = '''        {route.name === "match" && (
          <MatchDetailScreen
            match={route.params}
            goBack={goBack}
            openMatch={openMatch}
            openTeam={openTeam}
            openPlayer={openPlayer}
          />
        )}
'''
if old_match_route not in s:
    raise SystemExit("match route block not found")
s = s.replace(old_match_route, new_match_route, 1)

old_league_route = '''        {route.name === "league" && (
          <LeagueScreen
            league={route.params}
            goBack={goBack}
          />
        )}
'''
new_league_route = '''        {route.name === "league" && (
          <LeagueScreen
            league={route.params}
            goBack={goBack}
            openMatch={openMatch}
            openTeam={openTeam}
            openPlayer={openPlayer}
          />
        )}

        {route.name === "team" && (
          <TeamScreen
            team={route.params}
            goBack={goBack}
            openMatch={openMatch}
            openPlayer={openPlayer}
          />
        )}
'''
if old_league_route not in s:
    raise SystemExit("league route block not found")
s = s.replace(old_league_route, new_league_route, 1)

old_player_route = '''        {route.name === "player" && (
          <PlayerScreen goBack={goBack} />
        )}
'''
new_player_route = '''        {route.name === "player" && (
          <PlayerScreen player={route.params} goBack={goBack} />
        )}
'''
if old_player_route not in s:
    raise SystemExit("player route block not found")
s = s.replace(old_player_route, new_player_route, 1)

# Add team navigation from Discover popular teams without changing the visual design.
s = s.replace('function MoreScreen({ openLeague, openPlayer }) {', 'function MoreScreen({ openLeague, openPlayer, openTeam }) {', 1)
old_team_view = '''            <View
              key={team.id}
              style={[
                styles.listRow,
                index !== TEAMS.length - 1 &&
                  styles.listRowBorder,
              ]}
            >'''
new_team_view = '''            <Pressable
              key={team.id}
              style={[
                styles.listRow,
                index !== TEAMS.length - 1 &&
                  styles.listRowBorder,
              ]}
              onPress={() => openTeam(team)}
            >'''
if old_team_view in s:
    s = s.replace(old_team_view, new_team_view, 1)
    # Only replace the first matching close immediately following the POPULAR TEAMS block area.
    anchor = s.find('<SectionHeader title="POPULAR TEAMS" />')
    if anchor >= 0:
        close = s.find('            </View>\n          ))}', anchor)
        if close >= 0:
            s = s[:close] + '            </Pressable>\n          ))}' + s[close + len('            </View>\n          ))}'):]

old_more_call = '''          <MoreScreen
            openLeague={openLeague}
            openPlayer={openPlayer}
          />'''
new_more_call = '''          <MoreScreen
            openLeague={openLeague}
            openPlayer={openPlayer}
            openTeam={openTeam}
          />'''
if old_more_call not in s:
    raise SystemExit("MoreScreen call not found")
s = s.replace(old_more_call, new_more_call, 1)

# Sanity guards: all fake detail implementations must be gone.
for banned in [
    'function MatchFacts()',
    'function Lineups()',
    'function Statistics()',
    'function HeadToHead()',
    'function PlayerOverview()',
    'function PlayerStats()',
    'TABLE.map((row)',
]:
    if banned in s:
        raise SystemExit(f"old fake data remains: {banned}")

required = [
    'fetchMatchBundle', 'fetchCompetitionBundle', 'fetchTeamBundle', 'fetchPlayerBundle',
    'function TeamScreen', 'function MatchEventsReal', 'function LeagueTable({ rows, openTeam })',
]
for item in required:
    if item not in s:
        raise SystemExit(f"required integration missing: {item}")

path.write_text(s)
print("Full MST football data integration applied")
