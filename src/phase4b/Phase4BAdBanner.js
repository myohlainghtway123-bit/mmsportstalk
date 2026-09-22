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
  const [ready, setReady] = useState(false);

  const hasNative = Boolean(
    NativeModules?.RNGoogleMobileAdsModule ||
    (typeof TurboModuleRegistry?.get === "function" && TurboModuleRegistry.get("RNGoogleMobileAdsModule"))
  );

  useEffect(() => {
    let active = true;
    if (!hasNative) return;

    const prepareAds = async () => {
      try {
        const consent = await gatherConsentIfRequired();
        if (!active || !consent?.canRequestAds) {
          if (active) setReady(false);
          return;
        }

        const ads = require("react-native-google-mobile-ads");
        if (typeof ads?.default === "function") {
          await ads.default().initialize();
        }
        if (active) setReady(true);
      } catch {
        if (active) setReady(false);
      }
    };

    prepareAds();

    return () => { active = false; };
  }, [hasNative]);

  const configured = configuredUnitId();
  const ads = (() => {
    try {
      return require("react-native-google-mobile-ads");
    } catch {
      return null;
    }
  })();

  if (failed || !hasNative || !ready || !ads) return null;

  const { BannerAd, BannerAdSize, TestIds } = ads;
  const unitId = ENVIRONMENT === "production" ? configured : TestIds.BANNER;
  if (!unitId) return null;

  return (
    <AdErrorBoundary>
      <View style={s.wrap} accessibilityLabel="Advertisement">
        <BannerAd
          unitId={unitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdFailedToLoad={(err) => {
            console.log("AdMob banner failed to load:", err?.message);
            setFailed(true);
          }}
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
