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
export {};
//# sourceMappingURL=run-audit-retention-sweep.d.ts.map