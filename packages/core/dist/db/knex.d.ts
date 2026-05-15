import { type Knex } from 'knex';
/**
 * Build the knex config. Pool + connect timeouts are tightened from the
 * 60-second knex defaults so a misconfigured DATABASE_URL fails fast with a
 * real error instead of hanging the script for a minute.
 */
export declare function buildDbConfig(): Knex.Config;
export declare function createDb(): Knex;
//# sourceMappingURL=knex.d.ts.map