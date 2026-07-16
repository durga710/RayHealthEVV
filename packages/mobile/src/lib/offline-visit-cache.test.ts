import { describe, expect, it } from 'vitest';
import type { SecureKvStore } from './secure-store';
import type { QueuedClockIn, QueuedClockOut } from './offline-queue-core';
import {
  cacheVisitSchedule,
  clearCachedVisitSchedule,
  mergeQueuedVisitState,
  readCachedVisitSchedule,
  type CachedVisitScheduleRow,
} from './offline-visit-cache';

function memoryStore(): SecureKvStore {
  const values = new Map<string, string>();
  return {
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); },
    deleteItemAsync: async (key) => { values.delete(key); },
  };
}

const scope = { userId: 'user-1', agencyId: 'agency-1' };
const row: CachedVisitScheduleRow = {
  assignmentId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  scheduledStartTime: '2026-07-12T18:00:00.000Z',
  clientFirstName: 'Jamie',
  clientLastName: 'Doe',
  clientLatitude: 40.4406,
  clientLongitude: -79.9959,
  geofenceRadiusM: 150,
  currentVisitId: null,
  currentVisitStatus: null,
  currentClockInTime: null,
  currentClockOutTime: null,
};

describe('encrypted offline visit cache', () => {
  it('replaces and reads an account-and-agency scoped schedule', async () => {
    const store = memoryStore();
    await cacheVisitSchedule(store, scope, [row, { ...row, assignmentId: 'assignment-2' }]);
    await cacheVisitSchedule(store, scope, [row]);

    expect(await readCachedVisitSchedule(store, scope)).toEqual([row]);
    expect(await readCachedVisitSchedule(store, { ...scope, agencyId: 'agency-2' })).toEqual([]);
  });

  it('removes cached client schedule data for only the signed-out scope', async () => {
    const store = memoryStore();
    const otherScope = { userId: 'user-2', agencyId: 'agency-2' };
    await cacheVisitSchedule(store, scope, [row]);
    await cacheVisitSchedule(store, otherScope, [{ ...row, assignmentId: 'other-assignment' }]);

    await clearCachedVisitSchedule(store, scope);

    await expect(readCachedVisitSchedule(store, scope)).resolves.toEqual([]);
    await expect(readCachedVisitSchedule(store, otherScope)).resolves.toHaveLength(1);
  });

  it('overlays a pending local clock-in and clock-out without mutating cached rows', () => {
    // The queued clock-out references the clock-in by the local visit id the
    // offline queue assigns before the server does.
    const clockIn: QueuedClockIn = {
      kind: 'clock-in',
      localVisitId: 'local-visit',
      assignmentId: row.assignmentId,
      location: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
      capturedAt: '2026-07-12T18:05:00.000Z',
    };
    const clockOut: QueuedClockOut = {
      kind: 'clock-out',
      visitRef: 'local-visit',
      location: { lat: 40.4407, lng: -79.996, accuracy: 12 },
      capturedAt: '2026-07-12T20:05:00.000Z',
    };

    expect(mergeQueuedVisitState([row], [clockIn])[0]).toMatchObject({
      currentVisitId: 'local-visit',
      currentVisitStatus: 'pending',
      currentClockInTime: '2026-07-12T18:05:00.000Z',
      currentClockOutTime: null,
    });
    expect(mergeQueuedVisitState([row], [clockIn, clockOut])[0]).toMatchObject({
      currentVisitId: 'local-visit',
      currentVisitStatus: 'verified',
      currentClockOutTime: '2026-07-12T20:05:00.000Z',
    });
    expect(row.currentVisitId).toBeNull();
  });

  it('leaves a row untouched when queued punches belong to another assignment', () => {
    const clockIn: QueuedClockIn = {
      kind: 'clock-in',
      localVisitId: 'local-visit',
      assignmentId: 'some-other-assignment',
      location: { lat: 0, lng: 0, accuracy: 0 },
      capturedAt: '2026-07-12T18:05:00.000Z',
    };
    expect(mergeQueuedVisitState([row], [clockIn])).toEqual([row]);
  });
});
