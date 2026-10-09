import { fetchMatchPreviewArticle } from "./contentApi";

export async function loadMstMatchPrediction(matchId, { language = "en" } = {}) {
  const id = String(matchId || "").trim();
  if (!/^\\d{1,12}$/.test(id)) return null;

  const article = await fetchMatchPreviewArticle(id, {
    locale: language === "my" ? "my" : "en",
  });
  const prediction = article?.prediction || article?.raw?.prediction || null;
  if (!prediction || typeof prediction !== "object") return null;

  return {
    homeTeam: prediction.homeTeam || prediction.home_team || null,
    awayTeam: prediction.awayTeam || prediction.away_team || null,
    predictedHomeScore: prediction.predictedHomeScore ?? prediction.homeScore ?? prediction.home_score ?? null,
    predictedAwayScore: prediction.predictedAwayScore ?? prediction.awayScore ?? prediction.away_score ?? null,
    confidence: prediction.confidence ?? null,
    reasoning: prediction.reasoning || prediction.analysis || "",
    articleId: article.id,
    articleSlug: article.slug,
    articleUrl: article.url,
  };
}
