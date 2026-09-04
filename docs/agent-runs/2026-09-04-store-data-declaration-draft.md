# MST Scores — Store Privacy / Data Declaration Draft

Date checked: 2026-09-04

Status: DRAFT FOR STORE-PREPARATION. This is an evidence map, not a completed Play Console or App Store Connect submission. Re-check against the final production artifact, final AdMob configuration and the stores' current forms immediately before submission.

## Product boundary

This document covers **MST Scores** only.

MST Scores = `Follow the Game`.

Do not attribute exact-score Prediction creation/editing/submission to MST Scores. Match Vote remains HOME / DRAW / AWAY. The separate MST Prediction product must be assessed independently.

## First-party MST data paths confirmed in current app code

### Account / contact information

Confirmed app behavior:

- account email is used for authentication/account identity
- display name can be read and edited
- authenticated session token is stored using `expo-secure-store`

Likely store-form purposes:

- App functionality
- Account management
- Security/authentication

Evidence paths:

- `src/services/accountApi.js`
- `src/services/sessionStore.js`

### User-selected profile photo

Confirmed app behavior:

- user may select a photo for an avatar
- native 1:1 crop/edit flow is enabled
- selected avatar is uploaded for authenticated users
- avatar can be deleted
- the app does not need camera or microphone access for this flow; store config blocks those unused image-picker permissions

Likely store-form category:

- Photos / User content, when the user chooses to provide an avatar

Likely purpose:

- App functionality / account personalization

Evidence paths:

- `src/phase4b/Phase4BProfileScreen.js`
- `src/services/accountApi.js`
- `app.json`

### Favorites and preferences

Confirmed app behavior:

- favorite teams/competitions/players can be stored against the account
- notification preferences are stored
- app language and local preferences are stored

Likely purposes:

- App functionality
- Personalization

Evidence paths:

- `src/services/accountApi.js`
- `src/services/notificationApi.js`
- favorites/onboarding stores

### Notifications / device push registration

Confirmed app behavior:

When the user grants notification permission and remote push registration succeeds, the app sends to MST:

- Expo push token
- platform
- device model/name where available

The push token is also kept in SecureStore on the device.

Likely store-form categories:

- Device or other identifiers
- App/device information, depending on the final store taxonomy

Likely purpose:

- App functionality
- Developer communications / notifications

Evidence paths:

- `src/services/matchEngagementApi.js`
- `src/services/pushTokenStore.js`
- `src/services/notificationApi.js`

### Match alerts and Match Vote

Confirmed app behavior:

- signed-in account may save/remove match-alert preferences
- Match Vote transmits a match identifier plus HOME / DRAW / AWAY choice

Likely store-form category/purpose depends on final store taxonomy, but this is account-linked app interaction used for App functionality / personalization or engagement.

Do NOT describe Match Vote as exact-score Prediction.

Evidence path:

- `src/services/matchEngagementApi.js`

### Support reports

Confirmed app behavior:

Support submission can include:

- issue category
- free-text message
- optional contact email
- device information string built from device brand/model and platform/version
- match ID when relevant

Likely store-form categories:

- Contact info: email, when voluntarily supplied
- User content: support message / other user-generated content
- Device/app information

Likely purposes:

- App functionality / customer support
- Diagnostics where the report concerns a technical problem

Evidence paths:

- `src/final/SettingsScreenV2.js`
- `src/services/accountApi.js`

### Tips / purchases / entitlements

Current Scores behavior includes read-only Tips/Tipsters/Leaderboard and server-owned tip purchase/entitlement flows.

Before final store declarations, verify the final production commerce implementation and whether any transaction/payment/credit data is collected directly through the mobile app. Do not mark financial/payment categories from assumption alone.

## Google Mobile Ads / AdMob — third-party SDK disclosures

MST Scores includes `react-native-google-mobile-ads` and plans to use production AdMob after the four owner-supplied production IDs are configured.

Google's current Mobile Ads disclosure guidance states that the SDK may automatically collect/share data including:

- IP address, which can be used to estimate general/approximate location
- user product interactions such as app launch, taps and video views
- diagnostic/performance information
- device/account identifiers including advertising ID / app set ID where applicable

For iOS, Google's current AdMob disclosure guidance also lists possible collection of:

- IP address
- crash logs
- performance data
- device ID
- advertising data
- user product interactions

Purposes described by Google include advertising, analytics and fraud prevention/security depending on the data type and configuration.

Final Play Data safety and App Store Privacy responses MUST include the production Mobile Ads SDK behavior, not only first-party MST data.

Current app privacy/consent implementation:

- Google Mobile Ads UMP/privacy-options service is wired
- Settings exposes Privacy / Ad Choices
- production AdMob IDs are not configured yet

Before submission:

1. Verify the exact native Google Mobile Ads SDK version resolved in the real production Android/iOS artifacts.
2. Re-check Google's current disclosure pages for that version.
3. Inspect the generated iOS privacy manifests / App Privacy Report.
4. Complete Play/App Store forms from the final artifact behavior.
5. Keep the public Privacy Policy consistent with those disclosures.

## Account deletion

Confirmed release design:

- in-app Settings includes Delete Account for authenticated users
- public external resource is being added at:
  - `https://myanmarsportstalk.com/account-deletion`
- companion website implementation reuses the existing canonical deletion backend

The deletion backend is designed to remove supported account-associated records rather than merely deactivate the profile.

Companion website PR: `myanmar-sports-talk-web#98`.

## Data categories not evidenced as required first-party MST Scores inputs in this review

No current release requirement was found for MST Scores to request or intentionally collect:

- precise GPS location
- contacts/address book
- microphone recordings
- camera capture
- health/fitness data
- calendar data
- SMS/call logs

Do not turn this list into a blanket privacy claim without checking the final native artifact and all included third-party SDKs.

The app does allow the user to choose a photo from the media library for a profile avatar, which must be disclosed/permissioned separately as applicable.

## Items requiring final owner/store confirmation

- final AdMob production configuration and ad-personalization/consent behavior
- whether production commerce creates a store-form financial/purchase-history disclosure
- official Instagram and Threads URLs if those launch links are enabled
- final retention language for any legally/security-required records
- final Play Data safety answers
- final App Store Privacy answers
- App Store age-rating questionnaire
- content-rights declarations required by the stores

## Store/toolchain facts checked 2026-09-04

- Google Play new apps/updates require target API 36 since 2026-08-31.
- Expo SDK 54 targets Android API 36.
- Apple uploads require Xcode 26 / iOS 26 SDK since 2026-04-28.
- Expo states SDK 54 EAS builds use the required Xcode 26 default image.

No Expo major upgrade is required solely to clear those two current store toolchain gates.

## Safety

Production actions: NONE.

Production AdMob configuration: NONE.

Store submission: NONE.
