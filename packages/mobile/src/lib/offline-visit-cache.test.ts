import { describe, expect, it } from 'vitest';
import type { EvvQueueItem, EvvQueueStore } from './offline-evv-queue';
import {
  cacheVisitSchedule,
  clearCachedVisitSchedule,
  mergeQueuedVisitState,
  readCachedVisitSchedule,
  type CachedVisitScheduleRow,
} from './offline-visit-cache';

function memoryStore(): EvvQueueStore {
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
    const clockIn: EvvQueueItem = {
      status: 'pending',
      event: {
        type: 'clock_in',
        eventId: 'event-in',
        visitId: 'visit-local',
        assignmentId: row.assignmentId,
        occurredAt: '2026-07-12T18:05:00.000Z',
        location: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
      },
    };
    const clockOut: EvvQueueItem = {
      status: 'pending',
      event: {
        type: 'clock_out',
        eventId: 'event-out',
        visitId: 'visit-local',
        occurredAt: '2026-07-12T20:05:00.000Z',
        location: { lat: 40.4407, lng: -79.996, accuracy: 12 },
      },
    };

    expect(mergeQueuedVisitState([row], [clockIn])[0]).toMatchObject({
      currentVisitId: 'visit-local',
      currentVisitStatus: 'pending',
      currentClockInTime: '2026-07-12T18:05:00.000Z',
      currentClockOutTime: null,
    });
    expect(mergeQueuedVisitState([row], [clockIn, clockOut])[0]).toMatchObject({
      currentVisitId: 'visit-local',
      currentClockOutTime: '2026-07-12T20:05:00.000Z',
    });
    expect(row.currentVisitId).toBeNull();
  });

  it('does not treat quarantined punches as completed visits', () => {
    const quarantined: EvvQueueItem = {
      status: 'needs_attention',
      event: {
        type: 'clock_in',
        eventId: 'event-in',
        visitId: 'visit-local',
        assignmentId: row.assignmentId,
        occurredAt: '2026-07-12T18:05:00.000Z',
        location: { lat: 0, lng: 0, accuracy: 0 },
      },
    };
    expect(mergeQueuedVisitState([row], [quarantined])).toEqual([row]);
  });
});
