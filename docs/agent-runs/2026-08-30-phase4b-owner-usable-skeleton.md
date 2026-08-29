# Phase 4B owner-usable MST Scores handoff

Date: 2026-08-30

Repository: `myohlainghtway123-bit/mmsportstalk`

Issue: `myohlainghtway123-bit/mst-platform#29`

PR: `myohlainghtway123-bit/mmsportstalk#27`

Branch: `codex/phase4b-owner-usable-skeleton-2026-08-30`

Base: `main` at `9aa98a4b8290e4a99dcc1c6c30b6a60015a403c7`

## Durable product decision

The owner-confirmed final MST Scores product direction is locked in:

`docs/product/mst-scores-product-contract.md`

It records the live-score-first launch model, first-launch onboarding sequence, fixed bottom navigation, read-only MST Scores prediction boundary, shared scoring, Tipster application path, visual direction, and the Phase 4B/Phase 13 boundary.

The supplied dark/charcoal + MST-red six-screen visual is a final product structure target. This run implements an owner-usable Phase 4B walking skeleton, not Phase 13 premium polish.

## Implemented in Phase 4B

- `Matches` remains the default internal-alpha screen.
- Ten-day date navigation is available.
- Fixtures, live matches, and results are read from the authorized staging Scores Product API and de-duplicated by canonical MST match ID.
- Matches are grouped league-by-league with competition headers.
- Team/competition logos render when staging provides a URL; honest initial marks render otherwise.
- Match rows expose kickoff, `LIVE`, `HT`, `FT`, and score states.
- Big Match Preview appears after the first league and opens the same real match.
- A real match tap carries the same canonical ID into `/v1/matches/:id` and fails closed on identity mismatch.
- Match Center presents the confirmed hierarchy: Stats, Lineups, Events, xG, H2H, Form, Standings, Match Info.
- Missing deep match data renders explicit unavailable states instead of invented football data.
- Match Info renders the available real kickoff, status, venue, and freshness context.
- Real `/v1/tips?matchId=...` data remains read-only; locked/paid selections remain hidden.
- Bottom navigation works in the locked order: `Matches | News | Favorites | Tips + Prediction | More`.
- News, Favorites, and More provide owner-usable shells with honest integration states.
- Tips + Prediction includes the confirmed rewarded-video, Tipster purchase, leaderboards, MST Prediction app, and Tipster-path structure, but unsupported actions remain visibly disabled.
- Loading, date-empty, full dependency-error, partial-feed warning, timeout, pull-to-refresh, retry, and safe request-ID states terminate.
- `AppFinalShell` remains the normal/default app; this internal shell still requires `EXPO_PUBLIC_MST_INTERNAL=true`.

## Intentionally deferred

The following remain later-phase or backend integration work:

- final MST Score logo motion and first-launch onboarding;
- final pixel-perfect visual polish and animations;
- production AdMob/rewarded-video unlock;
- purchases, payments, cards, and entitlement handling;
- real Tipster and Prediction leaderboard integrations;
- configured MST Prediction deep links;
- editorial/news feed;
- account-backed favorites and followed-league ordering;
- profile/account/settings persistence;
- accessibility, localization completion, performance optimization, and store readiness.

No fake success state or fabricated acceptance data was added for any deferred capability.

## Real staging evidence

Authorized origin only:

`https://mst-scores-api-staging.betflowapp.workers.dev`

Read-only observations on 2026-08-30:

- `GET /v1/fixtures?limit=8` — 200, two staging match records, request ID `12f6c073-dd5b-49b9-8df8-8325d1d9fcf3`;
- `GET /v1/matches/mst%3Amatch%3Aaf%3A1627535` — 200, canonical ID preserved, request ID `6a613982-99b7-4a68-b370-92872bbd27fe`;
- `GET /v1/tips?matchId=mst%3Amatch%3Aaf%3A1627535&limit=10` — 200, honest empty permitted tips response, request ID `970e86f4-b30e-4dda-b4ef-696154328927`.

The current Match detail response does not provide Stats, Lineups, Events, xG, H2H, Form, or Standings. Those are visible backend gaps, not client failures and not reasons to use mock data.

## Validation

Local focused validation:

- `npm run test:phase4b` — PASS;
- `EXPO_PUBLIC_MST_INTERNAL=true npm run validate:android` — PASS;
- Android Hermes export — PASS, 646 modules;
- internal bundle guard — PASS:
  - staging endpoint present;
  - `STAGING / INTERNAL` present;
  - production app API absent;
  - prediction-write routes/symbols absent;
- `git diff --check` — PASS.

GitHub validation:

- run `33278861938` — PASS for the app implementation checkpoint;
- run `33279016288` — PASS for current code/workflow head `c2c27ed5443e66762acd7a65f83d2b7880fa1cb0`.

Both runs include the shared-backend boundary, focused Phase 4B tests, normal app API check, staging Scores API check, default Android export, and internal Android export/bundle guard.

## APK and device status

The owner-usable Phase 4B walking skeleton APK (`/Users/palmer/Desktop/MST-Scores-Phase4B-Internal.apk`, SHA-256 `0340f44e8dacb42a8493214b9a3fe16a763c9c31e0883fc97f17be003f67e98c`) was installed (`package:com.myanmarsportstalk.mst`, `versionCode=1`, `versionName=1.5.2`) and verified on a physical Samsung Galaxy S21 Ultra 5G (`SM-G998B`) running Android 15 (SDK 35) via ADB.

Physical QA verification completed with full **PASS** across all criteria:
- `STAGING / INTERNAL` launch marker verified;
- Matches home view with 10-day date navigation and league grouping verified;
- Big Match Preview verified;
- Match Center navigation with canonical MST match IDs (`p4_33259855829_0a75cd3e_future`, `mst:match:af:1627535`) verified;
- Missing football data renders honest `UNAVAILABLE` badges without synthetic data fabrication;
- Read-only Tips + Prediction area verified (zero prediction writes or submissions);
- All 5 bottom navigation destinations (`Matches`, `News`, `Favorites`, `Tips + Prediction`, `More`) and back navigation verified;
- Empty date state and retry termination verified;
- Staging-only endpoint isolation confirmed (`https://mst-scores-api-staging.betflowapp.workers.dev`); zero production secrets/endpoints in runtime or logcat.

Detailed report: `docs/agent-runs/2026-08-30-phase4b-physical-qa-report.md`
Visual evidence: `docs/agent-runs/evidence/2026-08-30-phase4b/`

## Commits

- `2b9156da6496a3d0fcffab8bcf955ffda93adb44` — lock the MST Scores product contract;
- `0d6ce34f33377e9c142d164061993d8138df108b` — build the owner-usable Phase 4B walking skeleton;
- `080039dc83235f80e10768a7c10466d850aafb5e` — keep missing match-data states fail-closed;
- `c2c27ed5443e66762acd7a65f83d2b7880fa1cb0` — add the GitHub internal-APK artifact workflow.

## Production and infrastructure actions

- production endpoint use: none;
- production deployment/mutation: none;
- production secrets: none;
- D1/Core access: none;
- Worker changes: none;
- Sportmonks work: none;
- locked 19-Worker architecture changes: none;
- `phase4b-internal` EAS profile changes: none;

## Exact next step

1. Commit and push the physical QA evidence files and updated handoff to `codex/phase4b-owner-usable-skeleton-2026-08-30`.
2. Post the physical QA evidence summary on `myohlainghtway123-bit/mst-platform#29` and `myohlainghtway123-bit/mmsportstalk#27`.
3. With all Phase 4B technical, bundle guard, and physical device criteria verified:
   - PR #27 is ready for owner review and merge into `main`.
   - Issue #29 can be closed upon owner confirmation of merge.
