import { getSessionToken } from "./accountApi";
import { MST_API_BASE } from "./mstApiConfig";

async function decode(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return { message: text }; }
}

function message(payload, fallback) {
  return payload?.error || payload?.message || payload?.detail || payload?.reason || fallback;
}

async function request(path, { method = "GET", body } = {}) {
  const token = await getSessionToken();
  const headers = {
    Accept: "application/json",
    "x-mst-client": "mobile-app",
    "Cache-Control": "no-cache",
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? {
      Authorization: `Bearer ${token}`,
      "x-mst-session": token,
      Cookie: `mst_user_session=${token}`,
    } : {}),
  };

  const response = await fetch(`${MST_API_BASE}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = await decode(response);
  if (!response.ok) {
    const error = new Error(message(payload, `MST notification request failed (${response.status})`));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export const getNotifications = ({ sync = true, limit = 40 } = {}) =>
  request(`/account/notifications?limit=${encodeURIComponent(limit)}&sync=${sync ? "1" : "0"}`);
export const getNotificationPreferences = () => request("/account/notifications/preferences");
export const saveNotificationPreferences = (preferences) =>
  request("/account/notifications/preferences", { method: "PUT", body: serializeNotificationPreferences(preferences) });
export const markNotificationsRead = (ids) =>
  request("/account/notifications", { method: "PATCH", body: { ids: Array.isArray(ids) ? ids.map(String).slice(0, 100) : [] } });
export const markAllNotificationsRead = () =>
  request("/account/notifications", { method: "PATCH", body: { readAll: true } });

function arrays(value, result = [], depth = 0) {
  if (value == null || depth > 5) return result;
  if (Array.isArray(value)) {
    result.push(value);
    value.slice(0, 10).forEach((item) => arrays(item, result, depth + 1));
  } else if (typeof value === "object") {
    Object.values(value).forEach((item) => arrays(item, result, depth + 1));
  }
  return result;
}

function largestArray(payload) {
  return arrays(payload).sort((a,b) => b.length - a.length)[0] || [];
}

export function normalizeNotifications(payload) {
  return largestArray(payload).map((row, index) => ({
    id: row?.id ?? row?.notificationId ?? `notification-${index}`,
    title: row?.title ?? row?.subject ?? row?.headline ?? "Myanmar Sports Talk",
    body: row?.body ?? row?.message ?? row?.text ?? row?.description ?? "",
    type: row?.kind ?? row?.type ?? row?.category ?? "update",
    read: Boolean(row?.readAt ?? row?.read_at ?? row?.read ?? row?.isRead ?? row?.seen),
    readAt: row?.readAt ?? row?.read_at ?? null,
    href: row?.href ?? row?.url ?? null,
    imageUrl: row?.imageUrl ?? row?.image_url ?? null,
    createdAt: row?.createdAt ?? row?.created_at ?? row?.date ?? row?.timestamp ?? null,
    raw: row,
  }));
}

export function notificationUnreadCount(payload) {
  const count = Number(payload?.unread ?? payload?.data?.unread ?? 0);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

function boolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

export function normalizeNotificationPreferences(payload) {
  const source = payload?.preferences || payload?.data?.preferences || payload?.data || payload || {};
  return {
    articleAlerts: boolean(source.articleAlerts ?? source.article_alerts, true),
    favoriteAlerts: boolean(source.favoriteAlerts ?? source.favorite_alerts, true),
    matchKickoff: boolean(source.matchKickoff ?? source.match_kickoff, true),
    matchGoals: boolean(source.matchGoals ?? source.match_goals, true),
    matchFinal: boolean(source.matchFinal ?? source.match_final, true),
    browserAlerts: boolean(source.browserAlerts ?? source.browser_alerts, false),
    updatedAt: source.updatedAt ?? source.updated_at ?? null,
  };
}

export function serializeNotificationPreferences(prefs) {
  return {
    articleAlerts: Boolean(prefs.articleAlerts),
    favoriteAlerts: Boolean(prefs.favoriteAlerts),
    matchKickoff: Boolean(prefs.matchKickoff),
    matchGoals: Boolean(prefs.matchGoals),
    matchFinal: Boolean(prefs.matchFinal),
    browserAlerts: Boolean(prefs.browserAlerts),
  };
}
