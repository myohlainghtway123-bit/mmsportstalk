import { getSessionToken } from "./accountApi";
import { MST_API_BASE } from "./mstApiConfig";

async function api(path, { method = "GET", body } = {}) {
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

  const response = await fetch(`${MST_API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_) {
    payload = { message: text };
  }

  if (!response.ok) {
    const error = new Error(payload?.error || payload?.message || `Billing API ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload?.data ?? payload;
}

function normalizeCreditPackage(pkg) {
  if (!pkg || typeof pkg !== "object") return null;
  const id = String(pkg.id || pkg.productId || "").trim();
  const credits = Number(pkg.credits);
  if (!id || !Number.isFinite(credits) || credits <= 0) return null;

  return {
    ...pkg,
    id,
    credits: Math.floor(credits),
    // Keep the Play product identifier server-owned. Until a dedicated
    // googlePlayProductId is supplied, the canonical package ID is the SKU.
    playProductId: String(pkg.googlePlayProductId || pkg.playProductId || id).trim(),
  };
}

/**
 * Server-owned billing capability snapshot.
 *
 * Android digital-credit purchases are Google Play Billing only. We intentionally
 * expose no PromptPay/card/manual-transfer fallback from the Play build.
 */
export async function getCreditStorefront() {
  const payload = await api("/account/wallet/packages");
  const providers = Array.isArray(payload?.providers) ? payload.providers : [];
  const googlePlay = providers.find((provider) => provider?.id === "google_play") || null;
  const packages = (Array.isArray(payload?.packages) ? payload.packages : [])
    .map(normalizeCreditPackage)
    .filter(Boolean);

  return {
    packages,
    currency: String(payload?.currency || "THB"),
    creditRate: payload?.creditRate || null,
    googlePlayEnabled: googlePlay?.enabled === true,
    googlePlayProvider: googlePlay,
    purchasingEnabled: payload?.purchasingEnabled === true && googlePlay?.enabled === true,
  };
}

export async function getCreditPackages() {
  const storefront = await getCreditStorefront();
  return storefront.packages;
}

export async function verifyPlayPurchaseOnServer({
  packageId,
  purchaseToken,
  orderId,
  sandbox = false,
}) {
  return api("/account/wallet/verify-play-purchase", {
    method: "POST",
    body: {
      packageId,
      purchaseToken,
      orderId,
      packageName: "com.myanmarsportstalk.mst",
      sandbox,
    },
  });
}

export function creditPackageForProduct(storefront, productId) {
  const clean = String(productId || "").trim();
  if (!clean) return null;
  return (Array.isArray(storefront?.packages) ? storefront.packages : [])
    .find((item) => item.playProductId === clean || item.id === clean) || null;
}

export function playProductIdForPackage(pkg) {
  return String(pkg?.playProductId || pkg?.googlePlayProductId || pkg?.id || "").trim();
}

/**
 * Native checkout lives in the Expo IAP hook inside the Credits UI.
 * This service owns only the server-authoritative catalog and verification call.
 */
export async function restorePurchases() {
  // Server is the source of truth for wallet/entitlement state.
  return api("/tips/me");
}
