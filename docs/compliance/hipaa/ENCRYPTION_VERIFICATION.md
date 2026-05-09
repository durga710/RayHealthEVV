# RayHealth EVV — Encryption Verification Status

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** RayHealth EVV Security Officer
**Purpose:** Separate verified encryption controls from vendor-asserted controls and open gaps.

This document is intentionally conservative. It records what RayHealth has
**actually verified** in code or live behavior, what depends on vendor
platform guarantees, and what still requires engineering work before it
should be described as complete.

> **Authorship note.** Ported from a predecessor codebase on 2026-05-08
> and adapted to match the controls actually shipped here. The predecessor
> referenced an Expo-based mobile project; this repo's customer-facing
> mobile app is the Capacitor + Vite + React project at
> `~/Documents/rayhealth-evv-mobile`, which uses `@capacitor/preferences`
> for token storage. The status below distinguishes the two.

---

## 1. Status Legend

- **Verified in code/runtime:** confirmed directly in source or live response behavior
- **Vendor-asserted:** expected from the platform, but not independently proven in this repo
- **Gap / needs implementation:** not yet proven or not yet implemented to the required standard

---

## 2. Current Verification Matrix

| Surface | Control | Evidence | Status |
|---|---|---|---|
| Web/API traffic | HTTPS + HSTS | live `rayhealthevv.com` response headers show `strict-transport-security: max-age=15552000; includeSubDomains` (verified by curl 2026-05-08); helmet config in `packages/app/src/app.ts:53-62` | **Verified in runtime** |
| Application-layer field encryption — Medicaid IDs | AES-256-GCM via `packages/core/src/security/cell-cipher.ts` | `encryptCell()` invoked in `client-repository.ts createClient()`; `decryptCell()` invoked in `mapRowToClient()`; `v1:<base64(iv‖tag‖ct)>` envelope; key from `ENCRYPTION_KEY` env var | **Verified in code** |
| Application-layer field encryption — caregiver NPI | Same `cell-cipher.ts` mechanism | `caregiver-repository.ts` paths exercise `encryptCell` / `decryptCell` on `caregivers.npi` | **Verified in code** |
| Bedrock AI transport | AWS SDK over TLS | `@aws-sdk/client-bedrock-runtime` in `packages/app/src/routes/{support-routes,admin-assistant-routes}.ts`; AWS endpoints are TLS-1.2+ by default | **Verified in code path** |
| Bedrock at-rest protection | AWS-managed service encryption | AWS platform behavior; documented at <https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html> | **Vendor-asserted** |
| Postgres at rest | Neon-managed storage encryption | Neon vendor docs; project `late-art-87716813` | **Vendor-asserted** |
| Vercel-hosted compute secrets | Encrypted env-var storage (vars marked `type: encrypted`) | confirmed via `GET /v9/projects/{id}/env` API on 2026-05-08; `JWT_SECRET`, `ENCRYPTION_KEY`, `AWS_*` all `type: encrypted` | **Verified in runtime** |
| Cloudflare edge TLS | TLS 1.2+ termination at Cloudflare, re-encrypted to Vercel origin | Cloudflare Universal SSL on `rayhealthevv.com`; `cf-ray` header present in responses | **Vendor-asserted** |
| Firebase data at rest | Google-managed encryption | Google platform behavior | **Vendor-asserted** |
| Resend stored message content | Vendor-managed encryption | Resend platform behavior | **Vendor-asserted** |
| Mobile auth token storage (Capacitor app at `~/Documents/rayhealth-evv-mobile`) | `@aparajita/capacitor-secure-storage` — backed by **iOS Keychain** (`kSecClassGenericPassword`) / **Android Keystore-backed EncryptedSharedPreferences** | `src/services/mobile-storage.ts` imports `SecureStorage` from `@aparajita/capacitor-secure-storage`; configured `sync=false` (no iCloud Keychain mirror across the user's other devices) and `accessOnLocked=false` (post-first-unlock access only — token isn't readable while the device is locked at rest). | **Verified in code** (closed the prior `@capacitor/preferences` gap on 2026-05-09 — see §3.3) |
| Mobile offline visit cache | Caching strategy for offline EVV | The Capacitor app does **not** currently cache visit data offline; every read fetches from `/evv/visits` on-demand (`src/services/dataService.ts`) | **N/A** — control not required because feature does not exist yet |
| `packages/mobile` Expo project (internal-only, not the customer app) | Expo SecureStore for tokens via `packages/mobile/src/lib/AuthContext.tsx` | iOS Keychain / Android Keystore-backed | **Verified in code** (but this project is not the customer-facing build — see §3.4) |

---

## 3. Important Findings

### 3.1 Transport Encryption Is Real

The production hub enforces secure transport at the edge. `curl -I
https://rayhealthevv.com` returns `strict-transport-security:
max-age=15552000; includeSubDomains` and TLS 1.3 is negotiated end-to-end
through Cloudflare to the Vercel origin.

### 3.2 Field-Level Encryption IS a Verified Production Control

This is a notable improvement over the predecessor codebase. Two PHI
columns are encrypted at the application layer with AES-256-GCM:

- `clients.medicaid_number`
- `caregivers.npi`

Verified by code path:

- Encryption: `cell-cipher.ts` `encryptCell()` is called by
  `client-repository.ts createClient()` and the equivalent caregiver
  paths. Plaintext never reaches `INSERT`.
- Decryption: `mapRowToClient()` (and equivalent) call `decryptCell()`
  on read.
- Envelope: `v1:<base64(iv‖tag‖ciphertext)>`. The `v1:` prefix reserves
  a future `v2:` envelope for key rotation without breaking reads of
  already-encrypted rows.
- Key material: `ENCRYPTION_KEY` env var, set in Vercel as `type:
  encrypted`. 32 raw bytes (256-bit key).

This means a database snapshot exfiltration would expose ciphertext
only for these columns. The other PHI columns rely on Neon-managed
storage encryption (vendor-asserted, not application-encrypted).

### 3.3 Mobile Token Storage — Now Keychain-Backed (Closed 2026-05-09)

The Capacitor app at `~/Documents/rayhealth-evv-mobile` previously
stored the JWT via `@capacitor/preferences`, which wrote to plaintext
iOS `UserDefaults` and Android `SharedPreferences`. That gap was
closed on 2026-05-09 by swapping to
`@aparajita/capacitor-secure-storage`:

- **iOS:** Keychain (`kSecClassGenericPassword`) with
  `accessOnLocked=false` (post-first-unlock access only) and
  `sync=false` (no iCloud Keychain mirror across the user's other
  devices)
- **Android:** Keystore-backed EncryptedSharedPreferences (the
  plugin handles the platform abstraction over the AndroidX
  Security library)

Public API in `src/services/mobile-storage.ts` is unchanged
(`readStoredString`, `writeStoredString`, `removeStoredString`,
plus the JSON wrappers), so no other mobile module needed updating.
The internal-reference `packages/mobile` Expo project (which used
Expo SecureStore) is no longer special — both projects now have
keychain-backed credential storage.

### 3.4 Two Mobile Projects Exist — Don't Confuse Them

For audit clarity:

- `~/Documents/rayhealth-evv-mobile` — the **customer-facing** Capacitor
  app. iOS + Android shells already configured. Bundle ID
  `com.rayhealth.evv.mobile`.
- `packages/mobile` (inside this repo) — an internal Expo project,
  **not** what ends up on the App Store. Used as a reference for native
  patterns.

When this document says "the mobile app", it means the Capacitor app
unless otherwise noted.

### 3.5 Bedrock Is Operating Under an Active BAA

The AWS Business Associate Addendum is **active** in AWS Artifact (verified
2026-05-08). Both AI surfaces — `/api/support/chat` (anonymous marketing
chat) and `/api/admin-assistant/chat` (signed-in coordinator chat) — call
Bedrock with `us.anthropic.claude-haiku-4-5-20251001-v1:0` and use
`@aws-sdk/client-bedrock-runtime` over TLS. There is **no fallback to a
non-BAA vendor** in code; if Bedrock fails, the endpoint returns 502 with
"Could not reach the model" rather than silently routing to OpenAI or
similar.

The previous default model `us.anthropic.claude-3-5-haiku-20241022-v1:0`
was retired by AWS as legacy on 2026-05-08; the model swap to Haiku 4.5
is committed at `e7b0b05`.

---

## 4. Required Follow-Up Work

### High Priority

- Upgrade Capacitor mobile token storage from `@capacitor/preferences` to
  Keychain/Keystore-backed secure storage (§3.3) — within 30 days of
  the next material mobile release
- Document Neon's encryption-at-rest evidence (vendor white paper or BAA
  schedule) and link it from §2

### Medium Priority

- Add the `audit_revisions` (before/after diff) table that the predecessor
  had — currently only the event row is captured in `audit_events`,
  not the column-level diff for mutating operations
- Periodic control review checklist: re-run `verify-audit-triggers.mjs`
  + verify `cell-cipher.ts` decrypts a known-encrypted Medicaid ID
  fixture at every release

### Lower Priority

- Add application-layer encryption to additional PHI fields if a payer
  contract requires stronger protection than Neon-managed encryption
  alone (e.g. if a customer requires HSM-backed keys)
- Document Cloudflare's TLS configuration (cipher suites, OCSP stapling)

---

## 5. Communication Rules

Until the gaps above are closed, use this language honestly:

- ✅ "RayHealth uses encrypted transport (TLS 1.2+, HSTS) and
  application-layer AES-256-GCM encryption for Medicaid IDs and NPIs"
- ✅ "Bedrock is the only AI provider configured, and it operates under
  the AWS BAA"
- ✅ "Audit logs are append-only at the database level"
- ❌ Do **not** say "all PHI fields are application-encrypted" — only
  Medicaid IDs and NPIs are; the rest rely on Neon-managed storage
  encryption (vendor-asserted)
- ❌ Do **not** say "mobile credentials are stored in the platform
  keychain" for the customer Capacitor app — they're in
  Preferences/UserDefaults until §3.3 is closed
- ❌ Do **not** say "the mobile app encrypts cached visits" — it
  doesn't cache visits at all yet, so the question is moot but easy to
  misread

---

## 6. Review Log

| Date | Reviewer | Change |
|---|---|---|
| 2026-05-07 | Founder (predecessor repo) | Initial document authored |
| 2026-05-08 | Founder + assistant | Ported into `rayhealth-evv-clean`; promoted field-level encryption from "Gap" to "Verified" (cell-cipher.ts AES-256-GCM is shipped); reclassified mobile token storage as Gap (Capacitor Preferences ≠ Keychain); added clarification distinguishing the customer Capacitor app from the internal Expo project; pinned current Bedrock model and BAA status |
| 2026-05-09 | Founder + assistant | **Mobile token storage gap closed.** Swapped `@capacitor/preferences` → `@aparajita/capacitor-secure-storage` (iOS Keychain / Android Keystore-backed EncryptedSharedPreferences). Promoted §2 row from Gap → Verified. Also rolled into this entry: backend EVV geofence enforcement landed on /evv/clock-in + clock-out (Haversine distance check vs `clients.latitude/longitude` within `geofence_radius_m`, default 150m, fail-open for clients without registered coords; out-of-bounds attempts written as `permission.denied` audit rows). New `GET /mobile/caregiver/today` returns scheduled assignments + client GPS so the mobile dashboard can render real patient names + countdowns. Mobile signature 30-second pre-warning live (`@capacitor/haptics` Heavy impact + `@capacitor/local-notifications` scheduled at `scheduled_*_time - 30s`). Mobile AI assistant rerouted from non-BAA Gemini fallback → BAA-covered Bedrock via `/api/admin-assistant/chat`. |
