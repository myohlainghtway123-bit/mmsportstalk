# Sep 2 NEW MST Scores launch-gate handoff

## Objective
Finish launch-critical hardening for the current NEW MST Scores app without touching production until the owner explicitly approves production activation. Preserve the locked product boundary: Scores = Follow the Game; Match Vote HOME/DRAW/AWAY remains in Scores; exact-score Prediction creation/editing/submission belongs to the separate MST Prediction product.

## Branch and PR
- branch: `chatgpt/sep2-expo-auth-smoke-2026-09-02`
- PR: #31 — `release(scores): harden NEW Scores launch gate`
- current durable head before this handoff refresh: `98d4e6bc18798e5c5704bc397355a4a92062adbc`
- DO NOT merge PR #31 while the strict production release gate is red.

## Key continuation commits
- `0bd36de2a53f14d6d414b10fbb0fda2fddaea1bc` — remove Prediction from active Scores app/store description
- `8d7de17ec6552b8f39685d4aeb34d4f3b962cf5c` — wire AdMob native config through release environment variables
- `3a1ecd25c00d30f68223a24e39ec5201eef1952c` — cover `app.config.js` in Sep 2 release checks
- `c4c852ed81def306d80de701d6dba467b0507455` — cover `app.config.js` in normal app validation
- `aabea4e94af7a8669bf7790b7893fdfbf53008b2` — harden Sep 2 staging runtime smoke
- `264b25af21311ec79346b32fbb64ecdc26cadb6c` — keep runtime smoke product-separation-safe
- `10691cc813971cf37a0866d4c36528ff346aa463` — verify the actual app-facing Match Vote BFF contract
- `dabe2cef742c7afe5b7dea0ddf15fad13123f90c` — add professional preview runtime contract smoke
- `98d4e6bc18798e5c5704bc397355a4a92062adbc` — include professional preview smoke in runtime CI

## Expo authentication — RESOLVED
Expo authentication is no longer a blocker.

Evidence:
- GitHub Actions run `33590434342`
- authenticated `eas-cli whoami` succeeded using repository `EXPO_TOKEN`
- no production build is claimed from this auth smoke; it only proves authentication is configured.

## Current code/runtime evidence — GREEN
### Sep 2 Scores Runtime Smoke
Latest verified run on the app-facing runtime contract:
- run `33605508881` — PASS
- canonical Scores health: HTTP 200, `service=mst-scores-api`, `environment=staging`, `ok=true`
- live/fixtures/results: HTTP 200 arrays with canonical MST match IDs
- canonical Match Center detail keeps the same canonical match ID
- Scores tips GET: HTTP 200
- Match Vote GET through the real Scores BFF `/v1/matches/{canonicalId}/vote`: HTTP 200 for every tested canonical match ID
- no vote/favorite/prediction/notification/purchase write was performed

Latest professional-preview-enhanced runtime smoke:
- run `33605992202` — PASS
- `/v1/matches/{canonicalId}/preview` returns HTTP 200
- contract: `professional-match-preview.v1`
- 31 section keys are present in the contract
- tested fixture state: `DEGRADED`, `premiumReady=false`
- only match identity/context and evidence metadata currently contain usable facts
- H2H, key statistics, MST AI View, MST Admin View and other premium sections are still missing from staging evidence

### Validate MST App
Run `33605513046` — PASS, including:
- shared backend/product boundary validation
- Phase 4B internal-alpha tests
- dedicated app API verification
- staging Scores Product API verification
- current Android app production-mode JS export
- Phase 4B internal Android export

### Sep 2 Scores Release Checks
Run `33605508770` confirms code-side release checks are green before the strict environment gate:
- Phase 4B API unit contract — PASS
- product separation regression — PASS
- current Scores source contract — PASS
- Android production-mode JS export — PASS
- iOS production-mode JS export — PASS
- strict launch gate — FAIL only because required production release configuration is missing

## Exact strict production release blockers
The strict gate must remain red until these real values exist. Do not invent or weaken them.

### 1. Production Scores API origin
Production `eas.json` does not yet contain a verified production `mst-scores-api` origin.

Exact gate meaning: production must not point at `scores-api-staging.myanmarsportstalk.com`.

Shared platform truth:
- `mst-platform` contains the implemented `mst-scores-api` Worker.
- current platform infrastructure is explicitly staging-only (`productionTraffic=false`, `productionRoutes=false`).
- no verified production Scores hostname/deployment lane has been established in this work.
- do not invent `scores-api.*` production DNS or activate production without explicit owner approval.

### 2. AdMob release configuration
Exact missing release values:
- secret `MST_ADMOB_ANDROID_APP_ID`
- variable `EXPO_PUBLIC_MST_ADMOB_ANDROID_BANNER_ID`
- secret `MST_ADMOB_IOS_APP_ID`
- variable `EXPO_PUBLIC_MST_ADMOB_IOS_BANNER_ID`

No valid IDs were found in the repository or connected email. Do not fabricate them.

Rewarded-ad IDs are not a launch requirement for the current Scores boundary; fake rewarded Prediction unlock behavior is disabled.

### 3. Real release artifacts / physical verification
Production-mode JS exports pass, but actual signed EAS production artifacts have not been produced and verified in this work.

Still unproven:
- signed Android production artifact
- signed iOS production artifact
- physical-device release smoke on those artifacts
- store submission/live-store behavior

These are production actions and stay gated behind explicit owner production approval and the real production API/AdMob configuration.

## Match Center depth — proven quality gap
This is not a hidden 500/404 bug; it is missing upstream data.

Canonical `mst-scores-api /v1/matches/:id` currently provides basic match, teams, score/status and reliability fields, but does not include:
- Stats
- H2H
- Standings
- Lineups
- Events/xG
- premium summary
- MST AI view
- MST Admin view

Read-only diagnostics prove existing MST-owned legacy/shared football endpoints can currently return:
- match statistics — HTTP 200 with data
- H2H — HTTP 200 with data

The legacy standings probe returned HTTP 400 for the sampled match.

The canonical professional preview endpoint exists and is correctly fetched by the app, but current staging evidence is degraded and does not yet populate H2H/keyStatistics/AI/admin sections. Therefore the UI must continue to show those unavailable rather than invent content.

The shared `mst-platform` football schema currently persists core matches/competitions/teams/players/standings but does not persist match statistics/H2H/lineups/events/xG. A durable architecture fix belongs in the existing shared Workers, not a Worker #20.

## Product-boundary evidence
- Match Vote is confirmed functional through the Scores BFF using canonical MST IDs.
- Scores does not need to translate canonical match IDs to the older poll endpoint in app code.
- exact-score Prediction writes remain outside Scores.
- active Scores origins remain MST-owned under `myanmarsportstalk.com`.

## Production actions
NONE in this continuation.

No production DNS, route, secret, production Worker deployment, EAS production build, store submission or production database mutation was performed.

## Remaining launch sequence
1. Keep PR #31 open; do not merge merely because code-side CI is green.
2. Establish and verify the real production `mst-scores-api` deployment/origin under the existing 19-Worker architecture, with explicit owner production approval.
3. Configure the four real AdMob release values outside source control.
4. Re-run the strict Scores release gate until it is green without weakening validation.
5. Produce signed Android/iOS EAS production artifacts.
6. Run physical-device release smoke and store checks.
7. Only then merge/release according to the protected production workflow.

## User action right now
No Terminal command is required yet. ChatGPT should continue GitHub/code/test work and must not ask the owner to manually code.
