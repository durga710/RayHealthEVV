import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

const ERA = [
  'BPR*I*450.00*C*ACH~',
  'TRN*1*CHK-1*1~',
  'CLP*CLAIM-001*1*500.00*450.00*50.00*MC*PCLM-1*11~',
  'CAS*CO*45*50.00~',
].join('');

describe('remittance (835) routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('previews an 835 and reports match status', async () => {
    vi.spyOn(core, 'ClaimRepository').mockImplementation(() => ({
      matchControlNumbers: vi.fn().mockResolvedValue(new Set(['CLAIM-001'])),
    } as any));

    const res = await request(createApp())
      .post('/billing/remittances/preview')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .set('content-type', 'text/plain')
      .send(ERA);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, matchedCount: 1, traceNumber: 'CHK-1' });
    expect(res.body.claims[0]).toMatchObject({ controlNumber: 'CLAIM-001', matched: true });
    // Adjustments arrive decorated with the CARC dictionary.
    expect(res.body.claims[0].adjustments[0]).toMatchObject({
      group: 'CO',
      groupLabel: 'Contractual obligation',
      reasonCode: '45',
      description: expect.stringContaining('fee schedule'),
    });
  });

  it('previews SVC service lines with decorated line adjustments and RARC remarks', async () => {
    vi.spyOn(core, 'ClaimRepository').mockImplementation(() => ({
      matchControlNumbers: vi.fn().mockResolvedValue(new Set()),
    } as any));

    const eraWithLines = [
      'CLP*CLAIM-002*2*400.00*300.00*0~',
      'MOA***N362~',
      'SVC*HC:T1019*250.00*200.00**10~',
      'DTM*472*20260601~',
      'CAS*CO*45*50.00~',
      'LQ*HE*N362~',
    ].join('');

    const res = await request(createApp())
      .post('/billing/remittances/preview')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .set('content-type', 'text/plain')
      .send(eraWithLines);

    expect(res.status).toBe(200);
    const claim = res.body.claims[0];
    expect(claim.remarkCodes[0]).toMatchObject({
      code: 'N362',
      description: expect.stringContaining('units of service exceeds'),
    });
    expect(claim.serviceLines).toHaveLength(1);
    expect(claim.serviceLines[0]).toMatchObject({
      procedureCode: 'T1019',
      units: 10,
      serviceDate: '2026-06-01',
    });
    expect(claim.serviceLines[0].adjustments[0].description).toContain('fee schedule');
    expect(claim.serviceLines[0].remarkCodes[0].code).toBe('N362');
  });

  it('lists remittance history with decorated adjustments, remarks, and lines', async () => {
    vi.spyOn(core, 'ClaimRepository').mockImplementation(() => ({
      listRemittances: vi.fn().mockResolvedValue([
        {
          id: 'rem-1',
          claimId: null,
          controlNumber: 'CLAIM-003',
          matched: false,
          statusCode: '4',
          chargeCents: 10000,
          paidCents: 0,
          adjustmentCents: 10000,
          patientResponsibilityCents: 0,
          traceNumber: 'CHK-2',
          postedAt: '2026-07-01T00:00:00.000Z',
          adjustments: [{ group: 'CO', reasonCode: '197', amountCents: 10000 }],
          remarkCodes: ['N54'],
          serviceLines: [],
        },
      ]),
    } as any));

    const res = await request(createApp())
      .get('/billing/remittances')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body[0].adjustments[0]).toMatchObject({
      reasonCode: '197',
      description: expect.stringContaining('authorization'),
    });
    expect(res.body[0].remarkCodes[0]).toMatchObject({
      code: 'N54',
      description: expect.stringContaining('pre-certified'),
    });
  });

  it('posts an 835 and returns matched/unmatched counts', async () => {
    const postEra = vi.fn().mockResolvedValue({ posted: 1, matched: 1, unmatched: [] });
    vi.spyOn(core, 'ClaimRepository').mockImplementation(() => ({ postEra } as any));
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({}),
    } as any));

    const res = await request(createApp())
      .post('/billing/remittances/post')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .set('content-type', 'text/plain')
      .send(ERA);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ posted: 1, matched: 1, totalPaidCents: 45000 });
    expect(postEra).toHaveBeenCalled();
  });

  it('rejects an unparseable 835 with 400', async () => {
    const res = await request(createApp())
      .post('/billing/remittances/post')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .set('content-type', 'text/plain')
      .send('this is not an 835');

    expect(res.status).toBe(400);
  });

  it('forbids coordinators from posting (no billing.write)', async () => {
    const res = await request(createApp())
      .post('/billing/remittances/post')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .set('content-type', 'text/plain')
      .send(ERA);

    expect(res.status).toBe(403);
  });
});
