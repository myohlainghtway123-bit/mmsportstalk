import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import {
  getAccountPredictions,
  getAuthStatus,
  getLeaderboard,
  normalizeLeaderboard,
  normalizePredictionPayload,
  PREDICTION_SCORING,
  savePredictionScore,
} from "../services/accountApi";
import {
  fetchFastFootballMatches,
  peekFastFootballMatches,
  prefetchFastFootballMatches,
} from "../services/fastFootballApi";
import { isLiveMatch } from "../services/footballApi";
import { shareLeaderboard, sharePrediction } from "../utils/shareUtils";

const TABS = ["Predict", "My Predictions", "Points", "Leaderboard"];

const MAJOR_LEAGUE_PATTERNS = [
  /champions\s*league/i,
  /premier\s*league/i,
  /la\s*liga/i,
  /serie\s*a/i,
  /bundesliga/i,
  /ligue\s*1/i,
  /europa\s*league/i,
  /conference\s*league/i,
  /world\s*cup/i,
  /euro\b/i,
  /asian\s*cup/i,
  /afcon/i,
  /copa\s*america/i,
];

const BIG_CLUB_PATTERNS = [
  /real\s*madrid/i, /barcelona/i, /manchester\s*united/i, /manchester\s*city/i,
  /liverpool/i, /arsenal/i, /chelsea/i, /bayern/i, /juventus/i, /inter\b/i,
  /milan/i, /paris\s*saint/i, /psg/i, /tottenham/i, /dortmund/i, /atletico/i,
];

const ASEAN_PATTERNS = [
  /myanmar/i, /thailand/i, /vietnam/i, /indonesia/i, /malaysia/i, /singapore/i,
  /cambodia/i, /laos/i, /philippines/i, /thai\s*league/i, /aff\b/i, /asean/i,
];

export function calculatePredictionPriority(match) {
  const comp = String(match?.competition || "");
  const home = String(match?.home?.name || "");
  const away = String(match?.away?.name || "");

  // Priority A: Myanmar / ASEAN (1000)
  const isAseanComp = ASEAN_PATTERNS.some((p) => p.test(comp));
  const isAseanTeam = ASEAN_PATTERNS.some((p) => p.test(home) || p.test(away));
  if (isAseanComp || isAseanTeam) return 1000;

  // Priority B: Major global football (800)
  const isMajorComp = MAJOR_LEAGUE_PATTERNS.some((p) => p.test(comp));
  if (isMajorComp) return 800;

  // Priority C: Big clubs / nations (500)
  const isBigClub = BIG_CLUB_PATTERNS.some((p) => p.test(home) || p.test(away));
  if (isBigClub) return 500;

  // Priority D: Remaining fixtures (100)
  return 100;
}

function bangkokDate(offset = 0) {
  const date = new Date(Date.now() + offset * 86400000);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  } catch (_) {
    return date.toISOString().slice(0, 10);
  }
}

function matchTime(match) {
  if (!match?.kickoff) return "";
  const d = new Date(match.kickoff);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Logo({ uri, size = 34, colors }) {
  return uri ? (
    <Image source={{ uri }} resizeMode="contain" style={{ width: size, height: size }} fadeDuration={0} />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.card2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="football-outline" size={size * 0.52} color={colors.muted} />
    </View>
  );
}

function scoreValue(value) {
  const digits = String(value ?? "").replace(/[^0-9]/g, "").slice(0, 2);
  if (!digits) return "";
  return String(Math.min(20, Number(digits)));
}

function locked(match) {
  if (!match) return true;
  if (isLiveMatch(match)) return true;
  const kickoff = match.kickoff ? new Date(match.kickoff).getTime() : NaN;
  return Number.isFinite(kickoff) ? Date.now() >= kickoff : false;
}

function PredictionCard({ match, saved, onSave, saving, onOpen, colors, my }) {
  const [home, setHome] = useState(saved?.homeScore != null ? String(saved.homeScore) : "");
  const [away, setAway] = useState(saved?.awayScore != null ? String(saved.awayScore) : "");

  useEffect(() => {
    if (saved?.homeScore != null) setHome(String(saved.homeScore));
    if (saved?.awayScore != null) setAway(String(saved.awayScore));
  }, [saved?.homeScore, saved?.awayScore]);

  const isLocked = locked(match);
  const dirty = home !== "" && away !== "" && (Number(home) !== saved?.homeScore || Number(away) !== saved?.awayScore);

  return (
    <View style={[styles.predictCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable style={styles.predictTop} onPress={() => onOpen?.(match)}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.competition, { color: colors.text }]}>
            {match.competition || "Football"}
          </Text>
          <Text style={[styles.kickoff, { color: colors.muted }]}>{matchTime(match)}</Text>
        </View>
        <View
          style={[
            styles.lockPill,
            {
              backgroundColor: isLocked ? colors.panel : colors.redSoft,
              borderColor: isLocked ? colors.border : colors.green,
            },
          ]}
        >
          <Ionicons name={isLocked ? "lock-closed" : "time-outline"} size={13} color={isLocked ? colors.muted : colors.green} />
          <Text style={[styles.lockText, { color: isLocked ? colors.muted : colors.green }]}>
            {isLocked ? (my ? "ပိတ်ပြီး" : "LOCKED") : (my ? "ခန့်မှန်းနိုင်" : "OPEN")}
          </Text>
        </View>
      </Pressable>

      <View style={styles.predictTeams}>
        <View style={styles.predictTeam}>
          <Logo uri={match.home?.logo} colors={colors} />
          <Text numberOfLines={2} style={[styles.predictName, { color: colors.text }]}>
            {match.home?.name}
          </Text>
        </View>
        <View style={styles.scoreEntry}>
          <TextInput
            value={home}
            onChangeText={(v) => setHome(scoreValue(v))}
            editable={!isLocked && !saving}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="0"
            placeholderTextColor={colors.muted}
            style={[styles.scoreInput, { backgroundColor: colors.panel, borderColor: colors.border, color: colors.text }]}
          />
          <Text style={[styles.colon, { color: colors.muted }]}>:</Text>
          <TextInput
            value={away}
            onChangeText={(v) => setAway(scoreValue(v))}
            editable={!isLocked && !saving}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="0"
            placeholderTextColor={colors.muted}
            style={[styles.scoreInput, { backgroundColor: colors.panel, borderColor: colors.border, color: colors.text }]}
          />
        </View>
        <View style={styles.predictTeam}>
          <Logo uri={match.away?.logo} colors={colors} />
          <Text numberOfLines={2} style={[styles.predictName, { color: colors.text }]}>
            {match.away?.name}
          </Text>
        </View>
      </View>

      {!isLocked ? (
        <Pressable
          disabled={!dirty || saving}
          style={[
            styles.saveButton,
            { backgroundColor: colors.red },
            (!dirty || saving) && { opacity: 0.45 },
          ]}
          onPress={() => onSave?.(match, Number(home), Number(away))}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveText}>
              {saved ? (my ? "ခန့်မှန်းချက် ပြင်မည်" : "UPDATE PREDICTION") : (my ? "ခန့်မှန်းချက် သိမ်းမည်" : "SAVE PREDICTION")}
            </Text>
          )}
        </Pressable>
      ) : (
        <Text style={[styles.lockNotice, { color: colors.muted }]}>
          {my ? "ပွဲစတင်ချိန်တွင် ခန့်မှန်းချက် အလိုအလျောက် ပိတ်သည်။" : "Predictions lock automatically at kickoff."}
        </Text>
      )}
    </View>
  );
}

export default function PredictionScreenV2({ onOpenMatch, language = "my" }) {
  const { colors } = useTheme();
  const my = language === "my";
  const [tab, setTab] = useState("Predict");
  const [auth, setAuth] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [myPredictions, setMyPredictions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbTimeframe, setLbTimeframe] = useState("all");
  const [lbMeta, setLbMeta] = useState(null);
  const [lbLoading, setLbLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matches, setMatches] = useState([]);

  const loadLeaderboard = useCallback(async (tf = "all") => {
    setLbLoading(true);
    try {
      const board = await getLeaderboard(tf, { limit: 50 }).catch(() => null);
      if (board) {
        setLeaderboard(normalizeLeaderboard(board));
        setLbMeta(board?.meta || null);
      }
    } finally {
      setLbLoading(false);
    }
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const authRes = await getAuthStatus().catch(() => ({ authenticated: false }));
      setAuth(Boolean(authRes.authenticated));

      // Fetch today + tomorrow matches for prediction
      const today = bangkokDate(0);
      const tomorrow = bangkokDate(1);
      const [todayMatches, tomorrowMatches] = await Promise.all([
        fetchFastFootballMatches({ date: today }).catch(() => ({ matches: [] })),
        fetchFastFootballMatches({ date: tomorrow }).catch(() => ({ matches: [] })),
      ]);

      const all = [...(todayMatches.matches || []), ...(tomorrowMatches.matches || [])];
      setMatches(all);

      if (authRes.authenticated) {
        const preds = await getAccountPredictions().catch(() => []);
        setMyPredictions(normalizePredictionPayload(preds));
      }

      // Load leaderboard independently
      loadLeaderboard(lbTimeframe);
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lbTimeframe, loadLeaderboard]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (match, homeScore, awayScore) => {
    if (!auth) {
      alert(my ? "ခန့်မှန်းချက်သိမ်းရန် အကောင့်ဝင်ပါ" : "Sign in to save predictions");
      return;
    }
    setSavingId(match.id);
    try {
      await savePredictionScore({ matchId: match.id, homeScore, awayScore });
      await loadData(true);
    } catch (e) {
      alert(e?.message || "Could not save prediction");
    } finally {
      setSavingId(null);
    }
  };

  const predMap = useMemo(() => {
    const map = new Map();
    for (const p of myPredictions) {
      map.set(String(p.matchId), p);
    }
    return map;
  }, [myPredictions]);

  const { featuredMatches, otherMatches } = useMemo(() => {
    const list = [...matches];
    list.sort((a, b) => {
      const pa = calculatePredictionPriority(a);
      const pb = calculatePredictionPriority(b);
      if (pa !== pb) return pb - pa;
      const ka = a.kickoff ? new Date(a.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
      const kb = b.kickoff ? new Date(b.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
      return ka - kb;
    });

    const featured = [];
    const others = [];
    for (const m of list) {
      if (calculatePredictionPriority(m) >= 500) {
        featured.push(m);
      } else {
        others.push(m);
      }
    }
    return { featuredMatches: featured, otherMatches: others };
  }, [matches]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border2 }]}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>{my ? "ခန့်မှန်းပြိုင်ပွဲ" : "Predictions"}</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {my ? "ရလဒ်မှန်ကန်အောင် ခန့်မှန်းပြီး အမှတ်များရယူပါ" : "Predict scores · earn points · climb the leaderboard"}
          </Text>
        </View>
        <Pressable hitSlop={8} onPress={() => shareLeaderboard(1, 45, language)}>
          <Ionicons name="share-social-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Navigation Subtabs — horizontal scroll so all 4 fit on narrow screens */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabStrip, { borderBottomColor: colors.border2 }]}
        contentContainerStyle={styles.tabStripContent}
      >
        {TABS.map((t) => {
          const on = tab === t;
          const label = my
            ? ({ Predict: "ခန့်မှန်းရန်", "My Predictions": "ကျွန်ုပ်ခန့်မှန်းချက်", Points: "အမှတ်သတ်မှတ်ချက်", Leaderboard: "ဦးဆောင်သူများ" }[t] || t)
            : t;
          return (
            <Pressable
              key={t}
              style={[
                styles.tabItem,
                on && { backgroundColor: colors.redSoft, borderColor: colors.red, borderWidth: 1 },
              ]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabItemText, { color: on ? colors.red : colors.muted }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData(true);
            }}
            colors={[colors.red]}
            tintColor={colors.red}
          />
        }
      >
        {/* PREDICT TAB */}
        {tab === "Predict" ? (
          <>
            {!auth ? (
              <View style={[styles.authCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="person-circle-outline" size={32} color={colors.red} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.authTitle, { color: colors.text }]}>
                    {my ? "ခန့်မှန်းချက်များ သိမ်းဆည်းရန် အကောင့်ဝင်ပါ" : "Sign in to save predictions"}
                  </Text>
                  <Text style={[styles.authSub, { color: colors.muted }]}>
                    {my ? "MST account ဖြင့် ဖုန်းနှင့် ဝဘ်ဆိုက်တွင် တစ်ပြိုင်နက် သုံးနိုင်ပါသည်" : "Sync prediction history across app and web seamlessly."}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={[styles.scoringBanner, { backgroundColor: colors.panel, borderColor: colors.border }]}>
              <View style={[styles.scoringTag, { backgroundColor: colors.redSoft }]}>
                <Text style={[styles.scoringTagText, { color: colors.red }]}>SCORING</Text>
              </View>
              <Text style={[styles.scoringInfo, { color: colors.text2 }]}>
                {my ? "ရလဒ်အတိအကျ ၃ မှတ် · အနိုင်/အရှုံး/သရေ ၁ မှတ် · မှားယွင်း ၀ မှတ်" : "Exact score: 3 points · Correct win/draw/loss: 1 point · Wrong: 0 points."}
              </Text>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={colors.red} style={{ marginVertical: 30 }} />
            ) : matches.length ? (
              <>
                {featuredMatches.length > 0 ? (
                  <>
                    <View style={styles.matchesHead}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="star" size={14} color={colors.gold || "#F4C84D"} />
                        <Text style={[styles.matchesTitle, { color: colors.text }]}>
                          {my ? "ထိပ်တန်း ခန့်မှန်းပွဲစဉ်များ" : "FEATURED PREDICTIONS"}
                        </Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: colors.redSoft }]}>
                        <Text style={[styles.countBadgeText, { color: colors.red }]}>
                          {featuredMatches.length} {my ? "ပွဲ" : "matches"}
                        </Text>
                      </View>
                    </View>
                    {featuredMatches.map((m) => (
                      <PredictionCard
                        key={m.id}
                        match={m}
                        saved={predMap.get(String(m.id))}
                        onSave={handleSave}
                        saving={savingId === m.id}
                        onOpen={onOpenMatch}
                        colors={colors}
                        my={my}
                      />
                    ))}
                  </>
                ) : null}

                {otherMatches.length > 0 ? (
                  <>
                    <View style={[styles.matchesHead, featuredMatches.length > 0 && { marginTop: 14 }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="football-outline" size={14} color={colors.text2} />
                        <Text style={[styles.matchesTitle, { color: colors.text }]}>
                          {my ? "ပွဲစဉ်အားလုံး" : "ALL PREDICTIONS"}
                        </Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: colors.panel }]}>
                        <Text style={[styles.countBadgeText, { color: colors.muted }]}>
                          {otherMatches.length} {my ? "ပွဲ" : "matches"}
                        </Text>
                      </View>
                    </View>
                    {otherMatches.map((m) => (
                      <PredictionCard
                        key={m.id}
                        match={m}
                        saved={predMap.get(String(m.id))}
                        onSave={handleSave}
                        saving={savingId === m.id}
                        onOpen={onOpenMatch}
                        colors={colors}
                        my={my}
                      />
                    ))}
                  </>
                ) : null}
              </>
            ) : (
              <View style={styles.emptyWrap}>
                <Ionicons name="calendar-outline" size={32} color={colors.muted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{my ? "ပွဲစဉ်မရှိသေးပါ" : "No open matches"}</Text>
                <Text style={[styles.emptySub, { color: colors.muted }]}>
                  {my ? "နောက်ထပ်ပွဲစဉ်များ မကြာမီ ထွက်ပေါ်လာပါမည်" : "Upcoming prediction fixtures will appear soon."}
                </Text>
              </View>
            )}
          </>
        ) : null}

        {/* MY PREDICTIONS TAB */}
        {tab === "My Predictions" ? (
          myPredictions.length ? (
            myPredictions.map((item, idx) => (
              <View key={idx} style={[styles.historyRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.historyHead}>
                  <Text style={[styles.historyComp, { color: colors.muted }]}>{item.match?.competition || "Match"}</Text>
                  <View style={[styles.pointPill, { backgroundColor: item.points === 3 ? colors.green : item.points === 1 ? colors.gold : colors.panel }]}>
                    <Text style={styles.pointPillText}>{item.points != null ? `${item.points} PTS` : "PENDING"}</Text>
                  </View>
                </View>
                <View style={styles.historyTeams}>
                  <Text style={[styles.historyTeamName, { color: colors.text }]}>{item.match?.home?.name || "Home"}</Text>
                  <Text style={[styles.historyPick, { color: colors.red }]}>
                    {item.homeScore} - {item.awayScore}
                  </Text>
                  <Text style={[styles.historyTeamName, { color: colors.text, textAlign: "right" }]}>{item.match?.away?.name || "Away"}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="trophy-outline" size={32} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {my ? "ခန့်မှန်းချက် မှတ်တမ်းမရှိသေးပါ" : "No predictions yet"}
              </Text>
              <Text style={[styles.emptySub, { color: colors.muted }]}>
                {my ? "Predict tab သို့သွား၍ ပွဲရလဒ်များ စတင်ခန့်မှန်းပါ" : "Head to the Predict tab to make your first score prediction."}
              </Text>
            </View>
          )
        ) : null}

        {/* POINTS MATRIX TAB */}
        {tab === "Points" ? (
          <View style={[styles.pointsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.pointsHeading, { color: colors.text }]}>
              {my ? "တရားဝင် အမှတ်ပေးစည်းမျဉ်းများ" : "Official Scoring Rules"}
            </Text>
            <View style={styles.matrixRow}>
              <View style={[styles.matrixScoreBox, { backgroundColor: colors.green }]}>
                <Text style={styles.matrixScoreText}>3 PTS</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.matrixTitle, { color: colors.text }]}>{my ? "ရလဒ်အတိအကျ (Exact Score)" : "Exact Score Hit"}</Text>
                <Text style={[styles.matrixSub, { color: colors.muted }]}>{my ? "ဥပမာ ခန့်မှန်း ၂-၁၊ ပွဲပြီးရလဒ် ၂-၁" : "Example: Predicted 2-1, final score 2-1"}</Text>
              </View>
            </View>
            <View style={styles.matrixRow}>
              <View style={[styles.matrixScoreBox, { backgroundColor: colors.blue }]}>
                <Text style={styles.matrixScoreText}>1 PTS</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.matrixTitle, { color: colors.text }]}>{my ? "အနိုင်/အရှုံး/သရေ (Correct Outcome)" : "Correct Outcome"}</Text>
                <Text style={[styles.matrixSub, { color: colors.muted }]}>{my ? "ဥပမာ ခန့်မှန်း ၁-၀၊ ပွဲပြီးရလဒ် ၃-၁ (အိမ်ရှင်နိုင်)" : "Example: Predicted 1-0, final score 3-1"}</Text>
              </View>
            </View>
            <View style={styles.matrixRow}>
              <View style={[styles.matrixScoreBox, { backgroundColor: colors.panel, borderColor: colors.border2, borderWidth: 1 }]}>
                <Text style={[styles.matrixScoreText, { color: colors.muted }]}>0 PTS</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.matrixTitle, { color: colors.text }]}>{my ? "မှားယွင်းသောရလဒ် (Incorrect)" : "Wrong Outcome"}</Text>
                <Text style={[styles.matrixSub, { color: colors.muted }]}>{my ? "ခန့်မှန်းချက်လွဲချော်ပါက အမှတ်မရပါ" : "Incorrect winner or draw prediction"}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* LEADERBOARD TAB */}
        {tab === "Leaderboard" ? (
          <>
            {/* Timeframe selector */}
            <View style={styles.lbTimeframeRow}>
              {["weekly", "monthly", "all"].map((tf) => {
                const on = lbTimeframe === tf;
                const label = my
                  ? ({ weekly: "ဒီပတ်", monthly: "ဒီလ", all: "အားလုံး" }[tf])
                  : ({ weekly: "This Week", monthly: "This Month", all: "All Time" }[tf]);
                return (
                  <Pressable
                    key={tf}
                    style={[styles.lbTfBtn, on && { backgroundColor: colors.red }]}
                    onPress={() => {
                      setLbTimeframe(tf);
                      loadLeaderboard(tf);
                    }}
                  >
                    <Text style={[styles.lbTfText, { color: on ? "#FFF" : colors.muted }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.leaderboardCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.leaderboardHead}>
                <Text style={[styles.leaderboardTitle, { color: colors.text }]}>
                  {my ? "ဦးဆောင်သူများ ဇယား" : "Prediction Leaderboard"}
                </Text>
                <Text style={[styles.leaderboardSub, { color: colors.muted }]}>
                  {my ? "ထိပ်ဆုံး ခန့်မှန်းသူများ" : "Top Predictors"}
                </Text>
              </View>

              {lbLoading ? (
                <ActivityIndicator size="small" color={colors.red} style={{ marginVertical: 20 }} />
              ) : leaderboard.length ? (
                leaderboard.map((u, i) => {
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                  const isTop = i < 3;
                  return (
                    <View
                      key={u.id || i}
                      style={[
                        styles.rankRow,
                        { borderBottomColor: colors.border2 },
                        i === 0 && { backgroundColor: colors.redSoft },
                      ]}
                    >
                      {medal ? (
                        <Text style={styles.rankMedal}>{medal}</Text>
                      ) : (
                        <View style={[styles.rankBadge, { backgroundColor: colors.panel }]}>
                          <Text style={[styles.rankNum, { color: colors.muted }]}>#{u.rank || i + 1}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={[styles.rankName, { color: colors.text, fontWeight: isTop ? "900" : "700" }]}>
                          {u.name || "MST Player"}
                        </Text>
                        <Text style={[styles.rankStats, { color: colors.muted }]}>
                          {my
                            ? `ပြည့်ကျသင့် ${u.exact} · မှန် ${u.correct} · ကစားထားသည် ${u.played}`
                            : `Exact ${u.exact} · Correct ${u.correct} · Played ${u.played}`}
                        </Text>
                      </View>
                      <Text style={[styles.rankPts, { color: isTop ? colors.red : colors.text, fontSize: isTop ? 14 : 12 }]}>
                        {u.points || 0}
                        <Text style={{ fontSize: 9, fontWeight: "600", color: colors.muted }}> PTS</Text>
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text style={[styles.emptySub, { color: colors.muted, textAlign: "center", marginVertical: 24 }]}>
                  {my ? "ဦးဆောင်သူများ တွက်ချက်နေသည်…" : "Leaderboard calculating…"}
                </Text>
              )}

              {/* Current user rank badge */}
              {lbMeta?.currentUserRank ? (
                <View style={[styles.myRankBadge, { backgroundColor: colors.redSoft, borderColor: colors.red }]}>
                  <Ionicons name="person" size={14} color={colors.red} />
                  <Text style={[styles.myRankText, { color: colors.red }]}>
                    {my ? `သင်၏ ရပ်တည်မှု: #${lbMeta.currentUserRank}` : `Your rank: #${lbMeta.currentUserRank}`}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: "900" },
  tabStrip: { flexGrow: 0, height: 48, borderBottomWidth: 1, paddingVertical: 6 },
  tabStripContent: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 6 },
  tabItem: { paddingHorizontal: 12, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  tabItemText: { fontSize: 11, fontWeight: "800" },
  content: { padding: 12, paddingBottom: 40, gap: 12 },
  authCard: { padding: 14, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  authTitle: { fontSize: 13, fontWeight: "900" },
  authSub: { fontSize: 10, marginTop: 2, lineHeight: 14 },
  scoringBanner: { padding: 12, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  scoringTag: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  scoringTagText: { fontSize: 8.5, fontWeight: "900" },
  scoringInfo: { flex: 1, fontSize: 10.5, lineHeight: 15 },
  matchesHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginTop: 4 },
  matchesTitle: { fontSize: 11.5, fontWeight: "900", letterSpacing: 0.8 },
  matchesCount: { fontSize: 10.5, fontWeight: "700" },
  countBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  countBadgeText: { fontSize: 9.5, fontWeight: "900" },
  predictCard: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  predictTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  competition: { fontSize: 12.5, fontWeight: "900" },
  kickoff: { fontSize: 9.5, marginTop: 2 },
  lockPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  lockText: { fontSize: 9.5, fontWeight: "900" },
  predictTeams: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  predictTeam: { width: "32%", alignItems: "center", gap: 6 },
  predictName: { fontSize: 11.5, fontWeight: "800", textAlign: "center" },
  scoreEntry: { flexDirection: "row", alignItems: "center", gap: 6 },
  scoreInput: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, textAlign: "center", fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums"], padding: 0 },
  colon: { fontSize: 18, fontWeight: "900" },
  saveButton: { height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 4 },
  saveText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  lockNotice: { fontSize: 9.5, textAlign: "center", marginTop: 4 },
  emptyWrap: { padding: 40, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "900" },
  emptySub: { fontSize: 11, textAlign: "center", lineHeight: 16 },
  historyRow: { padding: 12, borderRadius: 12, borderWidth: 1, gap: 8 },
  historyHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyComp: { fontSize: 10.5, fontWeight: "700" },
  pointPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  pointPillText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  historyTeams: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyTeamName: { flex: 1, fontSize: 12, fontWeight: "800" },
  historyPick: { fontSize: 16, fontWeight: "900", fontVariant: ["tabular-nums"], marginHorizontal: 10 },
  pointsCard: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 14 },
  pointsHeading: { fontSize: 15, fontWeight: "900", marginBottom: 4 },
  matrixRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  matrixScoreBox: { width: 48, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  matrixScoreText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  matrixTitle: { fontSize: 12.5, fontWeight: "800" },
  matrixSub: { fontSize: 10, marginTop: 2 },
  lbTimeframeRow: { flexDirection: "row", gap: 8, marginBottom: 2 },
  lbTfBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(128,128,128,0.12)" },
  lbTfText: { fontSize: 11, fontWeight: "800" },
  leaderboardCard: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  leaderboardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 6 },
  leaderboardTitle: { fontSize: 14.5, fontWeight: "900" },
  leaderboardSub: { fontSize: 10, fontWeight: "700" },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  rankBadge: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  rankNum: { fontSize: 11, fontWeight: "900" },
  rankMedal: { fontSize: 22, width: 34, textAlign: "center" },
  rankName: { fontSize: 12, fontWeight: "800" },
  rankStats: { fontSize: 9.5, marginTop: 1.5 },
  rankPts: { fontSize: 14, fontWeight: "900", fontVariant: ["tabular-nums"] },
  myRankBadge: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 6 },
  myRankText: { fontSize: 12, fontWeight: "900" },
});
