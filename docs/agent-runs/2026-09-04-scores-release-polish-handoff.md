# MST Scores Release Polish & Information Architecture Handoff

**Date**: September 4, 2026  
**Repository**: `myohlainghtway123-bit/mmsportstalk`  
**Task Type**: NEW MST Scores — Release Polish Only  
**Branch**: `scores/release-polish-sep4`  
**Base**: `chatgpt/sep2-expo-auth-smoke-2026-09-02` (PR #31)  
**Contract Obeyed**: Root `AGENTS.md` (Product boundary, zero Betflow leakage, staging/prod isolation, GitHub-first)

---

## 1. Executive Summary & Scope Boundaries

This task executed release-quality visual and organizational polish for **NEW MST Scores** before final production AdMob configuration and app store builds.

### Strict Scope Enforcements Maintained:
- **No Architecture Redesign**: Preserved the Phase 4B release architecture and entrypoints.
- **No Exact-Score Prediction Creation**: MST Scores remains strictly read-only for Prediction intelligence. All exact-score prediction authoring is exclusive to the separate MST Prediction app.
- **Match Vote**: Strictly fan engagement poll with options limited to `HOME` / `DRAW` / `AWAY`.
- **Backend Architecture**: Unchanged. Production origin `https://scores-api.myanmarsportstalk.com` preserved with fail-closed production safety.
- **No X/Twitter**: As explicitly mandated, X/Twitter is completely excluded.
- **AdMob Safety**: Safe news-only banner runtime wiring preserved; test mode maintained until owner populates real production IDs in release environment.
- **Physical Device QA Fixes**: Preserved all prior fixes, including Android hardware `BackHandler` navigation.

---

## 2. Implementation Details

### A. Home / Match List Space & Date Bar Polish
- **Compact Top Header**: Reduced header vertical height from 77px to 52px. Replaced unnecessary header icons with a clean, branded "MST Scores" title, subtitle "FOLLOW THE GAME", and a dedicated quick-access Settings gear icon.
- **Narrow Date Selector**: Replaced oversized 62px × 65px date boxes with a sleek, compact 48px × 46px date strip. Reduced strip padding from 12px to 6px, saving ~30px of vertical height. Preserved high touch-friendliness (`hitSlop={8}`) and clear TODAY / selected date indicators with glowing red border.
- **Improved Information Hierarchy**: Significantly more match content and competition groups are now visible above the fold on standard mobile screens without sacrificing scannability. Big Match Preview card and live indicator dots (`LIVE 65'`, `LIVE 89'`) preserved.

### B. Standardized Screen Header Component (`src/components/ScreenHeader.js`)
- Standardized header across secondary screens (`MatchCenter`, `SettingsScreenV2`, `News`, `Favorites`, `Tips`, `More`).
- Uniform 52–54px height, standard back button hit target (`hitSlop={12}`), predictable typography hierarchy, and subtle bottom border (`#22272B`).
- Preserved Android hardware `BackHandler` navigation: hardware Back key pops from `Settings` to `More`, from `MatchCenter` to `Matches`, and from secondary tabs back to `Matches`.

### C. Tips / Tipsters / Leaderboard Information Architecture (`src/phase4b/Phase4BReadOnlyHub.js`)
- **Renamed Tab**: Bottom navigation tab 4 updated to `Tips` with a diamond icon.
- **Segmented Internal Navigation**: Added a 3-way segmented control:
  1. `[💎 Tips]`: Purchased / entitled tips and available tips with server-owned commerce flow.
  2. `[👥 Tipsters]`: Verified Tipsters directory with honest empty states when unpopulated.
  3. `[🏆 Leaderboard]`: Tipster Leaderboard and User Prediction Leaderboard (strictly marked `READ ONLY`).
- **Product Boundary Banner**: Retained explicit security/boundary notice confirming that exact-score prediction creation/editing happens only in the separate MST Prediction app.

### D. Release-Quality Settings Screen (`src/final/SettingsScreenV2.js`)
Organized Settings into 5 standard release sections:
1. **ACCOUNT**:
   - Current sign-in state, user profile display.
   - Secure Logout action.
   - Permanent **Delete Account** confirmation flow with honest notice regarding permanent deletion of favorites, tips, and alerts, wired to `deleteAccount()`.
2. **PREFERENCES**:
   - Notifications toggle.
   - Theme selector (Dark, Light, System) wired to `ThemeContext`.
   - Burmese / English language selector.
   - Clear App Cache with storage feedback.
3. **FOLLOW MYANMAR SPORTS TALK**:
   - Real recognizable native brand icons:
     - Facebook (`logo-facebook`, official blue)
     - YouTube (`logo-youtube`, red)
     - Instagram (`logo-instagram`, pink)
     - TikTok (`logo-tiktok`, white)
     - Threads (`logo-threads`, white)
     - Website (`globe-outline`, silver)
   - External link indicators (`open-outline`).
   - Centralized configuration in `src/config/mstSocialAndLegalConfig.js` with honest fallback alerts for missing channels.
4. **PRIVACY & LEGAL**:
   - Privacy Policy (interactive modal view + official website link).
   - Terms of Use (interactive modal view + official website link).
   - **Privacy / Ad Choices**: Wired to Google Mobile Ads UMP service with fail-safe dialogs.
   - Account / Data Deletion information for Google Play & App Store compliance.
5. **ABOUT**:
   - App name: Myanmar Sports Talk / MST Scores.
   - Dynamic version (`1.5.2`) and build number (`12`) via `expo-constants`.
   - Contact / Support ticket submission modal (`submitSupportReport`) supporting 8 categories.
   - Official website link (`myanmarsportstalk.com`).

### E. AdMob & Consent Architecture
- **Banner Safeguard**: `Phase4BAdBanner.js` includes `onAdFailedToLoad` error boundary to guarantee that failed ad loads never break News layout or shift UI controls unexpectedly.
- **Google Mobile Ads UMP Consent Service (`src/services/adConsentService.js`)**:
  - Implemented `showPrivacyOptionsForm()` and `gatherConsentIfRequired()` using `react-native-google-mobile-ads`.
  - Uses non-enforcing TurboModule/NativeModule registry inspection (`TurboModuleRegistry.get` / `NativeModules`) so non-store/test builds lacking production AdMob credentials never trigger fatal `RNGoogleMobileAdsModule` invariant crashes.
  - Presents honest user feedback without fabricating consent states.

---

## 3. Physical Device Verification (OPPO Reno4 / Android 11)

Targeted physical-device testing was executed on hardware:
- **Device**: OPPO Reno4 (`CPH2059`)
- **Serial**: `c8513685`
- **OS**: Android 11 (API 30)
- **Display**: 1080 × 2400 AMOLED
- **Build**: Local release APK (`./gradlew assembleRelease` in `android/` with production origin embedded; zero EAS cloud credits consumed).

### Photo Evidence Catalog:
All screenshots are committed under `docs/agent-runs/evidence/2026-09-04-physical-qa/`:
1. `01_home_compact_header_and_narrow_date.png`: Compact 52px Home header, narrowed 48px date selector, TODAY highlight, and 3 competition groups visible above fold.
2. `02_match_center_screen_header.png`: Standardized ScreenHeader with back arrow, match subtitle, and share button.
3. `03_tips_subtab_tips.png`: Tips tab with segmented navigation `[💎 Tips]` selected, boundary card, and entitlements.
4. `04_tips_subtab_tipsters.png`: `[👥 Tipsters]` sub-tab with verified tipsters empty state.
5. `05_tips_subtab_leaderboard.png`: `[🏆 Leaderboard]` sub-tab with Tipster & User Prediction Leaderboards.
6. `06_more_tab_with_settings_entry.png`: More tab with prominent Settings banner, Search, and Notifications.
7. `07_settings_screen_top_and_socials.png`: Settings screen with Account, Preferences, and Follow MST (Facebook, YouTube, Instagram, TikTok, Threads, Website).
8. `08_settings_screen_privacy_and_about.png`: Scrolled Settings showing Privacy Policy, Terms, Ad Choices, Account Deletion, and About MST Scores v1.5.2.
9. `09_settings_ad_choices_dialog.png`: Privacy / Ad Choices native dialog cleanly handling UMP consent status without crashing.
10. `10_news_tab_clean_layout.png`: News tab layout displaying latest football news with safe banner integration.

---

## 4. Automated Validation Suite Results

| Test / Script | Result | Notes |
| :--- | :---: | :--- |
| `node scripts/validate-product-separation.js` | **PASS** | 91 active source/config/product files scanned. 0 Betflow references. |
| `node scripts/test_phase4b_scores_api.mjs` | **PASS** | Canonical reads, shared auth/session, server-owned tip purchase, timeout handling verified. |
| `node scripts/test_phase4b_match_preview.mjs` | **PASS** | Structured facts mapped; unknown H2H unavailable; DEGRADED never mislabeled COMPLETE. |
| `node scripts/validate_sep2_scores_release.mjs` | **PASS** | Phase 4B release gates, safe News banner wiring, banned copy checks passed. |
| `node scripts/validate_shared_backend.js` | **PASS** | Shared backend client contracts intact. |
| `node scripts/validate_phase4b_internal_alpha.js` | **PASS** | Isolation contract passed; exact-score prediction writes forbidden. |
| `npx expo export --platform android` | **PASS** | 947 modules bundled cleanly into Hermes bytecode (`2.83 MB`). |
| `npx expo export --platform ios` | **PASS** | 947 modules bundled cleanly into Hermes bytecode (`2.82 MB`). |

---

## 5. Remaining External Inputs for Release

Before final production store submission, the owner needs to provide:
1. **Official Social URLs**:
   - Facebook, YouTube, TikTok, and Website are populated with real MST links.
   - Instagram and Threads placeholders (`EXPO_PUBLIC_MST_INSTAGRAM_URL`, `EXPO_PUBLIC_MST_THREADS_URL`) in `src/config/mstSocialAndLegalConfig.js` should be set to official MST URLs once available.
2. **AdMob Production Secrets**:
   - Populate `ANDROID_ADMOB_APP_ID`, `IOS_ADMOB_APP_ID`, `ANDROID_BANNER_UNIT_ID`, and `IOS_BANNER_UNIT_ID` in the GitHub Secrets / release environment before triggering EAS production builds.
