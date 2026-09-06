# MST Scores — Final Release Gate — 2026-09-06

## Scope
Final launch-critical verification only. No feature work, redesign, or product-boundary change.

## Verified green
- Current `main`: `6f7b6f0f716484a6fa02fc7dec610da23766f32b`.
- Current main Android CI is green, including production-mode export, dedicated/staging API verification, store-readiness contracts, and product separation.
- Physical-device release QA previously passed on OPPO Reno4 / Android 11, including Boot, Home, Match Center, Match Vote, navigation, News, Favorites, Search, Tips, layout, and production API reads.
- Scores production backend is live at the approved MST custom domain and its release verified `/health` plus `/v1/fixtures?limit=1`.
- `EXPO_TOKEN` was independently proven valid by the Sep 2 Expo Auth Smoke.
- No open Scores PR remains.

## Current external blocker — proven 2026-09-06
The existing `Sep 2 AdMob Config Smoke` workflow was rerun on 2026-09-06 against the repository's current Actions secrets. Run `33586872655`, latest job `101505589243`, failed closed before any build or ad request.

All four required production AdMob values are currently absent:
- `MST_ADMOB_ANDROID_APP_ID`
- `MST_ADMOB_IOS_APP_ID`
- `EXPO_PUBLIC_MST_ADMOB_ANDROID_BANNER_UNIT_ID`
- `EXPO_PUBLIC_MST_ADMOB_IOS_BANNER_UNIT_ID`

The workflow intentionally does not print secret values. Identifier-shape validation was skipped because the values do not exist.

## Release truth
MST Scores engineering, backend, CI, physical-device QA, Expo authentication, and store-readiness code are green. A real EAS production store build/AAB is not yet proven because production AdMob credentials are missing. Do not weaken the gate, substitute test IDs, or claim store readiness until the four real AdMob production identifiers are configured and the credential smoke plus production build pass.

## Next owner/external action
Create/obtain the real Android and iOS AdMob App IDs and banner unit IDs, add those four values as repository Actions secrets, rerun the AdMob config smoke, then run the existing EAS production build workflow. No additional Scores code change is required unless that build exposes a real defect.
