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
