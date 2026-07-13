# RayHealth EVV — First App Store / Play Store Submission

This document tracks the human/account portion of the first release. The
current Expo/EAS build procedure and privacy declarations live in
[`RUNBOOK_MOBILE_RELEASE.md`](./RUNBOOK_MOBILE_RELEASE.md).

## Source status

- Bundle/package ID: `com.rayhealth.evv` on both platforms.
- Store icon: 1024×1024 RGB PNG.
- Android adaptive and monochrome icons: configured.
- iOS privacy manifest and export-compliance exemption: configured in Expo.
- Android Maps key: injected from the EAS production environment, never Git.
- API URL: read from `EXPO_PUBLIC_API_URL` during the EAS build.
- App Store listing copy: `packages/mobile/store.config.json`.
- Privacy policy: linked in the store metadata and inside Profile.
- v1 device target: iPhone and Android phone; iPad support is disabled pending QA.

Run this before every candidate:

```bash
npm run check
npm run release:check --workspace=@rayhealth/mobile
```

## Account-owned blockers

- [ ] Apple Developer membership is active.
- [ ] App Store Connect record exists for `com.rayhealth.evv`.
- [ ] Apple signing is connected in EAS.
- [ ] Google Play record exists for `com.rayhealth.evv`.
- [ ] Play App Signing and the first manual `.aab` upload are complete.
- [ ] EAS project is initialized and its generated project ID is committed.
- [ ] EAS production variables `EXPO_PUBLIC_API_URL` and
      `GOOGLE_MAPS_ANDROID_API_KEY` are configured.
- [ ] Apple and Google privacy questionnaires match the checked-in declarations.
- [ ] Synthetic-data screenshots are captured for required phone sizes.
- [ ] A dedicated reviewer caregiver account and synthetic agency are ready.

## Reviewer notes

State clearly that RayHealth EVV:

- requires an account issued by a participating home-care agency;
- records location only for EVV clock-in/out;
- can retain punches in encrypted device storage during connectivity loss;
- does not provide medical advice, diagnosis, or treatment;
- does not use advertising identifiers or cross-app tracking.

Provide reviewer credentials through App Store Connect/Play Console—not Git or
the listing description. Use synthetic clients and visits only.

## Release sequence

1. Pass source preflight.
2. Produce production iOS and Android EAS builds.
3. Complete real-device smoke testing through TestFlight/internal Play testing.
4. Push Apple metadata and enter the matching Google listing/privacy answers.
5. Submit for review.
6. Retain build URLs, review responses, test evidence, and release date.
7. After approval, update the public launch page with the real store URLs.
