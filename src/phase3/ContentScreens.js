import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fetchArticles, fetchSocialVideos, formatContentDate, isTransferArticle } from "../services/contentApi";

const C = { bg:"#080A0C", bg2:"#0B0E10", card:"#111416", card2:"#15191C", border:"#24292D", border2:"#1D2226", red:"#F3262D", redSoft:"rgba(243,38,45,0.14)", text:"#FFFFFF", text2:"#D0D2D4", muted:"#92979B", muted2:"#666D72" };
const TABS = ["LIVE SCORES", "NEWS", "VIDEOS", "TRANSFERS"];
const YOUTUBE = "https://www.youtube.com/@MyanmarSportsTalk/videos";

function Header({ active, onTab, onNotifications, onSearch }) {
  return <>
    <View style={s.mainHeader}>
      <View><Text style={s.logo}>MST</Text><Text style={s.logoSub}>SCORE · MYANMAR SPORTS TALK</Text></View>
      <View style={s.headerIcons}>
        <Pressable hitSlop={10} style={s.headerIcon} onPress={onNotifications}><Ionicons name="notifications-outline" size={27} color={C.text}/></Pressable>
        <Pressable hitSlop={10} style={s.headerIcon} onPress={onSearch}><Ionicons name="search-outline" size={29} color={C.text}/></Pressable>
      </View>
    </View>
    <View style={s.tabs}>{TABS.map((tab) => <Pressable key={tab} style={s.tab} onPress={() => onTab(tab)}><Text style={[s.tabText, active === tab && s.tabTextActive]}>{tab}</Text>{active === tab ? <View style={s.tabLine}/> : null}</Pressable>)}</View>
  </>;
}

function BrandedFallback({ big = false, video = false }) {
  return <View style={[big ? s.heroImage : s.thumb, s.imageFallback]}><Text style={s.fallbackLogo}>MST</Text><Ionicons name={video ? "play-circle-outline" : "newspaper-outline"} size={big ? 34 : 24} color={C.muted}/></View>;
}

function State({ loading, error, empty, retry }) {
  if (loading) return <View style={s.state}><ActivityIndicator color={C.red}/><Text style={s.stateText}>Updating content…</Text></View>;
  if (error) return <View style={s.state}><Ionicons name="cloud-offline-outline" size={27} color={C.muted}/><Text style={s.stateTitle}>Content unavailable</Text><Text style={s.stateText}>{error}</Text>{retry ? <Pressable style={s.retry} onPress={retry}><Text style={s.retryText}>RETRY</Text></Pressable> : null}</View>;
  return <View style={s.state}><Ionicons name="newspaper-outline" size={30} color={C.muted}/><Text style={s.stateTitle}>{empty || "No content yet"}</Text></View>;
}

function ArticleRow({ article, big = false, onOpen }) {
  return <Pressable style={big ? s.heroCard : s.articleRow} onPress={() => onOpen?.(article)}>
    {article.image ? <Image source={{ uri: article.image }} style={big ? s.heroImage : s.thumb} fadeDuration={0}/> : <BrandedFallback big={big}/>} 
    <View style={big ? s.heroBody : s.articleBody}>
      <Text style={s.category}>{String(article.category || "NEWS").toUpperCase()}</Text>
      <Text numberOfLines={3} style={big ? s.heroTitle : s.articleTitle}>{article.title}</Text>
      {article.excerpt ? <Text numberOfLines={big ? 3 : 2} style={s.excerpt}>{article.excerpt}</Text> : null}
      <Text style={s.meta}>{[article.author, formatContentDate(article.publishedAt)].filter(Boolean).join(" · ")}</Text>
    </View>
  </Pressable>;
}

function NewsList({ transfer = false, onOpenArticle }) {
  const [state, setState] = useState({ loading: true, refreshing: false, error: null, articles: [] });
  const load = useCallback(async (refresh = false) => {
    setState((p) => ({ ...p, loading: !refresh && !p.articles.length, refreshing: refresh, error: null }));
    try { const r = await fetchArticles({ force:refresh }); setState({ loading: false, refreshing: false, error: null, articles: r.articles }); }
    catch (e) { setState((p) => ({ ...p, loading: false, refreshing: false, error: e?.message || "Unable to load news" })); }
  }, []);
  useEffect(() => { load(false); }, [load]);
  const rows = useMemo(() => transfer ? state.articles.filter(isTransferArticle) : state.articles.filter((x) => !isTransferArticle(x)), [state.articles, transfer]);

  return <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => load(true)} tintColor={C.red} colors={[C.red]}/> } showsVerticalScrollIndicator={false}>
    {!rows.length ? <State loading={state.loading} error={state.error} retry={() => load(true)} empty={transfer ? "No transfer stories yet" : "No news yet"}/> : <>
      <ArticleRow article={rows[0]} big onOpen={onOpenArticle}/>
      <Text style={s.section}>{transfer ? "LATEST TRANSFERS" : "LATEST NEWS"}</Text>
      <View style={s.listCard}>{rows.slice(1,30).map((article,index) => <View key={`${article.id}-${index}`} style={index !== Math.min(rows.length - 1, 29) - 1 ? s.rowBorder : null}><ArticleRow article={article} onOpen={onOpenArticle}/></View>)}</View>
    </>}
  </ScrollView>;
}

function VideoCard({ video, big = false }) {
  return <Pressable style={big ? s.videoHero : s.videoRow} onPress={() => video.url && Linking.openURL(video.url)} android_ripple={{color:"rgba(255,255,255,0.04)"}}>
    {video.thumbnail ? <Image source={{ uri: video.thumbnail }} style={big ? s.videoHeroImage : s.videoThumb} fadeDuration={0}/> : <BrandedFallback big={big} video/>}
    <View style={big ? s.playHero : s.playSmall}><Ionicons name="play" size={big ? 25 : 17} color={C.text}/></View>
    <View style={big ? s.videoHeroBody : s.videoBody}><Text numberOfLines={big ? 3 : 2} style={big ? s.heroTitle:s.articleTitle}>{video.title}</Text><Text style={s.meta}>{[video.platform || "YouTube", formatContentDate(video.publishedAt), video.views ? `${video.views} views` : null].filter(Boolean).join(" · ")}</Text></View>
  </Pressable>;
}

function YouTubeChannelCard() {
  return <Pressable style={s.channelCard} onPress={() => Linking.openURL(YOUTUBE)} android_ripple={{color:"rgba(255,255,255,0.04)"}}>
    <View style={s.channelIcon}><Ionicons name="logo-youtube" size={30} color={C.text}/></View>
    <View style={{flex:1}}><Text style={s.channelTitle}>Myanmar Sports Talk</Text><Text style={s.channelSub}>Latest videos from the official MST YouTube channel</Text></View>
    <Ionicons name="open-outline" size={20} color={C.muted}/>
  </Pressable>;
}

function Videos() {
  const [state, setState] = useState({ loading: true, refreshing: false, error: null, videos: [] });
  const load = useCallback(async (refresh = false) => {
    setState((p) => ({ ...p, loading: !refresh && !p.videos.length, refreshing: refresh, error: null }));
    try { const r = await fetchSocialVideos({ force:refresh }); setState({ loading: false, refreshing: false, error: null, videos: r.videos || [] }); }
    catch (e) { setState((p) => ({ ...p, loading: false, refreshing: false, error: e?.message || "Unable to load videos" })); }
  }, []);
  useEffect(() => { load(false); }, [load]);

  return <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => load(true)} tintColor={C.red} colors={[C.red]}/> } showsVerticalScrollIndicator={false}>
    <YouTubeChannelCard/>
    <View style={s.videoSectionHead}><Text style={s.sectionInline}>LATEST YOUTUBE VIDEOS</Text>{state.loading ? <ActivityIndicator size="small" color={C.red}/> : null}</View>
    {state.videos.length ? <>
      <VideoCard video={state.videos[0]} big/>
      {state.videos.length > 1 ? <View style={[s.listCard,{marginTop:10}]}>{state.videos.slice(1,24).map((video,index) => <View key={`${video.id}-${index}`} style={index !== Math.min(state.videos.length - 1,23)-1 ? s.rowBorder : null}><VideoCard video={video}/></View>)}</View> : null}
    </> : !state.loading ? <View style={s.compactVideoState}><Text style={s.stateText}>Video feed is unavailable right now. Tap the YouTube card above to watch MST immediately.</Text></View> : <View style={s.videoSkeleton}><View style={s.skeletonImage}/><View style={s.skeletonLine}/><View style={[s.skeletonLine,{width:"62%"}]}/></View>}
  </ScrollView>;
}

export default function ContentScreen({ initialTab = "NEWS", onLiveScores, onOpenArticle, onNotifications, onSearch }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);
  const change = (next) => { if (next === "LIVE SCORES") { onLiveScores?.(); return; } setTab(next); };
  return <View style={s.screen}><Header active={tab} onTab={change} onNotifications={onNotifications} onSearch={onSearch}/><View style={{ flex: 1 }}>{tab === "NEWS" ? <NewsList onOpenArticle={onOpenArticle}/> : tab === "TRANSFERS" ? <NewsList transfer onOpenArticle={onOpenArticle}/> : tab === "VIDEOS" ? <Videos/> : null}</View></View>;
}

const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},
  mainHeader:{minHeight:88,paddingHorizontal:18,paddingTop:10,paddingBottom:8,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  logo:{color:C.red,fontSize:34,lineHeight:35,fontWeight:"900",fontStyle:"italic",letterSpacing:-2},
  logoSub:{color:C.text,fontSize:9.2,lineHeight:12,fontWeight:"900",letterSpacing:.55},
  headerIcons:{flexDirection:"row",alignItems:"center",gap:8},headerIcon:{width:44,height:44,alignItems:"center",justifyContent:"center"},
  tabs:{height:50,flexDirection:"row",paddingHorizontal:10,borderBottomWidth:1,borderBottomColor:C.border2},
  tab:{flex:1,alignItems:"center",justifyContent:"center",position:"relative"},tabText:{fontSize:10.5,fontWeight:"800",color:C.text2},tabTextActive:{color:C.red},tabLine:{position:"absolute",left:7,right:7,bottom:0,height:3,borderRadius:2,backgroundColor:C.red},
  content:{padding:16,paddingBottom:35},
  state:{minHeight:150,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,alignItems:"center",justifyContent:"center",gap:8,padding:20},stateTitle:{fontSize:14,fontWeight:"800",color:C.text},stateText:{fontSize:11,color:C.muted,textAlign:"center",lineHeight:16},
  retry:{backgroundColor:C.red,borderRadius:7,paddingHorizontal:18,paddingVertical:9,marginTop:4},retryText:{color:C.text,fontSize:10,fontWeight:"900"},
  heroCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:13,overflow:"hidden"},heroImage:{width:"100%",height:195},heroBody:{padding:14},category:{fontSize:9.5,fontWeight:"900",color:C.red,marginBottom:5},heroTitle:{fontSize:20,fontWeight:"800",lineHeight:25,color:C.text},excerpt:{fontSize:11,color:C.muted,lineHeight:16,marginTop:7},meta:{fontSize:9.5,color:C.muted,marginTop:7},
  section:{fontSize:12,fontWeight:"800",color:C.text2,marginTop:18,marginBottom:9},sectionInline:{fontSize:12,fontWeight:"900",color:C.text2},listCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,overflow:"hidden"},rowBorder:{borderBottomWidth:1,borderBottomColor:C.border2},
  articleRow:{minHeight:104,flexDirection:"row",padding:10,gap:11},thumb:{width:116,height:82,borderRadius:8},articleBody:{flex:1,justifyContent:"center"},articleTitle:{fontSize:13,fontWeight:"700",lineHeight:18,color:C.text2},
  imageFallback:{backgroundColor:C.card2,alignItems:"center",justifyContent:"center",gap:5},fallbackLogo:{color:C.red,fontSize:18,fontWeight:"900",fontStyle:"italic"},
  channelCard:{minHeight:76,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,padding:12,flexDirection:"row",alignItems:"center",gap:11,overflow:"hidden"},channelIcon:{width:48,height:48,borderRadius:14,backgroundColor:C.red,alignItems:"center",justifyContent:"center"},channelTitle:{fontSize:14,fontWeight:"900",color:C.text},channelSub:{fontSize:10,color:C.muted,lineHeight:14,marginTop:3},videoSectionHead:{minHeight:42,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  videoHero:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:13,overflow:"hidden",position:"relative"},videoHeroImage:{width:"100%",height:205},videoHeroBody:{padding:14},playHero:{position:"absolute",top:80,left:"44%",width:52,height:52,borderRadius:26,backgroundColor:"rgba(243,38,45,0.92)",alignItems:"center",justifyContent:"center"},videoRow:{minHeight:104,flexDirection:"row",padding:10,gap:11,position:"relative"},videoThumb:{width:124,height:78,borderRadius:8},videoBody:{flex:1,justifyContent:"center"},playSmall:{position:"absolute",left:54,top:37,width:30,height:30,borderRadius:15,backgroundColor:"rgba(243,38,45,0.9)",alignItems:"center",justifyContent:"center"},
  compactVideoState:{minHeight:72,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:10,padding:14,alignItems:"center",justifyContent:"center"},videoSkeleton:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,padding:12},skeletonImage:{height:150,borderRadius:9,backgroundColor:C.card2},skeletonLine:{height:10,borderRadius:5,backgroundColor:C.card2,marginTop:12,width:"88%"},
});