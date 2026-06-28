import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

describe('Sandata submission write-back routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks a batch submitted and returns the count', async () => {
    const markSandataSubmittedInRange = vi.fn().mockResolvedValue(7);
    vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
      markSandataSubmittedInRange,
    } as any));
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({}),
    } as any));

    const res = await request(createApp())
      .post('/exports/sandata/submit')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ from: '2026-06-01', to: '2026-06-30' });

    expect(res.status).toBe(200);
    expect(res.body.marked).toBe(7);
    expect(markSandataSubmittedInRange).toHaveBeenCalledWith('agency-1', expect.any(String), expect.any(String));
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
