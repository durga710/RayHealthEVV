#!/usr/bin/env tsx
/**
 * run-aggregator-submission-sweep.ts
 *
 * Entry point for the unattended EVV aggregator submission sweep. Transmits
 * every verified visit that still owes a Sandata / HHAeXchange transmission,
 * for every agency whose integration is fully configured.
 *
 * Intended to be invoked by GitHub Actions (see
 * .github/workflows/aggregator-submission.yml) or any cron runner with
 * DATABASE_URL in the environment. Runs outside the serverless duration cap,
 * which is why this is a script rather than a Vercel Cron path.
 *
 * Exit code 0 on success, including a run with nothing to submit. Exit code 1
 * when the run itself fails. Individual agency failures do NOT fail the run,
 * they are reported in `errors` and retried on the next run; a single
 * unreachable aggregator must not block every other agency.
 *
 * Output is a single line of JSON for log-parser friendliness. It carries
 * counts and agency ids only, never visit ids or any PHI.
 */

import { createDb } from '@rayhealth/core'
import { runAggregatorSubmissionSweep } from '../services/aggregator-submission-service.js'

function positiveIntFromEnv(name: string): number | undefined {
  const raw = process.env[name]
  if (!raw) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    process.stderr.write(JSON.stringify({ ok: false, error: 'DATABASE_URL is not set' }) + '\n')
    process.exit(1)
  }

  const db = createDb()
  try {
    const summary = await runAggregatorSubmissionSweep(db, {
      lookbackDays: positiveIntFromEnv('AGGREGATOR_SWEEP_LOOKBACK_DAYS'),
      maxVisitsPerAgency: positiveIntFromEnv('AGGREGATOR_SWEEP_MAX_VISITS'),
    })
    process.stdout.write(JSON.stringify({ ok: true, ...summary }) + '\n')
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
