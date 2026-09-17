/**
 * MST Scores Crash Reporter & Diagnostics Engine
 * Lightweight, zero-crash monitoring architecture.
 * Captures uncaught JS exceptions, promise rejections, breadcrumbs, and route context.
 * Strictly sanitizes sensitive information (tokens, OTPs, API keys).
 */
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CRASH_LOG_KEY = "mst_crash_reports_v1";
const MAX_STORED_CRASHES = 20;

const state = {
  initialized: false,
  release: "production",
  appVersion: "1.0.0",
  breadcrumbs: [],
  currentRoute: "home",
  dsn: null, // Remote monitoring endpoint (e.g. Sentry/GlitchTip DSN if configured via env)
};

const storage = AsyncStorage?.setItem ? AsyncStorage : (AsyncStorage?.default || AsyncStorage);

/**
 * Strips sensitive patterns from error strings and metadata.
 */
function sanitize(input) {
  if (typeof input !== "string") {
    try {
      input = JSON.stringify(input);
    } catch {
      input = String(input);
    }
  }
  return input
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
    .replace(/token[=:][A-Za-z0-9\-._~+/]+/gi, "token=[REDACTED]")
    .replace(/otp[=:][0-9]{4,8}/gi, "otp=[REDACTED]")
    .replace(/password[=:][^&,\s]+/gi, "password=[REDACTED]")
    .replace(/[a-zA-Z0-9_-]{20,45}/g, (match) => {
      // Potentially long API key / hash
      if (match.length >= 32) return "[KEY_REDACTED]";
      return match;
    });
}

/**
 * Initializes global crash handling.
 */
export function initCrashReporter(options = {}) {
  if (state.initialized) return;
  state.initialized = true;
  state.release = options.release || (typeof __DEV__ !== "undefined" && __DEV__ ? "development" : "production");
  state.appVersion = options.appVersion || "1.0.0";
  state.dsn = options.dsn || null;

  // React Native global JS handler
  if (typeof global !== "undefined") {
    const defaultHandler = global.ErrorUtils?.getGlobalHandler?.();
    if (global.ErrorUtils?.setGlobalHandler) {
      global.ErrorUtils.setGlobalHandler((error, isFatal) => {
        captureException(error, { isFatal, handler: "ErrorUtils" });
        if (defaultHandler) {
          defaultHandler(error, isFatal);
        }
      });
    }
  }

  logBreadcrumb("app", "Crash reporter initialized", { release: state.release });
}

/**
 * Records a breadcrumb for crash context.
 */
export function logBreadcrumb(category, message, data = {}) {
  const item = {
    timestamp: new Date().toISOString(),
    category: String(category),
    message: sanitize(String(message)),
    data: sanitize(data),
    route: state.currentRoute,
  };
  state.breadcrumbs.push(item);
  if (state.breadcrumbs.length > 30) {
    state.breadcrumbs.shift();
  }
}

/**
 * Sets current screen context.
 */
export function setCrashRouteContext(routeName) {
  state.currentRoute = String(routeName || "unknown");
}

/**
 * Captures an exception and stores diagnostics safely.
 */
export function captureException(error, context = {}) {
  try {
    const errorRecord = {
      id: `crash-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      message: sanitize(error?.message || String(error)),
      stack: sanitize(error?.stack || ""),
      platform: Platform.OS,
      release: state.release,
      appVersion: state.appVersion,
      route: state.currentRoute,
      context: sanitize(context),
      breadcrumbs: [...state.breadcrumbs],
    };

    // Store in local ring buffer for inspection
    storage.getItem(CRASH_LOG_KEY).then((raw) => {
      let list = [];
      try {
        list = raw ? JSON.parse(raw) : [];
      } catch {}
      list.unshift(errorRecord);
      if (list.length > MAX_STORED_CRASHES) list.length = MAX_STORED_CRASHES;
      storage.setItem(CRASH_LOG_KEY, JSON.stringify(list)).catch(() => {});
    }).catch(() => {});

    // Remote dispatch if DSN configured
    if (state.dsn) {
      fetch(state.dsn, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(errorRecord),
      }).catch(() => {});
    }
  } catch {
    // A crash reporter must never throw
  }
}

/**
 * Root ErrorBoundary Component
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    captureException(error, { componentStack: errorInfo?.componentStack });
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            An unexpected error occurred. The application state has been preserved safely.
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRestart}>
            <Text style={styles.buttonText}>Restart View</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D1013",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#F3262D",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: "#858C93",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  button: {
    backgroundColor: "#F3262D",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
});
