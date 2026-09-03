import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const alpha = read("src/phase4b/Phase4BScoresInternalAlpha.js");
const preview = read("src/phase4b/Phase4BMatchPreviewScreen.js");
const profile = read("src/phase4b/Phase4BProfileScreen.js");
const search = read("src/phase4b/Phase4BSearchScreen.js");
const hub = read("src/phase4b/Phase4BReadOnlyHub.js");
const settings = read("src/final/SettingsScreenV2.js");

console.log("Validating NEW MST Scores Release-Polish Contracts...");

// 1. DATE SELECTOR COMPACT CONTRACT
assert.match(alpha, /compactDateContainer/, "Date container must use compact layout");
assert.match(alpha, /dateArrowBtn/, "Date selector must have prev/next arrow buttons");
assert.match(alpha, /handlePrev/, "Date selector must support tapping prev date");
assert.match(alpha, /handleNext/, "Date selector must support tapping next date");
assert.match(alpha, /height:\s*38/, "Date selector container height must be 38px");
assert.match(alpha, /width:\s*44,\s*height:\s*30/, "Date pills must have stable fixed dimensions (44x30)");

// 2. PRIMARY SWIPE NAVIGATION CONTRACT
assert.match(alpha, /pagingEnabled/, "Horizontal pager must have pagingEnabled");
assert.match(alpha, /nestedScrollEnabled/, "Horizontal pager must enable nested scrolling for vertical lists");
assert.match(alpha, /onMomentumScrollEnd/, "Horizontal pager must update active state on scroll end");
assert.match(alpha, /MatchesScreen[\s\S]*NewsScreen[\s\S]*FavoritesScreen/, "Pager must sequence Matches <-> News <-> Favorites");

// 3. BOTTOM NAVIGATION & COLOR SYSTEM CONTRACT
assert.doesNotMatch(alpha, /id:\s*"more"/, "More tab must be removed from NAV_ITEMS");
assert.match(alpha, /id:\s*"settings"/, "Settings tab must be present in NAV_ITEMS");
assert.match(alpha, /color=\{selected \? T\.color\.red : T\.color\.muted\}/, "Only active tab must use red");
assert.doesNotMatch(alpha, /bigMatchCard:\s*\{[^}]*borderColor:\s*T\.color\.red/, "Big match card must not use full bright red border");

// 4. SEARCH & PROFILE IN TOP HEADER
assert.match(alpha, /search-outline/, "Header must contain search icon");
assert.match(alpha, /person-circle-outline|headerAvatar/, "Header must contain profile icon or avatar");
assert.match(alpha, /openSearch/, "Header must wire search action");
assert.match(alpha, /openProfile/, "Header must wire profile action");

// 5. ANDROID HARDWARE BACK & DOUBLE-PRESS ROOT EXIT CONTRACT
assert.match(alpha, /lastBackPressRef/, "Root exit must track back press timestamp");
assert.match(alpha, /Press back again to exit/, "Root exit must warn user on first press");
assert.match(alpha, /ToastAndroid\.show/, "Root exit must show unobtrusive Android toast");
assert.match(alpha, /if\s*\(previewMatch\)/, "Hardware Back must pop match preview");
assert.match(alpha, /if\s*\(subScreen\)/, "Hardware Back must pop subscreen");
assert.match(alpha, /if\s*\(selectedMatch\)/, "Hardware Back must pop match center");
assert.match(alpha, /if\s*\(active\s*!==\s*"matches"\)/, "Hardware Back must return to matches from other tabs");

// 6. IN-APP PROFESSIONAL MATCH PREVIEW
assert.match(preview, /ScreenHeader/, "Match Preview must render standardized header");
assert.match(preview, /matchCenterPreviewQuality/, "Match Preview must verify quality");
assert.match(preview, /matchCenterPreviewSections/, "Match Preview must map full structured sections");
assert.match(preview, /Read on Myanmar Sports Talk Website/, "Website must remain secondary option");
assert.match(preview, /BackHandler/, "Match Preview must handle hardware Back");

// 7. EDITABLE PROFILE & AVATAR CROP
assert.match(profile, /allowsEditing:\s*true/, "Image picker must enable native crop editing");
assert.match(profile, /aspect:\s*\[1,\s*1\]/, "Image crop must enforce 1:1 square aspect ratio");
assert.match(profile, /uploadAvatar/, "Profile must wire avatar upload API");
assert.match(profile, /updateProfile/, "Profile must wire profile info update API");
assert.match(profile, /PREVIEW/, "Profile must show cropped preview before saving");
assert.match(profile, /BackHandler/, "Profile must handle hardware Back");

// 8. TIPS & TIPSTER LEADERBOARD HIERARCHY
assert.match(hub, /label:\s*"Tipster Leaderboard"/, "Tipster Leaderboard must be clearly labeled under Tips");
assert.match(hub, /setSubTab\("tips"\)/, "Back press inside tipsters/leaderboard must return to tips subtab");

// 9. SETTINGS DIRECT ACCESS
assert.match(settings, /openProfile/, "Settings must support opening profile");

console.log("All NEW MST Scores Release-Polish Contracts PASS!");
