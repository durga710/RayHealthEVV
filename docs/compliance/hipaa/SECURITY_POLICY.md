# RayHealth EVV — Information Security Policy

**Version:** 1.1
**Effective:** 2026-07-12
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
> `rayhealth-evv` repository (production deploy `rayhealth-evv-platform-app`,
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
  [WORKFORCE_ACCESS.md](./WORKFORCE_ACCESS.md)

The Privacy/Security Officer is accountable for:

- Maintaining this policy
- Investigating and responding to incidents per [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)
- Reviewing access logs at least quarterly
- Ensuring BAAs are in place with all subprocessors before they receive PHI
- Conducting the annual risk assessment (§164.308(a)(1)(ii)(A))

---

## 3. Risk Management (§164.308(a)(1))

A risk assessment is conducted at least annually and after any material
architecture change. The current register lives at
[RISK_REGISTER.md](./RISK_REGISTER.md). Operational proof is indexed in
[CONTROL_EVIDENCE_REGISTER.md](./CONTROL_EVIDENCE_REGISTER.md); sensitive
artifacts remain in the private compliance vault.

Selected architectural risks (the dated register is authoritative):

| Risk | Mitigation in place | Residual risk |
|---|---|---|
| Compromised vendor credentials | All secrets in Vercel encrypted env vars; rotated when exposed; `BOOTSTRAP_SECRET` removed from env after first admin bootstrap | Low |
| Audit log tampering | Postgres BEFORE triggers reject UPDATE/DELETE/TRUNCATE on hot and archived audit tables; nightly verifier detects missing/weakened controls (§4.5) | Low, pending production evidence |
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
  - **Mobile:** every JWT carries a unique `jti` backed by an active
    `mobile_sessions` row. Middleware rejects missing, expired, unknown, or
    revoked rows. Logout revokes the row; switching agencies creates a new
    scoped session and revokes the prior one.
- **Authorization:** Every PHI-touching API route resolves `req.auth` from
  the session cookie or mobile JWT and binds the resulting `agencyId`/`userId`
  into every repository call. There is no global "list everything"
  repository method on PHI tables.
- **Automatic logoff (§164.312(a)(2)(iii)):** Cookie and mobile sessions have
  an eight-hour maximum lifetime. Mobile credentials clear on logout or a
  rejected request; the server-side row supports immediate revocation.
- **Encryption and decryption (§164.312(a)(2)(iv)):** See §4.4.

### 4.2 Audit Controls (§164.312(b))

- All PHI-touching reads, writes, exports, and authentication events write to
  the `audit_events` table via the audit-logging middleware
  (`packages/app/src/middleware/audit-log.ts`).
- The middleware classifies routes:
  - `phi.read` for GETs against `/clients`, `/evv`, `/assignments`,
    `/authorizations`, `/templates`, `/staff`, `/maintenance`
  - `phi.export` for `/exports/*`
  - `auth.login.success` / `auth.login.failure` for authentication outcomes
- The `audit_events` and `audit_events_archive` tables are **append-only at the database layer** — UPDATE,
  DELETE, and TRUNCATE are blocked by Postgres trigger
  `audit_events_block_mutation_trg` and
  `audit_events_archive_block_mutation_trg`. The triggers and functions are
  defined idempotently in
  `packages/core/src/migrations/schema.ts`.
- RayHealth uses a seven-year audit-log policy floor. HIPAA-required policies,
  procedures, and related documentation are retained at least six years under
  45 CFR §164.316(b)(2).
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

The hot and archive append-only triggers are an extra layer beyond standard
audit logging. They prevent the application role from rewriting evidence.
Database owners can still change schema-level controls, so the nightly
`scripts/verify-audit-triggers.mjs` check is the independent detection control;
this policy does not claim that a database owner is technically incapable of
disabling a trigger.

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
  on Neon Scale tier). Application code in Git, deployed by Vercel CI/CD.
  Pre-built `dist/` artifacts are committed to the repo so deploys do not
  depend on Vercel's build environment.
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

- **Audit logs (`audit_events` and archive):** retained 7 years by RayHealth
  policy; this operational period is distinct from HIPAA's six-year
  documentation-retention rule
- **Core PHI-bearing operational records:** 7-year default platform floor,
  unless a stricter state, payer, contract, or legal-hold rule applies
- **Backups containing PHI:** age out of Neon's 7-day PITR window
  automatically; point-in-time deletes propagate via Neon's standard retention

---

## 7. Mobile Device Security

The RayHealth EVV mobile app runs on caregiver devices.

- Credentials, cached schedules, and queued EVV punches use Expo SecureStore.
  The EVV store requests `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` accessibility;
  queue and cache keys are scoped by user and agency.
- The schedule cache is capped at 100 assignments and is removed on logout or
  a rejected session. Pending offline punches are capped at 50 and remain
  encrypted/account-scoped until ordered replay succeeds; deleting them on an
  offline logout would destroy visit evidence.
- The API records idempotent client event IDs and offline capture mode so a
  retry cannot create a duplicate punch and offline evidence is distinguishable.
- Logout attempts server revocation first and always deletes the local
  credential. If the server is unreachable, the server token can remain valid
  only until its eight-hour expiry; this residual risk is tracked in
  `RISK_REGISTER.md`.
- Caregivers must report lost/stolen devices immediately. An authorized
  operator can revoke the corresponding `mobile_sessions` row; a dedicated
  agency self-service device-management UI is not claimed as shipped.
- RayHealth relies on the device lock unless an agency adds managed-device
  controls; unmanaged caregiver devices are a shared-responsibility risk.

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

| Vendor | Purpose | Data | BAA status (reviewed 2026-07-12) |
|---|---|---|---|
| Vercel | Compute (web app, API, serverless functions) | All PHI passes through Vercel network | Pending — see [BAA_REQUEST_EMAILS.md §1](./BAA_REQUEST_EMAILS.md) |
| Neon | Postgres database (project `late-art-87716813`) | All PHI at rest | Pending — see [BAA_REQUEST_EMAILS.md §2](./BAA_REQUEST_EMAILS.md) |
| Cloudflare | DNS + TLS-terminating edge proxy/WAF in front of Vercel | Request traffic and metadata according to enabled edge/logging features | Written conduit/business-associate applicability decision pending; no PHI-retaining Workers/storage/body logging authorized |
| Google | Android Maps SDK and notification-service applicability under review | Location/device data depends on the enabled service; repository uses local Expo notifications and does not show Firebase Auth/Firestore paths | Inventory exact covered services and execute the applicable Google BAA before any PHI-bearing use |
| Resend | Transactional email | Caregiver email, message body (may reference client identifiers) | Pending — see [BAA_REQUEST_EMAILS.md §4](./BAA_REQUEST_EMAILS.md) |
| AWS (Bedrock) | AI inference for `/api/support/chat` and `/api/admin-assistant/chat`. Default model `us.anthropic.claude-haiku-4-5-20251001-v1:0`. | The admin assistant tools are designed to return aggregate operational data; the marketing chat instructs users not to submit PHI. Both fail closed when AWS is not configured. | Recorded active in AWS Artifact on 2026-05-08; annual re-verification evidence pending |

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
- [Risk register (`RISK_REGISTER.md`)](./RISK_REGISTER.md)
- [Control evidence register (`CONTROL_EVIDENCE_REGISTER.md`)](./CONTROL_EVIDENCE_REGISTER.md)
- [Workforce access roster (`WORKFORCE_ACCESS.md`)](./WORKFORCE_ACCESS.md)
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
| 2026-07-12 | Engineering-assisted control review | Corrected mobile architecture/offline storage; implemented and documented revocable JWT sessions; extended append-only protection and verification to archived audit evidence; added risk, evidence, and workforce registers; corrected retention attribution and the Bedrock model. Production and signed operational evidence remain explicitly pending. |
