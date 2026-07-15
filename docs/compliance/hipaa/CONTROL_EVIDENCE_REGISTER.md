# RayHealth EVV — Control Evidence Register

**Version:** 1.0
**Effective:** 2026-07-12
**Owner:** Privacy Officer / Security Officer

This register says what evidence must exist and when. Actual screenshots,
exports, signed agreements, access lists, incident notes, secrets, and PHI stay
in the private compliance vault—not Git. Use opaque IDs such as
`CE-2026-Q3-ACCESS-01` in this file and in the vault.

| Control | Cadence / trigger | Minimum evidence | Source check | Current status |
|---|---|---|---|---|
| Audit and EVV immutability | Nightly; after schema change; during relevant incident | Passing workflow/run ID showing all configured catalog and live probes | `scripts/verify-audit-triggers.mjs` | Workflow exists; production secret/run confirmation required |
| Audit retention | Nightly | `audit_retention_runs` success row and Actions run ID; quarterly review of errors and legal holds | `.github/workflows/audit-retention.yml`; `/admin/audit-retention/status` | Workflow source ready; production secret/run confirmation required |
| Mobile session revocation | Every mobile release | Token `jti`, active session row, successful logout, replay rejected with 401 | Mobile session lifecycle tests | Source verified; production smoke pending |
| Access review | Quarterly and on workforce change | Console/user export for Vercel, Neon, AWS, Google, Resend, GitHub; reviewer sign-off; removals | `WORKFORCE_ACCESS.md` | First signed review pending |
| BAA/subprocessor review | Quarterly and before vendor receives ePHI | Executed agreement ID/date or documented non-applicability decision; covered-service list | `BAA_REQUEST_EMAILS.md`; Security Policy §10 | AWS recorded active; remaining reviews pending |
| Risk analysis | Annually and after material change | Signed assessment, updated scores/treatments, architecture/data-flow inventory | `RISK_REGISTER.md` | Initial register complete; formal signed review pending |
| Disaster recovery | Annually and after material recovery change | Restore timestamp, measured RTO/RPO, trigger verification, synthetic EVV smoke, lessons/actions | `docs/DISASTER_RECOVERY.md` | Drill pending |
| Incident response | Annual tabletop and after every incident | Scenario/timeline, assigned roles, decisions, notifications assessment, corrective actions | `INCIDENT_RESPONSE.md` | Tabletop pending |
| Encryption review | Every release affecting storage/auth; annually otherwise | Code/runtime evidence, vendor documentation/BAA references, key-rotation confirmation | `ENCRYPTION_VERIFICATION.md` | Source review updated; vendor evidence pending |
| Release security gate | Every production candidate | Commit SHA and passing lint, typecheck, tests, builds, security scan; store release check for mobile | `npm run check`; mobile `release:check` | Automated source gate active |
| Retention exceptions/legal holds | Quarterly and on new hold | Hold ID, scope, approver, start/review/release dates; no PHI in the register | `DATA_RETENTION.md` | First review pending |

## Evidence entry template

```text
Evidence ID:
Control:
UTC date/time:
Reviewer:
Environment/system:
Procedure performed:
Result (pass/fail/exception):
Related commit/deployment/run ID:
Private-vault location:
Follow-up owner and due date:
```

An unchecked box or an automated workflow file is not evidence by itself. The
evidence is the dated result, reviewer, environment, and retained artifact.
