# Building Myanmar Sports Talk

The repository is configured for Expo EAS Build.

## Installable Android APK

Use the `preview` profile:

```bash
npx eas-cli@latest build --platform android --profile preview
```

This produces an APK that can be installed directly on an Android phone.

## Installable iPhone build

Use the `preview` profile:

```bash
npx eas-cli@latest build --platform ios --profile preview
```

For a physical iPhone, Apple requires signing with an Apple Developer account. EAS can manage the certificate and provisioning profile after the Apple account is connected and the test device is registered.

## Store builds

Android Google Play bundle:

```bash
npx eas-cli@latest build --platform android --profile production
```

iOS App Store/TestFlight build:

```bash
npx eas-cli@latest build --platform ios --profile production
```

## One-time Expo setup

Before the first cloud build, sign in to Expo and link this repository to an EAS project:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

Do not share Expo or Apple passwords in source code or chat. For GitHub Actions, store an Expo access token as the repository secret `EXPO_TOKEN`.

## Native identifiers

- Android package: `com.myanmarsportstalk.mst`
- iOS bundle identifier: `com.myanmarsportstalk.mst`
