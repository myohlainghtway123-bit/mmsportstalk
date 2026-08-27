import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import {
  extractArray,
  fetchCompetitionStandings,
  fetchMatchBundle,
  fetchMatchDetail,
  fetchMatchEvents,
  fetchMatchH2H,
  fetchMatchInjuries,
  fetchMatchLineups,
  fetchMatchPlayers,
  fetchMatchStatistics,
  fetchTeamMatches,
  isLiveMatch,
  normalizeFootballMatch,
  normalizeStandings,
} from "../services/footballApi";
import {
  findTeamMatchesFromFastCache,
  prefetchRecentPastMatches,
  getAllFastFootballMatches,
} from "../services/fastFootballApi";
import { fetchPreferredOdds } from "../services/oddsApi";
import {
  getAccountPredictions,
  getAuthStatus,
  normalizePredictionPayload,
  savePredictionScore,
} from "../services/accountApi";
import {
  DEFAULT_MATCH_ALERTS,
  getMatchAlert,
  getMatchPoll,
  registerDeviceForPush,
  removeMatchAlert,
  saveMatchAlert,
  scheduleKickoffReminders,
  voteMatchPoll,
} from "../services/matchEngagementApi";
import {
  connectMatchChat,
  createClientMessageId,
  getMatchChat,
  mergeChatMessages,
  postMatchChat,
  reportMatchChat,
} from "../services/communityApi";
import { shareMatch } from "../utils/shareUtils";
import MatchOddsCard from "./MatchOddsCard";

const TABS = ["FACTS", "CHAT", "LINEUP", "STATS", "H2H", "TABLE", "ODDS"];
const tx = (my, en, myText) => (my ? myText : en);
const num = (v) => {
  const n = Number(String(v ?? "").replace("%", ""));
  return Number.isFinite(n) ? n : null;
};
const fmtDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};
const matchStatusCode = (m) => String(m?.statusCode || m?.status || "").trim().toUpperCase();
const finished = (m) => ["FT", "AET", "PEN", "FINISHED"].includes(matchStatusCode(m));

function Logo({ uri, size = 54, colors }) {
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
      <Ionicons name="football-outline" size={size * 0.45} color={colors.muted} />
    </View>
  );
}

function statusLabel(match) {
  const code = matchStatusCode(match);
  if (code === "HT") return "HT";
  if (code === "P") return "PEN";
  if (code === "BT") return "BREAK";
  if (code === "SUSP" || code === "SUSPENDED") return "SUSP";
  if (code === "INT" || code === "INTERRUPTED") return "INT";
  if (code === "PST" || code === "POSTPONED") return "POSTPONED";
  if (code === "CANC" || code === "CANCELLED" || code === "CANCELED") return "CANCELLED";
  if (code === "ABD" || code === "ABANDONED") return "ABANDONED";
  if (code === "AET") return "AET";
  if (code === "PEN") return "PEN";
  if (code === "FT" || code === "FINISHED") return "FT";
  if (isLiveMatch(match)) {
    const elapsed = Number(match?.elapsed);
    if (Number.isFinite(elapsed) && elapsed >= 0) return `${elapsed}'`;
    const minute = String(match?.minute || "").trim();
    if (/^\d+(?:\+\d+)?'?$/.test(minute)) return minute.endsWith("'") ? minute : `${minute}'`;
    return code && code !== "NS" ? code : "LIVE";
  }
  return code === "NS" ? "NOT STARTED" : code || "MATCH";
}

function normalizeTeamMatches(payload) {
  return extractArray(payload)
    .map((x, i) => normalizeFootballMatch(x, i))
    .filter((m) => m?.id && m?.home?.name && m?.away?.name);
}

function isSameTeam(a, b) {
  if (!a || !b) return false;
  const aId = a.id != null ? String(a.id) : (typeof a === "string" || typeof a === "number" ? String(a) : null);
  const bId = b.id != null ? String(b.id) : (typeof b === "string" || typeof b === "number" ? String(b) : null);
  if (aId && bId && aId === bId) return true;
  const aName = (a.name || (typeof a === "string" ? a : "")).trim().toLowerCase();
  const bName = (b.name || (typeof b === "string" ? b : "")).trim().toLowerCase();
  if (aName && bName && (aName === bName || aName.includes(bName) || bName.includes(aName))) return true;
  return false;
}

function getTeamMatchDetails(m, team) {
  const isHome = isSameTeam(m.home, team);
  const ownScore = isHome ? m.homeScore : m.awayScore;
  const oppScore = isHome ? m.awayScore : m.homeScore;
  const opponent = isHome ? m.away : m.home;
  let outcome = "D";
  if (ownScore != null && oppScore != null) {
    if (ownScore > oppScore) outcome = "W";
    else if (ownScore < oppScore) outcome = "L";
  }
  return {
    isHome,
    ownScore,
    oppScore,
    opponent,
    outcome,
    scoreText: `${m.homeScore ?? "-"}-${m.awayScore ?? "-"}`,
  };
}

function calculateTeamFormStats(matches, team) {
  const now = Date.now();
  const rows = (matches || [])
    .filter((m) => {
      const matchTeam = isSameTeam(m.home, team) || isSameTeam(m.away, team);
      const isFin = finished(m) || m.homeScore != null;
      const isPast = m.kickoff ? new Date(m.kickoff).getTime() <= now : true;
      return matchTeam && isFin && isPast;
    })
    .sort((a, b) => new Date(b.kickoff || 0) - new Date(a.kickoff || 0))
    .slice(0, 5);

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let gf = 0;
  let ga = 0;
  let cs = 0;

  const enriched = rows.map((m) => {
    const details = getTeamMatchDetails(m, team);
    if (details.outcome === "W") wins += 1;
    else if (details.outcome === "L") losses += 1;
    else draws += 1;
    gf += details.ownScore ?? 0;
    ga += details.oppScore ?? 0;
    if (details.oppScore === 0) cs += 1;
    return { ...m, ...details };
  });

  const total = enriched.length;
  const pts = wins * 3 + draws * 1;
  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;

  return {
    rows: enriched,
    wins,
    draws,
    losses,
    pts,
    total,
    winPct,
    gf,
    ga,
    cs,
  };
}

function TeamPreviousMatchesCard({ title, team, matches, my, colors }) {
  const stats = useMemo(() => calculateTeamFormStats(matches, team), [matches, team]);
  if (!team?.name && !team?.id) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Team Header & 5-Match Form Pills */}
      <View style={styles.formCardHeader}>
        <View style={styles.formCardTeamWrap}>
          <Logo uri={team?.logo} size={28} colors={colors} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[styles.formCardTeamName, { color: colors.text }]}>
              {title || team?.name}
            </Text>
            <Text style={[styles.formCardSub, { color: colors.muted }]}>
              {tx(my, `Previous 5 matches played`, `ယခင်ကစားခဲ့သော ၅ ပွဲမှတ်တမ်း`)}
            </Text>
          </View>
        </View>
        {stats.rows.length ? (
          <View style={styles.formPillsRow}>
            {stats.rows.map((m, idx) => {
              const bg = m.outcome === "W" ? colors.green : m.outcome === "L" ? colors.red : colors.muted;
              return (
                <View key={m.id || idx} style={[styles.formPill, { backgroundColor: bg }]}>
                  <Text style={styles.formPillText}>{m.outcome}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {stats.rows.length ? (
        <>
          {/* Form Summary Banner */}
          <View style={[styles.formSummaryBanner, { backgroundColor: colors.panel, borderColor: colors.border2 }]}>
            <View style={styles.formSummaryItem}>
              <Text style={[styles.formSummaryVal, { color: colors.text }]}>
                {stats.pts}
                <Text style={styles.formSummarySubVal}>/15</Text>
              </Text>
              <Text style={[styles.formSummaryLbl, { color: colors.muted }]}>{tx(my, "PTS", "ရမှတ်")}</Text>
            </View>
            <View style={[styles.formSummaryDivider, { backgroundColor: colors.border2 }]} />
            <View style={styles.formSummaryItem}>
              <Text style={[styles.formSummaryVal, { color: colors.green }]}>
                {stats.wins}W <Text style={{ color: colors.muted }}>{stats.draws}D</Text> <Text style={{ color: colors.red }}>{stats.losses}L</Text>
              </Text>
              <Text style={[styles.formSummaryLbl, { color: colors.muted }]}>{tx(my, "RECORD", "ရလဒ်")}</Text>
            </View>
            <View style={[styles.formSummaryDivider, { backgroundColor: colors.border2 }]} />
            <View style={styles.formSummaryItem}>
              <Text style={[styles.formSummaryVal, { color: colors.text }]}>
                {stats.gf}
                <Text style={{ color: colors.muted }}>:{stats.ga}</Text>
              </Text>
              <Text style={[styles.formSummaryLbl, { color: colors.muted }]}>{tx(my, "GOALS", "ဂိုး")}</Text>
            </View>
          </View>

          {/* 5 Match Detail Rows */}
          <View style={styles.prevMatchesList}>
            {stats.rows.map((m, i) => {
              const resColor = m.outcome === "W" ? colors.green : m.outcome === "L" ? colors.red : colors.muted;
              return (
                <View
                  key={m.id || i}
                  style={[
                    styles.prevMatchRow,
                    i > 0 && { borderTopWidth: 1, borderTopColor: colors.border2 },
                  ]}
                >
                  {/* Result Badge */}
                  <View style={[styles.prevMatchResultBadge, { backgroundColor: resColor }]}>
                    <Text style={styles.prevMatchResultText}>{m.outcome}</Text>
                  </View>

                  {/* Match Meta (Date & Competition) */}
                  <View style={styles.prevMatchMeta}>
                    <Text style={[styles.prevMatchDate, { color: colors.muted }]}>
                      {m.kickoff ? new Date(m.kickoff).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}
                    </Text>
                    <Text numberOfLines={1} style={[styles.prevMatchComp, { color: colors.muted2 }]}>
                      {m.competition}
                    </Text>
                  </View>

                  {/* Opponent & Location */}
                  <View style={styles.prevMatchOpponent}>
                    <View style={[styles.homeAwayTag, { backgroundColor: m.isHome ? colors.redSoft : colors.card2 }]}>
                      <Text style={[styles.homeAwayTagText, { color: m.isHome ? colors.red : colors.muted }]}>
                        {m.isHome ? "H" : "A"}
                      </Text>
                    </View>
                    <Logo uri={m.opponent?.logo} size={20} colors={colors} />
                    <Text numberOfLines={1} style={[styles.prevMatchOppName, { color: colors.text }]}>
                      {m.opponent?.name}
                    </Text>
                  </View>

                  {/* Score Pill */}
                  <View style={[styles.prevMatchScorePill, { backgroundColor: colors.panel, borderColor: colors.border2 }]}>
                    <Text style={[styles.prevMatchScoreText, { color: colors.text }]}>
                      {m.scoreText}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <Text style={[styles.empty, { color: colors.muted, marginVertical: 8 }]}>
          {tx(my, "No previous matches recorded yet for this team.", "ဤအသင်းအတွက် ယခင်ပွဲမှတ်တမ်း မရှိသေးပါ။")}
        </Text>
      )}
    </View>
  );
}

function FormComparisonMatrix({ current, homeMatches, awayMatches, my, colors }) {
  const homeStats = useMemo(() => calculateTeamFormStats(homeMatches, current?.home?.id), [homeMatches, current?.home?.id]);
  const awayStats = useMemo(() => calculateTeamFormStats(awayMatches, current?.away?.id), [awayMatches, current?.away?.id]);

  if (!homeStats.rows.length && !awayStats.rows.length) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.cardTitleNoMargin, { color: colors.text }]}>
        {tx(my, "Recent Form Comparison (Last 5 Games)", "နောက်ဆုံး ၅ ပွဲ နှိုင်းယှဉ်ချက်")}
      </Text>
      <Text style={[styles.smallMuted, { color: colors.muted }]}>
        {tx(my, "Head-to-head performance across all recent competitions", "မကြာသေးမီက ယှဉ်ပြိုင်ခဲ့သော ပြိုင်ပွဲစုံ ခြေစွမ်းမှတ်တမ်း")}
      </Text>

      {/* Side-by-side header */}
      <View style={styles.matrixTeamsHeader}>
        <View style={styles.matrixTeamCol}>
          <Logo uri={current?.home?.logo} size={26} colors={colors} />
          <Text numberOfLines={1} style={[styles.matrixTeamName, { color: colors.text }]}>{current?.home?.name}</Text>
        </View>
        <Text style={[styles.matrixVs, { color: colors.muted }]}>VS</Text>
        <View style={[styles.matrixTeamCol, { alignItems: "flex-end", justifyContent: "flex-end" }]}>
          <Text numberOfLines={1} style={[styles.matrixTeamName, { color: colors.text, textAlign: "right" }]}>{current?.away?.name}</Text>
          <Logo uri={current?.away?.logo} size={26} colors={colors} />
        </View>
      </View>

      {/* Comparison rows */}
      <View style={styles.matrixRows}>
        {/* Form pills row */}
        <View style={[styles.matrixRow, { borderBottomColor: colors.border2 }]}>
          <View style={styles.matrixPills}>
            {homeStats.rows.map((m, idx) => (
              <View key={idx} style={[styles.matrixMiniPill, { backgroundColor: m.outcome === "W" ? colors.green : m.outcome === "L" ? colors.red : colors.muted }]}>
                <Text style={styles.matrixMiniPillText}>{m.outcome}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.matrixMetricLbl, { color: colors.muted }]}>{tx(my, "FORM", "ခြေစွမ်း")}</Text>
          <View style={[styles.matrixPills, { justifyContent: "flex-end" }]}>
            {awayStats.rows.map((m, idx) => (
              <View key={idx} style={[styles.matrixMiniPill, { backgroundColor: m.outcome === "W" ? colors.green : m.outcome === "L" ? colors.red : colors.muted }]}>
                <Text style={styles.matrixMiniPillText}>{m.outcome}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Points row */}
        <View style={[styles.matrixRow, { borderBottomColor: colors.border2 }]}>
          <Text style={[styles.matrixValLeft, { color: homeStats.pts >= awayStats.pts ? colors.green : colors.text }]}>{homeStats.pts} PTS</Text>
          <Text style={[styles.matrixMetricLbl, { color: colors.muted }]}>{tx(my, "POINTS (MAX 15)", "ရမှတ်")}</Text>
          <Text style={[styles.matrixValRight, { color: awayStats.pts >= homeStats.pts ? colors.green : colors.text }]}>{awayStats.pts} PTS</Text>
        </View>

        {/* Win Rate row */}
        <View style={[styles.matrixRow, { borderBottomColor: colors.border2 }]}>
          <Text style={[styles.matrixValLeft, { color: colors.text }]}>{homeStats.winPct}%</Text>
          <Text style={[styles.matrixMetricLbl, { color: colors.muted }]}>{tx(my, "WIN RATE", "နိုင်ပွဲ %")}</Text>
          <Text style={[styles.matrixValRight, { color: colors.text }]}>{awayStats.winPct}%</Text>
        </View>

        {/* Goals Scored */}
        <View style={[styles.matrixRow, { borderBottomColor: colors.border2 }]}>
          <Text style={[styles.matrixValLeft, { color: colors.text }]}>{homeStats.gf}</Text>
          <Text style={[styles.matrixMetricLbl, { color: colors.muted }]}>{tx(my, "GOALS SCORED", "သွင်းဂိုး")}</Text>
          <Text style={[styles.matrixValRight, { color: colors.text }]}>{awayStats.gf}</Text>
        </View>

        {/* Goals Conceded */}
        <View style={[styles.matrixRow, { borderBottomColor: colors.border2 }]}>
          <Text style={[styles.matrixValLeft, { color: colors.text }]}>{homeStats.ga}</Text>
          <Text style={[styles.matrixMetricLbl, { color: colors.muted }]}>{tx(my, "GOALS CONCEDED", "ပေးဂိုး")}</Text>
          <Text style={[styles.matrixValRight, { color: colors.text }]}>{awayStats.ga}</Text>
        </View>

        {/* Clean Sheets */}
        <View style={styles.matrixRow}>
          <Text style={[styles.matrixValLeft, { color: colors.text }]}>{homeStats.cs}</Text>
          <Text style={[styles.matrixMetricLbl, { color: colors.muted }]}>{tx(my, "CLEAN SHEETS", "ဂိုးမပေးရပွဲ")}</Text>
          <Text style={[styles.matrixValRight, { color: colors.text }]}>{awayStats.cs}</Text>
        </View>
      </View>
    </View>
  );
}

function NextMatches({ my, current, homeMatches, awayMatches, colors }) {
  const now = Date.now();
  const next = (rows) =>
    rows
      .filter((m) => String(m.id) !== String(current?.id) && !finished(m) && m.kickoff && new Date(m.kickoff).getTime() > now)
      .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0];
  const items = [
    [current?.home, next(homeMatches)],
    [current?.away, next(awayMatches)],
  ].filter(([, m]) => m);
  if (!items.length) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{tx(my, "Next matches", "လာမည့်ပွဲများ")}</Text>
      {items.map(([team, m], i) => (
        <View key={`${team?.id}-${m.id}`} style={[styles.nextRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border2 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.nextDate, { color: colors.muted }]}>{fmtDate(m.kickoff)}</Text>
            <Text numberOfLines={1} style={[styles.nextLeague, { color: colors.muted2 }]}>
              {m.competition}
            </Text>
          </View>
          <View style={styles.nextTeams}>
            <Logo uri={m.home?.logo} size={24} colors={colors} />
            <Text numberOfLines={1} style={[styles.nextName, { color: colors.text2 }]}>
              {m.home?.name}
            </Text>
            <Text style={[styles.nextVs, { color: colors.muted }]}>vs</Text>
            <Text numberOfLines={1} style={[styles.nextName, { color: colors.text2 }]}>
              {m.away?.name}
            </Text>
            <Logo uri={m.away?.logo} size={24} colors={colors} />
          </View>
        </View>
      ))}
    </View>
  );
}

function eventTimeLabel(event) {
  const minute = num(event?.minute ?? event?.time?.elapsed);
  const extra = num(event?.extraMinute ?? event?.time?.extra);
  if (minute === null) return "•";
  return `${minute}${extra !== null && extra > 0 ? `+${extra}` : ""}'`;
}

function eventVisual(event, colors) {
  const type = String(event?.type || "").toLowerCase();
  const detail = String(event?.detail || "").toLowerCase();
  if (type === "goal") return { icon: "football", color: colors.green, label: "GOAL" };
  if (type === "card") {
    const red = /red|second yellow/.test(detail);
    return { icon: "square", color: red ? colors.red : colors.gold, label: red ? "RED CARD" : "CARD" };
  }
  if (type === "substitution" || type === "subst") return { icon: "swap-horizontal", color: colors.blue, label: "SUB" };
  if (type === "var") return { icon: "eye-outline", color: colors.blue, label: "VAR" };
  return { icon: "ellipse-outline", color: colors.muted, label: "EVENT" };
}

function Events({ payload, my, colors }) {
  const rows = extractArray(payload)
    .map((event, index) => ({
      event,
      index,
      minute: num(event?.minute ?? event?.time?.elapsed) ?? 999,
      extra: num(event?.extraMinute ?? event?.time?.extra) ?? 0,
    }))
    .sort((a, b) => a.minute - b.minute || a.extra - b.extra || a.index - b.index);

  if (!rows.length) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.empty, { color: colors.muted }]}>
          {tx(my, "No match events recorded yet.", "ပွဲဖြစ်စဉ် မရှိသေးပါ။")}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: 4 }]}>
      {rows.slice(0, 80).map(({ event: e, index }, rowIndex) => {
        const visual = eventVisual(e, colors);
        const player = typeof e?.player === "string" ? e.player : e?.player?.name || e?.playerName || "";
        const team = typeof e?.team === "string" ? e.team : e?.team?.name || e?.teamName || "";
        const detail = String(e?.detail || "").trim();
        const fallback = player || team || visual.label;

        return (
          <View
            key={e?.id || `${eventTimeLabel(e)}-${index}`}
            style={[
              styles.eventRow,
              rowIndex > 0 && { borderTopWidth: 1, borderTopColor: colors.border2 },
            ]}
          >
            <Text style={[styles.eventMinute, { color: colors.text2 }]}>{eventTimeLabel(e)}</Text>
            <View style={[styles.eventIcon, { backgroundColor: colors.panel, borderColor: visual.color }]}>
              <Ionicons name={visual.icon} size={15} color={visual.color} />
            </View>
            <View style={styles.eventBody}>
              <View style={styles.eventTitleRow}>
                <Text numberOfLines={1} style={[styles.eventTitle, { color: colors.text }]}>
                  {fallback}
                </Text>
                <Text style={[styles.eventType, { color: visual.color }]}>{visual.label}</Text>
              </View>
              {detail && detail !== fallback ? (
                <Text style={[styles.eventSub, { color: colors.muted }]}>{detail}</Text>
              ) : null}
              {team && team !== fallback ? (
                <Text style={[styles.eventTeam, { color: colors.muted2 }]}>{team}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function statsTeams(payload) {
  const rows = extractArray(payload);
  return rows
    .map((row) => {
      const team = row?.team || {};
      const items = Array.isArray(row?.items) ? row.items : Array.isArray(row?.statistics) ? row.statistics : [];
      const map = {};
      for (const item of items) {
        const key = String(item?.label || item?.type || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        map[key] = item?.value;
      }
      return { team, map };
    })
    .filter((x) => Object.keys(x.map).length);
}

const statAliases = {
  possession: ["ballpossession", "possession"],
  xg: ["expectedgoals", "xg"],
  shots: ["totalshots"],
  on: ["shotsongoal", "shotsontarget"],
  off: ["shotsoffgoal", "shotsofftarget"],
  blocked: ["blockedshots"],
  inside: ["shotsinsidebox"],
  outside: ["shotsoutsidebox"],
  corners: ["cornerkicks", "corners"],
  fouls: ["fouls"],
  offsides: ["offsides"],
  saves: ["goalkeepersaves", "saves"],
  passes: ["totalpasses"],
  accurate: ["passesaccurate"],
  passpct: ["passes", "passaccuracy", "passespercentage"],
  yellow: ["yellowcards"],
  red: ["redcards"],
};

function statValue(map, key) {
  for (const k of statAliases[key] || [key]) {
    if (map[k] != null) return map[k];
  }
  return null;
}

function CompareBar({ left, right, colors }) {
  const a = num(left) || 0;
  const b = num(right) || 0;
  const total = Math.max(1, a + b);
  return (
    <View style={[styles.compareBar, { backgroundColor: colors.border2 }]}>
      <View style={[styles.compareLeft, { flex: a / total || 0.02, backgroundColor: colors.red }]} />
      <View style={[styles.compareRight, { flex: b / total || 0.02, backgroundColor: colors.blue }]} />
    </View>
  );
}

function StatRow({ label, left, right, bar = false, colors }) {
  return (
    <View style={styles.statWrap}>
      <View style={styles.statRow}>
        <Text style={[styles.statValue, { color: colors.text }]}>{left ?? "—"}</Text>
        <Text style={[styles.statLabel, { color: colors.text2 }]}>{label}</Text>
        <Text style={[styles.statValue, { textAlign: "right", color: colors.text }]}>{right ?? "—"}</Text>
      </View>
      {bar ? <CompareBar left={left} right={right} colors={colors} /> : null}
    </View>
  );
}

function StatsPanel({ payload, my, current, colors }) {
  const teams = statsTeams(payload);
  if (teams.length < 2) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.empty, { color: colors.muted }]}>
          {tx(my, "Detailed statistics are not available for this match.", "ဒီပွဲအတွက် အသေးစိတ်စာရင်းအင်း မရသေးပါ။")}
        </Text>
      </View>
    );
  }
  const homeId = String(current?.home?.id || "");
  const awayId = String(current?.away?.id || "");
  const home = teams.find((entry) => String(entry.team?.id || "") === homeId) || teams[0];
  const away = teams.find((entry) => String(entry.team?.id || "") === awayId) || teams.find((entry) => entry !== home) || teams[1];
  const a = home.map;
  const b = away.map;

  const groups = [
    [
      tx(my, "Top stats", "အဓိက စာရင်းအင်း"),
      [
        [tx(my, "Ball possession", "ဘောလုံးပိုင်ဆိုင်မှု"), "possession", true],
        ["Expected goals (xG)", "xg", false],
        [tx(my, "Total shots", "စုစုပေါင်းကန်ချက်"), "shots", false],
        [tx(my, "Shots on target", "ဂိုးပေါက်တည့်ကန်ချက်"), "on", false],
        [tx(my, "Corners", "ထောင့်ကန်ဘော"), "corners", false],
        [tx(my, "Fouls", "ပြစ်ဒဏ်ဘော"), "fouls", false],
        [tx(my, "Offsides", "လူကျွံ"), "offsides", false],
      ],
    ],
    [
      tx(my, "Shots", "ကန်ချက်များ"),
      [
        [tx(my, "Total shots", "စုစုပေါင်းကန်ချက်"), "shots", false],
        [tx(my, "Shots on target", "ဂိုးပေါက်တည့်"), "on", false],
        [tx(my, "Shots off target", "ဂိုးပေါက်မတည့်"), "off", false],
        [tx(my, "Blocked shots", "ပိတ်ဆို့ခံကန်ချက်"), "blocked", false],
        [tx(my, "Inside box", "ပင်နယ်တီဧရိယာအတွင်း"), "inside", false],
        [tx(my, "Outside box", "ပင်နယ်တီဧရိယာအပြင်"), "outside", false],
      ],
    ],
    [
      tx(my, "Passing & discipline", "ပေးပို့မှုနှင့် ပြစ်ဒဏ်"),
      [
        [tx(my, "Total passes", "စုစုပေါင်းပေးပို့မှု"), "passes", false],
        [tx(my, "Accurate passes", "တိကျသောပေးပို့မှု"), "accurate", false],
        [tx(my, "Pass accuracy", "ပေးပို့မှုတိကျနှုန်း"), "passpct", true],
        [tx(my, "Goalkeeper saves", "ဂိုးသမားကာကွယ်မှု"), "saves", false],
        [tx(my, "Yellow cards", "အဝါကတ်"), "yellow", false],
        [tx(my, "Red cards", "အနီကတ်"), "red", false],
      ],
    ],
  ];

  return (
    <>
      {groups.map(([title, rows]) => (
        <View key={title} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitleCenter, { color: colors.text }]}>{title}</Text>
          {rows.map(([label, key, bar]) => (
            <StatRow key={key} label={label} left={statValue(a, key)} right={statValue(b, key)} bar={bar} colors={colors} />
          ))}
        </View>
      ))}
    </>
  );
}

function formationRows(entries) {
  const players = entries.map((entry, index) => {
    const player = entry?.player || entry || {};
    const grid = String(player?.grid || entry?.grid || "");
    const match = grid.match(/^(\d+):(\d+)$/);
    return { player, index, row: match ? Number(match[1]) : null, col: match ? Number(match[2]) : null };
  });
  const gridded = players.filter((item) => item.row !== null && item.col !== null);
  if (gridded.length >= 7) {
    const groups = new Map();
    for (const item of gridded) {
      if (!groups.has(item.row)) groups.set(item.row, []);
      groups.get(item.row).push(item);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, items]) => items.sort((a, b) => a.col - b.col).map((item) => item.player));
  }
  const buckets = ["G", "D", "M", "F"]
    .map((pos) =>
      players
        .filter((item) => String(item.player?.position || item.player?.pos || "").toUpperCase().startsWith(pos))
        .map((item) => item.player),
    )
    .filter((group) => group.length);
  return buckets.length >= 2 ? buckets : [players.map((item) => item.player)];
}

function LineupPanel({ payload, players, my, colors }) {
  const lineups = extractArray(payload);
  if (!lineups.length) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.empty, { color: colors.muted }]}>
          {tx(my, "Official lineups will appear 45 minutes before kickoff.", "တရားဝင်လူစာရင်း ပွဲမစမီ ၄၅ မိနစ်တွင် ထွက်ပေါ်ပါမည်။")}
        </Text>
      </View>
    );
  }

  return (
    <>
      {lineups.slice(0, 2).map((lineup, idx) => {
        const team = lineup?.team || {};
        const xi = lineup?.startingXI || lineup?.startXI || [];
        const bench = lineup?.substitutes || [];
        const rows = formationRows(xi);
        const meta = [
          lineup?.formation,
          lineup?.coach ? `${tx(my, "Coach", "နည်းပြ")}: ${typeof lineup.coach === "string" ? lineup.coach : lineup.coach?.name || ""}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <View key={`${team.id || idx}`} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.lineupHead}>
              <Logo uri={team.logo} size={36} colors={colors} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitleNoMargin, { color: colors.text }]}>{team.name || tx(my, "Team", "အသင်း")}</Text>
                {meta ? <Text style={[styles.playerSub, { color: colors.muted }]}>{meta}</Text> : null}
              </View>
            </View>
            <View style={[styles.pitch, { backgroundColor: colors.pitch, borderColor: colors.pitchBorder }]}>
              {rows.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.pitchLine}>
                  {row.map((p, i) => (
                    <View key={`${p?.id || rowIndex}-${i}`} style={styles.pitchPlayer}>
                      <View style={[styles.playerDot, { backgroundColor: colors.red }]}>
                        <Text style={styles.playerDotNumber}>{p?.number != null ? p.number : "•"}</Text>
                      </View>
                      <Text numberOfLines={1} style={styles.pitchName}>
                        {p?.name || "Player"}
                      </Text>
                      <Text style={styles.pitchPos}>{p?.position || p?.pos || ""}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>

            {bench.length ? (
              <>
                <Text style={[styles.benchTitle, { color: colors.muted }]}>
                  {tx(my, "SUBSTITUTES", "အရန်ကစားသမားများ")}
                </Text>
                <View style={styles.benchGrid}>
                  {bench.map((entry, i) => {
                    const p = entry?.player || entry || {};
                    return (
                      <View
                        key={`${p?.id || i}`}
                        style={[
                          styles.benchPlayer,
                          { backgroundColor: colors.panel, borderColor: colors.border2 },
                        ]}
                      >
                        <View style={[styles.benchNumberPill, { backgroundColor: colors.card2 }]}>
                          <Text style={[styles.benchNumberText, { color: colors.text }]}>
                            {p?.number != null ? p.number : "•"}
                          </Text>
                        </View>
                        <View style={styles.benchText}>
                          <Text numberOfLines={1} style={[styles.benchName, { color: colors.text2 }]}>
                            {p?.name || "Player"}
                          </Text>
                          <Text style={[styles.pitchPos, { color: colors.muted }]}>{p?.position || p?.pos || ""}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

function H2HPanel({ payload, homeMatches, awayMatches, my, current, colors }) {
  const h2hRows = useMemo(() => {
    const now = Date.now();
    const currentId = String(current?.id || "");
    const all = [
      ...(payload ? normalizeTeamMatches(payload) : []),
      ...(homeMatches || []),
      ...(awayMatches || []),
    ];
    const seen = new Set();
    const list = [];
    for (const m of all) {
      if (!m?.id || seen.has(String(m.id)) || String(m.id) === currentId) continue;
      const isDirectH2H =
        (isSameTeam(m.home, current?.home) && isSameTeam(m.away, current?.away)) ||
        (isSameTeam(m.home, current?.away) && isSameTeam(m.away, current?.home));
      const playedAt = m.kickoff ? new Date(m.kickoff).getTime() : NaN;
      if (
        isDirectH2H &&
        m.homeScore != null &&
        m.awayScore != null &&
        (finished(m) || !Number.isFinite(playedAt) || playedAt <= now)
      ) {
        seen.add(String(m.id));
        list.push(m);
      }
    }
    list.sort((a, b) => new Date(b.kickoff || 0) - new Date(a.kickoff || 0));
    return list.slice(0, 10);
  }, [payload, homeMatches, awayMatches, current?.home, current?.away, current?.id]);

  const h2hOutcome = (m) => {
    const isHome = isSameTeam(m.home, current?.home);
    const own = isHome ? m.homeScore : m.awayScore;
    const opp = isHome ? m.awayScore : m.homeScore;
    return own > opp ? "W" : own < opp ? "L" : "D";
  };

  const summary = useMemo(() => {
    let homeGoals = 0;
    let awayGoals = 0;
    const acc = { W: 0, D: 0, L: 0 };
    h2hRows.forEach((m) => {
      const res = h2hOutcome(m);
      if (res) acc[res] += 1;
      const isHome = isSameTeam(m.home, current?.home);
      homeGoals += (isHome ? m.homeScore : m.awayScore) ?? 0;
      awayGoals += (isHome ? m.awayScore : m.homeScore) ?? 0;
    });
    return { ...acc, homeGoals, awayGoals };
  }, [h2hRows, current?.home]);

  return (
    <>
      {/* 1. HEAD TO HEAD HISTORY CARD */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.h2hHeader}>
          <View>
            <Text style={[styles.cardTitleNoMargin, { color: colors.text }]}>
              {tx(my, "Head to Head History", "ထိပ်တိုက်တွေ့ဆုံမှု မှတ်တမ်း")}
            </Text>
            <Text style={[styles.smallMuted, { color: colors.muted }]}>
              {h2hRows.length
                ? tx(my, `Last ${h2hRows.length} completed head-to-head meetings`, `ပြီးဆုံးခဲ့သော ထိပ်တိုက်တွေ့ဆုံမှု ${h2hRows.length} ပွဲ`)
                : tx(my, "No direct head-to-head match records available", "ထိပ်တိုက်တွေ့ဆုံမှု မှတ်တမ်း မရှိသေးပါ")}
            </Text>
          </View>
          <Text style={[styles.h2hFocus, { color: colors.red }]} numberOfLines={1}>
            {current?.home?.name || "HOME"}
          </Text>
        </View>

        {h2hRows.length ? (
          <>
            <View style={styles.h2hSummary}>
              {[
                [`${current?.home?.short || "HOME"} WINS`, summary.W, colors.green],
                ["DRAWS", summary.D, colors.muted],
                [`${current?.away?.short || "AWAY"} WINS`, summary.L, colors.red],
              ].map(([label, val, col]) => (
                <View key={label} style={[styles.h2hStat, { backgroundColor: colors.panel, borderColor: colors.border2 }]}>
                  <Text style={[styles.h2hStatValue, { color: col }]}>{val}</Text>
                  <Text numberOfLines={1} style={[styles.h2hStatLabel, { color: colors.muted }]}>{label}</Text>
                </View>
              ))}
            </View>

            {h2hRows.map((m, i) => {
              const result = h2hOutcome(m);
              const tone = result === "W" ? colors.green : result === "L" ? colors.red : colors.muted;
              return (
                <View key={m.id || i} style={[styles.h2hRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border2 }]}>
                  <View style={[styles.h2hResult, { borderColor: tone, backgroundColor: colors.panel }]}>
                    <Text style={[styles.h2hResultText, { color: tone }]}>{result || "–"}</Text>
                  </View>
                  <View style={styles.h2hMeta}>
                    <Text style={[styles.h2hDate, { color: colors.muted }]}>
                      {m.kickoff ? new Date(m.kickoff).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}
                    </Text>
                    <Text numberOfLines={1} style={[styles.h2hCompetition, { color: colors.muted2 }]}>
                      {m.competition}
                    </Text>
                  </View>
                  <View style={styles.h2hTeams}>
                    <View style={styles.h2hTeamLine}>
                      <Logo uri={m.home?.logo} size={16} colors={colors} />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.h2hTeam,
                          { color: String(m.home?.id) === homeId ? colors.text : colors.text2, fontWeight: String(m.home?.id) === homeId ? "900" : "600" },
                        ]}
                      >
                        {m.home?.name}
                      </Text>
                    </View>
                    <View style={styles.h2hTeamLine}>
                      <Logo uri={m.away?.logo} size={16} colors={colors} />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.h2hTeam,
                          { color: String(m.away?.id) === homeId ? colors.text : colors.text2, fontWeight: String(m.away?.id) === homeId ? "900" : "600" },
                        ]}
                      >
                        {m.away?.name}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.h2hScore, { color: colors.text }]}>
                    {m.homeScore ?? "-"}{"\n"}{m.awayScore ?? "-"}
                  </Text>
                </View>
              );
            })}
          </>
        ) : (
          <Text style={[styles.empty, { color: colors.muted, marginVertical: 14 }]}>
            {tx(my, "Head-to-head meeting history is unavailable.", "ထိပ်တိုက်တွေ့ဆုံမှု မှတ်တမ်း မရပါ။")}
          </Text>
        )}
      </View>

      {/* 2. FORM COMPARISON MATRIX */}
      <FormComparisonMatrix
        current={current}
        homeMatches={homeMatches}
        awayMatches={awayMatches}
        my={my}
        colors={colors}
      />

      {/* 3. HOME TEAM PREVIOUS 5 MATCHES PLAYED */}
      <TeamPreviousMatchesCard
        title={current?.home?.name ? `${current.home.name}` : tx(my, "Home Team", "အိမ်ရှင်အသင်း")}
        team={current?.home}
        matches={homeMatches}
        my={my}
        colors={colors}
      />

      {/* 4. AWAY TEAM PREVIOUS 5 MATCHES PLAYED */}
      <TeamPreviousMatchesCard
        title={current?.away?.name ? `${current.away.name}` : tx(my, "Away Team", "ဧည့်သည်အသင်း")}
        team={current?.away}
        matches={awayMatches}
        my={my}
        colors={colors}
      />
    </>
  );
}

function TablePanel({ competitionId, current, my, colors }) {
  const [state, setState] = useState({ loading: true, rows: [], error: "" });

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!competitionId) {
        setState({ loading: false, rows: [], error: "Competition table unavailable." });
        return;
      }
      try {
        const payload = await fetchCompetitionStandings(competitionId);
        if (!alive) return;
        setState({ loading: false, rows: normalizeStandings(payload), error: "" });
      } catch (e) {
        if (alive) setState({ loading: false, rows: [], error: e?.message || "Table unavailable." });
      }
    })();
    return () => {
      alive = false;
    };
  }, [competitionId]);

  if (state.loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }

  if (!state.rows.length) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.empty, { color: colors.muted }]}>
          {tx(my, "Competition table is not available for this match.", "ဒီပွဲအတွက် အမှတ်ပေးဇယား မရသေးပါ။")}
        </Text>
      </View>
    );
  }

  const focus = new Set([String(current?.home?.id || ""), String(current?.away?.id || "")]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.tableHead, { borderBottomColor: colors.border }]}>
        <Text style={[styles.tableCell, styles.tablePos, { color: colors.muted }]}>#</Text>
        <Text style={[styles.tableCell, { flex: 1, color: colors.muted, textAlign: "left" }]}>TEAM</Text>
        <Text style={[styles.tableCell, { color: colors.muted }]}>P</Text>
        <Text style={[styles.tableCell, { color: colors.muted }]}>GD</Text>
        <Text style={[styles.tablePts, { color: colors.text2 }]}>PTS</Text>
      </View>
      {state.rows.slice(0, 30).map((r, i) => (
        <View
          key={`${r.teamId || r.team}-${i}`}
          style={[
            styles.tableRow,
            { borderBottomColor: colors.border2 },
            focus.has(String(r.teamId)) && { backgroundColor: colors.redSoft },
          ]}
        >
          <Text style={[styles.tableText, styles.tablePos, { color: colors.text2 }]}>{r.rank}</Text>
          <View style={styles.tableTeam}>
            <Logo uri={r.logo} size={20} colors={colors} />
            <Text numberOfLines={1} style={[styles.tableTeamName, { color: colors.text }]}>
              {r.team}
            </Text>
          </View>
          <Text style={[styles.tableText, { color: colors.text2 }]}>{r.p}</Text>
          <Text style={[styles.tableText, { color: colors.text2 }]}>{r.gd}</Text>
          <Text style={[styles.tablePtsText, { color: colors.text }]}>{r.pts}</Text>
        </View>
      ))}
    </View>
  );
}

// Redesigned "Who Will Win?" Voting component
function PollCard({ match, my, colors }) {
  const matchId = match?.id;
  const kickoff = match?.kickoff ? new Date(match.kickoff).getTime() : NaN;
  const localLocked = isLiveMatch(match) || finished(match) || (Number.isFinite(kickoff) && Date.now() >= kickoff);
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  const load = useCallback(
    async (silent = false) => {
      if (!matchId) return;
      if (!silent) setState((p) => ({ ...p, loading: true }));
      try {
        const data = await getMatchPoll(matchId);
        setState({ loading: false, data, error: "" });
      } catch (e) {
        setState((p) => ({ ...p, loading: false, error: e?.message || "Unavailable" }));
      }
    },
    [matchId],
  );

  useEffect(() => {
    load(false);
    const timer = setInterval(() => load(true), 20000);
    return () => clearInterval(timer);
  }, [load]);

  const vote = async (pick) => {
    if (state.loading || state.data?.locked || localLocked) return;
    try {
      setState((p) => ({ ...p, loading: true, error: "" }));
      const data = await voteMatchPoll(matchId, pick);
      setState({ loading: false, data, error: "" });
    } catch (e) {
      setState((p) => ({ ...p, loading: false, error: e?.message || "Sign in to vote" }));
    }
  };

  const d = state.data || {};
  const total = d.total || 0;
  const locked = Boolean(d.locked || localLocked);

  const homePct = Math.round(d.percentages?.home || 0);
  const drawPct = Math.round(d.percentages?.draw || 0);
  const awayPct = Math.round(d.percentages?.away || 0);

  const choices = [
    { key: "home", label: match?.home?.name || "Home", role: "HOME", pct: homePct, logo: match?.home?.logo },
    { key: "draw", label: tx(my, "Draw", "သရေ"), role: "DRAW", pct: drawPct, logo: null },
    { key: "away", label: match?.away?.name || "Away", role: "AWAY", pct: awayPct, logo: match?.away?.logo },
  ];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.pollHead}>
        <View>
          <Text style={[styles.cardTitleNoMargin, { color: colors.text }]}>{tx(my, "Who will win?", "ဘယ်အသင်းနိုင်မလဲ?")}</Text>
          <Text style={[styles.smallMuted, { color: colors.muted }]}>
            {total ? `${total.toLocaleString()} ${tx(my, "votes recorded", "မဲပေးထားသည်")}` : tx(my, "Vote before kickoff", "ပွဲမစမီ မဲပေးပါ")}
          </Text>
        </View>
        {locked ? (
          <View style={[styles.pollClosed, { backgroundColor: colors.panel, borderColor: colors.border }]}>
            <Ionicons name="lock-closed" size={11} color={colors.muted} />
            <Text style={[styles.pollClosedText, { color: colors.muted }]}>{tx(my, "CLOSED", "ပိတ်ပြီး")}</Text>
          </View>
        ) : null}
      </View>

      {state.loading && !state.data ? (
        <ActivityIndicator color={colors.red} style={{ marginVertical: 12 }} />
      ) : (
        <View style={styles.pollRow}>
          {choices.map((c) => {
            const isSelected = d.myPick === c.key;
            return (
              <Pressable
                key={c.key}
                disabled={locked || state.loading}
                style={[
                  styles.pollChoice,
                  { backgroundColor: colors.panel, borderColor: isSelected ? colors.red : colors.border },
                  isSelected && { backgroundColor: colors.redSoft },
                  locked && { opacity: 0.8 },
                ]}
                onPress={() => vote(c.key)}
              >
                {c.logo ? (
                  <Logo uri={c.logo} size={28} colors={colors} />
                ) : (
                  <View style={[styles.pollDrawIcon, { backgroundColor: colors.card2 }]}>
                    <Ionicons name="git-commit-outline" size={18} color={colors.muted} />
                  </View>
                )}
                <Text style={[styles.pollPct, { color: colors.text }]}>{c.pct}%</Text>
                <Text numberOfLines={1} style={[styles.pollLabel, { color: colors.text2 }]}>
                  {c.label}
                </Text>
                {isSelected ? (
                  <View style={[styles.myPickBadge, { backgroundColor: colors.red }]}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                    <Text style={styles.myPickText}>{tx(my, "VOTED", "မဲပေးပြီး")}</Text>
                  </View>
                ) : (
                  <Text style={[styles.pollRole, { color: colors.muted }]}>{c.role}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {locked ? (
        <Text style={[styles.pollLockMessage, { color: colors.muted }]}>
          {tx(my, "Voting closed at kickoff. Community results remain visible.", "ပွဲစတင်ချိန်တွင် မဲပေးမှု ပိတ်သည်။ ရလဒ်ကို ဆက်လက်ကြည့်ရှုနိုင်သည်။")}
        </Text>
      ) : null}

      {state.error ? <Text style={[styles.chatError, { color: colors.red }]}>{state.error}</Text> : null}
    </View>
  );
}

// Live-only Chat Panel
function ChatPanel({ matchId, match, my, colors }) {
  const listRef = useRef(null);
  const currentMatchRef = useRef(String(matchId));
  currentMatchRef.current = String(matchId);
  const [auth, setAuth] = useState({ authenticated: false, user: null });
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [connectionState, setConnectionState] = useState("connecting");
  const [error, setError] = useState("");

  const live = isLiveMatch(match);
  const isMatchFinished = finished(match);
  const isPreMatch = !live && !isMatchFinished;

  const load = useCallback(
    async ({ silent = false, before = null } = {}) => {
      const requestedMatch = String(matchId);
      if (!silent) setLoading(true);
      if (before) setLoadingOlder(true);
      try {
        const page = await getMatchChat(matchId, { limit: 50, before });
        if (currentMatchRef.current !== requestedMatch) return;
        setMessages((current) => mergeChatMessages(before ? page.messages : current, before ? current : page.messages));
        if (before || !silent) {
          setNextCursor(page.nextCursor);
          setHasMore(page.hasMore);
        }
        setError("");
      } catch (e) {
        if (e?.name !== "AbortError" && currentMatchRef.current === requestedMatch) {
          setError(e?.message || "Chat unavailable.");
        }
      } finally {
        if (!silent) setLoading(false);
        if (before) setLoadingOlder(false);
      }
    },
    [matchId],
  );

  useEffect(() => {
    let active = true;
    getAuthStatus()
      .then((value) => { if (active) setAuth(value || { authenticated: false, user: null }); })
      .catch(() => { if (active) setAuth({ authenticated: false, user: null }); });
    setMessages([]);
    setNextCursor(null);
    setHasMore(false);
    load({ silent: false });
    return () => { active = false; };
  }, [load]);

  useEffect(() => {
    if (!auth.authenticated) {
      setConnectionState("unauthenticated");
      return undefined;
    }
    return connectMatchChat({
      matchId,
      onState: setConnectionState,
      onRecovery: () => load({ silent: true }),
      onMessage: (message) => {
        setMessages((current) => mergeChatMessages(current, [{ ...message, deliveryState: null }]));
        setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 80);
      },
      onError: () => setConnectionState("reconnecting"),
    });
  }, [auth.authenticated, load, matchId]);

  const deliver = async (pending) => {
    try {
      const saved = await postMatchChat(matchId, pending.body, { clientMessageId: pending.id });
      setMessages((current) => mergeChatMessages(current, [{ ...saved, deliveryState: null }]));
      setError("");
      setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 80);
    } catch (e) {
      setMessages((current) => current.map((message) => (
        message.id === pending.id ? { ...message, deliveryState: "failed", failure: e?.message || "Send failed." } : message
      )));
      setError(e?.message || "Could not post message.");
    }
  };

  const send = () => {
    const value = text.trim();
    if (!value || !live || !auth.authenticated) return;
    const pending = {
      id: createClientMessageId(),
      matchId: String(matchId),
      userId: auth.user?.id || null,
      displayName: auth.user?.username || auth.user?.displayName || "MST User",
      body: value,
      createdAt: new Date().toISOString(),
      deliveryState: "sending",
    };
    setText("");
    setError("");
    setMessages((current) => mergeChatMessages(current, [pending]));
    deliver(pending);
    setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 40);
  };

  const report = async (id) => {
    try {
      await reportMatchChat(id, "inappropriate");
      setError(tx(my, "Report sent to MST moderation.", "MST moderation သို့ report ပို့ပြီးပါပြီ။"));
    } catch (e) {
      setError(e?.message || "Could not report message.");
    }
  };

  return (
    <View style={[styles.card, styles.chatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.chatHead}>
        <View>
          <Text style={[styles.cardTitleNoMargin, { color: colors.text }]}>{tx(my, "Live Match Chat", "ပွဲတိုက်ရိုက် Chat")}</Text>
          <Text style={[styles.smallMuted, { color: colors.muted }]}>
            {messages.length} {tx(my, "messages", "မှတ်ချက်များ")} · {connectionState === "connected" ? tx(my, "connected", "ချိတ်ဆက်ထားသည်") : connectionState}
          </Text>
        </View>
        {live ? (
          <View style={[styles.liveDotWrap, { backgroundColor: colors.redSoft }]}>
            <View style={[styles.liveDot, { backgroundColor: colors.red }]} />
            <Text style={[styles.liveChatText, { color: colors.red }]}>LIVE</Text>
          </View>
        ) : (
          <View style={[styles.pollClosed, { backgroundColor: colors.panel, borderColor: colors.border }]}>
            <Ionicons name={isMatchFinished ? "checkmark-circle-outline" : "time-outline"} size={13} color={colors.muted} />
            <Text style={[styles.pollClosedText, { color: colors.muted }]}>{isMatchFinished ? "FINISHED" : "PRE-MATCH"}</Text>
          </View>
        )}
      </View>

      <FlatList
        ref={listRef}
        style={[styles.chatList, { borderColor: colors.border2 }]}
        nestedScrollEnabled
        data={loading ? [] : messages}
        keyExtractor={(message) => String(message.id)}
        ListHeaderComponent={hasMore ? (
          <Pressable disabled={loadingOlder} onPress={() => load({ silent: true, before: nextCursor })} style={{ paddingVertical: 10, alignItems: "center" }}>
            {loadingOlder ? <ActivityIndicator size="small" color={colors.red} /> : (
              <Text style={[styles.smallMuted, { color: colors.red }]}>{tx(my, "Load earlier messages", "အစောပိုင်း message များ ကြည့်ရန်")}</Text>
            )}
          </Pressable>
        ) : null}
        ListEmptyComponent={loading ? (
          <ActivityIndicator style={{ marginVertical: 25 }} color={colors.red} />
        ) : (
          <Text style={[styles.empty, { color: colors.muted }]}>
            {tx(my, "Be the first to discuss this match.", "ဒီပွဲအတွက် ပထမဆုံး ဆွေးနွေးပါ။")}
          </Text>
        )}
        renderItem={({ item: m }) => (
            <View key={m.id} style={[styles.chatMessage, { borderBottomColor: colors.border2 }]}>
              <View style={[styles.chatAvatar, { backgroundColor: colors.card2 }]}>
                <Text style={[styles.chatInitial, { color: colors.text2 }]}>
                  {String(m.displayName || "M").slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.chatNameRow}>
                  <Text style={[styles.chatName, { color: colors.text }]}>{m.displayName || "MST User"}</Text>
                  <Text style={[styles.chatTime, { color: colors.muted2 }]}>
                    {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  </Text>
                </View>
                <Text style={[styles.chatBody, { color: colors.text2 }]}>{m.body}</Text>
                {m.deliveryState === "sending" ? <Text style={[styles.chatTime, { color: colors.muted }]}>{tx(my, "Sending…", "ပို့နေသည်…")}</Text> : null}
                {m.deliveryState === "failed" ? (
                  <Pressable onPress={() => {
                    const retrying = { ...m, deliveryState: "sending", failure: null };
                    setMessages((current) => current.map((message) => message.id === m.id ? retrying : message));
                    deliver(retrying);
                  }}>
                    <Text style={[styles.chatTime, { color: colors.red }]}>{tx(my, "Failed — tap to retry", "မပို့နိုင်ပါ — ပြန်ပို့ရန် နှိပ်ပါ")}</Text>
                  </Pressable>
                ) : null}
              </View>
              {m.deliveryState ? null : <Pressable hitSlop={8} onPress={() => report(m.id)}>
                <Ionicons name="flag-outline" size={14} color={colors.muted2} />
              </Pressable>}
            </View>
        )}
      />

      {error ? <Text style={[styles.chatError, { color: colors.red }]}>{error}</Text> : null}

      {live ? (
        auth.authenticated ? (
          <View style={styles.chatComposer}>
            <TextInput
              value={text}
              onChangeText={setText}
              maxLength={250}
              placeholder={tx(my, "Write a match comment…", "ပွဲအကြောင်း comment ရေးပါ…")}
              placeholderTextColor={colors.muted2}
              style={[styles.chatInput, { backgroundColor: colors.panel, borderColor: colors.border, color: colors.text }]}
              returnKeyType="send"
              onSubmitEditing={send}
            />
            <Pressable
              disabled={!text.trim()}
              style={[styles.sendButton, { backgroundColor: colors.red }, !text.trim() && { opacity: 0.35 }]}
              onPress={send}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.signChat}>
            <Ionicons name="person-circle-outline" size={18} color={colors.muted} />
            <Text style={[styles.signChatText, { color: colors.muted }]}>
              {tx(my, "Sign in to post live match comments.", "Live Match Chat ရေးသားရန် အကောင့်ဝင်ပါ။")}
            </Text>
          </View>
        )
      ) : isPreMatch ? (
        <View style={[styles.chatStatusBanner, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <Ionicons name="time-outline" size={16} color={colors.muted} />
          <Text style={[styles.chatStatusText, { color: colors.muted }]}>
            {tx(my, "Chat opens when the match goes live.", "ပွဲစတင်ချိန်တွင် Match Chat စတင်ဖွင့်ပါမည်။")}
          </Text>
        </View>
      ) : (
        <View style={[styles.chatStatusBanner, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <Ionicons name="checkmark-done-outline" size={16} color={colors.muted} />
          <Text style={[styles.chatStatusText, { color: colors.muted }]}>
            {tx(my, "Match finished. Chat history is read-only.", "ပွဲပြီးဆုံးပါပြီ။ Chat မှတ်တမ်းကို ဖတ်ရှုနိုင်ရုံသာ ဖြစ်ပါသည်။")}
          </Text>
        </View>
      )}
    </View>
  );
}

function Predictor({ match, my, colors }) {
  const [auth, setAuth] = useState(false);
  const [saved, setSaved] = useState(null);
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const kickoff = match?.kickoff ? new Date(match.kickoff).getTime() : NaN;
  const locked = isLiveMatch(match) || finished(match) || (Number.isFinite(kickoff) && Date.now() >= kickoff);

  useEffect(() => {
    let alive = true;
    (async () => {
      const a = await getAuthStatus().catch(() => ({ authenticated: false }));
      if (!alive) return;
      setAuth(Boolean(a.authenticated));
      if (a.authenticated) {
        const rows = normalizePredictionPayload(await getAccountPredictions().catch(() => null));
        const row = rows.find((x) => String(x.matchId) === String(match?.id));
        if (row) {
          setSaved(row);
          setHome(row.homeScore != null ? String(row.homeScore) : "");
          setAway(row.awayScore != null ? String(row.awayScore) : "");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [match?.id]);

  const clean = (v) => String(v || "").replace(/[^0-9]/g, "").slice(0, 2);

  const save = async () => {
    if (!auth || locked || home === "" || away === "") return;
    setSaving(true);
    setMessage("");
    try {
      await savePredictionScore({ matchId: match.id, homeScore: Number(home), awayScore: Number(away) });
      setSaved({ ...saved, homeScore: Number(home), awayScore: Number(away) });
      setMessage(tx(my, "Saved · editable until kickoff", "သိမ်းပြီး · ပွဲမစမီ ပြင်နိုင်သည်"));
    } catch (e) {
      setMessage(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (locked && !saved) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.predictHead}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.red }]}>FREE MST PREDICTION</Text>
          <Text style={[styles.cardTitleNoMargin, { color: colors.text }]}>
            {tx(my, "Predict the exact score", "ရလဒ်အတိအကျ ခန့်မှန်းရန်")}
          </Text>
        </View>
        <Text style={[styles.points, { color: colors.red, backgroundColor: colors.redSoft }]}>3 / 1 / 0 PTS</Text>
      </View>
      <Text style={[styles.smallMuted, { color: colors.muted }]}>
        {tx(my, "Earn points on weekly & season leaderboards.", "အပတ်စဉ်နှင့် ရာသီအလိုက် Leaderboard အမှတ်များ ရယူပါ။")}
      </Text>

      {!auth ? (
        <Text style={[styles.empty, { color: colors.muted }]}>
          {tx(my, "Sign in to save your score prediction.", "ခန့်မှန်းချက်သိမ်းရန် အကောင့်ဝင်ပါ။")}
        </Text>
      ) : (
        <>
          <View style={styles.predictRow}>
            <TextInput
              style={[styles.predictInput, { backgroundColor: colors.panel, borderColor: colors.border, color: colors.text }]}
              value={home}
              onChangeText={(v) => setHome(clean(v))}
              keyboardType="number-pad"
              editable={!locked}
              placeholder="0"
              placeholderTextColor={colors.muted}
            />
            <Text style={[styles.colon, { color: colors.muted }]}>:</Text>
            <TextInput
              style={[styles.predictInput, { backgroundColor: colors.panel, borderColor: colors.border, color: colors.text }]}
              value={away}
              onChangeText={(v) => setAway(clean(v))}
              keyboardType="number-pad"
              editable={!locked}
              placeholder="0"
              placeholderTextColor={colors.muted}
            />
          </View>
          {!locked ? (
            <Pressable style={[styles.primaryButton, { backgroundColor: colors.red }]} onPress={save} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {saved ? tx(my, "UPDATE PREDICTION", "ခန့်မှန်းချက်ပြင်မည်") : tx(my, "SAVE PREDICTION", "ခန့်မှန်းချက်သိမ်းမည်")}
                </Text>
              )}
            </Pressable>
          ) : (
            <Text style={[styles.empty, { color: colors.muted }]}>
              {tx(my, "Prediction locked at kickoff.", "ပွဲစတင်ချိန်တွင် ခန့်မှန်းချက်ပိတ်သည်။")}
            </Text>
          )}
          {message ? <Text style={[styles.success, { color: colors.green }]}>{message}</Text> : null}
        </>
      )}
    </View>
  );
}

function MatchInfo({ match, my, colors }) {
  const rows = [
    [tx(my, "Kickoff", "ပွဲစချိန်"), fmtDate(match.kickoff)],
    [tx(my, "Competition", "ပြိုင်ပွဲ"), match.competition],
    [tx(my, "Round", "အဆင့်"), match.round],
    [tx(my, "Venue", "ကွင်း"), match.venue],
    [tx(my, "Referee", "ဒိုင်လူကြီး"), match.referee],
  ].filter(([, v]) => v);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{tx(my, "Match information", "ပွဲအချက်အလက်")}</Text>
      {rows.map(([l, v], i) => (
        <View key={l} style={[styles.infoRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border2 }]}>
          <Text style={[styles.infoLabel, { color: colors.muted }]}>{l}</Text>
          <Text style={[styles.infoValue, { color: colors.text2 }]}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

export default function NativeMatchScreenV5({ match, goBack, language = "my" }) {
  const { colors } = useTheme();
  const my = language !== "en";
  const [tab, setTab] = useState("FACTS");
  const [showAlerts, setShowAlerts] = useState(false);
  const [state, setState] = useState(() => ({
    loading: false,
    data: { detail: { match } },
    homeMatches: [],
    awayMatches: [],
    error: "",
  }));

  const loadedTabsRef = useRef(new Set(["FACTS"]));

  // 1. Primary match data (Score, Status, Minute, Timeline Events)
  const loadPrimary = useCallback(async () => {
    if (!match?.id) return;
    try {
      const [detailRes, eventsRes] = await Promise.all([
        fetchMatchDetail(match.id).catch(() => null),
        fetchMatchEvents(match.id).catch(() => null),
      ]);
      setState((prev) => {
        const freshDetail = detailRes?.match ? detailRes : prev.data?.detail || { match };
        return {
          ...prev,
          data: {
            ...(prev.data || {}),
            detail: freshDetail,
            events: eventsRes || prev.data?.events,
          },
        };
      });
    } catch (_) {}
  }, [match?.id, match]);

  // 2. Secondary Tab Data (Loaded ONLY on demand when user opens that tab)
  const loadSecondaryTab = useCallback(async (targetTab) => {
    if (!match?.id || loadedTabsRef.current.has(targetTab)) return;
    loadedTabsRef.current.add(targetTab);

    try {
      if (targetTab === "LINEUP") {
        const [lineups, players] = await Promise.all([
          fetchMatchLineups(match.id).catch(() => null),
          fetchMatchPlayers(match.id).catch(() => null),
        ]);
        setState((prev) => ({
          ...prev,
          data: { ...(prev.data || {}), lineups, players },
        }));
      } else if (targetTab === "STATS") {
        const statistics = await fetchMatchStatistics(match.id).catch(() => null);
        setState((prev) => ({
          ...prev,
          data: { ...(prev.data || {}), statistics },
        }));
      } else if (targetTab === "H2H") {
        const current = state.data?.detail?.match || match;
        const [h2h, h, a] = await Promise.all([
          fetchMatchH2H(match.id).catch(() => null),
          current?.home?.id ? fetchTeamMatches(current.home.id).catch(() => null) : null,
          current?.away?.id ? fetchTeamMatches(current.away.id).catch(() => null) : null,
        ]);

        const cachedHome = current?.home ? findTeamMatchesFromFastCache(current.home) : [];
        const cachedAway = current?.away ? findTeamMatchesFromFastCache(current.away) : [];

        const mergeMatches = (remoteList, localList) => {
          const seen = new Set();
          const res = [];
          for (const m of [...(remoteList || []), ...(localList || [])]) {
            if (!m?.id || seen.has(String(m.id))) continue;
            seen.add(String(m.id));
            res.push(m);
          }
          return res;
        };

        const homeMatches = mergeMatches(normalizeTeamMatches(h), cachedHome);
        const awayMatches = mergeMatches(normalizeTeamMatches(a), cachedAway);

        setState((prev) => ({
          ...prev,
          data: { ...(prev.data || {}), h2h },
          homeMatches,
          awayMatches,
        }));
      }
    } catch (_) {}
  }, [match, state.data?.detail?.match]);

  // Initial load: Primary data in background
  useEffect(() => {
    loadPrimary();
  }, [loadPrimary]);

  // When tab changes, lazy-load that tab's data
  useEffect(() => {
    loadSecondaryTab(tab);
  }, [tab, loadSecondaryTab]);

  // Live polling: Only poll primary live score/events every 30s (Never refetches static H2H)
  useEffect(() => {
    const current = state.data?.detail?.match || match;
    const isLive = isLiveMatch(current);
    const isToday = !finished(current);
    if (!isLive && !isToday) return;

    const timer = setInterval(() => {
      loadPrimary();
    }, 30000);
    return () => clearInterval(timer);
  }, [loadPrimary, match, state.data?.detail?.match]);

  // Tab switching helper with index awareness
  const currentTabIndex = TABS.indexOf(tab);
  const nextTab = (direction) => {
    const nextIdx = currentTabIndex + direction;
    if (nextIdx >= 0 && nextIdx < TABS.length) {
      setTab(TABS[nextIdx]);
    }
  };

  const current = state.data?.detail?.match || match || {};
  const live = isLiveMatch(current);
  const scoreExpected = live || finished(current) || current.homeScore != null || current.awayScore != null;
  const scoreText = scoreExpected ? `${current.homeScore ?? "—"} - ${current.awayScore ?? "—"}` : "vs";

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {/* Match Center Header */}
      <View style={[styles.header, { borderBottomColor: colors.border2 }]}>
        <Pressable style={styles.navButton} hitSlop={8} onPress={goBack}>
          <Ionicons name="chevron-back" size={27} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text numberOfLines={1} style={[styles.headerLeague, { color: colors.text }]}>
            {current.competition || "Match Center"}
          </Text>
          <Text style={[styles.headerSub, { color: colors.muted }]}>{current.round || "MATCH CENTER"}</Text>
        </View>
        <Pressable
          hitSlop={8}
          style={[styles.bellButton, showAlerts && { backgroundColor: colors.redSoft }]}
          onPress={() => setShowAlerts((v) => !v)}
        >
          <Ionicons name={showAlerts ? "notifications" : "notifications-outline"} size={22} color={showAlerts ? colors.red : colors.text} />
        </Pressable>
        <Pressable hitSlop={8} style={styles.bellButton} onPress={() => shareMatch(current, language)}>
          <Ionicons name="share-social-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Match Hero Scoreboard */}
        <View style={[styles.card, styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.heroMain}>
            <View style={styles.heroTeam}>
              <Logo uri={current.home?.logo} size={58} colors={colors} />
              <Text numberOfLines={2} style={[styles.heroName, { color: colors.text }]}>
                {current.home?.name}
              </Text>
            </View>
            <View style={styles.scoreCenter}>
              <Text style={[styles.score, { color: colors.text }]}>{scoreText}</Text>
              <View style={[styles.statusPill, { backgroundColor: live ? colors.red : colors.card2 }]}>
                <Text style={[styles.statusText, { color: live ? "#FFFFFF" : colors.text2 }]}>{statusLabel(current)}</Text>
              </View>
              <Text style={[styles.kickoff, { color: colors.muted }]}>{fmtDate(current.kickoff)}</Text>
            </View>
            <View style={styles.heroTeam}>
              <Logo uri={current.away?.logo} size={58} colors={colors} />
              <Text numberOfLines={2} style={[styles.heroName, { color: colors.text }]}>
                {current.away?.name}
              </Text>
            </View>
          </View>
        </View>

        {/* Tab Navigation Strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabBar, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          {TABS.map((x) => (
            <Pressable
              key={x}
              style={[
                styles.tab,
                tab === x && { backgroundColor: colors.redSoft, borderColor: colors.red, borderWidth: 1 },
              ]}
              onPress={() => setTab(x)}
            >
              <Text style={[styles.tabText, { color: tab === x ? colors.red : colors.muted }]}>{x}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Interactive Horizontal Swipe / Tab Switcher Cues */}
        <View style={styles.swipeHintRow}>
          {currentTabIndex > 0 ? (
            <Pressable hitSlop={10} onPress={() => nextTab(-1)}>
              <Text style={[styles.swipeHintText, { color: colors.muted2 }]}>
                ← {TABS[currentTabIndex - 1]}
              </Text>
            </Pressable>
          ) : <View style={{ width: 60 }} />}
          <Text style={[styles.swipeHintCenter, { color: colors.muted }]}>
            • {tab} •
          </Text>
          {currentTabIndex < TABS.length - 1 ? (
            <Pressable hitSlop={10} onPress={() => nextTab(1)}>
              <Text style={[styles.swipeHintText, { color: colors.muted2 }]}>
                {TABS[currentTabIndex + 1]} →
              </Text>
            </Pressable>
          ) : <View style={{ width: 60 }} />}
        </View>

        {/* Tab Subviews */}
        {tab === "FACTS" ? (
          <>
            <Predictor match={current} my={my} colors={colors} />
            <Events payload={state.data?.events} my={my} colors={colors} />
            <TeamPreviousMatchesCard
              title={current?.home?.name ? `${current.home.name} (Home Form)` : tx(my, "Home team form", "အိမ်ရှင် နောက်ဆုံးပွဲများ")}
              team={current.home}
              matches={state.homeMatches}
              my={my}
              colors={colors}
            />
            <TeamPreviousMatchesCard
              title={current?.away?.name ? `${current.away.name} (Away Form)` : tx(my, "Away team form", "ဧည့်သည် နောက်ဆုံးပွဲများ")}
              team={current.away}
              matches={state.awayMatches}
              my={my}
              colors={colors}
            />
            <NextMatches my={my} current={current} homeMatches={state.homeMatches} awayMatches={state.awayMatches} colors={colors} />
            <PollCard match={current} my={my} colors={colors} />
            <MatchInfo match={current} my={my} colors={colors} />
          </>
        ) : null}

        {tab === "CHAT" ? <ChatPanel matchId={current.id || match.id} match={current} my={my} colors={colors} /> : null}

        {tab === "LINEUP" ? (
          <LineupPanel payload={state.data?.lineups} players={state.data?.players} my={my} colors={colors} />
        ) : null}

        {tab === "STATS" ? (
          <StatsPanel payload={state.data?.statistics} my={my} current={current} colors={colors} />
        ) : null}

        {tab === "H2H" ? (
          <H2HPanel
            payload={state.data?.h2h}
            homeMatches={state.homeMatches}
            awayMatches={state.awayMatches}
            my={my}
            current={current}
            colors={colors}
          />
        ) : null}

        {tab === "TABLE" ? (
          <TablePanel competitionId={current.competitionId || current.raw?.league?.id} current={current} my={my} colors={colors} />
        ) : null}

        {tab === "ODDS" ? <MatchOddsCard match={current} my={my} /> : null}

        {state.loading ? <ActivityIndicator style={{ marginTop: 14 }} color={colors.red} /> : null}
        {state.error ? <Text style={[styles.error, { color: colors.red }]}>{state.error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    minHeight: 60,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  navButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerLeague: { fontSize: 13.5, fontWeight: "900" },
  headerSub: { fontSize: 8.5, fontWeight: "800", letterSpacing: 0.8, marginTop: 2 },
  bellButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  content: { padding: 11, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 11 },
  hero: { paddingVertical: 18 },
  heroMain: { flexDirection: "row", alignItems: "center" },
  heroTeam: { width: "31%", alignItems: "center", gap: 7 },
  heroName: { fontSize: 13, fontWeight: "800", lineHeight: 18, textAlign: "center" },
  scoreCenter: { width: "38%", alignItems: "center" },
  score: { fontSize: 32, fontWeight: "900", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  statusPill: { marginTop: 6, minHeight: 24, paddingHorizontal: 10, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statusText: { fontSize: 9.5, fontWeight: "900" },
  kickoff: { fontSize: 8.5, textAlign: "center", marginTop: 6 },
  tabBar: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    padding: 3,
    marginBottom: 6,
    gap: 4,
    alignItems: "center",
  },
  tab: { minWidth: 66, height: 38, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  tabText: { fontSize: 10, fontWeight: "900" },
  swipeHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  swipeHintText: { fontSize: 9, fontWeight: "700" },
  swipeHintCenter: { fontSize: 8.5, fontWeight: "800", letterSpacing: 1 },
  cardTitle: { fontSize: 14.5, fontWeight: "900", marginBottom: 10 },
  cardTitleNoMargin: { fontSize: 14.5, fontWeight: "900" },
  cardTitleCenter: { fontSize: 14.5, fontWeight: "900", textAlign: "center", marginBottom: 10 },
  empty: { fontSize: 10.5, textAlign: "center", lineHeight: 16, marginVertical: 8 },
  smallMuted: { fontSize: 9.2, lineHeight: 14, marginTop: 4 },
  eventRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 8 },
  eventMinute: { width: 42, fontSize: 10.5, fontWeight: "900", fontVariant: ["tabular-nums"] },
  eventIcon: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  eventBody: { flex: 1, minWidth: 0 },
  eventTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  eventTitle: { flex: 1, fontSize: 11.5, fontWeight: "800" },
  eventType: { fontSize: 7.8, fontWeight: "900", letterSpacing: 0.5 },
  eventSub: { fontSize: 9, marginTop: 2, lineHeight: 13 },
  eventTeam: { fontSize: 8.2, fontWeight: "700", marginTop: 2 },
  formRow: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  formItem: { flex: 1, alignItems: "center", gap: 6 },
  formScore: { minWidth: 44, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  formScoreText: { fontSize: 9.2, fontWeight: "900", color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  nextRow: { paddingVertical: 10, gap: 8 },
  nextDate: { fontSize: 9.2 },
  nextLeague: { fontSize: 8.7, marginTop: 2 },
  nextTeams: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  nextName: { fontSize: 10.5, fontWeight: "800", maxWidth: 96 },
  nextVs: { fontSize: 8.7 },
  statWrap: { paddingVertical: 7 },
  statRow: { flexDirection: "row", alignItems: "center" },
  statValue: { width: "25%", fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] },
  statLabel: { width: "50%", fontSize: 10.5, textAlign: "center" },
  compareBar: { height: 7, borderRadius: 4, overflow: "hidden", flexDirection: "row", marginTop: 6 },
  compareLeft: { height: "100%" },
  compareRight: { height: "100%" },
  lineupHead: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 },
  playerSub: { fontSize: 9, marginTop: 2 },
  pitch: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 14, gap: 14 },
  pitchLine: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around" },
  pitchPlayer: { flex: 1, alignItems: "center", minWidth: 0 },
  playerDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  playerDotNumber: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "900" },
  pitchName: { fontSize: 8.5, fontWeight: "800", color: "#FFFFFF", textAlign: "center", marginTop: 3, maxWidth: 84 },
  pitchPos: { fontSize: 7.8, color: "#85D4AF" },
  benchTitle: { fontSize: 8.8, fontWeight: "900", letterSpacing: 0.7, marginTop: 14, marginBottom: 6 },
  benchGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6 },
  benchPlayer: { width: "48.8%", minHeight: 44, borderRadius: 9, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 8, paddingVertical: 6 },
  benchNumberPill: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  benchNumberText: { fontSize: 8.8, fontWeight: "900" },
  benchText: { flex: 1, minWidth: 0 },
  benchName: { fontSize: 9.5, fontWeight: "800" },
  h2hHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  h2hFocus: { maxWidth: "42%", fontSize: 8.8, fontWeight: "900", textAlign: "right" },
  h2hSummary: { flexDirection: "row", gap: 7, marginTop: 12, marginBottom: 7 },
  h2hStat: { flex: 1, minHeight: 52, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  h2hStatValue: { fontSize: 19, fontWeight: "900", fontVariant: ["tabular-nums"] },
  h2hStatLabel: { fontSize: 8.5, fontWeight: "900", marginTop: 2 },
  h2hRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7 },
  h2hResult: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  h2hResultText: { fontSize: 9.5, fontWeight: "900" },
  h2hMeta: { width: 70 },
  h2hDate: { fontSize: 8.8 },
  h2hCompetition: { fontSize: 7.8, marginTop: 2 },
  h2hTeams: { flex: 1, minWidth: 0, gap: 3 },
  h2hTeamLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  h2hTeam: { fontSize: 10.5, lineHeight: 17 },
  h2hScore: { width: 26, fontSize: 11.5, fontWeight: "900", fontVariant: ["tabular-nums"], lineHeight: 17, textAlign: "center" },

  // Form Cards & Previous Matches styles
  formCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
  formCardTeamWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  formCardTeamName: { fontSize: 13, fontWeight: "900" },
  formCardSub: { fontSize: 8.8, marginTop: 2 },
  formPillsRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  formPill: { width: 22, height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  formPillText: { fontSize: 9.5, fontWeight: "900", color: "#FFFFFF" },
  formSummaryBanner: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12 },
  formSummaryItem: { flex: 1, alignItems: "center" },
  formSummaryVal: { fontSize: 12.5, fontWeight: "900", fontVariant: ["tabular-nums"] },
  formSummarySubVal: { fontSize: 9.5, fontWeight: "600", color: "#9CA3AF" },
  formSummaryLbl: { fontSize: 8, fontWeight: "800", letterSpacing: 0.5, marginTop: 2 },
  formSummaryDivider: { width: 1, height: 24 },
  prevMatchesList: { marginTop: 2 },
  prevMatchRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7 },
  prevMatchResultBadge: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  prevMatchResultText: { fontSize: 9.5, fontWeight: "900", color: "#FFFFFF" },
  prevMatchMeta: { width: 72 },
  prevMatchDate: { fontSize: 8.8, fontWeight: "700" },
  prevMatchComp: { fontSize: 7.8, marginTop: 1.5 },
  prevMatchOpponent: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  homeAwayTag: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  homeAwayTagText: { fontSize: 8, fontWeight: "900" },
  prevMatchOppName: { flex: 1, fontSize: 10.5, fontWeight: "700" },
  prevMatchScorePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  prevMatchScoreText: { fontSize: 10.5, fontWeight: "900", fontVariant: ["tabular-nums"] },

  // Matrix styles
  matrixTeamsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, marginBottom: 10 },
  matrixTeamCol: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7 },
  matrixTeamName: { flex: 1, fontSize: 11.5, fontWeight: "800" },
  matrixVs: { fontSize: 9.5, fontWeight: "900", paddingHorizontal: 8 },
  matrixRows: { marginTop: 4 },
  matrixRow: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1 },
  matrixPills: { flex: 1, flexDirection: "row", alignItems: "center", gap: 3 },
  matrixMiniPill: { width: 16, height: 16, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  matrixMiniPillText: { fontSize: 8, fontWeight: "900", color: "#FFFFFF" },
  matrixMetricLbl: { width: 130, fontSize: 8.5, fontWeight: "800", letterSpacing: 0.5, textAlign: "center" },
  matrixValLeft: { flex: 1, fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"] },
  matrixValRight: { flex: 1, fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"], textAlign: "right" },
  tableHead: { minHeight: 36, flexDirection: "row", alignItems: "center", borderBottomWidth: 1 },
  tableCell: { width: 36, fontSize: 8.5, fontWeight: "900", textAlign: "center" },
  tablePos: { width: 28 },
  tablePts: { width: 42, fontSize: 8.5, fontWeight: "900", textAlign: "right" },
  tableRow: { minHeight: 46, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, paddingHorizontal: 2 },
  tableText: { width: 36, fontSize: 10, fontWeight: "700", fontVariant: ["tabular-nums"], textAlign: "center" },
  tableTeam: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7 },
  tableTeamName: { flex: 1, fontSize: 10.8, fontWeight: "800" },
  tablePtsText: { width: 42, fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"], textAlign: "right" },
  pollHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  pollClosed: { height: 26, borderRadius: 13, paddingHorizontal: 9, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  pollClosedText: { fontSize: 8, fontWeight: "900" },
  pollRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  pollChoice: { flex: 1, minHeight: 90, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, paddingVertical: 8, gap: 4 },
  pollDrawIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pollPct: { fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums"] },
  pollLabel: { fontSize: 9.5, fontWeight: "800", textAlign: "center" },
  pollRole: { fontSize: 7, fontWeight: "900", letterSpacing: 0.5, textAlign: "center" },
  myPickBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  myPickText: { fontSize: 7.5, fontWeight: "900", color: "#FFFFFF" },
  pollLockMessage: { fontSize: 8.8, textAlign: "center", marginTop: 10, lineHeight: 14 },
  chatCard: { paddingBottom: 12 },
  chatHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  liveDotWrap: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5 },
  liveChatText: { fontSize: 8, fontWeight: "900" },
  chatList: { maxHeight: 380, minHeight: 180, borderTopWidth: 1, borderBottomWidth: 1 },
  chatMessage: { minHeight: 60, flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 9, borderBottomWidth: 1 },
  chatAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  chatInitial: { fontSize: 11, fontWeight: "900" },
  chatNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  chatName: { fontSize: 10.8, fontWeight: "900" },
  chatTime: { fontSize: 8.5 },
  chatBody: { fontSize: 11.8, lineHeight: 17, marginTop: 3 },
  chatError: { fontSize: 9, textAlign: "center", marginTop: 8 },
  chatComposer: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  chatInput: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, fontSize: 11.8 },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  signChat: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 },
  signChatText: { fontSize: 9.5 },
  chatStatusBanner: { minHeight: 42, borderRadius: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingHorizontal: 12 },
  chatStatusText: { fontSize: 9.5, fontWeight: "700" },
  predictHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  eyebrow: { fontSize: 8.5, fontWeight: "900", letterSpacing: 0.9, marginBottom: 3 },
  points: { fontSize: 9, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  predictRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12 },
  predictInput: { width: 52, height: 48, borderRadius: 10, borderWidth: 1, textAlign: "center", fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums"], padding: 0 },
  colon: { fontSize: 20, fontWeight: "900" },
  primaryButton: { height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 12 },
  primaryButtonText: { fontSize: 10.5, fontWeight: "900", color: "#FFFFFF" },
  success: { fontSize: 9.5, textAlign: "center", marginTop: 8 },
  infoRow: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  infoLabel: { fontSize: 9.5 },
  infoValue: { flex: 1, fontSize: 10.5, fontWeight: "700", textAlign: "right" },
  error: { fontSize: 9.5, textAlign: "center", marginTop: 8 },
});
