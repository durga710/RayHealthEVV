#!/usr/bin/env bash
# Regenerate package-lock.json inside a linux/amd64 container so that
# cross-platform optional native bindings (rolldown, esbuild, swc, sharp, …)
# are recorded for every OS the project might run on — not just the host
# this command happens to run on.
#
# Why this script exists
# ----------------------
# npm filters `optionalDependencies` by the current platform during install,
# and the corresponding resolution entries are dropped from package-lock.json
# whenever they don't match. A lockfile regenerated on macOS therefore lacks
# `@rolldown/binding-linux-x64-gnu` and friends, and `npm ci` on Linux CI
# breaks with "Missing X from lock file". The reverse is true on Linux.
#
# Tracked upstream at https://github.com/npm/cli/issues/4828 since 2022 —
# treat as "known design tradeoff, not a bug npm intends to fix."
#
# This script side-steps the issue by running `npm install` inside the same
# OS/arch the CI runners use (Node 22 on ubuntu-latest = linux/amd64),
# regardless of what the developer's host is.
#
# Usage
# -----
#   ./scripts/sync-lockfile.sh             # regenerate, show diff
#   ./scripts/sync-lockfile.sh --check     # exit 1 if lockfile would change
#
# Requirements
# ------------
# - Docker Desktop installed and running (Apple Silicon: Rosetta 2 enabled
#   for linux/amd64 emulation — Docker Desktop ≥ 4.16 handles this transparently)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

CHECK_MODE=0
if [ "${1:-}" = "--check" ]; then
  CHECK_MODE=1
fi

# Locate docker — Docker Desktop on macOS doesn't always put it on PATH
DOCKER=""
if command -v docker >/dev/null 2>&1; then
  DOCKER="docker"
elif [ -x "$HOME/.docker/bin/docker" ]; then
  DOCKER="$HOME/.docker/bin/docker"
  export PATH="$HOME/.docker/bin:$PATH"
else
  echo "ERROR: Docker not found." >&2
  echo "  - macOS:   download Docker Desktop from https://www.docker.com/products/docker-desktop" >&2
  echo "  - Linux:   apt install docker.io / dnf install docker / etc." >&2
  exit 1
fi

if ! "$DOCKER" info >/dev/null 2>&1; then
  echo "ERROR: Docker daemon is not running. Start Docker Desktop and retry." >&2
  exit 1
fi

BEFORE_HASH=""
if [ -f package-lock.json ]; then
  BEFORE_HASH="$(shasum -a 256 package-lock.json | cut -d' ' -f1)"
fi

echo "==> Running npm install inside node:22-bookworm-slim (linux/amd64)..."
"$DOCKER" run --rm --platform=linux/amd64 \
  -v "$ROOT_DIR:/work" \
  -w /work \
  node:22-bookworm-slim \
  bash -c "npm install --legacy-peer-deps --no-audit --no-fund --package-lock-only" >/dev/null

AFTER_HASH=""
if [ -f package-lock.json ]; then
  AFTER_HASH="$(shasum -a 256 package-lock.json | cut -d' ' -f1)"
fi

if [ "$BEFORE_HASH" = "$AFTER_HASH" ]; then
  echo "✅ package-lock.json already in sync — no changes."
  exit 0
fi

echo ""
echo "✅ package-lock.json regenerated. Summary of changes:"
git --no-pager diff --stat package-lock.json 2>/dev/null || true

if [ "$CHECK_MODE" -eq 1 ]; then
  echo ""
  echo "❌ Lockfile drift detected (--check mode). Run without --check to apply." >&2
  git checkout -- package-lock.json 2>/dev/null || true
  exit 1
fi

LINUX_BINDINGS=$(grep -c '"node_modules/@rolldown/binding-linux-x64-gnu"' package-lock.json 2>/dev/null || echo 0)
DARWIN_BINDINGS=$(grep -c '"node_modules/@rolldown/binding-darwin-arm64"' package-lock.json 2>/dev/null || echo 0)

cat <<EOF

Cross-platform binding entries in the new lockfile:
  - @rolldown/binding-linux-x64-gnu:    $LINUX_BINDINGS  (needed by CI)
  - @rolldown/binding-darwin-arm64:     $DARWIN_BINDINGS  (needed by Apple Silicon devs)

Next steps:
  git add package-lock.json
  git commit -m "chore: sync package-lock.json on linux/amd64"
EOF
