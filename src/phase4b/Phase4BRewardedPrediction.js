import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

const C = {
  bg: "#0B0E14",
  surface: "#121824",
  raised: "#1B2234",
  border: "#263248",
  text: "#F3F4F6",
  secondary: "#D1D5DB",
  muted: "#9CA3AF",
  red: "#F3262D",
  green: "#10B981",
  gold: "#F59E0B",
};

const UNLOCK_DURATION_MS = 24 * 60 * 60 * 1000;
const AD_LOAD_TIMEOUT_MS = 12_000;

function asPredictionText(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return value.map(asPredictionText).filter(Boolean).join(" · ");
  if (typeof value === "object") {
    const direct =
      value.text ||
      value.summary ||
      value.analysis ||
      value.reasoning ||
      value.prediction ||
      value.pick ||
      value.selection ||
      value.value;
    if (direct) return asPredictionText(direct);

    const homeScore = Number(value.homeScore ?? value.home_score);
    const awayScore = Number(value.awayScore ?? value.away_score);
    if (Number.isFinite(homeScore) && Number.isFinite(awayScore)) {
      const homeTeam = String(value.homeTeam || value.home_team || "Home").trim();
      const awayTeam = String(value.awayTeam || value.away_team || "Away").trim();
      const confidence = Number(value.confidence);
      return `${homeTeam} ${homeScore}–${awayScore} ${awayTeam}${Number.isFinite(confidence) ? ` · Confidence ${confidence}%` : ""}`;
    }
  }
  return "";
}

function mstPredictionForMatch(match) {
  const candidates = [
    match?.mst_admin_prediction,
    match?.mstAdminPrediction,
    match?.mst_ai_prediction,
    match?.mstAiPrediction,
    match?.premium_prediction,
    match?.premiumPrediction,
    match?.editorial_prediction,
    match?.editorialPrediction,
  ];

  for (const candidate of candidates) {
    const text = asPredictionText(candidate);
    if (text) return text;
  }
  return "";
}

export default function Phase4BRewardedPrediction({ match, language = "my", colors = C }) {
  const my = language === "my";
  const matchId = String(match?.id || match?.match_id || "").trim();
  const predictionText = useMemo(() => mstPredictionForMatch(match), [match]);
  const hasPublishedPrediction = Boolean(predictionText);

  const [unlocked, setUnlocked] = useState(false);
  const [loadingAd, setLoadingAd] = useState(false);
  const [adError, setAdError] = useState(null);
  const cleanupRef = useRef(() => {});
  const attemptRef = useRef(0);

  useEffect(() => {
    let alive = true;
    if (!matchId) return () => {};

    AsyncStorage.getItem(`mst:prediction:unlocked:${matchId}`)
      .then((val) => {
        if (!alive || !val) return;
        const ts = Number(val);
        if (Number.isFinite(ts) && Date.now() - ts < UNLOCK_DURATION_MS) {
          setUnlocked(true);
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [matchId]);

  useEffect(() => () => {
    cleanupRef.current?.();
  }, []);

  const cleanupAdListeners = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = () => {};
  }, []);

  const handleEarnedReward = useCallback(async () => {
    cleanupAdListeners();
    setUnlocked(true);
    setLoadingAd(false);
    setAdError(null);
    if (matchId) {
      await AsyncStorage.setItem(
        `mst:prediction:unlocked:${matchId}`,
        String(Date.now()),
      ).catch(() => {});
    }
  }, [cleanupAdListeners, matchId]);

  const triggerWatchAd = useCallback(async () => {
    if (!hasPublishedPrediction || loadingAd) return;

    cleanupAdListeners();
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    setLoadingAd(true);
    setAdError(null);

    let ads;
    try {
      ads = require("react-native-google-mobile-ads");
    } catch (_) {
      ads = null;
    }

    const RewardedAd = ads?.RewardedAd;
    const RewardedAdEventType = ads?.RewardedAdEventType;
    const AdEventType = ads?.AdEventType;
    const TestIds = ads?.TestIds;

    if (!RewardedAd || !RewardedAdEventType) {
      setLoadingAd(false);
      setAdError(
        my
          ? "Rewarded ad service ကို ယာယီမရရှိနိုင်ပါ။ ခန့်မှန်းချက်ကို မဖွင့်ရသေးပါ။"
          : "Rewarded ad service is currently unavailable. The prediction remains locked.",
      );
      return;
    }

    const isProduction = String(process.env.EXPO_PUBLIC_MST_ENVIRONMENT || "")
      .trim()
      .toLowerCase() === "production";

    const configuredRewardedId = Platform.OS === "android"
      ? String(process.env.EXPO_PUBLIC_MST_ADMOB_ANDROID_REWARDED_UNIT_ID || "").trim()
      : String(process.env.EXPO_PUBLIC_MST_ADMOB_IOS_REWARDED_UNIT_ID || "").trim();

    const adUnitId = isProduction
      ? configuredRewardedId
      : (configuredRewardedId || TestIds?.REWARDED || "");

    if (!adUnitId) {
      setLoadingAd(false);
      setAdError(
        my
          ? "Rewarded Ad Unit ID မရရှိသေးပါ။ ခန့်မှန်းချက်ကို မဖွင့်ရသေးပါ။"
          : "Rewarded Ad Unit ID is unavailable. The prediction remains locked.",
      );
      return;
    }

    try {
      const rewarded = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      let rewardEarned = false;
      let loadTimer = null;

      const unsubscribers = [];
      const finishWithoutReward = (message) => {
        if (attemptRef.current !== attempt || rewardEarned) return;
        if (loadTimer) clearTimeout(loadTimer);
        unsubscribers.forEach((fn) => {
          try { fn?.(); } catch (_) {}
        });
        cleanupRef.current = () => {};
        setLoadingAd(false);
        setAdError(message);
      };

      unsubscribers.push(
        rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
          if (attemptRef.current !== attempt) return;
          if (loadTimer) clearTimeout(loadTimer);
          setLoadingAd(false);
          rewarded.show().catch(() => {
            finishWithoutReward(
              my
                ? "ကြော်ငြာကို ပြသ၍မရပါ။ Video ကို ပြီးဆုံးအောင်ကြည့်မှသာ ခန့်မှန်းချက်ဖွင့်ပါမည်။"
                : "The ad could not be shown. The prediction unlocks only after the rewarded video is completed.",
            );
          });
        }),
      );

      unsubscribers.push(
        rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          if (attemptRef.current !== attempt) return;
          rewardEarned = true;
          handleEarnedReward();
        }),
      );

      if (AdEventType?.ERROR) {
        unsubscribers.push(
          rewarded.addAdEventListener(AdEventType.ERROR, () => {
            finishWithoutReward(
              my
                ? "ကြော်ငြာ ယာယီမရရှိနိုင်ပါ။ ခန့်မှန်းချက်ကို မဖွင့်ရသေးပါ။"
                : "The rewarded ad is temporarily unavailable. The prediction remains locked.",
            );
          }),
        );
      }

      if (AdEventType?.CLOSED) {
        unsubscribers.push(
          rewarded.addAdEventListener(AdEventType.CLOSED, () => {
            if (!rewardEarned) {
              finishWithoutReward(
                my
                  ? "Video ကို ပြီးဆုံးအောင်မကြည့်ရသေးပါ။ ခန့်မှန်းချက်ကို မဖွင့်ရသေးပါ။"
                  : "The video was closed before the reward was earned. The prediction remains locked.",
              );
            }
          }),
        );
      }

      cleanupRef.current = () => {
        if (loadTimer) clearTimeout(loadTimer);
        unsubscribers.forEach((fn) => {
          try { fn?.(); } catch (_) {}
        });
      };

      loadTimer = setTimeout(() => {
        finishWithoutReward(
          my
            ? "ကြော်ငြာ load အချိန်ကျော်သွားပါသည်။ ပြန်စမ်းနိုင်ပါသည်။"
            : "The rewarded ad timed out. Please try again.",
        );
      }, AD_LOAD_TIMEOUT_MS);

      rewarded.load();
    } catch (_) {
      cleanupAdListeners();
      setLoadingAd(false);
      setAdError(
        my
          ? "Rewarded ad စနစ်ချိတ်ဆက်မှု မအောင်မြင်ပါ။ ခန့်မှန်းချက်ကို မဖွင့်ရသေးပါ။"
          : "Rewarded ad initialization failed. The prediction remains locked.",
      );
    }
  }, [
    cleanupAdListeners,
    handleEarnedReward,
    hasPublishedPrediction,
    loadingAd,
    my,
  ]);

  if (!matchId) return null;

  const homeName =
    match?.home?.name ||
    match?.home_team_name ||
    match?.homeTeam?.name ||
    "Home Team";
  const awayName =
    match?.away?.name ||
    match?.away_team_name ||
    match?.awayTeam?.name ||
    "Away Team";

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: colors.surface || colors.card || C.surface,
          borderColor: colors.border || C.border,
        },
      ]}
    >
      <View style={s.topRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          <Ionicons name="sparkles" size={15} color={colors.gold || C.gold} />
          <Text style={[s.eyebrow, { color: colors.gold || C.gold }]}>
            {my ? "MST ပွဲစဉ် ခန့်မှန်းချက်" : "MST MATCH FORECAST"}
          </Text>
        </View>
        {unlocked && hasPublishedPrediction ? (
          <View
            style={[
              s.unlockedBadge,
              {
                backgroundColor: "rgba(16,185,129,0.15)",
                borderColor: colors.green || C.green,
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={12} color={colors.green || C.green} />
            <Text style={[s.unlockedText, { color: colors.green || C.green }]}>
              {my ? "ဖွင့်ပြီး" : "UNLOCKED"}
            </Text>
          </View>
        ) : null}
      </View>

      {!hasPublishedPrediction ? (
        <View style={s.lockedContent}>
          <Text style={[s.lockedTitle, { color: colors.text || C.text }]}>
            {homeName} vs {awayName}
          </Text>
          <Text style={[s.lockedDesc, { color: colors.muted || C.muted, marginBottom: 0 }]}>
            {my
              ? "ဤပွဲအတွက် MST ခန့်မှန်းချက် မထုတ်ပြန်ရသေးပါ။ ခန့်မှန်းချက်ရှိမှသာ Rewarded Video ခလုတ်ကို ပြပါမည်။"
              : "No MST forecast has been published for this match yet. A rewarded video is offered only when real MST forecast content exists."}
          </Text>
        </View>
      ) : !unlocked ? (
        <View style={s.lockedContent}>
          <Text style={[s.lockedTitle, { color: colors.text || C.text }]}>
            {my
              ? `${homeName} vs ${awayName} MST ခန့်မှန်းချက်`
              : `${homeName} vs ${awayName} MST Forecast`}
          </Text>
          <Text style={[s.lockedDesc, { color: colors.muted || C.muted }]}>
            {my
              ? "MST ထုတ်ပြန်ထားသော ပွဲစဉ်ခန့်မှန်းချက်ကို ဖွင့်ရန် Rewarded Video ကို ပြီးဆုံးအောင်ကြည့်ပါ။"
              : "Watch the rewarded video to completion to unlock the published MST match forecast."}
          </Text>

          {adError ? (
            <Text style={[s.adErrorText, { color: colors.gold || C.gold }]}>{adError}</Text>
          ) : null}

          <Pressable
            disabled={loadingAd}
            onPress={triggerWatchAd}
            style={({ pressed }) => [
              s.watchBtn,
              { backgroundColor: colors.red || C.red },
              pressed && { opacity: 0.8 },
              loadingAd && { opacity: 0.7 },
            ]}
          >
            {loadingAd ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Ionicons name="play-circle" size={18} color="#FFFFFF" />
                <Text style={s.watchBtnText}>
                  {my ? "VIDEO ကြည့်ပြီး ဖွင့်မည်" : "WATCH VIDEO TO UNLOCK"}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={s.forecastBody}>
          <Text style={[s.sectionSubtitle, { color: colors.muted || C.muted }]}>
            {my ? "MST ထုတ်ပြန်ထားသော ခန့်မှန်းချက်" : "Published MST Forecast"}
          </Text>
          <View
            style={[
              s.adviceBox,
              {
                backgroundColor: colors.raised || C.raised,
                borderColor: colors.border || C.border,
              },
            ]}
          >
            <Text style={[s.adviceText, { color: colors.secondary || C.secondary }]}>
              {predictionText}
            </Text>
          </View>
          <Text style={[s.disclaimer, { color: colors.muted || C.muted }]}>
            {my
              ? "MST ခန့်မှန်းချက်သည် ဘောလုံးသုံးသပ်ချက်သာဖြစ်ပြီး ရလဒ်အာမခံချက်မဟုတ်ပါ။"
              : "MST forecasts are football analysis, not guaranteed outcomes."}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  unlockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  unlockedText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  lockedContent: {
    paddingVertical: 4,
  },
  lockedTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  lockedDesc: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 12,
  },
  adErrorText: {
    fontSize: 11.5,
    marginBottom: 8,
    fontWeight: "700",
    lineHeight: 16,
  },
  watchBtn: {
    minHeight: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  watchBtnText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  forecastBody: {
    paddingTop: 4,
  },
  sectionSubtitle: {
    fontSize: 11.5,
    fontWeight: "700",
    marginBottom: 8,
  },
  adviceBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 11,
  },
  adviceText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  disclaimer: {
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 8,
  },
});
