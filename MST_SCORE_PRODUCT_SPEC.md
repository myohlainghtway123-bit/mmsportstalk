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


## V7 — Match Chat + MST Tips Marketplace

### Match Center
Tabs: **FACTS · CHAT · LINEUP · STATS · H2H · TABLE · ODDS**. CHAT is public-read / signed-in-write match discussion with moderation. TABLE uses the match competition standings. Normal exact-score Prediction remains free and separate.

### MST Tips
Premium creator marketplace. Users apply to become Tipsters and MST admin approval is required. Levels control both daily publishing limits and maximum fixed prices:
- Level 1 Rookie: 1 tip/day, max 5 Credits
- Level 2 Rising: 2/day, max 10 Credits
- Level 3 Skilled: 3/day, max 20 Credits
- Level 4 Pro: 4/day, max 30 Credits
- Level 5 Elite: 5/day, max 40 Credits

Allowed prices are 5/10/20/30/40 Credits within the level cap. One official Tipster pick per match. Tips lock permanently at kickoff; losses cannot be deleted. Verified W/L/V, win rate, current streak and best win streak are system-calculated. Guaranteed-win/fixed-match claims are prohibited.

### Credits + earnings
Reference value: **100 MST Credits = THB 250**. Credit pack design: 100/฿250, 220/฿500, 480/฿1,000, 1,000/฿2,000. Buyer Credits and free Prediction Points are separate. Tip unlock revenue accounting: **70% Tipster / 30% MST**. Tipster earned Credits can request payout after 800 earned Credits, in a supported preferred payout currency. Real App Store / Google Play checkout and receipt verification must be connected before public paid-credit sales are enabled.
