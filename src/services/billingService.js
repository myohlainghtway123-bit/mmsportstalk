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

export async function getCreditPackages() {
  const payload = await api("/account/wallet/packages");
  const providers = Array.isArray(payload?.providers) ? payload.providers : [];
  const verifiedCheckoutAvailable = payload?.purchasingEnabled === true
    && providers.some((provider) => provider?.enabled === true);
  return verifiedCheckoutAvailable && Array.isArray(payload?.packages) ? payload.packages : [];
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

/**
 * Executes or prepares a Google Play Credit purchase.
 * Designed for immediate plug-and-play connection when Google Play Console
 * Merchant credentials and in-app product IDs are activated.
 */
export async function purchaseCredits(packageId) {
  const packages = await getCreditPackages();
  if (!packages.some((pkg) => pkg.id === packageId)) throw new Error("Invalid credit package selected.");
  const error = new Error("Google Play checkout is not available yet. No payment was submitted and no credits were changed.");
  error.code = "GOOGLE_PLAY_BILLING_NOT_CONFIGURED";
  throw error;
}

export async function restorePurchases() {
  // Re-syncs wallet and unlocked content from server
  return api("/tips/me");
}
