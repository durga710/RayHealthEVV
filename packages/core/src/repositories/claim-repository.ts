import type { Knex } from 'knex';
import type {
  Claim,
  ClaimLine,
  ClaimStatus,
  DenialRiskLevel,
} from '../domain/billing.js';
import type {
  AuthorizationContext,
  BillableVisit,
} from '../services/claim-generation-service.js';
import type { PayrollVisit } from '../services/payroll-export-service.js';
import type { PaServiceCode } from '../config/pennsylvania.js';
import type { Era835 } from '../services/edi-835.js';
import { allAdjustments, eraStatusToClaimStatus, summarizeAdjustments } from '../services/edi-835.js';
import { decryptCell } from '../security/cell-cipher.js';

export interface EraPostResult {
  posted: number;
  matched: number;
  unmatched: string[];
}

/**
 * Persistence for generated Medicaid claims (`claims` + `claim_lines`).
 *
 * Every query is agency-scoped. Claim creation is transactional (claim header
 * plus all lines, all-or-nothing). The repository also exposes the read paths
 * the generation route needs to avoid double-billing: which visits are already
 * on a live claim, and how many units have already been billed per
 * client/service-code/date (so remaining-authorization checks stay accurate
 * across runs).
 */

export interface ClaimListFilter {
  status?: ClaimStatus;
  clientId?: string;
  limit?: number;
  offset?: number;
}

/** A claim header plus its line count (no lines), for list views. */
export interface ClaimSummary extends Omit<Claim, 'lines'> {
  lineCount: number;
}

export interface ClaimStatusPatch {
  status: ClaimStatus;
  statusReason?: string | null;
  payerClaimId?: string | null;
  submittedAt?: string | null;
  /** Clearinghouse transport reference (remote filename or reference id). */
  transportReference?: string | null;
}

/** A prior-billed line, used to reconstruct remaining authorized units. */
export interface BilledLineUnits {
  clientId: string;
  serviceCode: string;
  serviceDate: string;
  units: number;
}

/** Agency billing-provider identity for the 837 (2010AA loop). */
export interface AgencyBillingProfile {
  name: string;
  npi: string;
  taxId: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  taxonomyCode?: string;
  clearinghouseId: string;
  medicaidProviderNumber: string;
}

export interface ClientBillingInfo {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  medicaidNumber: string;
}

export interface RenderingProvider {
  firstName: string;
  lastName: string;
  npi: string;
}

interface ClaimRow {
  id: string;
  agency_id: string;
  client_id: string;
  payer_id: string;
  period_start: Date | string;
  period_end: Date | string;
  status: ClaimStatus;
  total_units: number | string;
  total_charge_cents: number | string;
  denial_risk: DenialRiskLevel;
  control_number: string | null;
  payer_claim_id: string | null;
  status_reason: string | null;
  submitted_at: Date | string | null;
  transport_reference: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

interface ClaimLineRow {
  id: string;
  claim_id: string;
  visit_id: string;
  service_code: string;
  service_date: Date | string;
  units: number | string;
  minutes: number | string;
  charge_cents: number | string;
  denial_risk: DenialRiskLevel;
  denial_reasons: unknown;
  created_at: Date | string | null;
}

function dateOnly(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseReasons(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export class ClaimRepository {
  constructor(private readonly db: Knex) {}

  /** Transactionally insert claims and their lines. Returns the stored claims. */
  async createClaims(claims: readonly Claim[]): Promise<Claim[]> {
    if (claims.length === 0) return [];

    return this.db.transaction(async (trx) => {
      const created: Claim[] = [];
      for (const claim of claims) {
        const id = claim.id ?? crypto.randomUUID();
        await trx('claims').insert({
          id,
          agency_id: claim.agencyId,
          client_id: claim.clientId,
          payer_id: claim.payerId,
          period_start: claim.periodStart,
          period_end: claim.periodEnd,
          status: claim.status ?? 'draft',
          total_units: claim.totalUnits ?? 0,
          total_charge_cents: claim.totalChargeCents ?? 0,
          denial_risk: claim.denialRisk ?? 'low',
          control_number: claim.controlNumber ?? null,
          payer_claim_id: claim.payerClaimId ?? null,
          status_reason: claim.statusReason ?? null,
          submitted_at: claim.submittedAt ?? null,
        });

        for (const line of claim.lines) {
          await trx('claim_lines').insert({
            id: line.id ?? crypto.randomUUID(),
            claim_id: id,
            visit_id: line.visitId,
            service_code: line.serviceCode,
            service_date: line.serviceDate,
            units: line.units,
            minutes: line.minutes,
            charge_cents: line.chargeCents ?? 0,
            denial_risk: line.denialRisk ?? 'low',
            denial_reasons: JSON.stringify(line.denialReasons ?? []),
          });
        }

        const stored = await this.getClaimInTrx(trx, claim.agencyId, id);
        if (stored) created.push(stored);
      }
      return created;
    });
  }

  async listClaims(
    agencyId: string,
    filter: ClaimListFilter = {},
  ): Promise<{ rows: ClaimSummary[]; total: number }> {
    const limit = Math.min(filter.limit ?? 100, 500);
    const offset = filter.offset ?? 0;

    const applyFilters = (q: Knex.QueryBuilder) => {
      q.where('claims.agency_id', agencyId);
      if (filter.status) q.andWhere('claims.status', filter.status);
      if (filter.clientId) q.andWhere('claims.client_id', filter.clientId);
      return q;
    };

    const rowsQuery = applyFilters(this.db('claims'))
      .leftJoin('claim_lines', 'claim_lines.claim_id', 'claims.id')
      .groupBy('claims.id')
      .select('claims.*')
      .count<{ line_count: string }[]>('claim_lines.id as line_count')
      .orderBy('claims.created_at', 'desc')
      .limit(limit)
      .offset(offset) as unknown as Promise<Array<ClaimRow & { line_count: string }>>;

    const countQuery = applyFilters(this.db('claims')).count<{ count: string }[]>(
      'claims.id as count',
    );

    const [rows, countResult] = await Promise.all([rowsQuery, countQuery]);
    const total = Number(countResult[0]?.count ?? 0);

    return {
      rows: rows.map((r) => ({
        ...this.mapClaim(r),
        lineCount: Number(r.line_count ?? 0),
      })),
      total,
    };
  }

  async getClaim(agencyId: string, id: string): Promise<Claim | null> {
    return this.getClaimInTrx(this.db, agencyId, id);
  }

  private async getClaimInTrx(
    db: Knex | Knex.Transaction,
    agencyId: string,
    id: string,
  ): Promise<Claim | null> {
    const row = (await db('claims')
      .where({ id, agency_id: agencyId })
      .first()) as ClaimRow | undefined;
    if (!row) return null;
    const lineRows = (await db('claim_lines')
      .where({ claim_id: id })
      .orderBy('service_date', 'asc')) as ClaimLineRow[];
    return { ...this.mapClaim(row), lines: lineRows.map((l) => this.mapLine(l)) };
  }

  /** Update a claim's status. Returns the updated claim, or null if not found. */
  async updateStatus(
    agencyId: string,
    id: string,
    patch: ClaimStatusPatch,
  ): Promise<Claim | null> {
    const update: Record<string, unknown> = {
      status: patch.status,
      updated_at: this.db.fn.now(),
    };
    if (patch.statusReason !== undefined) update.status_reason = patch.statusReason;
    if (patch.payerClaimId !== undefined) update.payer_claim_id = patch.payerClaimId;
    if (patch.submittedAt !== undefined) update.submitted_at = patch.submittedAt;
    if (patch.transportReference !== undefined) update.transport_reference = patch.transportReference;

    const affected = await this.db('claims')
      .where({ id, agency_id: agencyId })
      .update(update);
    if (affected === 0) return null;
    return this.getClaim(agencyId, id);
  }

  /**
   * Which of these patient-control-numbers match an existing claim for the
   * agency. Read-only, used to preview an 835 before posting it.
   */
  async matchControlNumbers(agencyId: string, controlNumbers: string[]): Promise<Set<string>> {
    const unique = [...new Set(controlNumbers.filter(Boolean))];
    if (unique.length === 0) return new Set();
    const rows = (await this.db('claims')
      .where('agency_id', agencyId)
      .whereIn('control_number', unique)
      .select('control_number')) as Array<{ control_number: string }>;
    return new Set(rows.map((r) => r.control_number));
  }

  /** Recent remittance postings for the agency (newest first), for the UI list. */
  async listRemittances(
    agencyId: string,
    limit = 100,
  ): Promise<Array<{
    id: string;
    claimId: string | null;
    controlNumber: string;
    matched: boolean;
    statusCode: string | null;
    chargeCents: number;
    paidCents: number;
    adjustmentCents: number;
    patientResponsibilityCents: number;
    traceNumber: string | null;
    postedAt: string | null;
    adjustments: Array<{ group: string; reasonCode: string; amountCents: number }>;
    remarkCodes: string[];
    serviceLines: unknown[];
  }>> {
    const rows = (await this.db('claim_remittances')
      .where('agency_id', agencyId)
      .orderBy('posted_at', 'desc')
      .limit(Math.min(limit, 500))) as Array<Record<string, unknown>>;
    // jsonb columns come back parsed from pg but as strings from some drivers;
    // normalize either way, and default [] for rows that predate R29.
    const asArray = (v: unknown): unknown[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') {
        try { return JSON.parse(v) as unknown[]; } catch { return []; }
      }
      return [];
    };
    return rows.map((r) => ({
      id: r.id as string,
      claimId: (r.claim_id as string | null) ?? null,
      controlNumber: r.control_number as string,
      matched: Boolean(r.matched),
      statusCode: (r.status_code as string | null) ?? null,
      chargeCents: Number(r.charge_cents ?? 0),
      paidCents: Number(r.paid_cents ?? 0),
      adjustmentCents: Number(r.adjustment_cents ?? 0),
      patientResponsibilityCents: Number(r.patient_responsibility_cents ?? 0),
      traceNumber: (r.trace_number as string | null) ?? null,
      postedAt:
        r.posted_at instanceof Date
          ? r.posted_at.toISOString()
          : (r.posted_at as string | null) ?? null,
      adjustments: asArray(r.adjustment_codes) as Array<{
        group: string;
        reasonCode: string;
        amountCents: number;
      }>,
      remarkCodes: asArray(r.remark_codes) as string[],
      serviceLines: asArray(r.service_lines),
    }));
  }

  /**
   * Post an 835 remittance: for every CLP claim in the file, record a
   * `claim_remittances` row and, when its control_number matches one of our
   * claims, advance that claim's status (paid / denied / rejected), paid_cents,
   * payer_claim_id, and a CAS-derived status_reason. Unmatched postings are
   * kept with claim_id NULL so nothing in the file is silently dropped. Runs in
   * one transaction (all-or-nothing).
   */
  async postEra(agencyId: string, era: Era835): Promise<EraPostResult> {
    return this.db.transaction(async (trx) => {
      let matched = 0;
      const unmatched: string[] = [];

      for (const c of era.claims) {
        const claim = (await trx('claims')
          .where({ agency_id: agencyId, control_number: c.controlNumber })
          .first('id')) as { id: string } | undefined;
        const claimId = claim?.id ?? null;
        if (claimId) matched += 1;
        else unmatched.push(c.controlNumber);

        const adjustmentCents = Math.max(
          0,
          c.chargeCents - c.paidCents - c.patientResponsibilityCents,
        );

        // Line-level CAS lives on c.lines since SVC parsing landed; the
        // stored/summarized adjustment set is the full claim roll-up.
        const adjustments = allAdjustments(c);

        await trx('claim_remittances').insert({
          id: trx.raw('gen_random_uuid()'),
          agency_id: agencyId,
          claim_id: claimId,
          control_number: c.controlNumber,
          payer_claim_control_number: c.payerClaimControlNumber,
          status_code: c.statusCode || null,
          charge_cents: c.chargeCents,
          paid_cents: c.paidCents,
          patient_responsibility_cents: c.patientResponsibilityCents,
          adjustment_cents: adjustmentCents,
          adjustment_codes: JSON.stringify(adjustments),
          service_lines: JSON.stringify(c.lines),
          remark_codes: JSON.stringify(c.remarkCodes),
          trace_number: era.traceNumber,
          matched: Boolean(claimId),
        });

        if (claimId) {
          await trx('claims')
            .where({ id: claimId, agency_id: agencyId })
            .update({
              status: eraStatusToClaimStatus(c.derivedStatus),
              paid_cents: c.paidCents,
              payer_claim_id: c.payerClaimControlNumber ?? null,
              status_reason: summarizeAdjustments(adjustments),
              updated_at: trx.fn.now(),
            });
        }
      }

      return { posted: era.claims.length, matched, unmatched };
    });
  }

  /**
   * Visit ids already carried by a non-void claim for this agency. The
   * generation path excludes these so a visit is never billed twice.
   */
  async getActiveClaimVisitIds(agencyId: string): Promise<Set<string>> {
    const rows = (await this.db('claim_lines')
      .join('claims', 'claims.id', 'claim_lines.claim_id')
      .where('claims.agency_id', agencyId)
      .whereNot('claims.status', 'void')
      .distinct('claim_lines.visit_id')) as Array<{ visit_id: string }>;
    return new Set(rows.map((r) => r.visit_id));
  }

  /**
   * Units already billed (non-void claims) per client/service-code/date, used
   * to reconstruct remaining authorized units across prior generation runs.
   */
  async getBilledLineUnits(agencyId: string): Promise<BilledLineUnits[]> {
    const rows = (await this.db('claim_lines')
      .join('claims', 'claims.id', 'claim_lines.claim_id')
      .where('claims.agency_id', agencyId)
      .whereNot('claims.status', 'void')
      .select(
        'claims.client_id as client_id',
        'claim_lines.service_code as service_code',
        'claim_lines.service_date as service_date',
        'claim_lines.units as units',
      )) as Array<{
      client_id: string;
      service_code: string;
      service_date: Date | string;
      units: number | string;
    }>;
    return rows.map((r) => ({
      clientId: r.client_id,
      serviceCode: r.service_code,
      serviceDate: dateOnly(r.service_date),
      units: Number(r.units ?? 0),
    }));
  }

  // ── Source-data reads for generation + 837 assembly ──────────────────────

  /**
   * Verified-or-not visits in [startIso, endIso] for the agency, joined to
   * client (decrypted Medicaid id) and caregiver (decrypted NPI). The
   * generation service decides billability; this just supplies the rows.
   */
  async getBillableVisits(
    agencyId: string,
    startIso: string,
    endIso: string,
  ): Promise<BillableVisit[]> {
    const rows = (await this.db('evv_visits')
      .join('caregivers', 'evv_visits.caregiver_id', 'caregivers.id')
      .leftJoin('clients', 'evv_visits.client_id', 'clients.id')
      .where('caregivers.agency_id', agencyId)
      // Imported historical visits (external_id set) were already adjudicated
      // and billed by the prior platform , generating claims from them would
      // double-bill the payer on cutover. They stay visible everywhere else.
      .whereNull('evv_visits.external_id')
      .andWhere('evv_visits.clock_in_time', '>=', startIso)
      .andWhere('evv_visits.clock_in_time', '<=', endIso)
      .select(
        'evv_visits.id as visit_id',
        'evv_visits.client_id as client_id',
        'evv_visits.caregiver_id as caregiver_id',
        'evv_visits.service_code as service_code',
        'evv_visits.clock_in_time as clock_in_time',
        'evv_visits.clock_out_time as clock_out_time',
        'evv_visits.status as status',
        'evv_visits.sandata_status as sandata_status',
        'clients.medicaid_number as client_medicaid_number',
        'caregivers.npi as caregiver_npi',
      )) as Array<Record<string, unknown>>;

    return rows
      .filter((r) => r.client_id) // a visit with no client snapshot can't be billed
      .map((r) => ({
        visitId: r.visit_id as string,
        clientId: r.client_id as string,
        caregiverId: r.caregiver_id as string,
        serviceCode: (r.service_code as PaServiceCode | null) ?? null,
        clockInTime:
          r.clock_in_time instanceof Date
            ? r.clock_in_time.toISOString()
            : new Date(r.clock_in_time as string).toISOString(),
        clockOutTime: r.clock_out_time
          ? r.clock_out_time instanceof Date
            ? r.clock_out_time.toISOString()
            : new Date(r.clock_out_time as string).toISOString()
          : null,
        status: r.status as BillableVisit['status'],
        sandataStatus: (r.sandata_status as string | null) ?? null,
        clientMedicaidNumber: decryptCell(r.client_medicaid_number as string | null) ?? null,
        caregiverNpi: decryptCell(r.caregiver_npi as string | null) ?? null,
      }));
  }

  /** Active + historical authorizations for the agency's clients. */
  async getAgencyAuthorizations(agencyId: string): Promise<AuthorizationContext[]> {
    const rows = (await this.db('authorizations')
      .join('clients', 'authorizations.client_id', 'clients.id')
      .where('clients.agency_id', agencyId)
      .select(
        'authorizations.id as id',
        'authorizations.client_id as client_id',
        'authorizations.payer_id as payer_id',
        'authorizations.service_code as service_code',
        'authorizations.units_authorized as units_authorized',
        'authorizations.start_date as start_date',
        'authorizations.end_date as end_date',
      )) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: r.id as string,
      clientId: r.client_id as string,
      payerId: r.payer_id as string,
      serviceCode: r.service_code as string,
      unitsAuthorized: Number(r.units_authorized ?? 0),
      startDate: dateOnly(r.start_date as Date | string),
      endDate: dateOnly(r.end_date as Date | string),
    }));
  }

  /** Visits in [startIso, endIso] for payroll aggregation (caregiver scope). */
  async getPayrollVisits(
    agencyId: string,
    startIso: string,
    endIso: string,
  ): Promise<PayrollVisit[]> {
    const rows = (await this.db('evv_visits')
      .join('caregivers', 'evv_visits.caregiver_id', 'caregivers.id')
      .where('caregivers.agency_id', agencyId)
      .andWhere('evv_visits.clock_in_time', '>=', startIso)
      .andWhere('evv_visits.clock_in_time', '<=', endIso)
      .select(
        'evv_visits.caregiver_id as caregiver_id',
        'caregivers.first_name as first_name',
        'caregivers.last_name as last_name',
        'evv_visits.clock_in_time as clock_in_time',
        'evv_visits.clock_out_time as clock_out_time',
        'evv_visits.status as status',
        'evv_visits.service_code as service_code',
      )) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      caregiverId: r.caregiver_id as string,
      caregiverFirstName: (r.first_name as string) ?? '',
      caregiverLastName: (r.last_name as string) ?? '',
      clockInTime:
        r.clock_in_time instanceof Date
          ? r.clock_in_time.toISOString()
          : new Date(r.clock_in_time as string).toISOString(),
      clockOutTime: r.clock_out_time
        ? r.clock_out_time instanceof Date
          ? r.clock_out_time.toISOString()
          : new Date(r.clock_out_time as string).toISOString()
        : null,
      status: r.status as PayrollVisit['status'],
      serviceCode: (r.service_code as string | null) ?? null,
    }));
  }

  /** Agency billing-provider identity for the 837 (R14 columns). */
  async getAgencyBillingProfile(agencyId: string): Promise<AgencyBillingProfile | null> {
    const row = (await this.db('agencies').where({ id: agencyId }).first()) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return {
      name: (row.name as string) ?? '',
      npi: (row.billing_npi as string | null) ?? (row.medicaid_provider_number as string | null) ?? '',
      taxId: (row.billing_tax_id as string | null) ?? '',
      address1: (row.billing_address1 as string | null) ?? '',
      city: (row.billing_city as string | null) ?? '',
      state: (row.billing_state as string | null) ?? 'PA',
      postalCode: (row.billing_postal_code as string | null) ?? '',
      taxonomyCode: (row.billing_taxonomy as string | null) ?? undefined,
      clearinghouseId: (row.clearinghouse_id as string | null) ?? '',
      medicaidProviderNumber: (row.medicaid_provider_number as string | null) ?? '',
    };
  }

  /** Per-client subscriber info for the 837 subscriber loop. */
  async getClientBillingInfo(
    agencyId: string,
    clientIds: readonly string[],
  ): Promise<Map<string, ClientBillingInfo>> {
    const map = new Map<string, ClientBillingInfo>();
    if (clientIds.length === 0) return map;
    const rows = (await this.db('clients')
      .where('agency_id', agencyId)
      .whereIn('id', clientIds as string[])
      .select('id', 'first_name', 'last_name', 'date_of_birth', 'medicaid_number')) as Array<
      Record<string, unknown>
    >;
    for (const r of rows) {
      map.set(r.id as string, {
        firstName: (r.first_name as string) ?? '',
        lastName: (r.last_name as string) ?? '',
        dateOfBirth: r.date_of_birth ? dateOnly(r.date_of_birth as Date | string) : undefined,
        medicaidNumber: decryptCell(r.medicaid_number as string | null) ?? '',
      });
    }
    return map;
  }

  /** Per-visit rendering provider (caregiver) for the 837 service lines. */
  async getVisitRenderingProviders(
    visitIds: readonly string[],
  ): Promise<Map<string, RenderingProvider>> {
    const map = new Map<string, RenderingProvider>();
    if (visitIds.length === 0) return map;
    const rows = (await this.db('evv_visits')
      .join('caregivers', 'evv_visits.caregiver_id', 'caregivers.id')
      .whereIn('evv_visits.id', visitIds as string[])
      .select(
        'evv_visits.id as visit_id',
        'caregivers.first_name as first_name',
        'caregivers.last_name as last_name',
        'caregivers.npi as npi',
      )) as Array<Record<string, unknown>>;
    for (const r of rows) {
      map.set(r.visit_id as string, {
        firstName: (r.first_name as string) ?? '',
        lastName: (r.last_name as string) ?? '',
        npi: decryptCell(r.npi as string | null) ?? '',
      });
    }
    return map;
  }

  private mapClaim(row: ClaimRow): Claim {
    return {
      id: row.id,
      agencyId: row.agency_id,
      clientId: row.client_id,
      payerId: row.payer_id,
      periodStart: dateOnly(row.period_start),
      periodEnd: dateOnly(row.period_end),
      status: row.status,
      totalUnits: Number(row.total_units ?? 0),
      totalChargeCents: Number(row.total_charge_cents ?? 0),
      denialRisk: row.denial_risk,
      controlNumber: row.control_number ?? undefined,
      payerClaimId: row.payer_claim_id,
      statusReason: row.status_reason,
      transportReference: row.transport_reference ?? null,
      submittedAt: toIso(row.submitted_at) ?? null,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      lines: [],
    };
  }

  private mapLine(row: ClaimLineRow): ClaimLine {
    return {
      id: row.id,
      claimId: row.claim_id,
      visitId: row.visit_id,
      serviceCode: row.service_code as ClaimLine['serviceCode'],
      serviceDate: dateOnly(row.service_date),
      units: Number(row.units ?? 0),
      minutes: Number(row.minutes ?? 0),
      chargeCents: Number(row.charge_cents ?? 0),
      denialRisk: row.denial_risk,
      denialReasons: parseReasons(row.denial_reasons),
    };
  }
}
