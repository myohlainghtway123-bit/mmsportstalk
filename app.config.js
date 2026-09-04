const base = require("./app.json");

const readEnv = (name) => String(process.env[name] || "").trim();
const androidAppId = readEnv("MST_ADMOB_ANDROID_APP_ID");
const iosAppId = readEnv("MST_ADMOB_IOS_APP_ID");
const androidBannerUnitId = readEnv("EXPO_PUBLIC_MST_ADMOB_ANDROID_BANNER_UNIT_ID");
const iosBannerUnitId = readEnv("EXPO_PUBLIC_MST_ADMOB_IOS_BANNER_UNIT_ID");
const requireProductionAds = readEnv("MST_REQUIRE_PRODUCTION_ADS").toLowerCase() === "true";

const plugins = [...(base.expo.plugins || [])];

// EAS production store builds explicitly opt into this guard. Local/staging
// exports remain deterministic and can run without production advertising IDs.
if (requireProductionAds) {
  const required = {
    MST_ADMOB_ANDROID_APP_ID: androidAppId,
    MST_ADMOB_IOS_APP_ID: iosAppId,
    EXPO_PUBLIC_MST_ADMOB_ANDROID_BANNER_UNIT_ID: androidBannerUnitId,
    EXPO_PUBLIC_MST_ADMOB_IOS_BANNER_UNIT_ID: iosBannerUnitId,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(`MST production AdMob configuration is incomplete. Missing: ${missing.join(", ")}`);
  }
}

// Keep AdMob identifiers out of source control. EAS/GitHub release environments
// provide the platform app IDs; native AdMob configuration is added only when
// both values are present, so local/staging exports remain deterministic.
if (androidAppId && iosAppId) {
  plugins.push([
    "react-native-google-mobile-ads",
    {
      androidAppId,
      iosAppId,
      // UMP consent is checked before Mobile Ads initialization/ad requests.
      // Delay native app measurement so EEA users are not measured before that flow.
      delayAppMeasurementInit: true,
    },
  ]);
}

module.exports = {
  expo: {
    ...base.expo,
    plugins,
  },
};
