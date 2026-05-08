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