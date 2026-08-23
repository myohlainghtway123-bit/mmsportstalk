const teamLogo = (id) => `https://media.api-sports.io/football/teams/${id}.png`;
const competitionLogo = (id) => `https://media.api-sports.io/football/leagues/${id}.png`;
const playerPhoto = (id) => `https://media.api-sports.io/football/players/${id}.png`;

export const CURATED_FAVORITE_COMPETITIONS = [
  { id: 39, name: "Premier League", country: "England" },
  { id: 2, name: "UEFA Champions League", country: "Europe" },
  { id: 140, name: "La Liga", country: "Spain" },
  { id: 135, name: "Serie A", country: "Italy" },
  { id: 78, name: "Bundesliga", country: "Germany" },
  { id: 61, name: "Ligue 1", country: "France" },
  { id: 3, name: "UEFA Europa League", country: "Europe" },
].map((item) => ({ ...item, logo: competitionLogo(item.id), imageUrl: competitionLogo(item.id) }));

export const CURATED_FAVORITE_TEAMS = [
  [33, "Manchester United"],
  [50, "Manchester City"],
  [40, "Liverpool"],
  [42, "Arsenal"],
  [49, "Chelsea"],
  [47, "Tottenham Hotspur"],
  [541, "Real Madrid"],
  [529, "Barcelona"],
  [530, "Atletico Madrid"],
  [157, "Bayern Munich"],
  [85, "Paris Saint-Germain"],
  [496, "Juventus"],
  [505, "Inter"],
  [489, "AC Milan"],
  [492, "Napoli"],
  [165, "Borussia Dortmund"],
].map(([id, name]) => ({ id, name, logo: teamLogo(id), imageUrl: teamLogo(id) }));

export const CURATED_FAVORITE_PLAYERS = [
  { id: 1100, name: "Erling Haaland", photo: playerPhoto(1100), imageUrl: playerPhoto(1100) },
];

const catalogs = {
  team: CURATED_FAVORITE_TEAMS,
  competition: CURATED_FAVORITE_COMPETITIONS,
  player: CURATED_FAVORITE_PLAYERS,
};

export function favoriteMetadata(kind, id) {
  const rows = catalogs[String(kind || "").toLowerCase()] || [];
  return rows.find((item) => String(item.id) === String(id)) || null;
}

export function favoriteCatalog(kind) {
  return catalogs[String(kind || "").toLowerCase()] || [];
}
