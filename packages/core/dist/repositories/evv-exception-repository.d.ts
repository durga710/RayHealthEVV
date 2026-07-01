import type { Knex } from 'knex';
import type { EvvException } from '../domain/evv-exception.js';
export declare class EvvExceptionRepository {
    private readonly db;
    constructor(db: Knex);
    create(exception: Omit<EvvException, 'id'>): Promise<EvvException>;
    private mapRow;
}
//# sourceMappingURL=evv-exception-repository.d.ts.map