# Sep 2 NEW MST Scores launch-gate handoff

## Objective
Finish launch-critical hardening for the current NEW MST Scores app without touching production. Preserve the locked product boundary: Scores = Follow the Game; Match Vote HOME/DRAW/AWAY remains in Scores; exact-score Prediction belongs to the separate MST Prediction product.

## Branch and PR
- branch: `chatgpt/sep2-expo-auth-smoke-2026-09-02`
- PR: #31 — `release(scores): harden NEW Scores launch gate`
- current durable head at this checkpoint: `c4c852ed81def306d80de701d6dba467b0507455`

## Commits created in this continuation
- `0bd36de2a53f14d6d414b10fbb0fda2fddaea1bc` — remove Prediction from active Scores app/store description
- `8d7de17ec6552b8f39685d4aeb34d4f3b962cf5c` — wire AdMob native config through release environment variables
- `3a1ecd25c00d30f68223a24e39ec5201eef1952c` — cover `app.config.js` in Sep 2 release checks
- `c4c852ed81def306d80de701d6dba467b0507455` — cover `app.config.js` in normal app validation

## Files changed in this continuation
- `app.json`
- `app.config.js`
- `.github/workflows/sep2-release-checks.yml`
- `.github/workflows/validate-app.yml`
- this handoff

## Evidence and validation
Fresh PR CI on commit `0bd36de2...` reached and passed these steps before being superseded/cancelled by later commits:
- locked dependency install — PASS
- shared backend/product separation validation — PASS
- Phase 4B API/internal-alpha tests — PASS

The cancellation was caused by the workflow's `cancel-in-progress` behavior after newer commits arrived, not by a test failure.

A fresh current-head `Validate MST App` run was started for `c4c852ed...` and was still in progress at this checkpoint. Do not call the branch green until that current-head run completes successfully.

## Expo authentication evidence
Earlier no-build smoke result remains valid:
- GitHub Actions run `33538773761`, job `99959528156`
- result: BLOCKED
- exact blocker: repository Actions secret `EXPO_TOKEN` is not configured
- no EAS build was started

## Release configuration status
Resolved in this continuation:
- active Scores description no longer markets exact-score Prediction
- AdMob SDK is pinned in dependencies
- native AdMob Expo config is present through `app.config.js`
- AdMob native app IDs stay out of source control and are read from release environment variables
- CI now reacts to `app.config.js` changes instead of silently missing native-config edits

Still blocked / requires evidence:
- verified production Scores API origin must be configured
- `EXPO_TOKEN` must be configured before authenticated EAS production builds can run
- `MST_ADMOB_ANDROID_APP_ID` and `MST_ADMOB_IOS_APP_ID` require release-environment values
- Android/iOS rewarded AdMob unit IDs require release-environment values
- real Android and iOS production build artifacts are not yet proven
- store/live verification is not yet proven

## Staging / infrastructure actions
- no staging deployment performed in this continuation
- no infrastructure resources created, changed or deleted

## Production actions
- NONE

## Risks / assumptions
- Do not invent production API origins or advertising IDs.
- Do not weaken strict release validation to make CI green.
- Do not merge PR #31 merely because GitHub reports it mergeable; current-head validation and remaining launch credentials/evidence still matter.
- MST and Betflow remain strictly separated.

## Remaining TODOs
1. Let current-head validation finish and record exact pass/fail evidence.
2. Resolve any code/config test failure found by that run.
3. Verify/configure the real production Scores API origin without pointing production at staging.
4. Configure Expo and AdMob release credentials outside source control.
5. Only after explicit owner production approval: produce real Android/iOS release artifacts and verify store/live behavior.

## Exact recommended next action
Inspect the current-head CI result for `c4c852ed81def306d80de701d6dba467b0507455`; if green, keep PR #31 open and continue only with the remaining release-environment blockers. Do not ask the owner to run Terminal commands yet.
