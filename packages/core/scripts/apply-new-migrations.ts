#!/usr/bin/env tsx
/**
 * apply-new-migrations.ts
 *
 * Applies the four 2026-05-11 dated migrations in order against the
 * DATABASE_URL the runner sees. Each migration is idempotent (uses
 * hasTable / hasColumn guards), so this script is safe to re-run.
 *
 * Order matters:
 *   1. schema.ts             — baseline (agencies, caregivers, clients, etc.)
 *   2. add-learning          — learning_courses, course_enrollments, course_completions
 *   3. add-agency-sandata    — agency_sandata_config
 *   4. add-audit-retention   — audit_events_archive, audit_retention_runs
 *   5. add-agency-features   — adds features JSONB column to agencies
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx packages/core/scripts/apply-new-migrations.ts
 *
 * Output: JSON with each migration's status (ran | already_applied | error).
 */

import { createDb } from '../src/db/knex.js'
import * as baseline from '../src/migrations/schema.js'

// Swallow benign "aborted" rejections raised by the tarn pool when it aborts
// in-flight PendingOperations during db.destroy(). These are on a separate
// promise chain from the destroy's own awaited promise, so a try/catch on
// `await db.destroy()` doesn't catch them. Node 22 crashes the process on
// any unhandled rejection by default — which would pre-empt our JSON output
// even on a successful migration run. Filter narrowly so real errors still
// surface.
process.on('unhandledRejection', (reason: unknown) => {
  if (reason instanceof Error && reason.message === 'aborted') {
    return
  }
  process.stderr.write(
    `Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}\n`,
  )
  process.exit(1)
})
import * as addLearning from '../src/migrations/2026-05-11-add-learning.js'
import * as addSandata from '../src/migrations/2026-05-11-add-agency-sandata-config.js'
import * as addAuditRetention from '../src/migrations/2026-05-11-add-audit-retention.js'
import * as addAgencyFeatures from '../src/migrations/2026-05-11-add-agency-features.js'
import * as addInviteAccessCode from '../src/migrations/2026-05-11-add-invite-access-code.js'
import * as addAgencyEvvConfig from '../src/migrations/2026-05-11-add-agency-evv-config.js'
import * as extendVisitMaintenance from '../src/migrations/2026-05-11-extend-visit-maintenance.js'
import * as addAgencyHhaexchangeConfig from '../src/migrations/2026-05-11-add-agency-hhaexchange-config.js'
import * as addAuditTriggerAndFixArchive from '../src/migrations/2026-06-08-add-audit-events-trigger-and-fix-archive.js'
import type { Knex } from 'knex'

interface MigrationStep {
  name: string
  up: (db: Knex) => Promise<void>
}

const STEPS: MigrationStep[] = [
  { name: 'baseline (schema.ts)', up: baseline.up },
  { name: '2026-05-11-add-learning', up: addLearning.up },
  { name: '2026-05-11-add-agency-sandata-config', up: addSandata.up },
  { name: '2026-05-11-add-audit-retention', up: addAuditRetention.up },
  { name: '2026-05-11-add-agency-features', up: addAgencyFeatures.up },
  { name: '2026-05-11-add-invite-access-code', up: addInviteAccessCode.up },
  { name: '2026-05-11-add-agency-evv-config', up: addAgencyEvvConfig.up },
  { name: '2026-05-11-extend-visit-maintenance', up: extendVisitMaintenance.up },
  { name: '2026-05-11-add-agency-hhaexchange-config', up: addAgencyHhaexchangeConfig.up },
  { name: '2026-06-08-add-audit-events-trigger-and-fix-archive', up: addAuditTriggerAndFixArchive.up },
]

interface StepResult {
  name: string
  status: 'ok' | 'error'
  durationMs: number
  error?: string
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    process.stderr.write('DATABASE_URL is not set; refusing to run migrations blindly.\n')
    process.exit(1)
  }

  const db = createDb()
  const results: StepResult[] = []
  let failedAt: number | null = null

  // Probe the connection FIRST so the operator gets a real error instead of
  // a 60-second hang followed by an opaque tarn-pool abort. The knex config
  // has a 15s acquire timeout, so failures bubble up within that window.
  try {
    process.stderr.write('Probing connection (SELECT 1, 15s timeout)…\n')
    await db.raw('SELECT 1')
    process.stderr.write('Connection OK. Starting migrations.\n\n')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    process.stderr.write(`Connection probe failed: ${message}\n`)
    process.stderr.write('Common fixes:\n')
    process.stderr.write('  - Open Neon dashboard so the project wakes (free tier auto-suspends)\n')
    process.stderr.write('  - Confirm URL has ?sslmode=require\n')
    process.stderr.write('  - If your URL has &channel_binding=require, try removing it —\n')
    process.stderr.write('    some pg client/OS combos hang on it. SCRAM-SHA-256 still works.\n')
    process.stderr.write('  - Confirm the Pooled connection toggle is ON in Neon\n')
    try { await db.destroy() } catch { /* ignore */ }
    process.stdout.write(JSON.stringify({ ok: false, error: message }, null, 2) + '\n')
    process.exit(1)
  }

  try {
    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i]
      const started = Date.now()
      try {
        await step.up(db)
        results.push({ name: step.name, status: 'ok', durationMs: Date.now() - started })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'unexpected error'
        results.push({
          name: step.name,
          status: 'error',
          durationMs: Date.now() - started,
          error: message,
        })
        failedAt = i
        break
      }
    }
  } finally {
    // Swallow destroy errors so they don't mask the real reason a migration
    // failed. The pool will be reaped when the process exits regardless.
    try {
      await db.destroy()
    } catch (destroyErr: unknown) {
      const msg = destroyErr instanceof Error ? destroyErr.message : 'unknown'
      process.stderr.write(`(non-fatal) pool destroy failed: ${msg}\n`)
    }
  }

  process.stdout.write(JSON.stringify({ ok: failedAt === null, results }, null, 2) + '\n')
  process.exit(failedAt === null ? 0 : 1)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unexpected error'
  process.stderr.write(`apply-new-migrations: ${message}\n`)
  process.exit(1)
})
