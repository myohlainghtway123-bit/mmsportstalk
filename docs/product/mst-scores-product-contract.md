# MST Scores product contract

Status: **owner-confirmed and locked**

Current: 2026-09-01

Canonical detailed rules: [`MST_SCORE_PRODUCT_SPEC.md`](../../MST_SCORE_PRODUCT_SPEC.md).

This contract exists to prevent future implementation drift.

## Identity

**MST Scores = Follow the Game.**

The current NEW MST Scores product is the app to finish, connect, test and launch. Do not replace it with an old Scores build or create another Scores app.

MST Scores and MST Prediction remain separate products on the shared MST Platform.

## Vote and Prediction are different systems

### Match Vote — MST Scores

- HOME / DRAW / AWAY fan poll on the match page.
- one vote per user per match;
- percentages / total votes may be shown;
- engagement only;
- no prediction points/history/settlement.

### Real User Prediction — MST Prediction

- exact-score prediction, e.g. `2-1`;
- exact score = 3 points;
- correct result only = 1 point;
- wrong result = 0 points;
- creation/edit/submission belongs to the separate MST Prediction app.

**MST Scores must not create, edit or submit user predictions.**

## Primary navigation

`Matches | News | Favorites | Tips + Prediction | More`

Matches is the default destination.

`Tips + Prediction` is a consume/read surface for prediction/tip content, not a prediction-entry screen.

## Scores keeps

- live scores / fixtures / results / standings;
- Match Center;
- teams / players / competitions / search;
- favorites / notifications;
- Match Vote;
- User Prediction Leaderboard;
- Tipster Leaderboard;
- Premium Tips / Buy Tip / purchased-tip access when entitled;
- Tipster profiles / previews;
- MST AI Prediction;
- MST Admin Prediction;
- premium Match Preview summary;
- deep links to the Website / MST Prediction as appropriate.

## Scores prohibits

- user prediction create/edit/submit;
- invented match facts;
- fake vote/prediction/tip/leaderboard data;
- fake paid-tip entitlement;
- fake rewarded-ad unlock;
- provider secrets in the mobile package;
- direct D1 access;
- BetFlow identity/domains/APIs/data in active MST product code/config/docs.

## Current staging boundary

Current verified staging Scores origin:

`https://scores-api-staging.myanmarsportstalk.com`

Staging must remain visibly non-production until the launch migration is deliberately approved.

A production store build must use a verified MST-owned production endpoint.

## Release acceptance

The minimum Scores launch journey is:

`Open Scores -> Match -> Live data -> Match Vote -> Stats/H2H -> Preview -> Read Full Analysis on Website`

Prediction creation is tested separately in the MST Prediction app.

## Execution rule

**Existing capability -> REUSE -> CONNECT -> TEST -> LAUNCH. Build only what is genuinely missing.**
