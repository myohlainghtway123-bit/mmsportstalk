# MST Scores — Current Locked Product Specification

Status: **OWNER-CONFIRMED / CURRENT**

Updated: 2026-09-01

This document supersedes older MST Scores drafts that placed user prediction creation inside the Scores app.

## 1. Product identity

**MST Scores = Follow the Game.**

MST Scores is the fast football live-score / match-day product for Android and iOS. It is separate from the **MST Prediction** app.

Do not rebuild or replace the current new MST Scores product. Finish, connect, test and launch the existing product.

## 2. The critical distinction: Match Vote is NOT Prediction

### Match Vote — stays inside MST Scores

Match Vote is a fan poll on a match page:

- HOME
- DRAW
- AWAY
- one vote per user per match
- display percentages and total votes

Match Vote is an engagement feature. It does **not** create a prediction record, earn prediction points, affect prediction history or settle against the MST Prediction scoring system.

### Real MST User Prediction — created only in MST Prediction

The real scored prediction is an **exact-score prediction**, for example `2-1`.

Shared ecosystem scoring:

- Exact score = **3 points**
- Correct win/draw/loss only = **1 point**
- Wrong outcome = **0 points**

Prediction creation/edit/submission belongs to the separate **MST Prediction** app. MST Scores must not create, edit or submit a user prediction.

## 3. Primary navigation

Current product direction:

1. Matches
2. News
3. Favorites
4. Tips + Prediction
5. More

`Matches` is the default opening destination.

The `Tips + Prediction` area is **consume/read only for user predictions**. It is not a prediction-entry screen.

## 4. Core Scores experience

MST Scores must provide a professional global live-score experience:

- Live scores
- Fixtures
- Results
- Standings
- Match Center
- Teams
- Players
- Competitions
- Search
- Favorites
- Notifications
- Myanmar/ASEAN relevance where appropriate

Quality rules:

- scores must be correct;
- updates must be fast;
- stale LIVE states must not persist;
- missing provider data must not be fabricated;
- no endless loading or random refresh loops;
- important information should be reachable quickly.

## 5. Match Center

When verified provider/backend data exists, Match Center supports:

- LIVE / HT / FT
- accurate score and minute
- extra time / penalties where relevant
- events, goals, cards, substitutions
- lineups and formations
- statistics
- H2H
- venue / referee when available
- standings context
- team form
- odds
- **Match Vote**
- premium preview summary / intelligence

Missing fields use honest unavailable/empty states. Never fabricate xG, momentum, lineups, statistics or other match facts.

## 6. Tips + Prediction area in MST Scores

Keep:

- User Prediction Leaderboard
- Tipster Leaderboard
- Premium Tips
- Buy/View Tip
- Tipster profiles / previews
- MST AI Prediction
- MST Admin Prediction
- rewarded-video unlock for eligible MST official prediction content when the real ad/entitlement path is connected
- deep link to MST Prediction

Remove / prohibit:

- user prediction creation
- user prediction editing
- user prediction submission
- fake rewarded-video unlock
- fake purchase success
- fabricated leaderboard/tip data

## 7. Premium Match Preview

MST Scores shows a concise match preview / intelligence summary and links to the full analysis on the MST Website.

Target flow:

`MST Scores match -> preview summary -> Read Full Analysis -> myanmarsportstalk.com`

## 8. Tips / Tipster current business rules

Current recent implementation/design rules:

- Candidate submits 10 private qualification Tips.
- Minimum 7 wins out of 10 to unlock application.
- Maximum 2 qualification Tips per Bangkok calendar day.
- Qualification spans at least 5 different match days.
- No edit/delete after kickoff.
- Failed attempt: 30-day cooldown.
- Passing qualification only unlocks application; MST Admin still approves/rejects.

Tipster levels:

| Level | Name | Max paid Tips/day | Max price/Tip |
|---|---|---:|---:|
| 1 | Rookie | 1 | 5 Credits |
| 2 | Rising | 2 | 10 Credits |
| 3 | Skilled | 3 | 20 Credits |
| 4 | Pro | 4 | 30 Credits |
| 5 | Elite | 5 | 40 Credits |

Current Credits reference:

- 100 MST Credits ≈ ฿250 reference value
- purchased Credits are not withdrawable cash
- Tipster creator earnings are a separate balance
- current recent product rule: **70% Tipster / 30% MST from eligible net revenue**
- current payout minimum concept: ฿2,000 equivalent

If the owner changes the revenue split later, code and commercial copy must be changed together. Do not silently revert to older 80/20 planning text.

## 9. Odds

Odds are separate from both Match Vote and Prediction.

- Compact match odds may appear below the match header.
- Full odds may appear in the ODDS tab.
- Never invent a bookmaker identity or market value.
- If the authorized source is unavailable, show `Odds unavailable`.

## 10. Data / platform boundary

MST Scores consumes MST-owned APIs under `myanmarsportstalk.com` and the shared MST Platform.

- no provider secrets in APK/IPA;
- no direct D1 access from the app;
- no direct provider coupling when MST Platform owns the data contract;
- no cross-product identity, domains, APIs or data in active MST Scores code/config/docs;
- no new Worker for app convenience.

Current staging Scores origin:

`https://scores-api-staging.myanmarsportstalk.com`

Production origin must be an MST-owned production endpoint and must be verified before a store build is treated as launch-ready.

## 11. Monetization

- Google AdMob
- Premium Tips / verified entitlements
- future MST Premium where platform policy permits

Ads must never obstruct live scores, goal information, critical match events or purchase flows.

Real billing must be server-verified before Credits are granted.

## 12. Release rule

Current NEW MST Scores is the product to finish.

Launch work is:

**REUSE -> CONNECT -> TEST -> LAUNCH**

Not:

- rebuild an old app;
- create another Scores app;
- add user prediction creation back into Scores;
- redesign already-approved identity without owner instruction.

A release candidate must prove the fan journey:

`Open Scores -> Match -> Live data -> Match Vote -> Stats/H2H -> Preview -> Full Website Analysis`

and must keep the separate Prediction journey in the MST Prediction app.
