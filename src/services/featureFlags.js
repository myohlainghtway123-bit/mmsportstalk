/**
 * MST Scores Remote Feature Flags
 * Lightweight, cached remote feature flags backed by existing MST API.
 * Never blocks startup; falls back immediately to safe local defaults.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SCORES_BASE_URL } from "./footballApi";

const STORAGE_KEY = "mst_feature_flags_v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const DEFAULT_FLAGS = {
  commentaryUi: true,
  shotMap: true,
  sportradarTrial: true,
  advancedOdds: true,
  predictionCta: true,
  experimentalMatchCenter: true,
  failoverEnabled: true,
};

let memoryFlags = { ...DEFAULT_FLAGS };
let lastFetchedAt = 0;
let fetchPromise = null;

const storage = AsyncStorage?.setItem ? AsyncStorage : (AsyncStorage?.default || AsyncStorage);

/**
 * Initializes feature flags from local storage cache.
 */
export async function initFeatureFlags() {
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.flags) {
        memoryFlags = { ...DEFAULT_FLAGS, ...parsed.flags };
        lastFetchedAt = parsed.cachedAt || 0;
      }
    }
  } catch {}

  // Trigger background refresh if stale
  if (Date.now() - lastFetchedAt > CACHE_TTL_MS) {
    refreshFeatureFlags().catch(() => {});
  }

  return memoryFlags;
}

/**
 * Refreshes flags from MST remote backend.
 * Aborts after 3000ms to guarantee zero UI lag.
 */
export async function refreshFeatureFlags() {
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 3000) : null;

      const endpoint = `${SCORES_BASE_URL}/api/football/config/feature-flags`;
      const res = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        signal: controller?.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (res.ok) {
        const body = await res.json();
        if (body?.flags) {
          memoryFlags = { ...DEFAULT_FLAGS, ...body.flags };
          lastFetchedAt = Date.now();
          await storage.setItem(
            STORAGE_KEY,
            JSON.stringify({ flags: memoryFlags, cachedAt: lastFetchedAt })
          ).catch(() => {});
        }
      }
    } catch {
      // Network or timeout: keep current flags silently
    } finally {
      fetchPromise = null;
    }
    return memoryFlags;
  })();

  return fetchPromise;
}

/**
 * Synchronously retrieves a flag value.
 */
export function getFeatureFlag(flagName, defaultValue = true) {
  if (Object.prototype.hasOwnProperty.call(memoryFlags, flagName)) {
    return memoryFlags[flagName];
  }
  return defaultValue;
}
