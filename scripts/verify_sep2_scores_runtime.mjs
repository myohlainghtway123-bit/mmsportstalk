const SCORES = "https://scores-api-staging.myanmarsportstalk.com";
const APP = "https://app-api.myanmarsportstalk.com/api";

function assert(condition, message) { if (!condition) throw new Error(message); }

for (const [name, origin] of [["Scores", SCORES], ["App API", APP]]) {
  const parsed = new URL(origin);
  assert(parsed.protocol === "https:", `${name} runtime smoke origin must use HTTPS`);
  assert(parsed.hostname.endsWith("myanmarsportstalk.com"), `${name} runtime smoke origin must be MST-owned`);
}
assert(new URL(SCORES).hostname === "scores-api-staging.myanmarsportstalk.com", "Scores runtime smoke must target the canonical MST staging Scores API");

async function json(url) {
  const response = await fetch(url, { headers: { Accept: "application/json", "x-mst-client": "sep2-release-smoke" } });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text.slice(0, 120) }; }
  return { response, payload };
}
function data(payload) { return payload?.data ?? payload; }
function keys(value) { return value && typeof value === "object" ? Object.keys(value).sort() : []; }
function errorMessage(payload) { return payload?.error?.message || payload?.message || payload?.detail || payload?.error || null; }
function arrayCount(value) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== "object") return 0;
  return Math.max(0, ...Object.values(value).map(arrayCount));
}
function apiFootballId(value, kind) {
  const match = String(value || "").trim().match(new RegExp(`^mst:${kind}:af:(\\d+)$`, "i"));
  return match?.[1] || null;
}

const health = await json(`${SCORES}/health`);
assert(health.response.ok, `Scores staging health ${health.response.status}`);
assert(health.payload?.service === "mst-scores-api", `Unexpected Scores health service: ${health.payload?.service}`);
assert(health.payload?.environment === "staging", `Unexpected Scores health environment: ${health.payload?.environment}`);
assert(health.payload?.ok === true, "Scores staging health must report ok=true");
console.log("scores-health", JSON.stringify({ status: health.response.status, service: health.payload?.service, environment: health.payload?.environment, ok: health.payload?.ok }));

const feedResults = {};
for (const feed of ["live", "fixtures", "results"]) {
  const result = await json(`${SCORES}/v1/${feed}?limit=8`);
  assert(result.response.ok, `${feed} returned ${result.response.status}`);
  const rows = data(result.payload);
  assert(Array.isArray(rows), `${feed} must return an array data payload`);
  feedResults[feed] = rows;
  console.log(`feed-${feed}`, JSON.stringify({ status: result.response.status, count: rows.length, first: rows.slice(0,3).map((row) => ({ id:row.id, status:row.status, kickoff:row.kickoff_at })), requestId: result.response.headers.get("x-request-id") || result.payload?.meta?.requestId || null }));
}

const sample = [...feedResults.live, ...feedResults.fixtures, ...feedResults.results].find((row) => row?.id);
assert(sample?.id, "No canonical match available across live/fixtures/results for Match Center smoke");
console.log("sample-match", JSON.stringify({ id: sample.id, status: sample.status, competition: sample.competition_name || null, kickoff: sample.kickoff_at || null }));

const detail = await json(`${SCORES}/v1/matches/${encodeURIComponent(sample.id)}`);
assert(detail.response.ok, `Match detail returned ${detail.response.status}`);
const match = data(detail.payload);
assert(match && typeof match === "object" && !Array.isArray(match), "Match detail must return an object data payload");
assert(String(match?.id || "") === String(sample.id), "Match detail changed canonical identity");
console.log("match-detail", JSON.stringify({ status: detail.response.status, id: match.id, providerId:match.provider_id || null, competitionId:match.competition_id || null, season:match.season || null, keys: keys(match) }));

const sectionGroups = {
  stats: ["statistics", "stats", "match_statistics"],
  h2h: ["head_to_head", "h2h", "headToHead"],
  standings: ["standings", "table", "competition_standings"],
  premium: ["premium_preview_summary", "premiumPreviewSummary", "premium_preview", "analysis_summary"],
  ai: ["mst_ai_prediction", "mstAiPrediction", "ai_prediction"],
  admin: ["mst_admin_prediction", "mstAdminPrediction", "admin_prediction"],
};
for (const [name, candidates] of Object.entries(sectionGroups)) console.log(`section-${name}`, JSON.stringify({ present: candidates.some((key) => Object.prototype.hasOwnProperty.call(match || {}, key)), matched: candidates.filter((key) => Object.prototype.hasOwnProperty.call(match || {}, key)) }));

const providerId = String(match?.provider_id || "").trim();
if (providerId) {
  for (const [name, path] of [
    ["statistics", `/football/matches/${encodeURIComponent(providerId)}/statistics`],
    ["h2h", `/football/matches/${encodeURIComponent(providerId)}/h2h`],
  ]) {
    const result = await json(`${APP}${path}`);
    console.log(`existing-service-${name}`, JSON.stringify({ status:result.response.status, ok:result.response.ok, count:arrayCount(result.payload), message:errorMessage(result.payload), keys:keys(result.payload) }));
  }
}
const competitionProviderId = apiFootballId(match?.competition_id, "competition");
if (competitionProviderId) {
  const season = match?.season ? `?season=${encodeURIComponent(match.season)}` : "";
  const result = await json(`${APP}/football/competitions/${encodeURIComponent(competitionProviderId)}/standings${season}`);
  console.log("existing-service-standings", JSON.stringify({ status:result.response.status, ok:result.response.ok, count:arrayCount(result.payload), message:errorMessage(result.payload), keys:keys(result.payload) }));
}

const tips = await json(`${SCORES}/v1/tips?matchId=${encodeURIComponent(sample.id)}&limit=10`);
assert(tips.response.ok, `Scores tips returned ${tips.response.status}`);
const tipRows = data(tips.payload);
assert(Array.isArray(tipRows), "Scores tips must return an array data payload");
console.log("scores-tips", JSON.stringify({ status: tips.response.status, count: tipRows.length }));

const voteSamples = [...feedResults.fixtures, ...feedResults.live, ...feedResults.results]
  .filter((row) => /^mst:match:af:\d+$/i.test(String(row?.id || "")))
  .slice(0, 6);
let voteVerified = null;
for (const voteSample of voteSamples) {
  const canonical = String(voteSample.id);
  const vote = await json(`${SCORES}/v1/matches/${encodeURIComponent(canonical)}/vote`);
  console.log("scores-match-vote", JSON.stringify({ canonical, status: vote.response.status, ok: vote.response.ok, message:errorMessage(vote.payload), keys:keys(data(vote.payload)) }));
  if (vote.response.ok && !voteVerified) voteVerified = canonical;
}
assert(voteVerified, "Scores Match Vote GET rejected every tested canonical current match ID; the app-facing Match Vote BFF contract is not verified.");

for (const [name, url] of [
  ["tips", `${APP}/tips?limit=2`],
  ["tipsters", `${APP}/tipsters?limit=2`],
  ["prediction-leaderboard", `${APP}/predictions/leaderboard?timeframe=all`],
  ["search", `${APP}/football/search?q=Arsenal`],
]) {
  const result = await json(url);
  console.log(`existing-service-${name}`, JSON.stringify({ status: result.response.status, ok: result.response.ok, message:errorMessage(result.payload), keys: keys(result.payload) }));
}

console.log("Sep 2 read-only runtime smoke PASS: canonical MST staging Scores API identity, health contract, feed shapes, canonical Match Center identity, tips and app-facing Match Vote BFF read compatibility verified. No vote, favorite, prediction, notification, purchase, build, deploy, or store write was performed.");
