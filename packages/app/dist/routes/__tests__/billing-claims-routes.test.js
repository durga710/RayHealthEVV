import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';
beforeAll(() => setTestJwtSecret());
function mockRepos(overrides = {}) {
    const repo = {
        getBillableVisits: vi.fn().mockResolvedValue([]),
        getActiveClaimVisitIds: vi.fn().mockResolvedValue(new Set()),
        getAgencyAuthorizations: vi.fn().mockResolvedValue([]),
        getBilledLineUnits: vi.fn().mockResolvedValue([]),
        createClaims: vi.fn().mockResolvedValue([]),
        listClaims: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
        getClaim: vi.fn().mockResolvedValue(null),
        updateStatus: vi.fn().mockResolvedValue(null),
        getAgencyBillingProfile: vi.fn().mockResolvedValue(null),
        getClientBillingInfo: vi.fn().mockResolvedValue(new Map()),
        getVisitRenderingProviders: vi.fn().mockResolvedValue(new Map()),
        getPayrollVisits: vi.fn().mockResolvedValue([]),
        ...overrides,
    };
    vi.spyOn(core, 'ClaimRepository').mockImplementation(() => repo);
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: vi.fn().mockResolvedValue({}) }));
    vi.spyOn(core, 'AgencyRepository').mockImplementation(() => ({ getFeeSchedule: vi.fn().mockResolvedValue({}) }));
    return repo;
}
const sampleClaim = {
    id: '00000000-0000-4000-8000-000000000001',
    agencyId: 'agency-1',
    clientId: 'client-1',
    payerId: 'PACHC',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    status: 'draft',
    totalUnits: 4,
    totalChargeCents: 0,
    denialRisk: 'low',
    controlNumber: 'ABC123',
    payerClaimId: null,
    statusReason: null,
    submittedAt: null,
    lines: [
        {
            id: 'line-1',
            claimId: '00000000-0000-4000-8000-000000000001',
            visitId: 'visit-1',
            serviceCode: 'T1019',
            serviceDate: '2026-06-10',
            units: 4,
            minutes: 60,
            chargeCents: 0,
            denialRisk: 'low',
            denialReasons: [],
        },
    ],
};
describe('billing claims routes', () => {
    afterEach(() => vi.restoreAllMocks());
    it('forbids a coordinator from generating claims (billing.write required)', async () => {
        mockRepos();
        const res = await request(createApp())
            .post('/billing/claims/generate')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({ periodStart: '2026-06-01', periodEnd: '2026-06-30' });
        expect(res.status).toBe(403);
    });
    it('generates claims for an admin and persists them', async () => {
        const repo = mockRepos({
            getBillableVisits: vi.fn().mockResolvedValue([
                {
                    visitId: 'visit-1',
                    clientId: 'client-1',
                    caregiverId: 'cg-1',
                    serviceCode: 'T1019',
                    clockInTime: '2026-06-10T14:00:00Z',
                    clockOutTime: '2026-06-10T15:00:00Z',
                    status: 'verified',
                    sandataStatus: 'accepted',
                    clientMedicaidNumber: 'MA1',
                    caregiverNpi: '1234567890',
                },
            ]),
            getAgencyAuthorizations: vi.fn().mockResolvedValue([
                {
                    id: 'auth-1',
                    clientId: 'client-1',
                    payerId: 'PACHC',
                    serviceCode: 'T1019',
                    unitsAuthorized: 100,
                    startDate: '2026-06-01',
                    endDate: '2026-06-30',
                },
            ]),
            createClaims: vi.fn().mockResolvedValue([sampleClaim]),
        });
        const res = await request(createApp())
            .post('/billing/claims/generate')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ periodStart: '2026-06-01', periodEnd: '2026-06-30' });
        expect(res.status).toBe(201);
        expect(res.body.generated).toBe(1);
        expect(repo.createClaims).toHaveBeenCalledTimes(1);
        // The generation service produced exactly one claim from the one visit.
        expect(repo.createClaims.mock.calls[0][0]).toHaveLength(1);
    });
    it('rejects an invalid date range', async () => {
        mockRepos();
        const res = await request(createApp())
            .post('/billing/claims/generate')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ periodStart: '2026-06-30', periodEnd: '2026-06-01' });
        expect(res.status).toBe(400);
    });
    it('lists claims for a coordinator (billing.read)', async () => {
        mockRepos({
            listClaims: vi.fn().mockResolvedValue({
                rows: [{ ...sampleClaim, lineCount: 1 }],
                total: 1,
            }),
        });
        const res = await request(createApp())
            .get('/billing/claims')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`);
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(1);
        expect(res.body.claims[0].lineCount).toBe(1);
    });
    it('returns 404 for a missing claim', async () => {
        mockRepos();
        const res = await request(createApp())
            .get('/billing/claims/does-not-exist')
            .set('Authorization', `Bearer ${makeToken('admin')}`);
        expect(res.status).toBe(404);
    });
    it('downloads a valid 837P for a claim', async () => {
        mockRepos({
            getClaim: vi.fn().mockResolvedValue(sampleClaim),
            getAgencyBillingProfile: vi.fn().mockResolvedValue({
                name: 'SUNRISE HOME CARE',
                npi: '1234567893',
                taxId: '123456789',
                address1: '100 MAIN ST',
                city: 'SCRANTON',
                state: 'PA',
                postalCode: '18503',
                taxonomyCode: undefined,
                clearinghouseId: 'PROMISE',
                medicaidProviderNumber: '999999',
            }),
            getClientBillingInfo: vi.fn().mockResolvedValue(new Map([
                ['client-1', { firstName: 'JANE', lastName: 'DOE', dateOfBirth: '1955-04-12', medicaidNumber: 'MA123' }],
            ])),
            getVisitRenderingProviders: vi.fn().mockResolvedValue(new Map([['visit-1', { firstName: 'ALEX', lastName: 'SMITH', npi: '1987654321' }]])),
        });
        const res = await request(createApp())
            .get('/billing/claims/00000000-0000-4000-8000-000000000001/837')
            .set('Authorization', `Bearer ${makeToken('admin')}`);
        expect(res.status).toBe(200);
        expect(res.headers['content-disposition']).toContain('.837.txt');
        expect(res.text).toMatch(/^ISA\*/);
        expect(res.text).toContain('CLM*ABC123');
        expect(res.text).toContain('SV1*HC:T1019');
    });
    it('rejects an illegal status transition (paid -> ready)', async () => {
        mockRepos({
            getClaim: vi.fn().mockResolvedValue({ ...sampleClaim, status: 'paid' }),
        });
        const res = await request(createApp())
            .post('/billing/claims/00000000-0000-4000-8000-000000000001/status')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ status: 'ready' });
        expect(res.status).toBe(422);
    });
    it('blocks validate when a claim has high-risk lines', async () => {
        mockRepos({
            getClaim: vi.fn().mockResolvedValue({
                ...sampleClaim,
                denialRisk: 'high',
                lines: [{ ...sampleClaim.lines[0], denialRisk: 'high', denialReasons: ['Client Medicaid ID is missing.'] }],
            }),
        });
        const res = await request(createApp())
            .post('/billing/claims/00000000-0000-4000-8000-000000000001/validate')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({});
        expect(res.status).toBe(422);
        expect(res.body.blockingReasons).toContain('Client Medicaid ID is missing.');
    });
    it('exports a payroll CSV', async () => {
        mockRepos({
            getPayrollVisits: vi.fn().mockResolvedValue([
                {
                    caregiverId: 'cg-1',
                    caregiverFirstName: 'Alex',
                    caregiverLastName: 'Smith',
                    clockInTime: '2026-06-10T14:00:00Z',
                    clockOutTime: '2026-06-10T16:00:00Z',
                    status: 'verified',
                    serviceCode: 'T1019',
                },
            ]),
        });
        const res = await request(createApp())
            .get('/billing/payroll/export?from=2026-06-01&to=2026-06-15')
            .set('Authorization', `Bearer ${makeToken('admin')}`);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/csv');
        expect(res.text).toContain('Caregiver ID,Caregiver Name');
        expect(res.text).toContain('Smith, Alex');
    });
});
//# sourceMappingURL=billing-claims-routes.test.js.map