import { createDb } from '../db/knex.js';
import * as schema from './schema.js';
async function run() {
    const db = createDb();
    console.log('Running migrations...');
    try {
        await schema.up(db);
        console.log('Migrations complete.');
    }
    catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
    finally {
        await db.destroy();
    }
}
run();
//# sourceMappingURL=runner.js.map