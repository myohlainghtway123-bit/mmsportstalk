import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const onboarding = await read("src/services/onboardingStore.js");
const scores = await read("src/phase4b/Phase4BScoresInternalAlpha.js");
const startup = await read("src/phase4b/Phase4BStartupGate.js");
const billing = await read("src/services/billingService.js");
const tipsHub = await read("src/phase4b/Phase4BReadOnlyHub.js");
const rewarded = await read("src/phase4b/Phase4BRewardedPrediction.js");
const matchScreen = await read("src/final/NativeMatchScreenV5.js");
const appConfig = await read("app.config.js");
const packageJson = JSON.parse(await read("package.json"));

assert.match(onboarding, /@mst-score\/app-language-v1/);
assert.match(onboarding, /export async function loadAppLanguage/);
assert.match(onboarding, /storage\.setItem\(LANGUAGE_KEY, clean\)/);
assert.match(scores, /const \[language, setLanguage\] = useState\(null\)/);
assert.match(scores, /const \[languageReady, setLanguageReady\] = useState\(false\)/);
assert.match(scores, /loadAppLanguage\(\)/);
assert.doesNotMatch(scores, /const \[language, setLanguage\] = useState\("my"\)/);
assert.match(startup, /Promise\.all\(\[loadOnboardingPreferences\(\), loadAppLanguage\(\)\]\)/);

assert.equal(packageJson.dependencies?.["expo-iap"], "5.6.3");
assert.match(appConfig, /plugins\.push\("expo-iap"\)/);
assert.match(billing, /getCreditStorefront/);
assert.match(billing, /verifyPlayPurchaseOnServer/);
assert.match(billing, /creditPackageForProduct/);
assert.match(tipsHub, /useIAP/);
assert.match(tipsHub, /autoFinishTransactions:\s*false/);
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

assert.match(rewarded, /const RewardedAd = ads\?\.RewardedAd/);
assert.match(rewarded, /RewardedAdEventType\.EARNED_REWARD/);
assert.match(rewarded, /prediction remains locked/);
assert.doesNotMatch(rewarded, /48%/);
assert.doesNotMatch(rewarded, /28%/);
assert.doesNotMatch(rewarded, /24%/);
assert.doesNotMatch(rewarded, /Unlocking prediction directly/);
assert.match(matchScreen, /Phase4BRewardedPrediction/);

console.log("Release language, Google Play billing, and rewarded-ad safety checks passed.");
