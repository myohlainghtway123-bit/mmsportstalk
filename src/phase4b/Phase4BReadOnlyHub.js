import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, BackHandler, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useIAP } from "react-native-iap";
import {
  createTipPurchase,
  loadOwnPurchases,
  loadTipEntitlement,
  loadTips,
  loadTipsterLeaderboard,
  loadTipsters,
  loadUserLeaderboard,
} from "./scoresStagingApi";
import { useTheme } from "../theme/ThemeContext";
import { getCreditStorefront, verifyPlayPurchaseOnServer } from "../services/billingService";
import { getAuthStatus } from "../services/accountApi";

const ENVIRONMENT = String(process.env.EXPO_PUBLIC_MST_ENVIRONMENT || "staging").trim().toLowerCase();
const TIP_UNLOCK_ACTION_ENABLED = true;

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

function tipPriceCredits(row) {
  const raw = row?.priceCredits ?? row?.price_credits ?? row?.credits;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function meta(row) {
  const creditPrice = tipPriceCredits(row);
  const parts = [
    row?.rank != null ? `#${row.rank}` : null,
    row?.points != null ? `${row.points} pts` : row?.score != null ? `${row.score} pts` : null,
    row?.accuracy != null ? `${row.accuracy}% accuracy` : null,
    row?.followers_count != null ? `${row.followers_count} followers` : null,
    TIP_UNLOCK_ACTION_ENABLED && creditPrice != null ? `${creditPrice} CR` : null,
    row?.status ? String(row.status).toUpperCase() : null,
  ].filter(Boolean);
  return parts.join(" · ") || "MST data";
}

function DataList({ title, eyebrow, data, empty, colors = C }) {
  const list = rows(data).slice(0, 10);
  return (
    <View style={[s.card, { backgroundColor: colors.surface || colors.card || C.surface, borderColor: colors.border }]}>
      <Text style={[s.eyebrow, { color: colors.red }]}>{eyebrow}</Text>
      <Text style={[s.title, { color: colors.text }]}>{title}</Text>
      {list.length ? (
        list.map((row, index) => (
          <View
            key={String(row?.id || row?.user_id || row?.userId || row?.tipsterId || `${title}-${index}`)}
            style={[s.row, index > 0 && [s.rowBorder, { borderTopColor: colors.border }]]}
          >
            <Text style={[s.rank, { color: colors.muted }]}>{row?.rank != null ? `#${row.rank}` : `${index + 1}`}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[s.name, { color: colors.secondary || colors.text }]}>
                {label(row, `Item ${index + 1}`)}
              </Text>
              <Text numberOfLines={1} style={[s.meta, { color: colors.muted }]}>
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
        <Text style={[s.empty, { color: colors.muted }]}>{empty}</Text>
      )}
    </View>
  );
}

function TipList({ data, onPurchase, purchaseState, purchaseEnabled, colors = C, onOpenCredits }) {
  const list = rows(data).slice(0, 15);
  return (
    <View style={[s.card, { backgroundColor: colors.surface || colors.card || C.surface, borderColor: colors.border }]}>
      <View>
        <Text style={[s.eyebrow, { color: colors.red }]}>MST VERIFIED TIPS</Text>
        <Text style={[s.title, { color: colors.text }]}>Featured Tipster Cards</Text>
      </View>

      {/* Quick Credit Value & Buy Banner */}
      <Pressable
        onPress={onOpenCredits}
        style={[s.creditQuickBar, { backgroundColor: "rgba(244,200,77,0.08)", borderColor: colors.gold || C.amber }]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          <Ionicons name="sparkles" size={15} color={colors.gold || C.amber} />
          <Text style={{ fontSize: 12, fontWeight: "800", color: colors.gold || C.amber }}>
            MST Credits · Android purchases use Google Play Billing
          </Text>
        </View>
        <View style={[s.creditQuickBtn, { backgroundColor: colors.gold || C.amber }]}>
          <Text style={{ fontSize: 10.5, fontWeight: "900", color: "#000000" }}>CREDITS</Text>
        </View>
      </Pressable>

      {list.length ? (
        list.map((row, index) => {
          const tipId = String(row?.id || "").trim();
          const accessLevel = String(row?.access_level || row?.accessLevel || "").toLowerCase();
          const paid = accessLevel === "paid";
          const busy = purchaseEnabled && paid && purchaseState.tipId === tipId && purchaseState.loading;
          const tipsterName = label(row, `Pro Tipster ${index + 1}`);
          const matchTitle = row?.match_title || row?.title || row?.fixture || `Match Tip #${index + 1}`;
          const isPurchased = Boolean(row?.is_purchased || row?.purchased || row?.entitled || row?.unlocked);
          const selection = row?.selection;

          return (
            <View
              key={tipId || `tip-card-${index}`}
              style={[
                s.tipCardWrap,
                {
                  backgroundColor: colors.raised || C.raised,
                  borderColor: isPurchased ? C.green : (paid ? colors.border : C.border),
                },
              ]}
            >
              <View style={s.tipCardTopRow}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[s.name, { color: colors.secondary || colors.text }]}>
                    {tipsterName}
                  </Text>
                  <Text numberOfLines={1} style={[s.meta, { color: colors.muted }]}>
                    {meta(row)}
                  </Text>
                </View>
                <View style={[s.tagBadge, { backgroundColor: paid ? "rgba(244,200,77,0.14)" : "rgba(72,199,142,0.14)" }]}>
                  <Text style={[s.tagBadgeText, { color: paid ? C.amber : C.green }]}>
                    {isPurchased ? "UNLOCKED" : (paid ? "PREMIUM" : "FREE")}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  s.tipPickBox,
                  {
                    backgroundColor: isPurchased ? "rgba(72,199,142,0.08)" : (paid ? "rgba(0,0,0,0.25)" : "rgba(72,199,142,0.08)"),
                    borderColor: isPurchased ? C.green : (paid ? colors.border : "transparent"),
                  },
                ]}
              >
                {selection ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="checkmark-circle" size={15} color={C.green} />
                    <Text numberOfLines={1} style={[s.selection, { color: C.green }]}>
                      Pick: {String(selection)}
                    </Text>
                  </View>
                ) : paid && !isPurchased ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="lock-closed" size={14} color={C.amber} />
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>
                      Locked Tip · Unlock to reveal pick & analysis
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: C.green, fontSize: 12, fontWeight: "700" }}>
                    Free Tip Included
                  </Text>
                )}
              </View>

              <View style={s.tipCardBottomRow}>
                <View>
                  <Text style={{ fontSize: 10, color: colors.muted, fontWeight: "700" }}>PRICE</Text>
                  <Text style={{ fontSize: 13, fontWeight: "900", color: colors.text }}>
                    {paid ? (tipPriceCredits(row) != null ? `${tipPriceCredits(row)} CR` : "CREDITS") : "FREE"}
                  </Text>
                </View>
                {paid && !isPurchased ? (
                  <Pressable
                    disabled={busy}
                    onPress={() => onPurchase(row)}
                    style={[s.buyButton, busy && s.buyButtonDisabled]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={C.text} />
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="cart" size={13} color="#FFFFFF" />
                        <Text style={s.buyText}>BUY TIP</Text>
                      </View>
                    )}
                  </Pressable>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Ionicons name="checkmark-done" size={15} color={C.green} />
                    <Text style={{ color: C.green, fontSize: 11, fontWeight: "800" }}>Ready</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })
      ) : (
        <Text style={[s.empty, { color: colors.muted }]}>No tips are available right now.</Text>
      )}
      {purchaseEnabled && purchaseState.message ? (
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
        title: tip?.title || "Entitled MST Tip",
        selection: entitlement.selection || null,
        status: "entitled",
        tipId: purchase.tipId,
      };
    }),
  );
  return settled.flatMap((entry) => (entry.status === "fulfilled" && entry.value ? [entry.value] : []));
}

function CreditPanel({ my = true, colors = C }) {
  const [storefront, setStorefront] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [purchaseMsg, setPurchaseMsg] = useState(null);

  const loadStorefront = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const value = await getCreditStorefront();
      setStorefront(value);
      return value;
    } catch (error) {
      setLoadError(error?.message || (my ? "Credit package များ မရရှိနိုင်သေးပါ။" : "Credit packages are unavailable."));
      return null;
    } finally {
      setLoading(false);
    }
  }, [my]);

  useEffect(() => {
    loadStorefront().catch(() => {});
  }, [loadStorefront]);

  const packages = useMemo(
    () => (Array.isArray(storefront?.packages) ? storefront.packages : []),
    [storefront],
  );

  const packageByProductId = useMemo(() => {
    const map = new Map();
    for (const pkg of packages) {
      map.set(String(pkg.playProductId || pkg.id), pkg);
    }
    return map;
  }, [packages]);

  const {
    connected,
    products,
    fetchProducts,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      const productId = String(purchase?.productId || "").trim();
      const purchaseToken = String(purchase?.purchaseToken || "").trim();
      const pkg = packageByProductId.get(productId);

      if (!pkg || !purchaseToken) {
        setProcessingId(null);
        setPurchaseMsg({
          error: true,
          text: my
            ? "Google Play purchase အချက်အလက် မပြည့်စုံပါ။ ငွေထပ်မပေးဘဲ Support ကို ဆက်သွယ်ပါ။"
            : "Google Play returned incomplete purchase data. Do not repurchase; contact support.",
        });
        return;
      }

      try {
        const verified = await verifyPlayPurchaseOnServer({
          packageId: pkg.id,
          purchaseToken,
          orderId: purchase?.id || null,
        });

        if (!verified?.ok) {
          throw new Error("Purchase verification did not complete.");
        }

        try {
          await finishTransaction({ purchase, isConsumable: true });
        } catch (_) {
          // The server is authoritative and idempotent. If Play completion fails,
          // the unfinished purchase will be delivered again and safely retried.
        }

        setPurchaseMsg({
          error: false,
          text: my
            ? `ဝယ်ယူမှု အတည်ပြုပြီးပါပြီ။ +${verified.creditsGranted || pkg.credits} Credits · လက်ကျန် ${verified.balance ?? "-"} CR`
            : `Purchase verified. +${verified.creditsGranted || pkg.credits} Credits · Balance ${verified.balance ?? "-"} CR`,
        });
        await loadStorefront();
      } catch (error) {
        setPurchaseMsg({
          error: true,
          text: my
            ? "ဝယ်ယူမှုကို server မှ အတည်မပြုနိုင်သေးပါ။ ထပ်မဝယ်ပါနှင့် — နောက်တစ်ကြိမ် app ဖွင့်ချိန်တွင် ပြန်စစ်ပါမည်။"
            : "The server has not verified this purchase yet. Do not repurchase; it will be retried when the app receives the purchase again.",
        });
      } finally {
        setProcessingId(null);
      }
    },
    onPurchaseError: (error) => {
      setProcessingId(null);
      const cancelled = String(error?.code || "").toLowerCase().includes("cancel");
      if (cancelled) {
        setPurchaseMsg(null);
        return;
      }
      setPurchaseMsg({
        error: true,
        text: error?.message || (my ? "Google Play ဝယ်ယူမှု မအောင်မြင်ပါ။" : "Google Play purchase failed."),
      });
    },
  });

  const productIdsKey = useMemo(
    () => packages.map((pkg) => String(pkg.playProductId || pkg.id)).sort().join("|"),
    [packages],
  );

  useEffect(() => {
    if (!connected || !productIdsKey) return;
    const skus = productIdsKey.split("|").filter(Boolean);
    fetchProducts({ skus, type: "in-app" }).catch(() => {});
  }, [connected, fetchProducts, productIdsKey]);

  const storeProductById = useMemo(() => {
    const map = new Map();
    for (const product of Array.isArray(products) ? products : []) {
      if (product?.id) map.set(String(product.id), product);
    }
    return map;
  }, [products]);

  const serverCheckoutReady = storefront?.purchasingEnabled === true;

  const handlePlayPurchase = async (pkg) => {
    if (!pkg?.id || processingId) return;
    setPurchaseMsg(null);

    const auth = await getAuthStatus().catch(() => null);
    if (!auth?.authenticated) {
      setPurchaseMsg({
        error: true,
        text: my
          ? "Credits ဝယ်ယူရန် MST အကောင့်ဝင်ထားရပါမည်။"
          : "Sign in to your MST account before buying Credits.",
      });
      return;
    }

    const productId = String(pkg.playProductId || pkg.id);
    const storeProduct = storeProductById.get(productId);
    if (!serverCheckoutReady || !connected || !storeProduct) {
      setPurchaseMsg({
        error: true,
        text: my
          ? "Google Play Billing မပြည့်စုံသေးပါ။ ငွေပေးချေမှု မစတင်ပါ။"
          : "Google Play Billing is not ready for this product. No payment was started.",
      });
      return;
    }

    const accountId = String(auth?.user?.id || "").trim();
    if (!accountId) {
      setPurchaseMsg({
        error: true,
        text: my
          ? "MST account ID မရရှိသေးပါ။ အကောင့်ကို ပြန်ဝင်ပြီး ထပ်စမ်းပါ။"
          : "Your MST account ID is unavailable. Sign in again and retry.",
      });
      return;
    }

    setProcessingId(pkg.id);
    try {
      await requestPurchase({
        request: {
          google: {
            skus: [productId],
            obfuscatedAccountId: accountId,
          },
          apple: { sku: productId },
        },
        type: "in-app",
      });
    } catch (error) {
      setProcessingId(null);
      const cancelled = String(error?.code || "").toLowerCase().includes("cancel");
      if (!cancelled) {
        setPurchaseMsg({
          error: true,
          text: error?.message || (my ? "Google Play checkout မဖွင့်နိုင်ပါ။" : "Could not start Google Play checkout."),
        });
      }
    }
  };

  return (
    <View>
      <View style={[s.walletHeroCard, { backgroundColor: colors.surface || colors.card || C.surface, borderColor: colors.gold || C.amber }]}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Ionicons name="wallet-outline" size={15} color={colors.red || C.red} />
            <Text style={[s.eyebrow, { color: colors.red || C.red }]}>MST CREDITS</Text>
          </View>
          <Text style={[s.title, { color: colors.text, marginTop: 4 }]}>
            {my ? "Android ဝယ်ယူမှုများ = Google Play Billing" : "Android purchases use Google Play Billing"}
          </Text>
          <Text style={[s.walletSub, { color: colors.muted, marginTop: 6 }]}>
            {my
              ? "Digital Credits ကို Google Play checkout မှတစ်ဆင့်သာ ဝယ်ယူနိုင်ပြီး server အတည်ပြုချက်ရမှ Credits ထည့်ပေးပါမည်။"
              : "Digital Credits are purchased only through Google Play checkout and are granted only after server verification."}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={[s.card, { backgroundColor: colors.surface || colors.card || C.surface, borderColor: colors.border, alignItems: "center" }]}>
          <ActivityIndicator color={colors.red || C.red} />
          <Text style={[s.empty, { color: colors.muted, marginTop: 8 }]}>
            {my ? "Credit package များ စစ်ဆေးနေပါသည်…" : "Checking credit packages…"}
          </Text>
        </View>
      ) : loadError ? (
        <View style={[s.card, { backgroundColor: colors.surface || colors.card || C.surface, borderColor: colors.border }]}>
          <Text style={[s.purchaseError, { marginTop: 0 }]}>{loadError}</Text>
          <Pressable onPress={() => loadStorefront()} style={[s.packBuyBtn, { backgroundColor: colors.red || C.red, marginTop: 10 }]}>
            <Text style={s.packBuyBtnText}>{my ? "ပြန်စမ်းမည်" : "RETRY"}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={{ marginTop: 4, marginBottom: 10 }}>
            <Text style={[s.title, { color: colors.text }]}>Credit Packages</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>
              {my
                ? "100 Credits = 100 THB reference rate ဖြစ်ပြီး နောက်ဆုံး localized price ကို Google Play က ပြသပါမည်။"
                : "Reference rate: 100 Credits = 100 THB. Google Play shows the final localized checkout price."}
            </Text>
          </View>

          <View style={s.packGrid}>
            {packages.map((pkg) => {
              const productId = String(pkg.playProductId || pkg.id);
              const storeProduct = storeProductById.get(productId);
              const busy = processingId === pkg.id;
              const canBuy = serverCheckoutReady && connected && Boolean(storeProduct) && !busy;
              const displayPrice = storeProduct?.displayPrice || (pkg.priceThb ? `฿${pkg.priceThb}` : "Google Play");

              return (
                <View
                  key={pkg.id}
                  style={[
                    s.packCard,
                    {
                      backgroundColor: colors.surface || colors.card || C.surface,
                      borderColor: pkg.popular ? (colors.gold || C.amber) : colors.border,
                    },
                    pkg.popular && { borderWidth: 1.5 },
                  ]}
                >
                  {pkg.popular ? (
                    <View style={[s.popularBadge, { backgroundColor: colors.gold || C.amber }]}>
                      <Text style={s.popularBadgeText}>POPULAR</Text>
                    </View>
                  ) : null}
                  <Text style={[s.packCreditsText, { color: colors.text }]}>{pkg.credits}</Text>
                  <Text style={[s.packCreditsLabel, { color: colors.gold || C.amber }]}>CREDITS</Text>
                  <Text style={[s.packPriceText, { color: colors.text }]}>{displayPrice}</Text>

                  <Pressable
                    disabled={!canBuy}
                    onPress={() => handlePlayPurchase(pkg)}
                    style={[
                      s.packBuyBtn,
                      { backgroundColor: colors.red || C.red },
                      !canBuy && { opacity: 0.45 },
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={s.packBuyBtnText}>
                        {canBuy
                          ? (my ? "GOOGLE PLAY ဖြင့် ဝယ်မည်" : "BUY WITH GOOGLE PLAY")
                          : (my ? "SETUP PENDING" : "SETUP PENDING")}
                      </Text>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>

          {!packages.length ? (
            <View style={[s.card, { backgroundColor: colors.surface || colors.card || C.surface, borderColor: colors.border }]}>
              <Text style={[s.empty, { color: colors.muted }]}>
                {my ? "Credit package များ မသတ်မှတ်ရသေးပါ။" : "No credit packages are configured yet."}
              </Text>
            </View>
          ) : null}
        </>
      )}

      {purchaseMsg ? (
        <View
          style={[
            s.purchaseToast,
            {
              backgroundColor: purchaseMsg.error ? "rgba(243,38,45,0.10)" : "rgba(16,185,129,0.15)",
              borderColor: purchaseMsg.error ? (colors.red || C.red) : (colors.green || C.green),
              borderWidth: 1,
            },
          ]}
        >
          <Ionicons
            name={purchaseMsg.error ? "information-circle" : "checkmark-circle"}
            size={18}
            color={purchaseMsg.error ? (colors.red || C.red) : (colors.green || C.green)}
          />
          <Text
            style={[
              s.purchaseToastText,
              { color: purchaseMsg.error ? (colors.red || C.red) : (colors.green || C.green), flex: 1 },
            ]}
          >
            {purchaseMsg.text}
          </Text>
        </View>
      ) : null}

      <View style={[s.pendingCard, { backgroundColor: colors.raised || C.raised, borderColor: colors.border }]}>
        <Ionicons name="shield-checkmark" size={22} color={colors.green || C.green} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={[s.pendingTitle, { color: colors.text }]}>
            {serverCheckoutReady
              ? (connected
                ? (my ? "Google Play Billing ချိတ်ဆက်ပြီး" : "Google Play Billing connected")
                : (my ? "Google Play ကို ချိတ်ဆက်နေသည်" : "Connecting to Google Play"))
              : (my ? "Google Play Billing setup မပြီးသေးပါ" : "Google Play Billing setup pending")}
          </Text>
          <Text style={[s.pendingText, { color: colors.muted }]}>
            {my
              ? "Purchase token ကို MST server က Google Play နှင့် စစ်ဆေးပြီးမှသာ Credits ထည့်ပေးပါမည်။ တစ်ခုတည်းသော purchase token ကို နှစ်ကြိမ် Credits မပေးနိုင်ပါ။"
              : "The MST server verifies the Play purchase token before granting Credits, and the same token cannot grant Credits twice."}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function Phase4BReadOnlyHub({ language = "my" }) {
  const my = language === "my";
  const [subTab, setSubTab] = useState("tips"); // "tips" | "prediction" | "tipsters" | "rank"
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
    if (!tipId || !TIP_UNLOCK_ACTION_ENABLED) return;
    setPurchaseState({ tipId, loading: true, message: null, error: false });
    try {
      const result = await createTipPurchase(tipId);
      const message = result?.entitled
        ? "Tip access is unlocked."
        : result?.purchaseRequired
          ? "More MST Credits are required to unlock this tip."
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

  const TIPS_DISK_KEY = "mst:cache:tips-hub:v1";

  useEffect(() => {
    let active = true;

    // ── Step 1: Paint immediately from disk cache ──
    AsyncStorage.getItem(TIPS_DISK_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        try {
          const cached = JSON.parse(raw);
          if (cached?.tips) {
            setState((prev) => prev.tips ? prev : {
              ...prev,
              loading: true,
              tips: cached.tips,
              tipsters: cached.tipsters || null,
              tipsterLeaderboard: cached.tipsterLeaderboard || null,
              leaderboard: cached.leaderboard || null,
            });
          }
        } catch (_) {}
      })
      .catch(() => {});

    // ── Step 2: Fetch fresh data in parallel ──
    Promise.allSettled([
      loadTips(),
      loadTipsters(),
      loadTipsterLeaderboard(),
      loadUserLeaderboard(),
      loadOwnPurchases().catch(() => null),
    ]).then(async ([tipsRes, tipstersRes, tipsterLbRes, userLbRes, purchasesRes]) => {
      if (!active) return;
      const tips = tipsRes.status === "fulfilled" ? tipsRes.value : null;
      const tipsters = tipstersRes.status === "fulfilled" ? tipstersRes.value : null;
      const tipsterLeaderboard = tipsterLbRes.status === "fulfilled" ? tipsterLbRes.value : null;
      const leaderboard = userLbRes.status === "fulfilled" ? userLbRes.value : null;
      const purchases = purchasesRes.status === "fulfilled" ? purchasesRes.value : null;
      const purchased = await entitledPurchaseRows(purchases, tips);

      const warnings = [];
      if (tipsRes.status === "rejected") warnings.push("Tips unavailable right now.");
      if (tipstersRes.status === "rejected") warnings.push("Tipsters directory unavailable.");
      if (tipsterLbRes.status === "rejected") warnings.push("Tipster rankings unavailable.");
      if (userLbRes.status === "rejected") warnings.push("Prediction leaderboard unavailable.");

      setState({
        loading: false,
        tips,
        purchased,
        tipsters,
        tipsterLeaderboard,
        leaderboard,
        warnings,
      });

      // Persist to disk so next mount is instant
      if (tips) {
        AsyncStorage.setItem(TIPS_DISK_KEY, JSON.stringify({ tips, tipsters, tipsterLeaderboard, leaderboard })).catch(() => {});
      }
    });
    return () => { active = false; };
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

  let colors = C;
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
  } catch {}

  const openPredictionApp = () => {
    Linking.openURL("mstprediction://").catch(() => {
      Linking.openURL("https://prediction.myanmarsportstalk.com").catch(() => {});
    });
  };

  if (state.loading) {
    return (
      <View style={[s.loading, { backgroundColor: colors.surface || colors.card || C.surface, borderColor: colors.border }]}>
        <ActivityIndicator color={colors.red} />
        <Text style={[s.loadingText, { color: colors.muted }]}>Loading predictions and tips…</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={[s.segmentedNav, { backgroundColor: colors.surface || colors.card || C.surface, borderColor: colors.border }]} accessibilityRole="tablist">
        {[
          { id: "tips", label: "Tips", burmeseLabel: "Tips" },
          { id: "credits", label: "Buy Credits", shortLabel: "Credits", burmeseLabel: "Credits ဝယ်ယူရန်" },
          { id: "prediction", label: "Prediction", shortLabel: "Predict", burmeseLabel: "ခန့်မှန်းချက်" },
          { id: "tipsters", label: "Tipsters", burmeseLabel: "Tipsters" },
          { id: "leaderboard", label: "Leaderboard", shortLabel: "Rank", burmeseLabel: "အဆင့်" },
        ].map((tab) => {
          const active = subTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setSubTab(tab.id)}
              style={[
                s.segmentBtn,
                active && [s.segmentBtnActive, { backgroundColor: colors.red }],
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                style={[
                  s.segmentLabel,
                  { color: active ? "#FFFFFF" : colors.muted },
                  active && s.segmentLabelActive,
                ]}
              >
                {my ? tab.burmeseLabel : (tab.shortLabel || tab.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {subTab === "credits" ? (
        <CreditPanel my={my} colors={colors} />
      ) : null}

      {subTab === "prediction" ? (
        <>
          <View style={[s.predictionHeroCard, { backgroundColor: colors.surface || colors.card || C.surface, borderColor: colors.border }]}>
            <View style={s.predictionHeroHeader}>
              <View style={[s.predictionBadge, { backgroundColor: colors.redSoft || "rgba(243,38,45,0.12)" }]}>
                <Ionicons name="trophy" size={13} color={colors.red || C.red} />
                <Text style={[s.predictionBadgeText, { color: colors.red || C.red }]}>MST PREDICTION ECOSYSTEM</Text>
              </View>
            </View>
            <Text style={[s.predictionHeroTitle, { color: colors.text }]}>{my ? "ပွဲရလဒ်ခန့်မှန်းချက် ပြိုင်ပွဲ" : "Score Prediction Challenge"}</Text>
            <Text style={[s.predictionHeroDesc, { color: colors.muted }]}>
              {my ? "ပွဲရလဒ် အတိအကျခန့်မှန်းပြီး အမှတ်များရယူကာ ဆုလာဘ်များ ရယူပါ။ MST Prediction companion app တွင် ခန့်မှန်းချက်များ ပြုလုပ်နိုင်ပါသည်။" : "Predict exact match scores to earn points, climb the leaderboard, and win rewards. Predictions are created and managed in the companion MST Prediction app."}
            </Text>
            <View style={s.predictionRulesRow}>
              <View style={[s.ruleChip, { backgroundColor: colors.raised || C.raised, borderColor: colors.border }]}>
                <Text style={[s.ruleChipBold, { color: colors.text }]}>3 pts</Text>
                <Text style={[s.ruleChipLabel, { color: colors.muted }]}>{my ? "ရလဒ်မှန်" : "Exact Score"}</Text>
              </View>
              <View style={[s.ruleChip, { backgroundColor: colors.raised || C.raised, borderColor: colors.border }]}>
                <Text style={[s.ruleChipBold, { color: colors.text }]}>1 pt</Text>
                <Text style={[s.ruleChipLabel, { color: colors.muted }]}>{my ? "အနိုင်/သရေမှန်" : "Result Only"}</Text>
              </View>
              <View style={[s.ruleChip, { backgroundColor: colors.raised || C.raised, borderColor: colors.border }]}>
                <Text style={[s.ruleChipBold, { color: colors.text }]}>0 pts</Text>
                <Text style={[s.ruleChipLabel, { color: colors.muted }]}>{my ? "မှားယွင်း" : "Wrong"}</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open MST Prediction"
              onPress={openPredictionApp}
              style={[s.openPredictionBtn, { backgroundColor: colors.red || C.red }]}
            >
              <Ionicons name="open-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={s.openPredictionBtnText}>{my ? "MST PREDICTION ဖွင့်မည်" : "OPEN MST PREDICTION"}</Text>
            </Pressable>
          </View>

          <DataList
            title={my ? "ခန့်မှန်းသူများ ဦးဆောင်သူဇယား" : "User Prediction Leaderboard"}
            eyebrow={my ? "ကမ္ဘာလုံးဆိုင်ရာ အဆင့်" : "GLOBAL RANKINGS"}
            data={state.leaderboard}
            empty={my ? "ခန့်မှန်းရမှတ်များ မရှိသေးပါ။ MST Prediction ကိုဖွင့်ပြီး စတင်ခန့်မှန်းပါ!" : "No prediction scores registered yet. Open MST Prediction to make your first pick!"}
            colors={colors}
          />
        </>
      ) : null}

      {subTab === "tips" ? (
        <>
          <DataList
            title={my ? "ရရှိထားသော Tips များ" : "Entitled tips"}
            eyebrow={my ? "အခွင့်အရေး" : "ENTITLEMENTS"}
            data={state.purchased}
            empty={my ? "ဤအကောင့်အတွက် ဝယ်ယူထားသော Tip မရှိသေးပါ။" : "No Tip entitlement is available for this signed-in account."}
            colors={colors}
          />
          <TipList
            data={state.tips}
            onPurchase={buyTip}
            purchaseState={purchaseState}
            purchaseEnabled={TIP_UNLOCK_ACTION_ENABLED}
            colors={colors}
            onOpenCredits={() => setSubTab("credits")}
          />
        </>
      ) : null}

      {subTab === "tipsters" ? (
        <>
          <DataList
            title={my ? "အတည်ပြုပြီး Tipsters များ" : "Verified Tipsters"}
            eyebrow="MST TIPSTERS"
            data={state.tipsters}
            empty={my ? "အတည်ပြုပြီး Tipsters များ မရှိသေးပါ။" : "No verified Tipsters are available."}
            colors={colors}
          />
        </>
      ) : null}

      {subTab === "rank" || subTab === "leaderboard" ? (
        <>
          <DataList
            title={my ? "Tipster အဆင့်သတ်မှတ်ချက်" : "Tipster Rankings"}
            eyebrow="OFFICIAL TIPSTER LEADERBOARD"
            data={state.tipsterLeaderboard}
            empty={my ? "Tipster အဆင့်သတ်မှတ်ချက် မရရှိနိုင်သေးပါ။" : "No Tipster rankings are available right now."}
            colors={colors}
          />
        </>
      ) : null}

      {state.warnings.map((warning, index) => (
        <Text key={`${warning}-${index}`} style={[s.warning, { color: colors.gold || C.amber }]}>
          {warning}
        </Text>
      ))}

      <Pressable onPress={retry} style={[s.retry, { backgroundColor: colors.raised || C.raised, borderColor: colors.border }]}>
        <Ionicons name="refresh" size={14} color={colors.secondary || colors.text} />
        <Text style={[s.retryText, { color: colors.secondary || colors.text }]}>Refresh</Text>
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
  loadingText: { color: C.muted, fontSize: 13 },
  boundary: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.green,
    backgroundColor: C.surface,
    padding: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  boundaryText: { color: C.muted, fontSize: 12.5, lineHeight: 17, flex: 1 },
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
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  segmentBtnActive: {
    backgroundColor: C.red,
  },
  segmentLabel: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
    includeFontPadding: false,
  },
  segmentLabelActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  card: {
    borderRadius: 13,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 10,
  },
  eyebrow: { color: C.red, fontSize: 11, fontWeight: "900", letterSpacing: 0.7 },
  title: { color: C.text, fontSize: 16, fontWeight: "900", marginTop: 3, marginBottom: 7 },
  row: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 8 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  rank: { width: 26, color: C.muted, fontSize: 12, fontWeight: "900" },
  name: { color: C.secondary, fontSize: 13.5, fontWeight: "800" },
  meta: { color: C.muted, fontSize: 12, marginTop: 2 },
  selection: { color: C.green, fontSize: 12, fontWeight: "900", maxWidth: 90 },
  empty: { color: C.muted, fontSize: 13, lineHeight: 18, paddingVertical: 8 },
  warning: { color: C.amber, fontSize: 12, lineHeight: 16, marginBottom: 5 },
  retry: {
    alignSelf: "flex-start",
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.raised,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  retryText: { color: C.secondary, fontSize: 12.5, fontWeight: "800" },
  buyButton: {
    minHeight: 36,
    minWidth: 70,
    borderRadius: 8,
    backgroundColor: C.red,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buyButtonDisabled: { opacity: 0.6 },
  buyText: { color: C.text, fontSize: 12, fontWeight: "900", letterSpacing: 0.3 },
  tipCardWrap: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  tipCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  tagBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  tipPickBox: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tipCardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 8,
    marginTop: 2,
  },
  webTipButton: {
    minHeight: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(244,200,77,0.3)",
    backgroundColor: "rgba(244,200,77,0.08)",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  webTipText: { color: C.amber, fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  freeTag: { color: C.green, fontSize: 12, fontWeight: "900" },
  purchaseSuccess: { color: C.green, fontSize: 12.5, lineHeight: 16, marginTop: 7 },
  purchaseError: { color: C.amber, fontSize: 12.5, lineHeight: 16, marginTop: 7 },
  predictionHeroCard: {
    borderRadius: 13,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 12,
  },
  predictionHeroHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  predictionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  predictionBadgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  predictionHeroTitle: { fontSize: 18, fontWeight: "900", marginBottom: 6 },
  predictionHeroDesc: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  predictionRulesRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  ruleChip: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.raised,
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  ruleChipBold: { fontSize: 13, fontWeight: "900" },
  ruleChipLabel: { fontSize: 10, marginTop: 2, fontWeight: "700" },
  openPredictionBtn: {
    minHeight: 42,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  openPredictionBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  creditQuickBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 6,
    marginBottom: 10,
  },
  creditQuickBtn: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  walletHeroCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  walletBalanceNum: {
    fontSize: 26,
    fontWeight: "900",
    marginTop: 4,
  },
  walletSub: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  creditCoin: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  coinText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  rateBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 8,
  },
  rateColumn: {
    alignItems: "center",
  },
  rateNum: {
    fontSize: 16,
    fontWeight: "900",
  },
  rateSub: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  rateEqual: {
    fontSize: 20,
    fontWeight: "900",
  },
  creditExplainText: {
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 4,
  },
  packGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  packCard: {
    width: "48%",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    position: "relative",
  },
  popularBadge: {
    position: "absolute",
    top: -8,
    right: 8,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  popularBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#000000",
  },
  packCreditsText: {
    fontSize: 24,
    fontWeight: "900",
    marginTop: 2,
  },
  packCreditsLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  packPriceText: {
    fontSize: 13,
    fontWeight: "800",
  },
  packPriceSub: {
    fontSize: 11,
    marginBottom: 8,
  },
  packBuyBtn: {
    width: "100%",
    borderRadius: 7,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  packBuyBtnText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  pendingCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  pendingTitle: {
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 3,
  },
  pendingText: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  purchaseToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  purchaseToastText: {
    fontSize: 12,
    fontWeight: "700",
  },
  historyToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  historyToggleText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txTypeBadge: {
    fontSize: 10.5,
    fontWeight: "900",
  },
  txItemName: {
    fontSize: 12.5,
    fontWeight: "700",
    flex: 1,
  },
  txDate: {
    fontSize: 10.5,
    color: "#9CA3AF",
    marginTop: 2,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: "900",
  },
  txStatus: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  countryTabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  countryLabel: {
    fontSize: 11.5,
    fontWeight: "800",
    marginRight: 2,
  },
  countryTabBtn: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  countryTabText: {
    fontSize: 11,
    fontWeight: "800",
  },
  paymentCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 14,
  },
  paymentCardTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  methodName: {
    fontSize: 12.5,
    fontWeight: "700",
    flex: 1,
  },
  confirmPayBtn: {
    minHeight: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  confirmPayBtnText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});