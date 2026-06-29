import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';
beforeAll(() => setTestJwtSecret());
describe('HHAeXchange submission write-back routes', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it('returns not_configured (409) when HHAeXchange is not set up', async () => {
        vi.spyOn(core, 'AgencyHhaexchangeConfigRepository').mockImplementation(() => ({
            findSubmissionConfig: vi.fn().mockResolvedValue(undefined),
        }));
        const res = await request(createApp())
            .post('/exports/hhaexchange/submit')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ from: '2026-06-01', to: '2026-06-30' });
        expect(res.status).toBe(409);
        expect(res.body.status).toBe('not_configured');
    });
    it('returns an honest error (502) when configured but the transport is unimplemented', async () => {
        vi.spyOn(core, 'AgencyHhaexchangeConfigRepository').mockImplementation(() => ({
            findSubmissionConfig: vi.fn().mockResolvedValue({
                enabled: true,
                apiBaseUrl: 'https://hhax.example/api',
                agencyTaxId: '123456789',
                hhaProviderId: 'P-1',
                credentials: { apiKey: 'k' },
            }),
        }));
        vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
            getVisitsForExport: vi.fn().mockResolvedValue([]),
            markHhaexchangeSubmission: vi.fn().mockResolvedValue(true),
        }));
        const res = await request(createApp())
            .post('/exports/hhaexchange/submit')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ from: '2026-06-01', to: '2026-06-30' });
        expect(res.status).toBe(502);
        expect(res.body.status).toBe('error');
    });
    it('rejects a malformed date on submit with 400', async () => {
        const res = await request(createApp())
            .post('/exports/hhaexchange/submit')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ from: 'not-a-date' });
        expect(res.status).toBe(400);
    });
    it('forbids coordinators from submitting (no billing.write)', async () => {
        const res = await request(createApp())
            .post('/exports/hhaexchange/submit')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({});
        expect(res.status).toBe(403);
    });
    it('reconciles aggregator results and reports updated + notFound', async () => {
        const markHhaexchangeSubmission = vi.fn()
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
        vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
            markHhaexchangeSubmission,
        }));
        vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
            create: vi.fn().mockResolvedValue({}),
        }));
        const res = await request(createApp())
            .post('/exports/hhaexchange/reconcile')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({
            results: [
                { visitId: '11111111-1111-4111-8111-111111111111', status: 'accepted', confirmationId: 'HHX-1' },
                { visitId: '22222222-2222-4222-8222-222222222222', status: 'rejected' },
            ],
        });
        expect(res.status).toBe(200);
        expect(res.body.updated).toBe(1);
        expect(res.body.notFound).toEqual(['22222222-2222-4222-8222-222222222222']);
        expect(markHhaexchangeSubmission).toHaveBeenCalledTimes(2);
    });
    it('422s the CSV export when HHAeXchange is not configured', async () => {
        vi.spyOn(core, 'AgencyHhaexchangeConfigRepository').mockImplementation(() => ({
            findValid: vi.fn().mockResolvedValue(undefined),
        }));
        const res = await request(createApp())
            .get('/exports/hhaexchange.csv')
            .set('Authorization', `Bearer ${makeToken('admin')}`);
        expect(res.status).toBe(422);
    });
});
//# sourceMappingURL=export-hhaexchange-routes.test.js.map