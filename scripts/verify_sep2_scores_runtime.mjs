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
function errorMessage(payload) { return payload?.error?.message || payload?.message || payload?.detail || payload?.error || null; }

const health = await json(`${SCORES}/health`);
assert(health.response.ok, `Scores staging health ${health.response.status}`);
console.log("scores-health", JSON.stringify({ status: health.response.status, service: health.payload?.service, environment: health.payload?.environment, ok: health.payload?.ok }));

const feedResults = {};
for (const feed of ["live", "fixtures", "results"]) {
  const result = await json(`${SCORES}/v1/${feed}?limit=8`);
  assert(result.response.ok, `${feed} returned ${result.response.status}`);
  const rows = Array.isArray(data(result.payload)) ? data(result.payload) : [];
  feedResults[feed] = rows;
  console.log(`feed-${feed}`, JSON.stringify({ status: result.response.status, count: rows.length, first: rows.slice(0,3).map((row) => ({ id:row.id, status:row.status, kickoff:row.kickoff_at })), requestId: result.response.headers.get("x-request-id") || result.payload?.meta?.requestId || null }));
}

const sample = [...feedResults.live, ...feedResults.fixtures, ...feedResults.results].find((row) => row?.id);
assert(sample?.id, "No canonical match available across live/fixtures/results for Match Center smoke");
console.log("sample-match", JSON.stringify({ id: sample.id, status: sample.status, competition: sample.competition_name || null, kickoff: sample.kickoff_at || null }));

const detail = await json(`${SCORES}/v1/matches/${encodeURIComponent(sample.id)}`);
assert(detail.response.ok, `Match detail returned ${detail.response.status}`);
const match = data(detail.payload);
assert(String(match?.id || "") === String(sample.id), "Match detail changed canonical identity");
console.log("match-detail", JSON.stringify({ status: detail.response.status, id: match.id, keys: keys(match) }));

const sectionGroups = {
  stats: ["statistics", "stats", "match_statistics"],
  h2h: ["head_to_head", "h2h", "headToHead"],
  standings: ["standings", "table", "competition_standings"],
  premium: ["premium_preview_summary", "premiumPreviewSummary", "premium_preview", "analysis_summary"],
  ai: ["mst_ai_prediction", "mstAiPrediction", "ai_prediction"],
  admin: ["mst_admin_prediction", "mstAdminPrediction", "admin_prediction"],
};
for (const [name, candidates] of Object.entries(sectionGroups)) console.log(`section-${name}`, JSON.stringify({ present: candidates.some((key) => Object.prototype.hasOwnProperty.call(match || {}, key)), matched: candidates.filter((key) => Object.prototype.hasOwnProperty.call(match || {}, key)) }));

const tips = await json(`${SCORES}/v1/tips?matchId=${encodeURIComponent(sample.id)}&limit=10`);
assert(tips.response.ok, `Scores tips returned ${tips.response.status}`);
console.log("scores-tips", JSON.stringify({ status: tips.response.status, count: Array.isArray(data(tips.payload)) ? data(tips.payload).length : 0 }));

const pollSamples = [...feedResults.fixtures.slice(0,3), ...feedResults.live.slice(0,2), ...feedResults.results.slice(0,2)].filter((row) => row?.id);
let pollWorkingId = null;
let pollWorkingCanonical = null;
for (const pollSample of pollSamples) {
  const canonical = String(pollSample.id);
  const numericSuffix = canonical.match(/(\d+)$/)?.[1] || null;
  for (const candidate of [...new Set([canonical, numericSuffix].filter(Boolean))]) {
    const poll = await json(`${APP}/football/poll?matchId=${encodeURIComponent(candidate)}`);
    console.log("match-vote-candidate", JSON.stringify({ canonical, candidate, status: poll.response.status, ok: poll.response.ok, message:errorMessage(poll.payload) }));
    if (poll.response.ok && !pollWorkingId) {
      pollWorkingId = candidate;
      pollWorkingCanonical = canonical;
    }
  }
}
console.log("match-vote", JSON.stringify({ verifiedReadId: pollWorkingId, canonicalId: pollWorkingCanonical, canonicalWorks: Boolean(pollWorkingId && pollWorkingId === pollWorkingCanonical) }));

for (const [name, url] of [
  ["tips", `${APP}/tips?limit=2`],
  ["tipsters", `${APP}/tipsters?limit=2`],
  ["prediction-leaderboard", `${APP}/predictions/leaderboard?timeframe=all`],
  ["search", `${APP}/football/search?q=Arsenal`],
]) {
  const result = await json(url);
  console.log(`existing-service-${name}`, JSON.stringify({ status: result.response.status, ok: result.response.ok, message:errorMessage(result.payload), keys: keys(result.payload) }));
}

assert(pollWorkingId, "Existing Match Vote GET rejected every tested current Scores match ID/provider suffix; Scores↔Match Vote runtime contract is not verified.");
console.log("Sep 2 read-only runtime smoke completed. No vote, favorite, prediction, notification, purchase, build, deploy, or store write was performed.");
