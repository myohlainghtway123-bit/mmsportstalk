import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import { loadPreview } from "./scoresStagingApi";
import {
  matchCenterPreviewQuality,
  matchCenterPreviewSections,
} from "./matchCenterPreview";

const C = {
  bg: "#080A0C",
  surface: "#101417",
  raised: "#171C20",
  border: "#242A2F",
  text: "#FFFFFF",
  secondary: "#D4D8DB",
  muted: "#929AA0",
  red: "#F3262D",
  redSoft: "rgba(243,38,45,0.12)",
  amber: "#F4C84D",
  green: "#48C78E",
};

function formatFullDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TeamMark({ name, uri, size = 38 }) {
  if (uri) {
    return <Image source={{ uri }} resizeMode="contain" style={{ width: size, height: size }} />;
  }
  return (
    <View style={[s.fallbackMark, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={s.fallbackMarkText}>{String(name || "M").trim().slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

function PreviewFactRow({ label, value }) {
  return (
    <View style={s.factRow}>
      <Text style={s.factLabel}>{label}</Text>
      <Text selectable style={s.factValue}>{value}</Text>
    </View>
  );
}

function SectionCard({ section }) {
  const isAvailable = section.status === "AVAILABLE";
  const isDegraded = section.status === "DEGRADED";
  const statusColor = isAvailable ? C.green : isDegraded ? C.amber : C.muted;

  return (
    <View style={s.sectionCard}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>{section.title}</Text>
        <Text style={[s.statusBadge, { color: statusColor, borderColor: statusColor }]}>
          {section.status.replace("_", " ")}
        </Text>
      </View>
      {section.facts.length ? (
        section.facts.map((fact, index) => (
          <PreviewFactRow
            key={`${section.id}-${fact.key}-${index}`}
            label={fact.label}
            value={fact.value}
          />
        ))
      ) : (
        <Text style={s.emptySectionText}>{section.message}</Text>
      )}
    </View>
  );
}

export default function Phase4BMatchPreviewScreen({ match, onBack, onOpenMatchCenter }) {
  const matchId = String(match?.id || "").trim();
  const [state, setState] = useState({ loading: Boolean(matchId), preview: null, error: "" });

  useEffect(() => {
    const handleHardwareBack = () => {
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", handleHardwareBack);
    return () => sub.remove();
  }, [onBack]);

  useEffect(() => {
    let active = true;
    if (!matchId) {
      setState({ loading: false, preview: null, error: "" });
      return;
    }
    setState({ loading: true, preview: null, error: "" });
    loadPreview(matchId)
      .then((preview) => active && setState({ loading: false, preview, error: "" }))
      .catch((err) =>
        active &&
        setState({
          loading: false,
          preview: null,
          error: err?.message || "Professional Match Preview is unavailable.",
        })
      );
    return () => {
      active = false;
    };
  }, [matchId]);

  const quality = useMemo(() => matchCenterPreviewQuality(state.preview), [state.preview]);
  const sections = useMemo(() => matchCenterPreviewSections(state.preview, { maxFacts: 20 }), [state.preview]);

  const websiteUrl =
    match?.full_analysis_url ||
    match?.fullAnalysisUrl ||
    match?.analysis_url ||
    match?.analysisUrl ||
    (process.env.EXPO_PUBLIC_MST_FULL_ANALYSIS_URL_TEMPLATE
      ? process.env.EXPO_PUBLIC_MST_FULL_ANALYSIS_URL_TEMPLATE.replaceAll("{matchId}", encodeURIComponent(matchId))
      : "");

  const handleOpenWebsite = async () => {
    if (!websiteUrl) return;
    const can = await Linking.canOpenURL(websiteUrl).catch(() => false);
    if (can) await Linking.openURL(websiteUrl).catch(() => {});
  };

  const homeName = match?.home_team_name || "Home";
  const awayName = match?.away_team_name || "Away";

  return (
    <View style={s.container}>
      <ScreenHeader
        title="Match Preview"
        subtitle={`${homeName} vs ${awayName}`}
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Match Hero Banner */}
        <View style={s.heroCard}>
          <Text style={s.heroComp}>{match?.competition_name || "Football"}</Text>
          <Text style={s.heroKickoff}>{formatFullDate(match?.kickoff_at)}</Text>
          {match?.venue_name ? <Text style={s.heroVenue}>📍 {match.venue_name}</Text> : null}

          <View style={s.heroTeamsRow}>
            <View style={s.heroTeam}>
              <TeamMark name={homeName} uri={match?.home_team_logo_url} size={50} />
              <Text numberOfLines={2} style={s.heroTeamText}>{homeName}</Text>
            </View>
            <View style={s.heroVsBlock}>
              <Text style={s.heroVsText}>VS</Text>
              <Text style={s.heroMatchState}>
                {String(match?.status || "Scheduled").toUpperCase()}
              </Text>
            </View>
            <View style={s.heroTeam}>
              <TeamMark name={awayName} uri={match?.away_team_logo_url} size={50} />
              <Text numberOfLines={2} style={s.heroTeamText}>{awayName}</Text>
            </View>
          </View>
        </View>

        {/* Loading / Error States */}
        {state.loading ? (
          <View style={s.stateCard}>
            <ActivityIndicator color={C.red} />
            <Text style={s.stateText}>Loading Professional Match Preview…</Text>
            <Text style={s.stateSubtext}>Verifying evidence-backed tactical and statistical data.</Text>
          </View>
        ) : state.error ? (
          <View style={s.stateCard}>
            <Ionicons name="shield-outline" size={28} color={C.amber} />
            <Text style={s.stateTitle}>Match Preview Unavailable</Text>
            <Text style={s.stateSubtext}>{state.error}</Text>
          </View>
        ) : null}

        {/* Verification Quality Card */}
        {quality.available ? (
          <View style={s.qualityCard}>
            <View style={s.qualityHeader}>
              <View style={s.qualityBadgeWrap}>
                <Ionicons
                  name={quality.state === "COMPLETE" ? "shield-checkmark" : "information-circle"}
                  size={16}
                  color={quality.state === "COMPLETE" ? C.green : C.amber}
                />
                <Text style={s.qualityEyebrow}>MST PROFESSIONAL PREVIEW INTELLIGENCE</Text>
              </View>
              {quality.score !== null ? (
                <Text style={[s.qualityScore, { color: quality.premiumReady ? C.green : C.amber }]}>
                  {quality.score}%
                </Text>
              ) : null}
            </View>
            <Text style={s.qualityTitle}>
              {quality.state === "COMPLETE"
                ? "Complete Verified Preview"
                : "Verified Data · Advanced Sections Incomplete"}
            </Text>
            <Text style={s.qualityMessage}>{quality.message}</Text>
            <Text style={s.qualityMeta}>
              {quality.sourceCount} verified sources · {quality.sourceFamilyCount} source families
              {quality.confidenceBand ? ` · ${quality.confidenceBand} confidence` : ""}
            </Text>
          </View>
        ) : null}

        {/* Narrative / Summary Editorial */}
        {match?.premium_preview_summary || match?.analysis_summary || state.preview?.summary ? (
          <View style={s.articleCard}>
            <View style={s.articleHeader}>
              <Ionicons name="document-text-outline" size={16} color={C.red} />
              <Text style={s.articleHeaderTitle}>EDITORIAL ANALYSIS</Text>
            </View>
            <Text style={s.articleBody}>
              {match?.premium_preview_summary || match?.analysis_summary || state.preview?.summary}
            </Text>
          </View>
        ) : null}

        {/* Structured Verified Preview Sections */}
        {!state.loading && sections.length ? (
          <View style={s.sectionsWrap}>
            <Text style={s.sectionsHeader}>VERIFIED MATCH DATA</Text>
            {sections.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
          </View>
        ) : null}

        {/* Predictions (Read-Only) */}
        {match?.mst_ai_prediction || match?.mst_admin_prediction ? (
          <View style={s.predictionWrap}>
            <Text style={s.sectionsHeader}>PREVIEW PREDICTIONS · READ ONLY</Text>
            {match?.mst_ai_prediction ? (
              <View style={s.predictionCard}>
                <Text style={s.predictionEyebrow}>MST AI PREDICTION</Text>
                <Text style={s.predictionText}>{String(match.mst_ai_prediction)}</Text>
              </View>
            ) : null}
            {match?.mst_admin_prediction ? (
              <View style={s.predictionCard}>
                <Text style={[s.predictionEyebrow, { color: C.green }]}>MST ADMIN PREDICTION</Text>
                <Text style={s.predictionText}>{String(match.mst_admin_prediction)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Actions */}
        <View style={s.actionButtonsWrap}>
          {onOpenMatchCenter ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpenMatchCenter(match)}
              style={s.matchCenterBtn}
            >
              <Ionicons name="football-outline" size={17} color={C.text} />
              <Text style={s.matchCenterBtnText}>OPEN MATCH CENTER & LIVE VOTE</Text>
            </Pressable>
          ) : null}

          {websiteUrl ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleOpenWebsite}
              style={s.websiteBtn}
            >
              <Ionicons name="globe-outline" size={17} color={C.secondary} />
              <Text style={s.websiteBtnText}>Read on Myanmar Sports Talk Website</Text>
              <Ionicons name="open-outline" size={15} color={C.muted} />
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 14, paddingBottom: 40 },
  heroCard: {
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 12,
  },
  heroComp: { color: C.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textAlign: "center" },
  heroKickoff: { color: C.text, fontSize: 13.5, fontWeight: "800", textAlign: "center", marginTop: 2 },
  heroVenue: { color: C.muted, fontSize: 12, textAlign: "center", marginTop: 2 },
  heroTeamsRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  heroTeam: { flex: 1, alignItems: "center", gap: 6 },
  heroTeamText: { color: C.text, fontSize: 14, fontWeight: "800", textAlign: "center" },
  heroVsBlock: { width: 70, alignItems: "center" },
  heroVsText: { color: C.red, fontSize: 18, fontWeight: "900" },
  heroMatchState: { color: C.muted, fontSize: 11.5, fontWeight: "800", marginTop: 3 },
  fallbackMark: {
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackMarkText: { color: C.secondary, fontSize: 13, fontWeight: "900" },
  stateCard: {
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginBottom: 12,
  },
  stateTitle: { color: C.text, fontSize: 15, fontWeight: "800" },
  stateText: { color: C.text, fontSize: 13.5, fontWeight: "700" },
  stateSubtext: { color: C.muted, fontSize: 12, textAlign: "center" },
  qualityCard: {
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    padding: 13,
    marginBottom: 12,
  },
  qualityHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qualityBadgeWrap: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  qualityEyebrow: { color: C.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
  qualityScore: { fontSize: 20, fontWeight: "900", marginLeft: 8 },
  qualityTitle: { color: C.text, fontSize: 15, fontWeight: "800", marginTop: 6 },
  qualityMessage: { color: C.secondary, fontSize: 13, lineHeight: 18, marginTop: 4 },
  qualityMeta: { color: C.muted, fontSize: 11, marginTop: 6 },
  articleCard: {
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 12,
  },
  articleHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  articleHeaderTitle: { color: C.red, fontSize: 12, fontWeight: "900", letterSpacing: 0.8 },
  articleBody: { color: C.secondary, fontSize: 14.5, lineHeight: 22, letterSpacing: 0.2 },
  sectionsWrap: { marginBottom: 12 },
  sectionsHeader: { color: C.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.8, marginBottom: 8 },
  sectionCard: {
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 8,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sectionTitle: { color: C.text, fontSize: 14, fontWeight: "800" },
  statusBadge: { fontSize: 10, fontWeight: "900", borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    paddingVertical: 6,
    gap: 10,
  },
  factLabel: { color: C.muted, fontSize: 12.5, flex: 1 },
  factValue: { color: C.text, fontSize: 13.5, fontWeight: "700" },
  emptySectionText: { color: C.muted, fontSize: 12, fontStyle: "italic", marginTop: 4 },
  predictionWrap: { marginBottom: 14 },
  predictionCard: {
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 8,
  },
  predictionEyebrow: { color: C.amber, fontSize: 11, fontWeight: "900", letterSpacing: 0.7 },
  predictionText: { color: C.secondary, fontSize: 13.5, fontWeight: "700", marginTop: 4 },
  actionButtonsWrap: { gap: 8, marginTop: 4 },
  matchCenterBtn: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: C.red,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  matchCenterBtnText: { color: C.text, fontSize: 13.5, fontWeight: "900", letterSpacing: 0.5 },
  websiteBtn: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  websiteBtnText: { color: C.secondary, fontSize: 13, fontWeight: "700" },
});
