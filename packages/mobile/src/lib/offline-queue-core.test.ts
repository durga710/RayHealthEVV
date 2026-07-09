import { describe, expect, it, vi } from 'vitest';
import {
  OfflineEvvQueue,
  isLocalVisitId,
  type PersistedQueueState,
  type QueueStorage,
} from './offline-queue-core';

const LOCATION = { lat: 40.4406, lng: -79.9959, accuracy: 12 };

function memoryStorage(initial: PersistedQueueState | null = null): QueueStorage & { current: () => PersistedQueueState | null } {
  let saved = initial;
  return {
    load: () => Promise.resolve(saved),
    save: (state) => {
      saved = JSON.parse(JSON.stringify(state));
      return Promise.resolve();
    },
    current: () => saved,
  };
}

function axiosError(status?: number, data?: unknown) {
  const err = new Error(`http ${status ?? 'network'}`) as Error & { response?: { status?: number; data?: unknown } };
  if (status !== undefined) err.response = { status, data };
  return err;
}

describe('OfflineEvvQueue', () => {
  it('enqueues a clock-in once per open assignment (restart-offline double tap)', async () => {
    const queue = new OfflineEvvQueue(memoryStorage(), { post: vi.fn() });
    const first = await queue.enqueueClockIn({ assignmentId: 'a-1', location: LOCATION, capturedAt: '2026-07-08T10:00:00.000Z' });
    const second = await queue.enqueueClockIn({ assignmentId: 'a-1', location: LOCATION, capturedAt: '2026-07-08T10:05:00.000Z' });
    expect(second.localVisitId).toBe(first.localVisitId);
    expect(second.capturedAt).toBe('2026-07-08T10:00:00.000Z');
    expect(queue.pendingCount()).toBe(1);
    expect(isLocalVisitId(first.localVisitId)).toBe(true);

    // Once the local visit is clocked out, a new clock-in queues fresh.
    await queue.enqueueClockOut({ visitRef: first.localVisitId, location: LOCATION, capturedAt: '2026-07-08T12:00:00.000Z' });
    const third = await queue.enqueueClockIn({ assignmentId: 'a-1', location: LOCATION, capturedAt: '2026-07-08T13:00:00.000Z' });
    expect(third.localVisitId).not.toBe(first.localVisitId);
  });

  it('replays FIFO with capturedAt and remaps a local clock-out ref to the server id', async () => {
    const post = vi.fn()
      .mockResolvedValueOnce({ data: { id: 'server-visit-1' } }) // clock-in
      .mockResolvedValueOnce({ data: {} }); // clock-out
    const queue = new OfflineEvvQueue(memoryStorage(), { post });
    const punch = await queue.enqueueClockIn({
      assignmentId: 'a-1', serviceCode: 'T1019', location: LOCATION, capturedAt: '2026-07-08T10:00:00.000Z',
    });
    await queue.enqueueClockOut({
      visitRef: punch.localVisitId, location: LOCATION, capturedAt: '2026-07-08T12:00:00.000Z',
      taskIds: ['134'], note: 'Synced later.',
    });

    const result = await queue.replay();

    expect(result).toEqual({ outcome: 'drained', synced: 2 });
    expect(post).toHaveBeenNthCalledWith(1, '/api/evv/clock-in', {
      assignmentId: 'a-1', serviceCode: 'T1019', location: LOCATION, capturedAt: '2026-07-08T10:00:00.000Z',
    });
    expect(post).toHaveBeenNthCalledWith(2, '/api/evv/clock-out/server-visit-1', {
      location: LOCATION, capturedAt: '2026-07-08T12:00:00.000Z', taskIds: ['134'], note: 'Synced later.',
    });
    expect(queue.pendingCount()).toBe(0);
  });

  it('treats 409 VISIT_ALREADY_OPEN as a lost-reply success and remaps', async () => {
    const post = vi.fn()
      .mockRejectedValueOnce(axiosError(409, { code: 'VISIT_ALREADY_OPEN', visit: { id: 'server-visit-9' } }))
      .mockResolvedValueOnce({ data: {} });
    const queue = new OfflineEvvQueue(memoryStorage(), { post });
    const punch = await queue.enqueueClockIn({ assignmentId: 'a-1', location: LOCATION, capturedAt: '2026-07-08T10:00:00.000Z' });
    await queue.enqueueClockOut({ visitRef: punch.localVisitId, location: LOCATION, capturedAt: '2026-07-08T12:00:00.000Z' });

    const result = await queue.replay();

    expect(result.outcome).toBe('drained');
    expect(post).toHaveBeenLastCalledWith('/api/evv/clock-out/server-visit-9', expect.anything());
  });

  it('stops on a network failure and keeps every punch queued', async () => {
    const post = vi.fn().mockRejectedValue(axiosError(undefined));
    const storage = memoryStorage();
    const queue = new OfflineEvvQueue(storage, { post });
    await queue.enqueueClockIn({ assignmentId: 'a-1', location: LOCATION, capturedAt: '2026-07-08T10:00:00.000Z' });

    const result = await queue.replay();

    expect(result).toEqual({ outcome: 'blocked', synced: 0 });
    expect(queue.pendingCount()).toBe(1);
    expect(post).toHaveBeenCalledTimes(1);
    expect(storage.current()?.punches).toHaveLength(1);
  });

  it('keeps punches on 401/403/429/5xx (transient) responses', async () => {
    for (const status of [401, 403, 429, 500, 503]) {
      const queue = new OfflineEvvQueue(memoryStorage(), { post: vi.fn().mockRejectedValue(axiosError(status)) });
      await queue.enqueueClockIn({ assignmentId: 'a-1', location: LOCATION, capturedAt: '2026-07-08T10:00:00.000Z' });
      const result = await queue.replay();
      expect(result.outcome, `status ${status}`).toBe('blocked');
      expect(queue.pendingCount(), `status ${status}`).toBe(1);
    }
  });

  it('drops a definitively rejected clock-in plus its dependent clock-out into failures', async () => {
    const post = vi.fn().mockRejectedValue(axiosError(400, { message: 'Assignment not found' }));
    const queue = new OfflineEvvQueue(memoryStorage(), { post });
    const punch = await queue.enqueueClockIn({ assignmentId: 'a-1', location: LOCATION, capturedAt: '2026-07-08T10:00:00.000Z' });
    await queue.enqueueClockOut({ visitRef: punch.localVisitId, location: LOCATION, capturedAt: '2026-07-08T12:00:00.000Z' });

    const result = await queue.replay();

    expect(result).toEqual({ outcome: 'drained', synced: 0 });
    expect(queue.pendingCount()).toBe(0);
    expect(queue.failures()).toHaveLength(2);
    expect(post).toHaveBeenCalledTimes(1); // dependent clock-out never posted
  });

  it('recovers persisted punches through a restart', async () => {
    const storage = memoryStorage();
    const first = new OfflineEvvQueue(storage, { post: vi.fn().mockRejectedValue(axiosError(undefined)) });
    await first.enqueueClockIn({ assignmentId: 'a-1', location: LOCATION, capturedAt: '2026-07-08T10:00:00.000Z' });

    const post = vi.fn().mockResolvedValue({ data: { id: 'server-visit-1' } });
    const second = new OfflineEvvQueue(storage, { post });
    await second.init();
    expect(second.pendingCount()).toBe(1);
    const result = await second.replay();
    expect(result).toEqual({ outcome: 'drained', synced: 1 });
  });
});
