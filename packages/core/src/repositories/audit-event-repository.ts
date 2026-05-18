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

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parsePayload(payload: AuditEventRow['payload']): Record<string, unknown> {
  if (!payload) return {};
  return typeof payload === 'string' ? JSON.parse(payload) as Record<string, unknown> : payload;
}

export class AuditEventRepository {
  constructor(protected readonly db: Knex) {}

  async create(event: NewAuditEvent): Promise<AuditEvent> {
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

  async findByEntity(entityType: string, entityId: string): Promise<AuditEvent[]> {
    const rows = await this.db('audit_events')
      .where({ entity_type: entityType, entity_id: entityId })
      .orderBy('occurred_at', 'desc');
    return rows.map((row) => this.mapRow(row));
  }

  async findByAgency(agencyId: string, limit = 100): Promise<AuditEvent[]> {
    const rows = await this.db('audit_events')
      .where({ agency_id: agencyId })
      .orderBy('occurred_at', 'desc')
      .limit(limit);
    return rows.map((row) => this.mapRow(row));
  }

  protected mapRow(row: AuditEventRow): AuditEvent {
    return {
      id: row.id,
      agencyId: row.agency_id,
      actorId: row.actor_id,
      actorType: row.actor_type as AuditEvent['actorType'] ?? 'user',
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
