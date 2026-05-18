# RayHealth EVV — Project Status

**Last updated:** 2026-05-18 (rev 5 — operational hygiene: production audit clean, CI hardening, broken-script cleanup)
**Maintained by:** Durga Ghimeray, Founder
**Replaces:** `AGENT_HANDOFF_2026-05-08.md`, `HANDOFF.md`, `HANDOFF_CLAUDE_SECURITY_PHASE_1_2026-05-08.md`, `HANDOFF_CODEX.md`, `docs/SESSION_HANDOFF_2026-05-09.md`

This is the **single document any agent or collaborator should read first.** It supersedes the dated handoff files at the repo root and in `docs/`. Those older files are kept as a historical record but should not be treated as the source of truth.

When updating: bump the timestamp, do not delete prior status — move it to the changelog at the bottom.

---

## TL;DR

RayHealth EVV is live at `rayhealthevv.com`. The platform handles caregiver mobile clock-in/out with GPS geofence verification, web admin for agencies, audit-event persistence, and Sandata-aggregator CSV export. **The Learning Hub and AI Copilot are now complete end-to-end** — coordinators have analytics + drill-down + bulk enrollment + compliance-gated assignments, and the Gemini-backed Copilot ships behind a private-billing add-on flag. **No real PHI flows yet** — production is gated on enabling Neon HIPAA mode + signing BAAs with Vercel/Neon/AWS/Resend/Firebase. Pen test pending. Once those owner-action items close, the platform is ready for its first pilot agency.

---

## Learning Hub + AI Copilot — current state

Coordinator surface (`/admin/learning/*`):
- **Dashboard** — KPIs (active caregivers, total enrollments, compliance %), 5-status breakdown, segmented compliance bar, attention banner for overdue+expired, AI-flavored insights panel (5 deterministic signals: due-in-7-days, expired-recently, orientation-incomplete, stalled-enrollments, certification-expiring-soon)
- **Course catalog** — Required/Global badges, full catalog browse
- **Per-caregiver detail** — status pills, due dates, expiry, last-completed, inline Mark complete action
- **Bulk enrollment modal** — multi-select caregivers, smart due-date defaults by cadence, course picker
- **Single-caregiver enrollment** from caregiver detail page
- **Analytics page** — per-course completion rate (color-coded bar), average days-to-complete, action-needed summary, sorted required-first then worst-completion-first
- **Course drill-down** — caregivers grouped by effective status (worst first), links to per-caregiver detail
- **AI Copilot panel** on dashboard — visible-locked when add-on off, admin-only Enable CTA
- **AI Copilot chat** at `/admin/learning/copilot` — Gemini-backed, role-specific system prompts, suggested prompts per role, confirm-every-action contract baked in, three states (locked / offline / live)
- **Compliance gate on assignments** — 422 on uncompleted required training, override-with-reason flow, preflight check as you type the caregiver ID

Caregiver mobile surface (`packages/mobile-capacitor/src/features/learning/`, speculative):
- LearningHubScreen — assigned courses with status chips
- CourseDetailScreen — Mark complete / Recertify with attestation disclosure
- Needs 5-point integration (router, auth hook, env var) before going live

Agency Settings (`/admin/settings`):
- Admin-only AI Copilot enable toggle
- Plan picker — Starter / Pro
- "Owner-only" notice for non-admins (private billing pattern)
- Saves on toggle, writes structured `agency.feature.changed` audit event

Audit trail:
- `learning.override` — coordinator bypassed compliance gate, entity_id = new assignment
- `learning.course.completed` — every completion with `source: caregiver | coordinator`
- `agency.feature.changed` — feature flag toggle with `{ previous, next }` diff
- `copilot.query` — every AI ask with prompt **hashed** (never stored raw — can contain PHI), with model and plan, `proposedActionType` if any
- `copilot.action.confirmed` — every executed action with full payload + summary + outcome
- `copilot.action.declined` — every failed execution with reason (auth, not-found, cross-agency, etc.)

AI Copilot action vocabulary (extensible):
- `enroll_caregiver` — wraps `LearningRepository.enroll`, idempotent
- `send_reminder` — v2 stub, audit-only until notification service ships
- Adding actions: define Zod schema in `packages/core/src/domain/copilot-actions.ts`, add executor in `packages/app/src/services/copilot-action-executor.ts` — that's it

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

## What's ready in the source monorepo but not yet in `rayhealth-evv-platform`

The source-of-truth monorepo (`rayhealthevv-fresh/rayhealth-fresh` on Durga's machine) has several files that haven't been ported into this deployed repo (`durga710/rayhealth-evv-platform`). Verified via direct filesystem audit on 2026-05-18.

| File (source-monorepo path) | Status here | Purpose |
|---|---|---|
| `vercel.json` | ✅ in prod | Fix `npm install` timeout (`--workspace=` syntax; add cron schedule) |
| `packages/core/scripts/seed-app-store-fixture.ts` | ✅ in prod | Idempotent, prod-guarded fixture seed |
| `packages/app/src/routes/audit-retention-routes.ts` | ✅ in prod | `GET /status` endpoint (read-only stats; sweep endpoint not wired yet because the service is missing) |
| `packages/web/src/features/evv/VisitReviewPage.tsx` tweaks | ✅ in prod | Disabled state + auto-clearing success message |
| `packages/web/src/features/landing/LandingPage.tsx` tweaks | ✅ in prod | FAQ added to nav |
| `packages/core/src/migrations/2026-05-11-add-agency-sandata-config.ts` | ❌ pending port | Per-agency Sandata config table |
| `packages/core/src/migrations/2026-05-11-add-audit-retention.ts` | ❌ pending port | Archive table + run log |
| `packages/core/src/migrations/2026-05-11-add-{learning,agency-features,invite-access-code,agency-evv-config,extend-visit-maintenance,agency-hhaexchange-config}.ts` | ❌ pending port (6 files) | Learning Hub, Copilot feature flag, invite access codes, agency EVV/HHAeXchange config, VMUR upgrade |
| `packages/core/src/services/sandata-mapping.ts` | ❌ pending port | Sandata Provider/Worker/HCPCS mapping + CSV builder (note: PROJECT_STATUS rev 4 incorrectly said `packages/app/src/services/` — actual path is `packages/core/src/services/`) |
| `packages/core/src/services/audit-retention-sweep.ts` | ❌ pending port | Retention sweep with safe trigger bypass |
| `packages/core/src/repositories/agency-sandata-config-repository.ts` | ❌ pending port | Repository for the Sandata config table |
| `packages/app/src/routes/agency-sandata-config-routes.ts` | ❌ pending port | `GET`/`PUT /agencies/me/sandata-config` |
| `packages/app/src/scripts/run-audit-retention-sweep.ts` | ❌ pending port | Standalone CLI for the sweep |
| `deliverables/app-icon/rayhealth-icon-*.png` | N/A (mobile repo) | App Store + Play Store icon set |
| `docs/compliance/hipaa/RISK_ANALYSIS_2026.md` | N/A (sign offline) | HIPAA §164.308(a)(1)(ii)(A) risk analysis |
| `docs/compliance/hipaa/BAA_REQUEST_EMAILS.md` | N/A (send manually) | Ready-to-send BAA emails for Vercel/Neon/Resend |
| `docs/sandata-onboarding.md` | N/A (runbook) | First-pilot-agency runbook |

**Port checklist for the engineering items:** each migration is 30-80 lines of idempotent Knex schema code. The migrations should be ported as a set with their corresponding service/route/repository files, otherwise routes will compile but fail at runtime against a Postgres `relation does not exist` error. Right now Learning Hub features that PROJECT_STATUS rev 2/3 described as "live" likely depend on tables (`learning_courses`, `course_enrollments`, `audit_events_archive`, `agency_sandata_config`, etc.) that don't exist in this repo's schema — production may have been migrated through a different path (manual SQL? earlier monorepo's `apply-new-migrations.ts`?). **Worth a Neon-side schema audit before relying on those features in a pilot.**

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
- [x] ~~CodeQL / Dependabot on `rayhealth-evv-platform`~~ — CodeQL via `.github/workflows/codeql.yml`, Dependabot via `.github/dependabot.yml` (#21, 2026-05-18). `rayhealth-evv-mobile` still pending.
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
| Geofence radius | 100 m (PA spec) |
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
- **Aggregator transmission:** Sandata + HHAeXchange both implemented. Per-agency config split into three tables: `agency_evv_config` (which aggregator), `agency_sandata_config` (Sandata identity + JSONB mappings), `agency_hhaexchange_config` (HHAeXchange identity + JSONB mappings). The export pipeline resolves the aggregator via `resolveAggregator(stateCode, persistedPreference)` which honours the state registry's `aggregatorChoice` flag (NJ → forced HHAeXchange).
- **AI surfaces:** Claude Haiku 3.5 on AWS Bedrock — `/api/support/chat` (caregiver) and `/api/admin-assistant/chat` (admin, planned). AWS BAA active.

---

## Changelog

### 2026-05-18 rev 5 (operational hygiene — CI hardening + ghost cleanup)

A pure-housekeeping cycle. No new features; the goal was getting the GitHub side of the project to stop being a constant footgun.

- **Production dependency audit clean** (#18) — undici, esbuild, vite, brace-expansion, axios, expo, `@vitejs/plugin-react`, `react-native-css-interop` all bumped past their advisories; `@vercel/node`'s vulnerable transitive undici pinned via `overrides`. `npm audit --omit=dev` now reports **0 vulnerabilities** (was 11 — 3 high, 5 moderate, 3 low). Bumped cell-cipher to cast `Buffer → Uint8Array` for `@types/node` 22 compatibility.
- **Lockfile cross-platform fix** (#20) — permanent fix for the [npm/cli#4828](https://github.com/npm/cli/issues/4828) native-binding-drop bug that bricked PR #18 across three sessions. Ships `scripts/sync-lockfile.sh` (Docker `linux/amd64` regen), `.github/workflows/lockfile-sync.yml` (auto-fixes drift on PRs touching `package.json`), `docs/LOCKFILE.md` (explainer).
- **Dependabot enabled** (#21) — closes the second half of "CodeQL / Dependabot on rayhealth-evv-platform" (CodeQL already shipped via `.github/workflows/codeql.yml`). Weekly Monday scan, grouped minor+patch updates, ignore lists for Expo / React Native / React / TypeScript majors. Security advisories not gated by schedule.
- **Broken migration script removed** (#32) — `packages/core/scripts/apply-new-migrations.ts` imported eight 2026-05-11 dated migration files that never landed in this repo (`tsc --noEmit` surfaced 8 `TS2307: Cannot find module` errors). Deleted. README quickstart step 3 now uses `npm run db:migrate` (the command that has worked all along via `packages/core/src/migrations/runner.ts`).
- **Pull-request cleanup** — Merged PR #4 (codex launch-ads brief — resolved tracked-dist conflicts), PR #15 (mobile 30-second pre-shift vibration alert). Deleted five dangling no-PR branches (`codex/security-phase-1-platform`, `fix/app-dangling-routes`, `fix/vercel-install`, `feat/empty-states`, `feat/mobile-polish`). Repo went from 9 branches / 3 open PRs to **2 branches / 0 open PRs** (now back to 1 branch after this work lands).
- **Local-side cleanup** — pruned 10 orphan `git worktree`s, 12 stale local branches, 18 stale remote-tracking refs.

### 2026-05-11 rev 4 (invite acceptance + EVV aggregator config + VMUR upgrade + HHAeXchange/Sandata admin surface)
- **Caregiver invite acceptance flow** — public `GET`/`POST /api/invites/accept/:token` endpoints (mounted before `authContext` so a logged-out caregiver can hit them). Access-code comparison is case- and dash-insensitive, password is bcrypt-cost-12, creates `caregivers` + `users` rows in a transaction, marks invite accepted, returns an 8h bearer. Failed access-code attempts emit a new `invite.access_code_failed` audit event. Web page at `/accept/:token` (`AcceptInvitePage.tsx`) handles expired/revoked/already-used cases. 13 tests.
- **Agency EVV aggregator config** — new `agency_evv_config` table + repo + GET/PUT `/agencies/me/evv-config` + admin UI picker. Resolver honours state-registry `aggregatorChoice` (NJ → forced HHAeXchange). Production-ready toggle 422s until the chosen aggregator's config is populated AND `enabled=true`. 15 tests.
- **AI Copilot context injection** — per-request `{caregivers, courses}` UUID blob prepended to every prompt so the model can emit real `PROPOSE_ACTION_DATA`. Role-scoped: admin/coordinator see up to 50 active caregivers + full course catalog; caregivers see only their own record (test asserts no UUID leakage); family role gets empty. Failures degrade gracefully. 8 tests.
- **VMUR (Visit Maintenance Unlock Request) upgrade** — migration adds PA DHS-required columns (`reason_category_code`, `correction_code`, `originator_role`, `caregiver_signature_present`, `client_signature_present`, `incomplete_signature_reason`, `approver_id`, `approved_at`, `agency_id`). Domain enforces reason-code + correction-code enums and refines "missing-signature requires incompleteSignatureReason" + "OTHR reason requires non-empty reason text". New `POST /maintenance/caregiver-correction` (caregiver-self-filed → coordinator review queue, originator stamped), `POST /maintenance/reject-unlock/:id`, `GET /maintenance/queue`, `GET /maintenance/visit/:visitId`, `GET /maintenance/history` (filters whitelisted, limit clamped at 500). Coordinator review UI at `/admin/corrections`, tracking UI at `/admin/corrections/tracking`. 30 tests.
- **HHAeXchange aggregator end-to-end** — migration for `agency_hhaexchange_config`, repository (`findByAgency` / `findValid` / `upsert` — `findValid` only returns when Tax ID + Provider ID are present), GET/PUT `/agencies/me/hhaexchange-config` (Tax ID `^\d{9}$`; refuses `enabled=true` until identity is set), admin UI section in `AgencySettingsPage` with identity form + caregiver mappings editor + service mappings editor (caregiver dropdown sourced from `/api/staff`). 17 tests.
- **Sandata aggregator admin surface** — parallel to HHAeXchange: `AgencySandataConfigRepository`, GET/PUT `/agencies/me/sandata-config` (Provider ID `^\d{9}$`; HCPCS code + modifier validated), admin UI with identity form + caregiver mappings editor + HCPCS service mappings editor. The production-ready guard in `/agencies/me/evv-config` now goes through these repos instead of raw knex. 15 tests.
- **Audit taxonomy** — new event types: `invite.access_code_failed`, `agency.evv-config.changed`
- **Tests** — 197 total (74 core / 109 app / 14 web). Typecheck clean, lint clean. **Net new: 105 tests.**

### 2026-05-11 rev 3 (Copilot v2 action runner + notification settings)
- **Copilot v2 action runner** — typed `CopilotAction` discriminated union in core, `executeCopilotAction` dispatcher with per-action row-level auth checks, `POST /api/copilot/execute` endpoint
- **End-to-end Confirm wiring** — system prompts now instruct the model to emit `PROPOSE_ACTION_DATA: <JSON>` alongside the natural-language line; the route parses and validates against `copilotActionSchema`, returns as `proposedActionData`. Chat UI's Confirm button posts to `/execute` and renders the result; falls back to advisory mode when the model emits free-text only. "Executable" badge on the proposed-action block when data is present
- **Notification settings** — coordinator digest (off/daily/weekly), caregiver push/email, family email — admin-only section on the settings page, persisted in `agency_features.notifications` JSONB
- **Tests** — 7 new for `/copilot/execute` covering 400/402/403/422 paths + happy + cross-agency rejection + send_reminder stub. Total 92 tests (42 core / 45 app / 5 web)
- Helper: `sync-session4-to-bitbucket.sh`

### 2026-05-11 rev 2 (Learning Hub + AI Copilot end-to-end)
- **Learning Hub** complete: domain types, migration, repository, 6+ API endpoints, dashboard/catalog/caregiver-detail/analytics/drill-down pages, PA-course seed (8 baseline courses)
- **Compliance gate** on assignments — 422 with blockers, override-with-audit, preflight check
- **AI Copilot** end-to-end — agency features migration (JSONB), settings page, locked panel on dashboard, Gemini-backed chat at `/admin/learning/copilot`, per-role system prompts, confirm-every-action contract, prompt-hash audit
- **AssignmentsPage UX** — caregiver + client + template pickers, name display everywhere, preflight compliance hint
- **Audit taxonomy** — 6 new event types covering learning, agency, copilot
- **Tests** — 75 total (42 core / 28 app / 5 web). New coverage: agency features, analytics, drill-down, completion audit, override audit, compliance gate, preflight endpoint
- **Helper scripts** — `sync-session2-to-bitbucket.sh`, `sync-session3-to-bitbucket.sh`

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
