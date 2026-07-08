# RayHealth EVV Mobile - App Store Release Runbook

**Authored by Durga Ghimeray**

**Version:** 2.0
**Effective:** 2026-07-07
**Owner:** RayHealth EVV founder
**Mobile project:** `packages/mobile` (`@rayhealth/mobile`)

This runbook covers the first iOS App Store and Google Play submission for the current RayHealthEVV caregiver mobile app.

The current mobile implementation is **Expo / React Native / Expo Router** in `packages/mobile`. Historical references to a Capacitor app or `packages/mobile-capacitor` are predecessor context only and are not the release path for this repo.

For routine build commands, see [`RUNBOOK_MOBILE_RELEASE.md`](RUNBOOK_MOBILE_RELEASE.md). This file focuses on store-submission readiness.

---

## 1. Current Source of Truth

| Item | Current value |
|---|---|
| App framework | Expo / React Native / Expo Router |
| Package | `packages/mobile` |
| iOS bundle identifier | `com.rayhealth.evv` in `packages/mobile/app.json` |
| Android package | `com.rayhealth.evv` in `packages/mobile/app.json` |
| Production API origin | `https://rayhealthevv.com` via `packages/mobile/eas.json` |
| Credential storage | `expo-secure-store` in `packages/mobile/src/lib/AuthContext.tsx` |
| Build service | EAS Build |
| Submit service | EAS Submit |

---

## 2. Required Before Submission

### Apple

- [ ] Apple Developer Program membership
- [ ] App Store Connect app record for "RayHealth EVV"
- [ ] Apple Team ID inserted in `packages/mobile/eas.json`
- [ ] App Store Connect app ID inserted in `packages/mobile/eas.json`
- [ ] App Privacy answers matching the data inventory below
- [ ] Store screenshots using synthetic data only

### Google Play

- [ ] Google Play Console account
- [ ] Play service-account JSON created and stored outside git
- [ ] `packages/mobile/google-service-account.json` present locally only
- [ ] Android Data Safety form matching the data inventory below
- [ ] Internal testing track configured before production rollout

### In Repo

- [ ] `packages/mobile/app.json` has final app name, icon, splash, permissions, and identifiers
- [ ] `packages/mobile/eas.json` has real Apple and Google submit credentials
- [ ] `EXPO_PUBLIC_API_URL` points at `https://rayhealthevv.com` for `preview` and `production`
- [ ] `expo-secure-store`, `expo-location`, and `expo-notifications` remain explicitly configured
- [ ] Any screenshots, demo accounts, or seeded data use synthetic PHI only

---

## 3. Store Data Inventory

Use this for App Store Privacy Nutrition Labels and Google Play Data Safety.

| Data type | Linked to user? | Tracking? | Purpose |
|---|---:|---:|---|
| Name | Yes | No | App functionality |
| Email address | Yes | No | Authentication, app functionality |
| User ID | Yes | No | Authentication, session management |
| Precise location | Yes | No | EVV clock-in / clock-out verification |

Do not claim tracking. The mobile app does not use data for advertising or cross-app tracking.

---

## 4. Screenshot Rules

Use a synthetic caregiver and synthetic client records. Do not capture real PHI.

Recommended screenshots:

1. Login
2. Today's visits
3. Clock-in screen with location permission granted
4. Visit detail with PA task list
5. Clock-out confirmation
6. Session-ended or completed-visit state

Capture against staging or a Neon branch whenever possible. If production is used, use only seeded synthetic records.

---

## 5. Preflight Smoke Test

Before building a store candidate:

```bash
cd packages/mobile
EXPO_PUBLIC_API_URL=https://rayhealthevv.com npx expo start --tunnel
```

On a real device:

1. Log in as a synthetic caregiver.
2. Confirm the dashboard loads the expected synthetic visit.
3. Clock in with location permission granted.
4. Clock out.
5. Log out.
6. Confirm the backend audit trail records login, EVV actions, and logout.

Do not use real client or caregiver PHI for this smoke test.

---

## 6. Build and Submit

### iOS

```bash
cd packages/mobile
npx eas build --platform ios --profile production
npx eas submit --platform ios --latest
```

After upload, complete App Store Connect metadata, privacy answers, screenshots, age rating, and export-compliance answers.

### Android

```bash
cd packages/mobile
npx eas build --platform android --profile production
npx eas submit --platform android --latest
```

Start with Internal Testing, then promote through closed/open testing before production.

---

## 7. Export Compliance

The app uses standard HTTPS transport and platform secure storage.

- Uses encryption: **Yes**
- Qualifies for standard mass-market / HTTPS exemption: **Yes**
- Year-end self-classification: confirm with counsel if native cryptography expands beyond standard app transport and secure storage.

---

## 8. Post-Submission Checklist

- [ ] Verify the App Store and Play Store listing URLs resolve
- [ ] Update the marketing `/launch` page with live store links
- [ ] Record store identifiers in the relevant compliance review logs
- [ ] Schedule recurring TestFlight / internal-track smoke tests
- [ ] Monitor app reviews for GPS, login, and schedule-load issues
- [ ] Monitor `mobile_sessions` and `audit_events` for login failures or revoked-token patterns

---

## 9. Known Roadmap Items

These are roadmap items and should not be presented as complete store features until shipped:

- Forgot-password / password-reset flow
- Caregiver accept-invite flow
- Profile editing
- Password change
- Per-task completion persistence
- Offline visit cache
- Push notification handling beyond configured Expo notification permissions

---

## 10. Review Log

| Date | Reviewer | Change |
|---|---|---|
| 2026-05-09 | Founder + assistant | Initial App Store release runbook authored for a predecessor Capacitor release path. |
| 2026-07-07 | Founder + assistant | Replaced Capacitor-native release instructions with the current `packages/mobile` Expo / EAS release path and updated store data inventory. |
