import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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

export default function Phase4BMatchInsights({ match }) {
  const premium = first(match, ["premium_preview_summary", "premiumPreviewSummary", "premium_preview", "premiumPreview", "analysis_summary", "analysisSummary"]);
  const ai = first(match, ["mst_ai_prediction", "mstAiPrediction", "ai_prediction", "aiPrediction"]);
  const admin = first(match, ["mst_admin_prediction", "mstAdminPrediction", "admin_prediction", "adminPrediction"]);
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
      <Insight eyebrow="PREMIUM MATCH PREVIEW" title="Preview summary" value={premium} accent={C.amber} />
      <Insight eyebrow="MST AI · READ ONLY" title="MST AI Prediction" value={ai} />
      <Insight eyebrow="MST ADMIN · READ ONLY" title="MST Admin Prediction" value={admin} accent={C.green} />
      {!premium && !ai && !admin ? <Text style={s.empty}>No authorized premium/AI/admin analysis fields are present in this match response. Nothing is fabricated.</Text> : null}
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
  eyebrow: { fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  title: { color: C.text, fontSize: 11.5, fontWeight: "900", marginTop: 4 },
  body: { color: C.secondary, fontSize: 9.5, lineHeight: 15, marginTop: 6 },
  empty: { color: C.muted, fontSize: 9, lineHeight: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, borderRadius: 13, padding: 12, marginBottom: 8 },
  link: { minHeight: 60, borderRadius: 13, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 11, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8 },
  linkDisabled: { backgroundColor: C.raised, opacity: 0.84 },
  flex: { flex: 1 },
  linkTitle: { color: C.secondary, fontSize: 10.5, fontWeight: "900" },
  linkDetail: { color: C.muted, fontSize: 8.5, lineHeight: 13, marginTop: 2 },
  linkState: { fontSize: 7.5, fontWeight: "900" },
  boundary: { color: C.muted, fontSize: 8.5, lineHeight: 13 },
});
