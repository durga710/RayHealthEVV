import type { Knex } from 'knex';
import type { CaregiverCredential } from '../domain/staff.js';
export declare class StaffRepository {
    private readonly db;
    constructor(db: Knex);
    saveCredential(credential: CaregiverCredential): Promise<CaregiverCredential>;
}
//# sourceMappingURL=staff-repository.d.ts.map