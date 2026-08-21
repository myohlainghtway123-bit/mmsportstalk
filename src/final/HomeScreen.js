import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { isLiveMatch } from "../services/footballApi";
import { fetchFastFootballMatches, peekFastFootballMatches, prefetchFastFootballMatches } from "../services/fastFootballApi";

const C = {
  bg:"#07090B", panel:"#0D1013", card:"#111519", card2:"#151A1F", border:"#20262C", border2:"#181D22",
  red:"#F32735", redSoft:"rgba(243,39,53,.12)", text:"#F7F8F9", text2:"#D7DBDF", muted:"#858C93", muted2:"#5F666D", green:"#25C875"
};
const FILTERS = ["ALL","LIVE","UPCOMING","FINISHED"];
const POPULAR = ["Premier League","Champions League","Europa League","LaLiga","La Liga","Serie A","Bundesliga","Ligue 1"];

function bangkokDate(offset=0){
  const date=new Date(Date.now()+offset*86400000);
  try{
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
    const map=Object.fromEntries(parts.map((p)=>[p.type,p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }catch(_){return date.toISOString().slice(0,10);}
}
function dayMeta(offset){
  const d=new Date(Date.now()+offset*86400000);
  const day=d.toLocaleDateString([], {weekday:"short"}).toUpperCase();
  const num=d.toLocaleDateString([], {day:"2-digit"});
  return {day:offset===0?"TODAY":day,num};
}
function kickoffLabel(match){
  if(isLiveMatch(match)) return match.minute ? String(match.minute).includes("'") ? match.minute : `${match.minute}'` : "LIVE";
  const code=String(match.statusCode||match.status||"").toUpperCase();
  if(["FT","AET","PEN","FINISHED"].includes(code)) return "FT";
  if(!match.kickoff) return code||"—";
  const d=new Date(match.kickoff);
  if(Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
}
function isFinished(match){return ["FT","AET","PEN","FINISHED"].includes(String(match.statusCode||match.status||"").toUpperCase());}
function isUpcoming(match){
  if(isLiveMatch(match)||isFinished(match)) return false;
  const t=match.kickoff?new Date(match.kickoff).getTime():NaN;
  return !Number.isFinite(t)||t>Date.now();
}
function TeamLogo({uri}){
  return uri ? <Image source={{uri}} resizeMode="contain" style={s.teamLogo} fadeDuration={0}/> : <View style={s.logoFallback}><Ionicons name="football-outline" size={14} color={C.muted}/></View>;
}
function LeagueLogo({uri}){
  return uri ? <Image source={{uri}} resizeMode="contain" style={s.leagueLogo} fadeDuration={0}/> : <View style={s.leagueLogoFallback}><Ionicons name="trophy-outline" size={13} color={C.text2}/></View>;
}

const MatchRow=memo(function MatchRow({match,onOpen}){
  const live=isLiveMatch(match);
  const finished=isFinished(match);
  const hasScore=match.homeScore!==null&&match.homeScore!==undefined&&match.awayScore!==null&&match.awayScore!==undefined;
  return <Pressable style={s.matchRow} onPress={()=>onOpen?.(match)} android_ripple={{color:"rgba(255,255,255,.028)"}}>
    <View style={s.timeCol}>
      <Text style={[s.timeText,live&&s.timeLive,finished&&s.timeFinished]}>{kickoffLabel(match)}</Text>
      {live?<View style={s.livePulse}/>:null}
    </View>
    <View style={s.fixtureCol}>
      <View style={s.teamLine}><TeamLogo uri={match.home?.logo}/><Text numberOfLines={1} style={s.teamName}>{match.home?.name||"Home"}</Text><Text style={[s.score,live&&s.scoreLive]}>{hasScore?match.homeScore:""}</Text></View>
      <View style={s.teamLine}><TeamLogo uri={match.away?.logo}/><Text numberOfLines={1} style={s.teamName}>{match.away?.name||"Away"}</Text><Text style={[s.score,live&&s.scoreLive]}>{hasScore?match.awayScore:""}</Text></View>
    </View>
    <Ionicons name="chevron-forward" size={14} color={C.muted2}/>
  </Pressable>;
});

export default function HomeScreen({openMatch,openNotifications,openSearch}){
  const [offset,setOffset]=useState(0);
  const [filter,setFilter]=useState("ALL");
  const date=bangkokDate(offset);
  const [state,setState]=useState(()=>{const saved=peekFastFootballMatches(date);return {loading:!saved,refreshing:false,error:"",matches:saved?.matches||[]};});

  const load=useCallback(async(force=false,silent=false)=>{
    const saved=peekFastFootballMatches(date);
    if(!silent) setState((p)=>({...p,loading:!force&&!saved&&!p.matches.length,refreshing:force,error:"",matches:saved?.matches||p.matches}));
    try{
      const result=await fetchFastFootballMatches({date,force});
      setState({loading:false,refreshing:false,error:"",matches:result.matches||[]});
    }catch(e){setState((p)=>({...p,loading:false,refreshing:false,error:e?.message||"Could not update matches."}));}
  },[date]);

  useEffect(()=>{load(false,false);},[load]);
  useEffect(()=>{prefetchFastFootballMatches([bangkokDate(-1),bangkokDate(0),bangkokDate(1)]);},[]);
  useEffect(()=>{const timer=setInterval(()=>{if(offset===0)load(true,true);},15000);return()=>clearInterval(timer);},[load,offset]);

  const filtered=useMemo(()=>state.matches.filter((m)=>filter==="ALL"?true:filter==="LIVE"?isLiveMatch(m):filter==="UPCOMING"?isUpcoming(m):isFinished(m)),[state.matches,filter]);
  const sections=useMemo(()=>{
    const map=new Map();
    for(const match of filtered){const key=match.competition||"Other";if(!map.has(key))map.set(key,[]);map.get(key).push(match);}
    const rows=[...map.entries()].map(([title,data])=>({title,data,logo:data[0]?.competitionLogo,country:data[0]?.country}));
    rows.sort((a,b)=>{
      const ai=POPULAR.findIndex((x)=>a.title.includes(x)); const bi=POPULAR.findIndex((x)=>b.title.includes(x));
      const av=ai===-1?999:ai,bv=bi===-1?999:bi;
      return av-bv||a.title.localeCompare(b.title);
    });
    return rows;
  },[filtered]);
  const liveCount=useMemo(()=>state.matches.filter(isLiveMatch).length,[state.matches]);

  const header=<>
    <View style={s.topbar}>
      <View><Text style={s.brand}><Text style={s.brandMst}>MST</Text> Score</Text><Text style={s.tagline}>LIVE FOOTBALL · MYANMAR SPORTS TALK</Text></View>
      <View style={s.topActions}>
        {liveCount>0?<View style={s.liveChip}><View style={s.liveChipDot}/><Text style={s.liveChipText}>{liveCount} LIVE</Text></View>:null}
        <Pressable hitSlop={8} style={s.iconButton} onPress={openNotifications}><Ionicons name="notifications-outline" size={23} color={C.text}/></Pressable>
        <Pressable hitSlop={8} style={s.iconButton} onPress={openSearch}><Ionicons name="search-outline" size={25} color={C.text}/></Pressable>
      </View>
    </View>

    <View style={s.dateBar}>
      <Pressable style={s.dateArrow} onPress={()=>setOffset((v)=>Math.max(-1,v-1))}><Ionicons name="chevron-back" size={18} color={offset===-1?C.muted2:C.text2}/></Pressable>
      {[-1,0,1].map((x)=>{const d=dayMeta(x);return <Pressable key={x} style={[s.dateTab,offset===x&&s.dateTabOn]} onPress={()=>setOffset(x)}><Text style={[s.dateDay,offset===x&&s.dateDayOn]}>{d.day}</Text><Text style={[s.dateNum,offset===x&&s.dateNumOn]}>{d.num}</Text></Pressable>;})}
      <Pressable style={s.dateArrow} onPress={()=>setOffset((v)=>Math.min(1,v+1))}><Ionicons name="chevron-forward" size={18} color={offset===1?C.muted2:C.text2}/></Pressable>
    </View>

    <View style={s.filterBar}>{FILTERS.map((x)=><Pressable key={x} style={[s.filter,filter===x&&s.filterOn]} onPress={()=>setFilter(x)}><Text style={[s.filterText,filter===x&&s.filterTextOn]}>{x}</Text>{x==="LIVE"&&liveCount>0?<View style={[s.filterBadge,filter===x&&s.filterBadgeOn]}><Text style={[s.filterBadgeText,filter===x&&{color:C.red}]}>{liveCount}</Text></View>:null}</Pressable>)}</View>

    <View style={s.listSummary}>
      <Text style={s.listSummaryTitle}>{offset===0&&filter==="ALL"?"TODAY'S MATCHES":filter}</Text>
      <View style={s.summaryRight}>{state.loading?<ActivityIndicator size="small" color={C.red}/>:null}<Text style={s.matchCount}>{filtered.length} matches</Text></View>
    </View>
    {state.error?<Pressable style={s.errorStrip} onPress={()=>load(true,false)}><Ionicons name="refresh-outline" size={15} color={C.red}/><Text style={s.errorText}>Scores delayed · tap to retry</Text></Pressable>:null}
  </>;

  return <View style={s.screen}>
    <SectionList
      sections={sections}
      keyExtractor={(item)=>String(item.id)}
      renderItem={({item})=><MatchRow match={item} onOpen={openMatch}/>} 
      renderSectionHeader={({section})=><View style={s.leagueHeader}><LeagueLogo uri={section.logo}/><View style={s.leagueTextWrap}><Text numberOfLines={1} style={s.leagueTitle}>{section.title}</Text>{section.country?<Text numberOfLines={1} style={s.leagueCountry}>{section.country}</Text>:null}</View><Text style={s.leagueCount}>{section.data.length}</Text><Ionicons name="chevron-forward" size={14} color={C.muted2}/></View>}
      ListHeaderComponent={header}
      ListEmptyComponent={!state.loading?<View style={s.empty}><Ionicons name="football-outline" size={25} color={C.muted}/><Text style={s.emptyTitle}>No matches here</Text><Text style={s.emptyText}>Try another date or filter.</Text></View>:<View style={s.empty}><ActivityIndicator color={C.red}/><Text style={s.emptyText}>Updating matches…</Text></View>}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={()=>load(true,false)} colors={[C.red]} tintColor={C.red}/>} 
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.listContent}
      initialNumToRender={18}
      maxToRenderPerBatch={14}
      updateCellsBatchingPeriod={16}
      windowSize={8}
      removeClippedSubviews
    />
  </View>;
}

const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},listContent:{paddingBottom:18},
  topbar:{minHeight:82,paddingHorizontal:15,paddingTop:8,paddingBottom:8,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  brand:{fontSize:27,fontWeight:"900",letterSpacing:-1.1,color:C.text},brandMst:{color:C.red,fontStyle:"italic"},tagline:{fontSize:7.8,fontWeight:"800",letterSpacing:.7,color:C.muted,marginTop:3},
  topActions:{flexDirection:"row",alignItems:"center",gap:3},iconButton:{width:38,height:38,alignItems:"center",justifyContent:"center"},liveChip:{height:25,paddingHorizontal:8,borderRadius:13,backgroundColor:C.redSoft,flexDirection:"row",alignItems:"center",gap:5,marginRight:1},liveChipDot:{width:6,height:6,borderRadius:3,backgroundColor:C.red},liveChipText:{fontSize:8,fontWeight:"900",color:C.red},
  dateBar:{height:58,marginHorizontal:12,backgroundColor:C.panel,borderRadius:12,borderWidth:1,borderColor:C.border,flexDirection:"row",alignItems:"stretch",overflow:"hidden"},dateArrow:{width:32,alignItems:"center",justifyContent:"center"},dateTab:{flex:1,alignItems:"center",justifyContent:"center",position:"relative"},dateTabOn:{backgroundColor:C.redSoft},dateDay:{fontSize:8.1,fontWeight:"800",color:C.muted},dateDayOn:{color:C.red},dateNum:{fontSize:15,fontWeight:"900",color:C.text2,marginTop:2},dateNumOn:{color:C.text},
  filterBar:{height:48,paddingHorizontal:13,flexDirection:"row",alignItems:"center",gap:7},filter:{height:30,paddingHorizontal:12,borderRadius:15,backgroundColor:C.panel,borderWidth:1,borderColor:C.border,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5},filterOn:{backgroundColor:C.red,borderColor:C.red},filterText:{fontSize:8.5,fontWeight:"900",color:C.muted},filterTextOn:{color:C.text},filterBadge:{minWidth:17,height:17,borderRadius:9,paddingHorizontal:4,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},filterBadgeOn:{backgroundColor:C.text},filterBadgeText:{fontSize:7.5,fontWeight:"900",color:C.text2},
  listSummary:{height:42,paddingHorizontal:15,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderTopWidth:1,borderBottomWidth:1,borderColor:C.border2},listSummaryTitle:{fontSize:10.8,fontWeight:"900",color:C.text2,letterSpacing:.2},summaryRight:{flexDirection:"row",alignItems:"center",gap:7},matchCount:{fontSize:9.2,color:C.muted},
  errorStrip:{marginHorizontal:12,marginTop:7,minHeight:33,borderRadius:8,backgroundColor:C.panel,borderWidth:1,borderColor:C.border,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6},errorText:{fontSize:9,color:C.muted},
  leagueHeader:{height:43,marginHorizontal:12,marginTop:8,paddingHorizontal:10,backgroundColor:C.card2,borderTopLeftRadius:10,borderTopRightRadius:10,borderWidth:1,borderBottomWidth:0,borderColor:C.border,flexDirection:"row",alignItems:"center",gap:8},leagueLogo:{width:23,height:23},leagueLogoFallback:{width:23,height:23,borderRadius:7,backgroundColor:C.panel,alignItems:"center",justifyContent:"center"},leagueTextWrap:{flex:1},leagueTitle:{fontSize:10.5,fontWeight:"900",color:C.text},leagueCountry:{fontSize:7.8,color:C.muted,marginTop:1},leagueCount:{fontSize:8.5,fontWeight:"800",color:C.muted},
  matchRow:{minHeight:62,marginHorizontal:12,paddingHorizontal:9,flexDirection:"row",alignItems:"center",backgroundColor:C.card,borderLeftWidth:1,borderRightWidth:1,borderBottomWidth:1,borderColor:C.border},timeCol:{width:45,alignItems:"flex-start",justifyContent:"center",gap:4},timeText:{fontSize:9.2,fontWeight:"900",color:C.muted},timeLive:{color:C.red},timeFinished:{color:C.text2},livePulse:{width:5,height:5,borderRadius:3,backgroundColor:C.red},fixtureCol:{flex:1,paddingVertical:5},teamLine:{height:25,flexDirection:"row",alignItems:"center",gap:7},teamLogo:{width:20,height:20},logoFallback:{width:20,height:20,borderRadius:10,backgroundColor:C.panel,alignItems:"center",justifyContent:"center"},teamName:{flex:1,fontSize:11,fontWeight:"700",color:C.text2},score:{width:24,textAlign:"right",fontSize:13,fontWeight:"900",color:C.text},scoreLive:{color:C.text},
  empty:{minHeight:180,alignItems:"center",justifyContent:"center",gap:6},emptyTitle:{fontSize:12,fontWeight:"800",color:C.text2},emptyText:{fontSize:9.5,color:C.muted}
});