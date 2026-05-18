import type { AuditEvent } from '../domain/audit.js';
import { AuditEventRepository, type NewAuditEvent } from './audit-event-repository.js';

export class AuditRepository extends AuditEventRepository {
  async append(event: NewAuditEvent): Promise<AuditEvent> {
    return this.create(event);
  }
}
