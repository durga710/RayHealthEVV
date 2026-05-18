/**
 * Baseline migration runner — applies the inlined `schema.ts` migrations
 * idempotently via knex.schema.hasTable/hasColumn guards. Invoked by
 * `npm run db:migrate`.
 *
 * The eight dated 2026-05-11 migrations (learning, sandata, retention,
 * etc.) referenced by an earlier `apply-new-migrations.ts` script live in
 * a separate monorepo and have not been ported into this repo yet. The
 * features that depend on them (Learning Hub, audit retention sweep,
 * agency Sandata config) are tracked as pending engineering work in
 * PROJECT_STATUS.md.
 *
 * Writes status to stderr (not stdout) so the parent shell can pipe stdout
 * for JSON without contamination. No `console.*` calls — keeps `npm run
 * lint` clean and matches the codebase's no-console-in-prod posture.
 */
import { createDb } from '../db/knex.js';
import * as schema from './schema.js';
async function run() {
    const db = createDb();
    process.stderr.write('Running migrations...\n');
    try {
        await schema.up(db);
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