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
const billing = read("src/services/billingService.js");
const shell = read("src/AppFinalShellV2.js");
const services = files(path.join(root, "src", "services"))
  .filter((file) => /\.js$/.test(file))
  .map((file) => ({ file, source: fs.readFileSync(file, "utf8") }));

assert.equal(packageJson.dependencies["expo-secure-store"], "~15.0.8");
assert.match(account, /SecureStore\.getItemAsync\(AUTH_TOKEN_KEY\)/);
assert.match(account, /LEGACY_AUTH_TOKEN_KEY/);
assert.match(account, /AUTH_TOKEN_MIGRATION_KEY/);
assert.doesNotMatch(account, /AsyncStorage\.setItem\(AUTH_TOKEN_KEY/);
assert.match(account, /method:\s*"DELETE",\s*body:\s*\{\s*token:\s*pushToken/);

assert.doesNotMatch(shell, /\[\?&\]token=/);
assert.doesNotMatch(billing, /Math\.random|token_\$\{|GPA\.\$\{/);
assert.match(billing, /GOOGLE_PLAY_BILLING_NOT_CONFIGURED/);
assert.match(billing, /\/account\/wallet\/packages/);

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

