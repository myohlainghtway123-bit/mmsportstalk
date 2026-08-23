import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getAuthStatus, getFavorites, normalizeFavoritePayload, setFavorite } from "../services/accountApi";
import { loadOnboardingPreferences, saveOnboardingPreferences, syncStoredOnboardingFavorites } from "../services/onboardingStore";
import { CURATED_FAVORITE_COMPETITIONS, CURATED_FAVORITE_PLAYERS, CURATED_FAVORITE_TEAMS, favoriteMetadata } from "../services/favoriteCatalog";

const C={bg:"#080A0C",card:"#111416",card2:"#15191C",border:"#24292D",border2:"#1D2226",red:"#F3262D",redSoft:"rgba(243,38,45,.14)",text:"#FFFFFF",text2:"#D0D2D4",muted:"#92979B",green:"#31C674"};
const TABS=["Leagues","Teams","Players"];

function kindForTab(tab){return tab==="Leagues"?"competition":tab==="Players"?"player":"team";}
function keyForKind(kind){return kind==="competition"?"competitions":kind==="player"?"players":"teams";}
function catalogForKind(kind){return kind==="competition"?CURATED_FAVORITE_COMPETITIONS:kind==="player"?CURATED_FAVORITE_PLAYERS:CURATED_FAVORITE_TEAMS;}
function entityFromFavorite(item,kind){const nested=item?.[kind]||item?.team||item?.player||item?.competition||item?.league||item?.entity||item||{};const id=nested?.id??item?.entityId??item?.teamId??item?.playerId??item?.competitionId??item?.id;const curated=favoriteMetadata(kind,id);return{id,name:nested?.name||nested?.title||item?.name||item?.displayName||curated?.name||"Favorite",logo:nested?.logo||nested?.photo||nested?.image||item?.imageUrl||item?.logo||item?.photo||curated?.imageUrl||curated?.logo||curated?.photo||null,country:item?.country||nested?.country||curated?.country||null,raw:item};}
function Logo({uri,kind}){return uri?<Image source={{uri}} resizeMode="contain" style={s.logo}/>:<View style={s.logoFallback}><Ionicons name={kind==="competition"?"trophy-outline":kind==="player"?"person-outline":"shield-outline"} size={20} color={C.muted}/></View>;}
function Empty({icon,title,text,action,onAction}){return <View style={s.empty}><Ionicons name={icon} size={30} color={C.muted}/><Text style={s.emptyTitle}>{title}</Text>{text?<Text style={s.emptyText}>{text}</Text>:null}{action&&onAction?<Pressable style={s.primary} onPress={onAction}><Text style={s.primaryText}>{action}</Text></Pressable>:null}</View>;}
function FavoriteRow({entity,kind,onOpen,onRemove,busy}){return <Pressable disabled={busy} style={s.row} onPress={()=>onOpen?.(entity)}><Logo uri={entity.logo} kind={kind}/><View style={s.rowCopy}><Text numberOfLines={1} style={s.rowTitle}>{entity.name}</Text><Text numberOfLines={1} style={s.rowSub}>{entity.country|| (kind==="competition"?"Competition":kind==="player"?"Player":"Team")}</Text></View>{busy?<ActivityIndicator size="small" color={C.red}/>:<Pressable hitSlop={10} onPress={()=>onRemove(entity)}><Ionicons name="star" size={21} color={C.red}/></Pressable>}</Pressable>;}
function SuggestionRow({entity,kind,onAdd,busy}){return <View style={s.row}><Logo uri={entity.imageUrl||entity.logo||entity.photo} kind={kind}/><View style={s.rowCopy}><Text numberOfLines={1} style={s.rowTitle}>{entity.name}</Text><Text numberOfLines={1} style={s.rowSub}>{entity.country|| (kind==="competition"?"Competition":kind==="player"?"Player":"Team")}</Text></View>{busy?<ActivityIndicator size="small" color={C.red}/>:<Pressable style={s.add} onPress={()=>onAdd(entity)}><Ionicons name="add" size={16} color={C.text}/><Text style={s.addText}>ADD</Text></Pressable>}</View>;}

export default function FavoritesScreenV2({openLeague,openTeam,openPlayer,openAccount,language="my"}){
  const my=language!=="en";
  const [tab,setTab]=useState("Teams");
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [auth,setAuth]=useState(false);
  const [favorites,setFavorites]=useState({competitions:[],teams:[],players:[]});
  const [localPrefs,setLocalPrefs]=useState({teams:[],competitions:[],favoritesSynced:false});
  const [busyId,setBusyId]=useState("");
  const [error,setError]=useState("");

  const localPayload=useCallback((prefs)=>({
    teams:(prefs?.teams||[]).map((id)=>favoriteMetadata("team",id)).filter(Boolean),
    competitions:(prefs?.competitions||[]).map((id)=>favoriteMetadata("competition",id)).filter(Boolean),
    players:[],
  }),[]);

  const load=useCallback(async(refresh=false)=>{
    refresh?setRefreshing(true):setLoading(true);setError("");
    try{
      const prefs=await loadOnboardingPreferences();
      setLocalPrefs(prefs);
      const status=await getAuthStatus().catch(()=>({authenticated:false}));
      setAuth(Boolean(status.authenticated));
      if(status.authenticated){
        await syncStoredOnboardingFavorites(setFavorite).catch(()=>false);
        const payload=await getFavorites();
        setFavorites(normalizeFavoritePayload(payload));
      }else setFavorites(localPayload(prefs));
    }catch(e){setError(e?.message||"Could not load favorites.");}
    finally{setLoading(false);setRefreshing(false);}
  },[localPayload]);

  useEffect(()=>{load(false);},[load]);

  const kind=kindForTab(tab),key=keyForKind(kind);
  const rows=useMemo(()=>(favorites[key]||[]).map((item)=>entityFromFavorite(item,kind)).filter((item)=>item.id),[favorites,key,kind]);
  const favoriteIds=useMemo(()=>new Set(rows.map((item)=>String(item.id))),[rows]);
  const suggestions=useMemo(()=>catalogForKind(kind).filter((item)=>!favoriteIds.has(String(item.id))).slice(0,10),[favoriteIds,kind]);
  const open=kind==="competition"?openLeague:kind==="player"?openPlayer:openTeam;

  const saveLocal=async(entity,active)=>{
    if(kind==="player") { openAccount?.(); return; }
    const prefs=await loadOnboardingPreferences();
    const field=kind==="competition"?"competitions":"teams";
    const id=String(entity.id),current=(prefs[field]||[]).map(String);
    const next=active?[...new Set([...current,id])]:current.filter((value)=>value!==id);
    const saved=await saveOnboardingPreferences({[field]:next,favoritesSynced:false});
    setLocalPrefs(saved);
    setFavorites(localPayload(saved));
  };

  const mutate=async(entity,active)=>{
    setBusyId(`${kind}:${entity.id}`);setError("");
    try{
      if(!auth){await saveLocal(entity,active);return;}
      const payload=await setFavorite({kind,id:entity.id,name:entity.name,imageUrl:entity.logo||entity.imageUrl||entity.photo,country:entity.country,active});
      const normalized=normalizeFavoritePayload(payload);
      if((normalized.teams.length+normalized.competitions.length+normalized.players.length)>0||!active)setFavorites(normalized);
      else await load(true);
    }catch(e){setError(e?.message||"Could not update favorite.");}
    finally{setBusyId("");}
  };

  return <View style={s.screen}>
    <View style={s.header}><View><Text style={s.title}>{my?"အကြိုက်ဆုံး":"Favorites"}</Text><Text style={s.subtitle}>{auth?(my?"MST account နှင့် sync လုပ်ထားသည်":"Synced with your MST account"):(my?"ဒီဖုန်းတွင် သိမ်းထားသည် · Sign in လုပ်လျှင် sync မည်":"Saved on this device · sign in to sync")}</Text></View><Ionicons name="star" size={27} color={C.red}/></View>
    <View style={s.tabs}>{TABS.map((item)=><Pressable key={item} style={[s.tab,tab===item&&s.tabOn]} onPress={()=>setTab(item)}><Text style={[s.tabText,tab===item&&s.tabTextOn]}>{item}</Text></Pressable>)}</View>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)} colors={[C.red]} tintColor={C.red}/>} showsVerticalScrollIndicator={false}>
      {!auth?<Pressable style={s.syncCard} onPress={openAccount}><Ionicons name="cloud-upload-outline" size={21} color={C.red}/><View style={{flex:1}}><Text style={s.syncTitle}>{my?"Favorites ကို account နှင့် sync လုပ်ရန်":"Sync Favorites with your account"}</Text><Text style={s.syncText}>{my?"Sign in လုပ်ပြီး website နဲ့ app နှစ်ခုလုံးမှာ တူတူသုံးပါ။":"Sign in once to keep website and app favorites together."}</Text></View><Ionicons name="chevron-forward" size={18} color={C.muted}/></Pressable>:null}
      {error?<Text style={s.error}>{error}</Text>:null}
      {loading?<View style={s.loading}><ActivityIndicator color={C.red}/><Text style={s.loadingText}>Loading favorites…</Text></View>:<>
        <View style={s.sectionHead}><Text style={s.sectionTitle}>{my?"ရွေးထားသည်":"MY FAVORITES"}</Text><Text style={s.count}>{rows.length}</Text></View>
        {rows.length?<View style={s.card}>{rows.map((entity,index)=><View key={String(entity.id)} style={index!==rows.length-1?s.divider:null}><FavoriteRow entity={entity} kind={kind} onOpen={open} onRemove={(item)=>mutate(item,false)} busy={busyId===`${kind}:${entity.id}`}/></View>)}</View>:<Empty icon="star-outline" title={my?"မရွေးရသေးပါ":"No favorites yet"} text={kind==="player"&&!auth?(my?"Player favorites ကို account ဝင်ပြီး သိမ်းနိုင်သည်။":"Sign in to save player favorites across devices."):(my?"အောက်က Suggested ထဲကနေရွေးပါ။":"Add some from Suggested below.")} action={kind==="player"&&!auth?(my?"SIGN IN":"SIGN IN"):null} onAction={openAccount}/>} 
        <View style={s.sectionHead}><Text style={s.sectionTitle}>{my?"အကြံပြုထားသည်":"SUGGESTED"}</Text></View>
        {suggestions.length?<View style={s.card}>{suggestions.map((entity,index)=><View key={String(entity.id)} style={index!==suggestions.length-1?s.divider:null}><SuggestionRow entity={entity} kind={kind} onAdd={(item)=>mutate(item,true)} busy={busyId===`${kind}:${entity.id}`}/></View>)}</View>:null}
      </>}
    </ScrollView>
  </View>;
}

const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},header:{minHeight:70,paddingHorizontal:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:C.border2},title:{fontSize:22,fontWeight:"900",color:C.text},subtitle:{fontSize:9.8,color:C.muted,marginTop:3,maxWidth:280},tabs:{height:53,flexDirection:"row",padding:6,gap:5,borderBottomWidth:1,borderBottomColor:C.border2},tab:{flex:1,borderRadius:8,alignItems:"center",justifyContent:"center"},tabOn:{backgroundColor:C.redSoft},tabText:{fontSize:10,fontWeight:"800",color:C.muted},tabTextOn:{color:C.red},content:{padding:14,paddingBottom:40},syncCard:{minHeight:67,borderRadius:11,borderWidth:1,borderColor:"rgba(243,38,45,.32)",backgroundColor:C.redSoft,padding:11,flexDirection:"row",alignItems:"center",gap:9,marginBottom:8},syncTitle:{fontSize:11.2,fontWeight:"900",color:C.text2},syncText:{fontSize:8.8,color:C.muted,marginTop:3,lineHeight:13},error:{fontSize:9.8,color:C.red,textAlign:"center",paddingVertical:8},loading:{minHeight:130,alignItems:"center",justifyContent:"center",gap:9},loadingText:{fontSize:10,color:C.muted},sectionHead:{minHeight:42,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},sectionTitle:{fontSize:10.5,fontWeight:"900",letterSpacing:.4,color:C.text2},count:{fontSize:10,fontWeight:"900",color:C.red},card:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,overflow:"hidden"},divider:{borderBottomWidth:1,borderBottomColor:C.border2},row:{minHeight:61,paddingHorizontal:12,paddingVertical:8,flexDirection:"row",alignItems:"center",gap:10},logo:{width:38,height:38},logoFallback:{width:38,height:38,borderRadius:10,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},rowCopy:{flex:1,minWidth:0},rowTitle:{fontSize:12.3,fontWeight:"800",color:C.text2},rowSub:{fontSize:8.8,color:C.muted,marginTop:3},add:{height:31,borderRadius:8,backgroundColor:C.red,flexDirection:"row",alignItems:"center",gap:3,paddingHorizontal:9},addText:{fontSize:8.2,fontWeight:"900",color:C.text},empty:{minHeight:130,borderWidth:1,borderColor:C.border2,borderRadius:11,backgroundColor:C.card,alignItems:"center",justifyContent:"center",padding:16,gap:7},emptyTitle:{fontSize:12.5,fontWeight:"800",color:C.text2},emptyText:{fontSize:9.5,lineHeight:14,color:C.muted,textAlign:"center",maxWidth:260},primary:{minHeight:36,borderRadius:8,backgroundColor:C.red,paddingHorizontal:14,alignItems:"center",justifyContent:"center",marginTop:3},primaryText:{fontSize:9,fontWeight:"900",color:C.text}
});
