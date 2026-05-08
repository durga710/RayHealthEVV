import type { Knex } from 'knex';
import type { VisitMaintenance } from '../domain/visit-maintenance.js';
export declare class VisitMaintenanceRepository {
    private readonly db;
    constructor(db: Knex);
    requestUnlock(maintenance: VisitMaintenance): Promise<VisitMaintenance>;
    approveUnlock(id: string, adjustedTimes: {
        start: string;
        end: string;
    }): Promise<VisitMaintenance | null>;
    private mapRowToMaintenance;
}
//# sourceMappingURL=visit-maintenance-repository.d.ts.map