import fs from "node:fs";

const path = "src/phase4b/Phase4BScoresInternalAlpha.js";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  const index = source.indexOf(from);
  if (index === -1) throw new Error(`Patch anchor missing: ${label}`);
  source = source.slice(0, index) + to + source.slice(index + from.length);
}

replaceOnce(
  '} from "./scoresStagingApi";\n',
  '} from "./scoresStagingApi";\nimport Phase4BMatchVote from "./Phase4BMatchVote";\nimport Phase4BMatchInsights from "./Phase4BMatchInsights";\n',
  "release component imports",
);

replaceOnce(
  '<View style={s.sectionHeadingRow}><Text style={s.sectionTitle}>Match data</Text><Text style={s.matchCount}>Real staging response</Text></View>',
  '<Phase4BMatchVote match={match} />\n            <Phase4BMatchInsights match={match} />\n            <View style={s.sectionHeadingRow}><Text style={s.sectionTitle}>Match data</Text><Text style={s.matchCount}>Real Scores response</Text></View>',
  "Match Center release integrations",
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
  ["Account-backed favorites are not available from the current staging Scores API. Nothing has been fabricated or persisted.", "Account-backed favorites are not connected to this current Scores screen yet. Nothing has been fabricated or persisted."],
  ["Real staging matches", "Real matches"],
  ["No staging matches", "No matches"],
  ["There are no real matches to show here.", "There are no real matches to show here."],
  ["Real staging match · prediction remains locked until an authorized rewarded-video service exists.", "Real match · prediction remains read-only in MST Scores."],
  ["The current staging Match detail response does not provide", "The current Match detail response does not provide"],
  ["The real staging tips response is empty. No selection was invented.", "The real tips response is empty. No selection was invented."],
  ["Could not load staging matches.", "Could not load matches."],
]);

for (const [from, to] of replacements) source = source.split(from).join(to);

if (!source.includes('import Phase4BMatchVote from "./Phase4BMatchVote";')) throw new Error("Match Vote import was not applied");
if (!source.includes("<Phase4BMatchVote match={match} />")) throw new Error("Match Vote render was not applied");
if (!source.includes("<Phase4BMatchInsights match={match} />")) throw new Error("Match insights render was not applied");
if (source.includes('require("./src/AppFinalShell")')) throw new Error("Old AppFinalShell reference unexpectedly found in Phase 4B source");

fs.writeFileSync(path, source);
console.log("Applied Sep 2 Phase 4B release integrations without rebuilding the app UI.");
