import { paServiceCodeUnitMinutes, } from '../config/pennsylvania.js';
const RISK_RANK = { low: 0, medium: 1, high: 2 };
function worstRisk(levels) {
    return levels.reduce((worst, l) => (RISK_RANK[l] > RISK_RANK[worst] ? l : worst), 'low');
}
/** UTC calendar date (YYYY-MM-DD) of an ISO timestamp. */
export function serviceDateOf(iso) {
    return new Date(iso).toISOString().slice(0, 10);
}
/** Whole minutes between two ISO timestamps, floored at 0. */
export function minutesBetween(startIso, endIso) {
    const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
    if (!Number.isFinite(ms))
        return 0;
    return Math.max(0, Math.round(ms / 60000));
}
/**
 * Convert a verified duration into HCPCS billing units.
 *
 *   - Per-visit codes (unitMinutes === 0, e.g. T1021): always 1 unit.
 *   - 15-minute codes: CMS "8-minute rule" — round to the nearest whole unit
 *     (round-half-up). A visit under ~8 minutes yields 0 units and is flagged
 *     downstream as below the minimum billable increment, rather than rounded
 *     up (we never over-bill Medicaid).
 */
export function computeBillingUnits(serviceCode, minutes) {
    const unitMinutes = paServiceCodeUnitMinutes[serviceCode];
    if (unitMinutes <= 0)
        return 1;
    if (minutes <= 0)
        return 0;
    return Math.round(minutes / unitMinutes);
}
function matchAuthorization(visit, serviceDate, authorizations) {
    return authorizations.find((a) => a.clientId === visit.clientId &&
        a.serviceCode === visit.serviceCode &&
        a.startDate <= serviceDate &&
        a.endDate >= serviceDate);
}
/**
 * Generate draft claims from a set of visits, grouped by (client, payer).
 * Returns the claims plus the list of visits that could not be billed and why.
 */
export function generateClaims(input) {
    const newId = input.newId ?? (() => crypto.randomUUID());
    const priorUnits = input.priorUnitsByAuth ?? {};
    // Remaining authorized units, decremented as we allocate within this run.
    const remainingByAuth = new Map();
    for (const a of input.authorizations) {
        remainingByAuth.set(a.id, a.unitsAuthorized - (priorUnits[a.id] ?? 0));
    }
    const unbillable = [];
    // group key = `${clientId} ${payerId}`
    const groups = new Map();
    // Deterministic order: by clock-in time then visit id.
    const visits = [...input.visits].sort((a, b) => a.clockInTime === b.clockInTime
        ? a.visitId.localeCompare(b.visitId)
        : a.clockInTime.localeCompare(b.clockInTime));
    for (const visit of visits) {
        if (!visit.serviceCode) {
            unbillable.push({
                visitId: visit.visitId,
                clientId: visit.clientId,
                reasons: ['No service code recorded on the visit — cannot map to a HCPCS code.'],
            });
            continue;
        }
        if (!visit.clockOutTime) {
            unbillable.push({
                visitId: visit.visitId,
                clientId: visit.clientId,
                reasons: ['Visit has no clock-out — an incomplete visit cannot be billed.'],
            });
            continue;
        }
        const serviceDate = serviceDateOf(visit.clockInTime);
        const auth = matchAuthorization(visit, serviceDate, input.authorizations);
        if (!auth) {
            unbillable.push({
                visitId: visit.visitId,
                clientId: visit.clientId,
                reasons: [
                    `No active ${visit.serviceCode} authorization covers service date ${serviceDate}.`,
                ],
            });
            continue;
        }
        const minutes = minutesBetween(visit.clockInTime, visit.clockOutTime);
        const units = computeBillingUnits(visit.serviceCode, minutes);
        // ---- denial-risk scoring -------------------------------------------------
        const reasons = [];
        const riskFlags = [];
        if (visit.status !== 'verified') {
            reasons.push('Visit is not EVV-verified (status is not "verified").');
            riskFlags.push('high');
        }
        if (units <= 0) {
            reasons.push('Visit duration is below the minimum billable 15-minute unit.');
            riskFlags.push('high');
        }
        const remaining = remainingByAuth.get(auth.id) ?? 0;
        if (units > remaining) {
            reasons.push(`Billed units (${units}) exceed the remaining authorized units (${Math.max(0, remaining)}).`);
            riskFlags.push('high');
        }
        if (!visit.clientMedicaidNumber) {
            reasons.push('Client Medicaid ID is missing — payer will reject the claim.');
            riskFlags.push('high');
        }
        const sandata = visit.sandataStatus ?? null;
        if (sandata === 'rejected') {
            reasons.push('State EVV aggregator (Sandata) rejected this visit.');
            riskFlags.push('high');
        }
        else if (sandata !== 'accepted') {
            reasons.push('Visit not yet accepted by the state EVV aggregator (Sandata).');
            riskFlags.push('medium');
        }
        if (!visit.caregiverNpi) {
            reasons.push('Rendering caregiver NPI is missing.');
            riskFlags.push('medium');
        }
        remainingByAuth.set(auth.id, remaining - units);
        const ratePerUnit = input.ratesByServiceCode?.[visit.serviceCode] ?? 0;
        const chargeCents = ratePerUnit * units;
        if (ratePerUnit <= 0 && units > 0) {
            reasons.push(`No fee-schedule rate configured for ${visit.serviceCode} — charge is $0.00.`);
            riskFlags.push('medium');
        }
        const denialRisk = worstRisk(riskFlags);
        const line = {
            visitId: visit.visitId,
            serviceCode: visit.serviceCode,
            serviceDate,
            units,
            minutes,
            chargeCents,
            denialRisk,
            denialReasons: reasons,
        };
        const key = `${visit.clientId} ${auth.payerId}`;
        const group = groups.get(key);
        if (group) {
            group.lines.push(line);
        }
        else {
            groups.set(key, { clientId: visit.clientId, payerId: auth.payerId, lines: [line] });
        }
    }
    const claims = [];
    for (const { clientId, payerId, lines } of groups.values()) {
        const id = newId();
        const totalUnits = lines.reduce((sum, l) => sum + l.units, 0);
        const totalChargeCents = lines.reduce((sum, l) => sum + l.chargeCents, 0);
        const denialRisk = worstRisk(lines.map((l) => l.denialRisk));
        claims.push({
            id,
            agencyId: input.agencyId,
            clientId,
            payerId,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            status: 'draft',
            totalUnits,
            totalChargeCents,
            denialRisk,
            controlNumber: id.replace(/-/g, '').slice(0, 12).toUpperCase(),
            payerClaimId: null,
            statusReason: null,
            submittedAt: null,
            lines: lines.map((l) => ({ ...l, claimId: id })),
        });
    }
    // Stable claim order: by client then payer.
    claims.sort((a, b) => a.clientId === b.clientId
        ? a.payerId.localeCompare(b.payerId)
        : a.clientId.localeCompare(b.clientId));
    return { claims, unbillable };
}
//# sourceMappingURL=claim-generation-service.js.map