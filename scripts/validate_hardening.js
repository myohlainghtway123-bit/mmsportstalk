const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});

const config = read("src/services/mstApiConfig.js");
const account = read("src/services/accountApi.js");
const network = read("src/services/mstNetwork.js");
const notifications = read("src/services/notificationApi.js");
const engagement = read("src/services/matchEngagementApi.js");
const tipsApi = read("src/services/tipsApi.js");
const billing = read("src/services/billingService.js");
const accountScreen = read("src/final/AccountScreenV2.js");
const chat = read("src/services/communityApi.js");
const chatScreen = read("src/final/NativeMatchScreenV5.js");
const search = read("src/services/smartSearchApi.js");
const searchScreen = read("src/final/SearchScreen.js");
const football = read("src/services/fastFootballApi.js");
const footballNormalizer = read("src/services/footballApi.js");
const home = read("src/final/HomeScreen.js");
const scores = read("src/final/QuickScoresScreen.js");
const prediction = read("src/final/PredictionScreenV2.js");
const tips = read("src/final/TipsScreen.js");
const content = read("src/services/contentApi.js");
const settings = read("src/final/SettingsScreenV2.js");

assert.match(config, /MST_API_ORIGIN = "https:\/\/app-api\.myanmarsportstalk\.com"/);
assert.match(config, /MST_CHAT_ORIGIN = "https:\/\/chat\.myanmarsportstalk\.com"/);
assert.match(config, /MST_CHAT_WS_URL/);

const productionSource = walk(path.join(root, "src")).filter((file) => file.endsWith(".js")).map((file) => fs.readFileSync(file, "utf8")).join("\n");
assert.doesNotMatch(productionSource, /https?:\/\/(?:localhost|127\.0\.0\.1)|staging/i);
assert.doesNotMatch(productionSource, /media\.api-sports\.io|v3\.football\.api-sports\.io/);
assert.doesNotMatch(productionSource, /API_FOOTBALL_KEY|x-apisports-key/i);

assert.match(account, /SecureStore\.getItemAsync/);
assert.doesNotMatch(account, /Cookie:\s*`mst_user_session/);
assert.match(account, /username:\s*typeof username/);
assert.match(account, /XMLHttpRequest/);
assert.match(account, /xhr\.upload\.onprogress/);
assert.match(accountScreen, /ImageManipulator\.manipulate/);
assert.match(accountScreen, /SaveFormat\.JPEG/);
assert.match(accountScreen, /updateProfile\(\{ username: clean \}\)/);
assert.match(accountScreen, /profileSaving/);

assert.match(network, /DEFAULT_TIMEOUT_MS = 15000/);
assert.match(network, /RETRYABLE_STATUS = new Set\(\[408, 429, 502, 503\]\)/);
assert.match(network, /safeToRetry = upperMethod === "GET" \|\| upperMethod === "HEAD"/);
assert.match(network, /returned malformed JSON/);
[notifications, engagement, tipsApi, billing].forEach((service) => {
  assert.match(service, /mstJsonRequest/);
});

assert.match(chat, /MST_CHAT_API_BASE/);
assert.match(chat, /new WebSocket/);
assert.match(chat, /headers: \{ Authorization: `Bearer \$\{token\}` \}/);
assert.match(chat, /AppState\.addEventListener/);
assert.match(chat, /scheduleReconnect/);
assert.match(chat, /createClientMessageId/);
assert.match(chat, /mergeChatMessages/);
assert.match(chatScreen, /deliveryState: "failed"/);
assert.match(chatScreen, /Load earlier messages/);
assert.match(chatScreen, /<FlatList/);
assert.doesNotMatch(chatScreen, /setInterval\(\(\) => load\(true\), 5000\)/);

assert.match(searchScreen, /new AbortController/);
assert.match(searchScreen, /searchSequence\.current/);
assert.match(searchScreen, /visiblePlayers\.map/);
assert.match(searchScreen, /openEntity\?\.\("player"/);
assert.match(search, /CACHE_LIMIT/);
assert.match(search, /setTimeout\(abort, 12000\)/);
assert.match(search, /meta\?\.partial/);

assert.match(footballNormalizer, /statusCode/);
assert.match(football, /mergeMatchSnapshot/);
assert.match(football, /MAX_CACHED_DATES/);
assert.match(football, /new Map\(\)/);
assert.match(home, /matchRequestSequence/);
assert.match(scores, /requestSequence/);

assert.match(prediction, /savePredictionScore/);
assert.match(prediction, /savingId/);
assert.doesNotMatch(prediction, /points\s*\+=|setPoints\(/);
assert.match(tips, /MST_SITE_ORIGIN.*tipsters\/apply|tipsters\/apply/);
assert.doesNotMatch(tips, /startTipsterQualification|submitQualificationTip/);
assert.doesNotMatch(tipsApi, /\/tipsters\/apply|\/tipsters\/qualification/);
assert.match(content, /weekly_article/);
assert.match(content, /relatedMatchId/);
assert.match(settings, /deleteAccount\(\)/);

console.log("MST Android hardening validation passed.");
