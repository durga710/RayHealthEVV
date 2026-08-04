import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());
afterEach(() => vi.restoreAllMocks());

const agencyId = '00000000-0000-4000-8000-0000000000f1';
const userId = '00000000-0000-4000-8000-0000000000f2';
const caregiverId = '00000000-0000-4000-8000-0000000000f3';
const entryId = '00000000-0000-4000-8000-0000000000f4';

function mockRepo(overrides: Record<string, unknown>) {
  vi.spyOn(core, 'MileageRepository').mockImplementation(
    () => overrides as unknown as core.MileageRepository,
  );
}

function caregiverAuth() {
  return `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`;
}
function adminAuth() {
  return `Bearer ${makeToken('admin', agencyId, userId)}`;
}

const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

describe('POST /mileage', () => {
  it('stores miles as hundredths, scoped to the calling caregiver', async () => {
    const create = vi.fn().mockResolvedValue({ id: entryId });
    mockRepo({ create });

    const res = await request(createApp())
      .post('/mileage')
      .set('Authorization', caregiverAuth())
      .send({ tripDate: yesterday, miles: 12.34, purpose: 'Between visits' });

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith({
      agencyId,
      caregiverId,
      visitId: null,
      tripDate: yesterday,
      milesHundredths: 1234,
      purpose: 'Between visits',
    });
  });

  it('rounds at the boundary so only the integer form reaches storage', async () => {
    const create = vi.fn().mockResolvedValue({ id: entryId });
    mockRepo({ create });

    await request(createApp())
      .post('/mileage')
      .set('Authorization', caregiverAuth())
      .send({ tripDate: yesterday, miles: 0.125 });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ milesHundredths: 13 }));
  });

  it('refuses a trip dated in the future', async () => {
    const create = vi.fn();
    mockRepo({ create });
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    const res = await request(createApp())
      .post('/mileage')
      .set('Authorization', caregiverAuth())
      .send({ tripDate: tomorrow, miles: 5 });

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects zero, negative, and absurd distances', async () => {
    const create = vi.fn();
    mockRepo({ create });

    for (const miles of [0, -3, 501]) {
      const res = await request(createApp())
        .post('/mileage')
        .set('Authorization', caregiverAuth())
        .send({ tripDate: yesterday, miles });
      expect(res.status).toBe(400);
    }
    expect(create).not.toHaveBeenCalled();
  });

  it('will not let a non-caregiver log mileage', async () => {
    mockRepo({ create: vi.fn() });
    const res = await request(createApp())
      .post('/mileage')
      .set('Authorization', adminAuth())
      .send({ tripDate: yesterday, miles: 5 });
    expect(res.status).toBe(403);
  });
});

describe('GET /mileage', () => {
  it('gives a caregiver only their own trips', async () => {
    const listForCaregiver = vi.fn().mockResolvedValue([]);
    const listForAgency = vi.fn().mockResolvedValue([]);
    mockRepo({ listForCaregiver, listForAgency });

    await request(createApp()).get('/mileage').set('Authorization', caregiverAuth());

    expect(listForCaregiver).toHaveBeenCalledWith(caregiverId, agencyId, {});
    expect(listForAgency).not.toHaveBeenCalled();
  });

  it('gives staff the agency review queue', async () => {
    const listForCaregiver = vi.fn().mockResolvedValue([]);
    const listForAgency = vi.fn().mockResolvedValue([]);
    mockRepo({ listForCaregiver, listForAgency });

    await request(createApp())
      .get('/mileage?status=submitted')
      .set('Authorization', adminAuth());

    expect(listForAgency).toHaveBeenCalledWith(agencyId, { status: 'submitted' });
    expect(listForCaregiver).not.toHaveBeenCalled();
  });

  it('rejects a malformed filter', async () => {
    mockRepo({ listForCaregiver: vi.fn(), listForAgency: vi.fn() });
    const res = await request(createApp())
      .get('/mileage?from=08-2026')
      .set('Authorization', caregiverAuth());
    expect(res.status).toBe(400);
  });
});

describe('PATCH /mileage/:id/review', () => {
  it('lets staff approve a submitted trip', async () => {
    const review = vi.fn().mockResolvedValue({ id: entryId, status: 'approved' });
    mockRepo({ review });

    const res = await request(createApp())
      .patch(`/mileage/${entryId}/review`)
      .set('Authorization', adminAuth())
      .send({ status: 'approved', note: 'ok' });

    expect(res.status).toBe(200);
    expect(review).toHaveBeenCalledWith(entryId, agencyId, 'approved', userId, 'ok');
  });

  it('will not let a caregiver approve their own reimbursement', async () => {
    const review = vi.fn();
    mockRepo({ review });

    const res = await request(createApp())
      .patch(`/mileage/${entryId}/review`)
      .set('Authorization', caregiverAuth())
      .send({ status: 'approved' });

    expect(res.status).toBe(403);
    expect(review).not.toHaveBeenCalled();
  });

  it('404s on an already-reviewed or foreign entry, without saying which', async () => {
    // The repository only matches status='submitted', so a second reviewer
    // cannot silently overwrite the first decision.
    mockRepo({ review: vi.fn().mockResolvedValue(null) });

    const res = await request(createApp())
      .patch(`/mileage/${entryId}/review`)
      .set('Authorization', adminAuth())
      .send({ status: 'rejected' });

    expect(res.status).toBe(404);
  });

  it('rejects a status outside the workflow', async () => {
    mockRepo({ review: vi.fn() });
    const res = await request(createApp())
      .patch(`/mileage/${entryId}/review`)
      .set('Authorization', adminAuth())
      .send({ status: 'paid' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /mileage/:id', () => {
  it('withdraws the caregiver own not-yet-reviewed trip', async () => {
    const deleteOwnSubmitted = vi.fn().mockResolvedValue(true);
    mockRepo({ deleteOwnSubmitted });

    const res = await request(createApp())
      .delete(`/mileage/${entryId}`)
      .set('Authorization', caregiverAuth());

    expect(res.status).toBe(204);
    expect(deleteOwnSubmitted).toHaveBeenCalledWith(entryId, caregiverId, agencyId);
  });

  it('404s once the agency has ruled on the trip', async () => {
    // The decision record is not the caregiver's to erase.
    mockRepo({ deleteOwnSubmitted: vi.fn().mockResolvedValue(false) });

    const res = await request(createApp())
      .delete(`/mileage/${entryId}`)
      .set('Authorization', caregiverAuth());

    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    mockRepo({ deleteOwnSubmitted: vi.fn() });
    const res = await request(createApp()).delete(`/mileage/${entryId}`);
    expect(res.status).toBe(401);
  });
});
