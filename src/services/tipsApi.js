import { getSessionToken } from "./accountApi";

const API_BASE = "https://myanmarsportstalk.com/api";

async function decode(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return { message: text }; }
}

async function api(path, { method = "GET", body, signal } = {}) {
  const token = await getSessionToken().catch(() => null);
  const headers = {
    Accept: "application/json",
    "x-mst-client": "mobile-app",
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers["x-mst-session"] = token;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
  const payload = await decode(response);
  if (!response.ok) {
    const error = new Error(payload?.error || payload?.message || `MST Tips API ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload?.data ?? payload;
}

export const getTips = async ({ limit = 50, matchId, tipsterId } = {}) => {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  if (matchId) qs.set("matchId", String(matchId));
  if (tipsterId) qs.set("tipsterId", String(tipsterId));
  const data = await api(`/tips?${qs.toString()}`);
  if (!Array.isArray(data)) return data;
  return data.filter((tip) => !(tip?.purchaseClosed && tip?.locked));
};
export const unlockTip = (tipId) => api("/tips/unlock", { method:"POST", body:{ tipId:String(tipId) } });
export const getTipsMe = () => api("/tips/me");
export const getTipsters = ({ limit = 50 } = {}) => api(`/tipsters?limit=${encodeURIComponent(String(limit))}`);
export const applyTipster = (input) => api("/tipsters/apply", { method:"POST", body:input });
export const publishTip = (input) => api("/tips", { method:"POST", body:input });
export const requestTipsterPayout = ({ credits, currency }) => api("/tipsters/payout", { method:"POST", body:{ credits:Number(credits), currency:String(currency||"THB").toUpperCase() } });

export const getTipsterQualification = () => api("/tipsters/qualification");
export const startTipsterQualification = () => api("/tipsters/qualification", { method:"POST", body:{ action:"start" } });
export const submitQualificationTip = (input) => api("/tipsters/qualification", { method:"POST", body:{ ...input, action:"submit" } });

export const getTipsterPartner = () => api("/tipsters/partner");
export const applyTipsterPartner = (input) => api("/tipsters/partner", { method:"POST", body:input });
export const claimPartnerReferral = (code) => api("/partners/referral", { method:"POST", body:{ code:String(code||"").trim().toUpperCase() } });

export const rateTipsterApi = (tipsterId, rating, review) =>
  api(`/tips/tipsters/${encodeURIComponent(String(tipsterId))}/rate`, {
    method: "POST",
    body: { rating: Number(rating), review: review || null },
  });

export const getTipsterRatingApi = (tipsterId) =>
  api(`/tips/tipsters/${encodeURIComponent(String(tipsterId))}/rate`);

// Keep these fallbacks in lock-step with the server authority in lib/account/tips.ts.
export const TIPSTER_LEVEL_FALLBACK = {
  1:{ name:"Rookie", dailyTips:1, maxPrice:5 },
  2:{ name:"Rising", dailyTips:2, maxPrice:10 },
  3:{ name:"Pro", dailyTips:3, maxPrice:15 },
  4:{ name:"Elite", dailyTips:4, maxPrice:20 },
  5:{ name:"Master", dailyTips:5, maxPrice:25 },
};
export const TIP_PRICES = [5,10,15,20,25];
export const CREDIT_REFERENCE = { credits:100, thb:250 };
export const QUALIFICATION_RULES = { totalTips:10, minWins:7, maxTipsPerDay:2, cooldownDays:7 };
export const PARTNER_DEFAULTS = { commissionPercent:10, durationMonths:6 };
