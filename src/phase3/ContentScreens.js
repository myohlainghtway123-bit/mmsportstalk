import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { fetchArticles, fetchSocialVideos, formatContentDate, isTransferArticle } from "../services/contentApi";

const YOUTUBE = "https://www.youtube.com/@MyanmarSportsTalk/videos";

function BrandedFallback({ big = false, video = false, colors }) {
  return (
    <View style={[big ? s.heroImage : s.thumb, s.imageFallback, { backgroundColor: colors.panel }]}>
      <Text style={[s.fallbackLogo, { color: colors.red }]}>MST</Text>
      <Ionicons
        name={video ? "play-circle-outline" : "newspaper-outline"}
        size={big ? 34 : 24}
        color={colors.muted}
      />
    </View>
  );
}

function State({ loading, error, empty, retry, colors, my }) {
  if (loading) {
    return (
      <View style={[s.state, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
        <ActivityIndicator color={colors.red} />
        <Text style={[s.stateText, { color: colors.muted }]}>
          {my ? "သတင်းများ ရယူနေပါသည်…" : "Updating content…"}
        </Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={[s.state, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
        <Ionicons name="cloud-offline-outline" size={27} color={colors.muted} />
        <Text style={[s.stateTitle, { color: colors.text }]}>
          {my ? "သတင်း ရယူ၍ မရနိုင်ပါ" : "Content unavailable"}
        </Text>
        <Text style={[s.stateText, { color: colors.muted }]}>{error}</Text>
        {retry ? (
          <Pressable style={[s.retry, { backgroundColor: colors.red }]} onPress={retry}>
            <Text style={s.retryText}>{my ? "ပြန်ကြိုးစားမည်" : "RETRY"}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <View style={[s.state, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
      <Ionicons name="newspaper-outline" size={30} color={colors.muted} />
      <Text style={[s.stateTitle, { color: colors.text }]}>
        {empty || (my ? "သတင်း မရှိသေးပါ" : "No content yet")}
      </Text>
    </View>
  );
}

function ArticleRow({ article, big = false, onOpen, colors }) {
  return (
    <Pressable
      style={[
        big ? s.heroCard : s.articleRow,
        { backgroundColor: colors.card, borderColor: colors.border2 },
      ]}
      onPress={() => onOpen?.(article)}
    >
      {article.image ? (
        <Image
          source={{ uri: article.image }}
          style={big ? s.heroImage : s.thumb}
          fadeDuration={0}
        />
      ) : (
        <BrandedFallback big={big} colors={colors} />
      )}
      <View style={big ? s.heroBody : s.articleBody}>
        <Text style={[s.category, { color: colors.red }]}>
          {String(article.category || "NEWS").toUpperCase()}
        </Text>
        <Text
          numberOfLines={3}
          style={[big ? s.heroTitle : s.articleTitle, { color: big ? colors.text : colors.text2 }]}
        >
          {article.title}
        </Text>
        {article.excerpt ? (
          <Text numberOfLines={big ? 3 : 2} style={[s.excerpt, { color: colors.muted }]}>
            {article.excerpt}
          </Text>
        ) : null}
        <Text style={[s.meta, { color: colors.muted }]}>
          {[article.author, formatContentDate(article.publishedAt)].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

function NewsList({ transfer = false, onOpenArticle, language = "my" }) {
  const { colors } = useTheme();
  const my = language === "my";
  const [state, setState] = useState({ loading: true, refreshing: false, error: null, articles: [] });

  const load = useCallback(async (refresh = false) => {
    setState((p) => ({ ...p, loading: !refresh && !p.articles.length, refreshing: refresh, error: null }));
    try {
      const r = await fetchArticles({ force: refresh });
      setState({ loading: false, refreshing: false, error: null, articles: r.articles });
    } catch (e) {
      setState((p) => ({ ...p, loading: false, refreshing: false, error: e?.message || "Unable to load news" }));
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const rows = useMemo(
    () =>
      transfer
        ? state.articles.filter(isTransferArticle)
        : state.articles.filter((x) => !isTransferArticle(x)),
    [state.articles, transfer],
  );

  return (
    <ScrollView
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl
          refreshing={state.refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.red}
          colors={[colors.red]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {!rows.length ? (
        <State
          loading={state.loading}
          error={state.error}
          retry={() => load(true)}
          empty={transfer ? (my ? "အပြောင်းအရွှေ့ သတင်းမရှိသေးပါ" : "No transfer stories yet") : (my ? "သတင်း မရှိသေးပါ" : "No news yet")}
          colors={colors}
          my={my}
        />
      ) : (
        <>
          <ArticleRow article={rows[0]} big onOpen={onOpenArticle} colors={colors} />
          <Text style={[s.section, { color: colors.text2 }]}>
            {transfer ? (my ? "နောက်ဆုံး အပြောင်းအရွှေ့ သတင်းများ" : "LATEST TRANSFERS") : (my ? "နောက်ဆုံးရ ဘောလုံးသတင်းများ" : "LATEST NEWS")}
          </Text>
          <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
            {rows.slice(1, 30).map((article, index) => (
              <View
                key={`${article.id}-${index}`}
                style={index !== Math.min(rows.length - 1, 29) - 1 ? [s.rowBorder, { borderBottomColor: colors.border2 }] : null}
              >
                <ArticleRow article={article} onOpen={onOpenArticle} colors={colors} />
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function VideoCard({ video, big = false, colors }) {
  return (
    <Pressable
      style={[
        big ? s.videoHero : s.videoRow,
        { backgroundColor: colors.card, borderColor: colors.border2 },
      ]}
      onPress={() => video.url && Linking.openURL(video.url)}
    >
      {video.thumbnail ? (
        <Image
          source={{ uri: video.thumbnail }}
          style={big ? s.videoHeroImage : s.videoThumb}
          fadeDuration={0}
        />
      ) : (
        <BrandedFallback big={big} video colors={colors} />
      )}
      <View style={[big ? s.playHero : s.playSmall, { backgroundColor: colors.red }]}>
        <Ionicons name="play" size={big ? 25 : 17} color="#FFFFFF" />
      </View>
      <View style={big ? s.videoHeroBody : s.videoBody}>
        <Text
          numberOfLines={big ? 3 : 2}
          style={[big ? s.heroTitle : s.articleTitle, { color: big ? colors.text : colors.text2 }]}
        >
          {video.title}
        </Text>
        <Text style={[s.meta, { color: colors.muted }]}>
          {[
            video.platform || "YouTube",
            formatContentDate(video.publishedAt),
            video.views ? `${video.views} views` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

function YouTubeChannelCard({ colors, my }) {
  return (
    <Pressable
      style={[s.channelCard, { backgroundColor: colors.card, borderColor: colors.border2 }]}
      onPress={() => Linking.openURL(YOUTUBE)}
    >
      <View style={[s.channelIcon, { backgroundColor: colors.redSoft }]}>
        <Ionicons name="logo-youtube" size={28} color={colors.red} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.channelTitle, { color: colors.text }]}>Myanmar Sports Talk</Text>
        <Text style={[s.channelSub, { color: colors.muted }]}>
          {my ? "တရားဝင် MST YouTube channel မှ ဗီဒီယိုများ ကြည့်ရှုရန်" : "Latest videos from official MST YouTube"}
        </Text>
      </View>
      <Ionicons name="open-outline" size={20} color={colors.muted} />
    </Pressable>
  );
}

function Videos({ language = "my" }) {
  const { colors } = useTheme();
  const my = language === "my";
  const [state, setState] = useState({ loading: true, refreshing: false, error: null, videos: [] });

  const load = useCallback(async (refresh = false) => {
    setState((p) => ({ ...p, loading: !refresh && !p.videos.length, refreshing: refresh, error: null }));
    try {
      const r = await fetchSocialVideos({ force: refresh });
      setState({ loading: false, refreshing: false, error: null, videos: r.videos || [] });
    } catch (e) {
      setState((p) => ({ ...p, loading: false, refreshing: false, error: e?.message || "Unable to load videos" }));
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  return (
    <ScrollView
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl
          refreshing={state.refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.red}
          colors={[colors.red]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <YouTubeChannelCard colors={colors} my={my} />
      <View style={s.videoSectionHead}>
        <Text style={[s.sectionInline, { color: colors.text2 }]}>
          {my ? "နောက်ဆုံး MST ဗီဒီယိုများ" : "LATEST YOUTUBE VIDEOS"}
        </Text>
        {state.loading ? <ActivityIndicator size="small" color={colors.red} /> : null}
      </View>
      {state.videos.length ? (
        <>
          <VideoCard video={state.videos[0]} big colors={colors} />
          {state.videos.length > 1 ? (
            <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border2, marginTop: 10 }]}>
              {state.videos.slice(1, 24).map((video, index) => (
                <View
                  key={`${video.id}-${index}`}
                  style={index !== Math.min(state.videos.length - 1, 23) - 1 ? [s.rowBorder, { borderBottomColor: colors.border2 }] : null}
                >
                  <VideoCard video={video} colors={colors} />
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : !state.loading ? (
        <View style={[s.compactVideoState, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
          <Text style={[s.stateText, { color: colors.muted }]}>
            {my ? "ဗီဒီယိုလိုင်း မရရှိသေးပါ။ အပေါ်ရှိ YouTube card ကို နှိပ်၍ MST ဗီဒီယိုများ ကြည့်ရှုနိုင်ပါသည်။" : "Video feed is unavailable right now. Tap the YouTube card above to watch MST immediately."}
          </Text>
        </View>
      ) : (
        <View style={[s.videoSkeleton, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
          <View style={[s.skeletonImage, { backgroundColor: colors.panel }]} />
          <View style={[s.skeletonLine, { backgroundColor: colors.panel }]} />
          <View style={[s.skeletonLine, { width: "62%", backgroundColor: colors.panel }]} />
        </View>
      )}
    </ScrollView>
  );
}

export default function ContentScreen({
  initialTab = "NEWS",
  onLiveScores,
  onOpenArticle,
  onNotifications,
  onSearch,
  language = "my",
}) {
  const { colors } = useTheme();
  const my = language === "my";
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const tabs = [
    { key: "LIVE SCORES", label: my ? "တိုက်ရိုက်ပွဲများ" : "LIVE SCORES" },
    { key: "NEWS", label: my ? "သတင်း" : "NEWS" },
    { key: "VIDEOS", label: my ? "ဗီဒီယို" : "VIDEOS" },
    { key: "TRANSFERS", label: my ? "အပြောင်းအရွှေ့" : "TRANSFERS" },
  ];

  const handleTabPress = (key) => {
    if (key === "LIVE SCORES") {
      onLiveScores?.();
      return;
    }
    setTab(key);
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.bg }]}>
      <View style={[s.mainHeader, { borderBottomColor: colors.border2 }]}>
        <View>
          <Text style={[s.logo, { color: colors.red }]}>MST</Text>
          <Text style={[s.logoSub, { color: colors.text }]}>
            {my ? "သတင်းနှင့် ဗီဒီယိုများ" : "NEWS & VIDEOS"}
          </Text>
        </View>
        <View style={s.headerIcons}>
          <Pressable hitSlop={10} style={s.headerIcon} onPress={onNotifications}>
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
          </Pressable>
          <Pressable hitSlop={10} style={s.headerIcon} onPress={onSearch}>
            <Ionicons name="search-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={[s.tabs, { borderBottomColor: colors.border2 }]}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              style={s.tab}
              onPress={() => handleTabPress(t.key)}
            >
              <Text
                style={[
                  s.tabText,
                  { color: active ? colors.red : colors.muted },
                  active && { fontWeight: "900" },
                ]}
              >
                {t.label}
              </Text>
              {active ? <View style={[s.tabLine, { backgroundColor: colors.red }]} /> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }}>
        {tab === "NEWS" ? (
          <NewsList onOpenArticle={onOpenArticle} language={language} />
        ) : tab === "TRANSFERS" ? (
          <NewsList transfer onOpenArticle={onOpenArticle} language={language} />
        ) : tab === "VIDEOS" ? (
          <Videos language={language} />
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  mainHeader: {
    minHeight: 64,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  logo: { fontSize: 28, lineHeight: 30, fontWeight: "900", fontStyle: "italic", letterSpacing: -1 },
  logoSub: { fontSize: 8.8, lineHeight: 11, fontWeight: "900", letterSpacing: 0.5, marginTop: 2 },
  headerIcons: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  tabs: { height: 46, flexDirection: "row", paddingHorizontal: 6, borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", position: "relative" },
  tabText: { fontSize: 10.5, fontWeight: "700" },
  tabLine: { position: "absolute", left: 6, right: 6, bottom: 0, height: 3, borderRadius: 2 },
  content: { padding: 14, paddingBottom: 35 },
  state: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 20,
  },
  stateTitle: { fontSize: 14, fontWeight: "800" },
  stateText: { fontSize: 11, textAlign: "center", lineHeight: 16 },
  retry: { borderRadius: 8, paddingHorizontal: 18, paddingVertical: 9, marginTop: 4 },
  retryText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  heroCard: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  heroImage: { width: "100%", height: 195 },
  heroBody: { padding: 14 },
  category: { fontSize: 9.5, fontWeight: "900", marginBottom: 5 },
  heroTitle: { fontSize: 18, fontWeight: "800", lineHeight: 24 },
  excerpt: { fontSize: 11, lineHeight: 16, marginTop: 6 },
  meta: { fontSize: 9.5, marginTop: 6 },
  section: { fontSize: 11.5, fontWeight: "800", marginTop: 18, marginBottom: 9 },
  sectionInline: { fontSize: 11.5, fontWeight: "900" },
  listCard: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  rowBorder: { borderBottomWidth: 1 },
  articleRow: { minHeight: 100, flexDirection: "row", padding: 10, gap: 11 },
  thumb: { width: 110, height: 80, borderRadius: 8 },
  articleBody: { flex: 1, justifyContent: "center" },
  articleTitle: { fontSize: 12.5, fontWeight: "700", lineHeight: 17 },
  imageFallback: { alignItems: "center", justifyContent: "center", gap: 5 },
  fallbackLogo: { fontSize: 18, fontWeight: "900", fontStyle: "italic" },
  channelCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  channelIcon: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  channelTitle: { fontSize: 13.5, fontWeight: "900" },
  channelSub: { fontSize: 10, marginTop: 2 },
  videoSectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  videoHero: { borderWidth: 1, borderRadius: 14, overflow: "hidden", position: "relative" },
  videoHeroImage: { width: "100%", height: 190 },
  videoHeroBody: { padding: 12 },
  videoRow: { borderWidth: 1, borderRadius: 10, flexDirection: "row", padding: 8, gap: 10, position: "relative" },
  videoThumb: { width: 110, height: 75, borderRadius: 8 },
  videoBody: { flex: 1, justifyContent: "center" },
  playHero: {
    position: "absolute",
    top: 75,
    left: "50%",
    marginLeft: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  playSmall: {
    position: "absolute",
    top: 28,
    left: 45,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  compactVideoState: { borderWidth: 1, borderRadius: 12, padding: 18, alignItems: "center", justifyContent: "center" },
  videoSkeleton: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  skeletonImage: { width: "100%", height: 160, borderRadius: 8 },
});