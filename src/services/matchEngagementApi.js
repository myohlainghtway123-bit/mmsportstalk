import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import * as Device from "expo-device";

const API_BASE = "https://myanmarsportstalk.com/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch (_) { payload = { message: text }; }
  if (!response.ok) {
    const error = new Error(payload?.error || payload?.message || `MST API ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export const DEFAULT_MATCH_ALERTS = {
  enabled: false,
  beforeKickoff: true,
  kickoff: true,
  goals: true,
  redCards: true,
  halftime: true,
  final: true,
  lineups: true,
  odds: false,
};

export async function registerDeviceForPush() {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("match-alerts", {
        name: "Match alerts",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 140, 250],
        sound: "default",
      });
    }
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return { granted: false, reason: "permission" };
    if (!Device.isDevice) return { granted: true, remote: false, reason: "physical-device-required" };

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
    if (!projectId) return { granted: true, remote: false, reason: "project-id-missing" };
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!token) return { granted: true, remote: false, reason: "token-unavailable" };

    await api("/account/push-token", {
      method: "POST",
      body: {
        token,
        platform: Platform.OS,
        deviceName: Device.modelName || Device.deviceName || null,
      },
    });
    return { granted: true, remote: true, token };
  } catch (error) {
    return { granted: false, remote: false, reason: error?.message || "push-registration-failed", error };
  }
}

export async function scheduleKickoffReminders(match, settings = DEFAULT_MATCH_ALERTS) {
  if (!match?.id || !match?.kickoff) return [];
  const kickoff = new Date(match.kickoff).getTime();
  if (!Number.isFinite(kickoff) || kickoff <= Date.now()) return [];
  const ids = [];
  const title = `${match.home?.name || "Home"} vs ${match.away?.name || "Away"}`;

  if (settings.beforeKickoff && kickoff - Date.now() > 16 * 60 * 1000) {
    ids.push(await Notifications.scheduleNotificationAsync({
      content: { title: `15 min · ${title}`, body: match.competition || "MST Score", data: { matchId: String(match.id), type: "before-kickoff" }, sound: "default" },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(kickoff - 15 * 60 * 1000), channelId: Platform.OS === "android" ? "match-alerts" : undefined },
    }));
  }
  if (settings.kickoff) {
    ids.push(await Notifications.scheduleNotificationAsync({
      content: { title: `Kickoff · ${title}`, body: match.competition || "MST Score", data: { matchId: String(match.id), type: "kickoff" }, sound: "default" },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(kickoff), channelId: Platform.OS === "android" ? "match-alerts" : undefined },
    }));
  }
  return ids;
}

export async function getMatchAlert(matchId) {
  const payload = await api(`/account/match-alerts?matchId=${encodeURIComponent(String(matchId))}`);
  return payload?.data || null;
}

export async function saveMatchAlert(matchId, settings) {
  return api("/account/match-alerts", { method: "PUT", body: { matchId: String(matchId), ...settings } });
}

export async function removeMatchAlert(matchId) {
  return api("/account/match-alerts", { method: "DELETE", body: { matchId: String(matchId) } });
}

export async function getMatchPoll(matchId) {
  const payload = await api(`/football/matches/${encodeURIComponent(String(matchId))}/poll`);
  return payload?.data || null;
}

export async function voteMatchPoll(matchId, pick) {
  const payload = await api(`/football/matches/${encodeURIComponent(String(matchId))}/poll`, { method: "POST", body: { pick } });
  return payload?.data || null;
}
