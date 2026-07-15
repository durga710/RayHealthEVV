#!/usr/bin/env node
/**
 * verify-audit-triggers.mjs
 * ─────────────────────────
 * Confirms the database-level append-only / immutability triggers required
 * by the HIPAA Security Policy are still installed and actively enforcing.
 *
 * Referenced by:
 *   - docs/compliance/hipaa/SECURITY_POLICY.md §4.2, §4.5, §5.6
 *   - docs/compliance/hipaa/INCIDENT_RESPONSE.md §5.3 (when ported)
 *
 * Two checks per trigger:
 *   1. Catalog presence — does the trigger exist in pg_trigger?
 *   2. Live enforcement — does an attempted mutation actually raise the
 *      expected exception? (Run inside a transaction that always rolls back.)
 *
 * Usage:
 *   DATABASE_URL=postgres://… node scripts/verify-audit-triggers.mjs
 *
 * Exit codes:
 *   0 — every check passed
 *   1 — one or more checks failed
 *   2 — could not connect to the database
 *
 * No PHI is read. The probe UPDATE/DELETE statements use the all-zero UUID
 * which doesn't match any real row, but the BEFORE-trigger fires before
 * the WHERE clause is evaluated so the expected RAISE EXCEPTION still hits.
 */

import { Client } from 'pg';

const PROBE_UUID = '00000000-0000-0000-0000-000000000000';

const TRIGGERS = [
  {
    name: 'audit_events_block_mutation_trg',
    table: 'audit_events',
    expectedFires: { update: true, delete: true, truncate: true },
    probes: [
      {
        label: 'UPDATE audit_events',
        sql: `UPDATE audit_events SET outcome = 'probe' WHERE id = '${PROBE_UUID}'`,
        expectedSubstring: 'append-only'
      },
      {
        label: 'DELETE audit_events',
        sql: `DELETE FROM audit_events WHERE id = '${PROBE_UUID}'`,
        expectedSubstring: 'append-only'
      },
      {
        label: 'TRUNCATE audit_events',
        sql: 'TRUNCATE audit_events',
        expectedSubstring: 'append-only'
      }
    ]
  },
  {
    name: 'audit_events_archive_block_mutation_trg',
    table: 'audit_events_archive',
    expectedFires: { update: true, delete: true, truncate: true },
    probes: [
      {
        label: 'UPDATE audit_events_archive',
        sql: `UPDATE audit_events_archive SET outcome = 'probe' WHERE id = '${PROBE_UUID}'`,
        expectedSubstring: 'append-only'
      },
      {
        label: 'DELETE audit_events_archive',
        sql: `DELETE FROM audit_events_archive WHERE id = '${PROBE_UUID}'`,
        expectedSubstring: 'append-only'
      },
      {
        label: 'TRUNCATE audit_events_archive',
        sql: 'TRUNCATE audit_events_archive',
        expectedSubstring: 'append-only'
      }
    ]
  },
  {
    name: 'evv_visits_enforce_immutability_trg',
    table: 'evv_visits',
    expectedFires: { update: true, delete: false, truncate: false },
    // Row-level trigger (FOR EACH ROW). The probe must target an actual row
    // — otherwise the trigger never fires and the no-op UPDATE silently
    // succeeds. If the table is empty (fresh deploy, no visits yet) we
    // can't run a live probe; the catalog check alone is what we report.
    rowLevel: true,
    rowLookupSql: 'SELECT id FROM evv_visits LIMIT 1',
    probes: [
      {
        label: 'UPDATE evv_visits SET clock_in_time (immutable column)',
        sqlTemplate: (id) =>
          `UPDATE evv_visits SET clock_in_time = '1970-01-01T00:00:00Z'::timestamptz WHERE id = '${id}'`,
        expectedSubstring: 'immutable'
      }
    ]
  }
];

// Postgres pg_trigger.tgtype bitmask — see src/include/catalog/pg_trigger.h.
// Misreading these is what cost the EVV smoke verification on 2026-05-08;
// documented here so it doesn't happen again.
const TYPE_BITS = {
  ROW: 1 << 0,
  BEFORE: 1 << 1,
  INSERT: 1 << 2,
  DELETE: 1 << 3,
  UPDATE: 1 << 4,
  TRUNCATE: 1 << 5
};

function fmt(label, ok, detail = '') {
  const tag = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  return `  ${tag}  ${label}${detail ? ' — ' + detail : ''}`;
}

async function checkTriggerExists(client, trigger) {
  const result = await client.query(
    `SELECT t.tgtype
       FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE t.tgname = $1 AND c.relname = $2 AND NOT t.tgisinternal`,
    [trigger.name, trigger.table]
  );
  if (result.rows.length === 0) {
    return { ok: false, detail: `not found in pg_trigger on ${trigger.table}` };
  }
  const tgtype = Number(result.rows[0].tgtype);
  const fires = {
    update: Boolean(tgtype & TYPE_BITS.UPDATE),
    delete: Boolean(tgtype & TYPE_BITS.DELETE),
    truncate: Boolean(tgtype & TYPE_BITS.TRUNCATE)
  };
  for (const op of ['update', 'delete', 'truncate']) {
    if (trigger.expectedFires[op] && !fires[op]) {
      return { ok: false, detail: `installed but not firing on ${op.toUpperCase()}` };
    }
  }
  return { ok: true };
}

async function runProbe(client, probe) {
  await client.query('BEGIN');
  try {
    await client.query(probe.sql);
    await client.query('ROLLBACK');
    return { ok: false, detail: 'mutation succeeded — trigger NOT enforcing' };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const msg = String(err.message || err);
    if (probe.expectedSubstring && !msg.toLowerCase().includes(probe.expectedSubstring.toLowerCase())) {
      return { ok: false, detail: `wrong error message: ${msg.slice(0, 120)}` };
    }
    return { ok: true, detail: msg.split('\n')[0].slice(0, 100) };
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('verify-audit-triggers: DATABASE_URL is required');
    process.exit(2);
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
  } catch (err) {
    console.error('verify-audit-triggers: cannot connect to database:', err.message);
    process.exit(2);
  }

  console.log(`verify-audit-triggers — ${new Date().toISOString()}`);
  console.log(`db: ${client.host || '(connection string)'}\n`);

  const results = [];
  for (const trigger of TRIGGERS) {
    console.log(`[${trigger.name} on ${trigger.table}]`);
    const presence = await checkTriggerExists(client, trigger);
    console.log(fmt('catalog presence', presence.ok, presence.detail));
    results.push(presence.ok);

    // Row-level triggers need a real row to fire against. Look one up;
    // if the table is empty, skip the live probe with a clear NOTE so
    // operators know the catalog check is the only signal we have.
    let liveRowId = null;
    if (trigger.rowLevel && trigger.rowLookupSql) {
      const lookup = await client.query(trigger.rowLookupSql);
      liveRowId = lookup.rows[0]?.id ?? null;
      if (!liveRowId) {
        console.log(`  \x1b[33mSKIP\x1b[0m  live probe — no rows in ${trigger.table} (catalog check only)`);
      }
    }
    for (const probe of trigger.probes) {
      const sql = probe.sql ?? (probe.sqlTemplate && liveRowId ? probe.sqlTemplate(liveRowId) : null);
      if (!sql) continue;
      const r = await runProbe(client, { ...probe, sql });
      console.log(fmt(probe.label, r.ok, r.detail));
      results.push(r.ok);
    }
    console.log();
  }

  await client.end();
  const allPass = results.every(Boolean);
  console.log(allPass ? '\x1b[32m✓ all checks passed\x1b[0m' : '\x1b[31m✗ at least one check failed\x1b[0m');
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('verify-audit-triggers: unexpected error:', err);
  process.exit(2);
});
