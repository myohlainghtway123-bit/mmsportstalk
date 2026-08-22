# MST Score — Locked Product Requirements

This file records the agreed product direction. New app work must preserve these rules unless explicitly changed by the owner.

## Product identity
- Installed app name: **MST Score**.
- Brand: Myanmar Sports Talk (MST), dark/near-black UI, white text, MST red accent.
- Product quality target: professional football live-score experience comparable in information density and responsiveness to FotMob, Flashscore/AiScore/LiveScore-style products, while retaining MST identity and original UI.

## Primary navigation
Bottom navigation target:
1. Matches
2. News
3. Favorites
4. Tips
5. Predict
6. More

Matches is the default opening screen. Tips is a separate premium marketplace and must never replace the free Prediction game.

## Opening experience and performance
- Never open to a blank full-screen loading state.
- Render navigation, date controls, filters and cached/structural content immediately.
- Show cached football data first when available and refresh silently in the background.
- Auto-refresh must not block taps or show a full-page spinner.
- Pull-to-refresh can show a refresh indicator.
- Use virtualized lists for large fixture lists; never render 200+ heavy match cards in a ScrollView.
- Prefetch yesterday/today/tomorrow where practical.
- Keep match rows compact and information-dense.
- Prioritize major competitions and genuinely big fixtures before lower-profile matches.

## Match Center
Locked tab order:
- FACTS
- CHAT
- LINEUP
- STATS
- H2H
- TABLE
- ODDS

Match Chat is public-read community discussion attached to a match. Signed-in MST users can post. Moderation, report and admin-delete controls are required.

Do not fabricate unavailable data such as true attacking momentum, shot coordinates, weather or attendance. If a provider does not supply a field, show an unavailable state or omit it.

## MST free prediction system — MUST match website
The app and website use the **same MST account, prediction records, points and leaderboard**.

Prediction input is **predicted exact score**, not 1/X/2 buttons.

Scoring:
- Exact score = **3 points**
- Correct win/draw/loss but not exact score = **1 point**
- Wrong outcome = **0 points**

Prediction Points have no cash value and are completely separate from MST Credits.

## MST Tips marketplace
MST Tips is paid football analysis from approved Tipsters. It is separate from the free Prediction system.

### Everyone starts as a normal MST user
There is no separate “Register as Tipster” account type. A normal MST user must earn Tipster eligibility.

### Private Tipster Qualification
Before a user may submit a Tipster application:
- Start a private Tipster Qualification.
- Submit exactly **10 official private Tips**.
- Qualification Tips are visible only to the candidate and MST admin.
- Other users never see or buy qualification Tips.
- Maximum **2 qualification Tips per Bangkok calendar day**.
- Each Tip must be submitted before kickoff.
- No editing/deleting after kickoff.
- Results settle automatically as WIN / LOSS / VOID.
- Minimum requirement to unlock the Tipster application: **7 wins out of 10 Tips**.
- 7/10 = Passed, 8/10 = Strong, 9/10 = Excellent, 10/10 = Perfect Qualification.
- A failed attempt has a **30-day cooldown** before another attempt.

Passing qualification does not automatically create a paid Tipster. It only unlocks the application. MST admin must still review and approve the account.

### Tipster levels, daily limits and price ceilings
| Level | Name | Max paid Tips/day | Max price/Tip |
|---|---|---:|---:|
| 1 | Rookie | 1 | 5 Credits |
| 2 | Rising | 2 | 10 Credits |
| 3 | Skilled | 3 | 20 Credits |
| 4 | Pro | 4 | 30 Credits |
| 5 | Elite | 5 | 40 Credits |

A Tipster may charge below the ceiling. They are never required to use all daily slots. Levels may rise or fall based on verified performance, consistency, sample size, market difficulty and account standing; raw win rate alone is not enough.

### Tip integrity
- One official paid Tip per match per Tipster.
- Tip locks at kickoff.
- Losing Tips remain permanently in verified history.
- Results settle automatically.
- Public profile shows verified W/L/VOID, win rate, current streak, best streak, total Tips and qualification result.
- Claims such as “Guaranteed Win”, “100% Sure”, “Sure Win” and “Fixed Match” are prohibited server-side.
- MST sells access to analysis/opinion, never guaranteed results.

## MST Credits and creator earnings
- **100 MST Credits = ฿250 reference value**.
- Tip prices are shown in Credits worldwide.
- Credit packs currently planned: 100 / 220 / 480 / 1000 Credits.
- User-purchased MST Credits are not withdrawable cash.
- Tipster Earnings are a separate creator balance.
- Creator revenue share: **70% Tipster / 30% MST from eligible net revenue** after applicable platform fees/refunds/taxes/adjustments.
- Current payout minimum: **800 earned Credits (฿2,000 reference equivalent)**.
- Tipsters may request payout in a supported preferred currency; exchange rate and required tax/withholding/fees are applied at payout time.
- Real App Store / Google Play billing and purchase verification must be connected before selling Credits to customers.

## MST Partner / Affiliate Program
Partner status is separate from Tipster level.

Only an **approved MST Tipster** may apply to the Partner Program. Intended candidates include Tipsters with real audiences on Telegram, Facebook, YouTube, TikTok, websites or other communities.

Partner model:
- Tipster keeps using their external community; MST does not require abandoning Telegram or other channels.
- Approved Partner receives a unique referral code/link.
- Partner brings users into MST Score.
- Partner continues to receive normal Tipster earnings on their own Tips.
- Partner can additionally receive affiliate commission on **eligible net revenue** from referred users.
- Initial default: **10% affiliate commission for 6 months**, but MST admin may adjust the percentage and duration per Partner.
- Referral attribution can be tracked before billing is live, but affiliate cash/credit earnings must not be fabricated. Affiliate earnings activate only from verified eligible billing/subscription events.
- Self-referral and multiple-Partner attribution for one user are prohibited.

Suggested positioning:
- Telegram/social channels = community + acquisition.
- MST Score = verified performance record + premium Tips + payments + creator reputation + future subscriptions.

## Tipster subscriptions
Monthly Tipster subscriptions are a planned product, but exact prices and entitlements are **not locked yet**. Do not enable real paid subscriptions until pricing, billing, cancellation/refund rules and store-policy handling are finalized.

## Odds — bookmaker priority
Odds are separate from both Predictions and Tips.

Bookmaker priority:
1. **1xBet** — primary
2. **Bet365** — fallback only when 1xBet odds for that match/market are unavailable
3. If neither is available: **Odds unavailable**

Never silently substitute another bookmaker. Live/in-play provider data that does not identify a bookmaker must be labelled generically as Live Odds/API-Football in-play odds, never 1xBet or Bet365.

## Data/security architecture
Preferred architecture:
Mobile app -> myanmarsportstalk.com backend -> football/odds providers.

Never place API-Football/API-Sports/bookmaker/provider secrets inside the APK.


## First-launch onboarding — V7.4
- Every app launch opens with a **1.5 second MST Score logo motion** before the app content.
- On first install only, language selection follows the logo motion. **Language is mandatory and cannot be skipped.**
- Supported onboarding languages: Myanmar and English. The choice becomes the app interface language and can later be changed from More.
- Next, the user may choose favorite teams and favorite competitions. This step is **skippable**.
- First-launch favorites are stored locally immediately; when the same user later authenticates with an MST account, pending favorites are synced to the existing MST favorites API.

## Football data connection — V7.4
- Mobile football data must use `https://myanmarsportstalk.com/api/football` as the canonical backend.
- Provider/API secrets remain server-side and are never packaged in the APK/IPA.
- Match loading retries the backend without the timezone query only if the canonical request shape is explicitly rejected (400/404/405/422).
- Date normalization uses Bangkok calendar time first, then a conservative raw-date fallback to avoid false empty match screens.
- Build installer performs a live backend JSON connectivity check before creating the Android build.
