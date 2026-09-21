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

/**
 * Fail-closed purchase entry point.
 *
 * The old UI simulated successful purchases and locally increased a balance.
 * That is forbidden for release. A later native Google Play Billing integration
 * must obtain a real purchase token, send it to verifyPlayPurchaseOnServer(),
 * and only show granted credits after the server verifies the Play purchase.
 *
 * Until both the Play product catalog and server-side Android Publisher
 * verification are enabled, this function must never charge or grant credits.
 */
export async function assertCreditPackagePurchasable(packageId) {
  const storefront = await getCreditStorefront();
  const pkg = storefront.packages.find((item) => item.id === packageId);
  if (!pkg) {
    const error = new Error("Invalid credit package selected.");
    error.code = "INVALID_CREDIT_PACKAGE";
    throw error;
  }

  if (!storefront.purchasingEnabled) {
    const error = new Error(
      "Google Play Billing is not enabled yet. No payment was submitted and no credits were changed.",
    );
    error.code = "GOOGLE_PLAY_BILLING_NOT_CONFIGURED";
    throw error;
  }

  // Native checkout is deliberately not faked. When the real Play Billing
  // client is added, it must return a purchaseToken that is verified by the
  // server before any wallet mutation is reflected in the app.
  const error = new Error(
    "Google Play Billing is available for this package.",
  );
  error.code = "GOOGLE_PLAY_BILLING_READY";
  error.productId = pkg.playProductId;
  return { package: pkg, storefront };
}

export async function restorePurchases() {
  // Server is the source of truth for wallet/entitlement state.
  return api("/tips/me");
}
