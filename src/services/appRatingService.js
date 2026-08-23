import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";

const LAUNCH_COUNT_KEY = "@mst_app_launch_count";
const RATING_STATUS_KEY = "@mst_app_rating_status";
const SNOOZE_LAUNCH_KEY = "@mst_app_rating_snooze_launch";

const PLAY_STORE_URL = "market://details?id=com.myanmarsportstalk.mst";
const PLAY_STORE_WEB_URL = "https://play.google.com/store/apps/details?id=com.myanmarsportstalk.mst";

export async function recordAppLaunch() {
  try {
    const rawCount = await AsyncStorage.getItem(LAUNCH_COUNT_KEY);
    const count = (parseInt(rawCount, 10) || 0) + 1;
    await AsyncStorage.setItem(LAUNCH_COUNT_KEY, String(count));
    return count;
  } catch (_) {
    return 1;
  }
}

export async function shouldShowAppRatingPrompt() {
  try {
    const status = await AsyncStorage.getItem(RATING_STATUS_KEY);
    if (status === "rated" || status === "dismissed") {
      return false;
    }
    const rawCount = await AsyncStorage.getItem(LAUNCH_COUNT_KEY);
    const count = parseInt(rawCount, 10) || 0;

    if (count < 3) {
      return false;
    }

    if (status === "later") {
      const rawSnooze = await AsyncStorage.getItem(SNOOZE_LAUNCH_KEY);
      const snoozeTarget = parseInt(rawSnooze, 10) || 0;
      if (count < snoozeTarget) {
        return false;
      }
    }

    return true;
  } catch (_) {
    return false;
  }
}

export async function handleRateNow() {
  try {
    await AsyncStorage.setItem(RATING_STATUS_KEY, "rated");
    const supported = await Linking.canOpenURL(PLAY_STORE_URL).catch(() => false);
    if (supported) {
      await Linking.openURL(PLAY_STORE_URL).catch(() => Linking.openURL(PLAY_STORE_WEB_URL));
    } else {
      await Linking.openURL(PLAY_STORE_WEB_URL).catch(() => {});
    }
  } catch (_) {}
}

export async function handleRateLater() {
  try {
    const rawCount = await AsyncStorage.getItem(LAUNCH_COUNT_KEY);
    const count = parseInt(rawCount, 10) || 0;
    await AsyncStorage.setItem(RATING_STATUS_KEY, "later");
    await AsyncStorage.setItem(SNOOZE_LAUNCH_KEY, String(count + 5)); // Ask again after 5 more launches
  } catch (_) {}
}

export async function handleRateNotNow() {
  try {
    await AsyncStorage.setItem(RATING_STATUS_KEY, "dismissed");
  } catch (_) {}
}
