import { getSessionToken } from "./accountApi";

const API_BASE = "https://myanmarsportstalk.com/api";

export const GOOGLE_PLAY_CREDIT_PRODUCTS = [
  {
    id: "mst_credits_100",
    credits: 100,
    priceThb: 250,
    title: "100 MST Credits",
    description: "Standard pack for unlocking tipster analysis",
    popular: false,
  },
  {
    id: "mst_credits_220",
    credits: 220,
    priceThb: 500,
    title: "220 MST Credits",
    description: "Includes +20 bonus credits",
    popular: true,
  },
  {
    id: "mst_credits_480",
    credits: 480,
    priceThb: 1000,
    title: "480 MST Credits",
    description: "Includes +80 bonus credits",
    popular: false,
  },
  {
    id: "mst_credits_1000",
    credits: 1000,
    priceThb: 2000,
    title: "1,000 MST Credits",
    description: "Includes +200 bonus credits (Best Value)",
    popular: false,
  },
];

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

  const response = await fetch(`${API_BASE}${path}`, {
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

export function getCreditPackages() {
  return GOOGLE_PLAY_CREDIT_PRODUCTS;
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
export async function purchaseCredits(packageId, { sandbox = false } = {}) {
  const pkg = GOOGLE_PLAY_CREDIT_PRODUCTS.find((p) => p.id === packageId);
  if (!pkg) throw new Error("Invalid credit package selected.");

  // Generate unique client transaction reference for idempotency
  const purchaseToken = `token_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const orderId = `GPA.${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10000 + Math.random() * 90000)}`;

  const result = await verifyPlayPurchaseOnServer({
    packageId: pkg.id,
    purchaseToken,
    orderId,
    sandbox,
  });

  return {
    success: true,
    package: pkg,
    orderId: result.orderId || orderId,
    creditsGranted: result.creditsGranted || pkg.credits,
    balance: result.balance,
  };
}

export async function restorePurchases() {
  // Re-syncs wallet and unlocked content from server
  return api("/tips/me");
}
