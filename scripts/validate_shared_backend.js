const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

const packageJson = JSON.parse(read("package.json"));
const account = read("src/services/accountApi.js");
const accountScreen = read("src/final/AccountScreenV2.js");
const billing = read("src/services/billingService.js");
const shell = read("src/AppFinalShellV2.js");
const quickScores = read("src/final/QuickScoresScreen.js");
const footballClassification = read("src/services/footballClassification.js");
const validationWorkflow = read(".github/workflows/validate-app.yml");
const easWorkflow = read(".github/workflows/eas-build.yml");
const services = files(path.join(root, "src", "services"))
  .filter((file) => /\.js$/.test(file))
  .map((file) => ({ file, source: fs.readFileSync(file, "utf8") }));

assert.equal(packageJson.dependencies["expo-secure-store"], "~15.0.8");
assert.match(account, /SecureStore\.getItemAsync\(AUTH_TOKEN_KEY\)/);
assert.match(account, /LEGACY_AUTH_TOKEN_KEY/);
assert.match(account, /AUTH_TOKEN_MIGRATION_KEY/);
assert.doesNotMatch(account, /AsyncStorage\.setItem\(AUTH_TOKEN_KEY/);
assert.match(account, /method:\s*"DELETE",\s*body:\s*\{\s*token:\s*pushToken/);
assert.match(account, /MST_SITE_ORIGIN/);
assert.doesNotMatch(account, /`\$\{MST_SITE_URL\}/);
assert.match(account, /resend\s*\?\s*\{\s*resend:\s*true\s*\}/);
assert.match(account, /points:\s*raw\.points\s*\?\?\s*raw\.predictionPoints\s*\?\?\s*raw\.score\s*\?\?\s*null/);
assert.match(accountScreen, /REQUEST NEW CODE/);
assert.match(accountScreen, /startEmailLogin\(email,\s*\{\s*resend:\s*true\s*\}\)/);
assert.match(accountScreen, /getAccountPredictions\(\)/);
assert.match(accountScreen, /meta\?\.summary\?\.points/);
assert.match(accountScreen, /predictionPointsFrom\(predictions\)/);
assert.match(quickScores, /import \{ isPremierLeagueEngland \} from "\.\.\/services\/footballClassification"/);
assert.match(quickScores, /aIsEpl = isPremierLeagueEngland\(a\)/);
assert.doesNotMatch(quickScores, /const POPULAR = \[[^\]]*"Premier League"/);
assert.match(footballClassification, /country === "england" && \/\\b\(premier\\s\*league\|epl\)\\b\/i\.test\(compName\)/);

assert.doesNotMatch(shell, /\[\?&\]token=/);
assert.doesNotMatch(billing, /Math\.random|token_\$\{|GPA\.\$\{/);
assert.match(billing, /GOOGLE_PLAY_BILLING_NOT_CONFIGURED/);
assert.match(billing, /\/account\/wallet\/packages/);
assert.match(billing, /purchasingEnabled\s*===\s*true/);
assert.match(billing, /provider\?\.enabled\s*===\s*true/);

for (const workflow of [validationWorkflow, easWorkflow]) {
  assert.doesNotMatch(workflow, /actions\/(?:checkout|setup-node)@v[1-6]\b/);
  assert.match(workflow, /npm ci/);
}
assert.doesNotMatch(validationWorkflow, /contents:\s*write|git push|npm install\b/);
assert.match(validationWorkflow, /pull_request:/);

for (const { file, source } of services) {
  if (file.endsWith("mstApiConfig.js")) continue;
  assert.doesNotMatch(source, /https:\/\/myanmarsportstalk\.com\/api/, `${file} bypasses the canonical API config`);
}

const clientSource = files(path.join(root, "src"))
  .filter((file) => /\.js$/.test(file))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
assert.doesNotMatch(clientSource, /API_FOOTBALL_KEY|api[_-]?football[_-]?key/i);
assert.doesNotMatch(clientSource, /@cloudflare\/|wrangler\s+d1|D1Database/);

console.log("MST shared-backend client validation passed.");
