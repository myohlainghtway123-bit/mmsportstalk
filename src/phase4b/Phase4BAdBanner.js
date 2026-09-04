import React from "react";
import { Platform, StyleSheet, View } from "react-native";

const ENVIRONMENT = String(process.env.EXPO_PUBLIC_MST_ENVIRONMENT || "staging").trim().toLowerCase();
const ANDROID_BANNER_UNIT_ID = String(process.env.EXPO_PUBLIC_MST_ADMOB_ANDROID_BANNER_UNIT_ID || "").trim();
const IOS_BANNER_UNIT_ID = String(process.env.EXPO_PUBLIC_MST_ADMOB_IOS_BANNER_UNIT_ID || "").trim();

function configuredUnitId() {
  if (Platform.OS === "android") return ANDROID_BANNER_UNIT_ID;
  if (Platform.OS === "ios") return IOS_BANNER_UNIT_ID;
  return "";
}

export default function Phase4BAdBanner() {
  const configured = configuredUnitId();

  // Never let missing advertising configuration block Scores, live data, or
  // navigation at runtime. The release gate separately proves production IDs.
  if (!configured) return null;

  let ads;
  try {
    // Delay native-module access until an ad unit is actually configured. This
    // keeps local/staging JS checks deterministic while production EAS builds
    // include the native plugin through app.config.js.
    ads = require("react-native-google-mobile-ads");
  } catch {
    return null;
  }

  const { BannerAd, BannerAdSize, TestIds } = ads;
  const unitId = ENVIRONMENT === "production" ? configured : TestIds.BANNER;

  return (
    <View style={s.wrap} accessibilityLabel="Advertisement">
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 12,
  },
});
