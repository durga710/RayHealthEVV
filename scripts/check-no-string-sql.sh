#!/usr/bin/env bash
#
# Guardrail: no string-built SQL in the server data layer.
#
# Every runtime query must be parameterized ($1/$2 placeholders + a bindings
# array) so no value is ever embedded in the SQL statement text. This matters
# twice over:
#   1. Injection safety.
#   2. Neon runs in HIPAA mode with pgAudit preloaded, which logs full SQL
#      *statement text*. A value interpolated into the SQL would land in the
#      audit log in cleartext — a PHI leak. Bound parameters are NOT logged
#      (pgaudit.log_parameter is off), so parameterized SQL keeps PHI out.
#
# Legitimately NOT scanned: packages/*/src/migrations/** — DDL there must
# interpolate *identifiers* (table / index / constraint names) from hardcoded
# developer constants, which cannot be parameterized and never carry PHI or
# user input. Tests and build output are likewise out of scope.
#
# Run locally:  npm run sql:scan
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Knex / pg methods whose first argument is raw SQL text.
BUILDERS='raw|whereRaw|orWhereRaw|andWhereRaw|havingRaw|orHavingRaw|orderByRaw|groupByRaw|joinRaw|fromRaw|unionRaw|query'

# (a) a builder call whose first arg is a template literal with an interpolation:
#        knex.raw(`... ${value} ...`)
INTERP='(?s)\.('"$BUILDERS"')\s*\(\s*`[^`]*\$\{'
# (b) a builder call whose first arg is a string/template literal glued with +:
#        knex.raw('...' + value)
CONCAT='(?s)\.('"$BUILDERS"')\s*\([^)]*?(\x27|"|`)\s*\+'

mapfile -t FILES < <(
  find packages/core/src packages/app/src -type f -name '*.ts' \
    ! -path '*/migrations/*' \
    ! -path '*/__tests__/*' \
    ! -name '*.test.ts' \
    ! -path '*/dist/*' 2>/dev/null | sort
)

fail=0
for f in "${FILES[@]}"; do
  for pat in "$INTERP" "$CONCAT"; do
    match="$(grep -Pzo "$pat" "$f" 2>/dev/null | tr '\0' ' ' | tr -s ' ' || true)"
    if [ -n "$match" ]; then
      echo "✗ ${f}"
      echo "    ${match}"
      fail=1
    fi
  done
done

if [ "$fail" -ne 0 ]; then
  cat >&2 <<'MSG'

String-built SQL detected in the server data layer.
Every value must be a bound parameter, never embedded in the SQL text:

  BAD:   knex.raw(`select * from visits where agency_id = '${agencyId}'`)
  GOOD:  knex.raw('select * from visits where agency_id = $1', [agencyId])

For a dynamic *identifier* (rare), use knex's ?? binding, which escapes it:
  GOOD:  knex.raw('select * from ?? where id = $1', [table, id])

If a hit is a reviewed false positive, narrow the query or add a scoped
exclusion in scripts/check-no-string-sql.sh with a comment explaining why.
MSG
  exit 1
fi

echo "sql:scan — no string-built SQL found (scanned ${#FILES[@]} server source files)."
