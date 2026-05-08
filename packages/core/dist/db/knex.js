import knex from 'knex';
export function buildDbConfig() {
    return {
        client: 'pg',
        connection: process.env.DATABASE_URL ?? {
            host: process.env.DB_HOST ?? 'localhost',
            port: Number(process.env.DB_PORT ?? '5432'),
            user: process.env.DB_USER ?? 'postgres',
            password: process.env.DB_PASSWORD ?? 'postgres',
            database: process.env.DB_NAME ?? 'rayhealth'
        }
    };
}
export function createDb() {
    return knex(buildDbConfig());
}
//# sourceMappingURL=knex.js.map