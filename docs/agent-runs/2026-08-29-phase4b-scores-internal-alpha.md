# Phase 4B MST Scores internal-alpha handoff

## Objective and scope

Implement only the Phase 4B / Issue #29 minimum Android flow in the existing `mmsportstalk` app:

`Home / Scores -> real staging match -> Match Center -> read-only Prediction / Tip preview`

This run does not build or modify MST Prediction, add a Worker, access D1/Core directly, add commerce/community/chat/ads, touch Sportmonks or Issue #26, or perform production work.

## Base, branch, issue, and PR

- repository: `myohlainghtway123-bit/mmsportstalk`
- base: current `main` at `a7b2e027e1bc7dc2fac8a42c70da0de52d6e27c2`
- repository `AGENTS.md`: none present
- branch: `codex/phase4b-scores-internal-alpha-2026-08-29`
- issue: `myohlainghtway123-bit/mst-platform#29`
- PR: `myohlainghtway123-bit/mmsportstalk#25`

## Verified staging Product API

The internal alpha uses only:

`https://mst-scores-api-staging.betflowapp.workers.dev`

This exact URL was recovered from protected MST Platform staging run `33259855829`, job `99119816865`, where Wrangler deployed `mst-scores-api-staging`. It was then verified with live read-only requests on 2026-08-29:

- `/health` — 200, `mst-scores-api`, `environment=staging`
- `/ready` — 200, `ready=true`
- `/v1/fixtures?limit=3` — 200 with canonical staging matches
- `/v1/live?limit=3` — 200 with real staging matches
- `/v1/results?limit=3` — 200 with real staging matches
- `/v1/matches/mst%3Amatch%3Aaf%3A1627535` — 200 with the same canonical match ID
- `/v1/tips?matchId=mst%3Amatch%3Aaf%3A1627535&limit=10` — 200, empty permitted preview for that match

The durable endpoint verification is also recorded in Issue #29 comment `5463304574`. No credentials or secrets were used or logged.

## Implemented

- existing app entry now loads a focused Phase 4B internal-alpha shell
- unmistakable `STAGING / INTERNAL` marker and `READ ONLY`/`NO WRITES` labels
- real Scores Product API tabs for fixtures, live matches, and results
- canonical match ID carried from list selection into `/v1/matches/:id`
- match identity mismatch fails closed
- Match Center shows real score/status/kickoff/venue/quality/freshness context
- per-match `/v1/tips` read-only preview
- paid/subscriber/missing-access tips are treated as locked even if an upstream payload contains a selection
- request IDs are preserved and displayed as safe internal diagnostics; no secrets are logged
- loading, empty, dependency-error, timeout, pull-to-refresh, and retry states terminate safely
- the Phase 4B entry imports no prediction/account/community shell and exposes no prediction-write action
- dedicated `phase4b-internal` EAS profile describes one internal Android APK build without triggering it
- CI verifies the live staging Product API and the generated Android bundle boundary

## Commits

- `78497ffb3c97843417549e4b9ff6b4cc26dab0e7` — staging Scores client and deterministic API tests
- `5c9e5ca` — minimum internal-alpha UI, CI, contract checks, and APK profile
- `ac65d67` — Hermes bytecode-aware bundle validation
- `e0d9aeae9662dfaa6159abbd19cb09d6e6667c3f` — durable Phase 4B run handoff

## Validation evidence

- `npm run test:phase4b-api` — PASS
  - exact staging origin and GET-only routes
  - canonical ID preservation
  - request-ID preservation
  - deterministic timeout
  - fail-closed locked tip selection
- `npm run test:phase4b` — PASS
  - API tests plus static internal-alpha contract
  - no production API in the Phase 4B entry graph
  - no prediction write route/action
  - loading/empty/error/retry and internal APK-profile markers
- `npm run validate:shared-backend` — PASS
- `npm run validate:android` — Android Hermes export PASS
- `node scripts/validate_phase4b_bundle.js` — PASS against the generated Hermes bundle
  - staging origin and marker present
  - production app API absent
  - prediction-write routes/symbols absent
- GitHub Actions run `33261190732` (`Validate MST App`) — PASS for commit `e0d9aeae9662dfaa6159abbd19cb09d6e6667c3f`

## Failed approach retained for future runs

The first post-export bundle check inspected only text extensions. Expo emitted the Android JavaScript as Hermes `.hbc` bytecode, so the app exported successfully but the guard could not see its strings and failed. The validator was corrected to inspect `.hbc` bytes as well; the same generated artifact then passed. No acceptance gate was weakened.

## Staging, infrastructure, and production actions

- staging: read-only public Scores API verification only
- EAS/internal APK build: not triggered
- production actions: none
- production endpoint used by Phase 4B flow: none
- migrations/deploys/resource changes: none

## Remaining gaps

- PR #25 has passed normal GitHub validation and remains to be reviewed/merged.
- No EAS quota/status was consumed or assumed in this run.
- The installable APK and device/emulator screenshots/recording required to complete Issue #29 do not exist yet.
- The tested canonical match had no permitted tips, so the real empty preview is proven; a later device proof should also select a match with a free tip if staging has one. Locked selections remain fail-closed regardless.
- Current staging football data includes intentionally visible freshness metadata; some live rows were stale during verification. This is an upstream staging-data observation, not a reason to substitute mock data.

## Exact next step

After PR #25 is green and merged, inspect EAS quota/status once. If available, dispatch **one** Android build using profile `phase4b-internal` (or run `npm run build:android:phase4b` once), download the resulting APK, install it on one supported Android emulator/device, and attach secret-safe evidence for the full canonical-match flow to Issue #29. Do not build with the `production` profile.
