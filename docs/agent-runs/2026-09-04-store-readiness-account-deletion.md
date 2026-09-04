# MST Scores Store-Readiness — Account Deletion & Native Metadata

Date: 2026-09-04

## Objective

Close narrow repo-side store-readiness gaps without configuring production AdMob IDs, building store artifacts, deploying production, or submitting to stores.

## Branch

`scores/store-readiness-sep4`

Base: `scores/release-polish-sep4` at physical-QA commit `fd0536acacd32d296917c509b10267bdac4fbd32`.

## Changes

### Account deletion resource

- Updated `src/config/mstSocialAndLegalConfig.js` so `MST_LEGAL_URLS.dataDeletion` points to the dedicated public resource:
  - `https://myanmarsportstalk.com/account-deletion`
- Removed the old `https://myanmarsportstalk.com/privacy#deletion` fallback from active app configuration.
- Extended `scripts/test_release_polish_contracts.mjs` to lock the dedicated deletion URL and prevent regression to the old Privacy anchor.

### Native/store metadata

- Corrected the standalone display name from `MST Score` to `MST Scores`.
- Corrected the app description to use the locked `MST Scores` product name.
- Added the `expo-image-picker` config plugin for the profile-photo feature.
- Added an explicit iOS photo-library purpose string:
  - `Allow MST Scores to choose a profile picture.`
- Explicitly blocked the unused camera and microphone permissions through the image-picker plugin configuration.
- Extended `scripts/test_release_polish_contracts.mjs` to lock the product name, photo purpose string, and blocked camera/microphone permission configuration.

The package/bundle identity, version and build remain unchanged:

- Android package: `com.myanmarsportstalk.mst`
- iOS bundle identifier: `com.myanmarsportstalk.mst`
- Version: `1.5.2`
- Android versionCode: `12`
- iOS buildNumber: `12`

## Website dependency

Companion website branch:

`myohlainghtway123-bit/myanmar-sports-talk-web` → `release/account-deletion-sep4`

Companion PR: `#98`

That branch adds the public `/account-deletion` resource and uses the website's existing authenticated `POST /api/account/delete` endpoint. The existing deletion service deletes the canonical account and supported associated account records rather than merely deactivating the account.

## Policy basis checked on 2026-09-04

- Google Play: apps that support account creation require an in-app deletion path and a functional external web deletion resource.
- Apple: apps that support account creation must allow users to initiate account deletion within the app.

The current MST Scores Settings screen already exposes in-app `Delete Account`; this task fixes the external web resource destination used for store-readiness.

## Validation

Repo-side contracts were extended in:

`node scripts/test_release_polish_contracts.mjs`

New assertions cover:

- dedicated `/account-deletion` URL is present
- old `/privacy#deletion` fallback is absent
- standalone display name is exactly `MST Scores`
- `expo-image-picker` native config exists
- photo-library purpose text matches the profile-picture feature
- unused camera permission is blocked
- unused microphone permission is blocked

The current GitHub connector did not expose an automatic PR workflow run for this stacked branch, and the assistant runtime could not safely substitute a local GitHub checkout. Therefore this handoff does **not** claim that the new contracts have executed yet. They must run through the existing app validation lane before merge/release.

The native config changes also require artifact-specific verification on the later real Android/iOS production artifacts. They do not invalidate the previously recorded UI/Android physical QA, but the final store artifact must verify generated native permissions/config.

## Production actions

NONE.

## Store actions

NONE.

## AdMob actions

NONE. Real production AdMob IDs remain pending owner input.

## Remaining release gates

- merge/ship the public website deletion resource before using it as the Play Console deletion URL
- merge this app config after the release-polish stack
- execute the app validation lane for this branch/stack
- verify generated native permission/config in real release artifacts
- provide official Instagram and Threads URLs if still desired for launch
- configure four real production AdMob values
- build and verify real Android EAS production artifact
- build and verify real iOS EAS production artifact
- final artifact-specific QA
- no store submission without fresh explicit owner approval
