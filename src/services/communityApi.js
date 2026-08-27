import { AppState } from "react-native";
import { MST_CHAT_API_BASE, MST_CHAT_WS_URL } from "./mstApiConfig";
import { getSessionToken } from "./accountApi";

const RETRYABLE_STATUS = new Set([408, 429, 502, 503]);
let messageCounter = 0;

async function decode(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return { message: text }; }
}

function requestSignal(callerSignal, timeoutMs = 15000) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener?.("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener?.("abort", abort);
    },
  };
}

async function api(path, { method = "GET", body, signal, retry = method === "GET" } = {}) {
  const token = await getSessionToken();
  let attempt = 0;
  while (true) {
    const scoped = requestSignal(signal);
    try {
      const response = await fetch(`${MST_CHAT_API_BASE}${path}`, {
        method,
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: scoped.signal,
      });
      const payload = await decode(response);
      if (!response.ok) {
        if (retry && attempt < 1 && RETRYABLE_STATUS.has(response.status)) {
          attempt += 1;
          const retryAfter = Number(response.headers.get("Retry-After"));
          await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 3000) : 500));
          continue;
        }
        const error = new Error(payload?.error || payload?.message || `MST Chat API ${response.status}`);
        error.status = response.status;
        error.code = payload?.code;
        throw error;
      }
      return payload;
    } finally {
      scoped.cleanup();
    }
  }
}

export function createClientMessageId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // This is a collision-resistant idempotency key, never an auth credential.
    let value = BigInt(Date.now()) * 65536n + BigInt(messageCounter++ & 0xffff);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Number(value & 255n);
      value >>= 8n;
    }
  }
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function mergeChatMessages(current = [], incoming = []) {
  const merged = new Map();
  for (const message of [...current, ...incoming]) {
    if (!message?.id) continue;
    merged.set(String(message.id), { ...merged.get(String(message.id)), ...message });
  }
  return Array.from(merged.values()).sort((a, b) => {
    const time = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    return time || String(a.id).localeCompare(String(b.id));
  });
}

export async function getMatchChat(matchId, { limit = 50, before, signal } = {}) {
  const query = new URLSearchParams({ matchId: String(matchId), limit: String(limit) });
  if (before) query.set("before", String(before));
  const payload = await api(`/match-chat?${query.toString()}`, { signal });
  return {
    messages: Array.isArray(payload?.data) ? payload.data : [],
    nextCursor: payload?.meta?.nextCursor || null,
    hasMore: payload?.meta?.hasMore === true,
  };
}

export function postMatchChat(matchId, body, { clientMessageId = createClientMessageId(), signal } = {}) {
  return api("/match-chat", {
    method: "POST",
    body: { matchId: String(matchId), body: String(body || ""), clientMessageId },
    signal,
    retry: false,
  }).then((payload) => payload?.data ?? payload);
}

export function reportMatchChat(messageId, reason = "inappropriate", { signal } = {}) {
  return api("/match-chat/report", {
    method: "POST",
    body: { messageId: String(messageId), reason },
    signal,
    retry: false,
  }).then((payload) => payload?.data ?? payload);
}

export function connectMatchChat({ matchId, onMessage, onState, onRecovery, onError }) {
  let socket = null;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let reconnectAttempt = 0;
  let disposed = false;
  let foreground = AppState.currentState === "active";

  const state = (value) => onState?.(value);
  const clearTimers = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    reconnectTimer = null;
    heartbeatTimer = null;
  };
  const scheduleReconnect = () => {
    if (disposed || !foreground || reconnectTimer) return;
    const delay = Math.min(15000, 1000 * (2 ** Math.min(reconnectAttempt, 4)));
    reconnectAttempt += 1;
    state("reconnecting");
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };
  const connect = async () => {
    if (disposed || !foreground || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
    state(reconnectAttempt ? "reconnecting" : "connecting");
    try {
      const token = await getSessionToken();
      if (!token) {
        state("unauthenticated");
        return;
      }
      const next = new WebSocket(`${MST_CHAT_WS_URL}?matchId=${encodeURIComponent(String(matchId))}`, undefined, {
        headers: { Authorization: `Bearer ${token}` },
      });
      socket = next;
      next.onopen = () => {
        if (next !== socket || disposed) return;
        reconnectAttempt = 0;
        state("connected");
        heartbeatTimer = setInterval(() => {
          if (next.readyState === WebSocket.OPEN) next.send("ping");
        }, 25000);
        onRecovery?.();
      };
      next.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          const payload = JSON.parse(String(event.data || ""));
          if (payload?.type === "message" && payload.data) onMessage?.(payload.data);
        } catch (_) {}
      };
      next.onerror = () => onError?.(new Error("Realtime connection interrupted."));
      next.onclose = () => {
        if (next !== socket) return;
        socket = null;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        scheduleReconnect();
      };
    } catch (error) {
      onError?.(error);
      scheduleReconnect();
    }
  };

  const lifecycle = AppState.addEventListener("change", (nextState) => {
    foreground = nextState === "active";
    if (foreground) {
      onRecovery?.();
      connect();
    } else {
      clearTimers();
      const current = socket;
      socket = null;
      try { current?.close(1000, "background"); } catch (_) {}
      state("background");
    }
  });
  connect();
  return () => {
    disposed = true;
    clearTimers();
    lifecycle.remove();
    const current = socket;
    socket = null;
    try { current?.close(1000, "screen_closed"); } catch (_) {}
    state("disconnected");
  };
}
