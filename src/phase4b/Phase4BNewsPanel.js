import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fetchArticles, formatContentDate } from "../services/contentApi";

const C = {
  surface: "#101417",
  raised: "#171C20",
  border: "#293036",
  text: "#FFFFFF",
  secondary: "#D4D8DB",
  muted: "#929AA0",
  red: "#F3262D",
  amber: "#F4C84D",
};

async function openArticle(url) {
  if (!url) return;
  const supported = await Linking.canOpenURL(url).catch(() => false);
  if (supported) await Linking.openURL(url).catch(() => {});
}

function ArticleCard({ article }) {
  return (
    <Pressable
      accessibilityRole="link"
      disabled={!article?.url}
      onPress={() => openArticle(article?.url)}
      style={s.card}
    >
      {article?.image ? <Image source={{ uri: article.image }} resizeMode="cover" style={s.image} /> : null}
      <View style={s.copy}>
        <View style={s.metaRow}>
          <Text numberOfLines={1} style={s.category}>{String(article?.category || "News").toUpperCase()}</Text>
          <Text style={s.date}>{formatContentDate(article?.publishedAt)}</Text>
        </View>
        <Text style={s.title}>{article?.title || "Myanmar Sports Talk"}</Text>
        {article?.excerpt ? <Text numberOfLines={3} style={s.excerpt}>{article.excerpt}</Text> : null}
        <View style={s.readRow}>
          <Text style={s.readText}>{article?.url ? "READ ON MST" : "ARTICLE LINK UNAVAILABLE"}</Text>
          {article?.url ? <Ionicons name="arrow-forward" size={15} color={C.red} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function Phase4BNewsPanel() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true, articles: [], error: "" });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    fetchArticles({ force: attempt > 0 })
      .then(({ articles }) => {
        if (!active) return;
        setState({ loading: false, articles: Array.isArray(articles) ? articles.slice(0, 20) : [], error: "" });
      })
      .catch((error) => {
        if (!active) return;
        setState({ loading: false, articles: [], error: error?.message || "MST News is unavailable." });
      });
    return () => { active = false; };
  }, [attempt]);

  return (
    <View style={s.wrap}>
      <View style={s.headingRow}>
        <View>
          <Text style={s.eyebrow}>MYANMAR SPORTS TALK</Text>
          <Text style={s.heading}>Latest football news</Text>
        </View>
        {!state.loading ? (
          <Pressable accessibilityRole="button" onPress={retry} style={s.refreshButton}>
            <Ionicons name="refresh" size={15} color={C.secondary} />
            <Text style={s.refreshText}>REFRESH</Text>
          </Pressable>
        ) : null}
      </View>

      {state.loading ? (
        <View style={s.stateCard}>
          <ActivityIndicator color={C.red} />
          <Text style={s.stateText}>Loading MST News…</Text>
        </View>
      ) : state.error ? (
        <View style={s.stateCard}>
          <Ionicons name="cloud-offline-outline" size={26} color={C.amber} />
          <Text style={s.stateTitle}>News temporarily unavailable</Text>
          <Text style={s.stateText}>{state.error}</Text>
          <Pressable accessibilityRole="button" onPress={retry} style={s.retryButton}>
            <Text style={s.retryText}>RETRY</Text>
          </Pressable>
        </View>
      ) : !state.articles.length ? (
        <View style={s.stateCard}>
          <Ionicons name="newspaper-outline" size={26} color={C.muted} />
          <Text style={s.stateTitle}>No published articles</Text>
          <Text style={s.stateText}>The MST content API returned no articles. No fabricated stories are shown.</Text>
        </View>
      ) : state.articles.map((article) => <ArticleCard key={article.id || article.slug} article={article} />)}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingBottom: 8 },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  eyebrow: { color: C.red, fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  heading: { color: C.text, fontSize: 18, fontWeight: "900", marginTop: 3 },
  refreshButton: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 9, borderWidth: 1, borderColor: C.border, backgroundColor: C.raised, paddingHorizontal: 10 },
  refreshText: { color: C.secondary, fontSize: 8, fontWeight: "900" },
  card: { overflow: "hidden", borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, marginBottom: 12 },
  image: { width: "100%", height: 175, backgroundColor: C.raised },
  copy: { padding: 13 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  category: { flex: 1, color: C.red, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  date: { color: C.muted, fontSize: 8 },
  title: { color: C.text, fontSize: 15, lineHeight: 21, fontWeight: "900", marginTop: 7 },
  excerpt: { color: C.secondary, fontSize: 10, lineHeight: 16, marginTop: 7 },
  readRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  readText: { color: C.red, fontSize: 8, fontWeight: "900" },
  stateCard: { minHeight: 130, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 16, gap: 8 },
  stateTitle: { color: C.text, fontSize: 13, fontWeight: "900", textAlign: "center" },
  stateText: { color: C.muted, fontSize: 9.5, lineHeight: 15, textAlign: "center" },
  retryButton: { minHeight: 34, justifyContent: "center", borderRadius: 9, backgroundColor: C.red, paddingHorizontal: 14, marginTop: 4 },
  retryText: { color: C.text, fontSize: 8, fontWeight: "900" },
});
