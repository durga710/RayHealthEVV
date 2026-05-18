#!/usr/bin/env bash
#
# commit-2026-05-11.sh
#
# Staged-commit script for the 2026-05-11 work session.
#
# Why explicit `git add <file>` instead of `git add .`:
#   The git root for this worktree is $HOME, not this project folder
#   (see HANDOFF_CLAUDE_SECURITY_PHASE_1_2026-05-08.md). A broad add would
#   sweep in unrelated $HOME state. Every staged file below is named.
#
# Why three commits instead of one mega-commit:
#   Each commit is independently revertable and reviewable. The vercel.json
#   fix in particular should be revertable on its own if the new install
#   syntax behaves unexpectedly in production.
#
# Run from the project root:
#   bash scripts/commit-2026-05-11.sh
#
# Branch: codex/security-phase-1 (per prior handoff)

set -euo pipefail

PROJECT_DIR="/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh"
cd "$PROJECT_DIR"

# Sanity: confirm we're on the expected branch.
CURRENT_BRANCH="$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo 'unknown')"
echo "Current branch: $CURRENT_BRANCH"
if [ "$CURRENT_BRANCH" != "codex/security-phase-1" ]; then
  echo "WARNING: expected branch codex/security-phase-1 — got '$CURRENT_BRANCH'."
  read -p "Continue anyway? [y/N] " yn
  case "$yn" in [Yy]*) ;; *) echo "Aborting."; exit 1 ;; esac
fi

# -----------------------------------------------------------------------------
# Commit 1 — Fix Vercel deploy install timeout
# -----------------------------------------------------------------------------
echo ""
echo "=== Commit 1/3: fix(deploy): vercel install timeout ==="
git -C "$PROJECT_DIR" add vercel.json
git -C "$PROJECT_DIR" status --short -- vercel.json
git -C "$PROJECT_DIR" commit -m "fix(deploy): use npm --workspace= for vercel install (timeout fix)

The previous installCommand used --filter=@rayhealth/web which is pnpm/turbo
syntax. npm silently ignored it and installed the entire 700+ package
monorepo on every deploy, hitting the 120s timeout.

- installCommand: switched to 'npm ci --workspace=' (correct npm syntax),
  added --prefer-offline --no-audit --no-fund for cold-container speed
- buildCommand: switched to 'npx turbo run' so --filter actually reaches turbo
- ignoreCommand: skip deploys that only change mobile/docs/state-addenda
- crons: nightly audit retention sweep at 07:00 UTC

Refs: AGENT_HANDOFF_2026-05-08.md (blocker)"

# -----------------------------------------------------------------------------
# Commit 2 — Platform: Sandata mapping, audit retention sweep, fixture seed
# -----------------------------------------------------------------------------
echo ""
echo "=== Commit 2/3: feat(platform): Sandata + audit retention + fixture seed ==="

# Core: new business-logic services and migrations
git -C "$PROJECT_DIR" add packages/core/src/services/sandata-mapping.ts
git -C "$PROJECT_DIR" add packages/core/src/services/audit-retention-sweep.ts
git -C "$PROJECT_DIR" add packages/core/src/migrations/2026-05-11-add-agency-sandata-config.ts
git -C "$PROJECT_DIR" add packages/core/src/migrations/2026-05-11-add-audit-retention.ts
git -C "$PROJECT_DIR" add packages/core/src/__tests__/sandata-mapping.test.ts
git -C "$PROJECT_DIR" add packages/core/src/__tests__/audit-retention-sweep.test.ts

# Core: re-export + capability additions + bcrypt dep
git -C "$PROJECT_DIR" add packages/core/src/index.ts
git -C "$PROJECT_DIR" add packages/core/src/config/pennsylvania.ts
git -C "$PROJECT_DIR" add packages/core/package.json

# Core: idempotent prod-guarded fixture seed (bcryptjs hashing)
git -C "$PROJECT_DIR" add packages/core/scripts/seed-app-store-fixture.ts

# App: route surface + cron entry point + app.ts wiring
git -C "$PROJECT_DIR" add packages/app/src/routes/audit-retention-routes.ts
git -C "$PROJECT_DIR" add packages/app/src/scripts/run-audit-retention-sweep.ts
git -C "$PROJECT_DIR" add packages/app/src/app.ts

git -C "$PROJECT_DIR" status --short -- packages/core packages/app
git -C "$PROJECT_DIR" commit -m "feat(platform): Sandata aggregator + audit retention sweep + fixture seed

Three platform deliverables addressing RELEASE_PREP_GAPS.md items:

Sandata aggregator (MED, blocks MA billing):
- packages/core/src/services/sandata-mapping.ts — Zod-validated per-agency
  config (Provider ID, External Worker IDs, HCPCS+modifier mapping), pure
  buildSandataRow/buildSandataExport/toSandataCsv. 15 vitest tests cover
  config validation, each skip reason, CSV quoting per RFC 4180.
- packages/core/src/migrations/2026-05-11-add-agency-sandata-config.ts —
  one row per agency, JSONB mappings.
- Default PA service codes baked in: T1019 U4/U5/U7 (PCS/respite/companion).

Audit retention sweep (MED, audit_events grows unbounded today):
- packages/core/src/services/audit-retention-sweep.ts — chunked move from
  hot audit_events to cold audit_events_archive, then DELETE. Bypasses
  the audit_events append-only trigger via SET LOCAL session_replication_role
  inside each chunk's transaction — the trigger remains active outside
  the sweep. Run record persisted to audit_retention_runs for auditor proof.
- packages/core/src/migrations/2026-05-11-add-audit-retention.ts — archive
  table + run log.
- packages/app/src/routes/audit-retention-routes.ts — GET /status (admin)
  + POST /sweep (cron secret OR admin). Wired at /admin/audit-retention.
- packages/app/src/scripts/run-audit-retention-sweep.ts — standalone CLI.
- Cron registered in vercel.json (07:00 UTC nightly).
- 4 vitest tests; auto-skip when no DB.

Fixture seed (CRIT, fixtures currently on prod default branch):
- packages/core/scripts/seed-app-store-fixture.ts — idempotent, refuses to
  run without 'branch=' in DATABASE_URL or against prod hostnames.
  bcryptjs cost 10 (matches platform auth path).

Other:
- pennsylvania.ts: added audit.read and audit.write capabilities to admin
  role — required for the new retention status endpoint guard.
- index.ts: re-exports the two new services.
- core/package.json: bcryptjs runtime + @types/bcryptjs dev dep.

All typechecks pass (core, app, web). All tests pass (39+12+5). Security
surface scan still green.

Refs: RELEASE_PREP_GAPS.md (CRIT fixtures, MED Sandata, MED audit retention),
      RISK_ANALYSIS_2026.md (R-02, R-08, R-11)"

# -----------------------------------------------------------------------------
# Commit 3 — Docs + deliverables + web polish
# -----------------------------------------------------------------------------
echo ""
echo "=== Commit 3/3: docs+chore: status doc, risk analysis, app icon, web polish ==="

# Web polish
git -C "$PROJECT_DIR" add packages/web/src/features/evv/VisitReviewPage.tsx
git -C "$PROJECT_DIR" add packages/web/src/features/landing/LandingPage.tsx

# Compliance + onboarding docs
git -C "$PROJECT_DIR" add docs/compliance/hipaa/RISK_ANALYSIS_2026.md
git -C "$PROJECT_DIR" add docs/compliance/hipaa/BAA_REQUEST_EMAILS.md
git -C "$PROJECT_DIR" add docs/sandata-onboarding.md

# Consolidated status doc
git -C "$PROJECT_DIR" add PROJECT_STATUS.md

# App icon master + sizes
git -C "$PROJECT_DIR" add deliverables/app-icon/build-icon.py
git -C "$PROJECT_DIR" add deliverables/app-icon/README.md
git -C "$PROJECT_DIR" add deliverables/app-icon/rayhealth-icon-1024.png
git -C "$PROJECT_DIR" add deliverables/app-icon/rayhealth-icon-180.png
git -C "$PROJECT_DIR" add deliverables/app-icon/rayhealth-icon-120.png
git -C "$PROJECT_DIR" add deliverables/app-icon/rayhealth-icon-167.png
git -C "$PROJECT_DIR" add deliverables/app-icon/rayhealth-icon-152.png
git -C "$PROJECT_DIR" add deliverables/app-icon/rayhealth-icon-512-android.png
git -C "$PROJECT_DIR" add deliverables/app-icon/rayhealth-icon-192-android.png

# This script itself
git -C "$PROJECT_DIR" add scripts/commit-2026-05-11.sh

git -C "$PROJECT_DIR" status --short -- packages/web docs deliverables PROJECT_STATUS.md scripts/commit-2026-05-11.sh
git -C "$PROJECT_DIR" commit -m "docs+chore: HIPAA risk analysis, app icon, web polish, status doc

Compliance:
- docs/compliance/hipaa/RISK_ANALYSIS_2026.md — annual 164.308(a)(1)(ii)(A)
  risk analysis. NIST SP 800-30 methodology. 15-risk register with
  asset inventory, likelihood/impact ratings, residual ratings, remediation
  roadmap, attestation block awaiting countersignature.
- docs/compliance/hipaa/BAA_REQUEST_EMAILS.md — polished: pre-filled signer
  info (Durga Ghimeray / Founder / reyghim1093@gmail.com), recommended
  send order, Vercel-Enterprise fallback path documented (move API off
  Vercel onto BAA-compliant AWS so Vercel only serves static).

Onboarding runbooks:
- docs/sandata-onboarding.md — first-pilot-agency runbook with skip-reason
  taxonomy, column-order warnings, and verification recipe.

App Store / Play Store icon:
- deliverables/app-icon/build-icon.py — Python+PIL source for a heraldic
  shield + ECG pulse design (brand #0B5FB1 primary, #10A4A4 accent).
  Apple-safe: RGB no-alpha, no rounded corners (Apple applies the mask).
- deliverables/app-icon/rayhealth-icon-1024.png — App Store master.
- deliverables/app-icon/rayhealth-icon-{180,120,167,152}.png — iOS sizes.
- deliverables/app-icon/rayhealth-icon-{512,192}-android.png — Play sizes.

Web polish:
- packages/web/src/features/evv/VisitReviewPage.tsx — Request Correction
  button gets disabled state during submission and auto-clearing success
  message (so row hover state isn't masked).
- packages/web/src/features/landing/LandingPage.tsx — FAQ link added to
  nav (FAQ section already existed but wasn't navigable).

Single source of truth:
- PROJECT_STATUS.md — consolidates AGENT_HANDOFF_2026-05-08.md, HANDOFF.md,
  HANDOFF_CLAUDE_SECURITY_PHASE_1_2026-05-08.md, HANDOFF_CODEX.md, and
  docs/SESSION_HANDOFF_2026-05-09.md into one dated, changelogged doc.
  The five prior handoffs are kept as history but should not be treated
  as source of truth.

Refs: RISK_ANALYSIS_2026.md, PROJECT_STATUS.md changelog"

# -----------------------------------------------------------------------------
echo ""
echo "=== Done. ==="
echo ""
echo "Verify the three commits:"
echo "  git -C \"$PROJECT_DIR\" log --oneline -3"
echo ""
echo "Heads-up — these files were left uncommitted by a prior agent and are NOT"
echo "in any of the three commits above. Decide separately whether they should"
echo "be committed (or were already committed in the intervening days):"
echo "  scripts/security-surface-scan.ts"
echo "  scripts/check.sh"
echo "  packages/app/eslint.config.js"
echo "  packages/core/eslint.config.js"
echo "  packages/web/eslint.config.js"
echo "  packages/mobile/eslint.config.js"
echo ""
echo "Check with: git -C \"$PROJECT_DIR\" status --short -- scripts packages/*/eslint.config.js"
