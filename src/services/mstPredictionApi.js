import { MST_API_BASE } from "./mstApiConfig";

export async function loadMstMatchPrediction(matchId, { signal, language = "en" } = {}) {
  const id = String(matchId || "").trim();
  if (!/^\d{1,12}$/.test(id)) return null;

  const locale = language === "my" ? "my" : "en";
  const response = await fetch(
    `${MST_API_BASE}/football/mst-prediction?matchId=${encodeURIComponent(id)}&locale=${locale}`,
    {
      headers: {
        Accept: "application/json",
        "x-mst-client": "mobile-app",
      },
      signal,
    },
  );

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_) {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.error || `MST prediction API ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload?.data || null;
}
