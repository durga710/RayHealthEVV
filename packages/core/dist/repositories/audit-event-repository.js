function toIso(value) {
    if (!value)
        return undefined;
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
function parsePayload(payload) {
    if (!payload)
        return {};
    return typeof payload === 'string' ? JSON.parse(payload) : payload;
}
export class AuditEventRepository {
    constructor(db) {
        this.db = db;
    }
    async create(event) {
        const [row] = await this.db('audit_events')
            .insert({
            id: this.db.raw('gen_random_uuid()'),
            agency_id: event.agencyId,
            actor_id: event.actorId,
            actor_type: event.actorType,
            event_type: event.eventType,
            entity_type: event.entityType,
            entity_id: event.entityId,
            outcome: event.outcome,
            correlation_id: event.correlationId ?? null,
            payload: event.payload ?? {},
            occurred_at: event.occurredAt ?? this.db.fn.now()
        })
            .returning('*');
        return this.mapRow(row);
    }
    async findByEntity(entityType, entityId) {
        const rows = await this.db('audit_events')
            .where({ entity_type: entityType, entity_id: entityId })
            .orderBy('occurred_at', 'desc');
        return rows.map((row) => this.mapRow(row));
    }
    async findByAgency(agencyId, limit = 100) {
        const rows = await this.db('audit_events')
            .where({ agency_id: agencyId })
            .orderBy('occurred_at', 'desc')
            .limit(limit);
        return rows.map((row) => this.mapRow(row));
    }
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
    async list(params) {
        const limit = params.limit ?? 50;
        const offset = params.offset ?? 0;
        const applyFilters = (q) => {
            q.where({ agency_id: params.agencyId });
            if (params.eventType)
                q.andWhere({ event_type: params.eventType });
            if (params.actorId)
                q.andWhere({ actor_id: params.actorId });
            if (params.outcome)
                q.andWhere({ outcome: params.outcome });
            if (params.fromIso)
                q.andWhere('occurred_at', '>=', params.fromIso);
            if (params.toIso)
                q.andWhere('occurred_at', '<=', params.toIso);
            return q;
        };
        const rowsQuery = applyFilters(this.db('audit_events'))
            .orderBy('occurred_at', 'desc')
            .limit(limit)
            .offset(offset);
        const countQuery = applyFilters(this.db('audit_events'))
            .count('id as count');
        const [rows, countResult] = await Promise.all([rowsQuery, countQuery]);
        const total = Number(countResult[0]?.count ?? 0);
        return {
            rows: rows.map((row) => this.mapRow(row)),
            total
        };
    }
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
    async getRetentionStats(agencyId) {
        const base = () => this.db('audit_events').where({ agency_id: agencyId });
        const [{ count: totalRowsRaw }] = await base().count('id as count');
        const totalRows = Number(totalRowsRaw ?? 0);
        const oldestRow = await base().orderBy('occurred_at', 'asc').first('occurred_at');
        const oldestOccurredAt = toIso(oldestRow?.occurred_at) ?? null;
        const [{ count: recentRaw }] = await base()
            .whereRaw("occurred_at >= now() - interval '30 days'")
            .count('id as count');
        const eventsLast30Days = Number(recentRaw ?? 0);
        const [{ count: approachingRaw }] = await base()
            .whereRaw("occurred_at < now() - interval '5 years 9 months'")
            .count('id as count');
        const eventsApproachingSixYearLimit = Number(approachingRaw ?? 0);
        return {
            totalRows,
            oldestOccurredAt,
            eventsLast30Days,
            eventsApproachingSixYearLimit
        };
    }
    mapRow(row) {
        return {
            id: row.id,
            agencyId: row.agency_id,
            actorId: row.actor_id,
            actorType: row.actor_type ?? 'user',
            eventType: row.event_type,
            entityType: row.entity_type,
            entityId: row.entity_id,
            outcome: row.outcome ?? 'success',
            correlationId: row.correlation_id ?? undefined,
            payload: parsePayload(row.payload),
            occurredAt: toIso(row.occurred_at),
            createdAt: toIso(row.created_at)
        };
    }
}
//# sourceMappingURL=audit-event-repository.js.map