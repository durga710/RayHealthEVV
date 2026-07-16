import type { CacheScope, SecureKvStore } from './secure-store';
import type { QueuedClockIn, QueuedClockOut, QueuedPunch } from './offline-queue-core';

export interface CachedVisitScheduleRow {
  assignmentId: string;
  scheduledStartTime: string | null;
  // Optional so rows cached before this field existed still parse.
  scheduledEndTime?: string | null;
  clientFirstName: string;
  clientLastName: string;
  clientAddressLine1?: string | null;
  clientCity?: string | null;
  clientState?: string | null;
  clientLatitude: number | null;
  clientLongitude: number | null;
  geofenceRadiusM: number;
  currentVisitId: string | null;
  currentVisitStatus: string | null;
  currentClockInTime: string | null;
  currentClockOutTime: string | null;
}

const MAX_CACHED_ASSIGNMENTS = 100;

function safePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function indexKey(scope: CacheScope): string {
  return `rayhealth_visit_cache_index_${safePart(scope.userId)}_${safePart(scope.agencyId)}`;
}

function rowKey(scope: CacheScope, assignmentId: string): string {
  return `rayhealth_visit_cache_row_${safePart(scope.userId)}_${safePart(scope.agencyId)}_${safePart(assignmentId)}`;
}

async function readIndex(store: SecureKvStore, scope: CacheScope): Promise<string[]> {
  const raw = await store.getItemAsync(indexKey(scope));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function cacheVisitSchedule(
  store: SecureKvStore,
  scope: CacheScope,
  rows: CachedVisitScheduleRow[],
): Promise<void> {
  if (rows.length > MAX_CACHED_ASSIGNMENTS) {
    throw new Error('The visit schedule is too large to cache safely on this device.');
  }
  const previous = await readIndex(store, scope);
  const ids = [...new Set(rows.map((row) => row.assignmentId))];

  for (const row of rows) {
    await store.setItemAsync(rowKey(scope, row.assignmentId), JSON.stringify(row));
  }
  if (ids.length === 0) {
    await store.deleteItemAsync(indexKey(scope));
  } else {
    await store.setItemAsync(indexKey(scope), JSON.stringify(ids));
  }
  for (const staleId of previous.filter((id) => !ids.includes(id))) {
    await store.deleteItemAsync(rowKey(scope, staleId));
  }
}

export async function readCachedVisitSchedule(
  store: SecureKvStore,
  scope: CacheScope,
): Promise<CachedVisitScheduleRow[]> {
  const ids = await readIndex(store, scope);
  const rows: CachedVisitScheduleRow[] = [];
  for (const assignmentId of ids) {
    const raw = await store.getItemAsync(rowKey(scope, assignmentId));
    if (!raw) continue;
    try {
      const row = JSON.parse(raw) as CachedVisitScheduleRow;
      if (row?.assignmentId === assignmentId) rows.push(row);
    } catch {
      // Keep the index entry for support recovery; ignore corrupt display data.
    }
  }
  return rows;
}

export async function clearCachedVisitSchedule(
  store: SecureKvStore,
  scope: CacheScope,
): Promise<void> {
  const ids = await readIndex(store, scope);
  for (const assignmentId of ids) {
    await store.deleteItemAsync(rowKey(scope, assignmentId));
  }
  await store.deleteItemAsync(indexKey(scope));
}

/**
 * Overlay the still-queued offline punches onto the cached schedule so a visit
 * clocked in/out while offline reads as in-progress/verified until it syncs.
 * `punches` is the live offline queue's pending snapshot (offlineEvvQueue
 * .pendingPunches()); a queued clock-out references its clock-in by the
 * local visit id the queue assigns before the server does.
 */
export function mergeQueuedVisitState(
  rows: CachedVisitScheduleRow[],
  punches: QueuedPunch[],
): CachedVisitScheduleRow[] {
  return rows.map((row) => {
    const localClockIn = [...punches].reverse().find(
      (p): p is QueuedClockIn => p.kind === 'clock-in' && p.assignmentId === row.assignmentId,
    );
    const visitId = localClockIn?.localVisitId ?? row.currentVisitId;
    if (!visitId) return row;
    const localClockOut = [...punches].reverse().find(
      (p): p is QueuedClockOut => p.kind === 'clock-out' && p.visitRef === visitId,
    );
    if (!localClockIn && !localClockOut) return row;
    return {
      ...row,
      currentVisitId: visitId,
      currentVisitStatus: localClockOut ? 'verified' : 'pending',
      currentClockInTime: localClockIn?.capturedAt ?? row.currentClockInTime,
      currentClockOutTime: localClockOut?.capturedAt ?? row.currentClockOutTime,
    };
  });
}
