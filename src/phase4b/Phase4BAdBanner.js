import React, { useEffect, useState } from "react";
import { NativeModules, Platform, StyleSheet, TurboModuleRegistry, View } from "react-native";
import { gatherConsentIfRequired } from "../services/adConsentService";

const ENVIRONMENT = String(process.env.EXPO_PUBLIC_MST_ENVIRONMENT || "staging").trim().toLowerCase();
const ANDROID_BANNER_UNIT_ID = String(process.env.EXPO_PUBLIC_MST_ADMOB_ANDROID_BANNER_UNIT_ID || "").trim();
const IOS_BANNER_UNIT_ID = String(process.env.EXPO_PUBLIC_MST_ADMOB_IOS_BANNER_UNIT_ID || "").trim();

function configuredUnitId() {
  if (Platform.OS === "android") return ANDROID_BANNER_UNIT_ID;
  if (Platform.OS === "ios") return IOS_BANNER_UNIT_ID;
  return "";
}

class AdErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Silently collapse ad banner if native module fails or throws
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function Phase4BAdBanner() {
  const [failed, setFailed] = useState(false);
  const [canRequestAds, setCanRequestAds] = useState(false);
  const configured = configuredUnitId();
  const effectiveId = ENVIRONMENT === "production" ? configured : (configured || "test");

  // Verify native Google Mobile Ads module is actually linked in the native binary
  // before attempting consent or ad initialization.
  const hasNative = Boolean(
    NativeModules?.RNGoogleMobileAdsModule ||
    (typeof TurboModuleRegistry?.get === "function" && TurboModuleRegistry.get("RNGoogleMobileAdsModule"))
  );

  useEffect(() => {
    let active = true;

    if (!effectiveId || !hasNative) {
      setCanRequestAds(false);
      return () => { active = false; };
    }

    // Fail closed until UMP says an ad request is allowed. The helper refreshes
    // consent information and can fall back to a valid previous-session state
    // after an update error, but it never fabricates ad readiness.
    gatherConsentIfRequired().then(async (consentInfo) => {
      if (!active || !consentInfo?.canRequestAds) {
        if (active) setCanRequestAds(false);
        return;
      }

      try {
        const ads = require("react-native-google-mobile-ads");
        if (typeof ads?.default === "function") {
          await ads.default().initialize();
        }
        if (active) setCanRequestAds(true);
      } catch {
        if (active) setCanRequestAds(false);
      }
    }).catch(() => {
      if (active) setCanRequestAds(false);
    });

    return () => { active = false; };
  }, [effectiveId, hasNative]);

  // Never let missing advertising configuration, consent readiness, or native
  // initialization block Scores, live data, or navigation at runtime.
  if (!effectiveId || failed || !hasNative || !canRequestAds) return null;

  let ads;
  try {
    ads = require("react-native-google-mobile-ads");
  } catch {
    return null;
  }

  const { BannerAd, BannerAdSize, TestIds } = ads;
  const unitId = ENVIRONMENT === "production" ? configured : TestIds.BANNER;

  return (
    <AdErrorBoundary>
      <View style={s.wrap} accessibilityLabel="Advertisement">
        <BannerAd
          unitId={unitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdFailedToLoad={() => setFailed(true)}
        />
      </View>
    </AdErrorBoundary>
  );
}

const s = StyleSheet.create({
  wrap: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 16,
  },
});
