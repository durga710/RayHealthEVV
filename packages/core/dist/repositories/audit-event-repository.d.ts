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
    /**
     * Paginated timeline list for the admin Audit Events page.
     *
     * Always filters by `agencyId` (agency isolation — a required argument,
     * never optional). Optional filters narrow by `event_type`, `actor_id`,
     * `outcome`, and an `occurred_at` range. Ordered by `occurred_at` DESC.
     *
     * Returns `{ rows, total }` where `total` is the COUNT of rows matching
     * the same filter set (ignoring `limit`/`offset`) so the UI can render
     * accurate pagination.
     *
     * Caller is responsible for clamping `limit` (the route enforces a
     * hard 200 ceiling); this repo accepts whatever it's given but defaults
     * limit to 50 and offset to 0 when unspecified.
     */
    list(params: {
        agencyId: string;
        eventType?: AuditEvent['eventType'];
        actorId?: string;
        outcome?: AuditEvent['outcome'];
        fromIso?: string;
        toIso?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        rows: AuditEvent[];
        total: number;
    }>;
    /**
     * Aggregate retention status for the agency's audit_events. Used by
     * the admin /admin/audit-retention/status endpoint as HIPAA evidence
     * (45 CFR §164.530(j) — 6-year retention floor for audit logs).
     *
     * Returns:
     *   - totalRows         : every audit_event for this agency
     *   - oldestOccurredAt  : ISO timestamp of the earliest record
     *   - eventsLast30Days  : recent activity sanity-check
     *   - eventsApproachingSixYearLimit : rows older than 5y 9m — the
     *                                     bucket that needs cold-storage
     *                                     extraction in the next 90 days
     *
     * Read-only: never mutates audit_events (the table is enforced
     * append-only at the DB layer via `audit_events_block_mutation_trg`).
     */
    getRetentionStats(agencyId: string): Promise<{
        totalRows: number;
        oldestOccurredAt: string | null;
        eventsLast30Days: number;
        eventsApproachingSixYearLimit: number;
    }>;
    protected mapRow(row: AuditEventRow): AuditEvent;
}
export {};
//# sourceMappingURL=audit-event-repository.d.ts.map