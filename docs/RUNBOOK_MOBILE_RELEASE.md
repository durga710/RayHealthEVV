# RayHealth Mobile — EAS Build & Release Runbook

**Authored by Durga Ghimeray**

Steps to take the `@rayhealth/mobile` Expo app from local source to App Store
and Google Play. None of these can be done from the coding agent — they
require upstream developer-account credentials.

---

## 0. Preconditions

- **Expo account** — sign in with `npx eas login` (free tier OK).
- **Apple Developer Program** ($99/year) for iOS / TestFlight / App Store.
- **Google Play Console** ($25 one-time) for Android internal track / Play Store.
- **App icon + splash + store screenshots** — the mobile package already
  has standard Expo assets. You may want custom branded ones in
  `packages/mobile/assets/`.

## 1. Install EAS CLI and link the project

```bash
cd packages/mobile
npx eas login
npx eas init   # only if the Expo project has not already been linked
```

Choose **Managed** workflow (no native code yet). If `app.json` already has
an EAS project ID, skip initialization and verify the project is linked to
the correct Expo account instead.

## 2. Configure EAS profiles

`packages/mobile/eas.json` is already committed. Before a production build,
replace placeholder Apple/Google submit values with real account-specific
values outside git when needed:

```json
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true },
      "env": {
        "EXPO_PUBLIC_API_URL": "http://localhost:3000"
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://rayhealthevv.com"
      }
    },
    "production": {
      "autoIncrement": true,
      "channel": "production",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://rayhealthevv.com"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "FILL_IN_APPLE_ID",
        "ascAppId": "FILL_IN_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "FILL_IN_APPLE_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

## 3. Verify against prod API before building

```bash
EXPO_PUBLIC_API_URL=https://rayhealthevv.com npx expo start --tunnel
```

Open the dev client on a phone, log in as a synthetic caregiver fixture.
Test clock-in, clock-out, and dashboard using synthetic visit data. Confirm:
- JWT carries `jti` (decode at jwt.io)
- `mobile_sessions` table gets a row (check Neon)
- `/auth/mobile/logout` revokes — second request with same JWT returns 401

## 4. Build for iOS

```bash
npx eas build --platform ios --profile production
```

EAS will:
1. Prompt for Apple Developer credentials. Sign in.
2. Generate a distribution certificate + provisioning profile (auto-managed).
3. Bundle the JS, archive into an `.ipa`, sign.
4. Output a build URL on `expo.dev`.

~10–20 minutes.

## 5. Build for Android

```bash
npx eas build --platform android --profile production
```

EAS will:
1. Prompt to upload an existing keystore OR generate one (let it generate;
   back it up via `npx eas credentials`).
2. Bundle, build `.aab`, sign.
3. Output build URL.

## 6. Submit to the stores

### iOS → TestFlight

```bash
npx eas submit --platform ios --latest
```

In App Store Connect:
1. TestFlight → invite yourself + testers.
2. Smoke test login, clock-in, clock-out, dashboard.
3. Submit for review with metadata + screenshots when ready.

### Android → Internal Testing → Production

```bash
npx eas submit --platform android --latest
```

In Google Play Console:
1. Internal testing → add testers → install via testing link.
2. Smoke test.
3. Production rollout when ready.

## 7. After submission — what to monitor

- **`mobile_sessions` table** — one row per active install. Stale rows
  (never logged out, never expired) indicate a crashed logout or
  uninstalled app.
- **`audit_events` `auth.login.failure` with `authMethod=bearer`** —
  credential stuffing against the mobile login endpoint.
- **App store reviews** mentioning crashes, GPS, or login.

## 8. OTA updates (no app-store resubmit)

Anything pure JS (route logic, UI copy, audit-event payload shape):

```bash
npx eas update --branch production --message "fix: <one-line>"
```

Native-code changes (new permissions, native modules, icon) require a full
rebuild + resubmit.

---

## NOT covered here

- Rotating signing certs / keystores (back up via `eas credentials`).
- Custom push notifications (needs APNs/FCM keys).
- Deep linking (universal-link config).
- TestFlight build expiry (90 days; rebuild after).
