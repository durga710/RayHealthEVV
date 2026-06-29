/**
 * Sandata Alt EVV transmission orchestrator.
 *
 * Ties the pieces together for the async POST→UUID→poll lifecycle:
 *   validate → assign next SequenceID → map to wire → POST batch → persist state.
 *
 * Sandata enforces a load-order dependency: a VISIT is only accepted once its
 * CLIENT and EMPLOYEE are VERIFIED. Because verification is itself async (via a
 * status poll), `transmitVisits` DEFERS any visit whose dependencies are not yet
 * verified rather than sending a doomed batch. The caller transmits clients +
 * employees, polls until they verify, then transmits visits.
 *
 * Pure orchestration over the `SandataStateRepo` interface + `SandataApiClient`
 * — no direct DB or HTTP — so it is fully unit-testable with in-memory fakes.
 */
import { createHash } from 'node:crypto';
import { mapClient, mapEmployee, mapVisit } from './mapper.js';
import { SandataEntityType, SandataRecordStatus } from './types.js';
import { validateClient, validateEmployee, validateVisit, } from './validator.js';
function sha256(value) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
/** Map a Sandata per-record result status to our durable record status. */
function toRecordStatus(raw) {
    switch (raw.toUpperCase()) {
        case 'ACCEPTED':
            return SandataRecordStatus.VERIFIED;
        case 'REJECTED':
            return SandataRecordStatus.REJECTED;
        case 'EXCEPTION':
            return SandataRecordStatus.EXCEPTION;
        default:
            return SandataRecordStatus.RECEIVED;
    }
}
function emptyResult(entityType) {
    return { entityType, posted: 0, uuid: null, blocked: [], deferred: [], error: null };
}
export class SandataTransmissionService {
    constructor(api, state, environment) {
        this.api = api;
        this.state = state;
        this.environment = environment;
    }
    async postBatch(agencyId, entityType, wire, records, base) {
        if (wire.length === 0)
            return base;
        const out = await this.api.post(entityType, wire);
        if (out.kind === 'error') {
            return { ...base, error: { message: out.message, retryable: out.retryable } };
        }
        await this.state.recordTransmitted(agencyId, entityType, out.uuid, this.environment, records);
        return { ...base, posted: wire.length, uuid: out.uuid };
    }
    async transmitClients(agencyId, clients, ctx = {}) {
        const result = emptyResult(SandataEntityType.CLIENT);
        const wire = [];
        const records = [];
        for (const client of clients) {
            const validation = validateClient(client, ctx);
            if (!validation.ok) {
                result.blocked.push({ externalId: client.id ?? '', issues: validation.issues });
                continue;
            }
            const sequenceId = await this.state.nextSequence(agencyId, SandataEntityType.CLIENT, client.id ?? '');
            const mapped = mapClient(client, sequenceId);
            wire.push(mapped);
            records.push({ externalId: client.id ?? '', sequenceId, payloadHash: sha256(mapped) });
        }
        return this.postBatch(agencyId, SandataEntityType.CLIENT, wire, records, result);
    }
    async transmitEmployees(agencyId, caregivers) {
        const result = emptyResult(SandataEntityType.EMPLOYEE);
        const wire = [];
        const records = [];
        for (const caregiver of caregivers) {
            const validation = validateEmployee(caregiver);
            if (!validation.ok) {
                result.blocked.push({ externalId: caregiver.id ?? '', issues: validation.issues });
                continue;
            }
            const sequenceId = await this.state.nextSequence(agencyId, SandataEntityType.EMPLOYEE, caregiver.id ?? '');
            const mapped = mapEmployee(caregiver, sequenceId);
            wire.push(mapped);
            records.push({ externalId: caregiver.id ?? '', sequenceId, payloadHash: sha256(mapped) });
        }
        return this.postBatch(agencyId, SandataEntityType.EMPLOYEE, wire, records, result);
    }
    async transmitVisits(agencyId, visits, ctx = {}, mapOpts = {}) {
        const result = emptyResult(SandataEntityType.VISIT);
        const wire = [];
        const records = [];
        for (const visit of visits) {
            const validation = validateVisit(visit, ctx);
            if (!validation.ok) {
                result.blocked.push({ externalId: visit.id ?? '', issues: validation.issues });
                continue;
            }
            const depsVerified = await this.state.areDependenciesVerified(agencyId, visit.clientId ?? '', visit.caregiverId);
            if (!depsVerified) {
                result.deferred.push({
                    externalId: visit.id ?? '',
                    reason: 'Client and/or employee not yet VERIFIED by Sandata',
                });
                continue;
            }
            const sequenceId = await this.state.nextSequence(agencyId, SandataEntityType.VISIT, visit.id ?? '');
            const mapped = mapVisit(visit, sequenceId, mapOpts);
            wire.push(mapped);
            records.push({ externalId: visit.id ?? '', sequenceId, payloadHash: sha256(mapped) });
        }
        return this.postBatch(agencyId, SandataEntityType.VISIT, wire, records, result);
    }
    async pollPendingStatuses(agencyId) {
        const pending = await this.state.findPendingTransmissions(agencyId);
        const summary = {
            polled: pending.length,
            completed: 0,
            notReady: 0,
            verified: 0,
            rejected: 0,
            exceptions: 0,
            errors: [],
        };
        for (const tx of pending) {
            const outcome = await this.api.getStatus(tx.entityType, tx.uuid);
            if (outcome.kind === 'not_ready') {
                await this.state.markTransmissionPolled(tx.id);
                summary.notReady += 1;
                continue;
            }
            if (outcome.kind === 'error') {
                summary.errors.push(outcome.message);
                continue;
            }
            const results = (outcome.response.records ?? []).map((r) => ({
                externalId: r.externalID,
                status: toRecordStatus(r.status),
                reasonCodes: r.reasonCodes,
                description: r.description,
            }));
            await this.state.applyStatusResults(tx.id, results);
            summary.completed += 1;
            for (const r of results) {
                if (r.status === SandataRecordStatus.VERIFIED)
                    summary.verified += 1;
                else if (r.status === SandataRecordStatus.REJECTED)
                    summary.rejected += 1;
                else if (r.status === SandataRecordStatus.EXCEPTION)
                    summary.exceptions += 1;
                // Surface visit-level problems to staff for resolution.
                if (tx.entityType === SandataEntityType.VISIT &&
                    (r.status === SandataRecordStatus.EXCEPTION || r.status === SandataRecordStatus.REJECTED)) {
                    await this.state.enqueueException(agencyId, {
                        visitId: r.externalId,
                        externalId: r.externalId,
                        reasonCodes: r.reasonCodes,
                        description: r.description ?? null,
                    });
                }
            }
        }
        return summary;
    }
}
//# sourceMappingURL=transmission-service.js.map