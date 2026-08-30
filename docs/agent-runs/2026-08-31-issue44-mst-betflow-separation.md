# Issue #44 — MST Scores / BetFlow separation handoff

## Scope

- Branch: `codex/issue-44-mst-betflow-separation-2026-08-31`
- PR: #28
- Environment: staging/internal source + validation only
- Production actions: **NONE**

## State

The normal MST Scores production-facing/shared app API remains MST-owned. The Phase 4B internal build, however, still had a legacy BetFlow-named staging Scores API origin. That active staging coupling has now been removed.

## Changes

- Added a binding root `AGENTS.md` product boundary.
- Added `scripts/validate-product-separation.js`.
- Wired the guard into `validate:shared-backend` so normal backend validation fails if active BetFlow product references are introduced.
- Replaced the Phase 4B staging origin in `eas.json`, `src/phase4b/scoresStagingApi.js`, and `scripts/test_phase4b_scores_api.mjs` with `https://scores-api-staging.myanmarsportstalk.com`.
- The MST-owned Scores staging hostname is provisioned by the companion `mst-platform` PR #45 through the same staging-only custom-domain mechanism used for Prediction.
- No production endpoint was changed.

## Merge gate

1. Separation and existing app/backend validation pass on the PR head.
2. `mst-platform` PR #45 deploys successfully to staging.
3. `https://scores-api-staging.myanmarsportstalk.com` is proven against the required Phase 4B read routes before this app PR merges.
4. Internal APK/build scan remains free of forbidden cross-product references and credentials.
5. Production actions remain NONE.
