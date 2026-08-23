import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { isLiveMatch } from "../services/footballApi";
import { fetchFastFootballMatches, peekFastFootballMatches, prefetchFastFootballMatches } from "../services/fastFootballApi";

const C={bg:"#07090B",panel:"#0D1013",card:"#111519",card2:"#151A1F",border:"#20262C",border2:"#181D22",red:"#F32735",redSoft:"rgba(243,39,53,.12)",text:"#F7F8F9",text2:"#D7DBDF",muted:"#858C93",muted2:"#5F666D",green:"#25C875"};
const FILTERS=["ALL","LIVE","UPCOMING","FINISHED"];
const DATE_OFFSETS=Array.from({length:14},(_,i)=>i-3);
const POPULAR=["Premier League","Champions League","Europa League","LaLiga","La Liga","Serie A","Bundesliga","Ligue 1"];

const MAJOR_COMPETITIONS=[
  [/(world cup|euro championship|uefa euro|copa america|champions league|club world cup)/i,120],
  [/(premier league|la ?liga|serie a|bundesliga|ligue 1)/i,90],
  [/(europa league)/i,80],
  [/(conference league)/i,65],
  [/(fa cup|copa del rey|coppa italia|dfb pokal|coupe de france)/i,58],
];
const BIG_TEAMS=[
  "real madrid","barcelona","atletico madrid","manchester united","man utd","manchester city","man city","liverpool","arsenal","chelsea","tottenham","spurs","bayern munich","bayern münchen","borussia dortmund","dortmund","paris saint germain","paris saint-germain","psg","juventus","inter","inter milan","internazionale","ac milan","milan","napoli","roma","benfica","porto","sporting cp","ajax","feyenoord","celtic","rangers",
  "argentina","brazil","england","france","spain","germany","portugal","italy","netherlands","belgium","croatia","uruguay","japan","south korea"
];
const ELITE_TEAMS=["real madrid","barcelona","manchester united","man utd","manchester city","man city","liverpool","arsenal","chelsea","bayern munich","bayern münchen","paris saint germain","paris saint-germain","psg","juventus","inter","inter milan","ac milan","milan","argentina","brazil","england","france","spain","germany","portugal","italy"];

function normalizedName(value){return String(value||"").trim().toLowerCase();}
function containsTeam(name,list){const n=normalizedName(name);return list.some((team)=>n===team||n.includes(team));}
function competitionWeight(name){for(const [pattern,score] of MAJOR_COMPETITIONS)if(pattern.test(String(name||"")))return score;return 0;}
function matchPriorityScore(match){
  let score=competitionWeight(match?.competition);
  const home=match?.home?.name,away=match?.away?.name;
  const bigHome=containsTeam(home,BIG_TEAMS),bigAway=containsTeam(away,BIG_TEAMS);
  const eliteHome=containsTeam(home,ELITE_TEAMS),eliteAway=containsTeam(away,ELITE_TEAMS);
  if(bigHome)score+=38;if(bigAway)score+=38;
  if(eliteHome)score+=18;if(eliteAway)score+=18;
  if(bigHome&&bigAway)score+=115;
  if(eliteHome&&eliteAway)score+=55;
  if(isLiveMatch(match))score+=12;
  return score;
}
function kickoffTime(match){const t=match?.kickoff?new Date(match.kickoff).getTime():Number.MAX_SAFE_INTEGER;return Number.isFinite(t)?t:Number.MAX_SAFE_INTEGER;}
function importantMatchSort(a,b){return matchPriorityScore(b)-matchPriorityScore(a)||kickoffTime(a)-kickoffTime(b)||String(a?.home?.name||"").localeCompare(String(b?.home?.name||""));}

function bangkokDate(offset=0){const date=new Date(Date.now()+offset*86400000);try{const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);const map=Object.fromEntries(parts.map((p)=>[p.type,p.value]));return `${map.year}-${map.month}-${map.day}`;}catch(_){return date.toISOString().slice(0,10);}}
function dayMeta(offset,language){const d=new Date(Date.now()+offset*86400000);const day=d.toLocaleDateString([], {weekday:"short"}).toUpperCase();const num=d.toLocaleDateString([], {day:"2-digit"});const month=d.toLocaleDateString([], {month:"short"}).toUpperCase();return {day:offset===0?(language==="my"?"ယနေ့":"TODAY"):day,num,month};}
function statusCode(match){return String(match?.statusCode||match?.status||"").trim().toUpperCase();}
function kickoffLabel(match){
  const code=statusCode(match);
  if(code==="HT")return"HT";
  if(code==="P")return"PEN";
  if(code==="BT")return"BREAK";
  if(code==="SUSP"||code==="SUSPENDED")return"SUSP";
  if(code==="INT"||code==="INTERRUPTED")return"INT";
  if(code==="PST"||code==="POSTPONED")return"PST";
  if(code==="CANC"||code==="CANCELLED"||code==="CANCELED")return"CANC";
  if(code==="ABD"||code==="ABANDONED")return"ABD";
  if(code==="AET")return"AET";
  if(code==="PEN")return"PEN";
  if(code==="FT"||code==="FINISHED")return"FT";
  if(isLiveMatch(match)){
    const elapsed=Number(match?.elapsed);
    if(Number.isFinite(elapsed)&&elapsed>=0)return`${elapsed}'`;
    const minute=String(match?.minute||"").trim();
    if(/^\d+(?:\+\d+)?'?$/.test(minute))return minute.endsWith("'")?minute:`${minute}'`;
    return code&&code!=="NS"?code:"LIVE";
  }
  if(!match?.kickoff)return code||"—";
  const d=new Date(match.kickoff);if(Number.isNaN(d.getTime()))return"—";
  return d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
}
function isFinished(match){return["FT","AET","PEN","FINISHED"].includes(statusCode(match));}
function isUpcoming(match){if(isLiveMatch(match)||isFinished(match))return false;const t=match.kickoff?new Date(match.kickoff).getTime():NaN;return!Number.isFinite(t)||t>Date.now();}
function TeamLogo({uri}){return uri?<Image source={{uri}} resizeMode="contain" style={s.teamLogo} fadeDuration={0}/>:<View style={s.logoFallback}><Ionicons name="football-outline" size={14} color={C.muted}/></View>;}
function LeagueLogo({uri}){return uri?<Image source={{uri}} resizeMode="contain" style={s.leagueLogo} fadeDuration={0}/>:<View style={s.leagueLogoFallback}><Ionicons name="trophy-outline" size={13} color={C.text2}/></View>;}

const MatchRow=memo(function MatchRow({match,onOpen}){const live=isLiveMatch(match),finished=isFinished(match),scoreExpected=live||finished||match.homeScore!=null||match.awayScore!=null;return <Pressable style={s.matchRow} onPress={()=>onOpen?.(match)} android_ripple={{color:"rgba(255,255,255,.028)"}}><View style={s.timeCol}><Text style={[s.timeText,live&&s.timeLive,finished&&s.timeFinished]}>{kickoffLabel(match)}</Text>{live?<View style={s.livePulse}/>:null}</View><View style={s.fixtureCol}><View style={s.teamLine}><TeamLogo uri={match.home?.logo}/><Text numberOfLines={1} style={s.teamName}>{match.home?.name||"Home"}</Text><Text style={[s.score,live&&s.scoreLive]}>{match.homeScore!=null?match.homeScore:scoreExpected?"—":""}</Text></View><View style={s.teamLine}><TeamLogo uri={match.away?.logo}/><Text numberOfLines={1} style={s.teamName}>{match.away?.name||"Away"}</Text><Text style={[s.score,live&&s.scoreLive]}>{match.awayScore!=null?match.awayScore:scoreExpected?"—":""}</Text></View></View><Ionicons name="chevron-forward" size={14} color={C.muted2}/></Pressable>;});

export default function HomeScreen({openMatch,openNotifications,openSearch,language="my"}){
  const my=language==="my";
  const [offset,setOffset]=useState(0);
  const [filter,setFilter]=useState("ALL");
  const [competition,setCompetition]=useState("ALL");
  const [leagueOpen,setLeagueOpen]=useState(false);
  const [leagueSearch,setLeagueSearch]=useState("");
  const date=bangkokDate(offset);
  const [state,setState]=useState(()=>{const saved=peekFastFootballMatches(date);return{loading:!saved,refreshing:false,error:"",matches:saved?.matches||[]};});

  const load=useCallback(async(force=false,silent=false)=>{const saved=peekFastFootballMatches(date);if(!silent)setState((p)=>({...p,loading:!force&&!saved&&!p.matches.length,refreshing:force,error:"",matches:saved?.matches||p.matches}));try{const result=await fetchFastFootballMatches({date,force});setState({loading:false,refreshing:false,error:"",matches:result.matches||[]});}catch(e){setState((p)=>({...p,loading:false,refreshing:false,error:e?.message||"Could not update matches."}));}},[date]);

  useEffect(()=>{setFilter("ALL");setCompetition("ALL");},[date]);
  useEffect(()=>{const saved=peekFastFootballMatches(date);setState({loading:!saved,refreshing:false,error:"",matches:saved?.matches||[]});load(false,false);},[date,load]);
  useEffect(()=>{prefetchFastFootballMatches([bangkokDate(offset-1),bangkokDate(offset),bangkokDate(offset+1)]);},[offset]);
  useEffect(()=>{const timer=setInterval(()=>{if(offset===0)load(true,true);},15000);return()=>clearInterval(timer);},[load,offset]);

  const liveCount=useMemo(()=>state.matches.filter(isLiveMatch).length,[state.matches]);
  const competitions=useMemo(()=>{const values=[...new Set(state.matches.map((m)=>m.competition).filter(Boolean))];return values.sort((a,b)=>{const ai=POPULAR.findIndex((x)=>String(a).includes(x)),bi=POPULAR.findIndex((x)=>String(b).includes(x));return(ai===-1?999:ai)-(bi===-1?999:bi)||String(a).localeCompare(String(b));});},[state.matches]);
  const visibleCompetitions=useMemo(()=>{const q=leagueSearch.trim().toLowerCase();return q?competitions.filter((x)=>String(x).toLowerCase().includes(q)):competitions;},[competitions,leagueSearch]);
  const filtered=useMemo(()=>state.matches.filter((m)=>{const statusOk=filter==="ALL"?true:filter==="LIVE"?isLiveMatch(m):filter==="UPCOMING"?isUpcoming(m):isFinished(m);const leagueOk=competition==="ALL"||m.competition===competition;return statusOk&&leagueOk;}),[state.matches,filter,competition]);
  const sections=useMemo(()=>{const map=new Map();for(const match of filtered){const key=match.competition||"Other";if(!map.has(key))map.set(key,[]);map.get(key).push(match);}const rows=[...map.entries()].map(([title,data])=>{const ordered=[...data].sort(importantMatchSort);return{title,data:ordered,logo:ordered[0]?.competitionLogo,country:ordered[0]?.country,priority:ordered.length?matchPriorityScore(ordered[0]):0};});rows.sort((a,b)=>b.priority-a.priority||competitionWeight(b.title)-competitionWeight(a.title)||a.title.localeCompare(b.title));return rows;},[filtered]);
  const filterLabel=(value)=>my?({ALL:"အားလုံး",LIVE:"တိုက်ရိုက်",UPCOMING:"လာမည့်ပွဲ",FINISHED:"ပြီးဆုံး"}[value]||value):value;

  const header=<>
    <View style={s.topbar}><View><Text style={s.brand}><Text style={s.brandMst}>MST</Text> Score</Text><Text style={s.tagline}>{my?"တိုက်ရိုက်ဘောလုံး · MYANMAR SPORTS TALK":"LIVE FOOTBALL · MYANMAR SPORTS TALK"}</Text></View><View style={s.topActions}>{liveCount>0?<View style={s.liveChip}><View style={s.liveChipDot}/><Text style={s.liveChipText}>{liveCount} LIVE</Text></View>:null}<Pressable hitSlop={8} style={s.iconButton} onPress={openNotifications}><Ionicons name="notifications-outline" size={23} color={C.text}/></Pressable><Pressable hitSlop={8} style={s.iconButton} onPress={openSearch}><Ionicons name="search-outline" size={25} color={C.text}/></Pressable></View></View>

    <View style={s.dateWrap}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateContent}>{DATE_OFFSETS.map((x)=>{const d=dayMeta(x,language);return <Pressable key={x} style={[s.dateTab,offset===x&&s.dateTabOn]} onPress={()=>setOffset(x)}><Text style={[s.dateMonth,offset===x&&s.dateDayOn]}>{d.month}</Text><Text style={[s.dateNum,offset===x&&s.dateNumOn]}>{d.num}</Text><Text style={[s.dateDay,offset===x&&s.dateDayOn]}>{d.day}</Text></Pressable>;})}</ScrollView><View style={s.calendarIcon}><Ionicons name="calendar-outline" size={20} color={C.text2}/></View></View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterBar}>{FILTERS.map((x)=><Pressable key={x} style={[s.filter,filter===x&&s.filterOn]} onPress={()=>setFilter(x)}><Text style={[s.filterText,filter===x&&s.filterTextOn]}>{filterLabel(x)}</Text>{x==="LIVE"&&liveCount>0?<View style={[s.filterBadge,filter===x&&s.filterBadgeOn]}><Text style={[s.filterBadgeText,filter===x&&{color:C.red}]}>{liveCount}</Text></View>:null}</Pressable>)}<Pressable style={[s.filter,s.leagueFilter,competition!=="ALL"&&s.leagueFilterOn]} onPress={()=>setLeagueOpen(true)}><Ionicons name="trophy-outline" size={14} color={competition!=="ALL"?C.red:C.text2}/><Text numberOfLines={1} style={[s.filterText,competition!=="ALL"&&{color:C.red}]}>{competition==="ALL"?(my?"ပြိုင်ပွဲများ":"COMPETITIONS"):competition}</Text><Ionicons name="chevron-down" size={13} color={C.muted}/></Pressable></ScrollView>

    <View style={s.listSummary}><Text style={s.listSummaryTitle}>{offset===0&&filter==="ALL"&&competition==="ALL"?(my?"ဒီနေ့ပွဲများ":"TODAY'S MATCHES"):competition!=="ALL"?competition:filterLabel(filter)}</Text><View style={s.summaryRight}>{state.loading?<ActivityIndicator size="small" color={C.red}/>:null}<Text style={s.matchCount}>{filtered.length} {my?"ပွဲ":"matches"}</Text></View></View>
    {state.error?<Pressable style={s.errorStrip} onPress={()=>load(true,false)}><Ionicons name="refresh-outline" size={15} color={C.red}/><Text style={s.errorText}>{my?"ရလဒ် update နှေးနေသည် · ပြန်စမ်းရန်နှိပ်ပါ":"Scores delayed · tap to retry"}</Text></Pressable>:null}
  </>;

  return <View style={s.screen}>
    <SectionList sections={sections} keyExtractor={(item)=>String(item.id)} renderItem={({item})=><MatchRow match={item} onOpen={openMatch}/>} renderSectionHeader={({section})=><View style={s.leagueHeader}><LeagueLogo uri={section.logo}/><View style={s.leagueTextWrap}><Text numberOfLines={1} style={s.leagueTitle}>{section.title}</Text>{section.country?<Text numberOfLines={1} style={s.leagueCountry}>{section.country}</Text>:null}</View><Text style={s.leagueCount}>{section.data.length}</Text><Ionicons name="chevron-forward" size={14} color={C.muted2}/></View>} ListHeaderComponent={header} ListEmptyComponent={!state.loading?<View style={s.empty}><Ionicons name="football-outline" size={25} color={C.muted}/><Text style={s.emptyTitle}>{my?"ပွဲမရှိသေးပါ":"No matches here"}</Text><Text style={s.emptyText}>{my?"အခြားရက် သို့မဟုတ် filter ကို စမ်းကြည့်ပါ။":"Try another date or filter."}</Text></View>:<View style={s.empty}><ActivityIndicator color={C.red}/><Text style={s.emptyText}>{my?"ပွဲများ update လုပ်နေသည်…":"Updating matches…"}</Text></View>} refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={()=>load(true,false)} colors={[C.red]} tintColor={C.red}/>} stickySectionHeadersEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent} initialNumToRender={18} maxToRenderPerBatch={14} updateCellsBatchingPeriod={16} windowSize={8} removeClippedSubviews/>

    <Modal visible={leagueOpen} transparent animationType="slide" onRequestClose={()=>setLeagueOpen(false)}><View style={s.modalBackdrop}><Pressable style={s.modalDismiss} onPress={()=>setLeagueOpen(false)}/><View style={s.sheet}><View style={s.sheetHandle}/><View style={s.sheetHead}><View><Text style={s.sheetTitle}>{my?"ပြိုင်ပွဲရွေးရန်":"Choose Competition"}</Text><Text style={s.sheetSub}>{my?"ပွဲများကို ပြိုင်ပွဲအလိုက် စစ်ထုတ်ပါ":"Filter matches by competition"}</Text></View><Pressable style={s.closeBtn} onPress={()=>setLeagueOpen(false)}><Ionicons name="close" size={22} color={C.text}/></Pressable></View><View style={s.searchBox}><Ionicons name="search-outline" size={18} color={C.muted}/><TextInput value={leagueSearch} onChangeText={setLeagueSearch} placeholder={my?"ပြိုင်ပွဲရှာရန်":"Search competitions"} placeholderTextColor={C.muted2} style={s.searchInput}/></View><ScrollView showsVerticalScrollIndicator={false}><Pressable style={[s.leagueChoice,competition==="ALL"&&s.leagueChoiceOn]} onPress={()=>{setCompetition("ALL");setLeagueOpen(false);}}><Ionicons name="apps-outline" size={20} color={competition==="ALL"?C.red:C.text2}/><Text style={[s.leagueChoiceText,competition==="ALL"&&{color:C.red}]}>{my?"ပြိုင်ပွဲအားလုံး":"All Competitions"}</Text>{competition==="ALL"?<Ionicons name="checkmark" size={20} color={C.red}/>:null}</Pressable>{visibleCompetitions.map((name)=><Pressable key={name} style={[s.leagueChoice,competition===name&&s.leagueChoiceOn]} onPress={()=>{setCompetition(name);setLeagueOpen(false);}}><Ionicons name="trophy-outline" size={20} color={competition===name?C.red:C.text2}/><Text numberOfLines={1} style={[s.leagueChoiceText,competition===name&&{color:C.red}]}>{name}</Text>{competition===name?<Ionicons name="checkmark" size={20} color={C.red}/>:null}</Pressable>)}</ScrollView></View></View></Modal>
  </View>;
}

const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},listContent:{paddingBottom:18},topbar:{minHeight:82,paddingHorizontal:15,paddingTop:8,paddingBottom:8,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},brand:{fontSize:27,fontWeight:"900",letterSpacing:-1.1,color:C.text},brandMst:{color:C.red,fontStyle:"italic"},tagline:{fontSize:8.4,fontWeight:"800",letterSpacing:.5,color:C.muted,marginTop:3},topActions:{flexDirection:"row",alignItems:"center",gap:3},iconButton:{width:44,height:44,alignItems:"center",justifyContent:"center"},liveChip:{height:27,paddingHorizontal:9,borderRadius:14,backgroundColor:C.redSoft,flexDirection:"row",alignItems:"center",gap:5,marginRight:1},liveChipDot:{width:6,height:6,borderRadius:3,backgroundColor:C.red},liveChipText:{fontSize:9,fontWeight:"900",color:C.red},
  dateWrap:{height:78,marginHorizontal:12,backgroundColor:C.panel,borderRadius:12,borderWidth:1,borderColor:C.border,flexDirection:"row",overflow:"hidden"},dateContent:{paddingHorizontal:5,alignItems:"center"},dateTab:{width:58,height:66,marginVertical:5,borderRadius:9,alignItems:"center",justifyContent:"center"},dateTabOn:{backgroundColor:C.redSoft,borderWidth:1,borderColor:"rgba(243,39,53,.25)"},dateMonth:{fontSize:8,fontWeight:"800",color:C.muted2},dateNum:{fontSize:17,fontWeight:"900",color:C.text2,marginVertical:1},dateDay:{fontSize:8,fontWeight:"900",color:C.muted},dateDayOn:{color:C.red},dateNumOn:{color:C.text},calendarIcon:{width:44,borderLeftWidth:1,borderLeftColor:C.border,alignItems:"center",justifyContent:"center",backgroundColor:C.card2},
  filterBar:{minHeight:50,paddingHorizontal:13,paddingVertical:8,gap:7,alignItems:"center"},filter:{height:34,paddingHorizontal:12,borderRadius:17,backgroundColor:C.panel,borderWidth:1,borderColor:C.border,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5},filterOn:{backgroundColor:C.red,borderColor:C.red},filterText:{fontSize:9.5,fontWeight:"900",color:C.muted},filterTextOn:{color:C.text},filterBadge:{minWidth:18,height:18,borderRadius:9,paddingHorizontal:4,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},filterBadgeOn:{backgroundColor:C.text},filterBadgeText:{fontSize:8,fontWeight:"900",color:C.text2},leagueFilter:{maxWidth:170},leagueFilterOn:{backgroundColor:C.redSoft,borderColor:"rgba(243,39,53,.35)"},
  listSummary:{height:44,paddingHorizontal:15,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderTopWidth:1,borderBottomWidth:1,borderColor:C.border2},listSummaryTitle:{flex:1,fontSize:11.7,fontWeight:"900",color:C.text2,letterSpacing:.1},summaryRight:{flexDirection:"row",alignItems:"center",gap:7},matchCount:{fontSize:10,color:C.muted},errorStrip:{marginHorizontal:12,marginTop:7,minHeight:35,borderRadius:8,backgroundColor:C.panel,borderWidth:1,borderColor:C.border,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6},errorText:{fontSize:9.7,color:C.muted},
  leagueHeader:{height:45,marginHorizontal:12,marginTop:8,paddingHorizontal:10,backgroundColor:C.card2,borderTopLeftRadius:10,borderTopRightRadius:10,borderWidth:1,borderBottomWidth:0,borderColor:C.border,flexDirection:"row",alignItems:"center",gap:8},leagueLogo:{width:23,height:23},leagueLogoFallback:{width:23,height:23,borderRadius:7,backgroundColor:C.panel,alignItems:"center",justifyContent:"center"},leagueTextWrap:{flex:1},leagueTitle:{fontSize:11.3,fontWeight:"900",color:C.text},leagueCountry:{fontSize:8.4,color:C.muted,marginTop:1},leagueCount:{fontSize:9.2,fontWeight:"800",color:C.muted},matchRow:{minHeight:68,marginHorizontal:12,paddingHorizontal:9,flexDirection:"row",alignItems:"center",backgroundColor:C.card,borderLeftWidth:1,borderRightWidth:1,borderBottomWidth:1,borderColor:C.border},timeCol:{width:49,alignItems:"flex-start",justifyContent:"center",gap:4},timeText:{fontSize:10.2,fontWeight:"900",color:C.muted},timeLive:{color:C.red},timeFinished:{color:C.text2},livePulse:{width:5,height:5,borderRadius:3,backgroundColor:C.red},fixtureCol:{flex:1,paddingVertical:6},teamLine:{height:27,flexDirection:"row",alignItems:"center",gap:7},teamLogo:{width:20,height:20},logoFallback:{width:20,height:20,borderRadius:10,backgroundColor:C.panel,alignItems:"center",justifyContent:"center"},teamName:{flex:1,fontSize:12,fontWeight:"700",color:C.text2},score:{width:30,textAlign:"right",fontSize:15,fontWeight:"900",fontVariant:["tabular-nums"],color:C.text},scoreLive:{color:C.red},empty:{minHeight:150,alignItems:"center",justifyContent:"center",gap:7,paddingHorizontal:20},emptyTitle:{fontSize:13.5,fontWeight:"800",color:C.text2},emptyText:{fontSize:10.8,color:C.muted,textAlign:"center"},
  modalBackdrop:{flex:1,backgroundColor:"rgba(0,0,0,.6)",justifyContent:"flex-end"},modalDismiss:{flex:1},sheet:{maxHeight:"72%",backgroundColor:C.panel,borderTopLeftRadius:20,borderTopRightRadius:20,borderTopWidth:1,borderColor:C.border,paddingHorizontal:14,paddingBottom:24},sheetHandle:{width:42,height:4,borderRadius:2,backgroundColor:C.muted2,alignSelf:"center",marginTop:9,marginBottom:10},sheetHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:12},sheetTitle:{fontSize:17,fontWeight:"900",color:C.text},sheetSub:{fontSize:10.2,color:C.muted,marginTop:3},closeBtn:{width:44,height:44,borderRadius:22,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},searchBox:{height:46,borderRadius:10,backgroundColor:C.card,borderWidth:1,borderColor:C.border,flexDirection:"row",alignItems:"center",paddingHorizontal:11,gap:8,marginBottom:8},searchInput:{flex:1,color:C.text,fontSize:13,paddingVertical:0},leagueChoice:{minHeight:52,borderBottomWidth:1,borderBottomColor:C.border2,flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:8},leagueChoiceOn:{backgroundColor:C.redSoft},leagueChoiceText:{flex:1,fontSize:13,fontWeight:"700",color:C.text2}
});