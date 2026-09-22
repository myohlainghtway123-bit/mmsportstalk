const base = require("./app.json");

const readEnv = (name) => String(process.env[name] || "").trim();
const environment = readEnv("EXPO_PUBLIC_MST_ENVIRONMENT").toLowerCase();
const PRODUCTION_ANDROID_ADMOB_APP_ID = "ca-app-pub-4446937986150717~8877382465";
const androidAppId = readEnv("MST_ADMOB_ANDROID_APP_ID")
  || (environment === "production" ? PRODUCTION_ANDROID_ADMOB_APP_ID : "");
const iosAppId = readEnv("MST_ADMOB_IOS_APP_ID");

const plugins = [...(base.expo.plugins || [])];

if (!plugins.some((plugin) => plugin === "react-native-iap" || (Array.isArray(plugin) && plugin[0] === "react-native-iap"))) {
  plugins.push("react-native-iap");
}

if (!plugins.some((plugin) => Array.isArray(plugin) && plugin[0] === "expo-build-properties")) {
  plugins.push([
    "expo-build-properties",
    {
      android: {
        kotlinVersion: "2.1.20",
      },
    },
  ]);
}

// AdMob App IDs are public native manifest identifiers, not secrets.
// Production Android must always include the canonical App ID so the native
// Google Mobile Ads SDK cannot crash at startup when EAS environment variables
// are incomplete. Unit IDs remain environment-managed.
if (androidAppId || iosAppId) {
  plugins.push([
    "react-native-google-mobile-ads",
    {
      ...(androidAppId ? { androidAppId } : {}),
      ...(iosAppId ? { iosAppId } : {}),
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
