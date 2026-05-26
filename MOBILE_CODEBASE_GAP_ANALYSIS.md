# Mobile Codebase Gap Analysis

**Date:** 2026-05-24
**Author:** Claude Code (requested by Durga)
**Purpose:** Decide the path forward for the RayHealth caregiver mobile app, given that two parallel mobile codebases exist with different tech stacks and different completeness.

---

## TL;DR / Recommendation

There are **two mobile codebases on different frameworks**:

1. **LIVE app** — `~/Documents/rayhealth-evv-mobile` — **Capacitor + React (web) + Vite**. Mature, wired to real data, tested, ships to the App Store / Play Store today.
2. **PREMIUM rewrite** — `packages/mobile` in this monorepo — **React Native + Expo Router**. Beautiful native UI, a geofence map, and a learning carousel, but **no services layer, no data wiring, no tests** — a UI-stage prototype.

> **Recommendation: keep the LIVE app as canonical. Treat the premium rewrite as a _design reference_, and back-port its best UI into the live app as a web redesign.** Do **not** do a full Capacitor→React Native migration unless there is a deliberate strategic reason — it is effectively a rewrite of a working, shipping product, with real risk and months of work.
>
> Near-term work that is needed regardless of this decision:
> - **Mock-location detector** in the live app (geofence anti-spoofing) — genuinely missing.
> - **Vercel cron + `CRON_SECRET`** for the audit-retention sweep (platform repo).
> - Optional: back-port the premium **geofence map** + **dashboard/learning polish** into the live web app.
> - Low-priority cleanup: remove the dead `@google/genai` Gemini helpers from the live app.

---

## 1. Stack comparison

| Dimension | LIVE app (`rayhealth-evv-mobile`) | PREMIUM rewrite (`packages/mobile`) |
|---|---|---|
| Framework | **Capacitor** (web app in native shell) | **React Native + Expo** |
| UI library | React DOM (`<div>`), shadcn-style `@/components/ui/*` | React Native (`<View>`, `<Pressable>`, `StyleSheet`) |
| Routing | `react-router-dom` | `expo-router` (file-based, `app/(tabs)/`) |
| Build | Vite (`dev`/`build`/`preview`) + `cap:sync` | `expo export` |
| Secure storage | `@aparajita/capacitor-secure-storage` (Keychain/Keystore) | `expo-secure-store` |
| AI provider | Backend `/api/admin-assistant/chat` → **AWS Bedrock (BAA active)** | Backend `/api/support/chat` → **AWS Bedrock** |
| Store pipeline | Capacitor (Xcode / Android Studio projects exist) | Would need EAS Build / bare RN — **not set up** |
| Status | **Shipping** | **Prototype** |

The two share React + TypeScript, but **components are not portable**: React DOM vs React Native primitives differ fundamentally. Moving from one to the other is a reimplementation, not a copy.

---

## 2. Feature-by-feature comparison

| Capability | LIVE app | PREMIUM rewrite | Notes |
|---|---|---|---|
| Auth screens | Login, Signup, Forgot/Reset password, Access code, Accept invite (6) | Login only | Live far more complete |
| Today's schedule | `getTodaysSchedule()` -> `/mobile/caregiver/today` | fetches **all** assignments, hardcoded KPIs | Handoff task already done in live |
| Visit detail | `VisitDetailScreen` (678 lines, rich) | none | |
| Clock in/out | wired (`/evv/clock-in`, `/evv/clock-out`) | `ClockInScreen` exists, wired to `/api/evv/*` | |
| Geofence | enforced server-side (150 m, `422`) | **`EVVMapView`** static-map visualization (Yandex) + client Haversine | Premium has the nicer *visual* |
| Offline queue | `visit-offline-queue.ts` (210 lines) + auto-flush | none | Critical live-only capability |
| Clock reminders | `clockReminderService.ts` (247 lines), wired at first clock-in | none | Handoff task already done in live |
| Corrections | Correction + CorrectionList screens | none | |
| Notifications | `NotificationScreen` + actionUrl whitelist | none | |
| Learning | `LearningScreen` (167 lines) | **`LearningHubScreen`** (803 lines, slide carousel) | Premium more elaborate |
| AI assistant | `RayAiScreen` -> Bedrock | `CopilotScreen` -> Bedrock | Parity |
| Profile | `ProfileScreen` (246) | `ProfileScreen` (506) | |
| API contract layer | `rayhealth-api.ts` (619) + `rayhealth-contract.ts` (295) | thin `api-client.ts` (27 lines) | Live has typed contract + tests |
| Session mgmt | `rayhealth-session.ts` + `mobile-storage.ts` | `AuthContext.tsx` (57 lines) only | |
| Tests | contract + gemini service tests | none | |

**Totals:** Live = 15 screens (3,366 lines) + 9 services (1,946 lines, incl. tests). Premium = 7 feature components (3,524 lines, mostly inline styles) + **0 services**.

---

## 3. Handoff task reconciliation

The `HANDOFF_CLAUDE.md` "outstanding mobile tasks" were written against the premium rewrite's gaps, but most are **already shipped in the live app**:

| Handoff task | Live app | Premium | Verdict |
|---|---|---|---|
| Dashboard -> `getTodaysSchedule()` | done, commit `43bd428` | not done | **Done** (live) |
| Clickability audit | done, commit `52aa95c` | unverified | **Done** (live) |
| Clock-reminder on first clock-in | done, `b6cb13c`, `VisitDetailScreen.tsx:260` | not done | **Done** (live) |
| Mock-location detector | not done | not done | **Genuinely outstanding** |

---

## 4. The real decision

**Option A — Live app canonical (recommended).**
Keep shipping the Capacitor app. Back-port premium UI (geofence map, dashboard/learning polish) as a web redesign. Add the mock-location detector. Low risk, fast, preserves all working capability.

**Option B — Adopt the premium rewrite.**
Commit to a Capacitor -> React Native migration. Requires rebuilding every service (offline queue, clock reminders, session, typed API contract, notifications), re-porting 6 auth screens + visit detail + corrections, swapping secure storage and the store pipeline (EAS), and re-establishing tests. High risk to a live product; multi-month effort.

**Cost asymmetry:** Option A is incremental on a working base. Option B throws away ~1,950 lines of battle-tested services + tests and re-implements them in a new framework, while the live app keeps moving.

---

## 5. Notable findings (independent of the decision)

1. **Backend contract divergence.** The live app calls `/mobile/caregiver/today` and references `ScheduleRepository.getTodaysScheduleForCaregiver`. This monorepo's backend `ScheduleRepository` only has `getAssignmentsByCaregiver` and no `/mobile/caregiver/today` route — so the **live platform backend is ahead of this monorepo** on the schedule contract. Reconcile before treating the monorepo backend as source of truth.
2. **Dead Gemini code (live app).** `@google/genai` dependency + `getGemini()`/`resolveGeminiApiKey()` in `geminiService.ts` are retained only to keep `gemini-service.test.ts` green; the active path correctly uses Bedrock. Safe to remove the dep, helpers, and that test.
3. **Premium rewrite has zero tests** and no services layer — it cannot be shipped as-is regardless of the decision.

---

## 6. Recommended next steps (if Option A)

1. **Mock-location detector** in the live app -> PR to `durga710/rayhealth-evv-mobile`.
2. **Vercel cron + `CRON_SECRET`** for audit-retention sweep -> PR to `durga710/rayhealth-evv-platform`.
3. (Optional) Back-port the **EVVMapView geofence visualization** into the live `VisitDetailScreen`/clock-in as a React web component.
4. (Optional) Apply premium **dashboard KPI + learning carousel** styling to the live web screens.
5. (Cleanup) Remove dead Gemini helpers from the live app.
</content>
