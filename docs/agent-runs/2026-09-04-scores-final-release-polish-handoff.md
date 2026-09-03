# NEW MST Scores — Final Release-Polish Pass Handoff

**Date**: September 4, 2026  
**Repository**: `myohlainghtway123-bit/mmsportstalk`  
**Task Type**: NEW MST Scores — Final Release-Polish Pass (Pre-Production AdMob IDs)  
**Branch**: `scores/release-polish-sep4`  
**Base**: PR #31  
**Contract Obeyed**: Root `AGENTS.md` (MST product boundary, zero Betflow leakage, staging/prod isolation, GitHub-first)

---

## 1. Executive Summary & Scope

This pass implements the user's release-polish specifications across 12 targeted UI and architectural interaction areas for **NEW MST Scores** before final production AdMob credentials and app store submission.

### Boundaries Strictly Maintained:
- **No Architecture Redesign**: Preserved the Phase 4B entrypoint and release pipeline.
- **No MST Prediction App Interference**: Preserved strict separation. Scores remains strictly "Follow the Game" with read-only intelligence and fan poll Match Vote (`HOME` / `DRAW` / `AWAY`). Exact-score prediction authoring is forbidden in Scores.
- **Backend & Origin**: Staging and production isolation intact. Production Scores API origin `https://scores-api.myanmarsportstalk.com` preserved with fail-closed checks.
- **Google Test Ads Only**: News banner configured for test ads runtime (`TestIds.BANNER`); production AdMob app and unit IDs remain withheld until user approves this UI.
- **No Broad Audit / Zero Store Submission**: Physical device QA will happen in a targeted manner when the device is connected.

---

## 2. Requirement-by-Requirement Implementation Details

### 1. Home Date Selector — Compact & Stable (Item 1)
- **Container**: Fixed 38px height (`compactDateContainer`) with subtle border `#22272B`. Selecting another date never expands or shifts the container.
- **Navigation Controls**: Added previous (`<`) and next (`>`) chevron buttons with `hitSlop={10}` for rapid day-by-day stepping.
- **Stable Date Pills**: Fixed 44px × 30px dimensions with 1px borders (transparent for inactive, red for active), completely eliminating visual jumping and expanding when another date is selected.
- **Clear Active Indicator**: Active date pill is highlighted in vibrant MST red with high-contrast white text (`#FFFFFF`), leaving maximum vertical space for matches and competition groups.

### 2. Primary App Navigation — Swipe + Tap (Item 2)
- **Swipe Relationship**: Integrated native horizontal `ScrollView` with `pagingEnabled={true}`, `nestedScrollEnabled={true}`, and `scrollEventThrottle={16}` across the 3 core content screens:
  - Page 0: `Matches`
  - Page 1: `News`
  - Page 2: `Favorites`
- **Interaction**:
  - Horizontal swipe naturally glides between `Matches ↔ News ↔ Favorites`.
  - Footer tab state updates immediately on `onMomentumScrollEnd`.
  - Tapping footer icons triggers smooth programmatic scroll to that page index via `scrollTo({ x: targetIndex * screenWidth, animated: true })`.
  - Vertical scrolling inside match list, news editorial, and favorites cards is fully isolated and does not trigger accidental page changes.
  - Tips and Settings remain outside the swipe sequence as required.

### 3. Bottom Navigation Structure (Item 3)
- Replaced `More` with `Settings` directly opening the Settings screen.
- Bottom navigation tabs:
  1. `Matches` (`football-outline` / `football`)
  2. `News` (`newspaper-outline` / `newspaper`)
  3. `Favorites` (`star-outline` / `star`)
  4. `Tips` (`diamond-outline` / `diamond`)
  5. `Settings` (`settings-outline` / `settings`)
- Search is removed from bottom navigation.

### 4. Color System Hierarchy Cleanup (Item 4)
- **Bottom Navigation**: Only the currently active footer icon & label use MST red (`#F3262D`). Inactive items use neutral muted (`#7E8890`). Footer surface uses neutral dark `#0A0D0F` with `#1E2429` top border.
- **Card Hierarchy**: Removed excessive bright red borders and red backgrounds from big match cards and general containers. Big Match card uses neutral `#101417` surface with `#22272B` border.
- **Accent Red**: MST red is reserved strictly for active navigation, active pill, live match indicator (`LIVE 65'`), MST badge, and primary action buttons.

### 5. Search → Top Header (Item 5)
- Moved Search to top header across all main screens.
- Clean `search-outline` icon button (`hitSlop={10}`).
- Tapping Search opens `Phase4BSearchScreen`, embedding `Phase4BSearchPanel` with standardized `ScreenHeader` and Back button.

### 6. Top Settings Icon → Profile (Item 6)
- Replaced top Settings gear icon with user Profile button.
- Displays circular thumbnail of user's avatar when available, or clean `person-circle-outline` icon when no avatar exists.
- Tapping Profile opens `Phase4BProfileScreen`.
- Settings remains directly accessible via the bottom navigation.

### 7. Profile — View, Edit & Avatar Crop (Item 7)
- Created `src/phase4b/Phase4BProfileScreen.js`:
  - **View Profile**: Displays user avatar, display name, account email, points, and session status.
  - **Edit Profile**: Editable display name and preferred language.
  - **Change Profile Picture with 1:1 Crop**:
    - Launches `ImagePicker.launchImageLibraryAsync` with `allowsEditing: true` and `aspect: [1, 1]` for native square avatar cropping.
    - Previews the cropped image with "PREVIEW" badge.
    - Displays "Save Avatar" and "Cancel" buttons.
    - Wires upload to `uploadAvatar({ uri, base64 })` from `accountApi.js`.
    - Handles permission/error states cleanly without faking server persistence.

### 8. Tips / Tipsters / Tipster Leaderboard Hierarchy (Item 8)
- Updated `src/phase4b/Phase4BReadOnlyHub.js`:
  - Segmented internal tabs: `[💎 Tips] | [👥 Tipsters] | [🏆 Tipster Leaderboard]`.
  - Tab 3 is explicitly labeled "Tipster Leaderboard" under TIPS, completely decoupled from Prediction ownership.
  - Retained read-only User Prediction Leaderboard as secondary without confusing ownership.
  - Added internal `BackHandler`: pressing Back from Tipsters or Leaderboard returns to `Tips` subtab.

### 9. Match Preview — Full In-App Reading Screen (Item 9)
- Created `src/phase4b/Phase4BMatchPreviewScreen.js`:
  - Standardized `ScreenHeader` with match identity and Back arrow.
  - Hero banner with competition, kickoff date/time, venue, team logos, team names, and match state.
  - Verification & Evidence Quality card (score, confidence band, source counts, honest "COMPLETE" vs "VERIFIED DATA · INCOMPLETE" badge).
  - Complete verified structured sections: Key Statistics (full list of facts), Expected Starting XI, Head to Head, Recent Form, Standings / Competition Situation.
  - Editorial narrative/analysis with Burmese & English typography and comfortable line height.
  - Secondary options: "OPEN MATCH CENTER & LIVE VOTE" and "Read on Myanmar Sports Talk Website".
  - Wired to `BigMatchPreview` (Home) and Match Center preview CTA banner.
  - Android hardware Back returns to previous screen.

### 10. Android Hardware Back Navigation (P0 — Item 10)
- Global in-app Back navigation hierarchy:
  1. `previewMatch` (In-App Match Preview) → pops back to previous screen.
  2. `subScreen` (`"search"`, `"profile"`, `"settings"`) → pops back to previous main screen.
  3. `selectedMatch` (Match Center) → pops back to Matches.
  4. In Tips tab: if in Tipsters or Leaderboard sub-tab → pops back to `Tips` sub-tab.
  5. If `active !== "matches"` → returns to `matches` and scrolls pager to index 0.
- ONE Back press never kills the activity while inside secondary screens or sub-flows.

### 11. Root Home Exit Behavior (Item 11)
- At TRUE ROOT ONLY (`active === "matches"` with no overlays):
  - First press: Displays `ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT)`.
  - Second press within 2000ms: allows app exit (`return false`).
  - If second press does not occur within 2000ms: resets timestamp.

### 12. Settings Organization (Item 12)
- Bottom Settings tab opens `SettingsScreenV2` directly.
- Cleanly organized into 5 release sections:
  1. **ACCOUNT**: Profile / Account (opens `Phase4BProfileScreen`), Log out, Delete Account.
  2. **PREFERENCES**: Notifications, Theme (Dark/Light/System), Burmese/English language, Clear App Cache.
  3. **FOLLOW MYANMAR SPORTS TALK**: Facebook, YouTube, Instagram, TikTok, Threads, Website. (No X/Twitter!).
  4. **PRIVACY & LEGAL**: Privacy Policy, Terms of Use, Privacy / Ad Choices (Google UMP), Account/Data Deletion info.
  5. **ABOUT**: Myanmar Sports Talk / MST Scores, dynamic version & build, Support report modal, website.

### 13. AdMob — Test Banner Only for Now (Item 13)
- News banner runtime safely uses Google test banner (`TestIds.BANNER`) in non-production / staging mode when production IDs are unset.
- Safe boundary (`onAdFailedToLoad`) collapses cleanly without empty containers or covering content/footer.
- Zero aggressive ad formats (no rewarded unlocks, no interstitials, no app-open ads).

---

## 3. Automated Validation Suite Results

| Test / Script | Result | Verification Notes |
| :--- | :---: | :--- |
| `node scripts/validate-product-separation.js` | **PASS** | 95 active source/config/product files scanned. 0 Betflow references. |
| `npm run test:phase4b` | **PASS** | Canonical reads, shared auth/session, server-owned tip purchase, timeout handling, and read-only preview contracts verified. |
| `node scripts/validate_sep2_scores_release.mjs` | **PASS** | Phase 4B release gates, safe News banner wiring, banned copy checks passed. |
| `node scripts/validate_shared_backend.js` | **PASS** | Shared backend client contracts intact. |
| `node scripts/test_release_polish_contracts.mjs` | **PASS** | Compact date selector (38px, prev/next buttons, 44x30 fixed pills), swipe navigation, footer Settings, active red colors, Search/Profile header, in-app Match Preview, editable Profile with 1:1 crop, and double-press root exit verified. |
| `npx expo export --platform android` | **PASS** | 954 modules bundled into Hermes bytecode (`2.88 MB`). |
| `npx expo export --platform ios` | **PASS** | 954 modules bundled into Hermes bytecode (`2.87 MB`). |

---

## 4. Pending Verification Items

1. **Physical Device Verification (Targeted)**:
   - When the user connects the physical Android phone, targeted validation will be performed on:
     - Compact date selector (stable across dates)
     - Swipe navigation (Matches ↔ News ↔ Favorites)
     - Bottom navigation active colors (only active uses red)
     - Header Search & Profile
     - Profile edit and avatar 1:1 crop
     - Tips hierarchy (Tips, Tipsters, Tipster Leaderboard)
     - In-app full Match Preview reading
     - Android Back single-press pop and double-press root exit
     - News AdMob test banner
2. **Production AdMob IDs**:
   - Staging test banner is verified. Real production AdMob app and unit IDs will be configured in release environment after user UI approval.
3. **Production Scores API Origin**:
   - Production origin activation pending owner approval.
