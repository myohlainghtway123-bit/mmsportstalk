const TEAM_ALIASES = new Map([
  ["myanmar", 2],
  ["thailand", 1],
  ["vietnam", 1],
  ["viet nam", 1],
  ["indonesia", 1],
  ["malaysia", 1],
  ["singapore", 1],
  ["philippines", 1],
  ["cambodia", 1],
  ["laos", 1],
  ["lao pdr", 1],
  ["brunei", 1],
  ["brunei darussalam", 1],
  ["timor-leste", 1],
  ["timor leste", 1],
]);

function normalizedName(value) {
  return String(value || "").trim().toLowerCase().replace(/[._]/g, " ").replace(/\s+/g, " ");
}

/** Senior national teams only; exact aliases prevent youth/club false boosts. */
export function regionalNationalTeamPriority(name) {
  return TEAM_ALIASES.get(normalizedName(name)) || 0;
}

export function isMyanmarNationalTeam(name) {
  return regionalNationalTeamPriority(name) === 2;
}
