#!/usr/bin/env tsx
/**
 * run-audit-retention-sweep.ts
 *
 * Entry point for the nightly retention sweep. Intended to be invoked by
 * Vercel Cron, GitHub Actions, or a generic cron runner with DATABASE_URL
 * in the environment.
 *
 * Exit code 0 on success (including "no rows to archive"). Exit code 1 on
 * any failure. Output is a single line of JSON for log-parser friendliness.
 */

import { createDb, runAuditRetentionSweep } from '@rayhealth/core'

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    process.stderr.write(
      JSON.stringify({ ok: false, error: 'DATABASE_URL is not set' }) + '\n',
    )
    process.exit(1)
  }

  const db = createDb()
  try {
    const result = await runAuditRetentionSweep(db)
    process.stdout.write(
      JSON.stringify({
        ok: true,
        runId: result.runId,
        rowsArchived: result.rowsArchived,
        rowsPurgedFromHot: result.rowsPurgedFromHot,
        cutoffUsed: result.cutoffUsed.toISOString(),
        durationMs: result.durationMs,
      }) + '\n',
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    process.stderr.write(JSON.stringify({ ok: false, error: message }) + '\n')
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unexpected error'
  process.stderr.write(JSON.stringify({ ok: false, error: message }) + '\n')
  process.exit(1)
})
