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

function removeBlock(start, end, label) {
  const startIndex = source.indexOf(start);
  if (startIndex === -1) return;
  const endIndex = source.indexOf(end, startIndex);
  if (endIndex === -1) throw new Error(`Patch end anchor missing: ${label}`);
  source = source.slice(0, startIndex) + source.slice(endIndex + end.length);
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
  '            <DependencyCard icon="play-circle-outline" title="Watch Video to unlock MST prediction" text="Rewarded-video unlock is not connected yet. No fake unlock is possible." action="DISABLED" />\n',
  '',
  "legacy rewarded Prediction unlock",
);
replaceOnce(
  '    ["notifications-outline", "Notifications", "Not connected"],\n',
  '',
  "obsolete notifications placeholder",
);
replaceOnce(
  '      <DependencyCard icon="ribbon-outline" title="Become a Tipster" text="Final path starts in MST Prediction, continues to the MST website, and is reviewed in Web Admin." action="LINK UNAVAILABLE" />\n',
  '',
  "unverified Become a Tipster handoff",
);
replaceOnce(
  'function MoreScreen({ onSelect }) {\n  const rows = [\n    ["language-outline", "Language", "Burmese / English"],\n    ["moon-outline", "Appearance", "Dark / light / system"],\n    ["card-outline", "Payments & cards", "Not connected"],\n    ["document-text-outline", "Terms, Privacy & Policies", "Final content pending"],\n    ["information-circle-outline", "About MST", "Product shell"],\n    ["help-circle-outline", "Support / Help", "Integration pending"],\n  ];\n  return (\n    <ShellScreen title="More" eyebrow="SETTINGS · SUPPORT" active="more" onSelect={onSelect}>\n      <Phase4BSearchPanel />\n      <Phase4BNotificationsPanel />\n      <View style={s.profileCard}><View style={s.profileAvatar}><Ionicons name="football-outline" size={28} color={T.color.red} /></View><View style={s.dependencyCopy}><Text style={s.dependencyTitle}>MST Scores</Text><Text style={s.dependencyText}>Follow the Game · account-backed favorites, notifications and read-only prediction data use existing MST services.</Text></View></View>\n      <View style={s.menuCard}>{rows.map(([icon, title, detail]) => <View key={title} style={s.menuRow}><Ionicons name={icon} size={19} color={T.color.secondary} /><Text style={s.menuTitle}>{title}</Text><Text style={s.menuDetail}>{detail}</Text><Ionicons name="chevron-forward" size={16} color={T.color.muted} /></View>)}</View>\n    </ShellScreen>\n  );\n}',
  'function MoreScreen({ onSelect }) {\n  return (\n    <ShellScreen title="More" eyebrow="SEARCH · NOTIFICATIONS" active="more" onSelect={onSelect}>\n      <Phase4BSearchPanel />\n      <Phase4BNotificationsPanel />\n      <View style={s.profileCard}><View style={s.profileAvatar}><Ionicons name="football-outline" size={28} color={T.color.red} /></View><View style={s.dependencyCopy}><Text style={s.dependencyTitle}>MST Scores</Text><Text style={s.dependencyText}>Follow the Game · account-backed favorites, notifications and read-only prediction data use existing MST services.</Text></View></View>\n    </ShellScreen>\n  );\n}',
  "remove unfinished public More controls",
);
replaceOnce(
  '      <EnvironmentBanner />',
  '      {process.env.EXPO_PUBLIC_MST_ENVIRONMENT !== "production" ? <EnvironmentBanner /> : null}',
  "production environment banner",
);

removeBlock(
  '      {featuredMatch ? (\n        <View style={s.featuredPrediction}>',
  '      ) : <TerminalState empty emptyTitle="No prediction match" emptyText="No real match is available for a read-only preview." />}\n',
  "legacy featured Prediction unlock block",
);
replaceOnce(
  '      <View style={s.scoringCard}><Text style={s.sectionEyebrow}>SHARED SCORING</Text><View style={s.scoringRow}><Text style={s.scoreRule}>Exact score <Text style={s.scorePoints}>3</Text></Text><Text style={s.scoreRule}>Correct result <Text style={s.scorePoints}>1</Text></Text><Text style={s.scoreRule}>Wrong <Text style={s.scorePoints}>0</Text></Text></View></View>\n',
  '',
  "legacy Prediction scoring card",
);

const replacements = new Map([
  ["Tips + Prediction", "Tips"],
  ["Prediction / Tip preview", "MST Tip Preview"],
  ["READ ONLY IN MST SCORES", "TIPS · ENTITLEMENTS · LEADERBOARDS"],
  ["MST Scores can consume authorized predictions and tips, but cannot create, edit, or submit them.", "MST Scores can show the read-only Prediction leaderboard and MST Tips, but exact-score prediction creation, editing and submission stay in MST Prediction."],
  ["Loading staging data…", "Loading match data…"],
  ["Staging dependency unavailable", "Scores service unavailable"],
  ["The request stops after 8 seconds if staging does not respond.", "The request stops after 8 seconds if the Scores service does not respond."],
  ["The selected staging view is honestly empty.", "The selected match view is empty."],
  ["No real staging match is scheduled for this date. Choose another date or retry.", "No real match is scheduled for this date. Choose another date or retry."],
  ["Account-backed favorites are not available from the current staging Scores API. Nothing has been fabricated or persisted.", "Account-backed favorites are connected through the existing MST account service."],
  ["Real staging matches", "Real matches"],
  ["No staging matches", "No matches"],
  ["No real staging match is available for a read-only preview.", "No real match is available for a read-only preview."],
  ["The current staging Match detail response does not provide", "The current Match detail response does not provide"],
  ["The real staging tips response is empty. No selection was invented.", "The real tips response is empty. No selection was invented."],
  ["Could not load staging matches.", "Could not load matches."],
  ["staging record", "record"],
  ["staging field", "field"],
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
  "Tips + Prediction",
  "Prediction / Tip preview",
  "MST PREDICTION UNLOCK",
  "Watch Video to unlock MST prediction",
  "Watch Video unavailable",
  "SHARED SCORING",
  "Rewarded-video unlock",
  "staging deep-link contract",
  '["notifications-outline", "Notifications", "Not connected"]',
  "Payments & cards",
  "Final content pending",
  "Integration pending",
  "Product shell",
  "Become a Tipster",
]) {
  if (source.includes(forbidden)) throw new Error(`Release cleanup failed: ${forbidden}`);
}
if (source.includes('require("./src/AppFinalShell")')) throw new Error("Old AppFinalShell reference unexpectedly found in Phase 4B source");

fs.writeFileSync(path, source);
console.log("Applied Sep 2 Phase 4B release integrations without rebuilding the app UI.");
