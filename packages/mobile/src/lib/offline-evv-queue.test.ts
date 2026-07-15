import { describe, expect, it, vi } from 'vitest';
import {
  enqueueEvvEvent,
  listEvvQueue,
  removeEvvEvent,
  syncEvvQueue,
  type EvvQueueStore,
  type OfflineEvvEvent,
} from './offline-evv-queue';

function memoryStore(): EvvQueueStore {
  const values = new Map<string, string>();
  return {
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); },
    deleteItemAsync: async (key) => { values.delete(key); },
  };
}

const scope = { userId: 'user-1', agencyId: 'agency-1' };
const clockIn: OfflineEvvEvent = {
  type: 'clock_in',
  eventId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  visitId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  assignmentId: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
  serviceCode: 'T1019',
  occurredAt: '2026-07-12T18:15:00.000Z',
  location: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
};

describe('offline EVV queue', () => {
  it('persists ordered events in an account-and-agency scoped store', async () => {
    const store = memoryStore();
    await enqueueEvvEvent(store, scope, clockIn);
    await enqueueEvvEvent(store, scope, {
      type: 'clock_out',
      eventId: 'dddddddd-dddd-4ddd-dddd-dddddddddddd',
      visitId: clockIn.visitId,
      occurredAt: '2026-07-12T20:15:00.000Z',
      location: { lat: 40.4407, lng: -79.996, accuracy: 12 },
    });

    expect(await listEvvQueue(store, scope)).toMatchObject([
      { status: 'pending', event: { type: 'clock_in', eventId: clockIn.eventId } },
      { status: 'pending', event: { type: 'clock_out', visitId: clockIn.visitId } },
    ]);
    expect(await listEvvQueue(store, { ...scope, agencyId: 'agency-2' })).toEqual([]);
  });

  it('removes successful events and retains retryable failures in order', async () => {
    const store = memoryStore();
    await enqueueEvvEvent(store, scope, clockIn);
    const send = vi.fn().mockResolvedValue(undefined);

    expect(await syncEvvQueue(store, scope, send)).toEqual({
      synced: [clockIn.eventId],
      pending: [],
      needsAttention: [],
    });
    expect(send).toHaveBeenCalledWith(clockIn);
    expect(await listEvvQueue(store, scope)).toEqual([]);

    await enqueueEvvEvent(store, scope, clockIn);
    const offline = Object.assign(new Error('offline'), { retryable: true });
    expect(await syncEvvQueue(store, scope, vi.fn().mockRejectedValue(offline))).toEqual({
      synced: [],
      pending: [clockIn.eventId],
      needsAttention: [],
    });
  });

  it('quarantines permanent rejections and can explicitly remove them', async () => {
    const store = memoryStore();
    await enqueueEvvEvent(store, scope, clockIn);
    const rejected = Object.assign(new Error('outside geofence'), { retryable: false });

    const result = await syncEvvQueue(store, scope, vi.fn().mockRejectedValue(rejected));
    expect(result.needsAttention).toEqual([clockIn.eventId]);
    expect((await listEvvQueue(store, scope))[0]?.status).toBe('needs_attention');

    await removeEvvEvent(store, scope, clockIn.eventId);
    expect(await listEvvQueue(store, scope)).toEqual([]);
  });
});
