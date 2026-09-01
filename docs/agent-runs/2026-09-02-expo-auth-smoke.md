# Sep 2 Expo auth smoke

## Objective
Verify whether the existing MST Scores GitHub repository can authenticate to Expo/EAS without starting a paid/queued app build. This closes the uncertainty left by the Aug 20 EAS failure that reported no Expo authentication.

## Scope
- branch: `chatgpt/sep2-expo-auth-smoke-2026-09-02`
- PR: #31
- production actions: none
- store submission: none
- EAS build: none
- secret values: never printed

## Evidence before this task
- current Scores production EAS profile exists;
- current iOS bundle and Android package IDs exist;
- `.release/latest-build.txt` records the Aug 20 EAS failure: Expo account/token required;
- current launch deadline is Sep 2 and official launch still requires real build/store proof.

## Change
A temporary CI smoke checks only:
1. `EXPO_TOKEN` is non-empty in Actions secrets;
2. `eas-cli whoami` authenticates successfully.

## Result
**BLOCKED — Expo authentication is not configured in this GitHub repository.**

GitHub Actions run `33538773761`, job `99959528156` executed the repository step and failed before any build with:

`EXPO_TOKEN is not configured for this repository.`

No build was started and no production/store action occurred.

## Risk / blocker
MST Scores cannot start an authenticated EAS Android/iOS production build from the current GitHub workflow until a valid Expo access token is configured as the repository Actions secret named `EXPO_TOKEN`.

## Exact next action
Owner: create/obtain the correct Expo access token for the Expo account that owns project `mst-app`, then add it to `mmsportstalk` GitHub repository → Settings → Secrets and variables → Actions → New repository secret → name exactly `EXPO_TOKEN`. After that, rerun the auth smoke. If it passes, obtain explicit owner approval before starting production Android/iOS EAS builds.

Do not call store/build readiness complete without a successful build artifact and live/store verification.
