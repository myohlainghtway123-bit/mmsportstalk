import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  getAccountPredictions,
  getAuthStatus,
  getFavorites,
  getLeaderboard,
  getProfile,
  logout,
  MST_SITE_URL,
  normalizeFavoritePayload,
  normalizeLeaderboard,
  normalizePredictionPayload,
  savePrediction,
  setFavorite,
  startEmailLogin,
  verifyEmailLogin,
} from "../services/accountApi";
import { fetchFootballMatches, isLiveMatch, offsetDateString } from "../services/footballApi";

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
  { id: 2, name: "UEFA Champions League", icon: "soccer" },
  { id: 39, name: "Premier League", icon: "crown-outline" },
  { id: 140, name: "LaLiga", icon: "soccer-field" },
  { id: 135, name: "Serie A", icon: "shield-outline" },
  { id: 78, name: "Bundesliga", icon: "run-fast" },
];

const POPULAR_TEAMS = [
  { id: 541, name: "Real Madrid", logo: "https://media.api-sports.io/football/teams/541.png" },
  { id: 50, name: "Manchester City", logo: "https://media.api-sports.io/football/teams/50.png" },
  { id: 529, name: "Barcelona", logo: "https://media.api-sports.io/football/teams/529.png" },
  { id: 40, name: "Liverpool", logo: "https://media.api-sports.io/football/teams/40.png" },
  { id: 42, name: "Arsenal", logo: "https://media.api-sports.io/football/teams/42.png" },
];

const POPULAR_PLAYERS = [
  { id: 1100, name: "Erling Haaland" },
];

function TeamLogo({ uri, size = 34 }) {
  return uri ? (
    <Image source={{ uri }} resizeMode="contain" style={{ width: size, height: size }} />
  ) : (
    <View style={[s.logoFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="football-outline" size={Math.max(16, size * 0.55)} color={C.muted} />
    </View>
  );
}

function Header({ title, subtitle, icon = "person-circle-outline" }) {
  return (
    <View style={s.header}>
      <View>
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name={icon} size={30} color={C.text} />
    </View>
  );
}

function StateCard({ loading, title, text, icon = "information-circle-outline", actionLabel, onAction }) {
  return (
    <View style={s.stateCard}>
      {loading ? <ActivityIndicator color={C.red} /> : <Ionicons name={icon} size={28} color={C.muted} />}
      <Text style={s.stateTitle}>{title || (loading ? "Loading…" : "MST")}</Text>
      {text ? <Text style={s.stateText}>{text}</Text> : null}
      {actionLabel && onAction ? <Pressable style={s.redButton} onPress={onAction}><Text style={s.redButtonText}>{actionLabel}</Text></Pressable> : null}
    </View>
  );
}

function SectionTitle({ children, right }) {
  return <View style={s.sectionHeader}><Text style={s.sectionTitle}>{children}</Text>{right ? <Text style={s.sectionRight}>{right}</Text> : null}</View>;
}

function extractProfile(payload, fallbackUser) {
  const source = payload?.profile || payload?.data?.profile || payload?.data || payload || fallbackUser || {};
  const user = source?.user || source;
  return {
    name: user?.displayName || user?.name || user?.username || fallbackUser?.name || "MST User",
    email: user?.email || fallbackUser?.email || "",
    avatar: user?.avatar || user?.avatarUrl || user?.image || null,
    points: user?.points ?? user?.predictionPoints ?? source?.points ?? null,
    joined: user?.createdAt || user?.created_at || source?.createdAt || null,
    raw: source,
  };
}

function LoginPanel({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sendCode = async () => {
    const clean = email.trim();
    if (!clean || !clean.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      await startEmailLogin(clean);
      setStep("code");
      setMessage("Verification code sent. Check your email.");
    } catch (e) {
      setError(e?.message || "Could not send verification code.");
    } finally { setBusy(false); }
  };

  const verify = async () => {
    if (!code.trim()) { setError("Enter the verification code."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await verifyEmailLogin(email, code);
      if (result?.status && !result.status.authenticated) {
        throw new Error("The code was accepted but the mobile session was not created. Try again once.");
      }
      setMessage("Signed in to your MST account.");
      onSignedIn?.();
    } catch (e) {
      setError(e?.message || "Verification failed.");
    } finally { setBusy(false); }
  };

  return (
    <View style={s.authCard}>
      <View style={s.authLogo}><Text style={s.authLogoText}>MST</Text></View>
      <Text style={s.authTitle}>Sign in to Myanmar Sports Talk</Text>
      <Text style={s.authText}>Use the same email as your MST website account. No separate app account.</Text>
      <TextInput
        style={s.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email address"
        placeholderTextColor={C.muted2}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!busy && step === "email"}
      />
      {step === "code" ? (
        <TextInput
          style={s.input}
          value={code}
          onChangeText={setCode}
          placeholder="Verification code"
          placeholderTextColor={C.muted2}
          keyboardType="number-pad"
          autoCapitalize="none"
          editable={!busy}
        />
      ) : null}
      {message ? <Text style={s.successText}>{message}</Text> : null}
      {error ? <Text style={s.errorText}>{error}</Text> : null}
      <Pressable style={[s.redButton, busy && s.disabled]} disabled={busy} onPress={step === "email" ? sendCode : verify}>
        {busy ? <ActivityIndicator color={C.text} /> : <Text style={s.redButtonText}>{step === "email" ? "SEND CODE" : "VERIFY & SIGN IN"}</Text>}
      </Pressable>
      {step === "code" ? <Pressable onPress={() => { setStep("email"); setCode(""); setError(""); }}><Text style={s.textButton}>Use a different email</Text></Pressable> : null}
      <Pressable onPress={() => Linking.openURL(`${MST_SITE_URL}/login`)}><Text style={s.webLink}>Open MST website login</Text></Pressable>
    </View>
  );
}

export function AccountScreen({ goBack }) {
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState({ authenticated: false, user: null });
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const status = await getAuthStatus();
      setAuth(status);
      if (status.authenticated) {
        const payload = await getProfile().catch(() => null);
        setProfile(extractProfile(payload, status.user));
      } else setProfile(null);
    } catch (e) { setError(e?.message || "Could not check MST account."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const signOut = async () => {
    setLoading(true);
    try { await logout(); } catch (_) {}
    setAuth({ authenticated: false, user: null }); setProfile(null); setLoading(false);
  };

  return (
    <View style={s.screen}>
      <View style={s.backHeader}>
        <Pressable onPress={goBack}><Ionicons name="chevron-back" size={28} color={C.text} /></Pressable>
        <Text style={s.backTitle}>My Account</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {loading ? <StateCard loading title="Checking MST account" /> : null}
        {!loading && error ? <StateCard title="Account unavailable" text={error} icon="cloud-offline-outline" actionLabel="RETRY" onAction={load} /> : null}
        {!loading && !error && !auth.authenticated ? <LoginPanel onSignedIn={load} /> : null}
        {!loading && auth.authenticated ? (
          <>
            <View style={s.profileCard}>
              {profile?.avatar ? <Image source={{ uri: profile.avatar }} style={s.avatar} /> : <View style={s.avatarFallback}><Ionicons name="person" size={34} color={C.text2} /></View>}
              <View style={{ flex: 1 }}><Text style={s.profileName}>{profile?.name || "MST User"}</Text><Text style={s.profileEmail}>{profile?.email || auth.user?.email || "Signed in"}</Text></View>
              {profile?.points !== null && profile?.points !== undefined ? <View style={s.pointsPill}><Text style={s.pointsNumber}>{profile.points}</Text><Text style={s.pointsLabel}>PTS</Text></View> : null}
            </View>
            <SectionTitle>ACCOUNT</SectionTitle>
            <View style={s.listCard}>
              {["Profile", "Favorites", "Predictions", "Notifications"].map((x, i) => <View key={x} style={[s.row, i !== 3 && s.rowBorder]}><Text style={s.rowText}>{x}</Text><Ionicons name="chevron-forward" size={18} color={C.muted} /></View>)}
            </View>
            <Pressable style={s.outlineButton} onPress={signOut}><Ionicons name="log-out-outline" size={19} color={C.red} /><Text style={s.outlineButtonText}>SIGN OUT</Text></Pressable>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function favoriteEntity(item, kind) {
  const nested = item?.[kind] || item?.team || item?.player || item?.competition || item?.league || item?.entity || item;
  return {
    id: nested?.id ?? item?.entityId ?? item?.teamId ?? item?.playerId ?? item?.competitionId ?? item?.id,
    name: nested?.name || nested?.title || item?.name || item?.displayName || `${kind} favorite`,
    logo: nested?.logo || nested?.photo || nested?.image || item?.logo || item?.photo || null,
    raw: item,
  };
}

function FavoriteRow({ entity, kind, onOpen, onRemove }) {
  return (
    <Pressable style={s.row} onPress={() => onOpen?.(entity)}>
      <View style={s.rowLeft}>
        {kind === "competition" ? <MaterialCommunityIcons name="trophy-outline" size={24} color={C.text2} /> : <TeamLogo uri={entity.logo} size={30} />}
        <Text numberOfLines={1} style={s.rowText}>{entity.name}</Text>
      </View>
      <Pressable hitSlop={10} onPress={() => onRemove?.(entity)}><Ionicons name="star" size={20} color={C.red} /></Pressable>
    </Pressable>
  );
}

function AddRow({ item, kind, onAdd }) {
  return (
    <View style={s.row}>
      <View style={s.rowLeft}>
        {kind === "competition" ? <MaterialCommunityIcons name={item.icon || "trophy-outline"} size={22} color={C.text2} /> : <TeamLogo uri={item.logo} size={29} />}
        <Text numberOfLines={1} style={s.rowText}>{item.name}</Text>
      </View>
      <Pressable style={s.smallAdd} onPress={() => onAdd(item)}><Ionicons name="add" size={18} color={C.text} /><Text style={s.smallAddText}>ADD</Text></Pressable>
    </View>
  );
}

export function FavoritesScreen({ openLeague, openTeam, openPlayer, openAccount }) {
  const [tab, setTab] = useState("Teams");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [auth, setAuth] = useState(false);
  const [favorites, setFavorites] = useState({ competitions: [], teams: [], players: [] });
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError("");
    try {
      const status = await getAuthStatus();
      setAuth(status.authenticated);
      if (status.authenticated) setFavorites(normalizeFavoritePayload(await getFavorites()));
      else setFavorites({ competitions: [], teams: [], players: [] });
    } catch (e) { setError(e?.message || "Could not load favorites."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const config = tab === "Leagues" ? { key: "competitions", kind: "competition", suggestions: POPULAR_COMPETITIONS, open: openLeague } : tab === "Players" ? { key: "players", kind: "player", suggestions: POPULAR_PLAYERS, open: openPlayer } : { key: "teams", kind: "team", suggestions: POPULAR_TEAMS, open: openTeam };
  const rows = (favorites[config.key] || []).map((x) => favoriteEntity(x, config.kind)).filter((x) => x.id);
  const favoriteIds = new Set(rows.map((x) => String(x.id)));
  const suggestions = config.suggestions.filter((x) => !favoriteIds.has(String(x.id)));

  const mutate = async (entity, active) => {
    if (!auth) { openAccount?.(); return; }
    setBusyId(String(entity.id)); setError("");
    try { await setFavorite({ kind: config.kind, id: entity.id, active }); await load(true); }
    catch (e) { setError(e?.message || "Could not update favorite."); }
    finally { setBusyId(null); }
  };

  return (
    <View style={s.screen}>
      <Header title="Favorites" subtitle="Synced with your MST account" icon="star-outline" />
      <View style={s.tabs}>{["Leagues","Teams","Players"].map((x) => <Pressable key={x} style={[s.tab, tab === x && s.tabActive]} onPress={() => setTab(x)}><Text style={[s.tabText, tab === x && s.tabTextActive]}>{x}</Text></Pressable>)}</View>
      <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.red} colors={[C.red]} />}>
        {loading ? <StateCard loading title="Loading favorites" /> : null}
        {!loading && !auth ? <StateCard title="Sign in to sync Favorites" text="Your favorite teams, competitions and players will stay connected with your MST website account." icon="person-circle-outline" actionLabel="SIGN IN" onAction={openAccount} /> : null}
        {error ? <Text style={s.errorBanner}>{error}</Text> : null}
        {!loading && auth ? (
          <>
            <SectionTitle right={`${rows.length}`}>MY {tab.toUpperCase()}</SectionTitle>
            {rows.length ? <View style={s.listCard}>{rows.map((entity, i) => <View key={`${entity.id}-${i}`} style={i !== rows.length - 1 ? s.rowBorder : null}><FavoriteRow entity={entity} kind={config.kind} onOpen={config.open} onRemove={(x) => mutate(x, false)} />{busyId === String(entity.id) ? <ActivityIndicator style={s.inlineBusy} color={C.red} /> : null}</View>)}</View> : <StateCard title={`No favorite ${tab.toLowerCase()} yet`} text="Add a few below and they will sync to your account." icon="star-outline" />}
            <SectionTitle>SUGGESTED</SectionTitle>
            <View style={s.listCard}>{suggestions.slice(0, 8).map((item, i) => <View key={item.id} style={i !== Math.min(suggestions.length,8)-1 ? s.rowBorder : null}><AddRow item={item} kind={config.kind} onAdd={(x) => mutate(x, true)} />{busyId === String(item.id) ? <ActivityIndicator style={s.inlineBusy} color={C.red} /> : null}</View>)}</View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function MiniMatch({ match, pick, onPick, onOpen, saving }) {
  return (
    <View style={s.predCard}>
      <Pressable onPress={() => onOpen?.(match)}>
        <View style={s.predTop}><Text numberOfLines={1} style={s.predCompetition}>{match.competition}</Text><Text style={s.predTime}>{match.minute}</Text></View>
        <View style={s.predTeams}>
          <View style={s.predTeam}><TeamLogo uri={match.home.logo} size={38} /><Text numberOfLines={2} style={s.predName}>{match.home.name}</Text></View>
          <Text style={s.vs}>VS</Text>
          <View style={s.predTeam}><TeamLogo uri={match.away.logo} size={38} /><Text numberOfLines={2} style={s.predName}>{match.away.name}</Text></View>
        </View>
      </Pressable>
      <View style={s.pickRow}>{[["home","Home"],["draw","Draw"],["away","Away"]].map(([id,label]) => <Pressable key={id} disabled={saving} style={[s.pickButton,pick===id&&s.pickButtonActive]} onPress={() => onPick(id)}><Text style={[s.pickText,pick===id&&s.pickTextActive]}>{label}</Text></Pressable>)}</View>
      {saving ? <ActivityIndicator style={{ marginTop: 8 }} color={C.red} /> : null}
    </View>
  );
}

export function PredictionScreen({ openMatch, openAccount }) {
  const [tab, setTab] = useState("Predict");
  const [auth, setAuth] = useState(false);
  const [history, setHistory] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [picks, setPicks] = useState({});
  const [saving, setSaving] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fixtures, setFixtures] = useState([]);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError("");
    try {
      const [status, leaderboard, today, tomorrow] = await Promise.all([
        getAuthStatus(),
        getLeaderboard().catch(() => null),
        fetchFootballMatches({ date: offsetDateString(0) }),
        fetchFootballMatches({ date: offsetDateString(1) }),
      ]);
      setAuth(status.authenticated);
      setLeaders(normalizeLeaderboard(leaderboard));
      const upcoming = [...(today.matches || []), ...(tomorrow.matches || [])]
        .filter((m) => !isLiveMatch(m) && !m.isFinished)
        .slice(0, 20);
      setFixtures(upcoming);
      if (status.authenticated) {
        const rows = normalizePredictionPayload(await getAccountPredictions());
        setHistory(rows);
        const saved = {};
        for (const row of rows) if (row.matchId && row.pick) saved[String(row.matchId)] = String(row.pick).toLowerCase();
        setPicks(saved);
      } else { setHistory([]); setPicks({}); }
    } catch (e) { setError(e?.message || "Could not load prediction data."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const makePick = async (match, pick) => {
    if (!auth) { openAccount?.(); return; }
    setSaving(String(match.id)); setError(""); setMessage("");
    try {
      await savePrediction({ matchId: match.id, pick });
      setPicks((prev) => ({ ...prev, [String(match.id)]: pick }));
      setMessage("Prediction saved to your MST account.");
      const rows = normalizePredictionPayload(await getAccountPredictions().catch(() => null));
      if (rows.length) setHistory(rows);
    } catch (e) { setError(e?.message || "Could not save prediction."); }
    finally { setSaving(null); }
  };

  const totalPoints = history.reduce((sum, row) => sum + (Number(row.points) || 0), 0);
  return (
    <View style={s.screen}>
      <Header title="Prediction" subtitle="Predict · earn points · climb the table" icon="trophy-outline" />
      <View style={s.tabs}>{["Predict","My Picks","Leaderboard"].map((x) => <Pressable key={x} style={[s.tab, tab===x&&s.tabActive]} onPress={() => setTab(x)}><Text style={[s.tabText,tab===x&&s.tabTextActive]}>{x}</Text></Pressable>)}</View>
      <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.red} colors={[C.red]} />}>
        {loading ? <StateCard loading title="Loading predictions" /> : null}
        {error ? <Text style={s.errorBanner}>{error}</Text> : null}
        {message ? <Text style={s.successBanner}>{message}</Text> : null}
        {!loading && tab === "Predict" ? (
          <>
            {!auth ? <StateCard title="Sign in to save predictions" text="You can browse fixtures now. Sign in when you are ready to submit a prediction." icon="person-circle-outline" actionLabel="SIGN IN" onAction={openAccount} /> : <View style={s.pointsCard}><View><Text style={s.pointsBig}>{totalPoints}</Text><Text style={s.pointsCaption}>YOUR POINTS</Text></View><View><Text style={s.pointsBig}>{history.length}</Text><Text style={s.pointsCaption}>PREDICTIONS</Text></View><Ionicons name="trophy" size={34} color={C.yellow} /></View>}
            <SectionTitle right={`${fixtures.length} matches`}>UPCOMING</SectionTitle>
            {fixtures.length ? fixtures.map((match) => <MiniMatch key={match.id} match={match} pick={picks[String(match.id)]} onPick={(pick) => makePick(match,pick)} onOpen={openMatch} saving={saving===String(match.id)} />) : <StateCard title="No upcoming fixtures" icon="calendar-outline" />}
          </>
        ) : null}
        {!loading && tab === "My Picks" ? (
          !auth ? <StateCard title="Sign in to see your prediction history" icon="person-circle-outline" actionLabel="SIGN IN" onAction={openAccount} /> : history.length ? <View style={s.listCard}>{history.map((row,i) => <View key={`${row.id}-${i}`} style={[s.historyRow,i!==history.length-1&&s.rowBorder]}><View style={{flex:1}}><Text style={s.historyTitle}>Match {row.matchId || "prediction"}</Text><Text style={s.historyMeta}>Pick: {String(row.pick || "-").toUpperCase()} · {row.status || "Saved"}</Text></View><Text style={s.historyPoints}>+{row.points || 0}</Text></View>)}</View> : <StateCard title="No predictions yet" text="Choose a match in Predict and make your first pick." icon="football-outline" />
        ) : null}
        {!loading && tab === "Leaderboard" ? (
          leaders.length ? <View style={s.listCard}>{leaders.slice(0,50).map((row,i) => <View key={`${row.id}-${i}`} style={[s.leaderRow,i!==Math.min(leaders.length,50)-1&&s.rowBorder]}><Text style={[s.rank,row.rank<=3&&{color:C.yellow}]}>{row.rank}</Text>{row.avatar?<Image source={{uri:row.avatar}} style={s.leaderAvatar}/>:<View style={s.leaderAvatarFallback}><Ionicons name="person" size={16} color={C.muted}/></View>}<View style={{flex:1}}><Text numberOfLines={1} style={s.leaderName}>{row.name}</Text><Text style={s.historyMeta}>{row.correct} correct · {row.predictions} picks</Text></View><Text style={s.leaderPoints}>{row.points}</Text></View>)}</View> : <StateCard title="Leaderboard not available yet" icon="trophy-outline" />
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},content:{paddingHorizontal:16,paddingTop:12,paddingBottom:40},
  header:{minHeight:70,paddingHorizontal:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:C.border2},title:{fontSize:22,fontWeight:"800",color:C.text},subtitle:{fontSize:11,color:C.muted,marginTop:3},
  backHeader:{minHeight:65,paddingHorizontal:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:C.border2},backTitle:{fontSize:16,fontWeight:"800",color:C.text},
  tabs:{flexDirection:"row",padding:8,gap:7,borderBottomWidth:1,borderBottomColor:C.border2},tab:{flex:1,paddingVertical:9,borderRadius:8,alignItems:"center"},tabActive:{backgroundColor:C.redSoft},tabText:{fontSize:11,fontWeight:"700",color:C.muted},tabTextActive:{color:C.red},
  sectionHeader:{marginTop:16,marginBottom:9,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},sectionTitle:{fontSize:12,fontWeight:"800",color:C.text2},sectionRight:{fontSize:11,color:C.muted},
  stateCard:{minHeight:130,borderRadius:12,borderWidth:1,borderColor:C.border2,backgroundColor:C.card,padding:18,alignItems:"center",justifyContent:"center",gap:7,marginBottom:12},stateTitle:{fontSize:14,fontWeight:"800",color:C.text,textAlign:"center"},stateText:{fontSize:11,color:C.muted,textAlign:"center",lineHeight:17},
  redButton:{minHeight:42,backgroundColor:C.red,borderRadius:8,paddingHorizontal:18,paddingVertical:11,alignItems:"center",justifyContent:"center",marginTop:8},redButtonText:{fontSize:11,fontWeight:"900",color:C.text},disabled:{opacity:.6},
  authCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:14,padding:18},authLogo:{alignSelf:"center",marginBottom:8},authLogoText:{fontSize:38,fontWeight:"900",fontStyle:"italic",letterSpacing:-2,color:C.red},authTitle:{fontSize:18,fontWeight:"800",color:C.text,textAlign:"center"},authText:{fontSize:11,color:C.muted,textAlign:"center",lineHeight:17,marginTop:7,marginBottom:14},input:{height:48,borderWidth:1,borderColor:C.border,borderRadius:9,backgroundColor:C.bg2,color:C.text,paddingHorizontal:13,fontSize:14,marginBottom:10},successText:{fontSize:11,color:C.green,textAlign:"center",marginVertical:4},errorText:{fontSize:11,color:C.red,textAlign:"center",marginVertical:4},textButton:{fontSize:11,color:C.text2,textAlign:"center",paddingVertical:12},webLink:{fontSize:10,color:C.muted,textAlign:"center",textDecorationLine:"underline",paddingTop:3},
  profileCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:13,padding:14,flexDirection:"row",alignItems:"center",gap:11},avatar:{width:54,height:54,borderRadius:27},avatarFallback:{width:54,height:54,borderRadius:27,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},profileName:{fontSize:16,fontWeight:"800",color:C.text},profileEmail:{fontSize:11,color:C.muted,marginTop:4},pointsPill:{alignItems:"center",backgroundColor:C.redSoft,borderRadius:9,paddingHorizontal:10,paddingVertical:7},pointsNumber:{fontSize:16,fontWeight:"900",color:C.red},pointsLabel:{fontSize:8,fontWeight:"800",color:C.muted},
  listCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,overflow:"hidden",marginBottom:12},row:{minHeight:53,paddingHorizontal:13,paddingVertical:9,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},rowBorder:{borderBottomWidth:1,borderBottomColor:C.border2},rowLeft:{flex:1,flexDirection:"row",alignItems:"center",gap:10},rowText:{fontSize:13,color:C.text2,flexShrink:1},logoFallback:{backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},
  outlineButton:{height:45,borderWidth:1,borderColor:C.red,borderRadius:9,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,marginTop:6},outlineButtonText:{fontSize:11,fontWeight:"900",color:C.red},
  smallAdd:{height:31,paddingHorizontal:9,borderRadius:6,backgroundColor:C.redSoft,flexDirection:"row",alignItems:"center",gap:3},smallAddText:{fontSize:9,fontWeight:"900",color:C.red},inlineBusy:{position:"absolute",right:70,top:17},errorBanner:{backgroundColor:C.redSoft,color:C.red,fontSize:11,padding:10,borderRadius:8,marginBottom:10,textAlign:"center"},successBanner:{backgroundColor:"rgba(49,198,116,0.12)",color:C.green,fontSize:11,padding:10,borderRadius:8,marginBottom:10,textAlign:"center"},
  predCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,padding:13,marginBottom:9},predTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},predCompetition:{flex:1,fontSize:10.5,fontWeight:"800",color:C.text2},predTime:{fontSize:10.5,color:C.muted},predTeams:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:12},predTeam:{width:"39%",alignItems:"center",gap:5},predName:{fontSize:11.5,color:C.text,textAlign:"center"},vs:{fontSize:12,fontWeight:"900",color:C.muted},pickRow:{flexDirection:"row",gap:7,marginTop:12},pickButton:{flex:1,height:37,borderWidth:1,borderColor:C.border,borderRadius:7,alignItems:"center",justifyContent:"center"},pickButtonActive:{backgroundColor:C.red,borderColor:C.red},pickText:{fontSize:10.5,color:C.text2},pickTextActive:{fontWeight:"900",color:C.text},
  pointsCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,padding:14,flexDirection:"row",alignItems:"center",justifyContent:"space-around"},pointsBig:{fontSize:24,fontWeight:"900",color:C.text,textAlign:"center"},pointsCaption:{fontSize:8.5,fontWeight:"800",color:C.muted,marginTop:3,textAlign:"center"},
  historyRow:{minHeight:58,paddingHorizontal:13,paddingVertical:10,flexDirection:"row",alignItems:"center",gap:10},historyTitle:{fontSize:12.5,fontWeight:"700",color:C.text2},historyMeta:{fontSize:10,color:C.muted,marginTop:3},historyPoints:{fontSize:15,fontWeight:"900",color:C.green},leaderRow:{minHeight:58,paddingHorizontal:11,paddingVertical:8,flexDirection:"row",alignItems:"center",gap:9},rank:{width:28,textAlign:"center",fontSize:13,fontWeight:"900",color:C.text2},leaderAvatar:{width:34,height:34,borderRadius:17},leaderAvatarFallback:{width:34,height:34,borderRadius:17,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},leaderName:{fontSize:12.5,fontWeight:"700",color:C.text2},leaderPoints:{width:48,textAlign:"right",fontSize:15,fontWeight:"900",color:C.red},
});
