# Targeted Physical Android Verification & Release Polish Audit

**Date**: 2026-09-04  
**Branch**: `scores/release-polish-sep4`  
**PR**: #31  
**Target Device**: OPPO Reno4 (`CPH2059`), serial `c8513685`, Android 11 (API 30), Display 1080 x 2400  
**Status**: **ALL 11 PHYSICAL AREAS VERIFIED & PASSED (100% COMPLETE)**

---

## 1. Executive Summary

- **Device Reconnection & Verification**: Physical OPPO Reno4 (`CPH2059`, serial `c8513685`, Android 11, API 30) was reconnected and verified online via ADB.
- **Release Build Installed**: Rebuilt production/staging release APK with standard Android Material typography scale (`SettingsScreenV2`, `Phase4BMatchPreviewScreen`, `Phase4BProfileScreen`, `Phase4BSearchPanel`, `PolicyScreens`) via local Gradle (`./gradlew assembleRelease` at 06:39:36) and installed via ADB (`Success`).
- **Targeted Verification Scope**: All 11 targeted verification areas have been systematically executed and verified on the physical hardware with 60 captured high-resolution screenshots.
- **Automated Contracts & Separation**: All automated test suites (Release Polish contracts, product boundary separation, Phase 4B API/preview/bundle isolation, and iOS export) pass with zero errors and zero leaks.

---

## 2. Targeted Verification Matrix

| Area | Scope / Item | Result on Physical Device (`CPH2059`) | Evidence / Notes |
|---|---|---|---|
| **1** | **Home Date Selector** | **PASSED** | Screenshots `05`, `06`, `07`, `09`, `10`. Compact 42px height, 48x34 stable pill dimensions, prev/next arrows functional, smooth date switching with zero container expansion or layout jitter. |
| **2** | **Matches ↔ News ↔ Favorites Swipe & Footer Sync** | **PASSED** | Screenshots `11`, `12`, `13`, `14`, `15`. Smooth bidirectional horizontal swipe between Matches, News, and Favorites tabs. Footer selection highlights immediately in sync with swiped screen. |
| **3** | **Footer Color** | **PASSED** | Screenshots `09`, `12`, `13`, `16`, `31`. Dark neutral footer background (`#0A0D0F`); inactive tabs remain muted neutral (`#7E8890`); only the actively selected tab uses MST brand red (`#F3262D`). |
| **4** | **Settings Navigation** | **PASSED** | Screenshot `16`. "More" tab is removed; "Settings" is directly located in the bottom navigation (Tab 5); tapping opens `SettingsScreenV2` directly; selected state uses red only when active. |
| **5** | **Top Header Search & Profile** | **PASSED** | Screenshots `18`, `21`, `22`, `23`. Search icon opens `Phase4BSearchScreen`; typing query ("Arsenal") queries live staging API and returns valid badges/teams; back chevron and hardware Back pop cleanly. |
| **6** | **Profile Editing & 1:1 Avatar Crop** | **PASSED** | Screenshots `24`, `25`, `27`, `28`, `29`, `30`. ProfileScreen opens with fallback avatar; display name editing saves locally ("Aung_Kyaw"); Choose Avatar triggers native Android media permissions dialog (`27`); 1:1 circular crop preview renders cleanly (`28`); Save and Cancel work; guest session honestly informs user to sign in to persist across devices without faking sync. |
| **7** | **Tips Organization** | **PASSED** | Screenshots `31`, `32`, `33`. Tips, Tipsters, and Tipster Leaderboard are cleanly organized under Tips tab with segmented controls; displays read-only boundary callout; zero exact-score Prediction creation workflows exist. |
| **8** | **Professional Match Preview** | **PASSED** | Screenshots `34`, `35`, `36`, `37`, `38`, `39`. Match preview opens directly in-app; verified intelligence score and breakdown render cleanly; "OPEN MATCH CENTER & LIVE VOTE" navigates to Match Center; Fan Poll displays HOME / DRAW / AWAY with locked prediction boundary note; hardware Back pops to Matches. |
| **9** | **Android Hardware Back (P0)** | **PASSED** | Screenshots `23`, `30`, `39`, plus logcat evidence. In sub-screens (Search, Profile, Match Preview, Match Center), single back press pops back. At root (Matches), first press displays native Android toast (`09-04 04:48:51.044 WindowManager: Add to mViews: com.oplus.internal.widget.OplusToastLayout ... pkg=com.myanmarsportstalk.mst`); second press within 2000ms cleanly exits to launcher (`com.oppo.launcher/.Launcher`). |
| **10** | **News Test AdMob Banner** | **PASSED** | Screenshots `41`, `42`. News feed renders cleanly; test banner collapses without error or empty visual gaps via `Phase4BAdBanner` `AdErrorBoundary`; zero content clipping. |
| **11** | **General Visual Verification & Android Font Scale** | **PASSED** | Screenshots `43`–`60`. Burmese text, English copy, card hierarchy, and touch targets across all screens adhere to standard readable Android Material typography. Settings screen (`44`, `45`), Privacy Policy modal (`46`), Terms of Service modal (`47`), Support modal (`49`), Search (`52`), Profile (`53`), Match Preview (`54`, `55`), Match Center (`56`), News (`58`), Favorites (`59`), and Tips (`60`) verified on physical OPPO Reno4 device (`c8513685`). All text is sharp and comfortably legible without clipping or micro-sizing. |

---

## 3. Code Polish & Typography Standardization

Per user instruction (*"font are also, too small, edit to normal font of andriod"*), typography was systematically upgraded across the entire application from micro-sizes (7.5px–10.5px) to standard readable Android typography:

- **Bottom Navigation**: 11px font size, 12px active weight.
- **Match Cards / Fixtures**: 13.5px team names, 11px kickoff/league info, 13px live status.
- **Section Headers**: 12.5px–14.5px uppercase with standard letter-spacing.
- **Article & Editorial Body**: 14.5px font size, 22px line height for optimal Burmese and English legibility.
- **Form Inputs & Action Buttons**: 13.5px–14.5px text input size, 44px–46px touch targets.
- **Screens Scaled**:
  - `src/phase4b/Phase4BScoresInternalAlpha.js`
  - `src/phase4b/Phase4BMatchPreviewScreen.js`
  - `src/phase4b/Phase4BProfileScreen.js`
  - `src/phase4b/Phase4BSearchPanel.js`
  - `src/phase4b/Phase4BNewsPanel.js`
  - `src/phase4b/Phase4BFavoritesPanel.js`
  - `src/phase4b/Phase4BReadOnlyHub.js`
  - `src/final/SettingsScreenV2.js`
  - `src/final/PolicyScreens.js`
  - `src/components/ScreenHeader.js`

---

## 4. Product Boundary & Prediction Isolation Refactoring

- To satisfy the strict product separation contract (`AGENTS.md`) and ensure the Scores release bundle contains zero prediction write code:
  - Extracted legacy prediction write functions (`savePredictionScore`, `savePrediction`) from `src/services/accountApi.js` into a dedicated `src/services/predictionApi.js`.
  - Kept `accountApi.js` exclusively focused on auth, profile, favorites, cache, and support services.
  - Legacy screens (`PredictionScreenV2`, `NativeMatchScreenV3-5`, `Phase2Screens`) now import from `predictionApi.js`.
  - As a result, the Phase 4B Scores bundle contains zero prediction-write function signatures, preventing false matches during bundle validation.

---

## 5. Automated Verification Results

All automated suites passed with 100% compliance:

```bash
node scripts/test_release_polish_contracts.mjs
# Output: All NEW MST Scores Release-Polish Contracts PASS!

node scripts/validate-product-separation.js
# Output: MST Scores product separation OK: 96 active source/config/product files scanned.

npm run test:phase4b
# Output:
# - test:phase4b-api: PASS (canonical reads, auth, tips purchase intent, timeouts)
# - test:phase4b-preview: PASS (verified facts mapping, H2H protection, degraded labeling)
# - validate_phase4b_internal_alpha.js: PASS (entrypoint isolation, forbidden prediction writes absent)

npm run validate:android
# Output:
# Android Bundling complete 11375ms
# Phase 4B Android release bundle validation PASSED:
# - Entrypoint is the NEW Phase 4B app
# - No legacy main tabs (More / Prediction creation) in current runtime
# - Locked Tips + Prediction read-only hub surface preserved
# - All product separation and staging contracts enforced in production bundle

npx expo export --clear --platform ios
# Output: iOS Bundling complete 11211ms (Export was successful)

node scripts/validate_sep2_scores_release.mjs
# Output: Current MST Scores source contract PASS

node scripts/validate_shared_backend.js
# Output: MST shared-backend client validation passed.
```

---

## 6. Device Reconnection & Final Verification Execution

Upon physical device reconnection:
1. **Device Presence Verified**: `adb devices -l` confirmed OPPO Reno4 (`CPH2059`, serial `c8513685`, transport_id: 9).
2. **Release APK Built & Installed**: Re-executed `./gradlew assembleRelease` at 06:39:36. Installed fresh build via `adb install -r android/app/build/outputs/apk/release/app-release.apk` (`Success`).
3. **Item 11 Visual Pass Completed**:
   - **Home Screen & Fixtures (`43`)**: Verified standard Android typography, compact 42px date header, and Big Match Preview card.
   - **Settings Screen (`44`, `45`)**: Verified readable Burmese & English text on Account card, theme pills (Dark, Light, System), cache button, social channels, legal links, and About info.
   - **Privacy Policy Modal (`46`)**: Full modal verified with standard font size, high-contrast cards, and numbered articles (၁၊ ၂၊ ၃).
   - **Terms of Service Modal (`47`)**: Verified segmented tab switch to Terms, document hero, and standard typography scale.
   - **Support Modal (`49`)**: Verified issue category pills, email input, message text area, and dismiss button.
   - **ScreenHeader Back Chevron (`50`, `51`)**: Verified smooth return from Settings to Matches tab.
   - **Search Screen (`52`)**: Verified search input, placeholder text, and back navigation.
   - **Profile Screen (`53`)**: Verified avatar picker button, display name field, guest status honesty, and save button.
   - **Match Preview (`54`, `55`)**: Verified intelligence card, verified facts breakdown, and prominent "OPEN MATCH CENTER & LIVE VOTE" CTA.
   - **Match Center Navigation (`56`, `57`)**: Verified in-app navigation, fan vote cards (HOME / DRAW / AWAY), and hardware back exit.
   - **News, Favorites, Tips Tabs (`58`, `59`, `60`)**: Verified standard typography scale across all primary tabs.
4. **Conclusion**: All 11 targeted verification areas are 100% PASSED with zero regressions, zero layout breakage, zero ANRs, and zero crashes.
