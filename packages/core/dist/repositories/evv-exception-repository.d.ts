import type { Knex } from 'knex';
import type { EvvException } from '../domain/evv-exception.js';
export declare class EvvExceptionRepository {
    private readonly db;
    constructor(db: Knex);
    create(exception: Omit<EvvException, 'id'>): Promise<EvvException>;
    approve(id: string, approvedBy: string): Promise<EvvException | undefined>;
    findByVisit(visitId: string): Promise<EvvException[]>;
    private mapRow;
}
//# sourceMappingURL=evv-exception-repository.d.ts.map