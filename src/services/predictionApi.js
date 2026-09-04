import { api, MstApiError } from "./accountApi";

function scoreNumber(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 20 ? n : null;
}

async function tryMutation(attempts) {
  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await api(attempt.path, attempt.options);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new MstApiError("Operation failed");
}

export async function savePredictionScore({ matchId, homeScore, awayScore }) {
  const id = String(matchId || "").trim();
  const home = scoreNumber(homeScore);
  const away = scoreNumber(awayScore);
  if (!/^\d{1,12}$/.test(id)) throw new MstApiError("Choose a valid match.");
  if (home === null || away === null) throw new MstApiError("Enter a valid predicted score from 0 to 20.");
  return api("/account/predictions", { method: "POST", body: { matchId: id, homeScore: home, awayScore: away } });
}

// Kept only for backwards compatibility with older screens.
export async function savePrediction({ matchId, pick }) {
  const id = String(matchId);
  const choice = String(pick).toLowerCase();
  return tryMutation([
    { path: "/account/predictions", options: { method: "POST", body: { matchId: id, prediction: choice } } },
    { path: "/account/predictions", options: { method: "POST", body: { fixtureId: id, prediction: choice } } },
  ]);
}
