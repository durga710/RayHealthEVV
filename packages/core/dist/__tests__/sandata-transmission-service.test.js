import { describe, expect, it, vi } from 'vitest';
import { SandataEntityType, SandataRecordStatus, SandataTransmissionService, } from '../integrations/sandata/index.js';
const AGENCY = 'agency-1';
const client = {
    id: 'client-1',
    firstName: 'Ada',
    lastName: 'Tester',
    dateOfBirth: '1980-04-01',
    medicaidNumber: '1234567890',
    addressLine1: '100 Main St',
    city: 'Philadelphia',
    state: 'PA',
    postalCode: '19103',
    latitude: 39.9526,
    longitude: -75.1652,
};
const caregiver = {
    id: 'cg-1',
    agencyId: AGENCY,
    firstName: 'Grace',
    lastName: 'Helper',
    email: 'grace@example.test',
    status: 'active',
};
const visit = {
    id: 'visit-1',
    assignmentId: 'assign-1',
    caregiverId: 'cg-1',
    clientId: 'client-1',
    serviceCode: 'T1019',
    clockInTime: '2026-06-29T13:00:00.000Z',
    clockOutTime: '2026-06-29T15:00:00.000Z',
    clockInLocation: { lat: 39.9526, lng: -75.1652, accuracy: 8 },
    clockOutLocation: { lat: 39.9527, lng: -75.1651, accuracy: 9 },
    status: 'verified',
};
/** In-memory SandataStateRepo that actually tracks sequence + verification. */
class FakeState {
    constructor() {
        this.seq = new Map();
        this.status = new Map();
        this.transmissions = [];
        this.exceptions = [];
        this.polled = [];
        this.applied = [];
        this.nextId = 1;
    }
    key(entity, ext) {
        return `${entity}|${ext}`;
    }
    async nextSequence(_agency, entity, ext) {
        return (this.seq.get(this.key(entity, ext)) ?? 0) + 1;
    }
    async recordTransmitted(agencyId, entity, uuid, _env, records) {
        const id = this.nextId++;
        this.transmissions.push({
            id,
            agencyId,
            entityType: entity,
            uuid,
            recordCount: records.length,
            pollAttempts: 0,
            status: 'RECEIVED',
        });
        for (const r of records) {
            this.seq.set(this.key(entity, r.externalId), r.sequenceId);
            this.status.set(this.key(entity, r.externalId), SandataRecordStatus.RECEIVED);
        }
        return id;
    }
    async findPendingTransmissions() {
        return this.transmissions.filter((t) => t.status === 'RECEIVED');
    }
    async applyStatusResults(id, results) {
        const tx = this.transmissions.find((t) => t.id === id);
        if (!tx)
            return;
        for (const r of results)
            this.status.set(this.key(tx.entityType, r.externalId), r.status);
        tx.status = 'COMPLETED';
        this.applied.push({ id, results });
    }
    async markTransmissionPolled(id) {
        this.polled.push(id);
        const tx = this.transmissions.find((t) => t.id === id);
        if (tx)
            tx.pollAttempts += 1;
    }
    async areDependenciesVerified(_agency, clientExt, employeeExt) {
        return (this.status.get(this.key(SandataEntityType.CLIENT, clientExt)) === SandataRecordStatus.VERIFIED &&
            this.status.get(this.key(SandataEntityType.EMPLOYEE, employeeExt)) === SandataRecordStatus.VERIFIED);
    }
    async enqueueException(_agency, input) {
        this.exceptions.push(input);
    }
    /** Test helper: force a record to VERIFIED. */
    verify(entity, ext) {
        this.status.set(this.key(entity, ext), SandataRecordStatus.VERIFIED);
    }
}
function fakeApi(handlers) {
    return handlers;
}
describe('SandataTransmissionService.transmitClients', () => {
    it('validates, sequences, posts, and persists state', async () => {
        const state = new FakeState();
        const post = vi.fn().mockResolvedValue({ kind: 'accepted', uuid: 'uuid-clients' });
        const svc = new SandataTransmissionService(fakeApi({ post }), state, 'UAT');
        const result = await svc.transmitClients(AGENCY, [client]);
        expect(result.posted).toBe(1);
        expect(result.uuid).toBe('uuid-clients');
        expect(result.blocked).toHaveLength(0);
        expect(post).toHaveBeenCalledWith(SandataEntityType.CLIENT, [expect.objectContaining({ ClientCustomID: 'client-1', SequenceID: 1 })]);
        expect(state.transmissions).toHaveLength(1);
    });
    it('blocks an invalid client and never posts it', async () => {
        const state = new FakeState();
        const post = vi.fn();
        const svc = new SandataTransmissionService(fakeApi({ post }), state, 'UAT');
        const result = await svc.transmitClients(AGENCY, [{ ...client, medicaidNumber: undefined }]);
        expect(result.posted).toBe(0);
        expect(result.blocked).toHaveLength(1);
        expect(post).not.toHaveBeenCalled();
    });
    it('surfaces a transport error without persisting state', async () => {
        const state = new FakeState();
        const post = vi.fn().mockResolvedValue({ kind: 'error', message: 'boom', status: 503, retryable: true });
        const svc = new SandataTransmissionService(fakeApi({ post }), state, 'UAT');
        const result = await svc.transmitClients(AGENCY, [client]);
        expect(result.error).toMatchObject({ message: 'boom', retryable: true });
        expect(state.transmissions).toHaveLength(0);
    });
    it('increments the sequence on a resend', async () => {
        const state = new FakeState();
        const post = vi.fn().mockResolvedValue({ kind: 'accepted', uuid: 'u' });
        const svc = new SandataTransmissionService(fakeApi({ post }), state, 'UAT');
        await svc.transmitClients(AGENCY, [client]);
        await svc.transmitClients(AGENCY, [client]);
        expect(post.mock.calls[1][1][0].SequenceID).toBe(2);
    });
});
describe('SandataTransmissionService.transmitEmployees', () => {
    it('posts a valid caregiver', async () => {
        const state = new FakeState();
        const post = vi.fn().mockResolvedValue({ kind: 'accepted', uuid: 'uuid-emp' });
        const svc = new SandataTransmissionService(fakeApi({ post }), state, 'UAT');
        const result = await svc.transmitEmployees(AGENCY, [caregiver]);
        expect(result.posted).toBe(1);
        expect(post).toHaveBeenCalledWith(SandataEntityType.EMPLOYEE, [expect.objectContaining({ EmployeeCustomID: 'cg-1' })]);
    });
});
describe('SandataTransmissionService.transmitVisits', () => {
    it('defers a visit whose dependencies are not yet verified', async () => {
        const state = new FakeState();
        const post = vi.fn();
        const svc = new SandataTransmissionService(fakeApi({ post }), state, 'UAT');
        const result = await svc.transmitVisits(AGENCY, [visit]);
        expect(result.posted).toBe(0);
        expect(result.deferred).toHaveLength(1);
        expect(result.deferred[0].externalId).toBe('visit-1');
        expect(post).not.toHaveBeenCalled();
    });
    it('posts a visit once client and employee are verified', async () => {
        const state = new FakeState();
        state.verify(SandataEntityType.CLIENT, 'client-1');
        state.verify(SandataEntityType.EMPLOYEE, 'cg-1');
        const post = vi.fn().mockResolvedValue({ kind: 'accepted', uuid: 'uuid-visits' });
        const svc = new SandataTransmissionService(fakeApi({ post }), state, 'UAT');
        const result = await svc.transmitVisits(AGENCY, [visit]);
        expect(result.posted).toBe(1);
        expect(result.uuid).toBe('uuid-visits');
        expect(result.deferred).toHaveLength(0);
    });
});
describe('SandataTransmissionService.pollPendingStatuses', () => {
    it('marks ACCEPTED records VERIFIED and completes the transmission', async () => {
        const state = new FakeState();
        const post = vi.fn().mockResolvedValue({ kind: 'accepted', uuid: 'uuid-c' });
        const getStatus = vi.fn().mockResolvedValue({
            kind: 'ready',
            response: { uuid: 'uuid-c', status: 'COMPLETED', records: [{ externalID: 'client-1', status: 'ACCEPTED' }] },
        });
        const svc = new SandataTransmissionService(fakeApi({ post, getStatus }), state, 'UAT');
        await svc.transmitClients(AGENCY, [client]);
        const summary = await svc.pollPendingStatuses(AGENCY);
        expect(summary.completed).toBe(1);
        expect(summary.verified).toBe(1);
        expect(state.status.get(`${SandataEntityType.CLIENT}|client-1`)).toBe(SandataRecordStatus.VERIFIED);
    });
    it('leaves a transmission pending and bumps poll count when not ready', async () => {
        const state = new FakeState();
        const post = vi.fn().mockResolvedValue({ kind: 'accepted', uuid: 'uuid-c' });
        const getStatus = vi.fn().mockResolvedValue({ kind: 'not_ready' });
        const svc = new SandataTransmissionService(fakeApi({ post, getStatus }), state, 'UAT');
        await svc.transmitClients(AGENCY, [client]);
        const summary = await svc.pollPendingStatuses(AGENCY);
        expect(summary.notReady).toBe(1);
        expect(summary.completed).toBe(0);
        expect(state.polled).toHaveLength(1);
        expect(state.transmissions[0].status).toBe('RECEIVED');
    });
    it('enqueues an exception for a rejected visit', async () => {
        const state = new FakeState();
        state.verify(SandataEntityType.CLIENT, 'client-1');
        state.verify(SandataEntityType.EMPLOYEE, 'cg-1');
        const post = vi.fn().mockResolvedValue({ kind: 'accepted', uuid: 'uuid-v' });
        const getStatus = vi.fn().mockResolvedValue({
            kind: 'ready',
            response: {
                uuid: 'uuid-v',
                status: 'COMPLETED',
                records: [{ externalID: 'visit-1', status: 'REJECTED', reasonCodes: ['E123'], description: 'bad GPS' }],
            },
        });
        const svc = new SandataTransmissionService(fakeApi({ post, getStatus }), state, 'UAT');
        await svc.transmitVisits(AGENCY, [visit]);
        const summary = await svc.pollPendingStatuses(AGENCY);
        expect(summary.rejected).toBe(1);
        expect(state.exceptions).toHaveLength(1);
        expect(state.exceptions[0]).toMatchObject({ visitId: 'visit-1', externalId: 'visit-1', reasonCodes: ['E123'] });
    });
});
//# sourceMappingURL=sandata-transmission-service.test.js.map