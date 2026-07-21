import { createHash } from 'node:crypto';
import type { Knex } from 'knex';
import { paServiceCodeUnitMinutes } from '../config/pennsylvania.js';

/**
 * Counts of records that would land in a PA audit-defense packet for the
 * given agency and inclusive date range. All four are read-only `COUNT(*)`
 * queries; this repository never writes.
 */
export interface AuditDefenseCounts {
  /** `audit_events` with `occurred_at` in [from, to] for the agency. */
  auditEvents: number;
  /** `visit_maintenance` (VMUR) with `created_at` in [from, to] for the agency. */
  vmurRecords: number;
  /** `evv_visits` with `clock_in_time` in [from, to], scoped to the agency
   *  via the caregiver who clocked it. */
  evvVisits: number;
  /** `caregivers` currently `active` for the agency (as-of-now snapshot). */
  activeCaregivers: number;
}

/** A single row that appears in the streamed PA audit-defense packet. */
export interface AuditDefensePacketRow {
  /** Which data set this row belongs to. */
  recordType: 'audit_event' | 'vmur' | 'evv_visit';
  /** Source-table primary key. */
  id: string;
  /** ISO timestamp identifying when the row happened in the source system. */
  occurredAt: string;
  /** Actor (user/system) most directly responsible, may be null for raw visits. */
  actorId: string | null;
  /** Visit reference where applicable. */
  visitId: string | null;
  /** Caregiver reference where applicable. */
  caregiverId: string | null;
  /** Type-specific JSON-encoded details (event_type, visit status, VMUR
   *  reason/adjustments, …). Kept stable so the manifest hash is reproducible. */
  detailsJson: string;
}

/** Result of building a packet, counts plus the underlying row stream. */
export interface AuditDefensePacket {
  agencyId: string;
  periodFrom: string;
  periodTo: string;
  counts: AuditDefenseCounts;
  rows: AuditDefensePacketRow[];
  /** Hex SHA-256 of the canonical CSV serialisation of `rows` (without the
   *  manifest line). The CSV writer adds this hash to the manifest row so a
   *  PA DHS auditor can re-derive it and confirm the packet was not edited. */
  manifestSha256: string;
}

/** A single open EVV exception row returned by `listOpenExceptions`. */
export interface OpenExceptionRow {
  id: string;
  visitId: string;
  caregiverId: string;
  agencyId: string;
  exceptionType: string;
  reason: string;
  createdAt: string;
  /** Visit clock-in time so coordinators can age the queue. */
  visitClockInTime: string;
  /** Visit status (pending/verified/flagged) for context in the row. */
  visitStatus: string;
}

/** Page of open exceptions with the total open count for pagination. */
export interface OpenExceptionsPage {
  rows: OpenExceptionRow[];
  total: number;
  limit: number;
  offset: number;
}

/** Result of acknowledging an exception (null = not found or wrong agency). */
export interface AcknowledgedException {
  id: string;
  visitId: string;
  exceptionType: string;
  reason: string;
  approvedBy: string;
  approvedAt: string;
}

/** Detailed authorization row with computed unit balance + urgency tier. */
export interface AuthorizationDetailRow {
  id: string;
  clientId: string;
  /** Concatenated client first + last name for display. NOT a PHI export, the
   *  view is admin/coordinator-only via `client.read`. */
  clientName: string;
  payerId: string;
  serviceCode: string;
  startDate: string;
  endDate: string;
  unitsAuthorized: number;
  /** Sum of clock_out − clock_in hours for verified visits assigned to this
   *  client whose clock-in fell inside [start_date, end_date]. 1 hour ≈ 1 unit
   *  for the most common PA personal-care/home-health codes (S5125, T1019).
   *  Documented in `docs/compliance/states/pennsylvania.md`. */
  unitsUsed: number;
  /** `unitsAuthorized − unitsUsed` clamped at 0 (never negative). */
  unitsRemaining: number;
  /** `end_date − asOf` in whole days; negative values mean already expired. */
  daysToExpiry: number;
  /** Bucket the UI uses to pick a color. */
  urgency: 'expired' | 'critical' | 'warning' | 'info' | 'ok';
}

/** Page of authorization detail rows + total count for pagination. */
export interface AuthorizationsPage {
  rows: AuthorizationDetailRow[];
  total: number;
  limit: number;
  offset: number;
  asOf: string;
}

/** Filter selector for `listAuthorizations`. */
export type AuthorizationListFilter =
  | 'active'
  | 'expiring-14d'
  | 'expiring-30d'
  | 'expiring-90d'
  | 'recently-expired';

/** Canonical column order for the packet CSV (used by tests + writers). */
export const AUDIT_DEFENSE_PACKET_COLUMNS = [
  'record_type',
  'id',
  'occurred_at',
  'actor_id',
  'visit_id',
  'caregiver_id',
  'details_json',
] as const satisfies ReadonlyArray<string>;

/**
 * Repository powering the Compliance Engine. Beta scope is read-only previews;
 * the full packet builder (Sandata export bundle, signed manifest, retention
 * sweep hook) lands in follow-up PRs.
 */
export class ComplianceEngineRepository {
  constructor(private readonly db: Knex) {}

  async getAuditDefensePreview(
    agencyId: string,
    fromIso: string,
    toIso: string,
  ): Promise<AuditDefenseCounts> {
    const [auditRow] = await this.db('audit_events')
      .where('agency_id', agencyId)
      .whereBetween('occurred_at', [fromIso, toIso])
      .count<Array<{ count: string }>>('* as count');

    const [vmurRow] = await this.db('visit_maintenance')
      .where('agency_id', agencyId)
      .whereBetween('created_at', [fromIso, toIso])
      .count<Array<{ count: string }>>('* as count');

    // evv_visits has no agency_id directly, join through caregivers.
    const [evvRow] = await this.db('evv_visits')
      .join('caregivers', 'evv_visits.caregiver_id', 'caregivers.id')
      .where('caregivers.agency_id', agencyId)
      .whereBetween('evv_visits.clock_in_time', [fromIso, toIso])
      .count<Array<{ count: string }>>('* as count');

    const [cgRow] = await this.db('caregivers')
      .where({ agency_id: agencyId, status: 'active' })
      .count<Array<{ count: string }>>('* as count');

    return {
      auditEvents: Number(auditRow?.count ?? 0),
      vmurRecords: Number(vmurRow?.count ?? 0),
      evvVisits: Number(evvRow?.count ?? 0),
      activeCaregivers: Number(cgRow?.count ?? 0),
    };
  }

  /**
   * Build a defensible PA audit packet for [fromIso, toIso] (ISO datetimes).
   *
   * Returns a stable, sorted row stream across three sources:
   *  - `audit_events` (occurred_at in window, agency-scoped directly)
   *  - `visit_maintenance` / VMUR (created_at in window, agency-scoped directly)
   *  - `evv_visits` (clock_in_time in window, scoped via `caregivers.agency_id`)
   *
   * Rows are sorted by `occurredAt ASC, id ASC` so the SHA-256 manifest hash is
   * reproducible regardless of which order Postgres returned each subquery in.
   * The hash is computed over the canonical CSV serialisation of the data rows
   * (header line + each row), so a PA DHS auditor can re-derive it from the
   * downloaded packet without trusting the server.
   *
   * This is a read-only build, it does not write the audit event for the
   * export itself. That event must be emitted by the caller (the HTTP route)
   * with `eventType: 'phi.export'` so the actor + correlation id are accurate.
   */
  async buildAuditDefensePacket(
    agencyId: string,
    fromIso: string,
    toIso: string,
  ): Promise<AuditDefensePacket> {
    const counts = await this.getAuditDefensePreview(agencyId, fromIso, toIso);

    const auditRows = await this.db('audit_events')
      .where('agency_id', agencyId)
      .whereBetween('occurred_at', [fromIso, toIso])
      .select(
        'id',
        'occurred_at',
        'actor_id',
        'actor_type',
        'event_type',
        'entity_type',
        'entity_id',
        'outcome',
        'correlation_id',
        'payload',
      );

    const vmurRows = await this.db('visit_maintenance')
      .where('agency_id', agencyId)
      .whereBetween('created_at', [fromIso, toIso])
      .select(
        'id',
        'visit_id',
        'requester_id',
        'reason',
        'status',
        'original_start_time',
        'original_end_time',
        'adjusted_start_time',
        'adjusted_end_time',
        'created_at',
      );

    const visitRows = await this.db('evv_visits')
      .join('caregivers', 'evv_visits.caregiver_id', 'caregivers.id')
      .where('caregivers.agency_id', agencyId)
      .whereBetween('evv_visits.clock_in_time', [fromIso, toIso])
      .select(
        'evv_visits.id as id',
        'evv_visits.assignment_id as assignment_id',
        'evv_visits.caregiver_id as caregiver_id',
        'evv_visits.clock_in_time as clock_in_time',
        'evv_visits.clock_out_time as clock_out_time',
        'evv_visits.status as status',
        'evv_visits.created_at as created_at',
      );

    const toIsoString = (value: unknown): string => {
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
      }
      return '';
    };

    const parsePayload = (
      raw: unknown,
    ): Record<string, unknown> => {
      if (!raw) return {};
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return { _raw: raw };
        }
      }
      if (typeof raw === 'object') return raw as Record<string, unknown>;
      return {};
    };

    const rows: AuditDefensePacketRow[] = [];

    for (const row of auditRows) {
      rows.push({
        recordType: 'audit_event',
        id: String(row.id),
        occurredAt: toIsoString(row.occurred_at),
        actorId: row.actor_id ? String(row.actor_id) : null,
        visitId: null,
        caregiverId: null,
        detailsJson: stableJsonStringify({
          actorType: row.actor_type ?? 'user',
          eventType: row.event_type,
          entityType: row.entity_type,
          entityId: row.entity_id,
          outcome: row.outcome ?? 'success',
          correlationId: row.correlation_id ?? null,
          payload: parsePayload(row.payload),
        }),
      });
    }

    for (const row of vmurRows) {
      rows.push({
        recordType: 'vmur',
        id: String(row.id),
        occurredAt: toIsoString(row.created_at),
        actorId: row.requester_id ? String(row.requester_id) : null,
        visitId: row.visit_id ? String(row.visit_id) : null,
        caregiverId: null,
        detailsJson: stableJsonStringify({
          status: row.status,
          reason: row.reason,
          originalStartTime: toIsoString(row.original_start_time) || null,
          originalEndTime: toIsoString(row.original_end_time) || null,
          adjustedStartTime: toIsoString(row.adjusted_start_time) || null,
          adjustedEndTime: toIsoString(row.adjusted_end_time) || null,
        }),
      });
    }

    for (const row of visitRows) {
      rows.push({
        recordType: 'evv_visit',
        id: String(row.id),
        occurredAt: toIsoString(row.clock_in_time),
        actorId: null,
        visitId: String(row.id),
        caregiverId: row.caregiver_id ? String(row.caregiver_id) : null,
        detailsJson: stableJsonStringify({
          assignmentId: row.assignment_id,
          status: row.status,
          clockInTime: toIsoString(row.clock_in_time),
          clockOutTime: toIsoString(row.clock_out_time) || null,
          createdAt: toIsoString(row.created_at) || null,
        }),
      });
    }

    rows.sort((a, b) => {
      if (a.occurredAt < b.occurredAt) return -1;
      if (a.occurredAt > b.occurredAt) return 1;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });

    const manifestSha256 = computePacketHash(rows);

    return {
      agencyId,
      periodFrom: fromIso,
      periodTo: toIso,
      counts,
      rows,
      manifestSha256,
    };
  }

  /**
   * Paginated list of open EVV exceptions (`approved_at IS NULL`) for the
   * agency, joined to `evv_visits` so the row carries the visit's clock-in
   * timestamp (used by the UI to age the queue against the PA DHS 48-hour SLA).
   *
   * Filter `type` accepts one of the four `paExceptionTypes` strings;
   * `limit` is clamped to [1, 200] and `offset` to ≥ 0.
   */
  async listOpenExceptions(
    agencyId: string,
    opts: { type?: string; limit?: number; offset?: number } = {},
  ): Promise<OpenExceptionsPage> {
    const limit = clamp(opts.limit ?? 50, 1, 200);
    const offset = Math.max(0, opts.offset ?? 0);

    const baseScope = () =>
      this.db('evv_exceptions')
        .join('evv_visits', 'evv_exceptions.visit_id', 'evv_visits.id')
        .join('caregivers', 'evv_visits.caregiver_id', 'caregivers.id')
        .where('caregivers.agency_id', agencyId)
        .whereNull('evv_exceptions.approved_at');

    const filtered = () => {
      const q = baseScope();
      if (opts.type) {
        q.where('evv_exceptions.exception_type', opts.type);
      }
      return q;
    };

    const [totalRow] = await filtered().count<Array<{ count: string }>>(
      '* as count',
    );
    const total = Number(totalRow?.count ?? 0);

    const rows = await filtered()
      .orderBy('evv_visits.clock_in_time', 'asc')
      .orderBy('evv_exceptions.id', 'asc')
      .limit(limit)
      .offset(offset)
      .select(
        'evv_exceptions.id as id',
        'evv_exceptions.visit_id as visit_id',
        'evv_exceptions.exception_type as exception_type',
        'evv_exceptions.reason as reason',
        'evv_exceptions.created_at as created_at',
        'evv_visits.caregiver_id as caregiver_id',
        'evv_visits.clock_in_time as visit_clock_in_time',
        'evv_visits.status as visit_status',
        'caregivers.agency_id as agency_id',
      );

    const toIsoString = (value: unknown): string => {
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
      }
      return '';
    };

    return {
      rows: rows.map((row) => ({
        id: String(row.id),
        visitId: String(row.visit_id),
        caregiverId: String(row.caregiver_id),
        agencyId: String(row.agency_id),
        exceptionType: String(row.exception_type),
        reason: String(row.reason),
        createdAt: toIsoString(row.created_at),
        visitClockInTime: toIsoString(row.visit_clock_in_time),
        visitStatus: String(row.visit_status),
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Acknowledge a single open exception: stamps `approved_by` + `approved_at`
   * and returns the resulting row. Returns `null` when:
   *  - the exception does not exist
   *  - the exception belongs to a different agency
   *  - the exception is already acknowledged (idempotent, caller can warn)
   *
   * Does **not** emit the audit event itself, the HTTP route writes a single
   * `exception.approved` event with the actor and correlation id; doing it here
   * would lose the request-scoped context. Updates are wrapped in a transaction
   * so the agency-scope check and the UPDATE land atomically.
   */
  async acknowledgeException(
    agencyId: string,
    exceptionId: string,
    actorId: string,
  ): Promise<AcknowledgedException | null> {
    return this.db.transaction(async (trx) => {
      const exception = await trx('evv_exceptions')
        .join('evv_visits', 'evv_exceptions.visit_id', 'evv_visits.id')
        .join('caregivers', 'evv_visits.caregiver_id', 'caregivers.id')
        .where('evv_exceptions.id', exceptionId)
        .andWhere('caregivers.agency_id', agencyId)
        .first<{
          id: string;
          visit_id: string;
          exception_type: string;
          reason: string;
          approved_at: Date | string | null;
        }>(
          'evv_exceptions.id as id',
          'evv_exceptions.visit_id as visit_id',
          'evv_exceptions.exception_type as exception_type',
          'evv_exceptions.reason as reason',
          'evv_exceptions.approved_at as approved_at',
        );

      if (!exception) return null;
      if (exception.approved_at) return null;

      const approvedAt = new Date().toISOString();
      await trx('evv_exceptions')
        .where({ id: exceptionId })
        .update({
          approved_by: actorId,
          approved_at: approvedAt,
        });

      return {
        id: String(exception.id),
        visitId: String(exception.visit_id),
        exceptionType: String(exception.exception_type),
        reason: String(exception.reason),
        approvedBy: actorId,
        approvedAt,
      };
    });
  }

  /**
   * Paginated, agency-scoped detail list of authorizations with computed
   * `unitsUsed` / `unitsRemaining` per row.
   *
   * `unitsUsed` follows the same semantics as claim generation
   * (`claim-generation-service.ts`): a completed visit consumes units on the
   * authorization whose client, service code, and date window it matches.
   * Units convert per `paServiceCodeUnitMinutes`, so 15-minute codes
   * (T1019/S5125/T1004) yield 4 units per hour and per-visit codes (T1021)
   * yield 1 unit per completed visit. Visits with no `service_code` snapshot
   * are unbillable and therefore consume no units, matching how claim
   * generation treats them.
   *
   * The `filter` selector maps to one of the same buckets the overview surface
   * already uses, plus an `expiring-90d` lens for the CHC quarterly review
   * cycle.
   */
  async listAuthorizations(
    agencyId: string,
    opts: {
      asOf: string;
      filter?: AuthorizationListFilter;
      limit?: number;
      offset?: number;
    },
  ): Promise<AuthorizationsPage> {
    const asOfDate = new Date(`${opts.asOf}T00:00:00.000Z`);
    const fmt = (d: Date): string => d.toISOString().slice(0, 10);
    const asOfStr = fmt(asOfDate);
    const horizon14 = fmt(new Date(asOfDate.getTime() + 14 * 86_400_000));
    const horizon30 = fmt(new Date(asOfDate.getTime() + 30 * 86_400_000));
    const horizon90 = fmt(new Date(asOfDate.getTime() + 90 * 86_400_000));
    const recentExpiredStart = fmt(
      new Date(asOfDate.getTime() - 14 * 86_400_000),
    );

    const limit = clamp(opts.limit ?? 25, 1, 200);
    const offset = Math.max(0, opts.offset ?? 0);
    const filter: AuthorizationListFilter = opts.filter ?? 'active';

    const scoped = () =>
      this.db('authorizations')
        .join('clients', 'authorizations.client_id', 'clients.id')
        .where('clients.agency_id', agencyId);

    const applyFilter = (qb: Knex.QueryBuilder): Knex.QueryBuilder => {
      switch (filter) {
        case 'active':
          return qb
            .where('authorizations.start_date', '<=', asOfStr)
            .where('authorizations.end_date', '>=', asOfStr);
        case 'expiring-14d':
          return qb.whereBetween('authorizations.end_date', [asOfStr, horizon14]);
        case 'expiring-30d':
          return qb.whereBetween('authorizations.end_date', [asOfStr, horizon30]);
        case 'expiring-90d':
          return qb.whereBetween('authorizations.end_date', [asOfStr, horizon90]);
        case 'recently-expired':
          return qb
            .where('authorizations.end_date', '<', asOfStr)
            .where('authorizations.end_date', '>=', recentExpiredStart);
      }
    };

    const [totalRow] = await applyFilter(scoped()).count<
      Array<{ count: string }>
    >('* as count');
    const total = Number(totalRow?.count ?? 0);

    interface AuthListBaseRow {
      id: string;
      client_id: string;
      payer_id: string;
      service_code: string;
      units_authorized: number | string;
      start_date: Date | string;
      end_date: Date | string;
      first_name: string | null;
      last_name: string | null;
    }

    const baseRows = (await applyFilter(scoped())
      .orderBy('authorizations.end_date', 'asc')
      .orderBy('authorizations.id', 'asc')
      .limit(limit)
      .offset(offset)
      .select(
        'authorizations.id as id',
        'authorizations.client_id as client_id',
        'authorizations.payer_id as payer_id',
        'authorizations.service_code as service_code',
        'authorizations.units_authorized as units_authorized',
        'authorizations.start_date as start_date',
        'authorizations.end_date as end_date',
        'clients.first_name as first_name',
        'clients.last_name as last_name',
      )) as AuthListBaseRow[];

    // Compute units consumed per visible authorization in a single query,
    // mirroring claim generation: match visits by client + service code +
    // date window, convert per-visit duration to units per the service
    // code's unit basis. Client matching prefers the Cures-Act client_id
    // snapshot (imported historical visits carry the snapshot but no usable
    // assignment chain, R28) and falls back through assignment →
    // visit_template for legacy rows that pre-date the snapshot.
    const idList = baseRows.map((r) => r.id);
    const usedByAuth = new Map<string, number>();
    if (idList.length > 0) {
      // One CASE arm per code in the static paServiceCodeUnitMinutes config,
      // so unit math stays in lockstep with claim generation: 15-minute codes
      // round each visit's minutes to units; per-visit codes (unit minutes 0,
      // T1021) count 1 unit per completed visit; codes outside the config
      // fall back to 1 unit = 1 hour rather than dropping the usage. Every
      // VALUE is a `?` binding, never interpolated into the SQL text (pgAudit
      // logs full statement text on the HIPAA database); only the arm count,
      // fixed by the config's size, shapes the statement.
      const armSql: string[] = [];
      const armBindings: Array<string | number> = [];
      for (const [code, mins] of Object.entries(paServiceCodeUnitMinutes)) {
        if (mins === 0) {
          armSql.push('WHEN authorizations.service_code = ? THEN 1');
          armBindings.push(code);
        } else {
          armSql.push(
            'WHEN authorizations.service_code = ? THEN ROUND(EXTRACT(EPOCH FROM (evv_visits.clock_out_time - evv_visits.clock_in_time)) / 60.0 / ?)',
          );
          armBindings.push(code, mins);
        }
      }
      const unitsExpression = [
        'COALESCE(SUM(CASE',
        ...armSql,
        'ELSE ROUND(EXTRACT(EPOCH FROM (evv_visits.clock_out_time - evv_visits.clock_in_time)) / 3600.0)',
        'END), 0)::float as units',
      ].join(' ');
      const usageRows = await this.db<{ auth_id: string; units: number | string | null }>(
        'authorizations',
      )
        .join('evv_visits', 'evv_visits.service_code', 'authorizations.service_code')
        .leftJoin('assignments', 'evv_visits.assignment_id', 'assignments.id')
        .leftJoin('visit_templates', 'assignments.visit_template_id', 'visit_templates.id')
        .whereIn('authorizations.id', idList)
        .whereRaw(
          'COALESCE(evv_visits.client_id, visit_templates.client_id) = authorizations.client_id',
        )
        .whereNotNull('evv_visits.clock_out_time')
        .andWhereRaw(
          'evv_visits.clock_in_time::date BETWEEN authorizations.start_date AND authorizations.end_date',
        )
        .groupBy('authorizations.id')
        .select(
          'authorizations.id as auth_id',
          this.db.raw(unitsExpression, armBindings),
        );
      for (const u of usageRows) {
        usedByAuth.set(String(u.auth_id), Number(u.units ?? 0));
      }
    }

    const asOfMs = asOfDate.getTime();
    const rows: AuthorizationDetailRow[] = baseRows.map((row) => {
      const endDateStr = String(row.end_date).slice(0, 10);
      const endMs = new Date(`${endDateStr}T00:00:00.000Z`).getTime();
      const daysToExpiry = Math.round((endMs - asOfMs) / 86_400_000);
      const unitsAuthorized = Number(row.units_authorized ?? 0);
      const unitsUsed = Number(usedByAuth.get(String(row.id)) ?? 0);
      const unitsRemaining = Math.max(0, unitsAuthorized - unitsUsed);

      let urgency: AuthorizationDetailRow['urgency'];
      if (daysToExpiry < 0) urgency = 'expired';
      else if (daysToExpiry <= 14) urgency = 'critical';
      else if (daysToExpiry <= 30) urgency = 'warning';
      else if (daysToExpiry <= 90) urgency = 'info';
      else urgency = 'ok';

      return {
        id: String(row.id),
        clientId: String(row.client_id),
        clientName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
        payerId: String(row.payer_id),
        serviceCode: String(row.service_code),
        startDate: String(row.start_date).slice(0, 10),
        endDate: endDateStr,
        unitsAuthorized,
        unitsUsed,
        unitsRemaining,
        daysToExpiry,
        urgency,
      };
    });

    return {
      rows,
      total,
      limit,
      offset,
      asOf: asOfStr,
    };
  }

  /**
   * Authorization-oversight counts for an agency as of `asOf` (YYYY-MM-DD).
   * `authorizations` has no `agency_id` column, so the join goes through
   * `clients`. All four queries are read-only COUNTs.
   */
  async getAuthorizationOversight(
    agencyId: string,
    asOf: string,
  ): Promise<AuthorizationOversightCounts> {
    const asOfDate = new Date(`${asOf}T00:00:00.000Z`);
    const fmt = (d: Date): string => d.toISOString().slice(0, 10);
    const asOfStr = fmt(asOfDate);
    const expiring14End = fmt(new Date(asOfDate.getTime() + 14 * 86_400_000));
    const expiring30End = fmt(new Date(asOfDate.getTime() + 30 * 86_400_000));
    const recentlyExpiredStart = fmt(
      new Date(asOfDate.getTime() - 14 * 86_400_000),
    );

    const baseScope = () =>
      this.db('authorizations')
        .join('clients', 'authorizations.client_id', 'clients.id')
        .where('clients.agency_id', agencyId);

    const [activeRow] = await baseScope()
      .where('authorizations.start_date', '<=', asOfStr)
      .where('authorizations.end_date', '>=', asOfStr)
      .count<Array<{ count: string }>>('* as count');

    const [expiring14Row] = await baseScope()
      .whereBetween('authorizations.end_date', [asOfStr, expiring14End])
      .count<Array<{ count: string }>>('* as count');

    const [expiring30Row] = await baseScope()
      .whereBetween('authorizations.end_date', [asOfStr, expiring30End])
      .count<Array<{ count: string }>>('* as count');

    const [recentlyExpiredRow] = await baseScope()
      .where('authorizations.end_date', '<', asOfStr)
      .where('authorizations.end_date', '>=', recentlyExpiredStart)
      .count<Array<{ count: string }>>('* as count');

    return {
      activeAuthorizations: Number(activeRow?.count ?? 0),
      expiringIn14d: Number(expiring14Row?.count ?? 0),
      expiringIn30d: Number(expiring30Row?.count ?? 0),
      recentlyExpired: Number(recentlyExpiredRow?.count ?? 0),
    };
  }

  /**
   * Aggregate headline KPIs across all seven Compliance Engine modules so the
   * Overview page can render live counts in one round-trip. Runs the seven
   * per-module methods in parallel; the audit-defense window is the trailing
   * 30 days ending at `asOf` (start/end of day UTC).
   */
  async getEngineSummary(
    agencyId: string,
    asOf: string,
  ): Promise<EngineSummary> {
    const asOfDate = new Date(`${asOf}T00:00:00.000Z`);
    const thirtyDaysAgo = new Date(asOfDate.getTime() - 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const [audit, authorizationOversight, exceptionResolution, medicaid, payroll, claims, credentials] =
      await Promise.all([
        this.getAuditDefensePreview(
          agencyId,
          `${thirtyDaysAgo}T00:00:00.000Z`,
          `${asOf}T23:59:59.999Z`,
        ),
        this.getAuthorizationOversight(agencyId, asOf),
        this.getExceptionResolution(agencyId),
        this.getMedicaidWorkflow(agencyId, asOf),
        this.getPayrollReconciliation(agencyId),
        this.getClaimMatching(agencyId),
        this.getCredentialsCompliance(agencyId, asOf),
      ]);

    return {
      auditEventsLast30d: audit.auditEvents,
      activeAuthorizations: authorizationOversight.activeAuthorizations,
      openExceptions: exceptionResolution.openExceptions,
      activeMaCases: medicaid.activeMaCases,
      verifiedHoursLast7d: payroll.verifiedHoursLast7d,
      claimReadyLast7d: claims.verifiedVisitsLast7d,
      activeCredentials: credentials.activeCredentials,
    };
  }

  /**
   * Credentials compliance snapshot for the agency. Counts caregiver_credentials
   * by status, plus expiry windows (30 d / 90 d) and recently-expired (14 d).
   * Joins `caregiver_credentials → caregivers.agency_id` for scope.
   */
  async getCredentialsCompliance(
    agencyId: string,
    asOf: string,
  ): Promise<CredentialsComplianceCounts> {
    const asOfDate = new Date(`${asOf}T00:00:00.000Z`);
    const fmt = (d: Date): string => d.toISOString().slice(0, 10);
    const asOfStr = fmt(asOfDate);
    const horizon30 = fmt(new Date(asOfDate.getTime() + 30 * 86_400_000));
    const horizon90 = fmt(new Date(asOfDate.getTime() + 90 * 86_400_000));
    const recentExpiredStart = fmt(
      new Date(asOfDate.getTime() - 14 * 86_400_000),
    );

    const agencyScope = () =>
      this.db('caregiver_credentials')
        .join('caregivers', 'caregiver_credentials.caregiver_id', 'caregivers.id')
        .where('caregivers.agency_id', agencyId);

    const [activeRow] = await agencyScope()
      .where('caregiver_credentials.status', 'active')
      .count<Array<{ count: string }>>('* as count');
    const [pendingRow] = await agencyScope()
      .where('caregiver_credentials.status', 'pending')
      .count<Array<{ count: string }>>('* as count');
    const [expiredRow] = await agencyScope()
      .where('caregiver_credentials.status', 'expired')
      .count<Array<{ count: string }>>('* as count');
    const [expiring30Row] = await agencyScope()
      .where('caregiver_credentials.status', 'active')
      .whereBetween('caregiver_credentials.expires_at', [asOfStr, horizon30])
      .count<Array<{ count: string }>>('* as count');
    const [expiring90Row] = await agencyScope()
      .where('caregiver_credentials.status', 'active')
      .whereBetween('caregiver_credentials.expires_at', [asOfStr, horizon90])
      .count<Array<{ count: string }>>('* as count');
    const [recentExpiredRow] = await agencyScope()
      .where('caregiver_credentials.expires_at', '<', asOfStr)
      .where('caregiver_credentials.expires_at', '>=', recentExpiredStart)
      .count<Array<{ count: string }>>('* as count');

    return {
      activeCredentials: Number(activeRow?.count ?? 0),
      pendingCredentials: Number(pendingRow?.count ?? 0),
      expiredCredentials: Number(expiredRow?.count ?? 0),
      expiringIn30d: Number(expiring30Row?.count ?? 0),
      expiringIn90d: Number(expiring90Row?.count ?? 0),
      recentlyExpired: Number(recentExpiredRow?.count ?? 0),
    };
  }

  /**
   * Claim Matching readiness snapshot. Uses `evv_visits.status`
   * (pending / verified / flagged) as the claim-readiness signal until a real
   * claims feed lands. Joins `evv_visits → caregivers.agency_id` for scope.
   */
  async getClaimMatching(agencyId: string): Promise<ClaimMatchingCounts> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const agencyScope = () =>
      this.db('evv_visits')
        .join('caregivers', 'evv_visits.caregiver_id', 'caregivers.id')
        .where('caregivers.agency_id', agencyId);

    const [verified7Row] = await agencyScope()
      .where('evv_visits.clock_in_time', '>=', sevenDaysAgo)
      .where('evv_visits.status', 'verified')
      .count<Array<{ count: string }>>('* as count');

    const [verified30Row] = await agencyScope()
      .where('evv_visits.clock_in_time', '>=', thirtyDaysAgo)
      .where('evv_visits.status', 'verified')
      .count<Array<{ count: string }>>('* as count');

    const [flaggedRow] = await agencyScope()
      .where('evv_visits.clock_in_time', '>=', sevenDaysAgo)
      .where('evv_visits.status', 'flagged')
      .count<Array<{ count: string }>>('* as count');

    const [pendingRow] = await agencyScope()
      .where('evv_visits.status', 'pending')
      .count<Array<{ count: string }>>('* as count');

    return {
      verifiedVisitsLast7d: Number(verified7Row?.count ?? 0),
      verifiedVisitsLast30d: Number(verified30Row?.count ?? 0),
      flaggedVisitsLast7d: Number(flaggedRow?.count ?? 0),
      pendingVisits: Number(pendingRow?.count ?? 0),
    };
  }

  /**
   * The ACTIONABLE list behind the claim-readiness counts: the specific visits
   * that are NOT billable yet and WHY, so an owner can clear them before a claim
   * run instead of just seeing a number. A visit blocks billing when it is:
   *   - open    → clocked in but never clocked out (no duration to bill)
   *   - flagged → failed an EVV check, needs review
   *   - pending → awaiting verification
   * Open visits are included regardless of age (a stale open shift is the worst
   * offender); flagged/pending are scoped to the trailing 60 days. Agency-scoped
   * via the caregiver. Capped; `truncated` signals more exist than returned.
   */
  async getClaimReadinessBlockers(
    agencyId: string,
    limit = 100,
  ): Promise<ClaimReadinessBlockers> {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString();

    // Shared filter for both the detail page and the counts, so the counts
    // always describe the FULL matching set even when the list is truncated.
    const blockerScope = () =>
      this.db('evv_visits as v')
        .join('caregivers as cg', 'cg.id', 'v.caregiver_id')
        .where('cg.agency_id', agencyId)
        .andWhere((qb) => {
          qb.where((open) => {
            open.whereNotNull('v.clock_in_time').whereNull('v.clock_out_time');
          })
            .orWhere((flagged) => {
              flagged.where('v.status', 'flagged').andWhere('v.clock_in_time', '>=', sixtyDaysAgo);
            })
            .orWhere((pending) => {
              pending.where('v.status', 'pending').andWhere('v.clock_in_time', '>=', sixtyDaysAgo);
            });
        });

    // Aggregate counts over the whole matching set, bucketed with the same
    // precedence as the row mapper below: open (no clock-out) first, then
    // status. COUNT(*) FILTER is Postgres-specific, which this repo already
    // relies on elsewhere (EXTRACT/::date raw SQL).
    const countRow = await blockerScope().first<{
      open_count: string;
      flagged_count: string;
      pending_count: string;
      total_count: string;
    }>(
      this.db.raw(`
        COUNT(*) FILTER (WHERE v.clock_out_time IS NULL) as open_count,
        COUNT(*) FILTER (WHERE v.clock_out_time IS NOT NULL AND v.status = 'flagged') as flagged_count,
        COUNT(*) FILTER (WHERE v.clock_out_time IS NOT NULL AND v.status = 'pending') as pending_count,
        COUNT(*) as total_count
      `),
    );

    const rows = await blockerScope()
      .leftJoin('assignments as a', 'a.id', 'v.assignment_id')
      .leftJoin('visit_templates as vt', 'vt.id', 'a.visit_template_id')
      .leftJoin('clients as c', 'c.id', 'vt.client_id')
      .orderByRaw('v.clock_in_time ASC NULLS LAST')
      .limit(limit + 1)
      .select(
        'v.id as visit_id',
        'v.status as status',
        'v.clock_in_time',
        'v.clock_out_time',
        'cg.first_name as cg_first',
        'cg.last_name as cg_last',
        'c.first_name as client_first',
        'c.last_name as client_last',
      );

    const truncated = rows.length > limit;
    const page = truncated ? rows.slice(0, limit) : rows;

    const blockers: ClaimBlocker[] = page.map((r) => {
      const reason: ClaimBlockerReason =
        r.clock_in_time && !r.clock_out_time
          ? 'open'
          : r.status === 'flagged'
            ? 'flagged'
            : 'pending';
      return {
        visitId: r.visit_id as string,
        reason,
        clientName: `${r.client_first ?? ''} ${r.client_last ?? ''}`.trim() || 'Unknown client',
        caregiverName: `${r.cg_first ?? ''} ${r.cg_last ?? ''}`.trim() || 'Unknown caregiver',
        clockInTime: r.clock_in_time ? new Date(r.clock_in_time).toISOString() : null,
        clockOutTime: r.clock_out_time ? new Date(r.clock_out_time).toISOString() : null,
      };
    });

    const counts = {
      open: Number(countRow?.open_count ?? 0),
      flagged: Number(countRow?.flagged_count ?? 0),
      pending: Number(countRow?.pending_count ?? 0),
      total: Number(countRow?.total_count ?? 0),
    };

    return { counts, truncated, blockers };
  }

  /**
   * Payroll Reconciliation snapshot from EVV-verified clock events.
   * Uses Postgres `EXTRACT(EPOCH FROM (clock_out_time - clock_in_time))` to
   * compute durations. Joins `evv_visits → caregivers` for agency scope.
   * Counts are over the trailing 7 / 30 days plus a snapshot of currently
   * in-progress visits.
   */
  async getPayrollReconciliation(
    agencyId: string,
  ): Promise<PayrollReconciliationCounts> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const agencyScope = () =>
      this.db('evv_visits')
        .join('caregivers', 'evv_visits.caregiver_id', 'caregivers.id')
        .where('caregivers.agency_id', agencyId);

    // "Verified hours" means exactly that: only visits that passed EVV
    // verification (status='verified') count toward payroll-ready hours.
    // Flagged and pending visits are excluded until they clear review.
    const row7 = await agencyScope()
      .where('evv_visits.clock_in_time', '>=', sevenDaysAgo)
      .whereNotNull('evv_visits.clock_out_time')
      .where('evv_visits.status', 'verified')
      .first<{ hours: number | string | null }>(
        this.db.raw(
          'COALESCE(SUM(EXTRACT(EPOCH FROM (evv_visits.clock_out_time - evv_visits.clock_in_time)) / 3600.0), 0)::float as hours',
        ),
      );

    const row30 = await agencyScope()
      .where('evv_visits.clock_in_time', '>=', thirtyDaysAgo)
      .whereNotNull('evv_visits.clock_out_time')
      .where('evv_visits.status', 'verified')
      .first<{ hours: number | string | null }>(
        this.db.raw(
          'COALESCE(SUM(EXTRACT(EPOCH FROM (evv_visits.clock_out_time - evv_visits.clock_in_time)) / 3600.0), 0)::float as hours',
        ),
      );

    const [completedRow] = await agencyScope()
      .where('evv_visits.clock_in_time', '>=', sevenDaysAgo)
      .whereNotNull('evv_visits.clock_out_time')
      .count<Array<{ count: string }>>('* as count');

    const [inProgressRow] = await agencyScope()
      .whereNotNull('evv_visits.clock_in_time')
      .whereNull('evv_visits.clock_out_time')
      .count<Array<{ count: string }>>('* as count');

    return {
      verifiedHoursLast7d: Number(row7?.hours ?? 0),
      verifiedHoursLast30d: Number(row30?.hours ?? 0),
      completedVisitsLast7d: Number(completedRow?.count ?? 0),
      inProgressVisits: Number(inProgressRow?.count ?? 0),
    };
  }

  /**
   * Medicaid Workflow snapshot for the agency, derived from the authorizations
   * table (joined to clients for agency scope). Distinct-counts give an
   * operational picture before MCO/eligibility tagging exists.
   */
  async getMedicaidWorkflow(
    agencyId: string,
    asOf: string,
  ): Promise<MedicaidWorkflowCounts> {
    const asOfDate = new Date(`${asOf}T00:00:00.000Z`);
    const fmt = (d: Date): string => d.toISOString().slice(0, 10);
    const asOfStr = fmt(asOfDate);
    const thirtyDaysAgo = fmt(new Date(asOfDate.getTime() - 30 * 86_400_000));

    const activeScope = () =>
      this.db('authorizations')
        .join('clients', 'authorizations.client_id', 'clients.id')
        .where('clients.agency_id', agencyId)
        .where('authorizations.start_date', '<=', asOfStr)
        .where('authorizations.end_date', '>=', asOfStr);

    const [casesRow] = await activeScope()
      .countDistinct<Array<{ count: string }>>('authorizations.client_id as count');
    const [payersRow] = await activeScope()
      .countDistinct<Array<{ count: string }>>('authorizations.payer_id as count');
    const [serviceCodesRow] = await activeScope()
      .countDistinct<Array<{ count: string }>>('authorizations.service_code as count');

    const [newAuthsRow] = await this.db('authorizations')
      .join('clients', 'authorizations.client_id', 'clients.id')
      .where('clients.agency_id', agencyId)
      .where('authorizations.created_at', '>=', `${thirtyDaysAgo}T00:00:00.000Z`)
      .count<Array<{ count: string }>>('* as count');

    return {
      activeMaCases: Number(casesRow?.count ?? 0),
      distinctPayers: Number(payersRow?.count ?? 0),
      distinctServiceCodes: Number(serviceCodesRow?.count ?? 0),
      newAuthsLast30d: Number(newAuthsRow?.count ?? 0),
    };
  }

  /**
   * Unified open-exception counts for the agency, plus VMUR pending.
   * Joins `evv_exceptions → evv_visits → caregivers.agency_id` since
   * exceptions have no `agency_id`. "Open" means `approved_at IS NULL`.
   */
  async getExceptionResolution(
    agencyId: string,
  ): Promise<ExceptionResolutionCounts> {
    const openScope = () =>
      this.db('evv_exceptions')
        .join('evv_visits', 'evv_exceptions.visit_id', 'evv_visits.id')
        .join('caregivers', 'evv_visits.caregiver_id', 'caregivers.id')
        .where('caregivers.agency_id', agencyId)
        .whereNull('evv_exceptions.approved_at');

    const [openRow] = await openScope().count<Array<{ count: string }>>(
      '* as count',
    );
    const [lateRow] = await openScope()
      .where('evv_exceptions.exception_type', 'late-clock-in')
      .count<Array<{ count: string }>>('* as count');
    const [missingRow] = await openScope()
      .where('evv_exceptions.exception_type', 'missing-location')
      .count<Array<{ count: string }>>('* as count');
    const [manualRow] = await openScope()
      .where('evv_exceptions.exception_type', 'manual-entry')
      .count<Array<{ count: string }>>('* as count');
    const [telephonyRow] = await openScope()
      .where('evv_exceptions.exception_type', 'telephony-fallback')
      .count<Array<{ count: string }>>('* as count');

    const [vmurRow] = await this.db('visit_maintenance')
      .where({ agency_id: agencyId, status: 'pending' })
      .count<Array<{ count: string }>>('* as count');

    return {
      openExceptions: Number(openRow?.count ?? 0),
      lateClockInOpen: Number(lateRow?.count ?? 0),
      missingLocationOpen: Number(missingRow?.count ?? 0),
      manualEntryOpen: Number(manualRow?.count ?? 0),
      telephonyFallbackOpen: Number(telephonyRow?.count ?? 0),
      vmurPending: Number(vmurRow?.count ?? 0),
    };
  }

  /**
   * Agency-wide operational snapshot of TODAY's scheduled visits, the heart of
   * the owner command center. Joins assignments scheduled today (UTC) →
   * visit_templates → clients (agency scope) and LEFT JOINs the latest EVV visit
   * per assignment to classify each into one bucket:
   *   - completed  : visit clocked out
   *   - inProgress : clocked in, not yet out
   *   - lateStart  : scheduled start already passed (> grace) with no clock-in, needs action NOW
   *   - upcoming   : scheduled later today, not started
   * `lateStart` is the actionable "no-show risk" bucket an owner must chase.
   * Counts only, no PHI rows leave the DB.
   */
  async getTodaysVisitOps(agencyId: string, nowIso: string): Promise<TodaysVisitOps> {
    const now = new Date(nowIso);
    const graceMs = 15 * 60 * 1000;

    const rows = await this.db('assignments as a')
      .join('visit_templates as vt', 'vt.id', 'a.visit_template_id')
      .join('clients as c', 'c.id', 'vt.client_id')
      .leftJoin(
        this.db.raw(
          `(
            SELECT DISTINCT ON (assignment_id)
              assignment_id, clock_in_time, clock_out_time
            FROM evv_visits
            WHERE clock_in_time >= (now() - interval '2 days')
            ORDER BY assignment_id, clock_in_time DESC
          ) as v`,
        ),
        'v.assignment_id',
        'a.id',
      )
      .where('c.agency_id', agencyId)
      .whereRaw("a.scheduled_start_time::date = (now() AT TIME ZONE 'UTC')::date")
      .select(
        'a.id as assignment_id',
        'a.scheduled_start_time',
        'v.clock_in_time',
        'v.clock_out_time',
      );

    let completed = 0;
    let inProgress = 0;
    let lateStart = 0;
    let upcoming = 0;
    for (const r of rows) {
      if (r.clock_out_time) {
        completed++;
      } else if (r.clock_in_time) {
        inProgress++;
      } else {
        const start = r.scheduled_start_time ? new Date(r.scheduled_start_time).getTime() : null;
        if (start !== null && now.getTime() > start + graceMs) lateStart++;
        else upcoming++;
      }
    }

    return {
      scheduledToday: rows.length,
      completed,
      inProgress,
      lateStart,
      upcoming,
    };
  }

  /**
   * Per-visit rows for today's scheduling board, the actionable drill-down
   * behind the command-center "late to start" count. Returns client + caregiver
   * identity (the assigned office staff are authorized to see their own agency's
   * roster) and the raw clock timestamps; the caller derives display status via
   * `deriveTodayVisitStatus`. Agency-scoped through clients.agency_id; ordered by
   * scheduled time so the board reads top-to-bottom through the day.
   */
  async getTodaysVisitBoard(agencyId: string): Promise<TodayVisitBoardRow[]> {
    const rows = await this.db('assignments as a')
      .join('visit_templates as vt', 'vt.id', 'a.visit_template_id')
      .join('clients as c', 'c.id', 'vt.client_id')
      .join('caregivers as cg', 'cg.id', 'a.caregiver_id')
      .leftJoin(
        this.db.raw(
          `(
            SELECT DISTINCT ON (assignment_id)
              assignment_id, clock_in_time, clock_out_time
            FROM evv_visits
            WHERE clock_in_time >= (now() - interval '2 days')
            ORDER BY assignment_id, clock_in_time DESC
          ) as v`,
        ),
        'v.assignment_id',
        'a.id',
      )
      .where('c.agency_id', agencyId)
      .whereRaw("a.scheduled_start_time::date = (now() AT TIME ZONE 'UTC')::date")
      .orderByRaw('a.scheduled_start_time ASC NULLS LAST')
      .select(
        'a.id as assignment_id',
        'a.scheduled_start_time',
        'c.first_name as client_first_name',
        'c.last_name as client_last_name',
        'cg.first_name as caregiver_first_name',
        'cg.last_name as caregiver_last_name',
        'v.clock_in_time',
        'v.clock_out_time',
      );

    return rows.map((r) => ({
      assignmentId: r.assignment_id,
      clientName: `${r.client_first_name ?? ''} ${r.client_last_name ?? ''}`.trim(),
      caregiverName: `${r.caregiver_first_name ?? ''} ${r.caregiver_last_name ?? ''}`.trim(),
      scheduledStartTime: r.scheduled_start_time
        ? new Date(r.scheduled_start_time).toISOString()
        : null,
      clockInTime: r.clock_in_time ? new Date(r.clock_in_time).toISOString() : null,
      clockOutTime: r.clock_out_time ? new Date(r.clock_out_time).toISOString() : null,
    }));
  }
}

/** One row of today's visit board (pre-status-derivation). */
export interface TodayVisitBoardRow {
  assignmentId: string;
  clientName: string;
  caregiverName: string;
  scheduledStartTime: string | null;
  clockInTime: string | null;
  clockOutTime: string | null;
}

/** Agency-wide "today" operational counts for the command center. */
export interface TodaysVisitOps {
  /** Assignments scheduled for today (UTC). */
  scheduledToday: number;
  /** Today's visits already clocked out. */
  completed: number;
  /** Today's visits clocked in but not yet clocked out. */
  inProgress: number;
  /** Scheduled start passed (>15m grace) with no clock-in, needs action now. */
  lateStart: number;
  /** Scheduled later today, not started yet. */
  upcoming: number;
}

/** Counts powering the Authorization Oversight compliance lens. */
export interface AuthorizationOversightCounts {
  /** Authorizations whose [start_date, end_date] window contains `asOf`. */
  activeAuthorizations: number;
  /** Authorizations ending in (asOf, asOf + 14d]. */
  expiringIn14d: number;
  /** Authorizations ending in (asOf, asOf + 30d]. */
  expiringIn30d: number;
  /** Authorizations that ended in [asOf - 14d, asOf). */
  recentlyExpired: number;
}

/** Headline KPIs across all Compliance Engine modules for the Overview page. */
export interface EngineSummary {
  /** audit_events in the trailing 30 days. */
  auditEventsLast30d: number;
  /** Authorizations active as of `asOf`. */
  activeAuthorizations: number;
  /** Open EVV exceptions (approved_at IS NULL). */
  openExceptions: number;
  /** Distinct clients with at least one active authorization. */
  activeMaCases: number;
  /** Sum of verified clock-out − clock-in hours in trailing 7 days. */
  verifiedHoursLast7d: number;
  /** EVV visits with `status='verified'` in trailing 7 days. */
  claimReadyLast7d: number;
  /** caregiver_credentials with `status='active'`. */
  activeCredentials: number;
}

/** Counts powering the Credentials Compliance snapshot. */
export interface CredentialsComplianceCounts {
  /** caregiver_credentials with `status='active'` for the agency. */
  activeCredentials: number;
  /** caregiver_credentials with `status='pending'`. */
  pendingCredentials: number;
  /** caregiver_credentials with `status='expired'`. */
  expiredCredentials: number;
  /** Active credentials expiring in (asOf, asOf + 30d]. */
  expiringIn30d: number;
  /** Active credentials expiring in (asOf, asOf + 90d]. */
  expiringIn90d: number;
  /** Credentials whose `expires_at` fell in [asOf - 14d, asOf). */
  recentlyExpired: number;
}

/** Counts powering the Claim Matching readiness snapshot. */
export interface ClaimMatchingCounts {
  /** EVV visits with `status='verified'` in the trailing 7 days (claim-ready). */
  verifiedVisitsLast7d: number;
  /** EVV visits with `status='verified'` in the trailing 30 days. */
  verifiedVisitsLast30d: number;
  /** EVV visits with `status='flagged'` in the trailing 7 days (not claim-ready). */
  flaggedVisitsLast7d: number;
  /** EVV visits with `status='pending'` (in-flight, not yet verified). */
  pendingVisits: number;
}

/** Why a visit can't be billed yet. */
export type ClaimBlockerReason = 'open' | 'flagged' | 'pending';

/** One non-billable visit with the reason it's blocked. */
export interface ClaimBlocker {
  visitId: string;
  reason: ClaimBlockerReason;
  clientName: string;
  caregiverName: string;
  clockInTime: string | null;
  clockOutTime: string | null;
}

/** Actionable claim-readiness blockers: the visits standing between you and a clean claim run. */
export interface ClaimReadinessBlockers {
  /** Counts over the FULL matching set, not just the returned page. */
  counts: { open: number; flagged: number; pending: number; total: number };
  /** True when more blockers exist than were returned (refine / paginate). */
  truncated: boolean;
  blockers: ClaimBlocker[];
}

/** Counts powering the Payroll Reconciliation snapshot. */
export interface PayrollReconciliationCounts {
  /** Hours (clock_out - clock_in) of `status='verified'` visits in the trailing 7 days. */
  verifiedHoursLast7d: number;
  /** Hours (clock_out - clock_in) of `status='verified'` visits in the trailing 30 days. */
  verifiedHoursLast30d: number;
  /** Visits with both clock-in and clock-out in the trailing 7 days. */
  completedVisitsLast7d: number;
  /** Visits with clock-in but no clock-out yet (currently in-progress shifts). */
  inProgressVisits: number;
}

/** Counts powering the Medicaid Workflow snapshot. */
export interface MedicaidWorkflowCounts {
  /** Distinct clients with at least one active authorization on `asOf`. */
  activeMaCases: number;
  /** Distinct `payer_id` values across active authorizations. */
  distinctPayers: number;
  /** Distinct `service_code` values across active authorizations. */
  distinctServiceCodes: number;
  /** Authorizations created in the last 30 days for the agency. */
  newAuthsLast30d: number;
}

/** Counts powering the Exception Resolution unified queue. */
export interface ExceptionResolutionCounts {
  /** All `evv_exceptions` with `approved_at IS NULL` for the agency. */
  openExceptions: number;
  /** Open + `exception_type = 'late-clock-in'`. */
  lateClockInOpen: number;
  /** Open + `exception_type = 'missing-location'`. */
  missingLocationOpen: number;
  /** Open + `exception_type = 'manual-entry'`. */
  manualEntryOpen: number;
  /** Open + `exception_type = 'telephony-fallback'`. */
  telephonyFallbackOpen: number;
  /** `visit_maintenance` with status `pending` for the agency. */
  vmurPending: number;
}

// ---------------------------------------------------------------------------
// Helpers (module-private, exported only via the methods above)
// ---------------------------------------------------------------------------

/** Clamp `n` to the closed interval [lo, hi]. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}

/**
 * Deterministic JSON serialiser: sorts object keys alphabetically at every
 * nesting depth so the resulting string is reproducible across runs. The
 * manifest SHA-256 in the defense packet depends on this stability.
 */
function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const body = entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableJsonStringify(v)}`)
    .join(',');
  return `{${body}}`;
}

/**
 * RFC-4180-style CSV escape: empty stays empty (cleaner output); any string
 * containing `,`, `"`, CR, or LF gets quoted with internal quotes doubled.
 */
function csvEscape(value: string): string {
  if (value === '') return '';
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Render one packet row as a CSV line using the canonical column order
 * (`AUDIT_DEFENSE_PACKET_COLUMNS`). Used by both the manifest-hash computation
 * and the HTTP CSV writer so they agree byte-for-byte.
 */
export function auditPacketRowToCsv(row: AuditDefensePacketRow): string {
  return [
    row.recordType,
    row.id,
    row.occurredAt,
    row.actorId ?? '',
    row.visitId ?? '',
    row.caregiverId ?? '',
    row.detailsJson,
  ]
    .map(csvEscape)
    .join(',');
}

/**
 * Compute the manifest SHA-256 over the canonical CSV serialisation of the
 * sorted packet rows (header line + one line per row, joined with `\n`). Pure
 * function of `rows`, same input ⇒ same hash.
 */
function computePacketHash(rows: AuditDefensePacketRow[]): string {
  const header = AUDIT_DEFENSE_PACKET_COLUMNS.join(',');
  const body = rows.map(auditPacketRowToCsv).join('\n');
  const canonical = body.length === 0 ? header : `${header}\n${body}`;
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
