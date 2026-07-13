# RayHealth EVV — Encryption Verification Status

**Version:** 1.1
**Effective:** 2026-07-12
**Owner:** Security Officer

This document separates controls verified in source/runtime from vendor claims
and work that still needs operational evidence. It is not a statement that
every PHI field has application-layer encryption.

## Status matrix

| Surface | Control and source evidence | Status |
|---|---|---|
| Web/API transport | Helmet HSTS configuration in `packages/app/src/app.ts`; production TLS terminates at Cloudflare/Vercel | Source verified; current live-header evidence must be retained separately |
| Medicaid ID and caregiver NPI | AES-256-GCM `v1:` envelope in `packages/core/src/security/cell-cipher.ts`; repository write/read paths encrypt/decrypt | Verified in source and tests |
| Other Postgres fields | Neon-managed storage encryption | Vendor-asserted; collect current contractual/security evidence |
| Application secrets | Environment variables on deployment platforms; repository security scan rejects selected secret surfaces | Source/process control; platform configuration evidence required |
| Mobile credential | Expo SecureStore in `packages/mobile/src/lib/AuthContext.tsx`; deleted on logout/401; bearer token has server-side `jti` revocation | Verified in source and API/mobile tests |
| Offline EVV queue | Expo SecureStore adapter requests `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`; maximum 50 punches; keys scoped by user/agency; ordered replay and idempotent event IDs | Verified in source and tests |
| Offline schedule cache | Same SecureStore adapter; maximum 100 assignments; scoped by user/agency; removed on logout/401 | Verified in source and tests |
| AWS Bedrock transport/storage | AWS SDK TLS path; Bedrock-managed service encryption | Code path verified; storage vendor-asserted; BAA recorded active 2026-05-08 and needs annual evidence |
| Firebase, Resend, Vercel, Cloudflare | Vendor-managed transport/storage according to enabled service | Vendor-asserted; BAA/applicability and configuration evidence pending |

## Verified application-layer encryption

`cell-cipher.ts` uses AES-256-GCM with a random IV and authentication tag. The
envelope is `v1:<base64(iv‖tag‖ciphertext)>`; `ENCRYPTION_KEY` supplies the
256-bit key. The verified encrypted columns are:

- `clients.medicaid_number`
- `caregivers.npi`

All other database PHI relies on Neon-managed encryption at rest. Do not market
the platform as application-encrypting every field.

## Mobile storage behavior

The customer mobile app is the Expo project in `packages/mobile` with bundle
and package ID `com.rayhealth.evv`. There is no separate production Capacitor
app in this repository's release path.

The offline queue contains only the evidence needed to replay clock-in/out:
event/visit/assignment identifiers, timestamp, location/accuracy, event type,
and optional service code. Schedule rows contain client display/address and
geofence data needed to operate during a connection failure. Both stores are
bounded and scoped.

On logout, the re-fetchable schedule cache is deleted. Unsent punches remain
encrypted and scoped until they sync, because deleting them could destroy
legally significant EVV evidence. This is a deliberate availability/integrity
tradeoff tracked in `RISK_REGISTER.md`, not a claim of zero residual device risk.

## Open evidence and engineering work

- Obtain and retain current Neon encryption/BAA evidence and plan eligibility.
- Re-verify live TLS/HSTS and production environment-variable protections for
  each release; record results in the private vault.
- Confirm the previously exposed AWS credential is deactivated/rotated and
  retain only the incident/evidence ID in Git-safe documentation.
- Run a production mobile login/logout replay test proving the copied token is
  rejected after server-side revocation.
- Evaluate more application-layer field encryption only when the risk analysis,
  customer contract, or payer requirements justify its operational complexity.

## Communication rules

- Say: “RayHealth uses TLS, vendor-managed storage encryption, and
  application-layer AES-256-GCM for Medicaid IDs and caregiver NPIs.”
- Say: “Mobile credentials and bounded offline EVV data use OS-protected Expo
  SecureStore, with server-side token revocation.”
- Do not say all PHI is application-encrypted, that RayHealth is “HIPAA
  certified,” or that source inspection proves a vendor's live configuration.

## Review log

| Date | Reviewer | Change |
|---|---|---|
| 2026-05-07 to 2026-05-09 | Founder + assistant | Predecessor/current-repository encryption review and initial mobile secure-storage work |
| 2026-07-12 | Engineering-assisted control review | Removed stale two-mobile-project/Capacitor claims; documented the production Expo app, bounded encrypted offline cache/queue, revocable mobile sessions, current evidence gaps, and precise communication limits |
