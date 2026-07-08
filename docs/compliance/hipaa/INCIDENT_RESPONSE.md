# RayHealth EVV — HIPAA Incident Response Plan

**Authored by Durga Ghimeray**

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** RayHealth EVV Privacy Officer / Security Officer
**Review cadence:** Annually, after any material incident, and within 30 days of any major architecture change

This runbook governs suspected or confirmed security incidents involving
RayHealth EVV systems, especially any event that may affect electronic
Protected Health Information (ePHI). It supports the HIPAA Security Rule
(45 CFR §164.308(a)(6)) and the Breach Notification Rule (45 CFR
§164.400-414).

This is an operational document, not legal advice. When the incident may
involve regulated data, breach notice, state reporting, or law enforcement,
engage counsel immediately.

> **Authorship note.** Ported from a predecessor codebase on 2026-05-08
> and adapted to match the controls actually shipped in
> `rayhealth-evv-clean`. Where the prior version referenced separate
> `audit_revisions` / `auth_events` tables, this version routes everything
> through the single `audit_events` table that is present in this repo.
> See §13 review log.

---

## 1. Scope

This plan applies to:

- Unauthorized access to PHI or credentialed systems
- Suspected tenant-isolation failures (cross-agency data exposure)
- Audit-log tampering attempts
- Database exfiltration or corruption
- Lost or stolen caregiver / admin devices with RayHealth access
- Push notification or email misdelivery involving PHI
- AI prompt or response handling that may expose PHI to a non-BAA vendor
- Ransomware, malware, insider misuse, or third-party vendor incidents

Systems in scope:

- `rayhealthevv.com` web app and API (Vercel project `rayhealth-evv-platform-app`)
- Mobile caregiver app (Expo / React Native / Expo Router, package `packages/mobile`)
- AWS Bedrock-backed AI inference (`/api/support/chat`, `/api/admin-assistant/chat`)
- Neon Postgres (project `late-art-87716813`)
- Cloudflare edge (DNS + TLS termination)
- Firebase messaging / auth components
- Resend transactional email flows

---

## 2. Roles

Until RayHealth has a larger workforce, one person may hold multiple roles.

- **Incident Commander:** directs the response, sets severity, approves recovery
- **Technical Lead:** investigates systems, coordinates containment and fixes
- **Privacy Officer:** assesses PHI exposure and notice obligations
- **Communications Lead:** handles customer, vendor, and internal messaging
- **Recorder:** keeps a timestamped incident log and evidence index

For any material incident, assign named people to each role at the start of
the response and record them in the incident log.

---

## 3. Severity Levels

### SEV-1

Confirmed or strongly suspected:

- active PHI disclosure
- production credential compromise
- cross-agency data exposure (tenant-isolation breach)
- destructive production data loss
- ransomware or persistence on production systems

**Response target:** begin containment immediately, within 15 minutes.

### SEV-2

Likely security incident with meaningful risk but no confirmed broad PHI
exposure yet:

- suspicious admin login
- failed authorization guard affecting protected routes
- vendor outage causing unsafe fallback behavior
- audit logging failure

**Response target:** begin containment within 30 minutes.

### SEV-3

Low-confidence or low-impact event:

- suspicious but unconfirmed behavior
- isolated user report
- vulnerability with no evidence of exploitation

**Response target:** same business day.

---

## 4. Detection Sources

Potential incident signals include:

- `audit_events` table (`event_type` IN `'auth.login.success'`,
  `'auth.login.failure'`, `'phi.read'`, `'phi.create'`, `'phi.update'`,
  `'phi.export'`, `'permission.denied'`, `'session.revoked'`)
- Vercel runtime logs and error spikes
- Neon, AWS, Firebase, Cloudflare, Resend vendor alerts
- Production rate-limit anomalies (`express-rate-limit` 429 spikes on
  `/auth/login`, `/auth/mobile/login`, `/auth/bootstrap`)
- Customer or workforce reports
- CI/CD or migration anomalies affecting auth, audit, or access controls

If an alert may involve PHI, treat it as SEV-2 or higher until disproven.

---

## 5. First 15 Minutes

### 5.1 Start the Incident Record

Create a private incident note containing:

- incident ID
- UTC discovery time
- reporter
- suspected systems
- suspected agencies or users affected
- current severity
- assigned roles

Do **not** store raw PHI in the incident title or in external chat tools.

### 5.2 Contain Fast

Take the narrowest action that stops harm:

- revoke or rotate compromised credentials in Vercel (`/v9/projects/{id}/env`)
- disable the affected user account in `users` (set `password_hash` to a
  rotation sentinel and revoke all rows in `mobile_sessions` for that user)
- force re-authentication by deleting the relevant rows in `mobile_sessions`
  (mobile JWT) and `sessions` (web cookie); the bearer-JWT path rejects
  tokens whose `jti` is no longer in `mobile_sessions`
- disable a vulnerable route by deploying a guard or removing the route
  mount in `packages/app/src/app.ts`
- pause Resend or Firebase delivery if messages may leak PHI
- put the app or a workflow into read-only mode if integrity is uncertain

### 5.3 Protect the Audit Trail

Immediately preserve:

- relevant rows from `audit_events` (filter by `agency_id`, `entity_id`,
  or `actor_id`)
- production deployment identifier (`x-vercel-id` response header) and
  commit hash from `git rev-parse HEAD`
- vendor alert emails
- screenshots, log excerpts, and timestamps

If log tampering is suspected, run the trigger verifier:

```bash
DATABASE_URL=… node scripts/verify-audit-triggers.mjs
```

A non-zero exit means either the `audit_events_block_mutation_trg` or
`evv_visits_enforce_immutability_trg` trigger has been removed or altered.
That itself is a SEV-1 — escalate immediately.

### 5.4 AI-Specific Containment

If the incident involves AI prompts, PHI in inference, or provider routing:

- disable the affected AI surface by removing its mount in `app.ts` and
  redeploying, or by unsetting `AWS_REGION` (which trips
  `bedrockConfigured()` returning `false` and forces both endpoints to 503)
- verify the active provider is Bedrock (the only configured provider in
  this repo — there is no fallback chain; if you see a non-Bedrock call
  in logs, that's a code regression to roll back)
- confirm the AWS BAA is still active in AWS Artifact
- preserve request metadata without copying raw PHI into external tooling

---

## 6. Investigation (15 Minutes to 4 Hours)

Answer these questions in order:

1. What happened?
2. When did it start?
3. Is it still happening?
4. What data types are involved?
5. Which agencies, users, and records are affected?
6. Was PHI actually viewed, acquired, altered, or disclosed?
7. Did the incident cross a vendor boundary (Vercel → Neon →
   Bedrock → Cloudflare → Firebase → Resend)?
8. Are state-specific notification rules implicated?

Minimum investigation steps:

- identify the exact route, job, query, or vendor event involved
- verify agency scoping by re-running the offending query with the suspect
  `agency_id` and confirming the result set is what you expected
- inspect related `audit_events` rows: `event_type='auth.login.failure'`,
  `event_type='permission.denied'`, anomalous `phi.read`/`phi.export`
  patterns
- compare expected vs actual tenant IDs and user roles in the JWT claims
  vs the audit row
- confirm whether encrypted column data (`clients.medicaid_number`,
  `caregivers.npi`) was accessed; encrypted ciphertext exfiltration is
  still a notice-triggering event under HHS guidance unless the
  encryption key was guaranteed not to be co-exposed
- confirm whether the issue affected production only, or also preview/dev

For AI-related events, document:

- model ID actually invoked (default
  `us.anthropic.claude-haiku-4-5-20251001-v1:0`)
- prompt category (anonymous marketing chat vs admin assistant)
- whether PHI was present in the prompt
- whether a non-BAA vendor was called (this should be impossible by code;
  if it happened, it's a SEV-1 code regression)
- whether the AWS BAA was active at the time

---

## 7. Breach Assessment and Notification

The Privacy Officer, with counsel as needed, determines whether the event
is a reportable breach.

Use a written breach assessment that addresses:

- the nature and extent of the PHI involved
- the unauthorized person who used or received the PHI
- whether the PHI was actually acquired or viewed
- the extent to which the risk was mitigated

Baseline federal rule:

- HIPAA breach notices must be made without unreasonable delay and no
  later than **60 days** after discovery (45 CFR §164.404(b))
- For breaches affecting 500 or more individuals, also notify HHS and
  prominent media outlets in the affected state without unreasonable
  delay

State law or contract may be stricter. For RayHealth-supported states,
apply the **stricter** of state, payer, contract, or federal requirements.

If a vendor incident is involved:

- notify the affected agency without unreasonable delay
- preserve the vendor ticket number and response timeline
- confirm whether the vendor will assist with notice language or
  impact-scope determination per the BAA

---

## 8. Recovery

Recovery begins only after containment is stable.

Required recovery checks:

- patch deployed and verified (`curl https://rayhealthevv.com/api/health`
  returns 200 + `{"ok":true}`)
- session repository revocations applied (`mobile_sessions` rows deleted
  for affected users; cookie `sessions` rows revoked)
- risky feature flag or route remains disabled until validated
- audit logging functioning (`scripts/verify-audit-triggers.mjs` exits 0)
- agency scoping functioning (manually run a test query for the suspect
  `agency_id` and confirm result set is bounded as expected — the
  authoritative reference is `docs/security/ORGANIZATION_SCOPING_SECURITY.md`)
- no additional anomalous access events after remediation
- caregiver-facing workflows tested before reopening (use a synthetic
  test fixture account — never real PHI in a recovery test)

If production data integrity is uncertain, use the procedures in
[`docs/DISASTER_RECOVERY.md`](../../DISASTER_RECOVERY.md): prefer Neon
branch restore or point-in-time restore over a full schema rollback.

---

## 9. Communications

### Internal

Use private channels only. Never post PHI in:

- GitHub issues
- public chat channels
- incident titles
- vendor support tickets unless required and approved

### Customers / Agencies

Use clear, factual language:

- what happened
- what data categories may be involved
- what RayHealth has already done
- what the agency should do next
- when the next update will arrive

### Vendors

Open vendor tickets when their systems may be involved:

- Vercel — `support@vercel.com` or in-console ticket
- Neon — `support@neon.tech`
- AWS — Trust & Safety / Compliance (via the AWS Console)
- Cloudflare — `support@cloudflare.com`
- Firebase / Google — via Google Cloud Console support
- Resend — `support@resend.com`

Record:

- ticket ID
- submission time
- responder
- promises or deadlines given

---

## 10. Post-Incident Review

Within 5 business days of closure:

- finalize the timeline
- identify root cause
- identify detection gap
- identify control gap
- list corrective actions with owners and dates
- update `SECURITY_POLICY.md`, `DATA_RETENTION.md`, or related docs if
  needed

If the incident revealed PHI risk in AI routing, fallback behavior,
mobile storage, or auditability, open a tracked remediation item
immediately. Policy must not claim the gap is solved until the code and
verification are complete.

---

## 11. Minimum Evidence to Keep

Retain these artifacts with the incident record:

- incident log and timeline
- exported `audit_events` rows (CSV or JSON dump scoped to the affected
  `agency_id` / `entity_id`)
- deployment identifier (`x-vercel-id`) and commit SHA at the time of the
  event
- screenshots and relevant headers
- remediation commits or PR links
- vendor correspondence
- final breach assessment
- notice records, if notices were sent

Retain incident documentation for **at least 6 years** (HIPAA §164.530(j)).

---

## 12. Quick Checklist

- [ ] Assign severity and roles
- [ ] Start the incident log
- [ ] Contain affected access or feature
- [ ] Preserve evidence (export `audit_events` rows now, before they age out
      of working memory — they're append-only so you can re-export later,
      but pulling now is cheaper)
- [ ] Run `scripts/verify-audit-triggers.mjs` if log tampering suspected
- [ ] Review `audit_events` for `auth.login.failure`, `permission.denied`,
      anomalous `phi.read`/`phi.export` patterns
- [ ] Assess whether PHI is involved
- [ ] Determine vendor involvement
- [ ] Decide whether notice obligations are triggered
- [ ] Deploy fix and verify
- [ ] Complete post-incident review

---

## 13. Review Log

| Date | Reviewer | Change |
|---|---|---|
| 2026-05-07 | Founder (predecessor repo) | Initial plan authored |
| 2026-05-08 | Founder + assistant | Ported into `rayhealth-evv-clean`; replaced predecessor `audit_revisions` / `auth_events` references with the single `audit_events` table that ships in this repo; pinned the trigger verifier script path; added Cloudflare to subprocessor list; pinned the active Bedrock model ID; cross-referenced `ORGANIZATION_SCOPING_SECURITY.md` for tenant-isolation recovery checks |
| 2026-07-07 | Founder + assistant | Corrected the mobile scope from a predecessor Capacitor project to the current `packages/mobile` Expo / React Native app. |
