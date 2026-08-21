import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { extractArray, fetchMatchBundle, flattenDisplayRows, isLiveMatch } from "../services/footballApi";
import { fetchPreferredOdds, ODDS_PRIORITY_LABEL } from "../services/oddsApi";
import { getAccountPredictions, getAuthStatus, normalizePredictionPayload, savePredictionScore } from "../services/accountApi";

const C = { bg:"#080A0C", card:"#111416", card2:"#15191C", border:"#24292D", border2:"#1D2226", red:"#F3262D", redSoft:"rgba(243,38,45,.14)", text:"#FFFFFF", text2:"#D0D2D4", muted:"#92979B", green:"#35C76F" };
const TABS = ["SUMMARY","STATS","LINEUPS","H2H","ODDS"];

function Logo({uri,size=60}) { return uri ? <Image source={{uri}} resizeMode="contain" style={{width:size,height:size}} fadeDuration={0}/> : <View style={[s.logoFallback,{width:size,height:size,borderRadius:size/2}]}><Ionicons name="football-outline" size={size*.48} color={C.muted}/></View>; }

function GenericRows({value,empty="No data available"}) {
  const rows = flattenDisplayRows(value).filter((x)=>x?.value!=="[object Object]").slice(0,55);
  if (!rows.length) return <View style={s.empty}><Text style={s.emptyText}>{empty}</Text></View>;
  return <View style={s.dataCard}>{rows.map((row,i)=><View key={`${row.label}-${i}`} style={[s.dataRow,i!==rows.length-1&&s.divider]}><Text numberOfLines={2} style={s.dataLabel}>{row.label}</Text><Text numberOfLines={4} style={s.dataValue}>{row.value}</Text></View>)}</View>;
}

function Events({value}) {
  const rows = extractArray(value);
  if (!rows.length) return <View style={s.empty}><Text style={s.emptyText}>No match events yet.</Text></View>;
  return <View style={s.dataCard}>{rows.slice(0,50).map((event,i)=>{
    const minute=event?.time?.elapsed??event?.minute??"";
    const player=event?.player?.name??event?.playerName??event?.detail??event?.type??"Event";
    const team=event?.team?.name??event?.teamName??"";
    const detail=event?.detail??event?.type??"";
    return <View key={`${minute}-${player}-${i}`} style={[s.eventRow,i!==rows.length-1&&s.divider]}><Text style={s.eventMinute}>{minute!==""?`${minute}'`:"•"}</Text><View style={{flex:1}}><Text style={s.eventTitle}>{player}</Text><Text style={s.eventSub}>{[team,detail].filter(Boolean).join(" · ")}</Text></View></View>;
  })}</View>;
}

function OddBox({label,value}) { return <View style={s.oddBox}><Text style={s.oddLabel}>{label}</Text><Text style={s.oddValue}>{value ?? "—"}</Text></View>; }
function Market({title,children}) { return <View style={s.market}><Text style={s.marketTitle}>{title}</Text><View style={s.marketRow}>{children}</View></View>; }

function OddsPanel({matchId}) {
  const [state,setState]=useState({loading:true,error:"",data:null});
  const load=useCallback(async(force=false)=>{setState((p)=>({...p,loading:true,error:""}));try{const data=await fetchPreferredOdds(matchId,{force});setState({loading:false,error:"",data});}catch(e){setState({loading:false,error:e?.message||"Odds unavailable",data:null});}},[matchId]);
  useEffect(()=>{load(false);},[load]);
  if (state.loading && !state.data) return <View style={s.empty}><ActivityIndicator color={C.red}/><Text style={s.emptyText}>Checking 1xBet, then Bet365…</Text></View>;
  if (!state.data) return <View style={s.empty}><Ionicons name="stats-chart-outline" size={24} color={C.muted}/><Text style={s.emptyTitle}>Odds unavailable</Text><Text style={s.emptyText}>1xBet has priority. If 1xBet is unavailable, MST Score checks Bet365. No other bookmaker is substituted.</Text><Pressable onPress={()=>load(true)} style={s.retry}><Text style={s.retryText}>RETRY</Text></Pressable></View>;
  const o=state.data;
  return <View>
    <View style={s.bookmakerHead}><View><Text style={s.bookmaker}>{o.bookmaker}</Text><Text style={s.bookmakerSub}>{o.bookmaker==="1xBet"?"Primary odds source":"1xBet unavailable · Bet365 fallback"}</Text></View><View style={s.liveSource}><Text style={s.liveSourceText}>ODDS</Text></View></View>
    {o.matchWinner ? <Market title="MATCH RESULT"><OddBox label="Home" value={o.matchWinner.home}/><OddBox label="Draw" value={o.matchWinner.draw}/><OddBox label="Away" value={o.matchWinner.away}/></Market> : null}
    {o.overUnder25 ? <Market title="TOTAL GOALS · 2.5"><OddBox label="Over 2.5" value={o.overUnder25.over}/><OddBox label="Under 2.5" value={o.overUnder25.under}/></Market> : null}
    {o.btts ? <Market title="BOTH TEAMS TO SCORE"><OddBox label="Yes" value={o.btts.yes}/><OddBox label="No" value={o.btts.no}/></Market> : null}
    <Text style={s.oddsFoot}>{ODDS_PRIORITY_LABEL} · Odds are informational and may change.</Text>
  </View>;
}

function ScorePredictor({match}) {
  const [auth,setAuth]=useState(false); const [saved,setSaved]=useState(null); const [home,setHome]=useState(""); const [away,setAway]=useState(""); const [saving,setSaving]=useState(false); const [message,setMessage]=useState("");
  const kickoff=match?.kickoff?new Date(match.kickoff).getTime():NaN; const isLocked=isLiveMatch(match)||(Number.isFinite(kickoff)&&Date.now()>=kickoff);
  useEffect(()=>{let alive=true;(async()=>{const a=await getAuthStatus().catch(()=>({authenticated:false}));if(!alive)return;setAuth(Boolean(a.authenticated));if(a.authenticated){const rows=normalizePredictionPayload(await getAccountPredictions().catch(()=>null));const row=rows.find((x)=>String(x.matchId)===String(match?.id));if(row){setSaved(row);setHome(row.homeScore!==null&&row.homeScore!==undefined?String(row.homeScore):"");setAway(row.awayScore!==null&&row.awayScore!==undefined?String(row.awayScore):"");}}})();return()=>{alive=false};},[match?.id]);
  const change=(setter)=>(v)=>setter(String(v||"").replace(/[^0-9]/g,"").slice(0,2));
  const save=async()=>{if(!auth||home===""||away===""||isLocked)return;setSaving(true);setMessage("");try{await savePredictionScore({matchId:match.id,homeScore:Number(home),awayScore:Number(away)});setSaved({...saved,homeScore:Number(home),awayScore:Number(away)});setMessage("Prediction saved");}catch(e){setMessage(e?.message||"Could not save prediction");}finally{setSaving(false);}};
  if (isLocked && !saved) return null;
  return <View style={s.predictBlock}><View style={s.predictHeading}><Text style={s.predictLabel}>MST PREDICT</Text><Text style={s.predictRule}>Exact 3 pts · Correct result 1 pt · Wrong 0</Text></View>{!auth?<Text style={s.predictHint}>Sign in from Predictions to save a score.</Text>:<><View style={s.predictRow}><Text numberOfLines={1} style={s.predictTeam}>{match?.home?.name||"Home"}</Text><TextInput style={s.predictInput} value={home} onChangeText={change(setHome)} editable={!isLocked&&!saving} keyboardType="number-pad" placeholder="0" placeholderTextColor={C.muted}/><Text style={s.predictColon}>:</Text><TextInput style={s.predictInput} value={away} onChangeText={change(setAway)} editable={!isLocked&&!saving} keyboardType="number-pad" placeholder="0" placeholderTextColor={C.muted}/><Text numberOfLines={1} style={[s.predictTeam,{textAlign:"right"}]}>{match?.away?.name||"Away"}</Text></View>{!isLocked?<Pressable style={s.predictButton} onPress={save} disabled={saving||home===""||away===""}>{saving?<ActivityIndicator size="small" color={C.text}/>:<Text style={s.predictButtonText}>{saved?"UPDATE PREDICTION":"SAVE PREDICTION"}</Text>}</Pressable>:<Text style={s.predictHint}>Prediction locked at kickoff.</Text>}{message?<Text style={s.predictMessage}>{message}</Text>:null}</>}</View>;
}

export default function NativeMatchScreenV2({match,goBack}) {
  const [tab,setTab]=useState("SUMMARY");
  const [state,setState]=useState({loading:true,error:"",data:null});
  const load=useCallback(async()=>{if(!match?.id)return;try{const data=await fetchMatchBundle(match.id);setState({loading:false,error:"",data});}catch(e){setState({loading:false,error:e?.message||"Could not load match details",data:null});}},[match?.id]);
  useEffect(()=>{load();},[load]);
  const current=state.data?.detail?.match||match||{}; const live=isLiveMatch(current); const hasScore=current.homeScore!==null&&current.homeScore!==undefined&&current.awayScore!==null&&current.awayScore!==undefined;
  const kickoff=current.kickoff?new Date(current.kickoff):null;
  const kickoffText=kickoff&&!Number.isNaN(kickoff.getTime())?kickoff.toLocaleString([], {weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"";
  const summaryValue=useMemo(()=>({Competition:current.competition,Round:current.round,Venue:current.venue,Referee:current.referee,Kickoff:kickoffText,Status:current.statusLong}),[current,kickoffText]);

  return <View style={s.screen}>
    <View style={s.header}><Pressable hitSlop={10} onPress={goBack}><Ionicons name="chevron-back" size={27} color={C.text}/></Pressable><Text numberOfLines={1} style={s.headerTitle}>{current.competition||"Match Center"}</Text><Ionicons name="star-outline" size={23} color={C.muted}/></View>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.hero}><Text style={s.heroLeague}>{current.competition||"Football"}</Text><View style={s.heroTeams}><View style={s.heroTeam}><Logo uri={current.home?.logo}/><Text numberOfLines={2} style={s.heroTeamName}>{current.home?.name}</Text></View><View style={s.scoreWrap}><Text style={s.bigScore}>{hasScore?`${current.homeScore} - ${current.awayScore}`:"– : –"}</Text><Text style={[s.status,live&&{color:C.red}]}>{live?(current.minute?`${current.minute}'`:"LIVE"):(current.statusCode||"NOT STARTED")}</Text>{kickoffText?<Text style={s.kickoff}>{kickoffText}</Text>:null}</View><View style={s.heroTeam}><Logo uri={current.away?.logo}/><Text numberOfLines={2} style={s.heroTeamName}>{current.away?.name}</Text></View></View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>{TABS.map((x)=><Pressable key={x} style={[s.tab,tab===x&&s.tabOn]} onPress={()=>setTab(x)}><Text style={[s.tabText,tab===x&&s.tabTextOn]}>{x}</Text></Pressable>)}</ScrollView>
      {tab==="SUMMARY"?<><ScorePredictor match={current}/>{state.data?<><Text style={s.section}>MATCH EVENTS</Text><Events value={state.data.events}/><Text style={s.section}>MATCH INFO</Text><GenericRows value={summaryValue}/></>:state.loading?<View style={s.inlineLoad}><ActivityIndicator color={C.red}/><Text style={s.emptyText}>Updating match details…</Text></View>:<GenericRows value={summaryValue}/>}</>:null}
      {tab==="STATS"?(state.data?<GenericRows value={state.data.statistics} empty="No match statistics available"/>:<View style={s.inlineLoad}><ActivityIndicator color={C.red}/></View>):null}
      {tab==="LINEUPS"?(state.data?<GenericRows value={state.data.lineups} empty="Lineups not available yet"/>:<View style={s.inlineLoad}><ActivityIndicator color={C.red}/></View>):null}
      {tab==="H2H"?(state.data?<GenericRows value={state.data.h2h} empty="Head-to-head data unavailable"/>:<View style={s.inlineLoad}><ActivityIndicator color={C.red}/></View>):null}
      {tab==="ODDS"?<OddsPanel matchId={current.id||match?.id}/>:null}
      {state.error?<Text style={s.error}>{state.error}</Text>:null}
    </ScrollView>
  </View>;
}

const s=StyleSheet.create({screen:{flex:1,backgroundColor:C.bg},header:{minHeight:62,paddingHorizontal:15,flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:C.border2},headerTitle:{flex:1,textAlign:"center",fontSize:13,fontWeight:"800",color:C.text,paddingHorizontal:10},content:{padding:14,paddingBottom:38},hero:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:13,padding:14},heroLeague:{fontSize:9.5,fontWeight:"800",color:C.muted,textAlign:"center"},heroTeams:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:12},heroTeam:{width:"32%",alignItems:"center",gap:7},heroTeamName:{fontSize:12,fontWeight:"700",lineHeight:15,color:C.text,textAlign:"center"},scoreWrap:{width:"34%",alignItems:"center"},bigScore:{fontSize:29,fontWeight:"900",color:C.text},status:{fontSize:10,fontWeight:"900",color:C.muted,marginTop:4},kickoff:{fontSize:8.8,color:C.muted,textAlign:"center",marginTop:4},logoFallback:{backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},tabs:{gap:5,paddingVertical:11},tab:{minWidth:76,height:36,borderRadius:8,backgroundColor:C.card,alignItems:"center",justifyContent:"center",paddingHorizontal:10},tabOn:{backgroundColor:C.redSoft,borderWidth:1,borderColor:"rgba(243,38,45,.25)"},tabText:{fontSize:8.8,fontWeight:"900",color:C.muted},tabTextOn:{color:C.red},section:{fontSize:10.5,fontWeight:"900",color:C.text2,marginTop:14,marginBottom:7},dataCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:10,overflow:"hidden"},dataRow:{minHeight:43,paddingHorizontal:11,paddingVertical:8,flexDirection:"row",justifyContent:"space-between",gap:12},dataLabel:{width:"43%",fontSize:9.6,color:C.muted,textTransform:"capitalize"},dataValue:{width:"53%",fontSize:10,color:C.text2,textAlign:"right"},divider:{borderBottomWidth:1,borderBottomColor:C.border2},eventRow:{minHeight:49,padding:9,flexDirection:"row",alignItems:"center",gap:8},eventMinute:{width:35,fontSize:9.5,fontWeight:"900",color:C.red},eventTitle:{fontSize:10.5,fontWeight:"800",color:C.text2},eventSub:{fontSize:8.8,color:C.muted,marginTop:2},empty:{minHeight:110,backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:10,padding:16,alignItems:"center",justifyContent:"center",gap:7},emptyTitle:{fontSize:12.5,fontWeight:"800",color:C.text},emptyText:{fontSize:9.8,lineHeight:14,color:C.muted,textAlign:"center"},retry:{backgroundColor:C.red,borderRadius:7,paddingHorizontal:14,paddingVertical:8,marginTop:3},retryText:{fontSize:9,fontWeight:"900",color:C.text},inlineLoad:{minHeight:70,flexDirection:"row",gap:8,alignItems:"center",justifyContent:"center"},error:{fontSize:9.5,color:C.red,textAlign:"center",marginTop:10},predictBlock:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,padding:12,marginBottom:4},predictHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},predictLabel:{fontSize:9.5,fontWeight:"900",letterSpacing:1,color:C.red},predictRule:{fontSize:8.5,color:C.muted},predictRow:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6,marginTop:11},predictTeam:{flex:1,fontSize:9.5,fontWeight:"700",color:C.text2},predictInput:{width:42,height:40,borderRadius:8,borderWidth:1,borderColor:C.border,backgroundColor:C.card2,textAlign:"center",color:C.text,fontSize:18,fontWeight:"900",padding:0},predictColon:{fontSize:18,fontWeight:"900",color:C.text2},predictButton:{height:37,borderRadius:8,backgroundColor:C.red,alignItems:"center",justifyContent:"center",marginTop:10},predictButtonText:{fontSize:9.5,fontWeight:"900",color:C.text},predictHint:{fontSize:9,color:C.muted,textAlign:"center",marginTop:9},predictMessage:{fontSize:9,color:C.green,textAlign:"center",marginTop:7},bookmakerHead:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:10,padding:12,flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:9},bookmaker:{fontSize:17,fontWeight:"900",color:C.text},bookmakerSub:{fontSize:9,color:C.muted,marginTop:2},liveSource:{backgroundColor:C.red,borderRadius:6,paddingHorizontal:9,paddingVertical:6},liveSourceText:{fontSize:8.5,fontWeight:"900",color:C.text},market:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:10,padding:10,marginBottom:8},marketTitle:{fontSize:9.5,fontWeight:"900",color:C.text2,marginBottom:8},marketRow:{flexDirection:"row",gap:7},oddBox:{flex:1,minHeight:52,backgroundColor:C.card2,borderRadius:8,padding:8,justifyContent:"space-between"},oddLabel:{fontSize:8.8,color:C.muted},oddValue:{fontSize:17,fontWeight:"900",color:C.text},oddsFoot:{fontSize:8.6,lineHeight:13,color:C.muted,textAlign:"center",marginTop:4}});
