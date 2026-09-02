import fs from "node:fs";

const path = "src/phase4b/Phase4BScoresInternalAlpha.js";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (to && source.includes(to)) return;
  const index = source.indexOf(from);
  if (index === -1) {
    if (!to) return;
    throw new Error(`Patch anchor missing: ${label}`);
  }
  source = source.slice(0, index) + to + source.slice(index + from.length);
}

replaceOnce(
  '} from "./scoresStagingApi";\n',
  '} from "./scoresStagingApi";\nimport Phase4BMatchVote from "./Phase4BMatchVote";\nimport Phase4BMatchInsights from "./Phase4BMatchInsights";\n',
  "release component imports",
);
replaceOnce(
  'import Phase4BMatchInsights from "./Phase4BMatchInsights";\n',
  'import Phase4BMatchInsights from "./Phase4BMatchInsights";\nimport Phase4BReadOnlyHub from "./Phase4BReadOnlyHub";\n',
  "read-only hub import",
);
replaceOnce(
  'import Phase4BReadOnlyHub from "./Phase4BReadOnlyHub";\n',
  'import Phase4BReadOnlyHub from "./Phase4BReadOnlyHub";\nimport Phase4BFavoritesPanel, { Phase4BMatchFavorites } from "./Phase4BFavoritesPanel";\nimport Phase4BNotificationsPanel from "./Phase4BNotificationsPanel";\nimport Phase4BSearchPanel from "./Phase4BSearchPanel";\n',
  "favorites notifications search imports",
);
replaceOnce(
  'import Phase4BSearchPanel from "./Phase4BSearchPanel";\n',
  'import Phase4BSearchPanel from "./Phase4BSearchPanel";\nimport Phase4BNewsPanel from "./Phase4BNewsPanel";\n',
  "news panel import",
);

replaceOnce(
  '<View style={s.sectionHeadingRow}><Text style={s.sectionTitle}>Match data</Text><Text style={s.matchCount}>Real staging response</Text></View>',
  '<Phase4BMatchVote match={match} />\n            <Phase4BMatchInsights match={match} />\n            <View style={s.sectionHeadingRow}><Text style={s.sectionTitle}>Match data</Text><Text style={s.matchCount}>Real Scores response</Text></View>',
  "Match Center release integrations",
);
replaceOnce(
  '            <Phase4BMatchVote match={match} />',
  '            <Phase4BMatchFavorites match={match} />\n            <Phase4BMatchVote match={match} />',
  "Match Center favorite controls",
);
replaceOnce(
  '      <DependencyCard icon="heart-outline" title="Favorite teams and competitions" text="Account-backed favorites are not connected to this current Scores screen yet. Nothing has been fabricated or persisted." action="NOT CONNECTED" />',
  '      <Phase4BFavoritesPanel />',
  "Favorites screen integration",
);
replaceOnce(
  '      <DependencyCard icon="cart-outline" title="Buy Tipster Tip" text="Purchase and entitlement services are not connected. No fake purchase or paid-tip access is offered." action="DISABLED" />\n      <View style={s.twoColumns}>\n        <View style={s.leaderboardCard}><Text style={s.leaderboardTitle}>Tipster Leaderboard</Text><Text style={s.leaderboardEmpty}>No authorized leaderboard route in the current Scores API.</Text></View>\n        <View style={s.leaderboardCard}><Text style={s.leaderboardTitle}>Prediction Leaderboard</Text><Text style={s.leaderboardEmpty}>No authorized leaderboard route in the current Scores API.</Text></View>\n      </View>\n      <DependencyCard icon="open-outline" title="Open MST Prediction App" text="The staging deep-link contract is not configured. Prediction creation stays in MST Prediction." action="LINK UNAVAILABLE" />',
  '      <Phase4BReadOnlyHub />\n      {featuredMatch ? <Phase4BMatchInsights match={featuredMatch} /> : null}',
  "Tips, purchased tips, leaderboards and Prediction app handoff",
);
replaceOnce(
  'function NewsScreen({ onSelect }) {\n  return (\n    <ShellScreen title="News" eyebrow="MST FOOTBALL EDITORIAL" active="news" onSelect={onSelect}>\n      <View style={s.placeholderHero}><Ionicons name="newspaper-outline" size={34} color={T.color.red} /><Text style={s.placeholderTitle}>News structure confirmed</Text><Text style={s.placeholderText}>The authorized editorial feed is not connected to this Phase 4B staging build. No fake articles are shown.</Text></View>\n      <DependencyCard icon="server-outline" title="Latest football news" text="Waiting for the authorized MST web/editorial product API." action="UNAVAILABLE" />\n      <DependencyCard icon="bookmark-outline" title="Saved stories" text="Persistence is intentionally deferred; this shell does not pretend stories are saved." action="PHASE 13" />\n    </ShellScreen>\n  );\n}',
  'function NewsScreen({ onSelect }) {\n  return (\n    <ShellScreen title="News" eyebrow="MST FOOTBALL EDITORIAL" active="news" onSelect={onSelect}>\n      <Phase4BNewsPanel />\n    </ShellScreen>\n  );\n}',
  "real MST News feed",
);
replaceOnce(
  '            <DependencyCard icon="open-outline" title="Open MST Prediction App" text="Staging deep-link contract is not configured. MST Scores cannot submit predictions." action="LINK UNAVAILABLE" />\n',
  '',
  "duplicate Match Center Prediction app placeholder",
);
replaceOnce(
  '    ["notifications-outline", "Notifications", "Not connected"],\n',
  '',
  "obsolete notifications placeholder",
);
replaceOnce(
  '      <View style={s.profileCard}><View style={s.profileAvatar}><Ionicons name="person-outline" size={28} color={T.color.muted} /></View><View style={s.dependencyCopy}><Text style={s.dependencyTitle}>Internal tester</Text><Text style={s.dependencyText}>Profile/account service is not connected in this Phase 4B build.</Text></View></View>\n      <View style={s.menuCard}>',
  '      <Phase4BSearchPanel />\n      <Phase4BNotificationsPanel />\n      <View style={s.profileCard}><View style={s.profileAvatar}><Ionicons name="football-outline" size={28} color={T.color.red} /></View><View style={s.dependencyCopy}><Text style={s.dependencyTitle}>MST Scores</Text><Text style={s.dependencyText}>Follow the Game · account-backed favorites, notifications and read-only prediction data use existing MST services.</Text></View></View>\n      <View style={s.menuCard}>',
  "More search notifications integration",
);
replaceOnce(
  '      <EnvironmentBanner />',
  '      {process.env.EXPO_PUBLIC_MST_ENVIRONMENT !== "production" ? <EnvironmentBanner /> : null}',
  "production environment banner",
);

const replacements = new Map([
  ["Loading staging data…", "Loading match data…"],
  ["Staging dependency unavailable", "Scores service unavailable"],
  ["The request stops after 8 seconds if staging does not respond.", "The request stops after 8 seconds if the Scores service does not respond."],
  ["The selected staging view is honestly empty.", "The selected match view is empty."],
  ["No real staging match is scheduled for this date. Choose another date or retry.", "No real match is scheduled for this date. Choose another date or retry."],
  ["Account-backed favorites are not available from the current staging Scores API. Nothing has been fabricated or persisted.", "Account-backed favorites are connected through the existing MST account service."],
  ["Real staging matches", "Real matches"],
  ["No staging matches", "No matches"],
  ["Real staging match · prediction remains locked until an authorized rewarded-video service exists.", "Real match · prediction remains read-only in MST Scores."],
  ["No real staging match is available for a read-only preview.", "No real match is available for a read-only preview."],
  ["The current staging Match detail response does not provide", "The current Match detail response does not provide"],
  ["The real staging tips response is empty. No selection was invented.", "The real tips response is empty. No selection was invented."],
  ["Could not load staging matches.", "Could not load matches."],
  ["staging record", "record"],
  ["staging field", "field"],
  ["Rewarded-video service is not connected in Phase 4B. No fake unlock is possible.", "Rewarded-video unlock is not connected yet. No fake unlock is possible."],
  ["Burmese / English · Phase 13", "Burmese / English"],
  ["Dark / light / system · Phase 13", "Dark / light / system"],
]);
for (const [from, to] of replacements) source = source.split(from).join(to);

for (const marker of [
  'import Phase4BMatchVote from "./Phase4BMatchVote";',
  'import Phase4BReadOnlyHub from "./Phase4BReadOnlyHub";',
  'import Phase4BFavoritesPanel, { Phase4BMatchFavorites } from "./Phase4BFavoritesPanel";',
  'import Phase4BNotificationsPanel from "./Phase4BNotificationsPanel";',
  'import Phase4BSearchPanel from "./Phase4BSearchPanel";',
  'import Phase4BNewsPanel from "./Phase4BNewsPanel";',
  '<Phase4BNewsPanel />',
  '<Phase4BMatchVote match={match} />',
  '<Phase4BMatchFavorites match={match} />',
  '<Phase4BMatchInsights match={match} />',
  '<Phase4BReadOnlyHub />',
  '<Phase4BFavoritesPanel />',
  '<Phase4BNotificationsPanel />',
  '<Phase4BSearchPanel />',
]) {
  if (!source.includes(marker)) throw new Error(`Release integration missing: ${marker}`);
}
for (const forbidden of [
  "staging deep-link contract",
  '["notifications-outline", "Notifications", "Not connected"]',
]) {
  if (source.includes(forbidden)) throw new Error(`Release cleanup failed: ${forbidden}`);
}
if (source.includes('require("./src/AppFinalShell")')) throw new Error("Old AppFinalShell reference unexpectedly found in Phase 4B source");

fs.writeFileSync(path, source);
console.log("Applied Sep 2 Phase 4B release integrations without rebuilding the app UI.");
