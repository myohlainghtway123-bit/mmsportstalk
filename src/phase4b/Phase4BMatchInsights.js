import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { loadPreview } from "./scoresStagingApi";
import { matchCenterPreviewQuality, matchCenterPreviewSections } from "./matchCenterPreview";

const C = {
  surface: "#101417",
  raised: "#171C20",
  border: "#293036",
  text: "#FFFFFF",
  secondary: "#D4D8DB",
  muted: "#929AA0",
  red: "#F3262D",
  amber: "#F4C84D",
  green: "#48C78E",
};

function first(match, keys) {
  for (const key of keys) {
    const value = match?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function text(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(" · ");
  if (typeof value === "object") {
    return String(value.summary || value.text || value.label || value.pick || value.selection || value.prediction || value.value || "");
  }
  return "";
}

function configuredUrl(match, keys, template) {
  const direct = first(match, keys);
  const directText = typeof direct === "string" ? direct.trim() : "";
  if (/^https?:\/\//i.test(directText) || /^[a-z][a-z0-9+.-]*:\/\//i.test(directText)) return directText;
  const rawTemplate = String(template || "").trim();
  if (!rawTemplate) return "";
  return rawTemplate.replaceAll("{matchId}", encodeURIComponent(String(match?.id || "")));
}

async function open(url) {
  if (!url) return;
  const supported = await Linking.canOpenURL(url).catch(() => false);
  if (supported) await Linking.openURL(url).catch(() => {});
}

function Insight({ eyebrow, title, value, accent = C.red }) {
  const valueText = text(value);
  if (!valueText) return null;
  return (
    <View style={s.insight}>
      <Text style={[s.eyebrow, { color: accent }]}>{eyebrow}</Text>
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{valueText}</Text>
    </View>
  );
}

function LinkAction({ icon, title, detail, url }) {
  const enabled = Boolean(url);
  return (
    <Pressable accessibilityRole="link" disabled={!enabled} onPress={() => open(url)} style={[s.link, !enabled && s.linkDisabled]}>
      <Ionicons name={icon} size={19} color={enabled ? C.red : C.muted} />
      <View style={s.flex}>
        <Text style={s.linkTitle}>{title}</Text>
        <Text style={s.linkDetail}>{enabled ? detail : "Release URL is not configured."}</Text>
      </View>
      <Text style={[s.linkState, { color: enabled ? C.green : C.amber }]}>{enabled ? "OPEN" : "BLOCKED"}</Text>
    </Pressable>
  );
}

function statusColor(status) {
  if (status === "AVAILABLE") return C.green;
  if (status === "DEGRADED") return C.amber;
  return C.muted;
}

function formatCheckedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function PreviewSectionCard({ section }) {
  return (
    <View style={s.previewSection}>
      <View style={s.previewSectionHeader}>
        <Text style={s.previewSectionTitle}>{section.title}</Text>
        <Text style={[s.previewStatus, { color: statusColor(section.status) }]}>{section.status.replace("_", " ")}</Text>
      </View>
      {section.facts.length ? section.facts.map((fact, index) => (
        <View key={`${section.id}-${fact.key}-${index}`} style={s.factRow}>
          <Text style={s.factLabel}>{fact.label}</Text>
          <Text selectable style={s.factValue}>{fact.value}</Text>
        </View>
      )) : <Text style={s.previewMessage}>{section.message}</Text>}
      {section.hiddenFactCount > 0 ? <Text style={s.moreFacts}>+{section.hiddenFactCount} more verified records</Text> : null}
      {formatCheckedAt(section.checkedAt) ? <Text style={s.checkedAt}>Checked {formatCheckedAt(section.checkedAt)}</Text> : null}
    </View>
  );
}

function ProfessionalPreview({ matchId }) {
  const [state, setState] = useState({ loading: Boolean(matchId), preview: null, error: "" });

  useEffect(() => {
    let active = true;
    if (!matchId) {
      setState({ loading: false, preview: null, error: "" });
      return () => { active = false; };
    }
    setState({ loading: true, preview: null, error: "" });
    loadPreview(matchId)
      .then((preview) => active && setState({ loading: false, preview, error: "" }))
      .catch((error) => active && setState({
        loading: false,
        preview: null,
        error: error?.message || "Professional Match Preview is unavailable.",
      }));
    return () => { active = false; };
  }, [matchId]);

  const quality = useMemo(() => matchCenterPreviewQuality(state.preview), [state.preview]);
  const sections = useMemo(() => matchCenterPreviewSections(state.preview), [state.preview]);

  if (state.loading) {
    return (
      <View style={s.previewState}>
        <ActivityIndicator color={C.red} />
        <Text style={s.previewMessage}>Loading verified match intelligence…</Text>
      </View>
    );
  }

  if (state.error) {
    return (
      <View style={s.previewState}>
        <Ionicons name="shield-outline" size={18} color={C.amber} />
        <Text style={s.previewMessage}>{state.error} Nothing is fabricated.</Text>
      </View>
    );
  }

  if (!quality.available) return null;

  return (
    <View>
      <View style={s.qualityCard}>
        <View style={s.previewSectionHeader}>
          <View style={s.flex}>
            <Text style={s.eyebrow}>PROFESSIONAL MATCH PREVIEW</Text>
            <Text style={s.qualityTitle}>{quality.state === "COMPLETE" ? "Complete preview" : "Verified data · preview incomplete"}</Text>
          </View>
          {quality.score !== null ? <Text style={[s.qualityScore, { color: quality.premiumReady ? C.green : C.amber }]}>{quality.score}</Text> : null}
        </View>
        <Text style={s.body}>{quality.message}</Text>
        <Text style={s.qualityMeta}>{quality.sourceCount} sources · {quality.sourceFamilyCount} source families{quality.confidenceBand ? ` · ${quality.confidenceBand} confidence` : ""}</Text>
      </View>
      <Text style={s.verifiedHeading}>Verified Match Center data</Text>
      {sections.map((section) => <PreviewSectionCard key={section.id} section={section} />)}
    </View>
  );
}

export default function Phase4BMatchInsights({ match }) {
  const premium = first(match, ["premium_preview_summary", "premiumPreviewSummary", "premium_preview", "premiumPreview", "analysis_summary", "analysisSummary"]);
  const ai = first(match, ["mst_ai_prediction", "mstAiPrediction", "ai_prediction", "aiPrediction"]);
  const admin = first(match, ["mst_admin_prediction", "mstAdminPrediction", "admin_prediction", "adminPrediction"]);
  const matchId = String(match?.id || "").trim();
  const websiteUrl = configuredUrl(
    match,
    ["full_analysis_url", "fullAnalysisUrl", "analysis_url", "analysisUrl", "website_analysis_url", "websiteAnalysisUrl"],
    process.env.EXPO_PUBLIC_MST_FULL_ANALYSIS_URL_TEMPLATE,
  );
  const predictionUrl = configuredUrl(
    match,
    ["prediction_app_url", "predictionAppUrl", "prediction_deep_link", "predictionDeepLink"],
    process.env.EXPO_PUBLIC_MST_PREDICTION_APP_URL_TEMPLATE,
  );

  return (
    <View style={s.wrap}>
      <Text style={s.sectionTitle}>MST analysis</Text>
      <ProfessionalPreview matchId={matchId} />
      <Insight eyebrow="PREMIUM MATCH PREVIEW · LEGACY FIELD" title="Preview summary" value={premium} accent={C.amber} />
      <Insight eyebrow="MST AI · READ ONLY" title="MST AI Prediction" value={ai} />
      <Insight eyebrow="MST ADMIN · READ ONLY" title="MST Admin Prediction" value={admin} accent={C.green} />
      {!premium && !ai && !admin ? <Text style={s.empty}>No authorized AI/admin prediction fields are present in this match response. Nothing is fabricated.</Text> : null}
      <LinkAction icon="globe-outline" title="Full website analysis" detail="Open the full Myanmar Sports Talk analysis." url={websiteUrl} />
      <LinkAction icon="open-outline" title="Open MST Prediction app" detail="Prediction actions happen only in the separate MST Prediction app." url={predictionUrl} />
      <Text style={s.boundary}>MST Scores never creates, edits, or submits exact-score predictions.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 12 },
  sectionTitle: { color: C.text, fontSize: 15, fontWeight: "900", marginBottom: 9 },
  insight: { borderRadius: 13, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8 },
  eyebrow: { color: C.amber, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  title: { color: C.text, fontSize: 11.5, fontWeight: "900", marginTop: 4 },
  body: { color: C.secondary, fontSize: 9.5, lineHeight: 15, marginTop: 6 },
  empty: { color: C.muted, fontSize: 9, lineHeight: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, borderRadius: 13, padding: 12, marginBottom: 8 },
  previewState: { minHeight: 64, borderRadius: 13, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 9 },
  qualityCard: { borderRadius: 13, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 10 },
  qualityTitle: { color: C.text, fontSize: 11.5, fontWeight: "900", marginTop: 4 },
  qualityScore: { fontSize: 23, fontWeight: "900", marginLeft: 10 },
  qualityMeta: { color: C.muted, fontSize: 8, lineHeight: 12, marginTop: 7 },
  verifiedHeading: { color: C.secondary, fontSize: 10, fontWeight: "900", marginBottom: 7 },
  previewSection: { borderRadius: 13, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 11, marginBottom: 8 },
  previewSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  previewSectionTitle: { color: C.text, fontSize: 10.5, fontWeight: "900" },
  previewStatus: { fontSize: 7.5, fontWeight: "900" },
  factRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 7, marginTop: 7 },
  factLabel: { flex: 1, color: C.muted, fontSize: 8.5, lineHeight: 13 },
  factValue: { flex: 1, color: C.secondary, fontSize: 8.5, lineHeight: 13, fontWeight: "800", textAlign: "right" },
  previewMessage: { flex: 1, color: C.muted, fontSize: 8.5, lineHeight: 13, marginTop: 7 },
  moreFacts: { color: C.muted, fontSize: 8, fontWeight: "800", marginTop: 7 },
  checkedAt: { color: C.muted, fontSize: 7.5, marginTop: 7 },
  link: { minHeight: 60, borderRadius: 13, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 11, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8 },
  linkDisabled: { backgroundColor: C.raised, opacity: 0.84 },
  flex: { flex: 1 },
  linkTitle: { color: C.secondary, fontSize: 10.5, fontWeight: "900" },
  linkDetail: { color: C.muted, fontSize: 8.5, lineHeight: 13, marginTop: 2 },
  linkState: { fontSize: 7.5, fontWeight: "900" },
  boundary: { color: C.muted, fontSize: 8.5, lineHeight: 13 },
});
