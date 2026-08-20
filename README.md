# Myanmar Sports Talk (MST) Mobile App

React Native / Expo mobile client for **Myanmar Sports Talk**.

## Main navigation

**Header:** Live Scores · News · Videos · Transfers

**Footer:** Home · Scores · Favorites · Prediction · More

## Connected MST features

- Live and scheduled football scores through the MST backend
- Match events, lineups, statistics, H2H, players and injuries
- Competition standings, fixtures, teams, scorers and seasons
- Team profiles, squads, stats, transfers and trophies
- Player profiles, stats, transfers, trophies and sidelined data
- MST News
- MST Videos
- MST Transfers
- MST account email-code sign in
- Synced favorites
- Match predictions, My Picks and leaderboard
- Notification center and notification preferences
- Settings and About

Football provider credentials remain on the MST backend and are not embedded in the app.

## Development

```bash
npm install
npm start
```

Scan the Metro QR with Expo Go on a physical Android phone. Android Studio / ADB is not required for physical-device Expo Go testing.

## Android APK

```bash
npx eas-cli@latest build --platform android --profile preview --clear-cache
```

## Production builds

```bash
npm run build:android:store
npm run build:ios:store
```

Native application ID / bundle ID: `com.myanmarsportstalk.mst`.
