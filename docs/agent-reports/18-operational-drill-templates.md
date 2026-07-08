# Agent 18 - Operational Drill Templates

**Authored by Durga Ghimeray**

## Scope

Added reusable templates for restore rehearsal and incident-response tabletop
execution. These templates help close the evidence gap, but they do not claim
the drills have already been run.

## Changes Completed

- Added `docs/compliance/hipaa/OPERATIONAL_DRILLS.md` with restore-rehearsal
  and incident-response tabletop templates.
- Linked the restore rehearsal template from `docs/DISASTER_RECOVERY.md`.
- Linked the tabletop template from `docs/compliance/hipaa/INCIDENT_RESPONSE.md`.
- Updated `RISK_REGISTER.md` so restore and incident-response risks reflect
  that templates now exist while execution evidence remains open.

## Verification

- Stale-drill wording sweep found no remaining `RISK_REGISTER.md` "when
  authored" wording.
- `git diff --check` passed, with Windows LF-to-CRLF warnings only.

## Remaining

- The Privacy / Security Officer must run the restore rehearsal and tabletop,
  retain private evidence, record actual outcomes, and update the risk register
  if residual risk changes.
