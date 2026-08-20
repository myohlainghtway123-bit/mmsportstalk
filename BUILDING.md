# Myanmar Sports Talk — Final App Build

The app is configured with Expo SDK 54 and EAS Build.

## Final local preview

The app no longer uses any migration or Python patch script. Sync directly to GitHub `main` before the final preview:

```bash
cd ~/Downloads/mst-app-build
git fetch origin
git reset --hard origin/main
npx expo start -c
```

Scan the Metro QR code with Expo Go on a physical Android phone. Do not press `a` unless Android Studio / ADB is installed on the Mac.

## Installable Android APK

```bash
npx eas-cli@latest build --platform android --profile preview --clear-cache
```

The `preview` profile creates an APK for direct installation.

## Android Play Store build

```bash
npx eas-cli@latest build --platform android --profile production
```

## iPhone internal build

```bash
npx eas-cli@latest build --platform ios --profile preview
```

A physical iPhone build requires Apple signing and an Apple Developer account.

## iPhone App Store / TestFlight

```bash
npx eas-cli@latest build --platform ios --profile production
```

## App identity

- Name: `Myanmar Sports Talk`
- Version: `1.0.0`
- Android package: `com.myanmarsportstalk.mst`
- iOS bundle identifier: `com.myanmarsportstalk.mst`
- Scheme: `mst`

## Final app areas

- Live Scores / fixtures
- Match events, lineups, statistics, H2H, players and injuries
- Competition tables, fixtures, teams, scorers and seasons
- Team and player data
- MST News
- MST Videos
- MST Transfers
- MST Account login
- Favorites
- Predictions / My Picks / leaderboard
- Notification center and preferences
- Settings / About
- MST website and YouTube links

Football requests are routed through the MST website backend rather than exposing the paid provider key inside the app.
