const SCORES = "https://scores-api-staging.myanmarsportstalk.com";
const APP = "https://app-api.myanmarsportstalk.com";

async function json(url) {
  const response = await fetch(url, { headers: { Accept: "application/json", "x-mst-client": "sep2-release-smoke" } });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text.slice(0, 120) }; }
  return { response, payload };
}
function data(payload) { return payload?.data ?? payload; }
function assert(condition, message) { if (!condition) throw new Error(message); }
function keys(value) { return value && typeof value === "object" ? Object.keys(value).sort() : []; }

const health = await json(`${SCORES}/health`);
assert(health.response.ok, `Scores staging health ${health.response.status}`);
console.log("scores-health", JSON.stringify({ status: health.response.status, service: health.payload?.service, environment: health.payload?.environment, ok: health.payload?.ok }));

const feedResults = {};
for (const feed of ["live", "fixtures", "results"]) {
  const result = await json(`${SCORES}/v1/${feed}?limit=8`);
  assert(result.response.ok, `${feed} returned ${result.response.status}`);
  const rows = Array.isArray(data(result.payload)) ? data(result.payload) : [];
  feedResults[feed] = rows;
  console.log(`feed-${feed}`, JSON.stringify({ status: result.response.status, count: rows.length, requestId: result.response.headers.get("x-request-id") || result.payload?.meta?.requestId || null }));
}

const sample = [...feedResults.live, ...feedResults.fixtures, ...feedResults.results].find((row) => row?.id);
assert(sample?.id, "No canonical match available across live/fixtures/results for Match Center smoke");
console.log("sample-match", JSON.stringify({ id: sample.id, status: sample.status, competition: sample.competition_name || null, kickoff: sample.kickoff_at || null }));

const detail = await json(`${SCORES}/v1/matches/${encodeURIComponent(sample.id)}`);
assert(detail.response.ok, `Match detail returned ${detail.response.status}`);
const match = data(detail.payload);
assert(String(match?.id || "") === String(sample.id), "Match detail changed canonical identity");
const detailKeys = keys(match);
console.log("match-detail", JSON.stringify({ status: detail.response.status, id: match.id, keys: detailKeys }));

const sectionGroups = {
  stats: ["statistics", "stats", "match_statistics"],
  h2h: ["head_to_head", "h2h", "headToHead"],
  standings: ["standings", "table", "competition_standings"],
  premium: ["premium_preview_summary", "premiumPreviewSummary", "premium_preview", "analysis_summary"],
  ai: ["mst_ai_prediction", "mstAiPrediction", "ai_prediction"],
  admin: ["mst_admin_prediction", "mstAdminPrediction", "admin_prediction"],
};
for (const [name, candidates] of Object.entries(sectionGroups)) {
  console.log(`section-${name}`, JSON.stringify({ present: candidates.some((key) => Object.prototype.hasOwnProperty.call(match || {}, key)), matched: candidates.filter((key) => Object.prototype.hasOwnProperty.call(match || {}, key)) }));
}

const tips = await json(`${SCORES}/v1/tips?matchId=${encodeURIComponent(sample.id)}&limit=10`);
assert(tips.response.ok, `Scores tips returned ${tips.response.status}`);
console.log("scores-tips", JSON.stringify({ status: tips.response.status, count: Array.isArray(data(tips.payload)) ? data(tips.payload).length : 0 }));

const numericSuffix = String(sample.id).match(/(\d+)$/)?.[1] || null;
const pollCandidates = [...new Set([
  String(sample.id),
  match?.provider_match_id,
  match?.provider_fixture_id,
  match?.external_id,
  match?.fixture_id,
  match?.source_id,
  numericSuffix,
].filter(Boolean).map(String))];
let pollWorkingId = null;
for (const candidate of pollCandidates) {
  const poll = await json(`${APP}/football/poll?matchId=${encodeURIComponent(candidate)}`);
  console.log("match-vote-candidate", JSON.stringify({ candidate, status: poll.response.status, ok: poll.response.ok }));
  if (poll.response.ok && !pollWorkingId) pollWorkingId = candidate;
}
assert(pollWorkingId, `Existing Match Vote GET rejected all safe match ID candidates: ${pollCandidates.join(", ")}`);
console.log("match-vote", JSON.stringify({ verifiedReadId: pollWorkingId, canonicalId: String(sample.id), canonicalWorks: pollWorkingId === String(sample.id) }));

for (const [name, url] of [
  ["tips", `${APP}/tips?limit=2`],
  ["tipsters", `${APP}/tipsters?limit=2`],
  ["prediction-leaderboard", `${APP}/predictions/leaderboard?timeframe=all`],
  ["search", `${APP}/football/search?q=Arsenal`],
]) {
  const result = await json(url);
  console.log(`existing-service-${name}`, JSON.stringify({ status: result.response.status, ok: result.response.ok, keys: keys(result.payload) }));
}

console.log("Sep 2 read-only runtime smoke completed. No vote, favorite, prediction, notification, purchase, build, deploy, or store write was performed.");
