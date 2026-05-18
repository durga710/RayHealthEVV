# RayHealth EVV — Project Status

**Last updated:** 2026-05-11
**Maintained by:** Durga Ghimeray, Founder
**Replaces:** `AGENT_HANDOFF_2026-05-08.md`, `HANDOFF.md`, `HANDOFF_CLAUDE_SECURITY_PHASE_1_2026-05-08.md`, `HANDOFF_CODEX.md`, `docs/SESSION_HANDOFF_2026-05-09.md`

This is the **single document any agent or collaborator should read first.** It supersedes the dated handoff files at the repo root and in `docs/`. Those older files are kept as a historical record but should not be treated as the source of truth.

When updating: bump the timestamp, do not delete prior status — move it to the changelog at the bottom.

---

## TL;DR

RayHealth EVV is live at `rayhealthevv.com`. The platform handles caregiver mobile clock-in/out with GPS geofence verification, web admin for agencies, audit-event persistence, and Sandata-aggregator CSV export. **No real PHI flows yet** — production is gated on enabling Neon HIPAA mode + signing BAAs with Vercel/Neon/AWS/Resend/Firebase. Pen test pending. Once those owner-action items close, the platform is ready for its first pilot agency.

---

## Repos

| Repo | Branch | Role |
|---|---|---|
| `rayhealth-evv-platform` | `main` (latest `5ec1e56`) | Backend API + web app deploy |
| `rayhealth-evv-mobile` | `main` (latest `8a74eb0`) | Capacitor iOS/Android caregiver app |
| `rayhealthevv-fresh/rayhealth-fresh` | `codex/security-phase-1` | This monorepo — docs, security plan, fixture seed script, Sandata mapping, audit retention sweep, BAA templates, risk analysis, app icon |

The three repos diverged when production was extracted from the original monorepo. This worktree is now used for: documentation, ports of code that needs to land in the deployed repos, fixture/seed scripts, and compliance artifacts.

---

## What's live

| Surface | Status | Verified |
|---|---|---|
| Backend `/auth/mobile/login` returning `firstName`/`lastName` | ✅ live | 2026-05-09 |
| `/auth/mobile/me` for session refresh | ✅ live | 2026-05-09 |
| Today-schedule deduplication (`DISTINCT ON (assignment_id)`) | ✅ live | 2026-05-09 |
| Bedrock support chat at `/api/support/chat` (Claude Haiku 3.5) | ✅ live | 2026-05-09 |
| Capacitor CORS preflight | ✅ live | 2026-05-09 |
| Geofence enforcement (150 m, `422 GEOFENCE_OUT_OF_BOUNDS`) | ✅ live | 2026-05-09 |
| Mobile secure storage (Keychain / Keystore) | ✅ live | 2026-05-09 |
| Web cookie sessions + CSRF | ✅ live | 2026-05-09 |
| Audit-event durable persistence | ✅ live | 2026-05-09 |
| Audit retention status endpoint | ✅ live | 2026-05-09 |
| Sandata CSV export skeleton at `/api/exports/sandata.csv` | ✅ live | 2026-05-09 |
| Mobile offline visit-action queue | ✅ live | 2026-05-09 |
| Notification permission deferred until first clock-in | ✅ live | 2026-05-09 |

---

## What's ready in this monorepo but not yet deployed

These changes are committed to the worktree at `/rayhealth-fresh` and need to be picked up into the deployed repos.

| File | Purpose | Where it lands |
|---|---|---|
| `vercel.json` | Fix `npm install` timeout (replace pnpm `--filter=` with correct `--workspace=` syntax; add `ignoreCommand`; add cron schedule) | This repo (or wherever the Vercel deploy is rooted) |
| `packages/core/scripts/seed-app-store-fixture.ts` | Idempotent, prod-guarded fixture seed | This repo + `rayhealth-evv-platform` |
| `packages/core/src/migrations/2026-05-11-add-agency-sandata-config.ts` | Per-agency Sandata config table | This repo + `rayhealth-evv-platform` |
| `packages/core/src/migrations/2026-05-11-add-audit-retention.ts` | Archive table + run log | This repo + `rayhealth-evv-platform` |
| `packages/app/src/services/sandata-mapping.ts` | Sandata Provider/Worker/HCPCS mapping + CSV builder | `rayhealth-evv-platform` |
| `packages/app/src/services/audit-retention-sweep.ts` | Retention sweep with safe trigger bypass | `rayhealth-evv-platform` |
| `packages/app/src/routes/audit-retention-routes.ts` | `GET /status` + `POST /sweep` endpoints | `rayhealth-evv-platform` |
| `packages/app/src/scripts/run-audit-retention-sweep.ts` | Standalone CLI for the sweep | `rayhealth-evv-platform` |
| `deliverables/app-icon/rayhealth-icon-*.png` | App Store + Play Store icon set, 1024×1024 master + iOS/Android sizes | `rayhealth-evv-mobile` (replace placeholder in `AppIcon.appiconset`) |
| `docs/compliance/hipaa/RISK_ANALYSIS_2026.md` | Annual HIPAA §164.308(a)(1)(ii)(A) risk analysis — 15 risks, NIST SP 800-30 methodology, awaiting countersignature | Sign and retain in private vault |
| `docs/compliance/hipaa/BAA_REQUEST_EMAILS.md` | Ready-to-send BAA emails for Vercel/Neon/Resend; AWS already active; Google self-service | Send |
| `docs/sandata-onboarding.md` | First-pilot-agency runbook | Used during first pilot onboarding |
| `packages/web/src/features/evv/VisitReviewPage.tsx` | Disabled state + auto-clearing success message | Already in this monorepo |
| `packages/web/src/features/landing/LandingPage.tsx` | FAQ added to nav | Already in this monorepo |

---

## Open items

**Owner-only (Durga is handling):**

- [ ] Enable Neon HIPAA mode on project `late-art-87716813` — required before any real PHI traffic
- [ ] Engage HIPAA-aware pen test firm (~$8–15k, one-week engagement)

**Owner action — not blockable by code:**

- [ ] Move test fixtures off prod default branch to a Neon branch named `app-store-screenshots`. Seed script (`packages/core/scripts/seed-app-store-fixture.ts`) is ready and prod-guarded.
- [ ] Send the four BAA request emails (Vercel, Neon, Resend, Google self-service). See `docs/compliance/hipaa/BAA_REQUEST_EMAILS.md` — pre-filled with `Durga Ghimeray / Founder / reyghim1093@gmail.com`. **Send Neon last, after HIPAA mode is enabled.**
- [ ] Vercel BAA decision: Enterprise upgrade vs. move API off Vercel onto BAA-compliant AWS runtime. See `RISK_ANALYSIS_2026.md` R-03.
- [ ] Bind cyber liability insurance with HIPAA-breach rider (~$1.5–4k/year)
- [ ] Sign and date `docs/compliance/hipaa/RISK_ANALYSIS_2026.md`. Schedule next review for 2027-05-11.

**Engineering to deploy from this monorepo into the live repos:**

- [ ] Cherry-pick this monorepo's `vercel.json` into the Vercel-rooted deploy repo and verify next deploy completes < 90 s
- [ ] Land `packages/app/src/services/sandata-mapping.ts` + routes wiring in `rayhealth-evv-platform`
- [ ] Land `packages/app/src/services/audit-retention-sweep.ts` + migration + routes in `rayhealth-evv-platform`
- [ ] Apply the two new migrations: `2026-05-11-add-agency-sandata-config.ts`, `2026-05-11-add-audit-retention.ts`
- [ ] Set `CRON_SECRET` env var in Vercel for the audit retention cron to authenticate
- [ ] Replace `AppIcon.appiconset` in `rayhealth-evv-mobile` with `deliverables/app-icon/` outputs

**Engineering — high impact, not yet started:**

- [ ] DashboardScreen visit cards refactor: use `getTodaysSchedule()` instead of `/evv/visits` recent history (mobile)
- [ ] VisitDetailScreen / CorrectionScreen / NotificationScreen / Profile sub-options clickability audit (mobile)
- [ ] Real-device end-to-end smoke on the codepath fixes shipped 2026-05-09 (mobile)
- [ ] Wire `requestClockReminderPermission()` (new export in `src/services/clockReminderService.ts`) into the first clock-in flow

**Engineering — medium impact:**

- [ ] First-agency Sandata test transmission once Provider ID is issued
- [ ] Add a mock-location detector if PA DHS audit flags geofence integrity
- [ ] CodeQL / Dependabot on `rayhealth-evv-platform` and `rayhealth-evv-mobile`
- [ ] Playwright e2e in CI for caregiver clock-in/out

**Stretch:**

- [ ] `status.rayhealthevv.com` (Better Stack or Statuspage.io)
- [ ] YubiKey 2FA on Google, AWS, GitHub, Vercel admin accounts
- [ ] Create `WORKFORCE_ACCESS.md` at first hire

---

## Quick-reference fixture credentials

Synthetic data only — never real PHI. Used for App Store screenshots and end-to-end validation.

| Field | Value |
|---|---|
| Caregiver email | `test-caregiver-fixture@rayhealthevv.local` |
| Caregiver password | `TestCaregiver2026!` |
| Caregiver UUID | `00000000-0000-4000-8000-000000000002` |
| Caregiver user UUID | `00000000-0000-4000-8000-000000000003` |
| Client UUID | `00000000-0000-4000-8000-000000000001` |
| Client address | 225 National Dr, Pittsburgh PA 15235 |
| Geofence radius | 150 m |
| Agency UUID | `e1c4a7e3-1cad-4001-8e0a-000000000001` |
| Visit template UUID | `00000000-0000-4000-8000-000000000010` |
| Assignment UUID | `00000000-0000-4000-8000-000000000020` |

Move these to a Neon branch (`app-store-screenshots`) before any real agency onboards. See `packages/core/scripts/seed-app-store-fixture.ts`.

---

## Marketing assets

Path on Durga's machine: `/Users/durgaghimeray/Documents/rayhealth-evv-mobile/marketing/`

```
marketing/
  MARKETING_KIT.md
  raw/                          ← 1206×2622 simulator captures
  app-store-6.7/                ← 1290×2796 (App Store 6.7" requirement)
```

Six 30-second spots scripted in `MARKETING_KIT.md`: Hero, Agency Owner, Caregiver, Family, Compliance, plus a 6-second pre-roll bumper and audio-only cutdown.

What's still required for spots: VO recording, music license (~$15 Artlist/Epidemic), DaVinci Resolve edit, real caregiver talent (with consent + release) over stock for spots 1–4, optional Spanish + Mandarin localization.

---

## Architecture mental model

- **Web auth:** HttpOnly `rayhealth_session` cookie + CSRF token. No bearer tokens in `localStorage`. Security regression scan (`npm run security:scan`) fails CI if `rayhealth_token` or `localStorage.setItem('rayhealth_…')` patterns reappear.
- **Mobile auth:** JWT from `/auth/mobile/login`, stored in `@aparajita/capacitor-secure-storage` (iOS Keychain / Android Keystore).
- **Server auth context:** session cookies first, then bearer fallback.
- **Audit persistence:** `audit_events` is append-only via `audit_events_block_mutation_trg` trigger; durable repository in `@rayhealth/core`. Retention sweep (this cycle's work) bypasses the trigger inside a transaction via `SET LOCAL session_replication_role = 'replica'`.
- **Aggregator transmission:** Sandata CSV, per-agency config in `agency_sandata_config` (this cycle's work). HHAeXchange not yet implemented.
- **AI surfaces:** Claude Haiku 3.5 on AWS Bedrock — `/api/support/chat` (caregiver) and `/api/admin-assistant/chat` (admin, planned). AWS BAA active.

---

## Changelog

### 2026-05-11 (this update)
- Vercel deploy timeout root-caused and fixed (`--filter=` → `--workspace=` in `installCommand`; `npx turbo` in `buildCommand`)
- Seed script `seed-app-store-fixture.ts` ported into monorepo with prod-guard
- App Store icon designed (heraldic shield + ECG pulse, brand-color gradient) — 1024 master + 6 platform sizes
- Annual HIPAA §164.308(a)(1)(ii)(A) risk analysis drafted — 15 risks across asset inventory, NIST SP 800-30 methodology
- BAA request emails polished — pre-filled signer info, send order, Vercel fallback path documented
- Sandata mapping module + per-agency config migration + onboarding runbook
- Audit retention sweep + archive migration + admin routes + cron config
- Web app polish: disabled state on Request Correction button, FAQ link in landing nav
- This `PROJECT_STATUS.md` consolidates the prior 5 handoff documents

### 2026-05-09 (prior)
- Backend: `/auth/mobile/me` + caregiver `firstName`/`lastName` in login response (commits `7cfc3bb`, `8e88bb6`, `8c5b1ce`)
- Backend: Sandata CSV export skeleton (`f337cf3`); audit retention reporting (`92d42df`, `6245a6d`)
- Mobile: ErrorBoundary, secure storage, dashboard real-name greeting, offline queue, deferred notification permission
- Marketing kit complete

### 2026-05-08 (prior)
- Security Phase 1: durable session repo, cookie sessions, CSRF middleware, structured audit persistence, mobile SecureStore migration
- Compliance docs ported into `docs/compliance/hipaa/`
- Security regression scan (`scripts/security-surface-scan.ts`) added
