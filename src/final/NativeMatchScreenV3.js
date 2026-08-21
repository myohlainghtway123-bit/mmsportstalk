import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { extractArray, fetchMatchBundle, flattenDisplayRows, isLiveMatch } from "../services/footballApi";
import { fetchPreferredOdds } from "../services/oddsApi";
import { getAccountPredictions, getAuthStatus, normalizePredictionPayload, savePredictionScore } from "../services/accountApi";

const C={bg:"#07090B",panel:"#0D1013",card:"#111519",card2:"#151A1F",border:"#20262C",border2:"#181D22",red:"#F32735",redSoft:"rgba(243,39,53,.12)",text:"#F7F8F9",text2:"#D7DBDF",muted:"#858C93",muted2:"#5F666D",green:"#25C875",gold:"#F1C85B"};
const TABS=["SUMMARY","STATS","LINEUPS","H2H","ODDS"];

function Logo({uri,size=58}){return uri?<Image source={{uri}} resizeMode="contain" style={{width:size,height:size}} fadeDuration={0}/>:<View style={[s.logoFallback,{width:size,height:size,borderRadius:size/2}]}><Ionicons name="football-outline" size={size*.46} color={C.muted}/></View>;}
function matchStatus(match){if(isLiveMatch(match))return match.minute?String(match.minute).includes("'")?match.minute:`${match.minute}'`:"LIVE";const code=String(match.statusCode||match.status||"").toUpperCase();return code||"NOT STARTED";}
function kickoffText(match){if(!match?.kickoff)return "";const d=new Date(match.kickoff);if(Number.isNaN(d.getTime()))return "";return d.toLocaleString([], {weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});}

function DataRows({value,empty="No data available"}){
  const rows=flattenDisplayRows(value).filter((x)=>x?.value!=="[object Object]").slice(0,50);
  if(!rows.length)return <View style={s.emptyBlock}><Text style={s.emptyText}>{empty}</Text></View>;
  return <View style={s.dataCard}>{rows.map((row,i)=><View key={`${row.label}-${i}`} style={[s.dataRow,i!==rows.length-1&&s.divider]}><Text numberOfLines={2} style={s.dataLabel}>{row.label}</Text><Text numberOfLines={3} style={s.dataValue}>{row.value}</Text></View>)}</View>;
}
function Events({value}){
  const rows=extractArray(value);
  if(!rows.length)return <View style={s.emptyBlock}><Text style={s.emptyText}>No match events yet.</Text></View>;
  return <View style={s.timeline}>{rows.slice(0,45).map((event,i)=>{const minute=event?.time?.elapsed??event?.minute??"";const player=event?.player?.name??event?.playerName??event?.detail??event?.type??"Event";const team=event?.team?.name??event?.teamName??"";const detail=event?.detail??event?.type??"";return <View key={`${minute}-${player}-${i}`} style={[s.timelineRow,i!==rows.length-1&&s.divider]}><Text style={s.timelineMinute}>{minute!==""?`${minute}'`:"•"}</Text><View style={s.timelineDot}/><View style={{flex:1}}><Text style={s.timelineTitle}>{player}</Text><Text style={s.timelineSub}>{[team,detail].filter(Boolean).join(" · ")}</Text></View></View>;})}</View>;
}

function OddsStrip({matchId,onOpen}){
  const [state,setState]=useState({loading:true,data:null,error:""});
  useEffect(()=>{let alive=true;fetchPreferredOdds(matchId).then((data)=>{if(alive)setState({loading:false,data,error:""});}).catch(()=>{if(alive)setState({loading:false,data:null,error:"unavailable"});});return()=>{alive=false};},[matchId]);
  const o=state.data?.matchWinner;
  return <Pressable style={s.oddsStrip} onPress={onOpen} android_ripple={{color:"rgba(255,255,255,.03)"}}>
    <View style={s.oddsLogo}><Text style={s.oddsLogoText}>{state.data?.bookmaker||"ODDS"}</Text></View>
    <View style={{flex:1}}>
      <Text style={s.oddsStripTitle}>{state.loading?"Checking 1xBet…":state.data?.bookmaker?`${state.data.bookmaker} Match Odds`:"Odds unavailable"}</Text>
      <Text style={s.oddsStripSub}>{state.loading?"Bet365 is fallback only":state.data?.bookmaker==="Bet365"?"1xBet unavailable · Bet365 fallback":state.data?.bookmaker?"1xBet priority":"1xBet → Bet365 priority"}</Text>
    </View>
    {o?<View style={s.oddsMini}><Text style={s.oddsMiniValue}>{o.home??"—"}</Text><Text style={s.oddsMiniSep}>·</Text><Text style={s.oddsMiniValue}>{o.draw??"—"}</Text><Text style={s.oddsMiniSep}>·</Text><Text style={s.oddsMiniValue}>{o.away??"—"}</Text></View>:state.loading?<ActivityIndicator size="small" color={C.red}/>:null}
    <Ionicons name="chevron-forward" size={15} color={C.muted2}/>
  </Pressable>;
}

function OddBox({label,value}){return <View style={s.oddBox}><Text style={s.oddLabel}>{label}</Text><Text style={s.oddValue}>{value??"—"}</Text></View>;}
function OddsPanel({matchId}){
  const [state,setState]=useState({loading:true,data:null,error:""});
  const load=useCallback(async(force=false)=>{setState((p)=>({...p,loading:true,error:""}));try{const data=await fetchPreferredOdds(matchId,{force});setState({loading:false,data,error:""});}catch(e){setState({loading:false,data:null,error:e?.message||"Odds unavailable"});}},[matchId]);
  useEffect(()=>{load(false);},[load]);
  if(state.loading&&!state.data)return <View style={s.oddsState}><ActivityIndicator color={C.red}/><Text style={s.oddsStateTitle}>Checking 1xBet</Text><Text style={s.oddsStateText}>If 1xBet has no market, MST Score checks Bet365.</Text></View>;
  if(!state.data)return <View style={s.oddsState}><Ionicons name="stats-chart-outline" size={26} color={C.muted}/><Text style={s.oddsStateTitle}>Odds unavailable</Text><Text style={s.oddsStateText}>1xBet is primary. Bet365 is used only when 1xBet has no odds. No third bookmaker is substituted.</Text><Pressable style={s.retryButton} onPress={()=>load(true)}><Text style={s.retryText}>RETRY</Text></Pressable></View>;
  const o=state.data;
  return <View>
    <View style={s.bookmakerCard}><View style={s.bookmakerMark}><Text style={s.bookmakerMarkText}>{o.bookmaker}</Text></View><View style={{flex:1}}><Text style={s.bookmakerTitle}>{o.bookmaker}</Text><Text style={s.bookmakerSub}>{o.bookmaker==="1xBet"?"Primary bookmaker":"1xBet unavailable · Bet365 fallback"}</Text></View><View style={s.verified}><Ionicons name="checkmark-circle" size={15} color={C.green}/><Text style={s.verifiedText}>LIVE DATA</Text></View></View>
    {o.matchWinner?<><Text style={s.sectionLabel}>MATCH RESULT</Text><View style={s.marketRow}><OddBox label="HOME" value={o.matchWinner.home}/><OddBox label="DRAW" value={o.matchWinner.draw}/><OddBox label="AWAY" value={o.matchWinner.away}/></View></>:null}
    {o.overUnder25?<><Text style={s.sectionLabel}>TOTAL GOALS · 2.5</Text><View style={s.marketRow}><OddBox label="OVER 2.5" value={o.overUnder25.over}/><OddBox label="UNDER 2.5" value={o.overUnder25.under}/></View></>:null}
    {o.btts?<><Text style={s.sectionLabel}>BOTH TEAMS TO SCORE</Text><View style={s.marketRow}><OddBox label="YES" value={o.btts.yes}/><OddBox label="NO" value={o.btts.no}/></View></>:null}
    <Text style={s.oddsDisclaimer}>Odds can change. 1xBet is always checked first; Bet365 is fallback only.</Text>
  </View>;
}

function Predictor({match}){
  const [auth,setAuth]=useState(false),[saved,setSaved]=useState(null),[home,setHome]=useState(""),[away,setAway]=useState(""),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
  const kickoff=match?.kickoff?new Date(match.kickoff).getTime():NaN;const locked=isLiveMatch(match)||(Number.isFinite(kickoff)&&Date.now()>=kickoff);
  useEffect(()=>{let alive=true;(async()=>{const a=await getAuthStatus().catch(()=>({authenticated:false}));if(!alive)return;setAuth(Boolean(a.authenticated));if(a.authenticated){const rows=normalizePredictionPayload(await getAccountPredictions().catch(()=>null));const row=rows.find((x)=>String(x.matchId)===String(match?.id));if(row){setSaved(row);setHome(row.homeScore!=null?String(row.homeScore):"");setAway(row.awayScore!=null?String(row.awayScore):"");}}})();return()=>{alive=false};},[match?.id]);
  const clean=(v)=>String(v||"").replace(/[^0-9]/g,"").slice(0,2);
  const save=async()=>{if(!auth||locked||home===""||away==="")return;setSaving(true);setMessage("");try{await savePredictionScore({matchId:match.id,homeScore:Number(home),awayScore:Number(away)});setSaved({...saved,homeScore:Number(home),awayScore:Number(away)});setMessage("Saved · editable until kickoff");}catch(e){setMessage(e?.message||"Could not save prediction");}finally{setSaving(false);}};
  if(locked&&!saved)return null;
  return <View style={s.predictCard}><View style={s.predictHead}><View><Text style={s.predictEyebrow}>MST PREDICT</Text><Text style={s.predictTitle}>Predict the score</Text></View><View style={s.pointsRule}><Text style={s.pointsRuleText}>3 / 1 / 0 PTS</Text></View></View><Text style={s.predictRule}>Exact score 3 points · Correct win/draw/loss 1 point · Wrong 0</Text>{!auth?<Text style={s.predictInfo}>Sign in from Predict to save a score.</Text>:<><View style={s.predictEntry}><View style={s.predictSide}><Logo uri={match.home?.logo} size={30}/><Text numberOfLines={1} style={s.predictTeam}>{match.home?.name}</Text></View><TextInput style={s.predictInput} value={home} onChangeText={(v)=>setHome(clean(v))} editable={!locked&&!saving} keyboardType="number-pad" placeholder="0" placeholderTextColor={C.muted}/><Text style={s.colon}>:</Text><TextInput style={s.predictInput} value={away} onChangeText={(v)=>setAway(clean(v))} editable={!locked&&!saving} keyboardType="number-pad" placeholder="0" placeholderTextColor={C.muted}/><View style={[s.predictSide,{alignItems:"flex-end"}]}><Logo uri={match.away?.logo} size={30}/><Text numberOfLines={1} style={[s.predictTeam,{textAlign:"right"}]}>{match.away?.name}</Text></View></View>{!locked?<Pressable style={[s.saveButton,(saving||home===""||away==="")&&{opacity:.45}]} disabled={saving||home===""||away===""} onPress={save}>{saving?<ActivityIndicator size="small" color={C.text}/>:<Text style={s.saveButtonText}>{saved?"UPDATE PREDICTION":"SAVE PREDICTION"}</Text>}</Pressable>:<Text style={s.predictInfo}>Prediction locked at kickoff.</Text>}{message?<Text style={s.predictMessage}>{message}</Text>:null}</>}</View>;
}

export default function NativeMatchScreenV3({match,goBack}){
  const [tab,setTab]=useState("SUMMARY");
  const [state,setState]=useState({loading:true,error:"",data:null});
  const load=useCallback(async()=>{if(!match?.id)return;try{const data=await fetchMatchBundle(match.id);setState({loading:false,error:"",data});}catch(e){setState({loading:false,error:e?.message||"Could not load match details",data:null});}},[match?.id]);
  useEffect(()=>{load();},[load]);
  const current=state.data?.detail?.match||match||{};const live=isLiveMatch(current);const hasScore=current.homeScore!=null&&current.awayScore!=null;const ko=kickoffText(current);
  const summary=useMemo(()=>({Venue:current.venue,Referee:current.referee,Kickoff:ko,Round:current.round,Status:current.statusLong||current.statusCode}),[current,ko]);
  return <View style={s.screen}>
    <View style={s.header}><Pressable hitSlop={10} onPress={goBack}><Ionicons name="chevron-back" size={26} color={C.text}/></Pressable><View style={{flex:1,alignItems:"center"}}><Text numberOfLines={1} style={s.headerLeague}>{current.competition||"Match Center"}</Text><Text style={s.headerSub}>MATCH CENTER</Text></View><View style={{width:28}}/></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <Text style={s.heroStatus}>{current.round||"Football"}</Text>
        <View style={s.heroMain}><View style={s.heroTeam}><Logo uri={current.home?.logo}/><Text numberOfLines={2} style={s.heroTeamName}>{current.home?.name}</Text></View><View style={s.scoreCenter}><Text style={s.scoreMain}>{hasScore?`${current.homeScore}  -  ${current.awayScore}`:"–  :  –"}</Text><View style={[s.statusPill,live&&s.statusPillLive]}><Text style={[s.statusPillText,live&&{color:C.text}]}>{matchStatus(current)}</Text></View>{ko?<Text style={s.kickoff}>{ko}</Text>:null}</View><View style={s.heroTeam}><Logo uri={current.away?.logo}/><Text numberOfLines={2} style={s.heroTeamName}>{current.away?.name}</Text></View></View>
      </View>
      <View style={s.tabBar}>{TABS.map((x)=><Pressable key={x} style={[s.tab,tab===x&&s.tabOn]} onPress={()=>setTab(x)}><Text style={[s.tabText,tab===x&&s.tabTextOn]}>{x}</Text></Pressable>)}</View>

      {tab==="SUMMARY"?<>
        <OddsStrip matchId={current.id||match?.id} onOpen={()=>setTab("ODDS")}/>
        <Predictor match={current}/>
        <View style={s.sectionHead}><Text style={s.sectionTitle}>MATCH EVENTS</Text>{state.loading?<ActivityIndicator size="small" color={C.red}/>:null}</View>
        {state.data?<Events value={state.data.events}/>:<View style={s.emptyBlock}><Text style={s.emptyText}>Updating match details…</Text></View>}
        <Text style={s.sectionTitleStandalone}>MATCH INFO</Text><DataRows value={summary}/>
      </>:null}
      {tab==="STATS"?(state.data?<DataRows value={state.data.statistics} empty="No statistics available"/>:<View style={s.emptyBlock}><ActivityIndicator color={C.red}/></View>):null}
      {tab==="LINEUPS"?(state.data?<DataRows value={state.data.lineups} empty="Lineups not available yet"/>:<View style={s.emptyBlock}><ActivityIndicator color={C.red}/></View>):null}
      {tab==="H2H"?(state.data?<DataRows value={state.data.h2h} empty="Head-to-head unavailable"/>:<View style={s.emptyBlock}><ActivityIndicator color={C.red}/></View>):null}
      {tab==="ODDS"?<OddsPanel matchId={current.id||match?.id}/>:null}
      {state.error?<Text style={s.errorText}>{state.error}</Text>:null}
    </ScrollView>
  </View>;
}

const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},header:{minHeight:61,paddingHorizontal:14,flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:C.border2},headerLeague:{fontSize:12,fontWeight:"900",color:C.text},headerSub:{fontSize:7.5,fontWeight:"800",letterSpacing:1.1,color:C.muted,marginTop:2},content:{padding:12,paddingBottom:36},
  hero:{backgroundColor:C.panel,borderWidth:1,borderColor:C.border,borderRadius:13,padding:14},heroStatus:{fontSize:8.5,fontWeight:"800",color:C.muted,textAlign:"center",textTransform:"uppercase"},heroMain:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:13},heroTeam:{width:"31%",alignItems:"center",gap:7},heroTeamName:{fontSize:11.5,fontWeight:"800",lineHeight:15,color:C.text,textAlign:"center"},scoreCenter:{width:"38%",alignItems:"center"},scoreMain:{fontSize:27,fontWeight:"900",color:C.text,letterSpacing:-1},statusPill:{marginTop:7,height:23,paddingHorizontal:9,borderRadius:12,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},statusPillLive:{backgroundColor:C.red},statusPillText:{fontSize:8.5,fontWeight:"900",color:C.muted},kickoff:{fontSize:8,color:C.muted,textAlign:"center",marginTop:6},logoFallback:{backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},
  tabBar:{height:47,marginTop:8,backgroundColor:C.panel,borderWidth:1,borderColor:C.border,borderRadius:10,flexDirection:"row",padding:3},tab:{flex:1,borderRadius:8,alignItems:"center",justifyContent:"center"},tabOn:{backgroundColor:C.redSoft},tabText:{fontSize:7.7,fontWeight:"900",color:C.muted},tabTextOn:{color:C.red},
  oddsStrip:{minHeight:62,marginTop:10,paddingHorizontal:10,borderRadius:10,backgroundColor:C.card,borderWidth:1,borderColor:C.border,flexDirection:"row",alignItems:"center",gap:8},oddsLogo:{minWidth:45,height:35,borderRadius:8,backgroundColor:C.red,alignItems:"center",justifyContent:"center",paddingHorizontal:6},oddsLogoText:{fontSize:9,fontWeight:"900",color:C.text},oddsStripTitle:{fontSize:10.5,fontWeight:"900",color:C.text2},oddsStripSub:{fontSize:8,color:C.muted,marginTop:2},oddsMini:{flexDirection:"row",alignItems:"center",gap:4},oddsMiniValue:{fontSize:9,fontWeight:"900",color:C.text},oddsMiniSep:{fontSize:8,color:C.muted2},
  predictCard:{marginTop:10,padding:12,borderRadius:10,backgroundColor:C.card,borderWidth:1,borderColor:C.border},predictHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},predictEyebrow:{fontSize:7.8,fontWeight:"900",letterSpacing:1,color:C.red},predictTitle:{fontSize:16,fontWeight:"900",color:C.text,marginTop:2},pointsRule:{height:25,paddingHorizontal:8,borderRadius:13,backgroundColor:C.redSoft,alignItems:"center",justifyContent:"center"},pointsRuleText:{fontSize:7.7,fontWeight:"900",color:C.red},predictRule:{fontSize:8.7,lineHeight:13,color:C.muted,marginTop:6},predictEntry:{marginTop:12,flexDirection:"row",alignItems:"center",gap:7},predictSide:{flex:1,alignItems:"flex-start",gap:4},predictTeam:{fontSize:8.7,fontWeight:"800",color:C.text2,maxWidth:78},predictInput:{width:42,height:42,borderRadius:8,backgroundColor:C.panel,borderWidth:1,borderColor:C.border,textAlign:"center",fontSize:17,fontWeight:"900",color:C.text,padding:0},colon:{fontSize:17,fontWeight:"900",color:C.muted},saveButton:{height:38,borderRadius:8,backgroundColor:C.red,alignItems:"center",justifyContent:"center",marginTop:10},saveButtonText:{fontSize:9,fontWeight:"900",color:C.text},predictInfo:{fontSize:8.5,color:C.muted,marginTop:9},predictMessage:{fontSize:8.5,color:C.green,textAlign:"center",marginTop:7},
  sectionHead:{marginTop:14,marginBottom:7,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},sectionTitle:{fontSize:9.3,fontWeight:"900",color:C.text2,letterSpacing:.3},sectionTitleStandalone:{fontSize:9.3,fontWeight:"900",color:C.text2,letterSpacing:.3,marginTop:14,marginBottom:7},timeline:{backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:10,overflow:"hidden"},timelineRow:{minHeight:50,paddingHorizontal:10,paddingVertical:8,flexDirection:"row",alignItems:"center",gap:8},timelineMinute:{width:30,fontSize:9,fontWeight:"900",color:C.red},timelineDot:{width:6,height:6,borderRadius:3,backgroundColor:C.muted2},timelineTitle:{fontSize:10,fontWeight:"800",color:C.text2},timelineSub:{fontSize:8,color:C.muted,marginTop:2},divider:{borderBottomWidth:1,borderBottomColor:C.border2},
  dataCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:10,overflow:"hidden"},dataRow:{minHeight:42,paddingHorizontal:10,paddingVertical:8,flexDirection:"row",justifyContent:"space-between",gap:12},dataLabel:{width:"42%",fontSize:8.8,color:C.muted,textTransform:"capitalize"},dataValue:{width:"54%",fontSize:9.2,color:C.text2,textAlign:"right"},emptyBlock:{minHeight:82,backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:10,padding:14,alignItems:"center",justifyContent:"center",gap:6},emptyText:{fontSize:8.8,lineHeight:13,color:C.muted,textAlign:"center"},errorText:{fontSize:8.5,color:C.red,textAlign:"center",marginTop:10},
  oddsState:{minHeight:150,marginTop:10,backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:11,padding:18,alignItems:"center",justifyContent:"center",gap:7},oddsStateTitle:{fontSize:13,fontWeight:"900",color:C.text},oddsStateText:{fontSize:9,lineHeight:13,color:C.muted,textAlign:"center"},retryButton:{height:34,paddingHorizontal:16,borderRadius:7,backgroundColor:C.red,alignItems:"center",justifyContent:"center",marginTop:3},retryText:{fontSize:8.5,fontWeight:"900",color:C.text},bookmakerCard:{minHeight:65,marginTop:10,padding:10,backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:10,flexDirection:"row",alignItems:"center",gap:9},bookmakerMark:{minWidth:54,height:38,borderRadius:9,backgroundColor:C.red,alignItems:"center",justifyContent:"center",paddingHorizontal:7},bookmakerMarkText:{fontSize:10,fontWeight:"900",color:C.text},bookmakerTitle:{fontSize:12,fontWeight:"900",color:C.text},bookmakerSub:{fontSize:8,color:C.muted,marginTop:2},verified:{flexDirection:"row",alignItems:"center",gap:3},verifiedText:{fontSize:7,fontWeight:"900",color:C.green},sectionLabel:{fontSize:8.5,fontWeight:"900",color:C.text2,letterSpacing:.4,marginTop:14,marginBottom:7},marketRow:{flexDirection:"row",gap:7},oddBox:{flex:1,minHeight:54,borderRadius:9,backgroundColor:C.card,borderWidth:1,borderColor:C.border,alignItems:"center",justifyContent:"center"},oddLabel:{fontSize:7.5,fontWeight:"800",color:C.muted},oddValue:{fontSize:15,fontWeight:"900",color:C.text,marginTop:3},oddsDisclaimer:{fontSize:7.8,lineHeight:12,color:C.muted,textAlign:"center",marginTop:14}
});