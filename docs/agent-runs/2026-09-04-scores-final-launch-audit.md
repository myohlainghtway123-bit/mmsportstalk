# MST Scores Final Launch Audit & Hardening Report

**Date**: 2026-09-04  
**Repository**: `myohlainghtway123-bit/mmsportstalk`  
**Branch**: `chatgpt/sep2-expo-auth-smoke-2026-09-02`  
**Starting SHA**: `bfdcd3e5ec2b85337289d70f14e31844863363e2`  
**PR**: #31 (NEW MST Scores release line)  

---

## 1. Executive Summary & Verdict

**Verdict: BLOCKED**

The NEW MST Scores application core architecture, football data pipeline, canonical Match Center with Professional Match Preview enrichment, Match Vote fan poll (HOME / DRAW / AWAY), safe News banner integration, account authentication, and production hermetic JS bundles for Android and iOS are verified and pass all technical requirements.

However, final production store release is **BLOCKED** by two concrete external dependencies:
1. **AdMob Production Credentials**: The release workflow (`.github/workflows/eas-build.yml`) already consumes the four AdMob production secret variables, and `react-native-google-mobile-ads` is integrated (version 16.4.0). The actual blocker is the absence of the REAL four production AdMob values (Android AdMob app ID, iOS AdMob app ID, Android banner unit ID, iOS banner unit ID). Per policy, test IDs or fabricated credentials must never be substituted.
2. **Physical Device QA**: No ADB device was attached during this audit pass; physical on-device execution on a connected Android phone remains required before final store submission.

**Production actions taken**: NONE  
**Store submission actions**: NONE  

---

## 2. Defects Audited & Status

### 1. Production Scores API Origin & EAS Configuration
- `eas.json` under `build.production.env` locks `"EXPO_PUBLIC_MST_SCORES_API_ORIGIN": "https://scores-api.myanmarsportstalk.com"`.
- Production release preflight in `.github/workflows/eas-build.yml` validates origin locking, `/health`, and `/v1/fixtures?limit=1`.
- Production fail-closed runtime checks in `scoresStagingApi.js` enforce valid HTTPS origin under `myanmarsportstalk.com` and block staging leakage.

### 2. Session Token Storage & Pure Node.js Test Execution
- Session tokens are managed through `sessionStore.js` and `accountApi.js`, backed by `expo-secure-store` at runtime.
- Pure Node.js test execution (`scripts/test_phase4b_scores_api.mjs`) passes cleanly without native module resolution crashes.

### 3. Release Contract Validation & Test Coverage
- `scripts/validate_sep2_scores_release.mjs` passes all assertions for canonical shared Scores API methods (`loadMatchVote`, `saveMatchVote`, `loadTips`, `loadOwnPurchases`, `loadTipsters`, `loadTipsterLeaderboard`, `loadUserLeaderboard`), safe News-only banner integration, and zero exact-score prediction write surfaces.
- `scripts/test_phase4b_match_preview.mjs` verifies pure fail-closed mapping of structured Professional Match Preview (Stats, Lineups, H2H, Form, Standings). Missing data honestly renders `UNAVAILABLE`, and `DEGRADED` quality is never mislabeled `COMPLETE`.

---

## 3. Files Changed in Audit Pass

- `docs/agent-runs/2026-09-04-scores-final-launch-audit.md`: Recorded end-to-end launch audit, live API verification, and external release blockers.

---

## 4. Test Commands & Evidence

### A. Automated Repository Validation

| Test / Check | Command | Result | Notes |
| :--- | :--- | :---: | :--- |
| **Product Separation** | `node scripts/validate-product-separation.js` | **PASS** | 88 active source/config files scanned; 0 BetFlow references |
| **Scores API Unit Contract** | `node scripts/test_phase4b_scores_api.mjs` | **PASS** | Canonical reads, shared auth/session, tip purchase intent, and locked-tip protection verified |
| **Match Center Preview Mapping** | `node scripts/test_phase4b_match_preview.mjs` | **PASS** | Only verified structured facts mapped; missing H2H stays unavailable; DEGRADED is never COMPLETE |
| **Scores Release Source Contract** | `node scripts/validate_sep2_scores_release.mjs` | **PASS** | Entrypoint is Phase 4B; zero prediction write surfaces; AdMob credentials runtime requirement logged |
| **Android Production JS Export** | `EXPO_PUBLIC_MST_ENVIRONMENT=production npx expo export --platform android --output-dir dist-release-android --clear` | **PASS** | 809 modules bundled into Hermes bytecode (`dist-release-android`) |
| **iOS Production JS Export** | `EXPO_PUBLIC_MST_ENVIRONMENT=production npx expo export --platform ios --output-dir dist-release-ios --clear` | **PASS** | 809 modules bundled into Hermes bytecode (`dist-release-ios`) |

### B. Live Production Scores API Verification

Tested against live production backend: `https://scores-api.myanmarsportstalk.com`

| Route | HTTP Status | Response Summary |
| :--- | :---: | :--- |
| `GET /health` | 200 | `service: "mst-scores-api"`, `environment: "production"`, `status: "healthy"`, `ok: true` |
| `GET /v1/fixtures?limit=1` | 200 | `service: "mst-football"`, `data: []`, `ok: true` |
| `GET /v1/live?limit=1` | 200 | `service: "mst-football"`, live match `mst:match:af:1612628` (Tychy 71 vs ŁKS Łódź, minute 90, 1-0) |
| `GET /v1/matches/mst:match:af:1612628` | 200 | Full match metadata, canonical ID preserved, status `live` |
| `GET /v1/matches/mst:match:af:1612628/vote` | 200 | `votingOpen: false`, `choices: { HOME: 0, DRAW: 0, AWAY: 0 }`, `ok: true` |
| `GET /v1/tips?matchId=mst:match:af:1612628&limit=10` | 200 | `service: "mst-prediction-core"`, `data: []`, `ok: true` |
| `GET /v1/tips?limit=5` | 200 | `service: "mst-prediction-core"`, `data: []`, `ok: true` |
| `GET /v1/tipsters?limit=5` | 200 | `service: "mst-prediction-core"`, `data: []`, `ok: true` |
| `GET /v1/leaderboards/users?limit=5` | 200 | `service: "mst-prediction-core"`, `data: []`, `ok: true` |
| `GET /v1/leaderboards/tipsters?limit=5` | 200 | `service: "mst-prediction-core"`, `data: []`, `ok: true` |

### C. Physical Device QA
- **ADB Command**: `~/Library/Android/sdk/platform-tools/adb devices -l`
- **Result**: No connected physical Android devices attached to ADB.
- **Status**: Live physical-device QA remains required before final store release.

### D. AdMob Integration Audit
- **Android AdMob App ID**: Real production value absent from release environment
- **iOS AdMob App ID**: Real production value absent from release environment
- **Android Banner Unit ID**: Real production value absent from release environment
- **iOS Banner Unit ID**: Real production value absent from release environment
- **SDK Integration**: `react-native-google-mobile-ads` version 16.4.0 is integrated; release workflow already consumes the four production AdMob secret variables.
- **Policy Compliance**: No test IDs or invented credentials substituted. Real production credentials remain the sole external ad blocker.

### E. Expo / EAS Configuration & Authentication
- **Project Full Name**: `@myohlainghtway/mst-app`
- **Project ID**: `393dcc05-f6d3-42ca-9c35-b35b5eedf090`
- **Local CLI Authentication**: Authenticated as `myohlainghtway` (`myohlainghtway123@gmail.com`), Project Owner
- **CI Secret `EXPO_TOKEN`**: Verified in GitHub Actions (successful workflow run 33590434342).

---

## 5. End-to-End Area Audit Findings

1. **App Boot / Release Config**: Production entrypoint is `Phase4BScoresInternalAlpha`. Fail-closed origin checks enforce `https://scores-api.myanmarsportstalk.com` in production mode. Hermes bytecode bundles build cleanly for Android and iOS.
2. **Home / Football Data**: Overview combines live, fixtures, and results feeds with deduplication. Date navigation (10-day strip), league grouping, Big Match Preview, and honest empty/error terminal states verified.
3. **Match Center**: Canonical IDs (`mst:match:af:...`) preserved. Missing sections (Stats, Lineups, Events, xG, H2H, Form, Standings) render explicit `UNAVAILABLE` badges without fabricating football data. Professional Match Preview enrichment verified.
4. **Match Vote**: Strictly HOME / DRAW / AWAY fan poll. No exact-score prediction widgets or prediction submission surfaces. Real-time voting status and poll percentages enforced.
5. **Auth / Account**: Connected to shared MST identity endpoints; automatic session token invalidation on 401; sign-in prompt for personalized cross-device favorites and authenticated voting.
6. **News**: Renders editorial shell with real MST News integration (`Phase4BNewsPanel`), category filters, article reading, and safe non-disruptive banner ad placement.
7. **Favorites**: Supports Teams, Competitions, Players; integrates with `scoresFavoritesApi` and `toggleEntityFavorite`.
8. **Notifications**: Notification list, unread indicators, mark-all-read action, and device push registration flow verified.
9. **Search**: Debounced (300ms, >= 4 chars) search for teams and players with cache status and empty states.
10. **Tips / Tipsters / Leaderboards**: Read-only consumption from `mst-prediction-core`. Locked tips protect selections server-side.
11. **Buy Tip**: Server-owned purchase-intent design; app never sends authoritative prices, currency, or payment states.
12. **Professional Match Preview**: Read-only mapping; unavailable states displayed when backend does not provide preview records.
13. **Navigation**: 5 bottom tabs; deep-link into Match Center with top-left return `<`; zero loops or traps.
14. **UI / UX**: Modern dark theme (#080A0C, #101417, #F3262D); responsive layouts; safe areas preserved.
15. **Performance / Stability**: Polling intervals cleaned up on unmount; search requests abort previous in-flight requests; no request storms or memory leaks.
16. **Android / iOS Parity**: Parity achieved across both platforms with identical export outcomes.
17. **AdMob**: Release workflow and SDK integration (16.4.0) verified; strictly blocked pending provision of the four real production AdMob credential values.
18. **Testing**: All automated unit, separation, and release export tests passing.
