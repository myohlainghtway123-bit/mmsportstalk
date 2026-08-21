# MST Score — Locked Product Requirements

This file records the agreed product direction. New app work must preserve these rules unless explicitly changed by the owner.

## Product identity
- Installed app name: **MST Score**.
- Brand: Myanmar Sports Talk (MST), dark/near-black UI, white text, MST red accent.
- Product quality target: professional football live-score experience comparable in information density and responsiveness to FotMob, Flashscore/AiScore/FreshScore/LiveScore-style products, while retaining MST identity and content.

## Primary navigation
Bottom navigation target:
1. Matches
2. News
3. Favorites
4. Predict
5. More

Matches is the default opening screen.

## Opening experience and performance
- Never open to a blank full-screen loading state.
- Render navigation, date controls, filters and cached/structural content immediately.
- Show cached football data first when available and refresh silently in the background.
- Auto-refresh must not block taps or show a full-page spinner.
- Pull-to-refresh can show a refresh indicator.
- Use virtualized lists for large fixture lists; never render 200+ heavy match cards in a ScrollView.
- Prefetch yesterday/today/tomorrow where practical.
- Keep match rows compact and information-dense.

## Matches screen
- Date navigation: Yesterday / Today / Tomorrow, with calendar expansion later.
- Filters: ALL / LIVE / UPCOMING / FINISHED.
- Group matches by competition.
- Competition name appears once per group.
- Match rows are compact: status/time, team crests, team names, scores.
- Popular competitions should be prioritized in ordering.

## Native football pages
All core football navigation should remain inside the app:
- Match Center
- Competition
- Team
- Player
- Article

External browser should be used only when intentionally opening an external service such as YouTube/Facebook/TikTok/website.

## Match Center
Target tabs:
- Summary
- Stats
- Lineups
- H2H
- Odds

Summary should show the match hero immediately from already-known fixture data while deeper endpoints load below it.

## MST prediction system — MUST match website
The app and website use the **same MST account, prediction records, points and leaderboard**.

Prediction input is **predicted exact score**, not 1/X/2 buttons.
Example: Arsenal 3 : 0 Coventry.

Scoring is locked to the website rules:
- Exact score = **3 points**
- Correct win/draw/loss but not exact score = **1 point**
- Wrong outcome = **0 points**

Other rules:
- User may create/update a prediction before kickoff.
- Prediction locks at kickoff.
- My Predictions shows predicted score, final score, Pending/Settled state and points earned.
- Points / Ranking shows Points, Exact, Correct and Played, aligned with the website leaderboard.
- Do not introduce +20 points or other alternate scoring.
- Do not replace score prediction with Home/Draw/Away prediction buttons.

## Odds — bookmaker priority
Odds are separate from the MST prediction game.

Bookmaker priority is locked to:
1. **1xBet** — primary
2. **Bet365** — fallback only when 1xBet odds for that match/market are unavailable
3. If neither is available: show **Odds unavailable**

Never silently substitute another bookmaker.

Odds presentation may include when available:
- Match Result: Home / Draw / Away
- Over/Under 2.5
- Both Teams To Score
- Additional markets later

Do not expose a paid provider/API key in the mobile app. Mobile app must call MST backend endpoints; MST backend handles provider access and caching.

## Content and social
- News is native MST content.
- Videos section should show an MST YouTube channel entry immediately and list latest YouTube/video feed items when available.
- More / Follow MST must include: YouTube, Facebook, TikTok and Website.

## Favorites and personalization
Users can favorite teams, competitions and players using the same MST account as the website. Longer-term target includes favorite matches and notification preferences.

## Notifications
Current website/account notification center can remain, but true native push notification delivery is a later required capability for goals, kickoff, full-time, lineups, favorite-team news and transfers.

## Data/security architecture
Preferred architecture:
Mobile app -> myanmarsportstalk.com backend -> football/odds providers.

Never place API-Football/API-Sports/bookmaker/provider secrets inside the APK.
