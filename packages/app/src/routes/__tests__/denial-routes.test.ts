import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

const remitId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function remitRow(partial: Record<string, unknown> = {}) {
  return {
    id: remitId,
    claimId: null,
    controlNumber: 'CLM-001',
    matched: false,
    statusCode: '4',
    chargeCents: 8000,
    paidCents: 0,
    adjustmentCents: 8000,
    patientResponsibilityCents: 0,
    traceNumber: 'CHK-1',
    postedAt: '2026-07-20T00:00:00.000Z',
    adjustments: [{ group: 'CO', reasonCode: '197', amountCents: 8000 }],
    remarkCodes: [],
    serviceLines: [],
    denialStatus: null,
    denialNote: null,
    denialUpdatedAt: null,
    ...partial,
  };
}

describe('denial dashboard routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns summary + worklist, defaulting untouched rows to status new', async () => {
    vi.spyOn(core, 'ClaimRepository').mockImplementation(() => ({
      listRemittances: vi.fn().mockResolvedValue([
        remitRow(),
        remitRow({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', controlNumber: 'CLM-002', statusCode: '1', chargeCents: 5000, paidCents: 5000 }),
      ]),
    } as any));

    const res = await request(createApp())
      .get('/billing/denials')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      totalRemittances: 2,
      deniedCount: 1,
      paidCount: 1,
      denialRatePct: 50,
      atRiskCents: 8000,
      unworkedCount: 1,
    });
    // Only the denied row appears on the worklist; paid rows do not.
    expect(res.body.worklist).toHaveLength(1);
    expect(res.body.worklist[0]).toMatchObject({
      id: remitId,
      kind: 'denied',
      denialStatus: 'new',
      atRiskCents: 8000,
    });
    // CARC decoration flows through the same dictionary as the ERA screens.
    expect(res.body.worklist[0].adjustments[0]).toMatchObject({
      reasonCode: '197',
      groupLabel: 'Contractual obligation',
    });
  });

  it('requires billing.read (caregivers get 403)', async () => {
    const res = await request(createApp())
      .get('/billing/denials')
      .set('Authorization', `Bearer ${makeToken('caregiver')}`);
    expect(res.status).toBe(403);
  });

  it('updates worklist status and audits the touch', async () => {
    const updateDenialWork = vi.fn().mockResolvedValue(true);
    const auditCreate = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(core, 'ClaimRepository').mockImplementation(() => ({ updateDenialWork } as any));
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: auditCreate }) as any);

    const res = await request(createApp())
      .patch(`/billing/denials/${remitId}`)
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ status: 'working', note: 'called payer, refiling with auth number' });

    expect(res.status).toBe(200);
    expect(updateDenialWork).toHaveBeenCalledWith(
      expect.any(String),
      remitId,
      expect.objectContaining({ status: 'working', note: 'called payer, refiling with auth number' }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'claim.denial.updated', entityId: remitId }),
    );
  });

  it('rejects unknown statuses', async () => {
    const res = await request(createApp())
      .patch(`/billing/denials/${remitId}`)
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ status: 'escalated' });
    expect(res.status).toBe(400);
  });

  it('rejects an empty patch and a malformed id', async () => {
    const empty = await request(createApp())
      .patch(`/billing/denials/${remitId}`)
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});
    expect(empty.status).toBe(400);

    const badId = await request(createApp())
      .patch('/billing/denials/not-a-uuid')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ status: 'working' });
    expect(badId.status).toBe(400);
  });

  it('404s when the remittance does not belong to the agency', async () => {
    vi.spyOn(core, 'ClaimRepository').mockImplementation(() => ({
      updateDenialWork: vi.fn().mockResolvedValue(false),
    } as any));

    const res = await request(createApp())
      .patch(`/billing/denials/${remitId}`)
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ status: 'resolved' });
    expect(res.status).toBe(404);
  });
});
