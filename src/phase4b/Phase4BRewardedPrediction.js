import React, { useCallback, useEffect, useState } from "react";
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
import { gatherConsentIfRequired } from "../services/adConsentService";
import { loadMstMatchPrediction } from "../services/mstPredictionApi";

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

function scoreValue(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 20 ? n : null;
}

function confidenceValue(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null;
}

export default function Phase4BRewardedPrediction({ match, language = "my", colors = C }) {
  const my = language === "my";
  const matchId = String(match?.id || match?.match_id || "").trim();

  const [prediction, setPrediction] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(Boolean(matchId));
  const [unlocked, setUnlocked] = useState(false);
  const [loadingAd, setLoadingAd] = useState(false);
  const [adError, setAdError] = useState(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    setPrediction(null);
    setPredictionLoading(Boolean(matchId));

    if (!matchId) {
      setPredictionLoading(false);
      return () => controller.abort();
    }

    loadMstMatchPrediction(matchId, { signal: controller.signal, language })
      .then((value) => {
        if (!active) return;
        setPrediction(value || null);
      })
      .catch((error) => {
        if (!active || error?.name === "AbortError") return;
        setPrediction(null);
      })
      .finally(() => {
        if (active) setPredictionLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [matchId, language]);

  useEffect(() => {
    let alive = true;
    setUnlocked(false);
    if (!matchId) return () => { alive = false; };

    AsyncStorage.getItem(`mst:prediction:unlocked:${matchId}`)
      .then((val) => {
        if (!alive || !val) return;
        const ts = Number(val);
        if (Number.isFinite(ts) && Date.now() - ts < UNLOCK_DURATION_MS) {
          setUnlocked(true);
        }
      })
      .catch(() => {});

    return () => { alive = false; };
  }, [matchId]);

  const handleEarnedReward = useCallback(async () => {
    setUnlocked(true);
    setLoadingAd(false);
    setAdError(null);
    if (matchId) {
      await AsyncStorage.setItem(`mst:prediction:unlocked:${matchId}`, String(Date.now())).catch(() => {});
    }
  }, [matchId]);

  const triggerWatchAd = useCallback(async () => {
    if (!prediction || loadingAd) return;

    setLoadingAd(true);
    setAdError(null);

    const consent = await gatherConsentIfRequired().catch(() => ({ canRequestAds: false }));
    if (!consent?.canRequestAds) {
      setLoadingAd(false);
      setAdError(
        my
          ? "ကြော်ငြာ privacy အတည်ပြုချက် မရရှိသေးပါ။ ခန့်မှန်းချက်ကို မဖွင့်သေးပါ။"
          : "Ad privacy readiness is not available yet. Prediction remains locked.",
      );
      return;
    }

    let ads = null;
    try {
      ads = require("react-native-google-mobile-ads");
    } catch (_) {
      ads = null;
    }

    const {
      RewardedAd,
      RewardedAdEventType,
      AdEventType,
      TestIds,
    } = ads || {};

    if (!RewardedAd || !RewardedAdEventType || !AdEventType || !TestIds) {
      setLoadingAd(false);
      setAdError(
        my
          ? "Rewarded Ad module မရရှိပါ။ ခန့်မှန်းချက်ကို မဖွင့်သေးပါ။"
          : "Rewarded Ad module is unavailable. Prediction remains locked.",
      );
      return;
    }

    try {
      if (typeof ads?.default === "function") {
        await ads.default().initialize();
      }
    } catch (_) {
      setLoadingAd(false);
      setAdError(
        my
          ? "AdMob စနစ်ကို စတင်၍မရပါ။ ခန့်မှန်းချက်ကို မဖွင့်သေးပါ။"
          : "AdMob could not initialize. Prediction remains locked.",
      );
      return;
    }

    const environment = String(process.env.EXPO_PUBLIC_MST_ENVIRONMENT || "staging").trim().toLowerCase();
    const configuredRewardedId = Platform.OS === "android"
      ? String(process.env.EXPO_PUBLIC_MST_ADMOB_ANDROID_REWARDED_UNIT_ID || "").trim()
      : String(process.env.EXPO_PUBLIC_MST_ADMOB_IOS_REWARDED_UNIT_ID || "").trim();

    const adUnitId = environment === "production"
      ? configuredRewardedId
      : (configuredRewardedId || TestIds.REWARDED);

    if (!adUnitId) {
      setLoadingAd(false);
      setAdError(
        my
          ? "Production Rewarded Ad ID မရရှိသေးပါ။ ခန့်မှန်းချက်ကို မဖွင့်သေးပါ။"
          : "Production Rewarded Ad ID is unavailable. Prediction remains locked.",
      );
      return;
    }

    try {
      const rewarded = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      let settled = false;
      let earned = false;
      let timeout = null;
      let unsubscribeLoaded = null;
      let unsubscribeEarned = null;
      let unsubscribeClosed = null;
      let unsubscribeError = null;

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        unsubscribeLoaded?.();
        unsubscribeEarned?.();
        unsubscribeClosed?.();
        unsubscribeError?.();
      };

      unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        if (settled) return;
        rewarded.show().catch(() => {
          if (settled) return;
          settled = true;
          cleanup();
          setLoadingAd(false);
          setAdError(
            my
              ? "Rewarded video ကို ပြသ၍မရပါ။ ထပ်စမ်းပါ။"
              : "Rewarded video could not be shown. Please retry.",
          );
        });
      });

      unsubscribeEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        if (settled) return;
        earned = true;
        settled = true;
        cleanup();
        handleEarnedReward();
      });

      unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        if (settled || earned) return;
        settled = true;
        cleanup();
        setLoadingAd(false);
        setAdError(
          my
            ? "Reward မရမီ video ပိတ်လိုက်သောကြောင့် ခန့်မှန်းချက် မဖွင့်ပါ။"
            : "The video was closed before the reward was earned, so the prediction remains locked.",
        );
      });

      unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
        if (settled) return;
        settled = true;
        cleanup();
        setLoadingAd(false);
        setAdError(
          my
            ? "Rewarded Ad ယာယီမရရှိနိုင်ပါ။ ထပ်စမ်းပါ။"
            : "Rewarded Ad is temporarily unavailable. Please retry.",
        );
      });

      timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        setLoadingAd(false);
        setAdError(
          my
            ? "Rewarded Ad load အချိန်ကျော်သွားပါပြီ။ ထပ်စမ်းပါ။"
            : "Rewarded Ad timed out. Please retry.",
        );
      }, 12000);

      rewarded.load();
    } catch (_) {
      setLoadingAd(false);
      setAdError(
        my
          ? "Rewarded Ad စနစ် ချိတ်ဆက်မှု မရရှိပါ။ ထပ်စမ်းပါ။"
          : "Rewarded Ad service is unavailable. Please retry.",
      );
    }
  }, [prediction, loadingAd, my, handleEarnedReward]);

  if (predictionLoading || !prediction) return null;

  const homeName = String(prediction?.homeTeam || match?.home_team_name || match?.homeTeam?.name || "Home Team");
  const awayName = String(prediction?.awayTeam || match?.away_team_name || match?.awayTeam?.name || "Away Team");
  const homeScore = scoreValue(prediction?.predictedHomeScore);
  const awayScore = scoreValue(prediction?.predictedAwayScore);
  const confidence = confidenceValue(prediction?.confidence);
  const reasoning = String(prediction?.reasoning || "").trim();

  if (homeScore === null || awayScore === null || !reasoning) return null;

  return (
    <View style={[s.card, { backgroundColor: colors.surface || C.surface, borderColor: colors.border || C.border }]}>
      <View style={s.topRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          <Ionicons name="sparkles" size={15} color={colors.gold || C.gold} />
          <Text numberOfLines={1} style={[s.eyebrow, { color: colors.gold || C.gold, flex: 1 }]}>
            {my ? "MST ပွဲစဉ် သီးသန့် ခန့်မှန်းချက်" : "MST MATCH PREDICTION"}
          </Text>
        </View>
        {unlocked ? (
          <View style={[s.unlockedBadge, { backgroundColor: "rgba(16,185,129,0.15)", borderColor: colors.green || C.green }]}>
            <Ionicons name="checkmark-circle" size={12} color={colors.green || C.green} />
            <Text style={[s.unlockedText, { color: colors.green || C.green }]}>
              {my ? "UNLOCKED" : "UNLOCKED"}
            </Text>
          </View>
        ) : null}
      </View>

      {!unlocked ? (
        <View style={s.lockedContent}>
          <Text style={[s.lockedTitle, { color: colors.text || C.text }]}>
            {my ? `${homeName} vs ${awayName} MST ခန့်မှန်းချက်` : `${homeName} vs ${awayName} MST Forecast`}
          </Text>
          <Text style={[s.lockedDesc, { color: colors.muted || C.muted }]}>
            {my
              ? "MST မှ ထုတ်ပြန်ထားသော ပွဲရလဒ်ခန့်မှန်းချက်နှင့် သုံးသပ်ချက်ကို ကြည့်ရန် rewarded video တစ်ခု အပြည့်ကြည့်ပါ။"
              : "Watch one rewarded video to unlock the published MST score forecast and analysis for this match."}
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
                  {my ? "ဗီဒီယိုကြည့်ပြီး ခန့်မှန်းချက် ဖွင့်မည်" : "WATCH VIDEO TO UNLOCK"}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={s.forecastBody}>
          <Text style={[s.sectionSubtitle, { color: colors.muted || C.muted }]}>
            {my ? "MST ထုတ်ပြန်ထားသော ခန့်မှန်းရလဒ်" : "Published MST Score Forecast"}
          </Text>

          <View style={[s.scoreForecast, { backgroundColor: colors.raised || C.raised, borderColor: colors.border || C.border }]}>
            <View style={s.scoreTeam}>
              <Text numberOfLines={1} style={[s.scoreTeamName, { color: colors.secondary || C.secondary }]}>{homeName}</Text>
              <Text style={[s.scoreNumber, { color: colors.text || C.text }]}>{homeScore}</Text>
            </View>
            <Text style={[s.scoreDash, { color: colors.muted || C.muted }]}>–</Text>
            <View style={s.scoreTeam}>
              <Text numberOfLines={1} style={[s.scoreTeamName, { color: colors.secondary || C.secondary }]}>{awayName}</Text>
              <Text style={[s.scoreNumber, { color: colors.text || C.text }]}>{awayScore}</Text>
            </View>
          </View>

          {confidence !== null ? (
            <Text style={[s.confidence, { color: colors.gold || C.gold }]}>
              {my ? `MST Editorial Confidence: ${confidence}%` : `MST Editorial Confidence: ${confidence}%`}
            </Text>
          ) : null}

          <View style={[s.adviceBox, { backgroundColor: colors.raised || C.raised, borderColor: colors.border || C.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 }}>
              <Ionicons name="document-text-outline" size={15} color={colors.gold || C.gold} />
              <Text style={[s.adviceTitle, { color: colors.text || C.text }]}>
                {my ? "MST သုံးသပ်ချက်" : "MST Analysis"}
              </Text>
            </View>
            <Text style={[s.adviceText, { color: colors.secondary || C.secondary }]}>{reasoning}</Text>
          </View>

          <Text style={[s.disclaimer, { color: colors.muted || C.muted }]}>
            {my
              ? "ခန့်မှန်းချက်သည် အယ်ဒီတာအမြင်ဖြစ်ပြီး အာမခံချက်မဟုတ်ပါ။"
              : "This forecast is editorial analysis, not a guarantee."}
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
  scoreForecast: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },
  scoreTeam: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  scoreTeamName: {
    fontSize: 11.5,
    fontWeight: "700",
    maxWidth: 120,
  },
  scoreNumber: {
    fontSize: 26,
    fontWeight: "900",
  },
  scoreDash: {
    fontSize: 20,
    fontWeight: "900",
    paddingHorizontal: 8,
  },
  confidence: {
    fontSize: 11.5,
    fontWeight: "800",
    marginBottom: 10,
  },
  adviceBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  adviceTitle: {
    fontSize: 12,
    fontWeight: "800",
  },
  adviceText: {
    fontSize: 12,
    lineHeight: 17,
  },
  disclaimer: {
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 8,
  },
});
