import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  createTipPurchase,
  loadOwnPurchases,
  loadTipEntitlement,
  loadTips,
  loadTipsterLeaderboard,
  loadTipsters,
  loadUserLeaderboard,
} from "./scoresStagingApi";

const C = {
  surface: "#101417",
  raised: "#171C20",
  border: "#293036",
  text: "#FFFFFF",
  secondary: "#D4D8DB",
  muted: "#929AA0",
  red: "#F3262D",
  amber: "#F4C84D",
  green: "#48C78E",
};

function arrays(value, out = [], depth = 0) {
  if (value == null || depth > 5) return out;
  if (Array.isArray(value)) {
    out.push(value);
    value.slice(0, 8).forEach((item) => arrays(item, out, depth + 1));
  } else if (typeof value === "object") {
    Object.values(value).forEach((item) => arrays(item, out, depth + 1));
  }
  return out;
}

function rows(payload) {
  if (Array.isArray(payload)) return payload;
  return arrays(payload).sort((a, b) => b.length - a.length)[0] || [];
}

function label(row, fallback) {
  return String(
    row?.displayName ||
      row?.display_name ||
      row?.name ||
      row?.username ||
      row?.title ||
      row?.tipsterName ||
      row?.user?.displayName ||
      row?.user?.name ||
      row?.tipster?.name ||
      fallback,
  );
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
  return parts.join(" · ") || "MST data";
}

function DataList({ title, eyebrow, data, empty }) {
  const list = rows(data).slice(0, 10);
  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text style={s.title}>{title}</Text>
      {list.length ? (
        list.map((row, index) => (
          <View
            key={String(row?.id || row?.user_id || row?.userId || row?.tipsterId || `${title}-${index}`)}
            style={[s.row, index > 0 && s.rowBorder]}
          >
            <Text style={s.rank}>{row?.rank != null ? `#${row.rank}` : `${index + 1}`}</Text>
            <View style={s.flex}>
              <Text numberOfLines={1} style={s.name}>
                {label(row, `Item ${index + 1}`)}
              </Text>
              <Text numberOfLines={1} style={s.meta}>
                {meta(row)}
              </Text>
            </View>
            {row?.selection ? (
              <Text numberOfLines={1} style={s.selection}>
                {String(row.selection)}
              </Text>
            ) : null}
          </View>
        ))
      ) : (
        <Text style={s.empty}>{empty}</Text>
      )}
    </View>
  );
}

function TipList({ data, onPurchase, purchaseState }) {
  const list = rows(data).slice(0, 10);
  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>MST TIPS</Text>
      <Text style={s.title}>Tips</Text>
      {list.length ? (
        list.map((row, index) => {
          const tipId = String(row?.id || "").trim();
          const accessLevel = String(row?.access_level || row?.accessLevel || "").toLowerCase();
          const paid = accessLevel === "paid";
          const busy = paid && purchaseState.tipId === tipId && purchaseState.loading;
          return (
            <View key={tipId || `tip-${index}`} style={[s.row, index > 0 && s.rowBorder]}>
              <Text style={s.rank}>{index + 1}</Text>
              <View style={s.flex}>
                <Text numberOfLines={1} style={s.name}>
                  {label(row, `Tip ${index + 1}`)}
                </Text>
                <Text numberOfLines={1} style={s.meta}>
                  {meta(row)}
                </Text>
              </View>
              {row?.selection ? (
                <Text numberOfLines={1} style={s.selection}>
                  {String(row.selection)}
                </Text>
              ) : null}
              {paid && tipId ? (
                <Pressable
                  disabled={busy}
                  onPress={() => onPurchase(row)}
                  style={[s.buyButton, busy && s.buyButtonDisabled]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={C.text} />
                  ) : (
                    <Text style={s.buyText}>BUY TIP</Text>
                  )}
                </Pressable>
              ) : accessLevel === "free" ? (
                <Text style={s.freeTag}>FREE</Text>
              ) : null}
            </View>
          );
        })
      ) : (
        <Text style={s.empty}>No readable tips are available.</Text>
      )}
      {purchaseState.message ? (
        <Text style={purchaseState.error ? s.purchaseError : s.purchaseSuccess}>
          {purchaseState.message}
        </Text>
      ) : null}
    </View>
  );
}

async function entitledPurchaseRows(purchases, tips) {
  const paid = (Array.isArray(purchases) ? purchases : [])
    .filter((purchase) => purchase?.status === "paid" && purchase?.tipId)
    .slice(0, 8);
  const tipRows = Array.isArray(tips) ? tips : [];
  const settled = await Promise.allSettled(
    paid.map(async (purchase) => {
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
    }),
  );
  return settled.flatMap((entry) => (entry.status === "fulfilled" && entry.value ? [entry.value] : []));
}

export default function Phase4BReadOnlyHub() {
  const [subTab, setSubTab] = useState("tips"); // "tips" | "tipsters" | "leaderboard"
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({
    loading: true,
    tips: null,
    purchased: null,
    tipsters: null,
    tipsterLeaderboard: null,
    leaderboard: null,
    warnings: [],
  });
  const [purchaseState, setPurchaseState] = useState({
    tipId: null,
    loading: false,
    message: null,
    error: false,
  });
  const retry = useCallback(() => setAttempt((v) => v + 1), []);

  const buyTip = useCallback(async (tip) => {
    const tipId = String(tip?.id || "").trim();
    if (!tipId) return;
    setPurchaseState({ tipId, loading: true, message: null, error: false });
    try {
      const result = await createTipPurchase(tipId);
      const message = result?.entitled
        ? "Tip access is unlocked."
        : result?.purchaseRequired
          ? "Purchase created. Complete payment to unlock this tip."
          : "No purchase is required for this tip.";
      setPurchaseState({ tipId, loading: false, message, error: false });
      setAttempt((v) => v + 1);
    } catch (error) {
      const message =
        error?.status === 401
          ? "Sign in to buy this tip."
          : error?.message || "Tip purchase is unavailable. Please retry.";
      setPurchaseState({ tipId, loading: false, message, error: true });
    }
  }, []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, warnings: [] }));
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
      const purchased =
        purchases.status === "fulfilled"
          ? await entitledPurchaseRows(purchasesData, tipsData).catch(() => [])
          : [];
      if (!active) return;
      const names = [
        "Tips",
        "Purchased tips",
        "Tipsters",
        "Tipster leaderboard",
        "Prediction leaderboard",
      ];
      const warnings = settled.flatMap((entry, index) =>
        entry.status === "rejected"
          ? [entry.reason?.message || `${names[index]} unavailable`]
          : [],
      );
      setState({
        loading: false,
        tips: tipsData,
        purchased,
        tipsters: tipsters.status === "fulfilled" ? tipsters.value : null,
        tipsterLeaderboard: tipsterLeaderboard.status === "fulfilled" ? tipsterLeaderboard.value : null,
        leaderboard: leaderboard.status === "fulfilled" ? leaderboard.value : null,
        warnings,
      });
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (subTab !== "tips") {
      const handleHardwareBack = () => {
        setSubTab("tips");
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", handleHardwareBack);
      return () => sub.remove();
    }
  }, [subTab]);

  if (state.loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={C.red} />
        <Text style={s.loadingText}>Loading shared MST tips and leaderboards…</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Product boundary announcement banner */}
      <View style={s.boundary}>
        <Ionicons name="shield-checkmark-outline" size={18} color={C.green} />
        <Text style={s.boundaryText}>
          MST Scores provides read-only Tip intelligence and verified leaderboards. Exact-score prediction creation, editing and submission are exclusive to MST Prediction.
        </Text>
      </View>

      {/* Internal Navigation: Tips | Tipsters | Tipster Leaderboard */}
      <View style={s.segmentedNav} accessibilityRole="tablist">
        {[
          { id: "tips", label: "Tips", icon: "diamond-outline" },
          { id: "tipsters", label: "Tipsters", icon: "people-outline" },
          { id: "leaderboard", label: "Tipster Leaderboard", icon: "trophy-outline" },
        ].map((tab) => {
          const active = subTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setSubTab(tab.id)}
              style={[s.segmentBtn, active && s.segmentBtnActive]}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={active ? C.text : C.muted}
                style={{ marginRight: 4 }}
              />
              <Text style={[s.segmentLabel, active && s.segmentLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* SUB-TAB 1: TIPS */}
      {subTab === "tips" ? (
        <>
          <DataList
            title="Purchased / entitled tips"
            eyebrow="ENTITLEMENTS"
            data={state.purchased}
            empty="No paid tip entitlement is available for this signed-in account."
          />
          <TipList data={state.tips} onPurchase={buyTip} purchaseState={purchaseState} />
        </>
      ) : null}

      {/* SUB-TAB 2: TIPSTERS */}
      {subTab === "tipsters" ? (
        <DataList
          title="Verified Tipsters"
          eyebrow="MST TIPSTERS"
          data={state.tipsters}
          empty="No verified Tipsters are available."
        />
      ) : null}

      {/* SUB-TAB 3: TIPSTER LEADERBOARD */}
      {subTab === "leaderboard" ? (
        <>
          <DataList
            title="Tipster Leaderboard"
            eyebrow="TIPSTER RANKINGS · TIPS"
            data={state.tipsterLeaderboard}
            empty="No Tipster leaderboard rows are available."
          />
          <DataList
            title="User Prediction Leaderboard"
            eyebrow="PREDICTION RANKINGS · READ ONLY"
            data={state.leaderboard}
            empty="No prediction leaderboard rows are available."
          />
        </>
      ) : null}

      {state.warnings.map((warning, index) => (
        <Text key={`${warning}-${index}`} style={s.warning}>
          {warning}
        </Text>
      ))}

      <Pressable onPress={retry} style={s.retry}>
        <Ionicons name="refresh" size={14} color={C.secondary} />
        <Text style={s.retryText}>Refresh</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  loading: {
    minHeight: 110,
    borderRadius: 13,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },
  loadingText: { color: C.muted, fontSize: 9.5 },
  boundary: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.green,
    backgroundColor: C.surface,
    padding: 11,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  boundaryText: { color: C.muted, fontSize: 9.5, lineHeight: 14, flex: 1 },
  segmentedNav: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 3,
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },
  segmentBtnActive: {
    backgroundColor: C.red,
  },
  segmentLabel: {
    color: C.muted,
    fontSize: 10.5,
    fontWeight: "700",
  },
  segmentLabelActive: {
    color: C.text,
    fontWeight: "900",
  },
  card: {
    borderRadius: 13,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 10,
  },
  eyebrow: { color: C.red, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  title: { color: C.text, fontSize: 13, fontWeight: "900", marginTop: 3, marginBottom: 7 },
  row: { minHeight: 47, flexDirection: "row", alignItems: "center", gap: 8 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  rank: { width: 24, color: C.muted, fontSize: 8.5, fontWeight: "900" },
  flex: { flex: 1, minWidth: 0 },
  name: { color: C.secondary, fontSize: 10, fontWeight: "800" },
  meta: { color: C.muted, fontSize: 8.5, marginTop: 2 },
  selection: { color: C.green, fontSize: 8.5, fontWeight: "900", maxWidth: 75 },
  empty: { color: C.muted, fontSize: 9.5, lineHeight: 14, paddingVertical: 8 },
  warning: { color: C.amber, fontSize: 8.5, lineHeight: 13, marginBottom: 5 },
  retry: {
    alignSelf: "flex-start",
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.raised,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  retryText: { color: C.secondary, fontSize: 9, fontWeight: "800" },
  buyButton: {
    minHeight: 30,
    minWidth: 64,
    borderRadius: 8,
    backgroundColor: C.red,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  buyButtonDisabled: { opacity: 0.6 },
  buyText: { color: C.text, fontSize: 8, fontWeight: "900", letterSpacing: 0.3 },
  freeTag: { color: C.green, fontSize: 8, fontWeight: "900" },
  purchaseSuccess: { color: C.green, fontSize: 9, lineHeight: 13, marginTop: 7 },
  purchaseError: { color: C.amber, fontSize: 9, lineHeight: 13, marginTop: 7 },
});
