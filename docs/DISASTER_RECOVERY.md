# RayHealth EVV — Disaster Recovery Runbook

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** RayHealth EVV Security Officer
**Review cadence:** Annually + after any material architecture change

This runbook is the procedure for restoring `rayhealthevv.com` after a
data-loss, corruption, or compute-layer outage event. It fulfills HIPAA
§164.308(a)(7) (Contingency Plan) and is referenced by
`INCIDENT_RESPONSE.md` §8.

**RTO target:** 4 hours for full production restore from cold backup.
**RPO target:** 5 minutes (Neon WAL-based PITR).

---

## 1. Architecture Recap

| Layer | Vendor | Identifier |
|---|---|---|
| DNS + edge TLS | Cloudflare | zone `rayhealthevv.com` |
| Compute (web app + API + serverless) | Vercel | project `rayhealth-evv-platform-app` (id `prj_Y0bFZJZND68I4eBeBfE2oqCzo5OG`) |
| Postgres database | Neon | project `late-art-87716813`, default branch + read-write compute |
| AI inference | AWS Bedrock | model `us.anthropic.claude-haiku-4-5-20251001-v1:0`, region `us-east-1` |
| Push + auth | Firebase | project `rayhealthevv` |
| Transactional email | Resend | sending domain `send.rayhealthevv.com` |

Code lives in GitHub: `github.com/durga710/rayhealth-evv-platform`. Vercel
deploys on push to `main`. Pre-built `dist/` artifacts are committed so
Vercel skips the build step (`vercel.json` `buildCommand` is a no-op).

---

## 2. Failure Modes

| Failure | Likely cause | Recovery primitive |
|---|---|---|
| Bad code deploy (logic regression) | Recent commit broke something | Vercel rollback to previous deploy |
| Bad migration / data corruption | Schema or data write went wrong | Neon PITR (point-in-time restore) |
| Compute outage | Vercel region failure | Vercel multi-region edge handles automatically; if the function layer is hard-down, see §3.3 |
| DNS / edge outage | Cloudflare incident | Switch nameservers to Vercel's nameservers (kept on file) |
| Database hard loss | Neon project deleted or unrecoverable | Restore from Neon's nightly internal backups (compliance ticket); RPO ≈ 24h in this scenario |
| AI provider outage | Bedrock down | Both AI endpoints return 502; non-blocking — marketing chat shows "currently offline" message; admin assistant errors gracefully |

---

## 3. Recovery Procedures

### 3.1 Roll back a bad deploy (RTO ≈ 5 minutes)

If the latest deploy broke something but the database is fine:

```bash
# Find the last known-good production deployment
curl -sH "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v6/deployments?projectId=prj_Y0bFZJZND68I4eBeBfE2oqCzo5OG&target=production&limit=5" \
  | jq '.deployments[] | {uid,state,url,sha:.meta.githubCommitSha,createdAt}'

# Promote a prior deployment to production
curl -sH "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
  -X POST -d "{\"name\":\"rayhealth-evv-platform-app\",\"deploymentId\":\"<known-good-uid>\",\"target\":\"production\"}" \
  https://api.vercel.com/v13/deployments
```

Or via Vercel UI: project → Deployments → pick the green checkmark
deploy → ⋯ → "Promote to Production".

Verify after rollback:

```bash
curl -s https://rayhealthevv.com/api/health   # expect {"ok":true,"ts":...}
node scripts/verify-audit-triggers.mjs        # expect ✓ all checks passed
```

### 3.2 Neon point-in-time restore (RTO ≈ 30 minutes, RPO ≤ 5 minutes)

If a migration or accidental DELETE corrupted production data:

1. **Identify the timestamp** to restore to (UTC, ISO-8601). Pick the
   latest moment **before** the bad write. Example: corruption began at
   `2026-05-09T03:14:22Z`, restore to `2026-05-09T03:13:55Z`.
2. **Open Neon Console** → project `late-art-87716813` → Branches →
   default branch → "Restore to a point in time".
3. **Two restore strategies:**
   - **Branch-restore (preferred):** Create a *new branch* from the
     timestamp. Inspect it via a temporary connection string. If it
     looks correct, swap the production endpoint to point at the new
     branch (Branches → Swap parent / Set primary).
   - **In-place restore:** Replace the default branch state. **Destroys
     data written since the target timestamp.** Only use if the
     branch-restore strategy isn't viable.
4. **Re-verify auditing** after restore:
   ```bash
   DATABASE_URL=… node scripts/verify-audit-triggers.mjs
   ```
   Triggers should still be present (they're part of the schema captured
   in WAL).
5. **Document the restore** in the incident record per
   `INCIDENT_RESPONSE.md` §11.

### 3.3 Compute hard-down (Vercel region failure)

Vercel runs production in `iad1` (per `x-vercel-id` header). If `iad1`
is fully down:

1. Check Vercel status: <https://www.vercel-status.com>
2. If only one region is affected, Vercel multi-region typically
   reroutes automatically — wait 5 minutes and re-test.
3. If Vercel is hard-down across all regions, there is no failover
   target today. The platform is effectively offline. Communicate to
   agencies via email (Resend) and the marketing-site `/status` page
   (which is statically generated and may still be served by Cloudflare
   cache).
4. **Future-proofing:** alternative compute target (e.g. Fly.io standby)
   is roadmap; not implemented today.

### 3.4 DNS / edge outage (Cloudflare)

If Cloudflare is the cause:

1. Verify origin reachability bypassing Cloudflare:
   ```bash
   curl -s -H "Host: rayhealthevv.com" https://rayhealth-evv-platform-app.vercel.app/api/health
   ```
   If this returns 200, the origin is fine and the issue is DNS/edge.
2. **Switch nameservers** at the registrar to Vercel's nameservers.
   Vercel will pick up the records and serve directly.
3. After Cloudflare recovers, switch nameservers back and re-attach the
   domain in the Cloudflare dashboard.

### 3.5 Neon hard loss (project deleted or unrecoverable)

This is the worst-case scenario. Neon's PITR window covers ~7 days; if
loss occurred more than 7 days ago and wasn't caught, the situation
becomes a Neon support escalation.

1. Open a Neon support ticket immediately (`support@neon.tech`).
   Reference the BAA at `docs/compliance/hipaa/BAA_REQUEST_EMAILS.md` §2.
2. Neon retains internal backups beyond the PITR window for compliance
   purposes. Recovery from those is a manual ops process; expect 12–48
   hours.
3. **In parallel:** notify affected agencies per `INCIDENT_RESPONSE.md`
   §7 (this is a SEV-1 with potential breach implications because
   agencies cannot access their own ePHI during the outage).
4. Once restored, run the full re-verification checklist from §5 below.

---

## 4. Backup Strategy

| Asset | Backup mechanism | Recovery window |
|---|---|---|
| Code | GitHub `main` branch + tags | Forever (Git history) |
| Schema migrations | `packages/core/src/migrations/schema.ts` (single idempotent file in repo) | Same as code |
| Database WAL | Neon PITR | 7 days (default), 30 days (Scale tier) |
| Database internal | Neon nightly backups | per Neon retention policy |
| Pre-built `dist/` artifacts | Committed to repo | Same as code |
| Vercel env vars | Manually exported quarterly to encrypted password manager | up to one quarter old in worst case |
| Mobile app source | `packages/mobile` in this monorepo; Expo/EAS release metadata is versioned beside it | Same as code |

**Quarterly env var export (manual procedure):**

```bash
curl -sH "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects/prj_Y0bFZJZND68I4eBeBfE2oqCzo5OG/env?decrypt=true" \
  > rayhealth-env-$(date +%Y%m%d).json
# Encrypt and store in 1Password / Bitwarden vault. NEVER commit.
gpg -e -r security@rayhealthevv.com rayhealth-env-*.json && rm rayhealth-env-*.json
```

---

## 5. Post-Recovery Verification

After any recovery action:

- [ ] `curl https://rayhealthevv.com/api/health` returns `{"ok":true}`
- [ ] `curl -X POST https://rayhealthevv.com/api/auth/mobile/login` with
      a valid caregiver returns a JWT
- [ ] `node scripts/verify-audit-triggers.mjs` exits 0 (all configured hot-audit, archived-audit, and EVV checks pass)
- [ ] `audit_events` row count is reasonable (not zero — that would mean
      a partial restore that lost the audit trail)
- [ ] At least one full EVV cycle (login → clock-in → clock-out → logout)
      against a **synthetic** test account, never real PHI
- [ ] AI assistants respond to a probe: `POST /api/support/chat` returns
      a real Bedrock response (not 502)
- [ ] If restore involved `evv_visits` data: confirm
      `evv_visits_enforce_immutability_trg` still rejects mutations on
      a real-row probe
- [ ] Document the recovery in the incident record per
      `INCIDENT_RESPONSE.md` §11

---

## 6. Communication During an Outage

- **Status page:** update `/status` (statically generated; edit
  `packages/web/src/features/marketing/StatusPage.tsx` and redeploy if
  Vercel is reachable; if not, post a banner via Cloudflare Workers as
  a manual fallback)
- **Email customers:** use Resend with a pre-drafted template (see
  `docs/RUNBOOK_DEPLOY.md` for the message bank)
- **Internal:** record every action in the incident log per
  `INCIDENT_RESPONSE.md` §5.1

---

## 7. Annual DR Drill

Once per year (target: each February, before the audit cycle):

1. Spin up a Neon branch from yesterday's data
2. Practice a full PITR to a 30-minute-ago timestamp on that branch
3. Run `verify-audit-triggers.mjs` against the restored branch
4. Run a synthetic EVV cycle against the restored branch
5. Store the drill artifact privately and record its evidence ID in
   `docs/compliance/hipaa/CONTROL_EVIDENCE_REGISTER.md`; update risks as needed

The drill is a control under `SECURITY_POLICY.md` §5.6 (annual
evaluation) and must be retained as evidence per HIPAA §164.316.
