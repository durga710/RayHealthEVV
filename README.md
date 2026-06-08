# RayHealth EVV

Electronic Visit Verification platform for home-care agencies. Live at https://rayhealthevv.com.

RayHealth combines mobile clock-in/out with GPS geofence verification, web admin for agencies (scheduling, compliance, billing readiness), Sandata + HHAeXchange aggregator export for state Medicaid submission, an audit-grade event log, and a per-agency AI workflow Copilot. Designed to support HIPAA-grade privacy controls and 21st-Century Cures Act EVV mandates.

## What's in this repo

This is a Turbo-managed npm monorepo. The four workspaces are:

| Package | What it is |
|---|---|
| `packages/core` | Shared domain entities (Zod-validated), repositories, migrations, state-strategy registry (PA, NJ, …), and the per-aggregator export contracts (Sandata, HHAeXchange) |
| `packages/app` | Express backend — REST API, auth, audit middleware, AI Copilot runtime, EVV export endpoints |
| `packages/web` | React + Vite admin UI for agency owners and coordinators |
| `packages/mobile` | Expo + React Native (SDK 54, RN 0.81.5) iOS/Android caregiver app. The legacy `packages/mobile-capacitor` directory holds dormant source from an earlier Capacitor attempt and is not wired into the build |

Top-level surface:

| Path | Purpose |
|---|---|
| `docs/` | Compliance, onboarding runbooks, deeper architecture notes |
| `scripts/` | Build/deploy/migration helpers (`deploy.sh`, `run-migrations-prompted.sh`, `security-surface-scan.ts`, …) |
| `marketing/` | Video production pipeline (six 30-second spots) |
| `deliverables/app-icon/` | App Store / Play Store icon set, 1024×1024 master + iOS/Android sizes |
| `.github/` | CI workflows, branch-protection rulesets, CODEOWNERS, PR / issue templates |
| `vercel.json` | Production deploy config |
| `PROJECT_STATUS.md` | Single source of truth for current state, recent work, and open items |
| `SECURITY.md` | Vulnerability disclosure policy |
| `DEPLOY_NOW.md` | Step-by-step deploy runbook |

## Quickstart for developers

```bash
# 1. Clone + install
git clone git@github.com:durga710/rayhealth-evv-platform.git
cd rayhealth-evv-platform
npm install

# 2. Set up local Postgres (or use a Neon dev branch). Set DATABASE_URL.
cp .env.example .env   # if present
export DATABASE_URL='postgres://localhost/rayhealth_dev'
export JWT_SECRET="$(openssl rand -hex 32)"

# 3. Run migrations
npx tsx packages/core/scripts/apply-new-migrations.ts

# 4. Run all the quality gates (this is what CI runs on every PR)
npm run typecheck
npm run lint
npm run security:scan
(cd packages/core && npx vitest run)
(cd packages/app && npx vitest run)
(cd packages/web && npx vitest run)

# 5. Boot the stack locally
npm run dev         # if a root-level dev script exists; otherwise per-workspace
```

## Architecture mental model

- **Web auth.** HttpOnly `rayhealth_session` cookie + CSRF token. No bearer tokens in browser storage — `scripts/security-surface-scan.ts` fails CI if any `localStorage.setItem('rayhealth_…')` or `localStorage.setItem('rayhealth.…')` pattern reappears.
- **Mobile auth.** JWT from `/auth/mobile/login`, stored in `expo-secure-store` (iOS Keychain / Android Keystore).
- **Server auth context.** Session cookies first, bearer fallback. Every protected route uses `requireCapability(...)` middleware.
- **Audit persistence.** `audit_events` is append-only via the `audit_events_block_mutation_trg` trigger. The retention sweep bypasses the trigger inside a transaction via `SET LOCAL session_replication_role = 'replica'` and writes its own audit row to `audit_retention_runs`.
- **Aggregator transmission.** Sandata and HHAeXchange both implemented. Per-agency config split into three tables: `agency_evv_config` (which aggregator), `agency_sandata_config` (Sandata identity + JSONB mappings), `agency_hhaexchange_config` (HHAeXchange identity + JSONB mappings). The state registry's `aggregatorChoice` flag decides whether the agency can pick (PA, yes; NJ, no — forced HHAeXchange).
- **AI surfaces.** Claude Haiku 3.5 on AWS Bedrock for the caregiver `/api/support/chat`. Google Gemini for the agency-level workflow Copilot at `/api/copilot/*`, with per-request context injection so the model can emit typed action proposals against real UUIDs.

## Compliance posture

The architectural controls expected of a HIPAA Business Associate are in place — audit immutability, encryption in transit, parameterized SQL, capability RBAC, password complexity, rate limiting on public auth surfaces, secret rotation discipline. **The operational HIPAA work** (Neon HIPAA mode, BAAs with Vercel/Neon/Resend/Google, signed risk analysis, pen test, cyber-liability insurance) is intentionally deferred until first real-agency onboarding. Until those items close, do **not** onboard any real PHI — use the fixture caregiver (`test-caregiver-fixture@rayhealthevv.local`) for any live validation.

See `docs/compliance/hipaa/RISK_ANALYSIS_2026.md` for the full risk register and `docs/sandata-onboarding.md` for the first-agency onboarding runbook.

## Contributing

Read `PROJECT_STATUS.md` for current state, then `DEPLOY_NOW.md` if you're shipping. Every PR must:

1. Pass the six required CI checks: `typecheck`, `lint`, `security-scan`, `test-core`, `test-app`, `test-web`.
2. Get a Code Owner review (see `.github/CODEOWNERS`).
3. Use Conventional Commit format (`feat:`, `fix:`, `chore:`, …) — enforced by the branch ruleset.
4. Resolve every review conversation.
5. Tick the compliance/security checklist in the PR template.

Direct pushes to `main` are blocked. Force-pushes and deletions are blocked. Linear history is required (squash or rebase, no merge commits).

## Vulnerability reports

See `SECURITY.md`. Do not file security issues as public GitHub issues — use https://github.com/durga710/rayhealth-evv-platform/security/advisories/new or email `durga@rayhealthevv.com` with subject `[SECURITY]`.

## License

Proprietary. © Durga Ghimeray / RayHealth EVV. All rights reserved.
