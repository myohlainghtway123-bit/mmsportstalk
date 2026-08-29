# MST Scores product contract

Status: **owner-confirmed and locked**  
Confirmed: 2026-08-30  
Applies to: MST Scores Android product direction  
Related planning: `myohlainghtway123-bit/mst-platform#29`

This document is the durable interpretation of the owner-confirmed six-screen MST Scores visual and product decisions. It locks the final product structure while keeping Phase 4B and Phase 13 responsibilities separate.

## Product identity

MST Scores is **a live-score app first**: open it to follow the game.

The final visual language is the owner-confirmed dark/charcoal interface with bold MST red, readable spacing, league-led match lists, compact football data, and match-following navigation. The supplied visual is a structural target, not authorization to complete final polish during Phase 4B.

MST Scores must remain distinct from MST Prediction:

- MST Scores consumes scores, match context, predictions, and tips.
- MST Scores does **not** create, edit, or submit user predictions.
- User prediction creation remains in the separate MST Prediction app.

## Launch contract

Normal launch:

`confirmed MST Score logo motion (~1.5 seconds) -> Live Scores / Matches immediately`

First launch only:

`logo motion -> mandatory language selection -> optional favorite team -> optional favorite competition -> Live Scores / Matches`

The confirmed MST Score logo asset must be used. A football, stadium, or replacement logo must not substitute for it.

## Primary navigation

The locked bottom navigation order is:

`Matches | News | Favorites | Tips + Prediction | More`

- `Matches` is the default destination.
- Match Center opens only after the user taps a match.
- Primary navigation remains focused on following football rather than social or commerce features.

## Matches / Home

The final Matches structure is league-led and FotMob-inspired without cloning another product:

- prominent date navigation centered on yesterday, today, and tomorrow, with surrounding dates, swipe, or calendar access;
- fixtures grouped by competition/league;
- league headers and league-level navigation;
- team and competition marks where authorized data provides them;
- kickoff time, `LIVE`, `HT`, `FT`, and score states;
- notification/favorite controls;
- followed leagues can eventually be prioritized, reordered, or hidden;
- Big Match Preview appears after the first league;
- home advertising begins only after the second league in the final product;
- Tips/Prediction/Leaderboard blocks do not replace the match-following home hierarchy.

The intended broader content flow is:

`Live Now -> Your Teams -> Today's Matches -> Top Leagues -> Big Match Preview -> MST Tips/Prediction -> Latest Football News`

Phase 4B implements only the staging-connected walking skeleton needed for early owner validation.

## Match Center

The selected canonical MST match identity must be preserved from Matches into Match Center.

The final Match Center hierarchy can include, when authorized backend data exists:

1. Stats
2. Lineups, including player faces when available
3. Events
4. Ratings and xG
5. Head to Head
6. Team Form
7. Standings
8. Top Players
9. Match Info

Missing fields or unsupported endpoints must produce honest unavailable/empty states. They must not be filled with invented sports data.

## News

News uses the confirmed MST dark/red editorial structure and is ultimately fed by authorized MST web/editorial content. Phase 4B may provide only a non-blocking owner-usable shell where that integration is not available.

## Favorites

Favorites includes teams and competitions plus their relevant live/upcoming matches. Phase 4B may provide only the confirmed shell and honest dependency state where persistence or personalized feeds are not available.

## Tips + Prediction

This area is read/consume only for prediction actions in MST Scores.

MST Scores may eventually:

- show or unlock MST predictions through rewarded-video architecture;
- show and buy authorized Tipster tips;
- show the Tipster Leaderboard;
- show the Prediction Leaderboard;
- deep-link to MST Prediction to make a prediction;
- deep-link to MST Prediction to begin the Tipster path.

Locked safety rules:

- no prediction creation, edit, submission, or mutation in MST Scores;
- no fake rewarded-video success;
- no fake purchase success;
- no fake paid-tip entitlement;
- paid/locked selections remain hidden unless authorized server state explicitly permits them;
- no fabricated leaderboard data may be treated as acceptance evidence.

## Prediction scoring

The shared prediction ecosystem scoring is:

- exact score: **3 points**;
- correct result: **1 point**;
- wrong result: **0 points**.

This scoring belongs to the shared web/MST Prediction ecosystem and must not be reinterpreted by MST Scores.

## Tipster application flow

The final Tipster path is:

`MST Scores -> MST Prediction App -> Tipster Program -> Apply -> MST Website application -> MST Web Admin Dashboard review -> shared backend status -> approved Tipster capability in MST Prediction App`

The full Tipster application form must not be implemented inside MST Scores or MST Prediction.

## More

The final More area can include profile editing/photo crop, payments/cards, language, appearance, notifications, purchased tips, Terms, Privacy, User Agreement, Tipster Policy, Refund Policy, About MST, website/social links, and support.

Phase 4B must not invent completion of those account, policy, payment, or support integrations.

## Phase boundary

### Phase 4B: staging-connected walking skeleton

Phase 4B proves the recognizable product architecture using authorized staging services:

- Matches as the default screen;
- real staging matches grouped by league with date navigation;
- canonical real match navigation into Match Center;
- honest available/unavailable Match Center sections;
- read-only Tips + Prediction structure;
- working bottom navigation and basic News/Favorites/More shells;
- bounded loading, empty, timeout, dependency-error, and retry behavior;
- unmistakable `STAGING / INTERNAL` identity;
- installable Android internal artifact for owner testing.

Phase 4B is not final visual completion.

### Phase 13: final integration and release readiness

Phase 13 remains responsible for:

- premium pixel-level polish;
- production AdMob and final rewarded-video integration;
- final animations and confirmed splash/onboarding motion;
- accessibility completion;
- localization completion;
- performance optimization;
- final production integrations;
- store/release readiness.

## Environment and architecture boundary

Phase 4B uses only:

`https://mst-scores-api-staging.betflowapp.workers.dev`

The internal build requires:

`EXPO_PUBLIC_MST_INTERNAL=true`

Permanent constraints:

- no production endpoints, secrets, deployment, or mutation;
- no direct D1 access;
- no direct Core Worker access;
- no Sportmonks work;
- no new Worker;
- the locked 19-Worker architecture remains unchanged.
