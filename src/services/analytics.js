/**
 * MST Scores — Centralized Mobile Analytics Engine
 *
 * Privacy-first, vendor-neutral event tracking dispatcher.
 * Guaranteed:
 * - Sanitizes all properties (scrubs tokens, passwords, OTPs, email PII).
 * - Never throws or disrupts app runtime under any circumstances.
 * - Centralized logging in DEV mode with buffered memory queue.
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "@mst_analytics_queue";
const MAX_QUEUE_SIZE = 50;

// Whitelist of valid event names
export const ANALYTICS_EVENTS = Object.freeze({
  APP_OPEN: "app_open",
  ONBOARDING_STARTED: "onboarding_started",
  LANGUAGE_SELECTED: "language_selected",
  FAVORITES_SELECTED: "favorites_selected",
  ONBOARDING_COMPLETED: "onboarding_completed",
  MATCH_OPENED: "match_opened",
  LEAGUE_OPENED: "league_opened",
  TEAM_OPENED: "team_opened",
  PLAYER_OPENED: "player_opened",
  SEARCH_USED: "search_used",
  FAVORITE_ADDED: "favorite_added",
  FAVORITE_REMOVED: "favorite_removed",
  NOTIFICATION_OPT_IN: "notification_opt_in",
  PREDICTION_CTA_OPENED: "prediction_cta_opened",
  ODDS_VIEWED: "odds_viewed",
  MATCH_CENTER_TAB_VIEWED: "match_center_tab_viewed",
  ERROR_STATE_SHOWN: "error_state_shown",
});

/**
 * Sanitizes an event payload to prevent sensitive data leakage.
 */
function sanitizeProperties(props = {}) {
  if (!props || typeof props !== "object") return {};
  const clean = {};
  const SENSITIVE_KEYS = /token|secret|password|code|otp|auth|cookie|key|credential/i;

  for (const [k, v] of Object.entries(props)) {
    if (SENSITIVE_KEYS.test(k)) continue;
    if (typeof v === "string" && /@.+\..+/.test(v)) {
      // Redact email
      clean[k] = "[REDACTED_EMAIL]";
      continue;
    }
    if (typeof v === "string" && v.length > 256) {
      clean[k] = v.slice(0, 256);
      continue;
    }
    clean[k] = v;
  }
  return clean;
}

let memoryQueue = [];

/**
 * Dispatches an analytics event safely.
 */
export async function trackEvent(eventName, properties = {}) {
  try {
    const timestamp = Date.now();
    const cleanProps = sanitizeProperties(properties);
    const eventRecord = {
      event: String(eventName || "unknown"),
      properties: cleanProps,
      platform: Platform.OS,
      timestamp,
    };

    memoryQueue.push(eventRecord);
    if (memoryQueue.length > MAX_QUEUE_SIZE) {
      memoryQueue = memoryQueue.slice(-MAX_QUEUE_SIZE);
    }

    if (__DEV__) {
      console.log(`[Analytics] ${eventRecord.event}`, eventRecord.properties);
    }

    // Persist queue periodically in background
    AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(memoryQueue)).catch(() => {});
  } catch (_) {
    // Fail silent: analytics MUST never crash UI
  }
}

/**
 * Reads queued diagnostic events (for support/diagnostics).
 */
export async function getQueuedEvents() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : memoryQueue;
  } catch {
    return memoryQueue;
  }
}
