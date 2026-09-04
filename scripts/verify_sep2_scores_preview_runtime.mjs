const SCORES = "https://scores-api-staging.myanmarsportstalk.com";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "x-mst-client": "sep2-preview-smoke" },
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text.slice(0, 160) };
  }
  return { response, payload };
}

function data(payload) {
  return payload?.data ?? payload;
}

const fixtures = await json(`${SCORES}/v1/fixtures?limit=12`);
assert(fixtures.response.ok, `fixtures returned ${fixtures.response.status}`);
const rows = data(fixtures.payload);
assert(Array.isArray(rows), "fixtures must return an array");

const candidates = rows.filter((row) => /^mst:match:af:\d+$/i.test(String(row?.id || ""))).slice(0, 6);
assert(candidates.length > 0, "No canonical fixture is available for preview smoke");

let verified = null;
for (const match of candidates) {
  const id = String(match.id);
  const result = await json(`${SCORES}/v1/matches/${encodeURIComponent(id)}/preview`);
  const preview = data(result.payload);
  const sections = Array.isArray(preview?.sections) ? preview.sections : [];
  const available = sections.filter((section) => section?.status === "AVAILABLE" || section?.status === "DEGRADED");
  console.log("scores-preview", JSON.stringify({
    id,
    status: result.response.status,
    ok: result.response.ok,
    contract: preview?.contract || null,
    state: preview?.state || null,
    premiumReady: preview?.premiumReady ?? null,
    sectionCount: sections.length,
    availableSections: available.map((section) => ({ key: section.key, status: section.status, facts: Array.isArray(section.facts) ? section.facts.length : 0 })),
    missingSections: preview?.quality?.missingSections || [],
  }));

  if (
    result.response.ok &&
    preview?.contract === "professional-match-preview.v1" &&
    sections.length > 0
  ) {
    verified = { id, preview, sections, available };
    break;
  }
}

assert(verified, "No tested fixture returned the professional-match-preview.v1 contract");
assert(verified.sections.some((section) => section?.key === "matchIdentity"), "Preview contract is missing matchIdentity");
assert(verified.sections.some((section) => section?.key === "headToHead"), "Preview contract is missing headToHead section");
assert(verified.sections.some((section) => section?.key === "keyStatistics"), "Preview contract is missing keyStatistics section");
assert(verified.sections.some((section) => section?.key === "mstAiView"), "Preview contract is missing mstAiView section");
assert(verified.sections.some((section) => section?.key === "mstAdminView"), "Preview contract is missing mstAdminView section");

console.log("Sep 2 professional preview runtime PASS: Scores BFF returns the canonical read-only professional-match-preview.v1 contract. No write was performed.");
