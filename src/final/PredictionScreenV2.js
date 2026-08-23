import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getAccountPredictions,
  getAuthStatus,
  getLeaderboard,
  normalizeLeaderboard,
  normalizePredictionPayload,
  PREDICTION_SCORING,
  savePredictionScore,
} from "../services/accountApi";
import { fetchFastFootballMatches, peekFastFootballMatches, prefetchFastFootballMatches } from "../services/fastFootballApi";
import { isLiveMatch } from "../services/footballApi";

const C = {
  bg:"#080A0C", card:"#111416", card2:"#15191C", border:"#24292D", border2:"#1D2226",
  red:"#F3262D", redSoft:"rgba(243,38,45,0.14)", text:"#FFFFFF", text2:"#D0D2D4", muted:"#92979B",
  green:"#35C76F", gold:"#F6D88A"
};
const TABS = ["Predict", "My Predictions", "Points", "Leaderboard"];

function bangkokDate(offset = 0) {
  const date = new Date(Date.now() + offset * 86400000);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Bangkok", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(date);
    const map = Object.fromEntries(parts.map((p) => [p.type,p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  } catch (_) { return date.toISOString().slice(0,10); }
}

function matchTime(match) {
  if (!match?.kickoff) return "";
  const d = new Date(match.kickoff);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
}

function Logo({ uri, size = 34 }) {
  return uri ? <Image source={{uri}} resizeMode="contain" style={{width:size,height:size}} fadeDuration={0}/> : <View style={[s.logoFallback,{width:size,height:size,borderRadius:size/2}]}><Ionicons name="football-outline" size={size*.52} color={C.muted}/></View>;
}

function scoreValue(value) {
  const digits = String(value ?? "").replace(/[^0-9]/g, "").slice(0,2);
  if (!digits) return "";
  return String(Math.min(20, Number(digits)));
}

function locked(match) {
  if (!match) return true;
  if (isLiveMatch(match)) return true;
  const kickoff = match.kickoff ? new Date(match.kickoff).getTime() : NaN;
  return Number.isFinite(kickoff) ? Date.now() >= kickoff : false;
}

function PredictionCard({ match, saved, onSave, saving, onOpen }) {
  const [home,setHome] = useState(saved?.homeScore !== null && saved?.homeScore !== undefined ? String(saved.homeScore) : "");
  const [away,setAway] = useState(saved?.awayScore !== null && saved?.awayScore !== undefined ? String(saved.awayScore) : "");
  useEffect(() => {
    if (saved?.homeScore !== null && saved?.homeScore !== undefined) setHome(String(saved.homeScore));
    if (saved?.awayScore !== null && saved?.awayScore !== undefined) setAway(String(saved.awayScore));
  }, [saved?.homeScore,saved?.awayScore]);
  const isLocked = locked(match);
  const dirty = home !== "" && away !== "" && (Number(home) !== saved?.homeScore || Number(away) !== saved?.awayScore);

  return <View style={s.predictCard}>
    <Pressable style={s.predictTop} onPress={() => onOpen?.(match)}>
      <View style={{flex:1}}><Text numberOfLines={1} style={s.competition}>{match.competition || "Football"}</Text><Text style={s.kickoff}>{matchTime(match)}</Text></View>
      <View style={[s.lockPill,isLocked && {backgroundColor:C.card2}]}><Ionicons name={isLocked ? "lock-closed" : "time-outline"} size={13} color={isLocked ? C.muted : C.green}/><Text style={[s.lockText,!isLocked && {color:C.green}]}>{isLocked ? "LOCKED" : "OPEN"}</Text></View>
    </Pressable>
    <View style={s.predictTeams}>
      <View style={s.predictTeam}><Logo uri={match.home?.logo}/><Text numberOfLines={2} style={s.predictName}>{match.home?.name}</Text></View>
      <View style={s.scoreEntry}>
        <TextInput value={home} onChangeText={(v)=>setHome(scoreValue(v))} editable={!isLocked && !saving} keyboardType="number-pad" maxLength={2} placeholder="0" placeholderTextColor={C.muted} style={s.scoreInput}/>
        <Text style={s.colon}>:</Text>
        <TextInput value={away} onChangeText={(v)=>setAway(scoreValue(v))} editable={!isLocked && !saving} keyboardType="number-pad" maxLength={2} placeholder="0" placeholderTextColor={C.muted} style={s.scoreInput}/>
      </View>
      <View style={s.predictTeam}><Logo uri={match.away?.logo}/><Text numberOfLines={2} style={s.predictName}>{match.away?.name}</Text></View>
    </View>
    {!isLocked ? <Pressable disabled={!dirty || saving} style={[s.saveButton,(!dirty || saving) && s.saveDisabled]} onPress={()=>onSave?.(match,Number(home),Number(away))}>{saving ? <ActivityIndicator size="small" color={C.text}/> : <Text style={s.saveText}>{saved ? "UPDATE PREDICTION" : "SAVE PREDICTION"}</Text>}</Pressable> : <Text style={s.lockNotice}>Predictions lock at kickoff.</Text>}
  </View>;
}

function HistoryRow({ item }) {
  const match = item.match || {};
  const finalReady = item.finalHomeScore !== null && item.finalHomeScore !== undefined && item.finalAwayScore !== null && item.finalAwayScore !== undefined;
  const homeName = match?.home?.name || match?.teams?.home?.name || item.raw?.homeTeamName || item.raw?.homeTeam || "Home";
  const awayName = match?.away?.name || match?.teams?.away?.name || item.raw?.awayTeamName || item.raw?.awayTeam || "Away";
  const homeLogo = match?.home?.logo || match?.teams?.home?.logo || item.raw?.homeTeamLogo;
  const awayLogo = match?.away?.logo || match?.teams?.away?.logo || item.raw?.awayTeamLogo;
  const resultLabel = !finalReady ? "Pending" : item.exact ? "Exact score" : item.correct ? "Correct outcome" : "Wrong outcome";
  return <View style={s.historyRow}>
    <View style={s.historyTeams}><View style={s.historyTeam}><Logo uri={homeLogo} size={28}/><Text numberOfLines={1} style={s.historyName}>{homeName}</Text></View><Text style={s.historyScore}>{item.homeScore ?? "–"} : {item.awayScore ?? "–"}</Text><View style={[s.historyTeam,{justifyContent:"flex-end"}]}><Text numberOfLines={1} style={[s.historyName,{textAlign:"right"}]}>{awayName}</Text><Logo uri={awayLogo} size={28}/></View></View>
    <View style={s.historyMeta}><View style={{flex:1}}><Text style={s.historyStatus}>{finalReady ? `Final ${item.finalHomeScore} : ${item.finalAwayScore}` : "Waiting for result"}</Text><Text style={[s.historyResult,item.exact&&{color:C.green},item.correct&&!item.exact&&{color:C.gold}]}>{resultLabel}</Text></View><View style={[s.pointsBadge,item.points===3 && {backgroundColor:C.green},item.points===1 && {backgroundColor:"#5C4B1F"}]}><Text style={s.pointsText}>{finalReady ? `${item.points} pts` : "—"}</Text></View></View>
  </View>;
}

function StatBox({ label, value, accent }) {
  return <View style={s.stat}><Text style={s.statLabel}>{label}</Text><Text style={[s.statNumber,accent?{color:accent}:null]}>{value}</Text></View>;
}

export default function PredictionScreenV2({ openMatch, openAccount }) {
  const [tab,setTab] = useState("Predict");
  const [auth,setAuth] = useState(false);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [matches,setMatches] = useState([]);
  const [history,setHistory] = useState([]);
  const [leaders,setLeaders] = useState([]);
  const [saving,setSaving] = useState("");
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");

  const load = useCallback(async (refresh=false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const dates = [bangkokDate(0),bangkokDate(1),bangkokDate(2)];
      prefetchFastFootballMatches(dates);
      const [authStatus,leaderPayload] = await Promise.all([
        getAuthStatus().catch(()=>({authenticated:false})),
        getLeaderboard().catch(()=>null),
      ]);
      setAuth(Boolean(authStatus.authenticated));
      setLeaders(normalizeLeaderboard(leaderPayload));

      const dateResults = await Promise.all(dates.map(async (date) => {
        const cached = peekFastFootballMatches(date);
        if (cached?.matches?.length && !refresh) return cached.matches;
        return (await fetchFastFootballMatches({date,force:refresh})).matches || [];
      }));
      const upcoming = dateResults.flat().filter((m)=>!locked(m)).sort((a,b)=>new Date(a.kickoff||0)-new Date(b.kickoff||0)).slice(0,40);
      setMatches(upcoming);

      if (authStatus.authenticated) {
        const predPayload = await getAccountPredictions().catch(()=>null);
        setHistory(normalizePredictionPayload(predPayload));
      } else {
        setHistory([]);
      }
    } catch (e) { setError(e?.message || "Could not update predictions."); }
    finally { setLoading(false); setRefreshing(false); }
  },[]);

  useEffect(()=>{load(false);},[load]);
  const savedByMatch = useMemo(()=>Object.fromEntries(history.filter((x)=>x.matchId!==undefined&&x.matchId!==null).map((x)=>[String(x.matchId),x])),[history]);
  const totals = useMemo(()=>{
    const settledRows = history.filter((x)=>x.finalHomeScore!==null&&x.finalHomeScore!==undefined&&x.finalAwayScore!==null&&x.finalAwayScore!==undefined);
    const exact = settledRows.filter((x)=>x.exact || x.points===3).length;
    const correct = settledRows.filter((x)=>!x.exact && x.correct).length;
    const settled = settledRows.length;
    const hits = exact + correct;
    return {
      points: history.reduce((sum,x)=>sum+(Number(x.points)||0),0),
      exact,
      correct,
      settled,
      pending: Math.max(0, history.length - settled),
      accuracy: settled ? Math.round((hits / settled) * 100) : 0,
      total: history.length,
    };
  },[history]);
  const myRank = useMemo(()=>leaders.find((x)=>x.raw?.isCurrentUser || x.raw?.you || x.raw?.currentUser)?.rank ?? null,[leaders]);

  const save = async (match,homeScore,awayScore) => {
    if (!auth) { openAccount?.(); return; }
    setSaving(String(match.id)); setError(""); setMessage("");
    try {
      await savePredictionScore({matchId:match.id,homeScore,awayScore});
      setMessage("Prediction saved. You can update it until kickoff.");
      const rows = normalizePredictionPayload(await getAccountPredictions());
      setHistory(rows);
    } catch (e) { setError(e?.message || "Could not save prediction."); }
    finally { setSaving(""); }
  };

  return <View style={s.screen}>
    <View style={s.header}><View><Text style={s.title}>Predictions</Text><Text style={s.subtitle}>Predict scores · earn points · climb the leaderboard</Text></View><Ionicons name="trophy-outline" size={27} color={C.text}/></View>
    <View style={s.tabs}>{TABS.map((item)=><Pressable key={item} style={[s.tab,tab===item&&s.tabOn]} onPress={()=>setTab(item)}><Text numberOfLines={2} style={[s.tabText,tab===item&&s.tabTextOn]}>{item}</Text></Pressable>)}</View>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)} colors={[C.red]} tintColor={C.red}/>} showsVerticalScrollIndicator={false}>
      {!auth && tab !== "Leaderboard" ? <Pressable style={s.signInCard} onPress={openAccount}><Ionicons name="person-circle-outline" size={27} color={C.muted}/><View style={{flex:1}}><Text style={s.signInTitle}>Sign in to save predictions</Text><Text style={s.signInText}>The app uses the same MST account and prediction history as the website.</Text></View><Ionicons name="chevron-forward" size={19} color={C.muted}/></Pressable> : null}
      {(tab === "Predict" || tab === "Points") ? <View style={s.scoring}><Text style={s.scoringLabel}>SCORING</Text><Text style={s.scoringText}>Exact score: {PREDICTION_SCORING.exact} points · Correct win/draw/loss: {PREDICTION_SCORING.correctOutcome} point · Wrong outcome: {PREDICTION_SCORING.wrong} points.</Text></View> : null}
      {message ? <Text style={s.success}>{message}</Text> : null}{error ? <Text style={s.error}>{error}</Text> : null}

      {tab === "Predict" ? <>
        <View style={s.sectionHead}><Text style={s.sectionTitle}>UPCOMING</Text><Text style={s.sectionCount}>{matches.length} matches</Text></View>
        {loading && !matches.length ? <View style={s.compactLoading}><ActivityIndicator color={C.red}/><Text style={s.loadingText}>Updating fixtures…</Text></View> : null}
        {matches.map((match)=><PredictionCard key={match.id} match={match} saved={savedByMatch[String(match.id)]} saving={saving===String(match.id)} onSave={save} onOpen={openMatch}/>) }
        {!loading && !matches.length ? <Text style={s.emptyText}>No open predictions right now.</Text> : null}
      </> : null}

      {tab === "My Predictions" ? <>
        <View style={s.statsGrid}><StatBox label="POINTS" value={totals.points}/><StatBox label="EXACT" value={totals.exact} accent={C.green}/><StatBox label="CORRECT" value={totals.correct} accent={C.gold}/></View>
        <View style={s.statsGrid}><StatBox label="SETTLED" value={totals.settled}/><StatBox label="PENDING" value={totals.pending}/><StatBox label="ACCURACY" value={`${totals.accuracy}%`}/></View>
        <Text style={s.sectionTitle}>PREDICTION HISTORY</Text>
        <View style={s.historyCard}>{history.length ? history.map((item,index)=><View key={`${item.id}-${index}`} style={index!==history.length-1&&s.divider}><HistoryRow item={item}/></View>) : <Text style={s.emptyText}>{auth ? "No predictions yet." : "Sign in to see your prediction history."}</Text>}</View>
      </> : null}

      {tab === "Points" ? <>
        <View style={s.statsGrid}><StatBox label="POINTS" value={auth ? totals.points : "—"}/><StatBox label="RANK" value={auth && myRank ? `#${myRank}` : "—"}/><StatBox label="ACCURACY" value={auth ? `${totals.accuracy}%` : "—"}/></View>
        <View style={s.statsGrid}><StatBox label="EXACT SCORES" value={auth ? totals.exact : "—"} accent={C.green}/><StatBox label="CORRECT" value={auth ? totals.correct : "—"} accent={C.gold}/><StatBox label="SETTLED" value={auth ? totals.settled : "—"}/></View>
        <View style={s.pointsInfo}><Ionicons name="information-circle-outline" size={20} color={C.red}/><Text style={s.pointsInfoText}>Accuracy counts exact scores and correct win/draw/loss outcomes across settled predictions. Points and rank use the same prediction system as myanmarsportstalk.com.</Text></View>
      </> : null}

      {tab === "Leaderboard" ? <>
        <View style={s.leaderIntro}><View><Text style={s.sectionTitle}>MST PREDICTION LEADERBOARD</Text><Text style={s.leaderIntroText}>Same leaderboard as myanmarsportstalk.com</Text></View><Ionicons name="podium-outline" size={25} color={C.gold}/></View>
        {loading && !leaders.length ? <View style={s.compactLoading}><ActivityIndicator color={C.red}/><Text style={s.loadingText}>Loading leaderboard…</Text></View> : null}
        <View style={s.leaderCard}><View style={[s.leaderRow,s.leaderHeader]}><Text style={[s.leaderCell,{width:28}]}>#</Text><Text style={[s.leaderCell,{flex:1}]}>PLAYER</Text><Text style={s.leaderCell}>PTS</Text><Text style={s.leaderCell}>EXACT</Text><Text style={s.leaderCell}>CORRECT</Text><Text style={s.leaderCell}>PLAYED</Text></View>{leaders.length ? leaders.map((x,i)=>{const me=Boolean(x.raw?.isCurrentUser||x.raw?.you||x.raw?.currentUser);return <View key={`${x.id}-${i}`} style={[s.leaderRow,i!==leaders.length-1&&s.divider,me&&s.leaderMe]}><Text style={[s.leaderRank,{width:28},Number(x.rank)<=3&&{color:C.gold}]}>{x.rank}</Text><View style={s.leaderNameWrap}><Text numberOfLines={1} style={s.leaderName}>{x.name}</Text>{me?<Text style={s.youBadge}>YOU</Text>:null}</View><Text style={s.leaderValue}>{x.points}</Text><Text style={s.leaderValue}>{x.exact}</Text><Text style={s.leaderValue}>{x.correct}</Text><Text style={s.leaderValue}>{x.played}</Text></View>;}) : <Text style={s.emptyText}>Leaderboard is empty right now.</Text>}</View>
      </> : null}
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},header:{minHeight:70,paddingHorizontal:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:C.border2},title:{fontSize:22,fontWeight:"900",color:C.text},subtitle:{fontSize:10.5,color:C.muted,marginTop:3},tabs:{height:56,flexDirection:"row",padding:6,gap:4,borderBottomWidth:1,borderBottomColor:C.border2},tab:{flex:1,borderRadius:9,alignItems:"center",justifyContent:"center",paddingHorizontal:2},tabOn:{backgroundColor:C.redSoft},tabText:{fontSize:8.7,lineHeight:11,fontWeight:"800",color:C.muted,textAlign:"center"},tabTextOn:{color:C.red},content:{padding:14,paddingBottom:38},
  signInCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,padding:12,flexDirection:"row",alignItems:"center",gap:10,marginBottom:10},signInTitle:{fontSize:12.5,fontWeight:"800",color:C.text},signInText:{fontSize:9.5,lineHeight:13,color:C.muted,marginTop:3},scoring:{backgroundColor:"#151413",borderRadius:10,padding:12,flexDirection:"row",gap:9,marginBottom:10},scoringLabel:{fontSize:10,fontWeight:"900",color:C.red},scoringText:{flex:1,fontSize:10.2,lineHeight:15,color:C.text2},success:{fontSize:10,color:C.green,marginBottom:9},error:{fontSize:10,color:C.red,marginBottom:9},sectionHead:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginVertical:8},sectionTitle:{fontSize:11.5,fontWeight:"900",color:C.text2,marginVertical:9},sectionCount:{fontSize:10,color:C.muted},
  predictCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:12,padding:12,marginBottom:9},predictTop:{flexDirection:"row",alignItems:"center",gap:8},competition:{fontSize:10.5,fontWeight:"800",color:C.text2},kickoff:{fontSize:9.3,color:C.muted,marginTop:2},lockPill:{flexDirection:"row",gap:4,alignItems:"center",backgroundColor:"rgba(53,199,111,.08)",borderRadius:7,paddingHorizontal:7,paddingVertical:5},lockText:{fontSize:8.6,fontWeight:"900",color:C.muted},predictTeams:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:12},predictTeam:{width:"31%",alignItems:"center",gap:6},predictName:{fontSize:11.5,lineHeight:15,color:C.text,textAlign:"center"},scoreEntry:{width:"34%",flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7},scoreInput:{width:43,height:43,borderRadius:9,backgroundColor:C.card2,borderWidth:1,borderColor:C.border,color:C.text,textAlign:"center",fontSize:20,fontWeight:"900",padding:0},colon:{color:C.text2,fontSize:20,fontWeight:"800"},saveButton:{height:39,borderRadius:8,backgroundColor:C.red,alignItems:"center",justifyContent:"center",marginTop:12},saveDisabled:{opacity:.35},saveText:{fontSize:10,fontWeight:"900",color:C.text},lockNotice:{fontSize:9.5,color:C.muted,textAlign:"center",marginTop:11},logoFallback:{backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},compactLoading:{minHeight:64,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8},loadingText:{fontSize:10,color:C.muted},emptyText:{fontSize:10.5,color:C.muted,textAlign:"center",padding:18},
  statsGrid:{flexDirection:"row",gap:8,marginVertical:4},stat:{flex:1,minHeight:75,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:10,padding:10,justifyContent:"space-between"},statLabel:{fontSize:8.3,fontWeight:"900",color:C.muted},statNumber:{fontSize:22,fontWeight:"900",color:C.text},historyCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,overflow:"hidden"},historyRow:{padding:11},historyTeams:{flexDirection:"row",alignItems:"center",gap:8},historyTeam:{flex:1,flexDirection:"row",alignItems:"center",gap:7},historyName:{flex:1,fontSize:10.5,fontWeight:"700",color:C.text2},historyScore:{fontSize:15,fontWeight:"900",color:C.text,minWidth:54,textAlign:"center"},historyMeta:{marginTop:8,flexDirection:"row",justifyContent:"flex-end",alignItems:"center",gap:8},historyStatus:{fontSize:9.4,color:C.muted},historyResult:{fontSize:8.8,fontWeight:"800",color:C.muted2,marginTop:2},pointsBadge:{minWidth:44,height:25,borderRadius:13,backgroundColor:C.card2,alignItems:"center",justifyContent:"center",paddingHorizontal:8},pointsText:{fontSize:9.5,fontWeight:"900",color:C.text},divider:{borderBottomWidth:1,borderBottomColor:C.border2},pointsInfo:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,padding:12,flexDirection:"row",alignItems:"center",gap:9,marginTop:5},pointsInfoText:{flex:1,fontSize:10,lineHeight:15,color:C.text2},
  leaderIntro:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:5},leaderIntroText:{fontSize:9.3,color:C.muted,marginTop:-4},leaderCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,overflow:"hidden"},leaderRow:{minHeight:45,paddingHorizontal:9,flexDirection:"row",alignItems:"center",gap:5},leaderHeader:{backgroundColor:"#151515"},leaderMe:{backgroundColor:C.redSoft},leaderCell:{width:46,fontSize:7.7,fontWeight:"900",color:C.muted},leaderRank:{fontSize:10.5,fontWeight:"800",color:C.text2},leaderNameWrap:{flex:1,minWidth:0,flexDirection:"row",alignItems:"center",gap:5},leaderName:{flex:1,fontSize:10.5,fontWeight:"700",color:C.text2},youBadge:{fontSize:6.8,fontWeight:"900",color:C.red,borderWidth:1,borderColor:C.red,borderRadius:5,paddingHorizontal:4,paddingVertical:2},leaderValue:{width:46,fontSize:10,fontWeight:"800",color:C.text2,textAlign:"left"}
});
