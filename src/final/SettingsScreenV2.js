import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { getAuthStatus, MST_SITE_URL } from "../services/accountApi";

const C={bg:"#080A0C",card:"#111416",card2:"#15191C",border:"#24292D",border2:"#1D2226",red:"#F3262D",text:"#FFFFFF",text2:"#D0D2D4",muted:"#92979B",green:"#31C674"};
function Header({goBack}){return <View style={s.header}><Pressable hitSlop={10} onPress={goBack}><Ionicons name="chevron-back" size={27} color={C.text}/></Pressable><View style={s.headerCopy}><Text style={s.title}>Settings</Text><Text style={s.subtitle}>MST Score</Text></View><View style={{width:27}}/></View>;}
function Row({icon,title,subtitle,onPress,tone=C.text2}){const content=<><View style={s.icon}><Ionicons name={icon} size={20} color={tone}/></View><View style={{flex:1}}><Text style={s.rowTitle}>{title}</Text><Text style={s.rowSub}>{subtitle}</Text></View>{onPress?<Ionicons name="chevron-forward" size={18} color={C.muted}/>:null}</>;return onPress?<Pressable style={s.row} onPress={onPress}>{content}</Pressable>:<View style={s.row}>{content}</View>;}

export default function SettingsScreenV2({goBack,openNotifications,openAccount}){
  const[auth,setAuth]=useState(null);
  useEffect(()=>{let alive=true;getAuthStatus().then((value)=>{if(alive)setAuth(value);}).catch(()=>{if(alive)setAuth({authenticated:false});});return()=>{alive=false};},[]);
  const version=Constants?.expoConfig?.version||"—";
  const build=Constants?.expoConfig?.android?.versionCode??Constants?.expoConfig?.ios?.buildNumber??"—";
  const accountText=auth===null?"Checking account…":auth?.authenticated?"Signed in · website and app share this account":"Sign in to sync favorites, predictions and alerts";
  const rows=useMemo(()=>[
    ["person-circle-outline","MST Account",accountText,openAccount,C.red],
    ["notifications-outline","Notifications","Account inbox and favorite-match preferences",openNotifications,C.text2],
    ["globe-outline","MST Website","myanmarsportstalk.com",()=>Linking.openURL(MST_SITE_URL).catch(()=>{}),C.text2],
  ],[accountText,openAccount,openNotifications]);
  return <View style={s.screen}><Header goBack={goBack}/><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}><Text style={s.section}>ACCOUNT & APP</Text><View style={s.card}>{rows.map(([icon,title,subtitle,action,tone])=><Row key={title} icon={icon} title={title} subtitle={subtitle} onPress={action} tone={tone}/>)}</View><Text style={s.section}>DATA & REFRESH</Text><View style={s.card}><Row icon="refresh-outline" title="Live football refresh" subtitle="Score screens refresh silently while open; MST server caching prevents unnecessary provider requests."/><Row icon="server-outline" title="Football data" subtitle="The app connects through the MST backend. Provider API keys are not stored in the app."/><Row icon="time-outline" title="Timezone" subtitle="Match-day lists use Asia/Bangkok for the mobile experience."/></View><Text style={s.section}>APP INFO</Text><View style={s.card}><Row icon="phone-portrait-outline" title="MST Score" subtitle={`Version ${version} · build ${build}`}/><Row icon="shield-checkmark-outline" title="Production data path" subtitle="MST backend → cached football/news/account services"/></View><Text style={s.footer}>Myanmar Sports Talk · MST Score</Text></ScrollView></View>;
}

const s=StyleSheet.create({screen:{flex:1,backgroundColor:C.bg},header:{minHeight:64,paddingHorizontal:14,flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:C.border2},headerCopy:{flex:1,paddingHorizontal:11},title:{fontSize:16,fontWeight:"900",color:C.text},subtitle:{fontSize:9.2,color:C.muted,marginTop:2},content:{padding:14,paddingBottom:40},section:{fontSize:10.5,fontWeight:"900",color:C.text2,marginTop:11,marginBottom:8},card:{backgroundColor:C.card,borderWidth:1,borderColor:C.border2,borderRadius:11,overflow:"hidden",marginBottom:8},row:{minHeight:64,paddingHorizontal:11,paddingVertical:9,flexDirection:"row",alignItems:"center",gap:9,borderBottomWidth:1,borderBottomColor:C.border2},icon:{width:35,height:35,borderRadius:9,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},rowTitle:{fontSize:11.8,fontWeight:"800",color:C.text2},rowSub:{fontSize:8.9,color:C.muted,marginTop:3,lineHeight:13},footer:{fontSize:8.8,color:C.muted,textAlign:"center",marginTop:12}});
