const API_BASE = "https://myanmarsportstalk.com/api";

async function decode(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return { message: text }; }
}

function message(payload, fallback) {
  return payload?.error || payload?.message || payload?.detail || payload?.reason || fallback;
}

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
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

export const getNotifications = () => request("/account/notifications");
export const getNotificationPreferences = () => request("/account/notifications/preferences");

export async function saveNotificationPreferences(preferences) {
  const attempts = [
    { method: "PUT", body: preferences },
    { method: "POST", body: preferences },
    { method: "PATCH", body: preferences },
    { method: "PUT", body: { preferences } },
    { method: "POST", body: { preferences } },
  ];
  let last;
  for (const attempt of attempts) {
    try { return await request("/account/notifications/preferences", attempt); }
    catch (error) {
      last = error;
      if (error.status === 401 || error.status >= 500 || ![400,404,405,409,422].includes(error.status)) throw error;
    }
  }
  throw last || new Error("Unable to save notification preferences.");
}

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
    type: row?.type ?? row?.category ?? "update",
    read: Boolean(row?.read ?? row?.isRead ?? row?.seen),
    createdAt: row?.createdAt ?? row?.created_at ?? row?.date ?? row?.timestamp ?? null,
    raw: row,
  }));
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
    breakingNews: boolean(source.breakingNews ?? source.breaking_news ?? source.news ?? source.articleNotifications, true),
    liveScores: boolean(source.liveScores ?? source.live_scores ?? source.scores ?? source.matchNotifications, true),
    transfers: boolean(source.transfers ?? source.transferNews ?? source.transfer_news, true),
    predictions: boolean(source.predictions ?? source.predictionResults ?? source.prediction_results, true),
  };
}

export function serializeNotificationPreferences(prefs) {
  return {
    breakingNews: Boolean(prefs.breakingNews),
    liveScores: Boolean(prefs.liveScores),
    transfers: Boolean(prefs.transfers),
    predictions: Boolean(prefs.predictions),
    news: Boolean(prefs.breakingNews),
    scores: Boolean(prefs.liveScores),
  };
}
