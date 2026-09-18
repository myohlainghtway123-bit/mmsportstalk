const base = require("./app.json");

const readEnv = (name) => String(process.env[name] || "").trim();

// Use environment variables when provided for production releases; fall back to
// Google's official public sample/test App IDs for internal/preview/staging builds
// so the generated AndroidManifest always contains the required application ID
// and the native Google Mobile Ads SDK never throws an IllegalStateException on startup.
const GOOGLE_TEST_ANDROID_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const GOOGLE_TEST_IOS_APP_ID = "ca-app-pub-3940256099942544~1458002511";

const androidAppId = readEnv("MST_ADMOB_ANDROID_APP_ID") || GOOGLE_TEST_ANDROID_APP_ID;
const iosAppId = readEnv("MST_ADMOB_IOS_APP_ID") || GOOGLE_TEST_IOS_APP_ID;

const plugins = [...(base.expo.plugins || [])];

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

module.exports = {
  expo: {
    ...base.expo,
    plugins,
  },
};
