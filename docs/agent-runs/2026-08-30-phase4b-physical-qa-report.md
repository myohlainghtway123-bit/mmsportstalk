# Phase 4B Physical QA Report — MST Scores Internal APK

Date: 2026-08-30
Device: Samsung Galaxy S21 Ultra 5G (`SM-G998B`)
Android Version: 15 (API Level 35)
Repository: `myohlainghtway123-bit/mmsportstalk`
Branch: `codex/phase4b-owner-usable-skeleton-2026-08-30`
Related PR: `myohlainghtway123-bit/mmsportstalk#27`
Related Issue: `myohlainghtway123-bit/mst-platform#29`

---

## 1. Test Device & Artifact Verification

| Property | Value |
| :--- | :--- |
| **Connected ADB Device** | `R5CR31W1Q4T` |
| **Manufacturer / Model** | Samsung / `SM-G998B` |
| **OS / Build Version** | Android 15 (SDK 35) |
| **Display Resolution** | 720 x 1600 (Density 300) / Physical 1440 x 3200 (Density 450) |
| **Package Name** | `com.myanmarsportstalk.mst` |
| **Installed Version** | `versionCode=1`, `versionName=1.5.2` |
| **Installed APK Path** | `/Users/palmer/Desktop/MST-Scores-Phase4B-Internal.apk` |
| **APK SHA-256** | `0340f44e8dacb42a8493214b9a3fe16a763c9c31e0883fc97f17be003f67e98c` |
| **Staging API Origin** | `https://mst-scores-api-staging.betflowapp.workers.dev` |
| **Internal Build Flag** | `EXPO_PUBLIC_MST_INTERNAL=true` |

---

## 2. Test Execution & Evidence

### A. Matches Screen
- **Initial Landing**: App launched cleanly directly into the Matches view.
- **Internal Marker**: Visible yellow banner at the top displaying `STAGING / INTERNAL` and `REAL SCORES API · NO PRODUCTION`.
- **Date Navigation**: 10-day date navigation bar verified (Wed 26 Aug through Tue 1 Sep). Selecting individual dates updates match counts and lists dynamically.
- **League Grouping**: Real matches are grouped with competition headers (e.g. `MST Phase 4 Staging Proof`, `Nasjonal U19 Champions League`).
- **Big Match Preview**: Renders prominently after the first league card, displaying home/away marks, kickoff time, and a direct `MATCH CENTER` action button.
- **Prediction Isolation**: No prediction creation, submission, or betting widgets appear on Home.
- **Evidence**:
  - `docs/agent-runs/evidence/2026-08-30-phase4b/01_launch_matches.png`
  - `docs/agent-runs/evidence/2026-08-30-phase4b/05_today_matches.png`
  - `docs/agent-runs/evidence/2026-08-30-phase4b/14_aug27_matches.png`

### B. Match Center
- **Canonical Match Navigation**:
  - **Match 1 (Today)**: `p4_33259855829_0a75cd3e_future` (`MST Phase 4 Proof Home` vs `MST Phase 4 Proof Away`, Sun Aug 30 4:20 AM, `SCHEDULED`, Freshness: `UNKNOWN`).
  - **Match 2 (Thu Aug 27)**: `mst:match:af:1627535` (`Åsane U19` vs `Fredrikstad FK U19`, Thu Aug 27 9:00 PM, `NOT STARTED`, Freshness: `STALE`).
- **Identity Preservation**: Match IDs and team names matched between the fixture lists and Match Center headers.
- **Honest Missing Data States**: Since staging backend responses do not supply deep data endpoints, all respective sections render explicit `UNAVAILABLE` badges with clear explanatory text:
  - Stats: `The current staging Match detail response does not provide Stats.` [UNAVAILABLE]
  - Lineups: `The current staging Match detail response does not provide Lineups.` [UNAVAILABLE]
  - Events: `The current staging Match detail response does not provide Events.` [UNAVAILABLE]
  - xG: `The current staging Match detail response does not provide xG.` [UNAVAILABLE]
  - H2H: `The current staging Match detail response does not provide H2H.` [UNAVAILABLE]
  - Form: `The current staging Match detail response does not provide Form.` [UNAVAILABLE]
  - Standings: `The current staging Match detail response does not provide Standings.` [UNAVAILABLE]
  - No synthetic or fabricated football statistics are displayed.
- **Match Info**: Correctly displays kickoff, venue (`Unavailable`), status, and freshness context.
- **Evidence**:
  - `docs/agent-runs/evidence/2026-08-30-phase4b/06_match_center_top.png`
  - `docs/agent-runs/evidence/2026-08-30-phase4b/07_match_center_bottom.png`
  - `docs/agent-runs/evidence/2026-08-30-phase4b/15_match_center_asane.png`
  - `docs/agent-runs/evidence/2026-08-30-phase4b/16_match_center_asane_bottom.png`

### C. Navigation
All 5 bottom navigation tabs were tested and verified:
1. **Matches** (Tab 1): Live scores and date list.
2. **News** (Tab 2): Displays `News structure confirmed`, `Latest football news [UNAVAILABLE]`, and `Saved stories [PHASE 13]`.
3. **Favorites** (Tab 3): Displays `Favorite teams and competitions [NOT CONNECTED]` and non-personalized staging matches (`Hässleholms IF 4 - 2 Tvååker`, `Assyriska FF 3 - 1 Vasalund`).
4. **Tips + Prediction** (Tab 4): Dedicated read-only prediction structure.
5. **More** (Tab 5): Displays profile shell (`Internal tester`), Language (`Phase 13`), Appearance (`Phase 13`), Notifications (`Not connected`), Payments & cards (`Not connected`), Terms & Policies (`Final content pending`), About MST (`Product shell`), and Support (`Integration pending`).
- **Return Safety**: Navigating back via the top back button `<` or switching bottom tabs smoothly returns to previous screens without crashing or state corruption.
- **Evidence**:
  - `docs/agent-runs/evidence/2026-08-30-phase4b/08_back_to_matches.png`
  - `docs/agent-runs/evidence/2026-08-30-phase4b/09_news_screen.png`
  - `docs/agent-runs/evidence/2026-08-30-phase4b/10_favorites_screen.png`
  - `docs/agent-runs/evidence/2026-08-30-phase4b/11_tips_prediction_screen_top.png`
  - `docs/agent-runs/evidence/2026-08-30-phase4b/13_more_screen_top.png`

### D. Tips + Prediction Area
- **Read-Only Enforcement**: Header states `READ ONLY IN MST SCORES`. Sub-banner prominently enforces `No prediction writes: MST Scores can consume authorized predictions and tips, but cannot create, edit, or submit them.`
- **Action Blocking**: No Make Prediction / Submit Prediction buttons exist.
- **Entitlement / Ads / Links**:
  - `Watch Video unavailable` (disabled)
  - `Buy Tipster Tip` (badge `DISABLED`)
  - `Tipster Leaderboard` & `Prediction Leaderboard` indicate no authorized leaderboard route.
  - `Open MST Prediction App` & `Become a Tipster` render badge `LINK UNAVAILABLE`.
- **Shared Scoring**: Verified canonical scoring guide at bottom: `Exact score 3`, `Correct result 1`, `Wrong 0`.
- **Evidence**:
  - `docs/agent-runs/evidence/2026-08-30-phase4b/11_tips_prediction_screen_top.png`
  - `docs/agent-runs/evidence/2026-08-30-phase4b/12_tips_prediction_screen_bottom.png`

### E. Resilience & Error Handling
- **Empty State**: Date navigation to Wed Aug 26 (0 matches scheduled) rendered the designated empty card: `No matches available: No real staging match is scheduled for this date. Choose another date or retry.` with an active `[RETRY]` button.
- **Retry Action**: Tapping `[RETRY]` initiated a fresh query and settled without hanging, freezing, or crashing.
- **Loading Bounds**: All asynchronous fetches terminated immediately without indefinite loading spinners.
- **Evidence**:
  - `docs/agent-runs/evidence/2026-08-30-phase4b/03_date_aug26.png`
  - `docs/agent-runs/evidence/2026-08-30-phase4b/04_after_retry.png`

### F. Security & Environment
- **Origin Isolation**: Network calls and diagnostic footers only reference `https://mst-scores-api-staging.betflowapp.workers.dev`.
- **Production Boundary**: No production endpoints, credentials, or tokens appear in app state, logs, or UI.
- **Diagnostics Correlation**: Real request IDs recorded on screen and in logcat:
  - Matches feed: `8a6ffcbc-7282-4aff-b965-05b72a44dd26`, `87203ebc-db1a-4666-8810-43f76c1cdda0`
  - Live feed: `d4eac6f0-536b-4fc3-8b1f-2bc4c54bd679`, `0498feff-3e03-43cb-b6d2-716e661ab219`
  - Results feed: `9881328c-8213-442b-a5aa-75954f7377ee`, `3253f8b3-a430-473b-a5f0-13036af0f5b6`
  - Match details (`p4_...`): `d1eb79f8-07a0-47a7-976d-7e3d6b9e58f1`, tips: `589845ef-4646-4b79-882c-93dc65e25f9d`
  - Match details (`mst:match:af:1627535`): `d58a2ba6-894e-43f6-ad7b-04e205eec5d2`, tips: `80bcf9ba-8a2b-4b71-be39-8d33ab205db3`

### G. Physical Device Usability
- Tested on physical Samsung Galaxy S21 Ultra 5G.
- Touch responsiveness, scrolling velocity, tap target dimensions, typography contrast, and dark theme consistency adhere to the Phase 4B walking skeleton criteria.
- Zero crashes, zero ANRs, zero memory leak warnings in logcat during the entire test session.

---

## 3. Acceptance Criteria Evaluation (Issue #29)

| Criterion | Result | Evidence / Notes |
| :--- | :---: | :--- |
| 1. Connected Android physical test device | **PASS** | Samsung SM-G998B on Android 15 (SDK 35) |
| 2. Package `com.myanmarsportstalk.mst` installed | **PASS** | Version 1.5.2 (`versionCode=1`) |
| 3. Unmistakable STAGING / INTERNAL marker | **PASS** | Top yellow banner rendered |
| 4. Matches live score home experience | **PASS** | Grouped by league, date navigation active |
| 5. Big Match Preview rendered | **PASS** | Displayed following first league block |
| 6. Canonical Match Center preserved | **PASS** | `p4_...` and `mst:match:af:1627535` match IDs verified |
| 7. Honest missing data states (no mock football data) | **PASS** | Explicit UNAVAILABLE badges across all empty sections |
| 8. Read-only Tips + Prediction area | **PASS** | Zero write/submit actions; disabled unavailable states |
| 9. Five-tab bottom navigation | **PASS** | Matches, News, Favorites, Tips+Prediction, More tested |
| 10. Resilience (empty/retry/terminating loads) | **PASS** | Empty date state and retry button validated |
| 11. Security boundary (no prod secrets/endpoints) | **PASS** | Verified staging origin only; request IDs captured |
| 12. Physical device stability & usability | **PASS** | No ANRs, crashes, or rendering blockers |

**Overall Verdict: PASS**

---

## 4. Next Steps

1. Commit and push the physical QA evidence files and updated handoff to `codex/phase4b-owner-usable-skeleton-2026-08-30`.
2. Post the physical QA evidence summary on `myohlainghtway123-bit/mst-platform#29` and `myohlainghtway123-bit/mmsportstalk#27`.
3. With all Phase 4B technical, bundle guard, and physical device criteria verified:
   - PR #27 is ready for owner review and merge into `main`.
   - Issue #29 can be closed upon owner confirmation of merge.
