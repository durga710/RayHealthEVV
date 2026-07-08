# RayHealth EVV HIPAA Risk Register

**Authored by Durga Ghimeray**

**Assessment date:** 2026-07-08
**Owner:** RayHealth EVV Privacy / Security Officer
**Status:** Draft control artifact; pending officer review, evidence attachment,
and signature before real PHI onboarding.

This register is the working risk analysis artifact for RayHealth EVV. It does
not, by itself, certify HIPAA compliance. Before any real Protected Health
Information (PHI) is loaded into the platform, the Privacy / Security Officer
must review each row, attach private evidence where required, approve residual
risk, and retain the signed version in the compliance vault.

## Methodology

This register follows the HIPAA Security Rule risk-analysis concept in 45 CFR
§ 164.308(a)(1)(ii)(A): identify potential risks and vulnerabilities to the
confidentiality, integrity, and availability of ePHI held by the organization.
HHS OCR guidance emphasizes that risk analysis is foundational, that the
Security Rule does not prescribe a single methodology, and that all ePHI
created, received, maintained, or transmitted is in scope.

Official references:

- HHS OCR, Guidance on Risk Analysis:
  <https://www.hhs.gov/hipaa/for-professionals/security/guidance/guidance-risk-analysis/index.html>
- HHS OCR, Summary of the HIPAA Security Rule:
  <https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html>

## Scope

In scope:

- ePHI in the web app, API, mobile app, database, audit logs, document storage,
  AI workflows, claims workflows, exports, notifications, and support/admin
  workflows.
- PHI-bearing data classes: client demographics, Medicaid identifiers, client
  service address and GPS coordinates, EVV visit records, schedules,
  assignments, authorizations, claims/remittance data, caregiver/staff
  identifiers, credential records, audit events, and support/admin prompts that
  may reference agency operations.
- Subprocessors and infrastructure: Vercel, Neon, AWS Bedrock, AWS document /
  email infrastructure, Firebase / Google Cloud, Cloudflare, and any future
  transactional email or notification processor.

Out of scope for this draft:

- Legal review of customer BAA templates.
- Third-party penetration-test findings.
- Cyber-liability insurance underwriting.
- Private signed BAA PDFs, console screenshots, access rosters, and training
  records. Those must be retained outside git.

## Scoring

| Score | Likelihood | Impact |
|---|---|---|
| Low | Unlikely under current controls | Limited operational or compliance impact |
| Medium | Plausible or control depends on manual process | Reportable operational issue or contained PHI exposure risk |
| High | Likely without additional controls, or external blocker remains | Serious PHI, audit, contractual, or availability impact |
| Critical | Could cause broad PHI exposure, major service outage, or failed audit defense | Severe business and compliance impact |

Residual risk reflects the risk after current controls, not the original threat.

## Risk Register

| ID | Risk | Inherent risk | Current controls | Residual risk | Status / next action |
|---|---|---:|---|---:|---|
| R-001 | Vendor BAA chain incomplete before real PHI flows to subprocessors | Critical | Neon BAA active with HIPAA mode; AWS BAA active; public Trust Center and policy pages state no real PHI until remaining vendor BAAs are complete | High | **Open.** Execute and retain Vercel, Google Firebase / Cloud, and Resend or replacement transactional-email BAAs before real PHI onboarding |
| R-002 | Customer BAA / agency contracting not executed before production PHI use | Critical | Public copy now states BAA execution is required before PHI processing | High | **Open.** Finalize customer BAA template and execution workflow before first production agency |
| R-003 | Formal HIPAA risk analysis not yet officer-signed | High | This draft register exists; security policy references annual review requirement | High | **Open.** Officer must review, update evidence, approve residual risk, sign, and vault the signed copy |
| R-004 | Cross-tenant PHI exposure through repository or route scoping bug | Critical | Repository patterns require `agencyId`; organization scoping documentation; route tests and focused isolation suites exist | Medium | **Open.** Run skipped DB-backed cross-tenant suites against real Postgres before real PHI |
| R-005 | PHI read/write/export occurs without a defensible audit trail | Critical | Audit middleware covers PHI-bearing reads and writes; bulk exports and AI actions have fail-closed audit paths; audit table mutation trigger; audit health probe | Medium | **Mitigate.** Add dedicated monitoring/alerting for audit-write failures before PHI |
| R-006 | Authenticated route identifiers leak to non-BAA analytics provider | High | `dropAuthenticatedEvents` drops authenticated SPA routes; `security:scan` now guards the Analytics `beforeSend` mount | Low | **Mitigated in code.** Reassess after Vercel BAA execution or analytics changes |
| R-007 | AI prompt or response routes PHI to a non-BAA model provider | Critical | AWS Bedrock only; no non-BAA fallback; production rejects Gemini/OpenAI keys; prompts are PHI-minimized; transcript text is not retained for admin assistant | Low | **Mitigated in code.** Reverify AWS BAA and model configuration annually |
| R-008 | Database snapshot exposes PHI because not all PHI fields are application-encrypted | High | Medicaid IDs and caregiver NPIs use AES-256-GCM application-layer encryption; Neon storage encryption under active BAA / HIPAA mode for remaining fields | Medium | **Accepted pending officer approval.** Keep evidence in vault and reassess whether additional field encryption is warranted |
| R-009 | Mobile device loss exposes caregiver session or cached PHI | High | Expo SecureStore for auth token storage; no offline PHI visit cache currently committed | Medium | **Mitigate.** Add mobile device/security policy before agency rollout; reassess if offline PHI cache ships |
| R-010 | Production outage, database issue, or failed deploy interrupts EVV operations | High | Vercel deploys from source; Neon PITR; disaster-recovery runbook; scheduled health/db/audit smoke workflow; restore-rehearsal template exists | Medium | **Open.** Execute restore rehearsal, document RTO/RPO evidence, and add dedicated uptime alerting before PHI |
| R-011 | Admin or operator credential compromise | High | HttpOnly cookie sessions; CSRF; console MFA expectations; encrypted Vercel env vars; bootstrap secret disabled after first admin; workforce access roster/procedure template exists | Medium | **Mitigate.** Complete private roster entries, enforce least privilege, and document quarterly access reviews |
| R-012 | Unremediated application vulnerability before launch | High | Unit/integration tests; security surface scanner; dependency overrides; public support/admin AI hardened | High | **Open.** Complete independent penetration test and remediation before real PHI |
| R-013 | Incident-response plan is drafted but not rehearsed | High | Incident response plan, tabletop template, and monitoring runbook exist; production smoke workflow captures baseline signals | High | **Open.** Run tabletop exercise, assign contacts, and preserve exercise evidence before real PHI |
| R-014 | Notification or email payload discloses PHI through a pending or misconfigured vendor | High | Firebase push payloads are designed to avoid PHI; BAA tracker keeps Google and Resend/replacement email processor as pending | Medium | **Open.** Keep PHI out of notification/email payloads until BAA and payload review are complete |
| R-015 | Secrets, access keys, BAA PDFs, or private compliance evidence are committed to git | High | `.env` ignored; examples contain blanks; security docs warn not to record key IDs or BAA PDFs; previous key exposure was documented as compromised | Medium | **Mitigate.** Add periodic secret scanning and keep private evidence in vault only |

## Required Approvals Before Real PHI

- [ ] Privacy / Security Officer reviewed every risk row.
- [ ] Residual risks accepted or assigned remediation owners.
- [ ] Remaining vendor BAAs executed and stored in the private vault.
- [ ] Customer BAA template approved and ready for execution.
- [ ] Third-party penetration test completed and critical/high findings
  remediated.
- [ ] Restore rehearsal completed and evidence retained.
- [ ] Incident-response tabletop completed and evidence retained.
- [ ] Workforce access roster completed with real private entries and training
  records.
- [ ] DB-backed cross-tenant isolation tests run against real Postgres.

## Review Log

| Date | Reviewer | Change |
|---|---|---|
| 2026-07-08 | Founder + assistant | Initial draft risk register created from current repo controls, audit reports, and HHS OCR risk-analysis guidance. |
