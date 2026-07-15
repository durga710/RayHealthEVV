# RayHealth EVV Mobile — EAS Release Runbook

The mobile app is an Expo SDK 54 managed project in `packages/mobile`. This is
the operational path for producing signed iOS and Android store binaries.

## Source preflight

From the repository root:

```bash
npm run check
npm run release:check --workspace=@rayhealth/mobile
```

The second command verifies identifiers, privacy declarations, EAS profiles,
store metadata, API environment wiring, and committed placeholders. It also
prints the remaining account-owned steps.

## One-time account setup

1. Join the Apple Developer Program and create an App Store Connect record for
   bundle ID `com.rayhealth.evv`.
2. Create the Google Play app with package `com.rayhealth.evv`, enable Play App
   Signing, and complete the first Android upload manually (required before API
   submissions).
3. From `packages/mobile`, authenticate and link the Expo project:

   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

   Commit only the generated `expo.extra.eas.projectId`; never commit account
   credentials.
4. In the EAS project, configure the production environment:

   - `EXPO_PUBLIC_API_URL=https://rayhealthevv.com` as plain text.
   - `GOOGLE_MAPS_ANDROID_API_KEY` as sensitive, restricted in Google Cloud to
     the Android package/signing certificate and Maps SDK for Android.
5. Configure Apple signing through `npx eas-cli@latest credentials --platform ios`.
6. Upload the Google Play service-account JSON to EAS. A local temporary copy,
   if needed for the first submission, must be named
   `packages/mobile/google-service-account.json`; it is gitignored.

## Privacy and store answers

The native iOS privacy manifest is generated from `app.json`. It declares no
tracking and linked app-functionality use of name, email, user ID, precise
location, and health/care-task information. Required-reason API entries are
aggregated from the installed Expo/React Native dependencies.

App Store Connect and Google Play answers must match actual behavior:

- Tracking/advertising: no.
- Precise location: collected, linked, app functionality (EVV punches).
- Name, email, user/account ID: collected, linked, authentication/app functionality.
- Health/care-task outcomes: collected, linked, app functionality.
- Encryption: standard TLS/keychain/keystore use; iOS declares
  `ITSAppUsesNonExemptEncryption=false` for the export-compliance exemption.
- Privacy policy: `https://rayhealthevv.com/privacy`.
- Support: `https://rayhealthevv.com/contact`.

The same privacy-policy link is available inside the app under Profile.

## Store metadata and screenshots

Apple listing copy is versioned in `packages/mobile/store.config.json` and can
be validated/pushed after an iOS binary is processed:

```bash
cd packages/mobile
npx eas-cli@latest metadata:push
```

EAS Metadata currently covers Apple only. Enter the same reviewed copy in
Google Play manually. Capture at least these phone screenshots with synthetic
staging data—never real PHI:

1. Login.
2. Today's assigned visits.
3. GPS/geofence clock-in.
4. Visit-in-progress timer.
5. Clock-out completion.
6. Care-plan task outcomes.
7. Encrypted offline recovery banner (optional).

The v1 config intentionally sets `supportsTablet=false`; enable it only after
iPad layout QA and iPad screenshots exist.

## Build and test

Run the checked-in manual EAS workflow from `packages/mobile`:

```bash
npx eas-cli@latest workflow:run create-production-builds.yml
```

Or build each platform directly:

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest build --platform android --profile production
```

Install a preview/internal build on real devices and verify:

- Sign in, session restore, logout, and agency switching.
- Schedule load and encrypted offline fallback.
- Location permission denial and grant paths.
- In-zone and out-of-zone clock-in behavior.
- Clock-out and care-plan task submission.
- Offline clock-in/out followed by ordered replay.
- Privacy and support links.

## First submission

Submit iOS after the App Store Connect record and signing connection exist:

```bash
npx eas-cli@latest submit --platform ios --latest --profile production
```

Upload the first Android `.aab` manually in Play Console. After Google enables
API submissions for the app, later builds can use:

```bash
npx eas-cli@latest submit --platform android --latest --profile production
```

Start Android on the internal track. Use TestFlight internal testing for iOS.
Promote only after the real-device checklist passes and the store privacy forms
are published.

## Release evidence

For every candidate, retain:

- Git commit and version.
- Passing `npm run check` and `release:check` output.
- EAS build URLs and native build numbers.
- TestFlight/Play internal smoke-test result.
- Store privacy questionnaire review date.
- Reviewer demo-account owner and reset procedure (not its password).

Never place reviewer passwords, signing keys, App Store API keys, Play service
accounts, production `.env` files, or screenshots containing PHI in Git.
