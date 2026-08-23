import { Share } from "react-native";
import { MST_SITE_URL } from "../services/accountApi";

export async function shareMatch(match, language = "my") {
  if (!match) return;
  const my = language === "my";
  const home = match.home?.name || match.homeTeam?.name || "Home";
  const away = match.away?.name || match.awayTeam?.name || "Away";
  const comp = match.competition?.name || match.competition || "Football";
  const homeScore = match.homeScore ?? match.goals?.home;
  const awayScore = match.awayScore ?? match.goals?.away;
  const isFinished = match.status === "finished" || match.status === "FT";
  const isLive = match.status === "live" || match.status === "1H" || match.status === "2H" || match.status === "HT";

  let title = `${home} vs ${away}`;
  let scoreLine = "";
  if (homeScore != null && awayScore != null) {
    scoreLine = `⚽ ${home} ${homeScore} - ${awayScore} ${away} (${isFinished ? "FT" : isLive ? "LIVE" : ""})`;
  } else {
    scoreLine = `⚽ ${home} vs ${away} · ${comp}`;
  }

  const url = `${MST_SITE_URL}/match/${match.id}`;
  const message = my
    ? `${scoreLine}\n🏆 ${comp}\n\nတိုက်ရိုက်ရလဒ်နှင့် ပွဲစဉ်အပြည့်အစုံကို MST Score တွင် ကြည့်ရှုပါ:\n${url}\n\n#MSTScore #MyanmarSportsTalk #Football`
    : `${scoreLine}\n🏆 ${comp}\n\nView live match stats & updates on MST Score:\n${url}\n\n#MSTScore #MyanmarSportsTalk #Football`;

  try {
    await Share.share(
      {
        title: `MST Score · ${title}`,
        message,
        url,
      },
      {
        dialogTitle: my ? "ပွဲစဉ်မျှဝေရန်" : "Share Match",
      },
    );
  } catch {
    // Non-blocking share cancellation
  }
}

export async function sharePrediction(prediction, match, language = "my") {
  if (!prediction) return;
  const my = language === "my";
  const home = match?.home?.name || prediction.match?.home?.name || "Home";
  const away = match?.away?.name || prediction.match?.away?.name || "Away";
  const predHome = prediction.homeScore ?? "-";
  const predAway = prediction.awayScore ?? "-";
  const points = prediction.points ?? 0;
  const matchId = match?.id || prediction.matchId;
  const url = matchId ? `${MST_SITE_URL}/match/${matchId}` : MST_SITE_URL;

  const message = my
    ? `🎯 MST Prediction: ကျွန်ုပ်၏ခန့်မှန်းချက်\n⚽ ${home} ${predHome} - ${predAway} ${away}\n⭐️ ရရှိမှတ်: ${points} PTS\n\nအခမဲ့ခန့်မှန်းပြီး ဦးဆောင်သူစာရင်းဝင်ရန်:\n${url}\n\n#MSTScore #MSTPrediction`
    : `🎯 MST Prediction: My Pick\n⚽ ${home} ${predHome} - ${predAway} ${away}\n⭐️ Awarded: ${points} PTS\n\nPredict live football scores on MST Score:\n${url}\n\n#MSTScore #MSTPrediction`;

  try {
    await Share.share(
      {
        title: "MST Prediction Result",
        message,
        url,
      },
      {
        dialogTitle: my ? "ခန့်မှန်းချက်မျှဝေရန်" : "Share Prediction",
      },
    );
  } catch {
    // Non-blocking
  }
}

export async function shareLeaderboard(rank, points, language = "my") {
  const my = language === "my";
  const url = `${MST_SITE_URL}/prediction`;
  const message = my
    ? `🏆 MST Prediction Leaderboard တွင် အဆင့် #${rank} (${points} PTS) ဖြင့် ဦးဆောင်နေပါသည်!\n\nဘောလုံးပွဲစဉ်များ အခမဲ့ခန့်မှန်းပြီး ဆုလက်ဆောင်များ ရယူပါ:\n${url}\n\n#MSTScore #MSTLeaderboard`
    : `🏆 Ranked #${rank} with ${points} PTS on the MST Score Prediction Leaderboard!\n\nJoin the challenge on Myanmar Sports Talk:\n${url}\n\n#MSTScore #MSTLeaderboard`;

  try {
    await Share.share({ title: "MST Leaderboard Rank", message, url });
  } catch {
    // Non-blocking
  }
}
