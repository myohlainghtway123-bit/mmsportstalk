import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import {
  extractArray,
  fetchCompetitionBundle,
  fetchMatchBundle,
  fetchPlayerBundle,
  fetchTeamBundle,
  flattenDisplayRows,
  isLiveMatch,
} from "../services/footballApi";
import { fetchArticle, formatContentDate } from "../services/contentApi";

function Header({ title, goBack, colors }) {
  return (
    <View style={[s.header, { borderBottomColor: colors.border2 }]}>
      <Pressable hitSlop={10} onPress={goBack}>
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </Pressable>
      <Text numberOfLines={1} style={[s.headerTitle, { color: colors.text }]}>
        {title}
      </Text>
      <View style={{ width: 28 }} />
    </View>
  );
}

function TeamLogo({ uri, size = 62, colors }) {
  return uri ? (
    <Image source={{ uri }} resizeMode="contain" style={{ width: size, height: size }} />
  ) : (
    <View style={[s.logoFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.card2 }]}>
      <Ionicons name="football-outline" size={size * 0.48} color={colors.muted} />
    </View>
  );
}

function State({ loading, error, retry, colors }) {
  if (loading)
    return (
      <View style={[s.state, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
        <ActivityIndicator color={colors.red} />
        <Text style={[s.stateText, { color: colors.muted }]}>Loading MST data…</Text>
      </View>
    );
  if (error)
    return (
      <View style={[s.state, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
        <Ionicons name="cloud-offline-outline" size={28} color={colors.muted} />
        <Text style={[s.stateTitle, { color: colors.text }]}>Data unavailable</Text>
        <Text style={[s.stateText, { color: colors.muted }]}>{error}</Text>
        {retry ? (
          <Pressable style={[s.redButton, { backgroundColor: colors.red }]} onPress={retry}>
            <Text style={s.redButtonText}>RETRY</Text>
          </Pressable>
        ) : null}
      </View>
    );
  return null;
}

function GenericData({ value, empty = "No data available", colors }) {
  const rows = flattenDisplayRows(value)
    .filter((row) => row?.value !== "[object Object]")
    .slice(0, 70);
  if (!rows.length)
    return (
      <View style={[s.state, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
        <Ionicons name="information-circle-outline" size={26} color={colors.muted} />
        <Text style={[s.stateText, { color: colors.muted }]}>{empty}</Text>
      </View>
    );
  return (
    <View style={[s.dataCard, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
      {rows.map((row, index) => (
        <View
          key={`${row.label}-${index}`}
          style={[s.dataRow, index !== rows.length - 1 && [s.rowBorder, { borderBottomColor: colors.border2 }]]}
        >
          <Text numberOfLines={2} style={[s.dataLabel, { color: colors.muted }]}>
            {row.label}
          </Text>
          <Text numberOfLines={4} style={[s.dataValue, { color: colors.text2 }]}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function formatArticleBody(content) {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (!block) return "";
        if (typeof block === "string") return block;
        if (typeof block === "object") {
          return block.text || block.content || block.value || block.paragraph || "";
        }
        return String(block);
      })
      .filter(Boolean)
      .join("\n\n");
  }
  if (typeof content === "object") {
    return content.text || content.content || content.value || content.body || "";
  }
  return String(content);
}

export function NativeArticleScreen({ article, goBack }) {
  const { colors } = useTheme();
  const [state, setState] = useState({ loading: true, error: "", article: null });

  const load = useCallback(async () => {
    const slug = article?.slug || article?.id;
    if (!slug) return setState({ loading: false, error: "Article ID unavailable.", article });
    setState((p) => ({ ...p, loading: true, error: "" }));
    try {
      const data = await fetchArticle(slug);
      setState({ loading: false, error: "", article: data?.article || data || article });
    } catch (error) {
      setState({ loading: false, error: error?.message || "", article });
    }
  }, [article]);

  useEffect(() => {
    load();
  }, [load]);

  const current = state.article || article || {};
  const formattedBody = formatArticleBody(current.content || current.body || current.excerpt || "");

  return (
    <View style={[s.screen, { backgroundColor: colors.bg }]}>
      <Header title="News" goBack={goBack} colors={colors} />
      <ScrollView contentContainerStyle={s.articleContent} showsVerticalScrollIndicator={false}>
        {current.image ? (
          <Image source={{ uri: current.image }} style={s.articleImage} resizeMode="cover" />
        ) : (
          <View style={[s.articleImage, s.articleFallback, { backgroundColor: colors.card2 }]}>
            <Text style={[s.articleFallbackLogo, { color: colors.red }]}>MST</Text>
          </View>
        )}
        <Text style={[s.category, { color: colors.red }]}>{String(current.category || "NEWS").toUpperCase()}</Text>
        <Text style={[s.articleTitle, { color: colors.text }]}>{current.title}</Text>
        <Text style={[s.meta, { color: colors.muted }]}>
          {[current.author, formatContentDate(current.publishedAt)].filter(Boolean).join(" · ")}
        </Text>
        {state.loading ? <ActivityIndicator color={colors.red} style={{ marginTop: 18 }} /> : null}
        {state.error ? <Text style={[s.articleError, { color: colors.red }]}>{state.error}</Text> : null}
        <Text style={[s.articleBody, { color: colors.text2 }]}>{formattedBody}</Text>
        {current.url ? (
          <Pressable
            style={[s.outlineButton, { borderColor: colors.border }]}
            onPress={() => Linking.openURL(current.url)}
          >
            <Ionicons name="open-outline" size={18} color={colors.red} />
            <Text style={[s.outlineText, { color: colors.red }]}>OPEN ORIGINAL ON MST WEBSITE</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 60, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: "800", textAlign: "center", paddingHorizontal: 12 },
  content: { padding: 16, paddingBottom: 42 },
  matchHero: { borderWidth: 1, borderRadius: 14, padding: 15 },
  round: { fontSize: 10.5, textAlign: "center" },
  matchTeams: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  team: { width: "34%", alignItems: "center", gap: 8 },
  teamName: { fontSize: 12.5, textAlign: "center", lineHeight: 16 },
  scoreWrap: { width: "28%", alignItems: "center" },
  bigScore: { fontSize: 29, fontWeight: "900" },
  matchStatus: { fontSize: 10.5, fontWeight: "800", marginTop: 5 },
  logoFallback: { alignItems: "center", justifyContent: "center" },
  detailTabs: { gap: 7, paddingVertical: 13 },
  detailTab: { minWidth: 92, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  detailTabOn: { borderWidth: 1 },
  detailTabText: { fontSize: 10, fontWeight: "800" },
  state: { minHeight: 120, borderWidth: 1, borderRadius: 12, padding: 18, alignItems: "center", justifyContent: "center", gap: 8 },
  stateTitle: { fontSize: 14, fontWeight: "800" },
  stateText: { fontSize: 10.5, textAlign: "center", lineHeight: 15 },
  redButton: { borderRadius: 7, paddingHorizontal: 18, paddingVertical: 9, marginTop: 4 },
  redButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  dataCard: { borderWidth: 1, borderRadius: 11, overflow: "hidden" },
  dataRow: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", gap: 14, justifyContent: "space-between" },
  rowBorder: { borderBottomWidth: 1 },
  dataLabel: { width: "43%", fontSize: 10.5, textTransform: "capitalize" },
  dataValue: { width: "52%", fontSize: 10.8, textAlign: "right" },
  eventRow: { minHeight: 56, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  eventMinute: { width: 40, fontSize: 11, fontWeight: "900" },
  eventTitle: { fontSize: 12, fontWeight: "800" },
  eventSub: { fontSize: 9.5, marginTop: 3 },
  entityHero: { borderWidth: 1, borderRadius: 14, padding: 20, alignItems: "center" },
  entityTitle: { fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 10 },
  entityType: { fontSize: 9.5, fontWeight: "900", marginTop: 5 },
  articleContent: { padding: 16, paddingBottom: 46 },
  articleImage: { width: "100%", height: 210, borderRadius: 13 },
  articleFallback: { alignItems: "center", justifyContent: "center" },
  articleFallbackLogo: { fontSize: 46, fontWeight: "900", fontStyle: "italic" },
  category: { fontSize: 10, fontWeight: "900", marginTop: 16 },
  articleTitle: { fontSize: 22, lineHeight: 30, fontWeight: "900", marginTop: 7 },
  meta: { fontSize: 10, marginTop: 8 },
  articleBody: { fontSize: 14.5, lineHeight: 24, marginTop: 16 },
  articleError: { fontSize: 10.5, marginTop: 12 },
  outlineButton: { minHeight: 46, borderWidth: 1, borderRadius: 10, marginTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  outlineText: { fontSize: 10.5, fontWeight: "900" },
});
