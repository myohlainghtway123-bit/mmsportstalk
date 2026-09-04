const PROFESSIONAL_PREVIEW_CONTRACT = "professional-match-preview.v1";

export const MATCH_CENTER_PREVIEW_SECTIONS = Object.freeze([
  { id: "stats", title: "Stats", previewKey: "keyStatistics" },
  { id: "lineups", title: "Lineups", previewKey: "expectedStartingXi" },
  { id: "h2h", title: "H2H", previewKey: "headToHead" },
  { id: "form", title: "Form", previewKey: "recentForm" },
  { id: "standings", title: "Standings", previewKey: "competitionSituation" },
]);

function asText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function safeStatus(value) {
  const status = asText(value).toUpperCase();
  return ["AVAILABLE", "DEGRADED", "UNAVAILABLE", "NOT_CHECKED"].includes(status)
    ? status
    : "NOT_CHECKED";
}

function missingMessage(section) {
  const reason = asText(section?.missingReason).toUpperCase();
  if (reason === "CONFLICTING_EVIDENCE") return "Verified sources conflict, so MST is withholding this section.";
  if (reason === "STALE_EVIDENCE") return "The available evidence is stale, so MST is not presenting it as current.";
  if (reason === "NO_VERIFIED_DATA") return "No verified data is currently available for this section.";
  return "This section has not been verified yet.";
}

function factText(fact) {
  const label = asText(fact?.label || fact?.key);
  const value = asText(fact?.value);
  const unit = asText(fact?.unit);
  if (!label || !value) return null;
  return {
    key: asText(fact?.key) || label,
    label,
    value: unit ? `${value} ${unit}` : value,
  };
}

export function isProfessionalMatchPreview(preview) {
  return Boolean(
    preview
    && typeof preview === "object"
    && preview.contract === PROFESSIONAL_PREVIEW_CONTRACT
    && Array.isArray(preview.sections),
  );
}

export function matchCenterPreviewQuality(preview) {
  if (!isProfessionalMatchPreview(preview)) {
    return {
      available: false,
      state: "UNAVAILABLE",
      premiumReady: false,
      score: null,
      confidenceBand: null,
      sourceCount: 0,
      sourceFamilyCount: 0,
      message: "Professional Match Preview data is unavailable.",
    };
  }

  const state = asText(preview.state).toUpperCase() === "COMPLETE" ? "COMPLETE" : "DEGRADED";
  const premiumReady = preview.premiumReady === true;
  const score = Number.isFinite(Number(preview?.quality?.score)) ? Number(preview.quality.score) : null;
  const confidenceBand = asText(preview?.quality?.confidenceBand).toUpperCase() || null;
  const sourceCount = Number.isFinite(Number(preview?.provenance?.sourceCount)) ? Number(preview.provenance.sourceCount) : 0;
  const sourceFamilyCount = Number.isFinite(Number(preview?.provenance?.sourceFamilyCount)) ? Number(preview.provenance.sourceFamilyCount) : 0;

  let message;
  if (state === "COMPLETE" && premiumReady) {
    message = "Complete evidence-backed MST match preview is available.";
  } else if (premiumReady) {
    message = "Verified match data is available, but advanced sections are still incomplete. MST is not presenting this as a complete premium preview.";
  } else {
    message = "MST has not met the minimum evidence gate for a premium preview. Verified sections can still be shown individually.";
  }

  return {
    available: true,
    state,
    premiumReady,
    score,
    confidenceBand,
    sourceCount,
    sourceFamilyCount,
    message,
  };
}

export function matchCenterPreviewSections(preview, { maxFacts = 10 } = {}) {
  const normalizedLimit = Number.isFinite(Number(maxFacts)) ? Math.max(1, Math.min(20, Math.trunc(Number(maxFacts)))) : 10;
  if (!isProfessionalMatchPreview(preview)) {
    return MATCH_CENTER_PREVIEW_SECTIONS.map((definition) => ({
      ...definition,
      status: "NOT_CHECKED",
      checkedAt: null,
      facts: [],
      hiddenFactCount: 0,
      message: "Professional Match Preview data is unavailable.",
    }));
  }

  const byKey = new Map(preview.sections.map((section) => [section?.key, section]));
  return MATCH_CENTER_PREVIEW_SECTIONS.map((definition) => {
    const source = byKey.get(definition.previewKey);
    if (!source || typeof source !== "object") {
      return {
        ...definition,
        status: "NOT_CHECKED",
        checkedAt: null,
        facts: [],
        hiddenFactCount: 0,
        message: "This section has not been verified yet.",
      };
    }

    const status = safeStatus(source.status);
    const allFacts = Array.isArray(source.facts) ? source.facts.map(factText).filter(Boolean) : [];
    const facts = allFacts.slice(0, normalizedLimit);
    const hiddenFactCount = Math.max(0, allFacts.length - facts.length);
    const message = facts.length
      ? null
      : missingMessage(source);

    return {
      ...definition,
      status,
      checkedAt: asText(source.checkedAt) || null,
      facts,
      hiddenFactCount,
      message,
    };
  });
}
