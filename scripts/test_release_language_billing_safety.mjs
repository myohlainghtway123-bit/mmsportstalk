import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const onboarding = await read("src/services/onboardingStore.js");
const scores = await read("src/phase4b/Phase4BScoresInternalAlpha.js");
const startup = await read("src/phase4b/Phase4BStartupGate.js");
const billing = await read("src/services/billingService.js");
const tipsHub = await read("src/phase4b/Phase4BReadOnlyHub.js");

assert.match(onboarding, /@mst-score\/app-language-v1/);
assert.match(onboarding, /export async function loadAppLanguage/);
assert.match(onboarding, /storage\.setItem\(LANGUAGE_KEY, clean\)/);
assert.match(scores, /const \[language, setLanguage\] = useState\(null\)/);
assert.match(scores, /const \[languageReady, setLanguageReady\] = useState\(false\)/);
assert.match(scores, /loadAppLanguage\(\)/);
assert.doesNotMatch(scores, /const \[language, setLanguage\] = useState\("my"\)/);
assert.match(startup, /Promise\.all\(\[loadOnboardingPreferences\(\), loadAppLanguage\(\)\]\)/);

assert.match(billing, /getCreditStorefront/);
assert.match(billing, /GOOGLE_PLAY_BILLING_NOT_CONFIGURED/);
assert.match(billing, /GOOGLE_PLAY_BILLING_CLIENT_NOT_CONNECTED/);
assert.match(billing, /verifyPlayPurchaseOnServer/);
assert.doesNotMatch(billing, /setBalance\s*\(/);

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
assert.doesNotMatch(tipsHub, /Complete payment to unlock this tip/);

console.log("Release language persistence and Play billing safety checks passed.");
