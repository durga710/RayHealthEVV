import { AuditEventRepository } from './audit-event-repository.js';
export class AuditRepository extends AuditEventRepository {
    async append(event) {
        return this.create(event);
    }
}
//# sourceMappingURL=audit-repository.js.map