const base = require("./app.json");

const readEnv = (name) => String(process.env[name] || "").trim();
const androidAppId = readEnv("MST_ADMOB_ANDROID_APP_ID");
const iosAppId = readEnv("MST_ADMOB_IOS_APP_ID");

const plugins = [...(base.expo.plugins || [])];

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
