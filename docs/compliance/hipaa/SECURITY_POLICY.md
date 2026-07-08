# RayHealth EVV — Information Security Policy

**Authored by Durga Ghimeray**

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** RayHealth EVV (Founder / Privacy Officer)
**Review cadence:** Annually, or within 30 days of any material architecture change

This policy describes how RayHealth EVV protects the confidentiality, integrity,
and availability of electronic Protected Health Information (ePHI) it stores
and processes on behalf of home-care agencies. It is written to satisfy the
HIPAA Security Rule (45 CFR §§164.302–164.318) and the documentation
requirement of §164.316.

It is a living document — when the architecture changes, this policy must be
updated within 30 days. Each section cites the controlling HIPAA section.

> **Authorship note.** This policy was ported from a predecessor RayHealth
> codebase on 2026-05-08 and adapted to match what the current
> `rayhealth-evv-clean` repository (production deploy `rayhealth-evv-platform-app`,
> Neon project `late-art-87716813`) actually ships. Where the prior version
> referenced controls that do not yet exist in this repo, those references
> have been removed or marked as roadmap items. See §12 review log.

---

## 1. Scope

**Covered Information:** Electronic PHI handled by the RayHealth EVV platform,
including but not limited to:

- Caregiver and client demographics (name, contact info, date of birth)
- Encrypted client identifiers (Medicaid number, caregiver NPI — encrypted at
  the application layer per §4.4)
- Visit timestamps and GPS verification coordinates
- Care-plan content, visit notes (when stored), and exception remarks
- Family communication content (when the family portal goes live)
- Billing data tied to specific clients

**Covered Systems:** Production deployment at `rayhealthevv.com` and all
subprocessors listed in §10.

**Covered People:** All persons with credentialed access to RayHealth EVV
production systems, including the founder, any contracted developers, and any
authorized agency administrators.

**Out of Scope:** Marketing site content (`/`, `/pricing`, `/contact`,
`/demo`, `/launch`, `/status`), public landing pages, anonymized analytics,
demo/sandbox environments containing only synthetic data.

---

## 2. Roles and Responsibilities (§164.308(a)(2))

Until headcount supports separate Security and Privacy Officers:

- **Privacy Officer:** Founder of RayHealth EVV
- **Security Officer:** Founder of RayHealth EVV
- **Workforce members with PHI access:** documented in
  [WORKFORCE_ACCESS.md](./WORKFORCE_ACCESS.md) (created when first additional
  workforce member is added)

The Privacy/Security Officer is accountable for:

- Maintaining this policy
- Investigating and responding to incidents per [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)
- Reviewing access logs at least quarterly
- Ensuring BAAs are in place with all subprocessors before they receive PHI
- Conducting the annual risk assessment (§164.308(a)(1)(ii)(A))

---

## 3. Risk Management (§164.308(a)(1))

A risk assessment is conducted at least annually and after any material
architecture change. The risk register lives at
[RISK_REGISTER.md](./RISK_REGISTER.md) (to be authored in the next compliance
update cycle).

High-priority risks identified as of 2026-05-09:

| Risk | Mitigation in place | Residual risk |
|---|---|---|
| Compromised vendor credentials | All secrets in Vercel encrypted env vars; rotated when exposed; `BOOTSTRAP_SECRET` removed from env after first admin bootstrap | Low |
| Audit log tampering | Postgres BEFORE-trigger `audit_events_block_mutation_trg` rejects UPDATE/DELETE/TRUNCATE on `audit_events` (§4.5) | Very low |
| EVV record back-dating | Postgres BEFORE-trigger `evv_visits_enforce_immutability_trg` blocks mutation of clock-in/out/location columns; corrections are routed through `visit_maintenance` | Very low |
| Cross-tenant PHI leak | All repository methods take `agencyId` and SQL-bind it into the WHERE clause; see [`docs/security/ORGANIZATION_SCOPING_SECURITY.md`](../../security/ORGANIZATION_SCOPING_SECURITY.md) | Low |
| PHI sent to non-BAA AI vendor | Both AI surfaces (`/api/support/chat`, `/api/admin-assistant/chat`) call AWS Bedrock via `@aws-sdk/client-bedrock-runtime`; no fallback to non-BAA vendors. Endpoints return 503 when AWS is not configured rather than failing open. | Low (assuming AWS BAA active) |
| Plaintext PHI at rest in highly-sensitive columns | AES-256-GCM application-layer encryption (`cell-cipher.ts`) on `clients.medicaid_number` and `caregivers.npi`; vendor-managed encryption (Neon) for the rest | Medium — see [ENCRYPTION_VERIFICATION.md](./ENCRYPTION_VERIFICATION.md) |
| Phishing of admin accounts | MFA on Vercel, AWS, Neon, Firebase, Cloudflare consoles | Medium |

---

## 4. Technical Safeguards (§164.312)

### 4.1 Access Control (§164.312(a))

- **Unique user identification (§164.312(a)(2)(i)):** Every user has a unique
  UUID. Accounts are not shared.
- **Authentication:**
  - **Web:** HttpOnly + Secure + SameSite=Strict cookie session, paired with a
    CSRF token (`packages/app/src/security/cookies.ts`). Passwords hashed with
    bcryptjs.
  - **Mobile:** JWT with a `jti` claim, recorded in the `mobile_sessions`
    table so individual devices can be revoked without invalidating every
    user session.
- **Authorization:** Every PHI-touching API route resolves `req.auth` from
  the session cookie or mobile JWT and binds the resulting `agencyId`/`userId`
  into every repository call. There is no global "list everything"
  repository method on PHI tables.
- **Automatic logoff (§164.312(a)(2)(iii)):** Cookie sessions expire on the
  configured idle/absolute timer; mobile sessions clear on logout, app-data
  wipe, or admin-driven revocation via the `mobile_sessions` row.
- **Encryption and decryption (§164.312(a)(2)(iv)):** See §4.4.

### 4.2 Audit Controls (§164.312(b))

- All PHI-touching reads, writes, exports, and authentication events write to
  the `audit_events` table via the audit-logging middleware
  (`packages/app/src/middleware/audit-log.ts`).
- The middleware classifies routes:
  - `phi.read` for PHI-bearing GETs such as clients, EVV, assignments,
    authorizations, templates, staff, maintenance, caregiver mobile schedule
    reads, command-center visit-board reads, compliance exception lists, and
    billing claims reads
  - `phi.export` for bulk PHI extraction routes such as `/exports/*`
  - `auth.login.success` / `auth.login.failure` for authentication outcomes
- The `audit_events` table is **append-only at the database layer** — UPDATE,
  DELETE, and TRUNCATE are blocked by Postgres trigger
  `audit_events_block_mutation_trg`, which calls function
  `audit_events_block_mutation()` and raises an exception. The trigger and
  function are defined idempotently in
  `packages/core/src/migrations/schema.ts`.
- Logs are retained per §6 retention policy (6 years).
- The trigger can be re-verified at any time by running
  `node scripts/verify-audit-triggers.mjs`. This is required as part of the
  annual evaluation in §5.6 and recommended on any material schema change.

> **Roadmap.** A separate `audit_revisions` (before/after snapshot) table
> appeared in the predecessor codebase but is **not yet shipped here**.
> Mutating operations today record an event row in `audit_events` with
> `event_type` and `entity_id`, not a full diff. Capturing diffs is tracked
> as a Phase 2 enhancement and must not be described as live until shipped.

### 4.3 Integrity (§164.312(c))

- Database transactions enforce atomicity.
- TLS 1.2+ in transit (HSTS enforced on `rayhealthevv.com`).
- Append-only audit trail (§4.2) makes after-the-fact tampering detectable.
- `evv_visits` is immutable by trigger
  (`evv_visits_enforce_immutability_trg`) — corrections must be recorded in
  `visit_maintenance` with an attached reason and approver.

### 4.4 Transmission Security and Encryption (§164.312(e))

- **In transit:** TLS 1.2+ enforced everywhere by Vercel + Cloudflare edge.
  Plaintext HTTP automatically upgraded to HTTPS via HSTS.
- **At rest:**
  - **Application-layer field encryption (verified):**
    `packages/core/src/security/cell-cipher.ts` provides AES-256-GCM with a
    `v1:<base64(iv‖tag‖ciphertext)>` envelope. Used for
    `clients.medicaid_number` (Medicaid ID) and `caregivers.npi` (NPI). Key
    material comes from the `ENCRYPTION_KEY` env var; key rotation is the
    `v2:` envelope version reserved for future use.
  - **Database-managed encryption (vendor-asserted):** Neon provides
    storage-level encryption for the rest of the database.
  - **Mobile credentials (verified):** stored in Expo SecureStore via
    `packages/mobile/src/lib/AuthContext.tsx`.
  - Vendor-managed at-rest encryption is relied on for AWS Bedrock, Firebase,
    Resend, and Vercel where applicable.
- **Verification source:** see
  [ENCRYPTION_VERIFICATION.md](./ENCRYPTION_VERIFICATION.md) for the exact
  distinction between verified controls, vendor-asserted controls, and current
  gaps.

### 4.5 Audit Log Immutability (Tamper Resistance)

The append-only trigger `audit_events_block_mutation_trg` is an extra layer
beyond standard audit logging. It guarantees that even a compromised
application-level role cannot cover its tracks by modifying audit history. To
remove or alter an entry, an attacker would have to disable the trigger at the
database level — an operation that itself leaves a Postgres log trail and is
catchable by `scripts/verify-audit-triggers.mjs`.

---

## 5. Administrative Safeguards (§164.308)

### 5.1 Workforce Security (§164.308(a)(3))

- Access provisioning: New workforce members receive credentials only after
  the Privacy Officer confirms their role requires PHI access.
- Access termination: Within 24 hours of role change or departure, all access
  tokens are revoked, mobile session rows in `mobile_sessions` are deleted,
  cookie sessions are invalidated, and any persistent sessions forced to
  re-authenticate.
- Reviewed quarterly by the Privacy Officer.

### 5.2 Information Access Management (§164.308(a)(4))

- Permissions are granted on a least-privilege basis. Default agency staff
  cannot view PHI outside their assigned agency.
- Multi-tenant isolation: every PHI query is scoped by `agency_id`. See
  [`docs/security/ORGANIZATION_SCOPING_SECURITY.md`](../../security/ORGANIZATION_SCOPING_SECURITY.md)
  for the implementation guarantees.

### 5.3 Security Awareness and Training (§164.308(a)(5))

Workforce members receive training in secure handling of PHI:

- Before first PHI access (initial training)
- Annually thereafter
- Within 30 days of any material policy change

Training topics include phishing recognition, password hygiene, MFA usage,
incident reporting, and the contents of this policy. Completion is logged in
a private workforce records system.

### 5.4 Security Incident Procedures (§164.308(a)(6))

See [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md).

### 5.5 Contingency Plan (§164.308(a)(7))

- **Backups:** Neon point-in-time recovery (7-day window default; expandable
  on Neon Scale tier). Application code and migrations live in GitHub; Vercel
  installs from the lockfile and rebuilds the web/app dependency graph from
  source during deploy via `vercel.json`.
- **Disaster recovery:** Vercel multi-region edge handles failover at the
  hosting layer. Neon backups can restore the database to any point in the
  retention window.
- **RTO target:** 4 hours for full production restore from cold backup.
- **RPO target:** 5 minutes (Neon WAL-based PITR).
- See [`docs/DISASTER_RECOVERY.md`](../../DISASTER_RECOVERY.md) for the
  detailed restore procedure.

### 5.6 Evaluation (§164.308(a)(8))

This policy and the technical controls it describes are reviewed at least
annually and after any material change to the architecture or threat
environment. The annual review includes:

- Re-running the risk assessment
- Confirming all BAAs are current and signed
- Validating audit log immutability by running
  `node scripts/verify-audit-triggers.mjs` against production
- Confirming encryption posture across all subprocessors
- Reviewing access logs for anomalies

### 5.7 Business Associate Agreements (§164.308(b))

A signed BAA is required with every subprocessor that handles ePHI. See §10
for the current list.

---

## 6. Data Retention and Disposal

See [DATA_RETENTION.md](./DATA_RETENTION.md). Summary:

- **Audit logs (`audit_events`):** retained 6 years (§164.530(j))
- **Core PHI-bearing operational records:** 7-year default platform floor,
  unless a stricter state, payer, contract, or legal-hold rule applies
- **Backups containing PHI:** age out of Neon's 7-day PITR window
  automatically; point-in-time deletes propagate via Neon's standard retention

---

## 7. Mobile Device Security

The RayHealth EVV mobile app runs on caregiver devices.

- Mobile credentials (JWT) are stored in Expo SecureStore.
- **The mobile app does not currently cache PHI offline.** Visit lists and
  client details are fetched on-demand through `packages/mobile/src/lib/api-client.ts`.
  When a future offline-cache feature is added, it must implement and verify
  database-at-rest encryption (e.g. SQLCipher) before any PHI is cached, and
  this section must be updated within 30 days of that feature shipping.
- On logout, the credential is deleted (`SecureStore.deleteItemAsync`).
- Device loss reporting: caregivers report lost/stolen devices to the agency
  admin, who triggers a session revocation by deleting the relevant
  `mobile_sessions` row through the admin UI; subsequent JWT use is rejected
  because the `jti` is no longer valid.
- App auto-locks after configured timeout (default: device-level lock).

---

## 8. Workforce Endpoint Security

Founder and any contracted developer endpoints used for PHI-system access:

- Disk encryption required (FileVault on macOS, BitLocker on Windows)
- Strong account password + biometric
- OS auto-update enabled
- No shared workstations
- No PHI stored locally outside encrypted volumes
- Browser session for production consoles requires MFA

---

## 9. Change Management

Code changes that affect PHI handling, authentication, encryption, or audit
logging require:

- Code review by at least one reviewer
- A passing CI run (tests + typecheck + lint)
- A migration entry in `packages/core/src/migrations/schema.ts` when the schema
  changes (the migration is a single idempotent file; new clauses must be
  guarded with `IF NOT EXISTS` / `hasTable` / `hasColumn`)
- An updated entry in this policy if the change is material (within 30 days)

The migration file is append-only in spirit: existing clauses are not edited
post-deploy. Rollbacks happen through new "down" migrations or new guarded
clauses.

---

## 10. Subprocessors and Business Associate Agreements

| Vendor | Purpose | Data | BAA status (as of 2026-07-07) |
|---|---|---|---|
| Vercel | Compute (web app, API, serverless functions) | All PHI passes through Vercel network | Pending — see [BAA_REQUEST_EMAILS.md §1](./BAA_REQUEST_EMAILS.md) |
| Neon | Postgres database (project `late-art-87716813`) | All PHI at rest | Active — executed BAA; project runs in Neon HIPAA mode with pgAudit audit logging and encryption at rest |
| Cloudflare | DNS + edge proxy in front of Vercel; passes `CF-Connecting-IP` to the API for audit logging | TLS-terminated traffic only; no app-level data | BAA not required for traffic transit only; revisit if Cloudflare features that store PHI are enabled |
| Google (Firebase) | Push notifications, auth | Caregiver email, device token, push payload (no PHI in payload by design) | Pending — see [BAA_REQUEST_EMAILS.md §3](./BAA_REQUEST_EMAILS.md) |
| Resend | Transactional email | Caregiver email, message body (may reference client identifiers) | Pending — see [BAA_REQUEST_EMAILS.md §4](./BAA_REQUEST_EMAILS.md) |
| AWS (Bedrock) | AI inference for `/api/support/chat`, `/api/admin-assistant/chat`, command-center briefings, and copilot workflows. Default model `us.anthropic.claude-haiku-4-5-20251001-v1:0` cross-region inference profile, unless overridden by `BEDROCK_MODEL_ID`. | AI surfaces are PHI-minimized, audited with hash/length metadata, and fail closed when AWS is not configured. | Active in AWS Artifact; re-verify annually |

This table must be updated within 30 days of any subprocessor addition or
removal.

---

## 11. Documentation and Records (§164.316)

This document is one of several required records. The full HIPAA documentation
set:

- This policy (`SECURITY_POLICY.md`)
- [Incident Response Plan (`INCIDENT_RESPONSE.md`)](./INCIDENT_RESPONSE.md)
- [Data Retention Policy (`DATA_RETENTION.md`)](./DATA_RETENTION.md)
- [Encryption Verification (`ENCRYPTION_VERIFICATION.md`)](./ENCRYPTION_VERIFICATION.md)
- [BAA tracking (`BAA_REQUEST_EMAILS.md`)](./BAA_REQUEST_EMAILS.md)
- [Disaster Recovery (`docs/DISASTER_RECOVERY.md`)](../../DISASTER_RECOVERY.md)
- [Organization Scoping Security (`docs/security/ORGANIZATION_SCOPING_SECURITY.md`)](../../security/ORGANIZATION_SCOPING_SECURITY.md)
- Risk assessment / risk register (`RISK_REGISTER.md` — to be authored in next
  cycle)
- Workforce access roster (`WORKFORCE_ACCESS.md` — created when first
  additional workforce member is added)
- Training completion records (private workforce records system)
- Signed BAAs (private vault — never committed to git)

All documents are retained for at least 6 years per §164.316(b)(2).

---

## 12. Review Log

| Date | Reviewer | Change |
|---|---|---|
| 2026-05-07 | Founder (predecessor repo) | Initial policy authored |
| 2026-05-08 | Founder + assistant | Ported into `rayhealth-evv-clean`; replaced predecessor-only references (`audit_revisions`, `auth_events`, `PermissionService`, `AuditService.logEvent()`, `password_reset_tokens`) with controls actually shipped here; updated trigger names (`audit_events_block_mutation_trg`, `evv_visits_enforce_immutability_trg`); updated subprocessor IDs (Vercel `rayhealth-evv-platform-app`, Neon `late-art-87716813`); added cell-cipher AES-256-GCM as a verified field-level encryption control; documented that mobile offline PHI cache does not yet exist |
| 2026-05-09 | Founder + assistant | AWS access key rotated (old key had been exposed in a chat session) on Vercel project `prj_Y0bFZJZND68I4eBeBfE2oqCzo5OG`. Local `BedrockRuntimeClient` smoke confirmed the new key has `bedrock:InvokeModel` permission; production `/api/support/chat` returned a clean Claude Haiku 4.5 response post-redeploy. Old key deactivation in IAM is a pending founder action; this row will be amended once that confirmation is in. Nightly `verify-audit-triggers.yml` GitHub Actions workflow added — runs the §5.6 verifier every 03:17 UTC so audit-trigger regressions surface within 24h instead of at the next annual review. Key material/IDs are intentionally not recorded in this document — see secret manager / IAM console for current credentials. |
| 2026-06-30 | Security audit | Removed two AWS IAM access key IDs that had been recorded in plaintext in this row (the original rotation entry above). Both were committed to git history and must be treated as compromised: rotate the active key in IAM immediately, and never record access key IDs in this file going forward — reference the secret manager or an incident ticket instead. |
| 2026-07-07 | Founder + assistant | Aligned this policy with current production posture: Neon BAA active and HIPAA mode complete, Bedrock default model updated to Claude Haiku 4.5, PHI-read audit coverage summarized from current middleware, and Vercel deploys documented as source-built, lockfile-driven deploys. |
