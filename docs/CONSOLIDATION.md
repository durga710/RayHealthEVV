# RayHealth EVV — Repository Consolidation

This monorepo unifies what were **three separate repositories** into a single
source of truth. This document records what was merged, the decisions made, and
the open items, so the consolidation is auditable.

## Source repositories

| Repo | Role before consolidation | Disposition |
| --- | --- | --- |
| `durga710/rayhealth-source-monorepo` | Most-advanced monorepo (shadcn web redesign, newest `core`) | **Canonical base** — this repo's git history is the base history. |
| `durga710/rayhealth-evv-platform` | Parallel "clean-room" monorepo (plain-CSS web, divergent backend) | Selectively reconciled; this repo is the **publish target remote**. |
| `durga710/rayhealth-evv-mobile` | Standalone Vite + Capacitor mobile app (native android/ios) | Imported as `packages/mobile`. |

> `source-monorepo` and `evv-platform` do **not** share git history (different
> root commits) — they are independent rebuilds, so they cannot be `git merge`d.
> The base was chosen as `source-monorepo` because it is the newest internally
> coherent codebase (web ↔ core ↔ app contracts all from one lineage).

## Final layout

```
rayhealth-evv-platform/
├── packages/
│   ├── core/                 # domain schemas + services (from base)
│   ├── app/                  # backend API (from base; see Backend divergence)
│   ├── web/                  # React 19 + shadcn/ui SPA (from base — the redesign)
│   └── mobile/               # Vite + Capacitor native app (from standalone repo)
├── api/                      # Vercel serverless entry
├── docs/                     # docs, ops/, compliance/
├── scripts/
└── .github/
```

## Decisions

1. **Base = `source-monorepo`.** Newest coherent monorepo; keeps the shadcn web
   redesign and newest `core`. (User-confirmed.)
2. **History = base history + import commits.** `source-monorepo`'s 61-commit
   history is preserved; platform/mobile content is added as documented commits.
   (User-confirmed.)
3. **Sanitized.** Removed business/ops material (`deliverables/` ~70MB,
   `customized/`, `hiring/`, `client-onboarding/`, `marketing/`,
   `agency-info.json`) — these live in the `source-monorepo` origin and do not
   belong in an application monorepo. No secrets were ever committed; `.env*`
   stays gitignored and `.env.example` documents required vars.
4. **Dead code removed.** `packages/mobile-capacitor` (an abandoned stub) deleted.

## Mobile architecture — RESOLVED (Capacitor)

`packages/mobile` is the **Vite + Capacitor** app (from the standalone repo): most
developed (mock-GPS/location-integrity, offline visit queue, full auth/visit
screens) and the one the consolidation request pointed at. **This is the canonical
and only mobile package.**

The prior Expo Router app (`packages/mobile-expo-legacy`) was **removed** per the
maintainer's decision (2026-06-26). It remains recoverable from git history
(commit `427eaba`) and the `source-monorepo` origin if ever needed.

## Backend divergence (app) — NOT auto-merged

`platform` and base `app` diverged into **different feature sets** built on each
repo's own `core`. They were *not* force-merged because the dependencies don't
cross the unrelated lineages cleanly, and a broken build is worse than a
documented gap. Kept the base backend as canonical.

**Routes present only in `platform`'s backend** (candidates for incremental port,
each requiring its supporting services/schemas to be ported into base `core`):
`billing`, `onboarding` + `onboarding-admin`, `compliance-engine`, `email/*`,
`marketing`, `mobile-routes`, `support`, `profile`, `audit-events`,
`admin-assistant`, `export`, `health`, `invitations`, plus `ai.ts`,
`security/safe-log.ts`.

**Routes only in base** (the newer active direction — EVV aggregator integrations):
Sandata config, HHAeXchange config, agency-features/evv-config, `copilot`,
`learning`, `maintenance`, `invite-acceptance`.

**Recommended approach:** port platform-only features one at a time, each as its
own branch + commit, verifying `npm run typecheck && npm run build` stays green.
