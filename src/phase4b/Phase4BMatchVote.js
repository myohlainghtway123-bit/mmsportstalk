import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getMatchPoll, voteMatchPoll } from "../services/matchEngagementApi";

const C = {
  surface: "#101417",
  raised: "#171C20",
  border: "#293036",
  text: "#FFFFFF",
  secondary: "#D4D8DB",
  muted: "#929AA0",
  red: "#F3262D",
  redSoft: "rgba(243,38,45,0.14)",
  amber: "#F4C84D",
  green: "#48C78E",
};

function isLocallyLocked(match) {
  const status = String(match?.status || "").toLowerCase();
  if (["live", "in_play", "1h", "2h", "ht", "halftime", "finished", "ft"].includes(status)) return true;
  const kickoff = new Date(match?.kickoff_at || 0).getTime();
  return Number.isFinite(kickoff) && kickoff > 0 && Date.now() >= kickoff;
}

function teamName(match, pick) {
  if (pick === "home") return match?.home_team_name || "Home";
  if (pick === "away") return match?.away_team_name || "Away";
  return "Draw";
}

export default function Phase4BMatchVote({ match }) {
  const matchId = String(match?.id || "").trim();
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  const load = useCallback(async (silent = false) => {
    if (!matchId) {
      setState({ loading: false, data: null, error: "Match Vote is unavailable because the canonical match ID is missing." });
      return;
    }
    if (!silent) setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await getMatchPoll(matchId);
      setState({ loading: false, data, error: "" });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error?.message || "Match Vote is unavailable." }));
    }
  }, [matchId]);

  useEffect(() => {
    load(false);
    const timer = setInterval(() => load(true), 20_000);
    return () => clearInterval(timer);
  }, [load]);

  const vote = async (pick) => {
    if (!matchId || state.loading || state.data?.locked || isLocallyLocked(match)) return;
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await voteMatchPoll(matchId, pick);
      setState({ loading: false, data, error: "" });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error?.message || "Sign in to vote." }));
    }
  };

  const data = state.data || {};
  const locked = Boolean(data.locked || isLocallyLocked(match));
  const total = Number(data.total || 0);
  const choices = [
    ["home", "HOME", Number(data.percentages?.home || 0)],
    ["draw", "DRAW", Number(data.percentages?.draw || 0)],
    ["away", "AWAY", Number(data.percentages?.away || 0)],
  ];

  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={s.flex}>
          <Text style={s.eyebrow}>MATCH VOTE · FAN POLL</Text>
          <Text style={s.title}>Who will win?</Text>
          <Text style={s.sub}>{total > 0 ? `${total.toLocaleString()} votes` : "Vote before kickoff"}</Text>
        </View>
        <View style={[s.badge, locked ? s.badgeLocked : s.badgeOpen]}>
          <Ionicons name={locked ? "lock-closed" : "people"} size={11} color={locked ? C.muted : C.green} />
          <Text style={[s.badgeText, { color: locked ? C.muted : C.green }]}>{locked ? "CLOSED" : "OPEN"}</Text>
        </View>
      </View>

      {state.loading && !state.data ? <ActivityIndicator color={C.red} style={s.loader} /> : (
        <View style={s.choices}>
          {choices.map(([pick, role, percentage]) => {
            const selected = data.myPick === pick;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Vote ${role}`}
                disabled={locked || state.loading}
                key={pick}
                onPress={() => vote(pick)}
                style={[s.choice, selected && s.choiceSelected, (locked || state.loading) && s.choiceDisabled]}
              >
                <Text numberOfLines={1} style={s.team}>{teamName(match, pick)}</Text>
                <Text style={s.percentage}>{Math.round(percentage)}%</Text>
                <Text style={s.role}>{selected ? "VOTED" : role}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={s.boundary}>Match Vote is HOME / DRAW / AWAY only. Exact-score prediction is not available in MST Scores.</Text>
      {state.error ? <Text style={s.error}>{state.error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 13, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  flex: { flex: 1 },
  eyebrow: { color: C.red, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  title: { color: C.text, fontSize: 14, fontWeight: "900", marginTop: 3 },
  sub: { color: C.muted, fontSize: 9, marginTop: 3 },
  badge: { minHeight: 25, borderRadius: 12, borderWidth: 1, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  badgeOpen: { borderColor: C.green },
  badgeLocked: { borderColor: C.border, backgroundColor: C.raised },
  badgeText: { fontSize: 7.5, fontWeight: "900" },
  loader: { marginVertical: 18 },
  choices: { flexDirection: "row", gap: 7, marginTop: 12 },
  choice: { flex: 1, minHeight: 78, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.raised, padding: 8, alignItems: "center", justifyContent: "center" },
  choiceSelected: { borderColor: C.red, backgroundColor: C.redSoft },
  choiceDisabled: { opacity: 0.78 },
  team: { color: C.secondary, fontSize: 8.5, fontWeight: "800", textAlign: "center" },
  percentage: { color: C.text, fontSize: 18, fontWeight: "900", marginTop: 5 },
  role: { color: C.muted, fontSize: 7.5, fontWeight: "900", marginTop: 3 },
  boundary: { color: C.muted, fontSize: 8.5, lineHeight: 13, marginTop: 10 },
  error: { color: C.amber, fontSize: 8.5, lineHeight: 13, marginTop: 7 },
});
