# RayHealth EVV Mobile — App Store Release Runbook

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** RayHealth EVV (founder)
**Mobile project repo:** [`github.com/durga710/rayhealth-evv-mobile`](https://github.com/durga710/rayhealth-evv-mobile)

This runbook is the gap list + step-by-step procedure for getting the
RayHealth EVV mobile app onto the iOS App Store and Google Play. It
focuses on what's specific to RayHealth — generic Capacitor/iOS/Android
release docs cover the rest.

For routine `cap sync` and TestFlight builds, see the shorter
`RUNBOOK_MOBILE_RELEASE.md`. This doc covers a **first** App Store /
Play Store submission.

---

## 1. What's Already Done

Audited and verified ✅ as of 2026-05-09:

| Item | Status |
|---|---|
| Bundle ID consistency | ✅ `com.rayhealth.evv.mobile` on both iOS + Android |
| App version / build | ✅ 1.0 / 1 (clean for first submission) |
| iOS app icon | ✅ `AppIcon-512@2x.png` (1024×1024, ~200 KB — custom render, not Capacitor placeholder) |
| iOS splash screen | ✅ `Splash.imageset` with 2732×2732 (iPad Pro size; iOS auto-derives smaller) |
| Android density-specific icons | ✅ different MD5 per `mipmap-*` density (proper renders, not duplicated placeholder) |
| iOS Privacy Manifest (`PrivacyInfo.xcprivacy`) | ✅ committed in mobile repo `050ac8b` — declares 4 data types (Name, Email, PreciseLocation, UserID), 4 Required Reason API uses (UserDefaults, FileTimestamp, SystemBootTime, DiskSpace) with reason codes |
| iOS privacy strings (`Info.plist`) | ✅ NSLocationWhenInUseUsageDescription, NSLocationAlwaysAndWhenInUseUsageDescription, NSFaceIDUsageDescription |
| Android permissions (`AndroidManifest.xml`) | ✅ INTERNET, USE_BIOMETRIC, USE_FINGERPRINT, ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION |
| API endpoint pinning | ✅ `.env.production` → `https://rayhealthevv.com/api` |
| CORS allowlist on prod API | ✅ `capacitor://localhost`, `https://localhost`, `http://localhost` added to `ALLOWED_ORIGINS` (Vercel env, `prj_Y0bFZJZND68I4eBeBfE2oqCzo5OG`, 2026-05-08) |
| Production-readiness backend smoke | ✅ login → clock-in → clock-out → logout end-to-end against `https://rayhealthevv.com/api` (audit_events captures every step) |
| HIPAA documentation set | ✅ `SECURITY_POLICY`, `INCIDENT_RESPONSE`, `DATA_RETENTION`, `ENCRYPTION_VERIFICATION`, `BAA_REQUEST_EMAILS`, `DISASTER_RECOVERY`, `ORGANIZATION_SCOPING_SECURITY` — all shipped to `main` |
| AWS BAA | ✅ Active in AWS Artifact (verified 2026-05-08) |
| AWS Bedrock model | ✅ `us.anthropic.claude-haiku-4-5-20251001-v1:0` (legacy claude-3.5-haiku swapped out 2026-05-08) |
| Hardcoded login backdoor | ✅ removed from `AuthContext.tsx` |

---

## 2. What's Still Required Before Submission

### 2.1 Apple Developer Program

**You** must own these (RayHealth's founder, not me):

- [ ] Apple Developer Program membership ($99/yr) for Team `com.rayhealth.evv.mobile`
- [ ] An App Store Connect record for "RayHealth EVV Mobile"
- [ ] Distribution certificate + provisioning profile
- [ ] App Store screenshots (see §3.1)
- [ ] App Store metadata: description, keywords, support URL, privacy policy URL (see §3.2)
- [ ] Age rating + content rights questionnaire answers (see §3.3)
- [ ] App Privacy nutrition-label answers (see §3.4 — must match `PrivacyInfo.xcprivacy`)

### 2.2 Google Play Console

- [ ] Play Console account ($25 one-time)
- [ ] Upload key (or use Play App Signing)
- [ ] Play Store metadata mirror of App Store: description, screenshots, content rating
- [ ] Data Safety form (Play Store equivalent of Apple's Privacy nutrition label)

### 2.3 In-Repo Tasks

- [ ] **Drag `PrivacyInfo.xcprivacy` into the App target in Xcode.** I created the file; Xcode needs to be told to ship it. Open `ios/App/App.xcodeproj`, right-click on `App` → "Add Files to App…", select `PrivacyInfo.xcprivacy`, uncheck "Copy items if needed", check the App target. Without this Xcode step the file won't be embedded in the .ipa.
- [ ] (Optional but strongly recommended) Upgrade mobile token storage from `@capacitor/preferences` to a Keychain/Keystore-backed plugin per `ENCRYPTION_VERIFICATION.md` §3.3
- [ ] Decide UI fate of the stub-feature screens (forgot-password, accept-invite, profile-edit, change-password, task-complete) — they throw a clean "Coming soon" toast today, but if Apple's reviewer drills into them they'll see a non-functional flow. Either:
      - (a) Remove the screens from the navigator entirely (route to login or to the help link)
      - (b) Build the missing backend endpoints (option A from the earlier conversation)
      - (c) Add an explicit "Coming in v1.1" badge on each affected screen so the reviewer understands these are roadmap

---

## 3. Submission Materials

### 3.1 Screenshots (required)

Apple requires screenshots for at least one device class. Recommended set:

- iPhone 6.7" (Pro Max — 1290×2796): 3–10 screenshots
- iPad 13" (M4 — 2064×2752): 3–10 screenshots if you want iPad eligibility
- One Android phone class for Play (1080×1920 or higher)

Suggested screen captures (caregiver flow):

1. Login (clean branded entry point)
2. Today's visits (dashboard with one synthetic visit)
3. Clock-in screen with the 30-second haptic confirm visualization
4. Visit detail with the PA task list
5. Clock-out confirm with location dot on map
6. (Optional) Notification center / EVV success state

**Don't include real PHI.** Use the test fixture caregiver
(`test-caregiver-fixture@rayhealthevv.local`) plus the synthetic Lok-Ghimeray
client and capture against staging or a Neon branch.

### 3.2 Store Listing Copy

**Name (≤30 chars):** RayHealth EVV
**Subtitle (≤30 chars):** Care visits, on the clock
**Promotional text (≤170 chars):** *Quick description visible on the
store page.*
**Description (≤4000 chars):** Pull from
`packages/web/src/features/marketing/LandingPage.tsx` hero copy + key
features section, but rewritten for the App Store voice.
**Keywords (≤100 chars, comma-sep):** EVV, home care, electronic visit
verification, caregiver, clock in, Pennsylvania, Cures Act
**Support URL:** `https://rayhealthevv.com/contact`
**Marketing URL:** `https://rayhealthevv.com`
**Privacy Policy URL:** **REQUIRED.** Apple will block submission without
this. Either (a) author `https://rayhealthevv.com/privacy` and link it,
or (b) link the public-facing version of `SECURITY_POLICY.md` summary.

### 3.3 Age Rating + Content

- Age rating: **4+** (no objectionable content)
- Content rights: confirm RayHealth owns or has rights to all assets
- Health/Medical category: yes — and yes, the app provides health-related
  functionality (EVV records). Apple will ask. Answer truthfully:
  "Provides medical advice or treatment information" → **NO**
  "Provides health-related functionality" → **YES, EVV recording**

### 3.4 Privacy Nutrition Label (must match `PrivacyInfo.xcprivacy`)

In App Store Connect → Privacy → set:

| Data Type | Linked? | Used for tracking? | Purpose |
|---|---|---|---|
| Name | Yes | No | App Functionality |
| Email Address | Yes | No | App Functionality, Authentication |
| Precise Location | Yes | No | App Functionality |
| User ID | Yes | No | App Functionality, Authentication |

Tracking: **No.** Set "We don't use data from this app to track you."

### 3.5 Export Compliance (encryption disclosure)

The app uses HTTPS (TLS) and AES-256-GCM (`cell-cipher.ts` runs on the
server, but the client uses HTTPS). Apple's automated answer set:

- Does your app use encryption? **YES**
- Does your app qualify for any of the exemptions in Category 5, Part 2
  of the U.S. Export Administration Regulations? **YES** (Capacitor uses
  HTTPS — exempt under §740.17(b))
- Have you submitted Year-End Self Classification Report? Not required
  for HTTPS-only apps.

---

## 4. Submission Sequence

```
1. Build the .ipa locally:
     cd ~/Documents/rayhealth-evv-mobile
     npm run cap:sync:ios
     open ios/App/App.xcworkspace
     # In Xcode: Product → Archive → Distribute App → App Store Connect

2. Upload via Xcode Organizer or Transporter.app

3. App Store Connect → My Apps → RayHealth EVV → fill in:
     - Pricing (Free)
     - App Privacy (per §3.4)
     - Build (select the just-uploaded build)
     - Screenshots (per §3.1)
     - Description / keywords (per §3.2)
     - Age rating (per §3.3)
     - Export compliance (per §3.5)

4. Submit for review.
   First review typically takes 24–48 hours. If rejected, the
   #1 most common cause for healthcare apps is the privacy policy URL
   being missing or unreachable — pre-flight check it returns 200.

5. After approval: choose Manual Release so the founder can pin it to
   a marketing event, OR Automatic Release for fastest go-live.
```

For Android:

```
1. cd ~/Documents/rayhealth-evv-mobile
   npm run cap:sync:android
   open android in Android Studio
   Build → Generate Signed Bundle / APK → Android App Bundle

2. Play Console → Internal Testing → upload the .aab
   Test on at least one real device or emulator.

3. Promote Internal → Closed → Open → Production as confidence builds.
```

---

## 5. Post-Submission Checklist

After the first store approval:

- [ ] Verify `https://apps.apple.com/us/app/rayhealth-evv/id<APP_ID>`
      resolves and shows the listing as expected
- [ ] Update the marketing site's `/launch` page to link the App Store
      and Play Store URLs (currently placeholder)
- [ ] Update `docs/compliance/hipaa/SECURITY_POLICY.md` §11 review log
      with the App Store identifier (it counts as a deployment milestone)
- [ ] Set up automated TestFlight builds for future iterations
      (GitHub Actions → `eas build` or `xcodebuild` workflow)
- [ ] Announce on the agency-facing channels per the launch playbook
- [ ] Schedule the first quarterly access-log review per
      `SECURITY_POLICY.md` §5.1

---

## 6. Known Roadmap Items Acknowledged in This Submission

The following are stubbed in v1.0 and shown as "Coming soon" in the
mobile UI. None of them block App Store approval but they limit what a
first-day caregiver can do:

- Forgot password / password reset flow
- Accept-invite flow (caregiver onboarding self-service)
- Profile editing
- Password change
- Task completion (currently only clock-in/clock-out is wired; per-task completion shows the PA task list but doesn't persist completion status)
- Offline visit cache (no offline mode today; mobile requires network)
- Push notifications via Firebase (configured at the manifest level but no in-app handler hooked up yet)

These are roadmap items; the policy at
`docs/compliance/hipaa/SECURITY_POLICY.md` §3 risk register tracks the
ones that involve PHI or data handling.

---

## 7. Review Log

| Date | Reviewer | Change |
|---|---|---|
| 2026-05-09 | Founder + assistant | Initial App Store release runbook authored as part of the production-readiness pass; captures gap list, submission materials, post-submission verification, and acknowledged roadmap stubs |
