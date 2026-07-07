/**
 * Baseline migration runner — applies the inlined `schema.ts` migrations
 * idempotently via knex.schema.hasTable/hasColumn guards. Invoked by
 * `npm run db:migrate`.
 *
 * Six of the seven other dated 2026-05-11 migrations (learning, sandata,
 * retention, etc.) referenced by an earlier `apply-new-migrations.ts`
 * script live in a separate monorepo and have not been ported into this
 * repo yet. The features that depend on them (Learning Hub, audit
 * retention sweep, agency Sandata config) are tracked as pending
 * engineering work in PROJECT_STATUS.md.
 *
 * `extend-visit-maintenance` and its 2026-06-30 backfill ARE wired in
 * below — VisitMaintenanceRepository's tenant-scoping fix depends on the
 * `agency_id` column they add/populate, so they can't be left orphaned
 * like the rest. Both are idempotent (hasColumn guards / `WHERE agency_id
 * IS NULL`), safe to re-run.
 *
 * Writes status to stderr (not stdout) so the parent shell can pipe stdout
 * for JSON without contamination. No `console.*` calls — keeps `npm run
 * lint` clean and matches the codebase's no-console-in-prod posture.
 */
import { createDb } from '../db/knex.js';
import * as schema from './schema.js';
import * as extendVisitMaintenance from './2026-05-11-extend-visit-maintenance.js';
import * as backfillVisitMaintenanceAgencyId from './2026-06-30-backfill-visit-maintenance-agency-id.js';
import * as addUserAgencies from './2026-07-01-add-user-agencies.js';
import * as addOpenVisitUniqueIndex from './2026-07-06-add-open-visit-unique-index.js';
async function run() {
    const db = createDb();
    process.stderr.write('Running migrations...\n');
    try {
        await schema.up(db);
        await extendVisitMaintenance.up(db);
        await backfillVisitMaintenanceAgencyId.up(db);
        await addUserAgencies.up(db);
        await addOpenVisitUniqueIndex.up(db);
        process.stderr.write('Migrations complete.\n');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        process.stderr.write(`Migration failed: ${message}\n`);
        process.exit(1);
    }
    finally {
        try {
            await db.destroy();
        }
        catch {
            /* swallow — process is exiting */
        }
    }
}
run();
//# sourceMappingURL=runner.js.map