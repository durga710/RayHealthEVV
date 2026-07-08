# RayHealth EVV Operational Drill Templates

**Authored by Durga Ghimeray**

**Effective:** 2026-07-08
**Owner:** RayHealth EVV Privacy / Security Officer
**Status:** Drill templates only. Restore and incident-response exercises are
not complete until the officer executes the drills, stores evidence in the
private compliance vault, and records outcomes in the review log.

## Purpose

This document gives RayHealth EVV repeatable templates for two operational
controls that must be exercised before real PHI onboarding:

- disaster-recovery restore rehearsal
- incident-response tabletop rehearsal

Official reference:

- HHS OCR, Summary of the HIPAA Security Rule:
  <https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html>

## Evidence Rules

- Do not use real PHI in drills.
- Use a synthetic tenant and synthetic caregiver/client records.
- Store screenshots, exports, vendor tickets, and signed attestations in the
  private compliance vault, not git.
- Record only non-sensitive summaries in this repository.
- If a drill uncovers a production risk, create a remediation ticket and add or
  update the relevant row in `RISK_REGISTER.md`.

## Restore Rehearsal Template

Target cadence: annually before the audit cycle, and after any material
database architecture change.

### Pre-Drill Plan

| Field | Value |
|---|---|
| Drill ID | `DR-YYYY-MM-DD-01` |
| Date / time | `YYYY-MM-DD HH:MM UTC` |
| Facilitator | `[Name]` |
| Systems in scope | Neon project `late-art-87716813`, Vercel project `rayhealth-evv-platform-app`, synthetic tenant |
| Restore target | `[timestamp / branch / backup primitive]` |
| Expected RTO | 4 hours |
| Expected RPO | 5 minutes for Neon PITR scenario |
| Evidence vault path | `[Private location]` |

### Execution Checklist

- [ ] Confirm the test uses synthetic-only data.
- [ ] Capture the current production deployment SHA and Vercel deployment ID.
- [ ] Create or identify the Neon branch/snapshot used for the rehearsal.
- [ ] Restore to a point in time on a non-production branch.
- [ ] Connect the app or verification scripts to the restored branch.
- [ ] Run audit-trigger verification against the restored branch.
- [ ] Run one synthetic EVV cycle: mobile login, clock-in, clock-out, logout.
- [ ] Verify `GET /api/health`, `/api/health/db`, and `/api/health/audit`.
- [ ] Record actual RTO/RPO observed.
- [ ] Record failures, surprises, or manual steps that need automation.
- [ ] Return all test configuration to normal and remove temporary credentials.

### Outcome Record

| Field | Result |
|---|---|
| Drill ID | `DR-YYYY-MM-DD-01` |
| Completed by | `[Name]` |
| Actual RTO | `[Duration]` |
| Actual RPO | `[Duration / data-loss window]` |
| Audit verifier result | `Pass/Fail` |
| Synthetic EVV result | `Pass/Fail` |
| Health probes result | `Pass/Fail` |
| Evidence vault path | `[Private location]` |
| Remediation tickets | `[Links / IDs]` |
| Officer signoff | `[Name, date]` |

## Incident-Response Tabletop Template

Target cadence: annually before the audit cycle, after a material incident, and
after material architecture changes affecting PHI, audit logging, AI routing,
or subprocessor flow.

### Scenario Options

Choose one scenario per tabletop:

| Scenario | What it tests |
|---|---|
| Cross-tenant disclosure report | Tenant isolation investigation, audit-event review, customer communication |
| Lost caregiver device | Mobile session revocation, token handling, client notification assessment |
| Vendor alert involving logs | Subprocessor escalation, BAA chain, evidence preservation |
| AI prompt PHI concern | Bedrock-only routing, transcript retention, audit trail, containment |
| Bad migration corrupts EVV data | Incident command, Neon restore, audit-trigger verification |

### Roles

| Role | Assigned person |
|---|---|
| Incident Commander | `[Name]` |
| Technical Lead | `[Name]` |
| Privacy Officer | `[Name]` |
| Communications Lead | `[Name]` |
| Recorder | `[Name]` |
| Counsel / advisor | `[Name or N/A]` |

### Exercise Checklist

- [ ] Start a private incident record with synthetic-only facts.
- [ ] Assign roles and severity.
- [ ] Identify affected systems, data classes, agencies, and users.
- [ ] Select containment actions and expected owner for each action.
- [ ] Identify evidence to preserve from audit events, Vercel, Neon, AWS,
  Firebase / Google Cloud, Cloudflare, and email/notification vendors.
- [ ] Decide whether counsel is required.
- [ ] Walk through breach-assessment factors without making a legal conclusion
  in git.
- [ ] Draft customer/internal communication summaries without PHI.
- [ ] Identify policy, code, monitoring, or vendor gaps.
- [ ] Assign remediation owners and due dates.

### Outcome Record

| Field | Result |
|---|---|
| Exercise ID | `IR-TT-YYYY-MM-DD-01` |
| Scenario | `[Selected scenario]` |
| Date / duration | `[Date, duration]` |
| Severity tested | `SEV-1/SEV-2/SEV-3` |
| Roles assigned | `Complete/Incomplete` |
| Evidence preservation tested | `Pass/Fail` |
| Containment path tested | `Pass/Fail` |
| Communication path tested | `Pass/Fail` |
| Gaps found | `[Summary]` |
| Remediation tickets | `[Links / IDs]` |
| Evidence vault path | `[Private location]` |
| Officer signoff | `[Name, date]` |

## Review Log

| Date | Reviewer | Change |
|---|---|---|
| 2026-07-08 | Founder + assistant | Initial restore-rehearsal and incident-response tabletop templates created. |
