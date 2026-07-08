# RayHealth EVV - Production Monitoring Runbook

**Authored by Durga Ghimeray**

**Effective:** 2026-07-07

This runbook documents the production monitoring signal that exists in this repo and the operator actions expected when it fails.

## Monitoring Sources

| Signal | Source | Expected result |
|---|---|---|
| Liveness | `GET /api/health` | HTTP 200, `status=ok` |
| Database readiness | `GET /api/health/db` | HTTP 200, `status=ok` |
| Audit pipeline freshness | `GET /api/health/audit` | HTTP 200, `status=ok`, `stale`, or `empty`; `stale`/`empty` raise warnings |
| Scheduled smoke | `.github/workflows/production-smoke.yml` | Runs every 15 minutes and on manual dispatch |

The workflow defaults to `https://rayhealthevv.com`. To test another production origin, set the repository variable `RAYHEALTH_PROD_ORIGIN`.

## Alert Path

GitHub Actions failures are the first automated alert. Repository maintainers should enable failed-workflow notifications for this repository. A failed scheduled run means the operator should open an incident note and triage using this runbook plus [`DISASTER_RECOVERY.md`](DISASTER_RECOVERY.md) and [`compliance/hipaa/INCIDENT_RESPONSE.md`](compliance/hipaa/INCIDENT_RESPONSE.md).

## Triage

1. Open the failed `production-smoke` workflow run and identify which probe failed.
2. Manually re-run the failed probe:

   ```bash
   curl -i https://rayhealthevv.com/api/health
   curl -i https://rayhealthevv.com/api/health/db
   curl -i https://rayhealthevv.com/api/health/audit
   ```

3. If `/api/health` fails, check Vercel deployment status and recent deploys.
4. If `/api/health/db` fails, check Neon status, database connection env vars, and recent migrations.
5. If `/api/health/audit` is `stale` or `empty`, inspect recent `audit_events` rows before assuming an outage; a quiet synthetic-only environment can legitimately produce a warning.
6. If two consecutive scheduled runs fail or any PHI-facing workflow is affected, treat the event as SEV-2 or higher under the incident-response plan.

## Evidence to Preserve

- Failed workflow URL
- Probe response body and headers
- Vercel deployment ID and commit SHA
- Neon status or support ticket if database readiness failed
- Any related `audit_events` anomalies

## Known Limitations

- GitHub Actions cron is not a dedicated paging system; it provides a baseline alertable signal, not guaranteed minute-level monitoring.
- The audit freshness probe warns instead of failing on `stale` or `empty` because pre-PHI demo environments may have quiet periods.
- Before real PHI onboarding, add a dedicated uptime/incident vendor with contractual notification guarantees and documented escalation contacts.
