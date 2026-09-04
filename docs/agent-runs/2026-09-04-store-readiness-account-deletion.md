# MST Scores Store-Readiness — Account Deletion Resource

Date: 2026-09-04

## Objective

Close the repo-side account-deletion/store-readiness gap without configuring production AdMob IDs, building store artifacts, deploying production, or submitting to stores.

## Branch

`scores/store-readiness-sep4`

Base: `scores/release-polish-sep4` at physical-QA commit `fd0536acacd32d296917c509b10267bdac4fbd32`.

## Changes

- Updated `src/config/mstSocialAndLegalConfig.js` so `MST_LEGAL_URLS.dataDeletion` points to the dedicated public resource:
  - `https://myanmarsportstalk.com/account-deletion`
- Removed the old `https://myanmarsportstalk.com/privacy#deletion` fallback from active app configuration.
- Extended `scripts/test_release_polish_contracts.mjs` to lock the dedicated deletion URL and prevent regression to the old Privacy anchor.

## Website dependency

Companion website branch:

`myohlainghtway123-bit/myanmar-sports-talk-web` → `release/account-deletion-sep4`

That branch adds the public `/account-deletion` resource and uses the website's existing authenticated `POST /api/account/delete` endpoint. The existing deletion service deletes the canonical account and supported associated account records rather than merely deactivating the account.

## Policy basis checked on 2026-09-04

- Google Play: apps that support account creation require an in-app deletion path and a functional external web deletion resource.
- Apple: apps that support account creation must allow users to initiate account deletion within the app.

The current MST Scores Settings screen already exposes in-app `Delete Account`; this task fixes the external web resource destination used for store-readiness.

## Validation

Repo-side contract added:

`node scripts/test_release_polish_contracts.mjs`

Expected new assertions:

- dedicated `/account-deletion` URL is present
- old `/privacy#deletion` fallback is absent

CI/automated workflow evidence should be attached to the PR after GitHub runs complete.

## Production actions

NONE.

## Store actions

NONE.

## AdMob actions

NONE. Real production AdMob IDs remain pending owner input.

## Remaining release gates

- merge/ship the public website deletion resource before using it as the Play Console deletion URL
- merge this app config after the release-polish stack
- provide official Instagram and Threads URLs if still desired for launch
- configure four real production AdMob values
- build and verify real Android EAS production artifact
- build and verify real iOS EAS production artifact
- final artifact-specific QA
- no store submission without fresh explicit owner approval
