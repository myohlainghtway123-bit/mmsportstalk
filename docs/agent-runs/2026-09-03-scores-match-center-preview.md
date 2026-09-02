# Sep 3 NEW MST Scores Match Center preview enrichment

## Objective
Close the launch-critical Match Center data presentation gap without bypassing the shared platform, adding provider traffic, fabricating football data, or crossing the Scores/Prediction product boundary.

## Branch / PR
- branch: `chatgpt/sep2-expo-auth-smoke-2026-09-02`
- PR: #31 — `release(scores): harden NEW Scores launch gate`
- keep PR #31 open while the strict production release gate is red.

## What changed
The app was already fetching `/v1/matches/{canonicalId}/preview` through `mst-scores-api`, but Match Center did not use the returned structured Professional Match Preview.

This slice adds:
- `src/phase4b/matchCenterPreview.js` — pure fail-closed mapping of structured preview sections into Match Center cards;
- structured read-only Match Center presentation in `Phase4BMatchInsights.js`;
- focused regression test `scripts/test_phase4b_match_preview.mjs`;
- the new regression is included in `npm run test:phase4b`.

Mapped verified sections:
- Stats <- `keyStatistics`
- Lineups <- `expectedStartingXi`
- H2H <- `headToHead`
- Form <- `recentForm`
- Standings <- `competitionSituation`

Events and xG remain outside this enrichment because the current 19-Worker Scores/football path does not provide verified persisted event/xG data. They must continue to show unavailable rather than be invented.

## Truth / quality behavior
- Only facts actually present in the Professional Match Preview are shown.
- UNKNOWN/unavailable H2H remains unavailable.
- Large fact sets are bounded in the UI; hidden count is reported rather than silently fabricating a summary.
- `premiumReady=true` with `state=DEGRADED` remains explicitly incomplete and is never mislabeled COMPLETE.
- The app explains that verified sections may exist while advanced Premium sections are incomplete.
- Existing legacy embedded premium/AI/admin fields remain read-only.
- No AI/admin prediction is synthesized from other data.

## Architecture / product safety
- no new Worker;
- no direct app call to API-Football;
- no new provider refresh;
- no backend mutation;
- no Prediction create/edit/submit path;
- Match Vote HOME/DRAW/AWAY boundary unchanged;
- all active API reads remain through the MST Scores API under `myanmarsportstalk.com`.

## Production actions
NONE.

No production API origin, DNS, Cloudflare route, secret, EAS production build, store submission, or production database change was performed.

## Remaining release blockers
Unchanged:
1. production `mst-scores-api` origin still requires explicit owner production approval + activation/verification;
2. four real AdMob release values are still required and must not be fabricated;
3. signed Android/iOS production artifacts + physical/store verification are still unproven.

## User action
No Terminal action is required for this Match Center slice.
