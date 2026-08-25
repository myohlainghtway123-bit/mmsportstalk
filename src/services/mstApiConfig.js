export const MST_SITE_ORIGIN = "https://myanmarsportstalk.com";
export const MST_API_ORIGIN = "https://app-api.myanmarsportstalk.com";
export const MST_API_BASE = `${MST_API_ORIGIN}/api`;
export const MST_FOOTBALL_API_BASE = `${MST_API_BASE}/football`;

export function mstApiUrl(path = "") {
  const clean = String(path || "");
  return `${MST_API_BASE}${clean.startsWith("/") ? clean : `/${clean}`}`;
}
