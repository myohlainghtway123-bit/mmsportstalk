import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  loadOwnPurchases,
  loadTipEntitlement,
  loadTips,
  loadTipsterLeaderboard,
  loadTipsters,
  loadUserLeaderboard,
} from "./scoresStagingApi";

const C = { surface:"#101417", raised:"#171C20", border:"#293036", text:"#FFFFFF", secondary:"#D4D8DB", muted:"#929AA0", red:"#F3262D", amber:"#F4C84D", green:"#48C78E" };

function arrays(value, out = [], depth = 0) {
  if (value == null || depth > 5) return out;
  if (Array.isArray(value)) {
    out.push(value);
    value.slice(0, 8).forEach((item) => arrays(item, out, depth + 1));
  } else if (typeof value === "object") Object.values(value).forEach((item) => arrays(item, out, depth + 1));
  return out;
}
function rows(payload) {
  if (Array.isArray(payload)) return payload;
  return arrays(payload).sort((a, b) => b.length - a.length)[0] || [];
}
function label(row, fallback) {
  return String(row?.displayName || row?.display_name || row?.name || row?.username || row?.title || row?.tipsterName || row?.user?.displayName || row?.user?.name || row?.tipster?.name || fallback);
}
function meta(row) {
  const parts = [
    row?.rank != null ? `#${row.rank}` : null,
    row?.points != null ? `${row.points} pts` : row?.score != null ? `${row.score} pts` : null,
    row?.accuracy != null ? `${row.accuracy}% accuracy` : null,
    row?.followers_count != null ? `${row.followers_count} followers` : null,
    row?.correct_predictions != null ? `${row.correct_predictions} correct` : null,
    row?.amountMinor != null ? `${row.amountMinor} ${row.currency || ""}`.trim() : null,
    row?.status ? String(row.status).toUpperCase() : null,
    row?.price_minor != null ? `${row.price_minor} ${row.currency || ""}`.trim() : null,
  ].filter(Boolean);
  return parts.join(" · ") || "Read-only MST data";
}

function DataList({ title, eyebrow, data, empty }) {
  const list = rows(data).slice(0, 8);
  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text style={s.title}>{title}</Text>
      {list.length ? list.map((row, index) => (
        <View key={String(row?.id || row?.user_id || row?.userId || row?.tipsterId || `${title}-${index}`)} style={[s.row, index > 0 && s.rowBorder]}>
          <Text style={s.rank}>{row?.rank != null ? `#${row.rank}` : `${index + 1}`}</Text>
          <View style={s.flex}><Text numberOfLines={1} style={s.name}>{label(row, `Item ${index + 1}`)}</Text><Text numberOfLines={1} style={s.meta}>{meta(row)}</Text></View>
          {row?.selection ? <Text numberOfLines={1} style={s.selection}>{String(row.selection)}</Text> : null}
        </View>
      )) : <Text style={s.empty}>{empty}</Text>}
    </View>
  );
}

async function entitledPurchaseRows(purchases, tips) {
  const paid = (Array.isArray(purchases) ? purchases : [])
    .filter((purchase) => purchase?.status === "paid" && purchase?.tipId)
    .slice(0, 8);
  const tipRows = Array.isArray(tips) ? tips : [];
  const settled = await Promise.allSettled(paid.map(async (purchase) => {
    const entitlement = await loadTipEntitlement(purchase.tipId);
    if (!entitlement?.entitled) return null;
    const tip = tipRows.find((item) => String(item?.id) === String(purchase.tipId));
    return {
      id: `entitlement-${purchase.tipId}`,
      title: tip?.title || "Purchased MST Tip",
      selection: entitlement.selection || null,
      status: "entitled",
      tipId: purchase.tipId,
    };
  }));
  return settled.flatMap((entry) => entry.status === "fulfilled" && entry.value ? [entry.value] : []);
}

export default function Phase4BReadOnlyHub() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading:true, tips:null, purchased:null, tipsters:null, tipsterLeaderboard:null, leaderboard:null, warnings:[] });
  const retry = useCallback(() => setAttempt((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading:true, warnings:[] }));
    Promise.allSettled([
      loadTips(),
      loadOwnPurchases(),
      loadTipsters(),
      loadTipsterLeaderboard(),
      loadUserLeaderboard(),
    ]).then(async (settled) => {
      if (!active) return;
      const [tips, purchases, tipsters, tipsterLeaderboard, leaderboard] = settled;
      const tipsData = tips.status === "fulfilled" ? tips.value : null;
      const purchasesData = purchases.status === "fulfilled" ? purchases.value : null;
      const purchased = purchases.status === "fulfilled"
        ? await entitledPurchaseRows(purchasesData, tipsData).catch(() => [])
        : [];
      if (!active) return;
      const names = ["Tips", "Purchased tips", "Tipsters", "Tipster leaderboard", "Prediction leaderboard"];
      const warnings = settled.flatMap((entry, index) => entry.status === "rejected" ? [entry.reason?.message || `${names[index]} unavailable`] : []);
      setState({
        loading:false,
        tips: tipsData,
        purchased,
        tipsters: tipsters.status === "fulfilled" ? tipsters.value : null,
        tipsterLeaderboard: tipsterLeaderboard.status === "fulfilled" ? tipsterLeaderboard.value : null,
        leaderboard: leaderboard.status === "fulfilled" ? leaderboard.value : null,
        warnings,
      });
    });
    return () => { active = false; };
  }, [attempt]);

  if (state.loading) return <View style={s.loading}><ActivityIndicator color={C.red}/><Text style={s.loadingText}>Loading shared MST tips and leaderboards…</Text></View>;
  return (
    <View>
      <View style={s.boundary}><Ionicons name="shield-checkmark-outline" size={18} color={C.green}/><Text style={s.boundaryText}>Read only. This Scores surface uses the shared Scores Product API and never imports prediction submission APIs.</Text></View>
      <DataList title="Purchased / entitled tips" eyebrow="ENTITLEMENTS" data={state.purchased} empty="No paid tip entitlement is available for this signed-in account." />
      <DataList title="Tips" eyebrow="MST TIPS" data={state.tips} empty="No readable tips are available." />
      <DataList title="Tipsters" eyebrow="TIPSTERS" data={state.tipsters} empty="No verified Tipsters are available." />
      <DataList title="Tipster Leaderboard" eyebrow="TIPSTER LEADERBOARD" data={state.tipsterLeaderboard} empty="No Tipster leaderboard rows are available." />
      <DataList title="User Prediction Leaderboard" eyebrow="PREDICTION · READ ONLY" data={state.leaderboard} empty="No prediction leaderboard rows are available." />
      {state.warnings.map((warning, index) => <Text key={`${warning}-${index}`} style={s.warning}>{warning}</Text>)}
      <Pressable onPress={retry} style={s.retry}><Ionicons name="refresh" size={14} color={C.secondary}/><Text style={s.retryText}>Refresh</Text></Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  loading:{ minHeight:110, borderRadius:13, backgroundColor:C.surface, borderWidth:1, borderColor:C.border, alignItems:"center", justifyContent:"center", gap:8, marginBottom:10 },
  loadingText:{ color:C.muted, fontSize:9 },
  boundary:{ borderRadius:13, borderWidth:1, borderColor:C.green, backgroundColor:C.surface, padding:11, flexDirection:"row", gap:8, alignItems:"center", marginBottom:10 },
  boundaryText:{ color:C.muted, fontSize:9, lineHeight:13, flex:1 },
  card:{ borderRadius:13, backgroundColor:C.surface, borderWidth:1, borderColor:C.border, padding:12, marginBottom:10 },
  eyebrow:{ color:C.red, fontSize:8, fontWeight:"900", letterSpacing:.7 },
  title:{ color:C.text, fontSize:12, fontWeight:"900", marginTop:3, marginBottom:7 },
  row:{ minHeight:47, flexDirection:"row", alignItems:"center", gap:8 },
  rowBorder:{ borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:C.border },
  rank:{ width:24, color:C.muted, fontSize:8, fontWeight:"900" },
  flex:{ flex:1, minWidth:0 },
  name:{ color:C.secondary, fontSize:9.5, fontWeight:"800" },
  meta:{ color:C.muted, fontSize:8, marginTop:2 },
  selection:{ color:C.green, fontSize:8, fontWeight:"900", maxWidth:75 },
  empty:{ color:C.muted, fontSize:9, lineHeight:14, paddingVertical:8 },
  warning:{ color:C.amber, fontSize:8.5, lineHeight:13, marginBottom:5 },
  retry:{ alignSelf:"flex-start", minHeight:31, borderRadius:8, borderWidth:1, borderColor:C.border, backgroundColor:C.raised, paddingHorizontal:10, flexDirection:"row", alignItems:"center", gap:5 },
  retryText:{ color:C.secondary, fontSize:8.5, fontWeight:"800" },
});
