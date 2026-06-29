import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

describe('Sandata submission write-back routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns not_configured (409) when Sandata is not set up', async () => {
    vi.spyOn(core, 'AgencySandataConfigRepository').mockImplementation(() => ({
      findSubmissionConfig: vi.fn().mockResolvedValue(undefined),
    } as any));

    const res = await request(createApp())
      .post('/exports/sandata/submit')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ from: '2026-06-01', to: '2026-06-30' });

    expect(res.status).toBe(409);
    expect(res.body.status).toBe('not_configured');
  });

  it('submits verified visits and records each acknowledgment', async () => {
    vi.spyOn(core, 'AgencySandataConfigRepository').mockImplementation(() => ({
      findSubmissionConfig: vi.fn().mockResolvedValue({
        enabled: true,
        apiBaseUrl: 'https://sandbox.sandata.example/v1',
        providerId: '123456789',
        credentials: { apiKey: 'k' },
        caregivers: [{ caregiverId: 'cg-1', externalWorkerId: 'W-1' }],
        services: [{ internalServiceCode: 'PCA', hcpcsCode: 'T1019', hcpcsModifier: 'U2', label: 'PC' }],
      }),
    } as any));
    const markSandataSubmission = vi.fn().mockResolvedValue(true);
    vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
      getVisitsForExport: vi.fn().mockResolvedValue([
        {
          visitId: 'v-1',
          serviceCode: 'PCA',
          clientId: 'client-1',
          caregiverId: 'cg-1',
          clockInTime: '2026-06-01T13:00:00.000Z',
          clockOutTime: '2026-06-01T17:00:00.000Z',
          clockInLocation: { lat: 40.1, lng: -75.1 },
          clockOutLocation: { lat: 40.1, lng: -75.1 },
          status: 'verified',
        },
      ]),
      markSandataSubmission,
    } as any));
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({}),
    } as any));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ batchId: 'B-1', results: [{ visitOtherId: 'v-1', status: 'accepted', confirmationId: 'C-1' }] }),
          ),
      }),
    );

    const res = await request(createApp())
      .post('/exports/sandata/submit')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ from: '2026-06-01', to: '2026-06-30' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', batchId: 'B-1', accepted: 1 });
    expect(markSandataSubmission).toHaveBeenCalledWith('v-1', 'agency-1', 'accepted', 'C-1');
  });

  it('rejects a malformed date on submit with 400', async () => {
    const res = await request(createApp())
      .post('/exports/sandata/submit')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ from: 'not-a-date' });

    expect(res.status).toBe(400);
  });

  it('forbids coordinators from submitting (no billing.write)', async () => {
    const res = await request(createApp())
      .post('/exports/sandata/submit')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('reconciles aggregator results and reports updated + notFound', async () => {
    const markSandataSubmission = vi.fn()
      .mockResolvedValueOnce(true)   // first visit updated
      .mockResolvedValueOnce(false); // second visit not in agency
    vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
      markSandataSubmission,
    } as any));
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({}),
    } as any));

    const res = await request(createApp())
      .post('/exports/sandata/reconcile')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({
        results: [
          { visitId: '11111111-1111-4111-8111-111111111111', status: 'accepted', confirmationId: 'SND-1' },
          { visitId: '22222222-2222-4222-8222-222222222222', status: 'rejected' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);
    expect(res.body.notFound).toEqual(['22222222-2222-4222-8222-222222222222']);
    expect(markSandataSubmission).toHaveBeenCalledTimes(2);
  });

  it('rejects a reconcile with an invalid status with 400', async () => {
    const res = await request(createApp())
      .post('/exports/sandata/reconcile')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ results: [{ visitId: '11111111-1111-4111-8111-111111111111', status: 'bogus' }] });

    expect(res.status).toBe(400);
  });
});
