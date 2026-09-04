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
- Updated `Validate MST App` so the release-polish/store contract script is part of the main validation job rather than an unexecuted side script.

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
- Google Play target API requirement effective 2026-08-31: new apps and app updates must target Android 16 / API level 36 or higher.
- Expo's official SDK reference states Expo SDK 54 uses `compileSdkVersion 36` and `targetSdkVersion 36`.
- Apple App Store Connect requires iOS uploads since 2026-04-28 to be built with Xcode 26 or later using the iOS 26 SDK or later.
- Expo's official App Store minimum-SDK guidance states Expo SDK 54 and 55 are already covered because their default EAS Build image uses Xcode 26.

Therefore the current `expo ~54.0.37` release line already meets both the current Google Play target-API gate and the current Apple Xcode/iOS SDK upload gate when built through the default EAS SDK 54 production toolchain. The open Expo SDK 57 security-upgrade issue remains a separate dependency/security maintenance concern and is **not** a reason to force a risky major SDK upgrade solely for current store toolchain compliance before this release.

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

The main `.github/workflows/validate-app.yml` validation job now explicitly runs this release-polish/store contract script.

Because this PR is currently stacked on PR #32 rather than targeting `main`, the repository's `pull_request: branches: [main]` trigger does not automatically execute for this PR in its current stacked form. This handoff does **not** claim that the newly added contracts have executed yet. They must run through the existing app validation lane before merge/release, for example once the stack is advanced/retargeted to the normal `main` release path.

The native config changes also require artifact-specific verification on the later real Android/iOS production artifacts. They do not invalidate the previously recorded UI/Android physical QA, but the final store artifact must verify generated native permissions/config and the expected SDK/toolchain metadata.

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
- verify generated Android target API 36 and iOS Xcode 26/iOS 26 SDK metadata on the real production artifacts
- verify generated native photo permission/config in real release artifacts
- provide official Instagram and Threads URLs if still desired for launch
- configure four real production AdMob values
- build and verify real Android EAS production artifact
- build and verify real iOS EAS production artifact
- complete App Store Connect's current age-rating questions and both stores' privacy/data declarations during submission preparation
- final artifact-specific QA
- no store submission without fresh explicit owner approval
