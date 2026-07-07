import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());
afterEach(() => vi.restoreAllMocks());

const agencyId = '00000000-0000-4000-8000-0000000000c1';
const userId = '00000000-0000-4000-8000-0000000000c2';
const maintenanceId = '00000000-0000-4000-8000-0000000000c3';
const visitId = '00000000-0000-4000-8000-0000000000c4';

const start = '2026-06-10T09:00:00.000Z';
const end = '2026-06-10T13:00:00.000Z';

function token() {
  return `Bearer ${makeToken('admin', agencyId, userId)}`;
}

describe('POST /maintenance/approve-unlock/:id — validation + accountability (findings #4, #6)', () => {
  it('rejects adjusted times where end is not after start (400)', async () => {
    const approveUnlock = vi.fn();
    vi.spyOn(core, 'VisitMaintenanceRepository').mockImplementation(
      () => ({ approveUnlock }) as unknown as core.VisitMaintenanceRepository,
    );

    const res = await request(createApp())
      .post(`/maintenance/approve-unlock/${maintenanceId}`)
      .set('Authorization', token())
      .send({ adjustedTimes: { start: end, end: start } }); // reversed → invalid

    expect(res.status).toBe(400);
    expect(approveUnlock).not.toHaveBeenCalled();
  });

  it('returns 400 (not 500) when adjustedTimes is missing entirely', async () => {
    const approveUnlock = vi.fn();
    vi.spyOn(core, 'VisitMaintenanceRepository').mockImplementation(
      () => ({ approveUnlock }) as unknown as core.VisitMaintenanceRepository,
    );

    const res = await request(createApp())
      .post(`/maintenance/approve-unlock/${maintenanceId}`)
      .set('Authorization', token())
      .send({});

    expect(res.status).toBe(400);
    expect(approveUnlock).not.toHaveBeenCalled();
  });

  it('records the approver id when approving a valid correction', async () => {
    const approveUnlock = vi
      .fn()
      .mockResolvedValue({ id: maintenanceId, visitId, requesterId: 'req-1', status: 'approved' });
    vi.spyOn(core, 'VisitMaintenanceRepository').mockImplementation(
      () => ({ approveUnlock }) as unknown as core.VisitMaintenanceRepository,
    );

    const res = await request(createApp())
      .post(`/maintenance/approve-unlock/${maintenanceId}`)
      .set('Authorization', token())
      .send({ adjustedTimes: { start, end } });

    expect(res.status).toBe(200);
    // Signature: approveUnlock(id, agencyId, approverId, adjustedTimes)
    expect(approveUnlock).toHaveBeenCalledWith(maintenanceId, agencyId, userId, { start, end });
  });
});
