# RayHealth EVV — Handoff to Claude Code

**Date:** May 24, 2026  
**Status:** Monorepo updated with complete Security Phase 1 API, PA §52.18 Learning Portal, and Premium Caregiver Mobile cockpit. All 88 tests passing.  
**Target Agent:** Claude Code / Claude 3.5 Sonnet  

Welcome, Claude! This document outlines the exact state of the RayHealth EVV ecosystem, what has been built recently, and the precise step-by-step roadmap for you to pick up.

---

## 🗺️ Repository Map & State of the Union

RayHealth EVV's codebase was split from this reference monorepo to live production repos. 

| Repository | Active Branch | Role |
| :--- | :--- | :--- |
| **`rayhealthevv-fresh/rayhealth-fresh`** | `codex/security-phase-1` | **This Monorepo** — reference workspace containing verified backend services, database migrations, mobile screens, seed fixtures, and HIPAA/Sandata compliance documents. |
| **`rayhealth-evv-platform`** | `main` | Production Backend API & Web deploy. |
| **`rayhealth-evv-mobile`** | `main` | Capacitor iOS/Android caregiver app. |

> [!IMPORTANT]
> This monorepo (`rayhealth-fresh`) contains all the recently completed and tested feature sets (Security Phase 1 API, PA Learning Hub, and Premium Caregiver cockpit). **Your primary engineering task is to port and land these changes into the live production repositories** (`rayhealth-evv-platform` and `rayhealth-evv-mobile`) and complete the pending mobile/web integrations.

---

## ✨ What was Shipped & Completed (May 11 – May 24, 2026)

We completed two massive feature sprints in this monorepo:

### 1. Caregiver Mobile Cockpit & AI Copilot (`packages/mobile`)
* **Premium Rebranding:** Revamped login and dashboards with deep blue/orange color palettes, elegant typography, and a fixture prefill assistant for frictionless QA.
* **Geofence Map (`EVVMapView`):** Renders dynamic Yandex static maps, tracks caregiver GPS coordinates, computes real-time Haversine distance, and visually locks caregivers within a 150m compliance boundary.
* **PA Attestation Checklist:** Before clocking out, caregivers must attest to completed PA duty tasks from a checklist.
* **Dashboard Cockpit:** Implemented a welcome cockpit with a 4-card active KPI grid (weekly hours, completed visits, compliance status, offline queue).
* **Copilot Screen (`CopilotScreen`):** Connected directly to `/api/support/chat` using Claude 3.5 Haiku via AWS Bedrock.
* **Learning Hub Screen:** Slide viewer carousel with circular progress gauge, allowing caregivers to complete elective and required training on their mobile devices.
* **Offline Inspection (`ProfileScreen`):** Added inspection of the caregiver's local offline visit-action queue and PA DHS Telephony fallback guidelines.

### 2. Security Phase 1 API & Learning Portal (`packages/core` & `packages/app`)
* **Invite & Maintenance Services:** Full implementation of `/invite` (create, resend, list, revoke with safe in-memory store) and `/maintenance` routes (visit unlock requests, reject, queue, and logs) inside `@rayhealth/app`.
* **VisitMaintenanceRepository:** Backed by PostgreSQL with safe types (no `any` mappings).
* **Caregiver Learning Portal (PA §52.18 Compliance):** 
  * Rebuilt `core/domain/learning.ts` (12 domain types tracking progress, compliance, and rollups).
  * Implemented `core/repositories/learning-repository.ts` containing deterministic compliance state derivation and an actionable insights engine with 5 distinct insight categories.
  * Mounted 7 backend endpoints at `/learning` and `/api/learning`.
* **Web Portal Pages (`packages/web`):**
  * `LearningHubPage.tsx`: Coordinator interface with compliance rollup strips, actionable alerts, and a course manager.
  * `LearningPortalPage.tsx`: Caregiver training cockpit with compliance badge, elective/required list, and inline completion flows.
  * Local proxy configuration added to `packages/web/vite.config.ts` (`/api` requests proxied to `http://localhost:3000`).

---

## 🚀 Porting Plan: Bringing Monorepo Work Live

To synchronize the production repos, you need to cherry-pick or copy the following files from this reference repo:

### Backend & Database Porting (Target: `rayhealth-evv-platform`)
Copy these services, repositories, and routes from `@rayhealth/core` and `@rayhealth/app` in this monorepo into the live backend:
1. **Migrations:**
   - `packages/core/src/migrations/2026-05-11-add-agency-sandata-config.ts`
   - `packages/core/src/migrations/2026-05-11-add-audit-retention.ts`
2. **Repositories:**
   - `packages/core/src/repositories/learning-repository.ts`
   - `packages/core/src/repositories/visit-maintenance-repository.ts`
3. **Domain Models & Services:**
   - `packages/core/src/domain/learning.ts`
   - `packages/core/src/services/sandata-mapping.ts`
   - `packages/core/src/services/audit-retention-sweep.ts`
4. **Express Routing:**
   - `packages/app/src/routes/learning-routes.ts`
   - `packages/app/src/routes/invite-routes.ts`
   - `packages/app/src/routes/maintenance-routes.ts`
   - `packages/app/src/routes/audit-retention-routes.ts`
5. **Standalone Sweeper Script:**
   - `packages/app/src/scripts/run-audit-retention-sweep.ts`

### Mobile Porting (Target: `rayhealth-evv-mobile`)
Deploy all mobile screens and styling systems from `packages/mobile` in this monorepo:
1. **Screens:** Login, Dashboard, Clock-in, Copilot, Learning, and Profile.
2. **Components:** `EVVMapView`, themed layouts, and buttons.
3. **App Icon Assets:** Replace the mobile placeholder in `AppIcon.appiconset` with the high-fidelity branding images located in `deliverables/app-icon/`.

---

## 🛠️ Outstanding Task Checklist

These tasks are high priority and are ready for you to implement in your upcoming session:

- [ ] **DashboardScreen Refactor (Mobile):** Change the visit cards on the caregiver dashboard screen to use `getTodaysSchedule()` instead of fetching from `/evv/visits` (recent history).
- [ ] **Clickability Audit (Mobile):** Review `VisitDetailScreen`, `CorrectionScreen`, `NotificationScreen`, and sub-profile lists to ensure all interactive buttons and input lines have clean click animations and properly navigate.
- [ ] **Notification Timing Setup:** Ensure that `requestClockReminderPermission()` (exported in `src/services/clockReminderService.ts`) is cleanly wired into the first clock-in confirmation flow instead of firing immediately upon app launch.
- [ ] **Environment Secret Configuration:** Add the `CRON_SECRET` environment variable to Vercel so that Vercel cron endpoints can trigger `POST /sweep` securely.
- [ ] **Cron Setup (Vercel):** Cherry-pick this repo's `vercel.json` to the live platform to enable the scheduled audit-retention sweep crons.
- [ ] **Mock-Location Detector:** If you have time, write a minor mock-location detection service in the mobile app to verify geofence integrity and prevent GPS spoofing.

---

## 🔒 Security & Architecture Mental Model

Keep these rules in mind when modifying or extending RayHealth EVV:

* **Web Auth:** Cookie-based. Session cookies are HTTP-only (`rayhealth_session`) and verified with CSRF tokens. **Never store JWTs or sessions in `localStorage`.** The security surface scanner script (`scripts/security-surface-scan.ts`) runs on pre-commit and will fail if `localStorage.setItem` is used on auth items.
* **Mobile Auth:** Renders standard bearer JWT from `/auth/mobile/login`. JWTs are securely held in `@aparajita/capacitor-secure-storage` (Keychain for iOS / Keystore for Android).
* **Audit Trail Persistence:** The `audit_events` table is write-once and append-only. An database trigger (`audit_events_block_mutation_trg`) blocks all updates and deletions. 
  * *Bypass for Sweep:* The retention sweeper (`packages/core/src/services/audit-retention-sweep.ts`) deletes expired records by changing the session replication role inside a transaction block (`SET LOCAL session_replication_role = 'replica'`) to bypass database triggers.
* **AI Support integrations:** Handled via AWS Bedrock utilizing Claude 3.5 Haiku. Fully covered by active AWS BAA.

---

## 🏷️ Test Fixtures & Sandbox Accounts

Use these pre-seeded sandbox credentials to test flows during development:

| Field | Value |
| :--- | :--- |
| **Caregiver Email** | `test-caregiver-fixture@rayhealthevv.local` |
| **Caregiver Password** | `TestCaregiver2026!` |
| **Caregiver UUID** | `00000000-0000-4000-8000-000000000002` |
| **Caregiver User UUID** | `00000000-0000-4000-8000-000000000003` |
| **Client UUID** | `00000000-0000-4000-8000-000000000001` |
| **Client Address** | 225 National Dr, Pittsburgh PA 15235 (Pre-set for 150m Geofence tests) |
| **Agency UUID** | `e1c4a7e3-1cad-4001-8e0a-000000000001` |

---

## 🧪 Verification & Health Check

Run these commands inside the monorepo root to verify that everything is green and ready before making changes:

```bash
# Run all code quality tools, typescript checks, and test runner
./scripts/check.sh

# Run individual testing suites
npm run test           # Executes all 88 Vitest tests
npm run lint           # Lints with Turbo ESLint config
npm run typecheck      # Verifies TypeScript structures across all modules
npm run security:scan  # Scans for local storage security leaks
```

Good luck, Claude! The workspace is compiled, fully tested, and ready for you to port these features to production.
