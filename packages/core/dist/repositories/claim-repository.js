import { eraStatusToClaimStatus, summarizeAdjustments } from '../services/edi-835.js';
import { decryptCell } from '../security/cell-cipher.js';
function dateOnly(value) {
    if (value instanceof Date)
        return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
}
function toIso(value) {
    if (!value)
        return undefined;
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
function parseReasons(value) {
    if (Array.isArray(value))
        return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch {
            return [];
        }
    }
    return [];
}
export class ClaimRepository {
    constructor(db) {
        this.db = db;
    }
    /** Transactionally insert claims and their lines. Returns the stored claims. */
    async createClaims(claims) {
        if (claims.length === 0)
            return [];
        return this.db.transaction(async (trx) => {
            const created = [];
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
                if (stored)
                    created.push(stored);
            }
            return created;
        });
    }
    async listClaims(agencyId, filter = {}) {
        const limit = Math.min(filter.limit ?? 100, 500);
        const offset = filter.offset ?? 0;
        const applyFilters = (q) => {
            q.where('claims.agency_id', agencyId);
            if (filter.status)
                q.andWhere('claims.status', filter.status);
            if (filter.clientId)
                q.andWhere('claims.client_id', filter.clientId);
            return q;
        };
        const rowsQuery = applyFilters(this.db('claims'))
            .leftJoin('claim_lines', 'claim_lines.claim_id', 'claims.id')
            .groupBy('claims.id')
            .select('claims.*')
            .count('claim_lines.id as line_count')
            .orderBy('claims.created_at', 'desc')
            .limit(limit)
            .offset(offset);
        const countQuery = applyFilters(this.db('claims')).count('claims.id as count');
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
    async getClaim(agencyId, id) {
        return this.getClaimInTrx(this.db, agencyId, id);
    }
    async getClaimInTrx(db, agencyId, id) {
        const row = (await db('claims')
            .where({ id, agency_id: agencyId })
            .first());
        if (!row)
            return null;
        const lineRows = (await db('claim_lines')
            .where({ claim_id: id })
            .orderBy('service_date', 'asc'));
        return { ...this.mapClaim(row), lines: lineRows.map((l) => this.mapLine(l)) };
    }
    /** Update a claim's status. Returns the updated claim, or null if not found. */
    async updateStatus(agencyId, id, patch) {
        const update = {
            status: patch.status,
            updated_at: this.db.fn.now(),
        };
        if (patch.statusReason !== undefined)
            update.status_reason = patch.statusReason;
        if (patch.payerClaimId !== undefined)
            update.payer_claim_id = patch.payerClaimId;
        if (patch.submittedAt !== undefined)
            update.submitted_at = patch.submittedAt;
        const affected = await this.db('claims')
            .where({ id, agency_id: agencyId })
            .update(update);
        if (affected === 0)
            return null;
        return this.getClaim(agencyId, id);
    }
    /**
     * Which of these patient-control-numbers match an existing claim for the
     * agency. Read-only — used to preview an 835 before posting it.
     */
    async matchControlNumbers(agencyId, controlNumbers) {
        const unique = [...new Set(controlNumbers.filter(Boolean))];
        if (unique.length === 0)
            return new Set();
        const rows = (await this.db('claims')
            .where('agency_id', agencyId)
            .whereIn('control_number', unique)
            .select('control_number'));
        return new Set(rows.map((r) => r.control_number));
    }
    /** Recent remittance postings for the agency (newest first), for the UI list. */
    async listRemittances(agencyId, limit = 100) {
        const rows = (await this.db('claim_remittances')
            .where('agency_id', agencyId)
            .orderBy('posted_at', 'desc')
            .limit(Math.min(limit, 500)));
        return rows.map((r) => ({
            id: r.id,
            claimId: r.claim_id ?? null,
            controlNumber: r.control_number,
            matched: Boolean(r.matched),
            statusCode: r.status_code ?? null,
            chargeCents: Number(r.charge_cents ?? 0),
            paidCents: Number(r.paid_cents ?? 0),
            adjustmentCents: Number(r.adjustment_cents ?? 0),
            patientResponsibilityCents: Number(r.patient_responsibility_cents ?? 0),
            traceNumber: r.trace_number ?? null,
            postedAt: r.posted_at instanceof Date
                ? r.posted_at.toISOString()
                : r.posted_at ?? null,
        }));
    }
    /**
     * Post an 835 remittance: for every CLP claim in the file, record a
     * `claim_remittances` row and — when its control_number matches one of our
     * claims — advance that claim's status (paid / denied / rejected), paid_cents,
     * payer_claim_id, and a CAS-derived status_reason. Unmatched postings are
     * kept with claim_id NULL so nothing in the file is silently dropped. Runs in
     * one transaction (all-or-nothing).
     */
    async postEra(agencyId, era) {
        return this.db.transaction(async (trx) => {
            let matched = 0;
            const unmatched = [];
            for (const c of era.claims) {
                const claim = (await trx('claims')
                    .where({ agency_id: agencyId, control_number: c.controlNumber })
                    .first('id'));
                const claimId = claim?.id ?? null;
                if (claimId)
                    matched += 1;
                else
                    unmatched.push(c.controlNumber);
                const adjustmentCents = Math.max(0, c.chargeCents - c.paidCents - c.patientResponsibilityCents);
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
                    adjustment_codes: JSON.stringify(c.adjustments),
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
                        status_reason: summarizeAdjustments(c.adjustments),
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
    async getActiveClaimVisitIds(agencyId) {
        const rows = (await this.db('claim_lines')
            .join('claims', 'claims.id', 'claim_lines.claim_id')
            .where('claims.agency_id', agencyId)
            .whereNot('claims.status', 'void')
            .distinct('claim_lines.visit_id'));
        return new Set(rows.map((r) => r.visit_id));
    }
    /**
     * Units already billed (non-void claims) per client/service-code/date — used
     * to reconstruct remaining authorized units across prior generation runs.
     */
    async getBilledLineUnits(agencyId) {
        const rows = (await this.db('claim_lines')
            .join('claims', 'claims.id', 'claim_lines.claim_id')
            .where('claims.agency_id', agencyId)
            .whereNot('claims.status', 'void')
            .select('claims.client_id as client_id', 'claim_lines.service_code as service_code', 'claim_lines.service_date as service_date', 'claim_lines.units as units'));
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
    async getBillableVisits(agencyId, startIso, endIso) {
        const rows = (await this.db('evv_visits')
            .join('caregivers', 'evv_visits.caregiver_id', 'caregivers.id')
            .leftJoin('clients', 'evv_visits.client_id', 'clients.id')
            .where('caregivers.agency_id', agencyId)
            .andWhere('evv_visits.clock_in_time', '>=', startIso)
            .andWhere('evv_visits.clock_in_time', '<=', endIso)
            .select('evv_visits.id as visit_id', 'evv_visits.client_id as client_id', 'evv_visits.caregiver_id as caregiver_id', 'evv_visits.service_code as service_code', 'evv_visits.clock_in_time as clock_in_time', 'evv_visits.clock_out_time as clock_out_time', 'evv_visits.status as status', 'evv_visits.sandata_status as sandata_status', 'clients.medicaid_number as client_medicaid_number', 'caregivers.npi as caregiver_npi'));
        return rows
            .filter((r) => r.client_id) // a visit with no client snapshot can't be billed
            .map((r) => ({
            visitId: r.visit_id,
            clientId: r.client_id,
            caregiverId: r.caregiver_id,
            serviceCode: r.service_code ?? null,
            clockInTime: r.clock_in_time instanceof Date
                ? r.clock_in_time.toISOString()
                : new Date(r.clock_in_time).toISOString(),
            clockOutTime: r.clock_out_time
                ? r.clock_out_time instanceof Date
                    ? r.clock_out_time.toISOString()
                    : new Date(r.clock_out_time).toISOString()
                : null,
            status: r.status,
            sandataStatus: r.sandata_status ?? null,
            clientMedicaidNumber: decryptCell(r.client_medicaid_number) ?? null,
            caregiverNpi: decryptCell(r.caregiver_npi) ?? null,
        }));
    }
    /** Active + historical authorizations for the agency's clients. */
    async getAgencyAuthorizations(agencyId) {
        const rows = (await this.db('authorizations')
            .join('clients', 'authorizations.client_id', 'clients.id')
            .where('clients.agency_id', agencyId)
            .select('authorizations.id as id', 'authorizations.client_id as client_id', 'authorizations.payer_id as payer_id', 'authorizations.service_code as service_code', 'authorizations.units_authorized as units_authorized', 'authorizations.start_date as start_date', 'authorizations.end_date as end_date'));
        return rows.map((r) => ({
            id: r.id,
            clientId: r.client_id,
            payerId: r.payer_id,
            serviceCode: r.service_code,
            unitsAuthorized: Number(r.units_authorized ?? 0),
            startDate: dateOnly(r.start_date),
            endDate: dateOnly(r.end_date),
        }));
    }
    /** Visits in [startIso, endIso] for payroll aggregation (caregiver scope). */
    async getPayrollVisits(agencyId, startIso, endIso) {
        const rows = (await this.db('evv_visits')
            .join('caregivers', 'evv_visits.caregiver_id', 'caregivers.id')
            .where('caregivers.agency_id', agencyId)
            .andWhere('evv_visits.clock_in_time', '>=', startIso)
            .andWhere('evv_visits.clock_in_time', '<=', endIso)
            .select('evv_visits.caregiver_id as caregiver_id', 'caregivers.first_name as first_name', 'caregivers.last_name as last_name', 'evv_visits.clock_in_time as clock_in_time', 'evv_visits.clock_out_time as clock_out_time', 'evv_visits.status as status', 'evv_visits.service_code as service_code'));
        return rows.map((r) => ({
            caregiverId: r.caregiver_id,
            caregiverFirstName: r.first_name ?? '',
            caregiverLastName: r.last_name ?? '',
            clockInTime: r.clock_in_time instanceof Date
                ? r.clock_in_time.toISOString()
                : new Date(r.clock_in_time).toISOString(),
            clockOutTime: r.clock_out_time
                ? r.clock_out_time instanceof Date
                    ? r.clock_out_time.toISOString()
                    : new Date(r.clock_out_time).toISOString()
                : null,
            status: r.status,
            serviceCode: r.service_code ?? null,
        }));
    }
    /** Agency billing-provider identity for the 837 (R14 columns). */
    async getAgencyBillingProfile(agencyId) {
        const row = (await this.db('agencies').where({ id: agencyId }).first());
        if (!row)
            return null;
        return {
            name: row.name ?? '',
            npi: row.billing_npi ?? row.medicaid_provider_number ?? '',
            taxId: row.billing_tax_id ?? '',
            address1: row.billing_address1 ?? '',
            city: row.billing_city ?? '',
            state: row.billing_state ?? 'PA',
            postalCode: row.billing_postal_code ?? '',
            taxonomyCode: row.billing_taxonomy ?? undefined,
            clearinghouseId: row.clearinghouse_id ?? '',
            medicaidProviderNumber: row.medicaid_provider_number ?? '',
        };
    }
    /** Per-client subscriber info for the 837 subscriber loop. */
    async getClientBillingInfo(agencyId, clientIds) {
        const map = new Map();
        if (clientIds.length === 0)
            return map;
        const rows = (await this.db('clients')
            .where('agency_id', agencyId)
            .whereIn('id', clientIds)
            .select('id', 'first_name', 'last_name', 'date_of_birth', 'medicaid_number'));
        for (const r of rows) {
            map.set(r.id, {
                firstName: r.first_name ?? '',
                lastName: r.last_name ?? '',
                dateOfBirth: r.date_of_birth ? dateOnly(r.date_of_birth) : undefined,
                medicaidNumber: decryptCell(r.medicaid_number) ?? '',
            });
        }
        return map;
    }
    /** Per-visit rendering provider (caregiver) for the 837 service lines. */
    async getVisitRenderingProviders(visitIds) {
        const map = new Map();
        if (visitIds.length === 0)
            return map;
        const rows = (await this.db('evv_visits')
            .join('caregivers', 'evv_visits.caregiver_id', 'caregivers.id')
            .whereIn('evv_visits.id', visitIds)
            .select('evv_visits.id as visit_id', 'caregivers.first_name as first_name', 'caregivers.last_name as last_name', 'caregivers.npi as npi'));
        for (const r of rows) {
            map.set(r.visit_id, {
                firstName: r.first_name ?? '',
                lastName: r.last_name ?? '',
                npi: decryptCell(r.npi) ?? '',
            });
        }
        return map;
    }
    mapClaim(row) {
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
            submittedAt: toIso(row.submitted_at) ?? null,
            createdAt: toIso(row.created_at),
            updatedAt: toIso(row.updated_at),
            lines: [],
        };
    }
    mapLine(row) {
        return {
            id: row.id,
            claimId: row.claim_id,
            visitId: row.visit_id,
            serviceCode: row.service_code,
            serviceDate: dateOnly(row.service_date),
            units: Number(row.units ?? 0),
            minutes: Number(row.minutes ?? 0),
            chargeCents: Number(row.charge_cents ?? 0),
            denialRisk: row.denial_risk,
            denialReasons: parseReasons(row.denial_reasons),
        };
    }
}
//# sourceMappingURL=claim-repository.js.map