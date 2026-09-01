# Sep 2 Expo auth smoke

## Objective
Verify whether the existing MST Scores GitHub repository can authenticate to Expo/EAS without starting a paid/queued app build. This closes the uncertainty left by the Aug 20 EAS failure that reported no Expo authentication.

## Scope
- branch: `chatgpt/sep2-expo-auth-smoke-2026-09-02`
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
Pending GitHub Actions execution.

## Next action
If auth passes, request/obtain explicit owner approval before starting production Android/iOS EAS builds. If auth fails, configure a valid Expo access token in the repository and rerun the smoke. Do not call the store build ready without a successful build artifact and live/store verification.
