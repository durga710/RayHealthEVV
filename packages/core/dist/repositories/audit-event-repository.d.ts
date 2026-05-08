import type { Knex } from 'knex';
import type { AuditEvent } from '../domain/audit.js';
export type NewAuditEvent = Omit<AuditEvent, 'id' | 'createdAt'>;
type AuditEventRow = {
    id: string;
    agency_id: string;
    actor_id: string;
    actor_type?: string | null;
    event_type: AuditEvent['eventType'];
    entity_type: string;
    entity_id: string;
    outcome?: AuditEvent['outcome'] | null;
    correlation_id?: string | null;
    payload?: Record<string, unknown> | string | null;
    occurred_at?: Date | string | null;
    created_at?: Date | string | null;
};
export declare class AuditEventRepository {
    protected readonly db: Knex;
    constructor(db: Knex);
    create(event: NewAuditEvent): Promise<AuditEvent>;
    findByEntity(entityType: string, entityId: string): Promise<AuditEvent[]>;
    findByAgency(agencyId: string, limit?: number): Promise<AuditEvent[]>;
    protected mapRow(row: AuditEventRow): AuditEvent;
}
export {};
//# sourceMappingURL=audit-event-repository.d.ts.map