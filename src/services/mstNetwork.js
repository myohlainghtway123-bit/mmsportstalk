import { MST_API_BASE } from "./mstApiConfig";

const DEFAULT_TIMEOUT_MS = 15000;
const RETRYABLE_STATUS = new Set([408, 429, 502, 503]);

export class MstNetworkError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = "MstNetworkError";
    this.status = status;
    this.payload = payload;
  }
}

function errorMessage(payload, fallback) {
  return payload?.error?.message
    || (typeof payload?.error === "string" ? payload.error : null)
    || payload?.message
    || payload?.detail
    || payload?.reason
    || fallback;
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.("Retry-After"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1000, 3000);
  return Math.min(400 * (2 ** attempt), 1600);
}

async function decode(response, label) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    if (response.ok) throw new MstNetworkError(`${label} returned malformed JSON.`, response.status);
    return { message: text.slice(0, 500) };
  }
}

export async function mstJsonRequest(path, {
  method = "GET",
  body,
  signal,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  label = "MST API",
  cacheControl = "no-cache",
} = {}) {
  const upperMethod = String(method).toUpperCase();
  const safeToRetry = upperMethod === "GET" || upperMethod === "HEAD";
  const maxAttempts = safeToRetry ? 2 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener?.("abort", forwardAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${MST_API_BASE}${path}`, {
        method: upperMethod,
        credentials: "include",
        headers: {
          Accept: "application/json",
          "x-mst-client": "mobile-app",
          ...(cacheControl ? { "Cache-Control": cacheControl } : {}),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const payload = await decode(response, label);
      if (response.ok) return payload;

      const error = new MstNetworkError(
        errorMessage(payload, `${label} request failed (${response.status})`),
        response.status,
        payload,
      );
      if (attempt + 1 < maxAttempts && RETRYABLE_STATUS.has(response.status) && !signal?.aborted) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      throw error;
    } catch (error) {
      if (error instanceof MstNetworkError) throw error;
      if (signal?.aborted) throw error;
      if (attempt + 1 < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(null, attempt)));
        continue;
      }
      if (controller.signal.aborted) {
        throw new MstNetworkError(`${label} request timed out. Try again.`, 408);
      }
      throw new MstNetworkError(error?.message || `${label} is unavailable.`, 0);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener?.("abort", forwardAbort);
    }
  }

  throw new MstNetworkError(`${label} request could not be completed.`);
}
