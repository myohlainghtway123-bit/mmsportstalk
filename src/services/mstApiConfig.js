export const MST_SITE_ORIGIN = "https://myanmarsportstalk.com";

const PROD_API_ORIGIN = "https://app-api.myanmarsportstalk.com";
const STAGING_API_ORIGIN = "https://app-api-staging.myanmarsportstalk.com";

export function resolveMstApiOrigin() {
  const env = String(process.env.EXPO_PUBLIC_MST_ENVIRONMENT || "").trim().toLowerCase();
  const configured = String(process.env.EXPO_PUBLIC_MST_APP_API_ORIGIN || "").trim().replace(/\/+$/, "");

  if (env === "production") {
    const target = configured || PROD_API_ORIGIN;
    let url;
    try {
      url = new URL(target);
    } catch {
      throw new Error("PRODUCTION_API_ORIGIN_INVALID: must be a valid URL");
    }
    if (url.protocol !== "https:" || !/(^|\.)myanmarsportstalk\.com$/i.test(url.hostname)) {
      throw new Error("PRODUCTION_API_ORIGIN_INVALID: origin must be an HTTPS Myanmar Sports Talk host");
    }
    if (url.hostname.toLowerCase().includes("staging")) {
      throw new Error("PRODUCTION_STAGING_ORIGIN_BLOCKED: Production build cannot use a staging API origin");
    }
    return url.origin;
  }

  return configured || STAGING_API_ORIGIN;
}

// Canonical production origin declaration (MST_API_ORIGIN = "https://app-api.myanmarsportstalk.com")
export const MST_API_ORIGIN = resolveMstApiOrigin();
export const MST_API_BASE = `${MST_API_ORIGIN}/api`;
export const MST_FOOTBALL_API_BASE = `${MST_API_BASE}/football`;

export function mstApiUrl(path = "") {
  const clean = String(path || "");
  return `${MST_API_BASE}${clean.startsWith("/") ? clean : `/${clean}`}`;
}

