import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const onboarding = await read("src/services/onboardingStore.js");
const scores = await read("src/phase4b/Phase4BScoresInternalAlpha.js");
const startup = await read("src/phase4b/Phase4BStartupGate.js");
const billing = await read("src/services/billingService.js");
const tipsHub = await read("src/phase4b/Phase4BReadOnlyHub.js");
const rewarded = await read("src/phase4b/Phase4BRewardedPrediction.js");
const adBanner = await read("src/phase4b/Phase4BAdBanner.js");
const searchPanel = await read("src/phase4b/Phase4BSearchPanel.js");
const smartSearch = await read("src/services/smartSearchApi.js");
const fifaRanking = await read("src/services/fifaRankingApi.js");
const nationalTeamScreen = await read("src/final/NativeNationalTeamScreen.js");
const appConfig = await read("app.config.js");
const pkg = JSON.parse(await read("package.json"));

assert.match(onboarding, /@mst-score\/app-language-v1/);
assert.match(onboarding, /export async function loadAppLanguage/);
assert.match(onboarding, /storage\.setItem\(LANGUAGE_KEY, clean\)/);
assert.match(scores, /const \[language, setLanguage\] = useState\(null\)/);
assert.match(scores, /const \[languageReady, setLanguageReady\] = useState\(false\)/);
assert.match(scores, /loadAppLanguage\(\)/);
assert.match(scores, /SafeAreaView/);
assert.match(scores, /<SafeAreaView style=\{\[s\.root/);
assert.match(scores, /<\/SafeAreaView>/);
assert.doesNotMatch(scores, /const \[language, setLanguage\] = useState\("my"\)/);
assert.match(startup, /Promise\.all\(\[loadOnboardingPreferences\(\), loadAppLanguage\(\)\]\)/);

assert.match(billing, /getCreditStorefront/);
assert.match(billing, /verifyPlayPurchaseOnServer/);
assert.doesNotMatch(billing, /setBalance\s*\(/);
assert.doesNotMatch(billing, /GOOGLE_PLAY_BILLING_CLIENT_NOT_CONNECTED/);

assert.equal(pkg.dependencies?.["react-native-iap"], "14.1.0");
assert.equal(pkg.dependencies?.["react-native-nitro-modules"], "0.29.2");
assert.equal(pkg.dependencies?.["expo-build-properties"], "1.0.10");
assert.match(appConfig, /react-native-iap/);
assert.match(appConfig, /kotlinVersion: "2\.1\.20"/);
assert.match(appConfig, /enableMinifyInReleaseBuilds:\s*true/);
assert.match(appConfig, /enableShrinkResourcesInReleaseBuilds:\s*true/);
assert.match(appConfig, /extraProguardRules/);
assert.match(appConfig, /-keep class com\.margelo\.nitro\.iap\.\*\* \{ \*; \}/);

assert.match(tipsHub, /useIAP/);
assert.match(tipsHub, /requestPurchase/);
assert.match(tipsHub, /google:\s*\{/);
assert.match(tipsHub, /obfuscatedAccountId:\s*accountId/);
assert.match(tipsHub, /apple:\s*\{\s*sku:/);
assert.doesNotMatch(tipsHub, /android:\s*\{\s*skus:/);
assert.doesNotMatch(tipsHub, /ios:\s*\{\s*sku:/);
assert.match(tipsHub, /verifyPlayPurchaseOnServer/);
assert.match(tipsHub, /finishTransaction\(\{ purchase, isConsumable: true \}\)/);
assert.match(tipsHub, /BUY WITH GOOGLE PLAY/);
assert.match(tipsHub, /tipPriceCredits/);
assert.doesNotMatch(tipsHub, /setBalance\s*\(/);
assert.doesNotMatch(tipsHub, /setTransactions\s*\(/);
assert.doesNotMatch(tipsHub, /handleConfirmPurchase/);
assert.doesNotMatch(tipsHub, /id:\s*["']promptpay["']/);
assert.doesNotMatch(tipsHub, /id:\s*["']kpay["']/);
assert.doesNotMatch(tipsHub, /id:\s*["']wave["']/);
assert.doesNotMatch(tipsHub, /id:\s*["']truemoney["']/);
assert.doesNotMatch(tipsHub, /id:\s*["']card_int["']/);

assert.match(rewarded, /RewardedAdEventType\.EARNED_REWARD/);
assert.match(rewarded, /EXPO_PUBLIC_MST_ADMOB_ANDROID_REWARDED_UNIT_ID/);
assert.match(rewarded, /gatherConsentIfRequired/);
assert.match(rewarded, /loadMstMatchPrediction/);
assert.doesNotMatch(rewarded, /48%|28%|24%|65%/);
assert.doesNotMatch(rewarded, /Direct unlock|Unlocking prediction directly|handleEarnedReward\(\);\s*return;/);
assert.match(adBanner, /consent\?\.canRequestAds/);

assert.match(searchPanel, /row\.national \? "NATIONAL TEAM"/);
assert.doesNotMatch(searchPanel, /Myanmar National Team/);
assert.doesNotMatch(searchPanel, /Thailand National Team/);
assert.doesNotMatch(searchPanel, /teams\/1563\.png/);
assert.doesNotMatch(searchPanel, /teams\/1568\.png/);
assert.match(smartSearch, /cleaned\.length < 3/);
assert.match(smartSearch, /teamSearchRank/);
assert.match(searchPanel, /fetchFifaMenRanking/);
assert.match(searchPanel, /type="National Team"/);
assert.match(searchPanel, /entityType = type === "National Team" \? "national_team"/);
assert.match(fifaRanking, /rankings\/fifa/);
assert.match(nationalTeamScreen, /official men's world ranking/i);
assert.match(scores, /NativeNationalTeamScreen/);
assert.match(scores, /selectedEntity\.type === "national_team"/);

console.log("Release language, Play billing, and rewarded-ad safety checks passed.");
