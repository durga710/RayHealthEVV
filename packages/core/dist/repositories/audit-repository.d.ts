import type { AuditEvent } from '../domain/audit.js';
import { AuditEventRepository, type NewAuditEvent } from './audit-event-repository.js';
export declare class AuditRepository extends AuditEventRepository {
    append(event: NewAuditEvent): Promise<AuditEvent>;
}
//# sourceMappingURL=audit-repository.d.ts.map