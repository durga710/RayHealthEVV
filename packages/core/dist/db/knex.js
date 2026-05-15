import knex from 'knex';
/**
 * Build the knex config. Pool + connect timeouts are tightened from the
 * 60-second knex defaults so a misconfigured DATABASE_URL fails fast with a
 * real error instead of hanging the script for a minute.
 */
export function buildDbConfig() {
    const url = process.env.DATABASE_URL;
    const connection = url ?? {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? '5432'),
        user: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        database: process.env.DB_NAME ?? 'rayhealth'
    };
    return {
        client: 'pg',
        connection,
        // Knex defaults to a 60s acquire timeout, which hides cold-start /
        // wrong-host hangs behind a long wait. 15s is plenty for Neon's cold
        // start (typically <5s) and gives a real error message otherwise.
        acquireConnectionTimeout: 15000,
        pool: {
            min: 0,
            max: 10,
            // Time before a pool resource that has been requested but not yet
            // delivered will time out, in ms.
            acquireTimeoutMillis: 15000,
            // Time the pool waits for a new resource to be created before failing.
            createTimeoutMillis: 15000,
            // Time to wait for a resource to be destroyed gracefully on db.destroy().
            destroyTimeoutMillis: 5000,
            idleTimeoutMillis: 30000,
        }
    };
}
export function createDb() {
    return knex(buildDbConfig());
}
//# sourceMappingURL=knex.js.map