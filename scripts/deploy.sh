#!/usr/bin/env bash
#
# deploy.sh
#
# One-stop deploy runner. Walks through:
#   0. Preflight (lint + typecheck + tests + security:scan)
#   1. Push session work to GitHub (where Vercel watches)
#   2. Apply 8 dated migrations against Neon
#   3. Verify the GitHub Actions CI is green on main
#
# Each phase prompts before running so you can sanity-check or skip.
#
# Run from anywhere:
#   bash "/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh/scripts/deploy.sh"

set -eo pipefail

SOURCE="/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh"

confirm() {
  local prompt="$1"
  local response
  read -p "$prompt [y/N] " response
  case "$response" in
    [Yy]*) return 0 ;;
    *) return 1 ;;
  esac
}

echo "==================================================="
echo " RayHealth EVV — Deploy"
echo "==================================================="
echo ""
echo "This will:"
echo "  0. Preflight (lint, typecheck, tests, security:scan)"
echo "  1. Push session work to GitHub (Vercel auto-deploys)"
echo "  2. Apply 8 dated migrations to Neon (prompted, hidden URL input)"
echo "  3. Print smoke-test curl commands"
echo ""
echo "GitHub is the canonical remote. Bitbucket was dropped this session."
echo "Each step is prompted — Ctrl+C at any point to abort."
echo ""

# ----------------------------------------------------------------------
# Phase 0: Preflight
# ----------------------------------------------------------------------

echo "---------------------------------------------------"
echo " Phase 0: Preflight (lint + typecheck + tests + security:scan)"
echo "---------------------------------------------------"

if confirm "Run preflight checks now?"; then
  cd "$SOURCE"
  echo "→ lint…"
  npm run lint
  echo "→ typecheck…"
  npm run typecheck
  echo "→ security:scan…"
  npm run security:scan
  echo "→ tests (core)…"
  (cd packages/core && npx vitest run)
  echo "→ tests (app)…"
  (cd packages/app && npx vitest run)
  echo "→ tests (web)…"
  (cd packages/web && npx vitest run)
  echo ""
  echo ">>> Preflight passed."
fi

# ----------------------------------------------------------------------
# Phase 1: GitHub push
# ----------------------------------------------------------------------

echo ""
echo "---------------------------------------------------"
echo " Phase 1: Push to GitHub"
echo "---------------------------------------------------"
echo ""
echo "Requires gh CLI authenticated (gh auth setup-git), or an SSH key"
echo "registered at https://github.com/settings/keys, or a Personal Access"
echo "Token via the git credential prompt."
echo ""

if confirm "Run sync-session6-to-github.sh?"; then
  bash "$SOURCE/scripts/sync-session6-to-github.sh"
fi

# ----------------------------------------------------------------------
# Phase 2: Migrations
# ----------------------------------------------------------------------

echo ""
echo "---------------------------------------------------"
echo " Phase 2: Apply migrations to Neon"
echo "---------------------------------------------------"
echo ""
echo "Applies the 8 dated migrations against DATABASE_URL:"
echo "  - add-learning"
echo "  - add-agency-sandata-config"
echo "  - add-audit-retention"
echo "  - add-agency-features"
echo "  - add-invite-access-code"
echo "  - add-agency-evv-config"
echo "  - extend-visit-maintenance"
echo "  - add-agency-hhaexchange-config"
echo ""
echo "Idempotent (hasTable / hasColumn guards). The run-migrations-prompted.sh"
echo "helper takes the URL via hidden input — no shell quoting headaches."
echo ""

if confirm "Run run-migrations-prompted.sh?"; then
  bash "$SOURCE/scripts/run-migrations-prompted.sh"
fi

# ----------------------------------------------------------------------
# Phase 3: Smoke test reminders
# ----------------------------------------------------------------------

echo ""
echo "==================================================="
echo " Deploy phases complete — smoke test next"
echo "==================================================="
echo ""
echo "Watch the Vercel build at:"
echo "  https://vercel.com/dashboard → RayHealth project → Deployments"
echo ""
echo "Once it's green, try these in a new terminal:"
echo ""
echo "  # Health check (no auth)"
echo "  curl -s https://rayhealthevv.com/api/healthz"
echo ""
echo "  # Security headers present?"
echo "  curl -sI https://rayhealthevv.com/api/healthz"
echo "  # expect: strict-transport-security, x-frame-options: DENY, content-security-policy"
echo ""
echo "  # Fixture caregiver login (regression)"
echo "  curl -s -X POST -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"test-caregiver-fixture@rayhealthevv.local\",\"password\":\"Test123!Demo\"}' \\"
echo "    https://rayhealthevv.com/api/auth/mobile/login"
echo ""
echo "  # New admin surfaces"
echo "  open https://rayhealthevv.com/admin/settings              # Sandata + HHAeXchange admin"
echo "  open https://rayhealthevv.com/admin/corrections           # VMUR review queue"
echo "  open https://rayhealthevv.com/admin/corrections/tracking  # VMUR history"
echo ""
echo "Heads up: HIPAA-mode work (Neon HIPAA, Vercel BAA, signed risk analysis,"
echo "cyber liability, pen test) is intentionally deferred per your decision."
echo "Do NOT onboard a real agency with real PHI until those items close."
echo "Use the fixture caregiver for any live validation."
