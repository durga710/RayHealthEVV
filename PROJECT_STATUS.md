# RayHealth EVV — Project Status

**Last updated:** 2026-05-24 (rev 7 — mobile E2E smoke + GitHub security gate hardening)
**Maintained by:** Durga Ghimeray, Founder
**Replaces:** `AGENT_HANDOFF_2026-05-08.md`, `HANDOFF.md`, `HANDOFF_CLAUDE_SECURITY_PHASE_1_2026-05-08.md`, `HANDOFF_CODEX.md`, `docs/SESSION_HANDOFF_2026-05-09.md`

This is the **single document any agent or collaborator should read first.** It supersedes the dated handoff files at the repo root and in `docs/`. Those older files are kept as a historical record but should not be treated as the source of truth.

When updating: bump the timestamp, do not delete prior status — move it to the changelog at the bottom.

---

## TL;DR

RayHealth EVV is live at `rayhealthevv.com`. The platform handles caregiver mobile clock-in/out with GPS geofence verification, web admin for agencies, audit-event persistence, and Sandata-aggregator CSV export. **The Learning Hub and AI Copilot are now complete end-to-end** — coordinators have analytics + drill-down + bulk enrollment + compliance-gated assignments, and the Gemini-backed Copilot ships behind a private-billing add-on flag. The 2026-05-24 sprint closed key caregiver-mobile backlog gaps: today's schedule now has a dedicated endpoint, missing mobile screens are routable, first clock-in requests reminder permission, mock-location detection blocks suspect clock-ins, web and mobile have Playwright smoke scaffolds in CI, and Agency Setup now persists agency profile edits through a real audited API instead of a UI stub. **No real PHI flows yet** — production is gated on enabling Neon HIPAA mode + signing BAAs with Vercel/Neon/AWS/Resend/Firebase. Pen test pending. Once those owner-action items close, the platform is ready for its first pilot agency.

---

## 2026-05-24 Sprint Status

Completed in this source monorepo:
- `.claude/worktrees/` removed from git tracking and ignored
- `GET /api/evv/today-schedule` added and mobile `DashboardScreen` refactored to use it
- Mobile `VisitDetailScreen`, `CorrectionScreen`, `NotificationScreen`, and `ProfileScreen` routes added
- `requestClockReminderPermission()` wired after successful first clock-in
- Mock-location/geofence integrity guard added before clock-in submission
- Web Playwright smoke scaffold added with CI `e2e-smoke` job
- Mobile Expo web Playwright smoke scaffold added with CI `mobile-e2e-smoke` job
- GitHub branch-protection ruleset updated to require web/mobile E2E plus gitleaks, Dependency Review, and CodeQL checks

Verification:
- Earlier sprint verification: 218/218 unit tests passing (77 core / 119 app / 22 web) and all package typechecks clean
- Continuation verification: `npm run build --workspace=@rayhealth/web` passing; static build served with `serve -s`; 5/5 Playwright smoke tests passing
- Final continuation verification: `npm run check` passing; web Playwright smoke 5/5 passing; mobile Playwright smoke 5/5 passing; high-severity production dependency audit passing with 15 remaining moderate Expo-chain advisories requiring a breaking Expo upgrade to fully clear

Still future work:
- Full authenticated caregiver clock-in/out Playwright scenario against a seeded test DB
- Real-device mobile smoke on the new clock-in integrity and reminder-permission path

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
| `rayhealth-evv-mobile` | `main` (latest `8a74eb0`) | Expo + React Native (SDK 54, RN 0.81.5) iOS/Android caregiver app |
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
| Mobile CORS handling | ✅ live | 2026-05-09 |
| Geofence enforcement (150 m, `422 GEOFENCE_OUT_OF_BOUNDS`) | ✅ live | 2026-05-09 |
| Mobile secure storage (Keychain / Keystore) | ✅ live | 2026-05-09 |
| Web cookie sessions + CSRF | ✅ live | 2026-05-09 |
| Audit-event durable persistence | ✅ live | 2026-05-09 |
| Audit retention status endpoint | ✅ live | 2026-05-09 |
| Sandata CSV export skeleton at `/api/exports/sandata.csv` | ✅ live | 2026-05-09 |
| Mobile offline visit-action queue | ⚠️ planned (Tier 2 Wk 7) | — |
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
| `packages/app/src/routes/agency-routes.ts`, `packages/core/src/repositories/agency-repository.ts`, `packages/web/src/features/agency/AgencySetupPage.tsx` | Real audited Agency Setup read/update flow replacing the previous UI-only save stub | This repo + deployed platform repo |
| `packages/core/src/repositories/schedule-repository.ts`, `packages/app/src/routes/evv-routes.ts`, `packages/mobile/src/features/evv/DashboardScreen.tsx` | Today-schedule endpoint and caregiver dashboard refactor | This repo + deployed app/mobile repos |
| `packages/mobile/src/features/evv/VisitDetailScreen.tsx`, `CorrectionScreen.tsx`, `NotificationScreen.tsx`, `ProfileScreen.tsx` | Missing mobile routes made tappable; correction screen posts to existing caregiver correction API | Mobile repo |
| `packages/mobile/src/services/clockReminderService.ts` | Deferred notification permission request after first clock-in | Mobile repo |
| `packages/mobile/src/services/locationIntegrityService.ts` | Android mock-location detection + zero-accuracy heuristic before EVV clock-in | Mobile repo |
| `packages/web/e2e/smoke.spec.ts`, `packages/web/playwright.config.ts`, `.github/workflows/ci.yml` | Playwright smoke tests and CI `e2e-smoke` job for static web build routing/login sanity | This repo CI |
| `packages/mobile/e2e/smoke.spec.ts`, `packages/mobile/playwright.config.ts`, `packages/mobile/metro.config.js`, `.github/workflows/ci.yml` | Expo web mobile smoke tests, React resolver hardening for monorepo exports, and CI `mobile-e2e-smoke` job | This repo CI + Mobile repo |

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

- [ ] Real-device end-to-end smoke on the mobile clock-in path, including location integrity and deferred notification permission

**Engineering — medium impact:**

- [ ] First-agency Sandata test transmission once Provider ID is issued
- [ ] CodeQL / Dependabot on `rayhealth-evv-platform` and `rayhealth-evv-mobile`
- [ ] Full authenticated Playwright caregiver clock-in/out flow backed by a seeded test DB

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
- **Mobile auth:** JWT from `/auth/mobile/login`, stored in `expo-secure-store` (iOS Keychain / Android Keystore).
- **Server auth context:** session cookies first, then bearer fallback.
- **Audit persistence:** `audit_events` is append-only via `audit_events_block_mutation_trg` trigger; durable repository in `@rayhealth/core`. Retention sweep (this cycle's work) bypasses the trigger inside a transaction via `SET LOCAL session_replication_role = 'replica'`.
- **Aggregator transmission:** Sandata + HHAeXchange both implemented. Per-agency config split into three tables: `agency_evv_config` (which aggregator), `agency_sandata_config` (Sandata identity + JSONB mappings), `agency_hhaexchange_config` (HHAeXchange identity + JSONB mappings). The export pipeline resolves the aggregator via `resolveAggregator(stateCode, persistedPreference)` which honours the state registry's `aggregatorChoice` flag (NJ → forced HHAeXchange).
- **AI surfaces:** Claude Haiku 3.5 on AWS Bedrock — `/api/support/chat` (caregiver) and `/api/admin-assistant/chat` (admin, planned). AWS BAA active.

---

## Changelog

### 2026-05-24 rev 7 (mobile E2E smoke + GitHub security gate hardening)
- **Mobile E2E** — added a Playwright smoke suite for the Expo web export covering login, today's schedule, dashboard-to-clock-in navigation, no-visit recovery, and caregiver support routes.
- **Mobile export stability** — fixed the blank Expo web export by removing the experimental React compiler flag and pinning the root React/React DOM runtime to Expo SDK 54-compatible `19.1.0`; added a Metro resolver guard so the mobile bundle does not mix React runtimes in the monorepo.
- **Mobile TypeScript gate** — added `typecheck` to `@rayhealth/mobile` and fixed `clockReminderService` permission-status typing so mobile TS is now part of the standard package verification path.
- **GitHub hardening** — added CI `mobile-e2e-smoke` and updated the canonical main-branch ruleset to require web/mobile E2E, gitleaks, Dependency Review, and CodeQL.
- **Secret hygiene** — redacted AWS access key IDs from the HIPAA security policy review log; exact identifiers belong only in the private incident vault.
- **GitHub live check** — authenticated `gh` verification shows remote `origin/main` checks passing on its latest SHA, but the private repo's live rulesets/branch protection and Dependabot alerts require GitHub Pro/public visibility before they can be enforced through GitHub's native controls.
- **Verification** — `npm run check`, web Playwright smoke, mobile Playwright smoke, local security surface scan, high-confidence secret pattern scan, and high-severity production dependency audit pass locally. `npm audit` still reports moderate Expo-chain advisories (`postcss`, `qs`, `uuid`) whose automated fix jumps to a breaking Expo 56 line.

### 2026-05-24 rev 6 (agency profile persistence)
- **Agency Setup persistence** — replaced the UI-only save stub with `PUT /api/agencies/current`, backed by `AgencyRepository.updateProfile()` and `agencyProfileUpdateSchema`.
- **Audit taxonomy** — added `agency.profile.changed` and writes a structured audit event on successful profile updates.
- **Web admin wiring** — added `putJson()` and updated `AgencySetupPage` to persist changes, refresh local state, and show the non-stub success state.
- **Tests** — added app route tests for agency read/update validation/authorization/audit behavior and a web test for the real save call. Full repo gate and Playwright smoke verified.

### 2026-05-24 rev 5 (mobile EVV backlog execution + Playwright smoke CI scaffold)
- **Git hygiene** — `.claude/worktrees/` was removed from tracking and added to `.gitignore` so agent worktree placeholders stop leaking into commits.
- **Today schedule** — added `ScheduleRepository.getTodaySchedule(caregiverId, date)`, `GET /api/evv/today-schedule`, and a mobile dashboard refactor that renders only today's visits and shows the `Clocked In` state when an EVV visit already exists for the assignment.
- **Mobile clickability** — added `VisitDetailScreen`, `CorrectionScreen`, `NotificationScreen`, and `ProfileScreen` routes. `CorrectionScreen` is wired to `/api/maintenance/caregiver-correction`; notifications degrade to an empty state until the notifications API ships.
- **Clock-in safeguards** — first successful clock-in now requests reminder permission once per install. Clock-in also runs location integrity checks first and aborts on Android mock-location signals or impossible zero-accuracy readings.
- **Web e2e scaffold** — added Playwright config, 5 unauthenticated smoke tests, web `e2e` script, Playwright/wait-on/serve dev dependencies, and CI `e2e-smoke` job. CI serves the built SPA with history fallback via `serve -s` and disables silent port switching.
- **Verification** — sprint unit verification reached 218/218 passing tests (77 core / 119 app / 22 web) with typecheck clean. The final e2e continuation verified web build plus 5/5 Playwright smoke tests against static `dist`.

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
