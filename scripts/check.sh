#!/usr/bin/env bash
set -euo pipefail

npm run lint
npm run typecheck
npm run test
npm run build
npm run security:scan
npm run sql:scan
