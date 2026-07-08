# RayHealth EVV — Encryption Verification Status

**Authored by Durga Ghimeray**

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
> referenced a separate Capacitor project; this repo's customer-facing
> mobile app is now `packages/mobile`, an Expo / React Native / Expo Router
> app that uses `expo-secure-store` for credential storage.

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
| Postgres at rest | Neon-managed storage encryption under executed BAA / HIPAA mode | Project `late-art-87716813`; Neon BAA active; HIPAA mode enabled with pgAudit audit logging and encryption at rest | **Vendor-asserted under active BAA** |
| Vercel-hosted compute secrets | Encrypted env-var storage (vars marked `type: encrypted`) | confirmed via `GET /v9/projects/{id}/env` API on 2026-05-08; `JWT_SECRET`, `ENCRYPTION_KEY`, `AWS_*` all `type: encrypted` | **Verified in runtime** |
| Cloudflare edge TLS | TLS 1.2+ termination at Cloudflare, re-encrypted to Vercel origin | Cloudflare Universal SSL on `rayhealthevv.com`; `cf-ray` header present in responses | **Vendor-asserted** |
| Firebase data at rest | Google-managed encryption | Google platform behavior | **Vendor-asserted** |
| Resend stored message content | Vendor-managed encryption | Resend platform behavior | **Vendor-asserted** |
| Mobile auth token storage (`packages/mobile` Expo app) | `expo-secure-store` — backed by iOS Keychain / Android Keystore where supported | `packages/mobile/src/lib/AuthContext.tsx` imports `expo-secure-store` and stores the token, user cache, and agency cache via `SecureStore.setItemAsync`; logout removes them with `SecureStore.deleteItemAsync`. `packages/mobile/app.json` includes the `expo-secure-store` plugin. | **Verified in code** |
| Mobile offline visit cache | Caching strategy for offline EVV | The Expo app persists auth/session metadata only. Visit and schedule data are fetched from the API; no offline visit cache is implemented today. | **N/A** — control not required because feature does not exist yet |

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
storage encryption under the active Neon BAA / HIPAA-mode posture
(vendor-asserted, not application-encrypted).

### 3.3 Mobile Token Storage — Expo SecureStore

The customer-facing mobile app in this repo is `packages/mobile`, built
with Expo / React Native / Expo Router. `AuthContext.tsx` stores the
mobile JWT and small session caches in `expo-secure-store`, not
AsyncStorage, browser storage, or plaintext preference APIs.

Verified behavior in code:

- `TOKEN_KEY`, `USER_KEY`, and `AGENCIES_KEY` are read and written only via
  `SecureStore.getItemAsync`, `SecureStore.setItemAsync`, and
  `SecureStore.deleteItemAsync`.
- Logout deletes all three secure-store entries and clears the bearer token
  held by the API client.
- Logout also cancels scheduled shift alerts before clearing the session,
  because those notifications can contain client names.
- `packages/mobile/app.json` includes the `expo-secure-store` plugin.

### 3.4 Mobile Project Source of Truth

For audit clarity, `packages/mobile` is the active customer-facing mobile
app for this repository. It is Expo / React Native / Expo Router, with app
identifier `com.rayhealth.evv` in `packages/mobile/app.json`.

Older documents and archive scripts may mention a predecessor Capacitor
project or `packages/mobile-capacitor`; those are historical references and
must not be treated as the current mobile implementation.

### 3.5 Bedrock Is Operating Under an Active BAA

The AWS Business Associate Addendum is **active** in AWS Artifact (verified
2026-05-08). Both AI surfaces — `/api/support/chat` (anonymous marketing
chat) and `/api/admin-assistant/chat` (signed-in coordinator chat) — call
Bedrock with `us.anthropic.claude-haiku-4-5-20251001-v1:0` and use
`@aws-sdk/client-bedrock-runtime` over TLS. There is **no fallback to a
non-BAA vendor** in code; if Bedrock fails, the endpoint returns 502 with
"Could not reach the model" rather than silently routing to OpenAI or
similar.

The previous Claude 3.5 Haiku default was retired by AWS as legacy on
2026-05-08; the model swap to Haiku 4.5 is committed at `e7b0b05`.

---

## 4. Required Follow-Up Work

### Medium Priority

- Maintain Neon BAA / HIPAA-mode evidence in the private compliance vault
  and re-verify it during each annual evaluation
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
- ✅ "The Expo mobile app stores mobile session credentials with
  `expo-secure-store`"
- ❌ Do **not** say "all PHI fields are application-encrypted" — only
  Medicaid IDs and NPIs are; the rest rely on Neon-managed storage
  encryption under the active Neon BAA / HIPAA-mode posture
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
| 2026-07-07 | Founder + assistant | Corrected the mobile source of truth to the current `packages/mobile` Expo / React Native app, replaced obsolete Capacitor token-storage references with `expo-secure-store` evidence, and removed the already-closed Capacitor secure-storage follow-up. |
| 2026-07-07 | Founder + assistant | Updated Postgres at-rest posture to reflect the active Neon BAA and HIPAA mode, while preserving the distinction between application-layer encryption and vendor-managed storage encryption. |
