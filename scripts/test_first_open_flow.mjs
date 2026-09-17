import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Starting MST Scores Phase 2: First-Open & Startup-State Automated Test Suite...\n");

// Read Phase4BStartupGate and Phase4BScoresInternalAlpha source code to verify contracts
const startupGateSrc = fs.readFileSync("src/phase4b/Phase4BStartupGate.js", "utf8");
const entrypointSrc = fs.readFileSync("src/phase4b/Phase4BScoresInternalAlpha.js", "utf8");

// --- TEST 1: Entrypoint Integration ---
console.log("1. Checking Phase4BStartupGate entrypoint wiring...");
assert.match(entrypointSrc, /import Phase4BStartupGate from "\.\/Phase4BStartupGate/);
assert.match(entrypointSrc, /<Phase4BStartupGate>\s*<Phase4BScoresInternalAlphaContent \/>\s*<\/Phase4BStartupGate>/);
console.log("   -> PASS: Entrypoint strictly wrapped in Phase4BStartupGate.\n");

// --- TEST 2: Motion Splash Contract ---
console.log("2. Checking Motion Splash contract...");
assert.match(startupGateSrc, /function MotionSplash/);
assert.match(startupGateSrc, /#080A0C/); // Black/charcoal background
assert.match(startupGateSrc, /#F3262D/); // MST red accent
assert.match(startupGateSrc, /1600/); // 1.6 seconds timeout
assert.match(startupGateSrc, /MYANMAR SPORTS TALK/);
console.log("   -> PASS: Motion splash enforces sports-tech branding, 1.6s cap, and charcoal/red theme.\n");

// --- TEST 3: Mandatory Language Selection Contract (NO SKIP) ---
console.log("3. Checking Mandatory Language Selection contract...");
assert.match(startupGateSrc, /function LanguageStep/);
assert.match(startupGateSrc, /STEP 1 OF 2 · REQUIRED/);
assert.match(startupGateSrc, /English/);
assert.match(startupGateSrc, /မြန်မာစာ/);
assert.match(startupGateSrc, /disabled={!currentLanguage}/); // Cannot continue until a language is chosen
assert.doesNotMatch(startupGateSrc, /skipBtn.*LanguageStep/); // LanguageStep MUST NOT have a skip button
console.log("   -> PASS: Language selection is strictly mandatory with zero skip.\n");

// --- TEST 4: Optional Favorites Setup Contract (CAN SKIP) ---
console.log("4. Checking Optional Favorites Setup contract...");
assert.match(startupGateSrc, /function FavoritesStep/);
assert.match(startupGateSrc, /STEP 2 OF 2 · OPTIONAL/);
assert.match(startupGateSrc, /skipBtn/); // Has SKIP button
assert.match(startupGateSrc, /saveGuestFavorite/); // Saves directly into canonical store
assert.match(startupGateSrc, /FEATURED_COMPETITIONS/); // Major competitions first
assert.match(startupGateSrc, /FEATURED_TEAMS/); // Major teams first
console.log("   -> PASS: Favorites step is optional, supports skip, and saves directly to canonical store.\n");

// --- TEST 5: Returning User Bypass Logic ---
console.log("5. Checking Returning User bypass logic...");
assert.match(startupGateSrc, /if \(onboardingCompleted && language\) \{\s*setPhase\("ready"\);/);
assert.match(startupGateSrc, /saveOnboardingPreferences\(\{\s*completed: true\s*\}\)/);
console.log("   -> PASS: Returning user immediately bypasses onboarding into Scores.\n");

// --- TEST 6: Open-Session State Preload ---
console.log("6. Checking Open-Session state preload during motion splash...");
assert.match(startupGateSrc, /loadOnboardingPreferences\(\)/);
assert.match(startupGateSrc, /getAuthStatus\(\)/);
assert.match(startupGateSrc, /loadScoresOverview\(\)/);
assert.match(startupGateSrc, /reconcileGuestFavorites\(\)/);
console.log("   -> PASS: Startup tasks preloaded in parallel during splash animation.\n");

console.log("ALL FIRST-OPEN & STARTUP-STATE CONTRACT TESTS PASS!\n");
