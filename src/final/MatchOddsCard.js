import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { isLiveMatch } from "../services/footballApi";
import { fetchPreferredOdds } from "../services/oddsApi";

const C={panel:"#0D1013",card:"#111519",card2:"#151A1F",border:"#20262C",border2:"#181D22",red:"#F32735",redSoft:"rgba(243,39,53,.12)",text:"#F7F8F9",text2:"#D7DBDF",muted:"#858C93",muted2:"#5F666D",green:"#22C777"};
const tx=(my,en,myText)=>my?myText:en;
const statusCode=(match)=>String(match?.statusCode||match?.status||"").trim().toUpperCase();
const CLOSED_CODES=new Set(["FT","AET","PEN","FINISHED","CANC","CANCELLED","CANCELED","ABD","ABANDONED","AWD","WO"]);
const closedMatch=(match)=>CLOSED_CODES.has(statusCode(match));

function OddBox({label,value,compact=false}){return <View style={[s.oddBox,compact&&s.oddBoxCompact]}><Text style={s.oddLabel}>{label}</Text><Text style={[s.oddValue,compact&&s.oddValueCompact]}>{value??"—"}</Text></View>;}

export default function MatchOddsCard({match,my=false,compact=false,onOpenFull}){
  const matchId=match?.id;
  const closed=closedMatch(match);
  const live=isLiveMatch(match);
  const [state,setState]=useState({loading:!closed,data:null,error:""});

  const load=useCallback(async(force=false,silent=false)=>{
    if(!matchId||closed){setState({loading:false,data:null,error:""});return;}
    if(!silent)setState((p)=>({...p,loading:true,error:""}));
    try{const data=await fetchPreferredOdds(matchId,{force});setState({loading:false,data,error:""});}
    catch(e){setState((p)=>({...p,loading:false,error:e?.message||"Odds unavailable"}));}
  },[matchId,closed]);

  useEffect(()=>{load(false,false);if(closed)return undefined;const interval=live?20000:120000;const timer=setInterval(()=>load(true,true),interval);return()=>clearInterval(timer);},[load,closed,live]);

  if(closed)return <View style={[s.card,compact&&s.compactCard]}><View style={s.head}><View><Text style={s.eyebrow}>MATCH ODDS</Text><Text style={s.title}>{tx(my,"Odds closed","Odds ပိတ်ပြီး")}</Text></View><View style={s.closedBadge}><Ionicons name="lock-closed" size={11} color={C.muted}/><Text style={s.closedText}>CLOSED</Text></View></View></View>;

  if(state.loading&&!state.data)return <View style={[s.card,compact&&s.compactCard,s.center]}><ActivityIndicator color={C.red}/><Text style={s.muted}>{tx(my,"Checking odds…","Odds စစ်နေသည်…")}</Text></View>;

  const o=state.data;
  if(!o)return <View style={[s.card,compact&&s.compactCard]}><View style={s.head}><View><Text style={s.eyebrow}>MATCH ODDS</Text><Text style={s.title}>{tx(my,"Odds unavailable","Odds မရသေးပါ")}</Text></View>{state.error?<Pressable style={s.retry} onPress={()=>load(true,false)}><Ionicons name="refresh" size={14} color={C.text}/></Pressable>:null}</View><Text style={s.muted}>{tx(my,"1xBet priority · Bet365 fallback","1xBet ဦးစားပေး · Bet365 အရန်")}</Text></View>;

  const paused=Boolean(o.blocked||o.stopped);
  const mode=o.mode==="live"?"IN-PLAY":"PRE-MATCH";
  const result=o.matchWinner;

  if(compact)return <Pressable disabled={!onOpenFull} onPress={onOpenFull} style={[s.card,s.compactCard,paused&&s.paused]}><View style={s.compactHead}><View style={{flex:1}}><Text style={s.eyebrow}>MATCH ODDS · {o.bookmaker||"LIVE ODDS"}</Text><Text style={s.compactTitle}>{paused?tx(my,"Market paused","Market ခေတ္တပိတ်"):mode}</Text></View>{onOpenFull?<View style={s.more}><Text style={s.moreText}>{tx(my,"MORE","အသေးစိတ်")}</Text><Ionicons name="chevron-forward" size={13} color={C.red}/></View>:null}</View>{result?<View style={s.compactMarket}><OddBox compact label="HOME" value={result.home}/><OddBox compact label="DRAW" value={result.draw}/><OddBox compact label="AWAY" value={result.away}/></View>:<Text style={s.muted}>{tx(my,"Main market is not available right now.","Main market မရသေးပါ။")}</Text>}</Pressable>;

  return <View style={[s.card,paused&&s.paused]}><View style={s.head}><View><Text style={s.eyebrow}>MATCH ODDS</Text><Text style={s.bookmaker}>{o.bookmaker||"LIVE ODDS"}</Text><Text style={s.source} numberOfLines={1}>{o.sourceName||"MST Odds"}</Text></View><View style={[s.modeBadge,live&&s.modeLive]}><Text style={[s.modeText,live&&s.modeTextLive]}>{paused?"PAUSED":mode}</Text></View></View>{result?<><Text style={s.marketLabel}>MATCH RESULT</Text><View style={s.marketRow}><OddBox label="HOME" value={result.home}/><OddBox label="DRAW" value={result.draw}/><OddBox label="AWAY" value={result.away}/></View></>:null}{o.overUnder25?<><Text style={s.marketLabel}>TOTAL GOALS · 2.5</Text><View style={s.marketRow}><OddBox label="OVER 2.5" value={o.overUnder25.over}/><OddBox label="UNDER 2.5" value={o.overUnder25.under}/></View></>:null}{o.btts?<><Text style={s.marketLabel}>BOTH TEAMS TO SCORE</Text><View style={s.marketRow}><OddBox label="YES" value={o.btts.yes}/><OddBox label="NO" value={o.btts.no}/></View></>:null}{paused?<Text style={s.notice}>{tx(my,"Market is temporarily paused; displayed prices are the latest received.","Market ခေတ္တပိတ်ထားပြီး ပြထားသော odds များသည် နောက်ဆုံးရရှိထားသော အချက်အလက်ဖြစ်သည်။")}</Text>:null}<Text style={s.foot}>{tx(my,"1xBet priority · Bet365 fallback · odds may change","1xBet ဦးစားပေး · Bet365 အရန် · odds ပြောင်းလဲနိုင်သည်")}</Text></View>;
}

const s=StyleSheet.create({
  card:{backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:13,padding:13,marginBottom:10},compactCard:{paddingVertical:10},center:{minHeight:76,alignItems:"center",justifyContent:"center",gap:7},head:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:10},compactHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},eyebrow:{fontSize:7.8,fontWeight:"900",letterSpacing:.8,color:C.red,marginBottom:3},title:{fontSize:13,fontWeight:"900",color:C.text},compactTitle:{fontSize:10.5,fontWeight:"900",color:C.text2},bookmaker:{fontSize:17,fontWeight:"900",fontStyle:"italic",color:C.red},source:{fontSize:8,color:C.muted,marginTop:2,maxWidth:220},modeBadge:{minHeight:25,paddingHorizontal:8,borderRadius:13,backgroundColor:C.panel,borderWidth:1,borderColor:C.border,alignItems:"center",justifyContent:"center"},modeLive:{backgroundColor:C.redSoft,borderColor:"rgba(243,39,53,.35)"},modeText:{fontSize:7.5,fontWeight:"900",color:C.muted},modeTextLive:{color:C.red},closedBadge:{height:25,borderRadius:13,paddingHorizontal:8,backgroundColor:C.panel,borderWidth:1,borderColor:C.border,flexDirection:"row",alignItems:"center",gap:4},closedText:{fontSize:7.5,fontWeight:"900",color:C.muted},more:{height:28,flexDirection:"row",alignItems:"center",gap:2},moreText:{fontSize:7.5,fontWeight:"900",color:C.red},compactMarket:{flexDirection:"row",gap:6,marginTop:8},marketLabel:{fontSize:9,fontWeight:"900",color:C.text2,marginTop:14,marginBottom:7},marketRow:{flexDirection:"row",gap:7},oddBox:{flex:1,minHeight:58,borderRadius:9,backgroundColor:C.panel,borderWidth:1,borderColor:C.border,alignItems:"center",justifyContent:"center",paddingHorizontal:4},oddBoxCompact:{minHeight:44},oddLabel:{fontSize:7.5,fontWeight:"800",color:C.muted,textAlign:"center"},oddValue:{fontSize:16,fontWeight:"900",fontVariant:["tabular-nums"],color:C.text,marginTop:3},oddValueCompact:{fontSize:13},muted:{fontSize:8.5,color:C.muted,lineHeight:13},retry:{width:36,height:36,borderRadius:18,backgroundColor:C.red,alignItems:"center",justifyContent:"center"},paused:{opacity:.78},notice:{fontSize:8.3,color:C.muted,marginTop:11,lineHeight:13},foot:{fontSize:7.5,color:C.muted2,textAlign:"center",marginTop:12}
});