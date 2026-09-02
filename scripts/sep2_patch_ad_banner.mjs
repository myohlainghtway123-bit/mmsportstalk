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
  'import Phase4BNewsPanel from "./Phase4BNewsPanel";\n',
  'import Phase4BNewsPanel from "./Phase4BNewsPanel";\nimport Phase4BAdBanner from "./Phase4BAdBanner";\n',
  "AdMob banner import",
);
replaceOnce(
  '      <Phase4BNewsPanel />\n',
  '      <Phase4BNewsPanel />\n      <Phase4BAdBanner />\n',
  "non-critical News ad placement",
);

for (const marker of [
  'import Phase4BAdBanner from "./Phase4BAdBanner";',
  '<Phase4BAdBanner />',
]) {
  if (!source.includes(marker)) throw new Error(`AdMob runtime integration missing: ${marker}`);
}

fs.writeFileSync(path, source);
console.log("Applied safe AdMob banner placement outside live-score and purchase flows.");
