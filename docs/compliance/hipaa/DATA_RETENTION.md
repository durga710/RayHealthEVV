# RayHealth EVV — Data Retention and Disposal Policy

**Version:** 1.1
**Effective:** 2026-07-12
**Owner:** RayHealth EVV Privacy Officer / Security Officer
**Review cadence:** Annually and within 30 days of any major regulatory or architecture change

This policy defines how long RayHealth EVV retains security, operational,
and ePHI-bearing records. It supports HIPAA Security Rule documentation
retention (45 CFR §164.316(b)(2)), state home-care retention rules,
payer audit readiness, and safe disposal controls.

This is an internal operating policy, not legal advice. Covered entities
and agencies may have contract, payer, or state obligations that require
longer retention. **When rules conflict, the stricter rule wins.**

> **Authorship note.** Ported from a predecessor codebase on 2026-05-08
> and adapted to match the controls actually shipped in
> `rayhealth-evv`. The predecessor referenced separate
> `audit_revisions` and `auth_events` tables; this version routes
> everything through the single `audit_events` table.

---

## 1. Governing Principles

RayHealth follows these rules in order:

1. Legal hold or active investigation overrides normal deletion
2. Contractual or payer retention overrides platform defaults
3. State-specific healthcare retention overrides federal minimums
4. HIPAA documentation records are retained at least **6 years**
5. If multiple supported-state rules apply, keep the longer period

For multi-state operations, RayHealth uses a conservative default
retention floor of **7 years** for core client, caregiver, visit, and
EVV records unless the agency's documented policy requires longer
retention.

---

## 2. Retention Schedule

| Category | Examples (tables) | Minimum retention | Notes |
|---|---|---:|---|
| HIPAA compliance documentation | `docs/compliance/hipaa/*.md`, signed BAAs, training records, incident records | 6 years | Measured from creation or last effective date |
| Audit logs | `audit_events`, `audit_events_archive` | 7 years | RayHealth operational policy; both tables have append-only mutation triggers. The seven-year period is a risk/payer/state policy choice, not a claim that HIPAA explicitly mandates seven years of every audit event. |
| Client and clinical records | `clients`, `authorizations`, `evv_exceptions` | 7 years default | Use longer state or payer rule if required |
| EVV records | `evv_visits`, `visit_maintenance`, GPS coordinates, exception workflow | 7 years default | Never shorter than the applicable state EVV floor; `evv_visits` rows are immutable by trigger (`evv_visits_enforce_immutability_trg`) — corrections go to `visit_maintenance` |
| Caregiver records | `caregivers`, `caregiver_credentials`, `assignments`, training records | 7 years default | Some personnel subcategories may have separate labor-law rules |
| Billing and payroll records | `claims`, `claim_remittances`, `clearinghouse_remittance_files`, invoices, payroll export | 7 years | Aligns with tax and audit expectations. `clearinghouse_remittance_files` is a dedupe ledger holding filename + content sha256 + counts only — the raw 835 remittance text is not persisted at rest; parsed CLP postings live in `claim_remittances` and follow claim retention |
| Mobile session records | `mobile_sessions` | until revoked or expired, then 6 years for audit linkage | Row is the revocation handle for the bearer JWT (jti); deletion only after audit retention satisfied via the corresponding `audit_events.session.revoked` row |
| Web session records | `sessions` | until revoked or expired, then 6 years | Same logic as mobile sessions |
| Marketing/support traces | `contact_submissions`, `support_conversations` | 6 years | Free-text content visitors may type; treated as potentially PHI-bearing even when collected from anonymous visitors |
| Backups | Neon PITR window | operational only | Not the primary retention mechanism; see §5 |
| De-identified analytics | usage metrics with no PHI | up to 24 months | Delete sooner if no longer needed |

---

## 3. Supported-State Retention Floors

These are RayHealth platform floors for currently emphasized state
operations. If a customer contract, payer rule, or agency counsel requires
more, retain longer.

| State | Core record floor | Notes |
|---|---:|---|
| Pennsylvania | 7 years | Longest currently documented supported-state floor; PA is the launch state for RayHealth |
| (Other states added on rollout) |  | Update this table within 30 days of each new state launch |

Because Pennsylvania requires 7 years, RayHealth's cross-state operational
default is **7 years** for core PHI-bearing records.

---

## 4. Disposal Rules

Data may be deleted only when **all** of the following are true:

- retention period has expired
- no legal hold exists
- no open incident, audit, appeal, or payment dispute exists
- no state, payer, or customer-specific extension applies
- deletion is approved by the Privacy Officer or delegated owner

Deletion rules:

- **Do not** rewrite audit history. The `audit_events_block_mutation_trg` and
  `audit_events_archive_block_mutation_trg` triggers refuse
  UPDATE/DELETE/TRUNCATE on hot and archived evidence.
  An attempted bypass is itself a SEV-1 incident per
  `INCIDENT_RESPONSE.md` §5.3.
- **Do not** hard-delete records needed for pending claims or
  investigations.
- Log deletion or archival actions in the audit trail using an allowed event
  type such as `phi.delete` with a non-PHI payload so disposal
  itself is captured.
- Dispose of exports and local files using encrypted storage and secure
  deletion practices.

---

## 5. Backups and Restores

Backups are for resilience, not as the system of record for retention.

Current operating model:

- Neon point-in-time recovery (PITR) window — default 7 days, expandable
  on Neon's Scale tier
- Backup copies may outlive a deleted record for the duration of the
  recovery window
- Once backup retention expires, deleted data ages out naturally with
  the backup set

RayHealth does not promise instant erasure from every backup copy.
Instead:

- Primary records are deleted from active systems according to this
  policy
- Backup copies age out on the backup provider's schedule
- Restoration from backup after a deletion request requires Privacy
  Officer review

Restore procedures live in [`docs/DISASTER_RECOVERY.md`](../../DISASTER_RECOVERY.md).

---

## 6. Legal Holds

If litigation, a breach review, payer dispute, or government audit is
pending:

- Suspend deletion for affected data
- Document scope of the hold (which `agency_id`, which entity types,
  which date range)
- Identify data owners and repositories affected
- Release the hold only after written approval

Legal holds override all routine retention timers.

---

## 7. Customer Termination

When an agency ends service:

1. Confirm any contract-specific export requirement
2. Provide the requested export if contractually required (see
   `/exports/*` API routes; exports are themselves audit-logged with
   `event_type='phi.export'`)
3. Set a deletion date consistent with legal retention duties
4. Preserve `audit_events` rows, incident records, and security
   documentation for their full retention term — **never delete
   audit history early just because the agency churned**

Termination does not erase HIPAA documentation or incident records
before their required retention period ends.

---

## 8. Operational Controls

Required controls:

- documented retention schedule (this document)
- approval before destructive deletion
- audit logging for retention-related administrative actions where
  feasible (every operational delete should produce an `audit_events`
  row)
- no PHI in public issue trackers or unmanaged local notes
- quarterly review of retention exceptions and legal holds

Automation status as of 2026-07-12:

- Hot and archived audit-event immutability is defined at the database layer
  and checked by `scripts/verify-audit-triggers.mjs`
- `evv_visits` immutability is enforced at the database layer (same
  verifier)
- `.github/workflows/audit-retention.yml` schedules the seven-year audit
  archive sweep and logs each result in `audit_retention_runs`; it is not
  operational evidence until the production secret is configured and a run is
  retained
- Time-based disposal for non-audit tables is **not centralized**; legal-hold,
  payer, contract, and agency approval still require manual review before any
  destructive action

Until centralized automation exists, this policy is the controlling
standard.

---

## 9. Review and Exceptions

Any exception must be:

- documented
- time-limited
- approved by the Privacy Officer
- revisited on the next annual review

If a state launches new requirements or RayHealth expands to a new state,
update this policy within 30 days.

Authoritative references:

- [HHS HIPAA Audit Protocol — §164.316(b)(2) documentation time limit](https://www.hhs.gov/hipaa/for-professionals/compliance-enforcement/audit/protocol/index.html)
- [28 Pa. Code §601.36 — seven-year home-health clinical-record retention](https://www.pacodeandbulletin.gov/Display/pacode?d=reduce&file=%2Fsecure%2Fpacode%2Fdata%2F028%2Fchapter601%2Fs601.36.html)

---

## 10. Review Log

| Date | Reviewer | Change |
|---|---|---|
| 2026-05-07 | Founder (predecessor repo) | Initial policy authored |
| 2026-05-08 | Founder + assistant | Ported into `rayhealth-evv-clean`; replaced predecessor `audit_revisions` / `auth_events` references with the single `audit_events` table; added rows for `mobile_sessions`, `sessions`, `support_conversations`, `contact_submissions` retention; pinned the trigger verifier script path; cross-linked `INCIDENT_RESPONSE.md` and `DISASTER_RECOVERY.md` |
| 2026-07-12 | Engineering-assisted control review | Corrected the HIPAA documentation citation; set the audit-event period as a RayHealth seven-year policy; protected archived evidence from mutation; corrected the allowed deletion audit event; added the scheduled retention workflow and separated source readiness from production evidence. Pennsylvania's seven-year clinical-record rule is 28 Pa. Code §601.36(b). |
