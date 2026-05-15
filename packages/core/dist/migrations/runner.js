/**
 * Minimal baseline-only migration runner. For the full set of dated
 * migrations use `packages/core/scripts/apply-new-migrations.ts` instead.
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