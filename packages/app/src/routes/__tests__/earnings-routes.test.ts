import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());
afterEach(() => vi.restoreAllMocks());

const agencyId = '00000000-0000-4000-8000-0000000000e1';
const userId = '00000000-0000-4000-8000-0000000000e2';
const caregiverId = '00000000-0000-4000-8000-0000000000e3';

function visit(date: string, hours: number, status = 'verified') {
  const start = new Date(`${date}T09:00:00.000Z`);
  return {
    id: `v-${date}`,
    caregiverId,
    clockInTime: start.toISOString(),
    clockOutTime: new Date(start.getTime() + hours * 3_600_000).toISOString(),
    status,
    serviceCode: 'W1793',
  };
}

function mockData(visits: unknown[], payRateCents: number | null) {
  const getVisitsForCaregiver = vi.fn().mockResolvedValue(visits);
  vi.spyOn(core, 'EvvRepository').mockImplementation(
    () => ({ getVisitsForCaregiver }) as unknown as core.EvvRepository,
  );
  const getPayRateCents = vi.fn().mockResolvedValue(payRateCents);
  vi.spyOn(core, 'CaregiverRepository').mockImplementation(
    () => ({ getPayRateCents }) as unknown as core.CaregiverRepository,
  );
  return { getVisitsForCaregiver, getPayRateCents };
}

function get(query: string, role: 'caregiver' | 'admin' = 'caregiver') {
  return request(createApp())
    .get(`/evv/earnings${query}`)
    .set(
      'Authorization',
      `Bearer ${makeToken(role, agencyId, userId, role === 'caregiver' ? caregiverId : undefined)}`,
    );
}

describe('GET /evv/earnings', () => {
  it('returns a derived statement for the calling caregiver', async () => {
    const { getPayRateCents } = mockData([visit('2026-08-03', 8)], 1800);

    const res = await get('?from=2026-08-02&to=2026-08-08');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ source: 'derived', visitCount: 1, grossCents: 14400 });
    // Pay rate is read agency-scoped for the caller's own caregiver record.
    expect(getPayRateCents).toHaveBeenCalledWith(caregiverId, agencyId);
  });

  it('reports null earnings, not zero, when the agency has set no rate', async () => {
    mockData([visit('2026-08-03', 8)], null);

    const res = await get('?from=2026-08-02&to=2026-08-08');

    expect(res.body.grossCents).toBeNull();
    expect(res.body.totalHours).toBe(8);
  });

  it('excludes visits outside the requested range', async () => {
    mockData([visit('2026-08-03', 8), visit('2026-09-15', 8)], 1800);

    const res = await get('?from=2026-08-02&to=2026-08-08');

    expect(res.body.visitCount).toBe(1);
  });

  it('is caregiver-only, since this is the caller own compensation', async () => {
    mockData([], 1800);
    const res = await get('?from=2026-08-02&to=2026-08-08', 'admin');
    expect(res.status).toBe(403);
  });

  it('rejects a malformed or inverted range', async () => {
    mockData([], 1800);
    expect((await get('?from=2026-08-02')).status).toBe(400);
    expect((await get('?from=08/02/2026&to=08/08/2026')).status).toBe(400);
    // to before from would silently return nothing; say so instead.
    expect((await get('?from=2026-08-08&to=2026-08-02')).status).toBe(400);
  });

  it('requires authentication', async () => {
    mockData([], 1800);
    const res = await request(createApp()).get('/evv/earnings?from=2026-08-02&to=2026-08-08');
    expect(res.status).toBe(401);
  });

  it('counts overtime for a long week', async () => {
    mockData(
      [
        visit('2026-08-03', 9),
        visit('2026-08-04', 9),
        visit('2026-08-05', 9),
        visit('2026-08-06', 9),
        visit('2026-08-07', 9),
      ],
      2000,
    );

    const res = await get('?from=2026-08-02&to=2026-08-08');

    expect(res.body.overtimeMinutes).toBe(300);
    expect(res.body.grossCents).toBe(40 * 2000 + Math.round(5 * 2000 * 1.5));
  });

  it('surfaces visits that are not yet countable', async () => {
    mockData([visit('2026-08-03', 8), visit('2026-08-04', 8, 'pending')], 1800);

    const res = await get('?from=2026-08-02&to=2026-08-08');

    expect(res.body.visitCount).toBe(1);
    expect(res.body.excludedVisits).toBe(1);
  });
});
