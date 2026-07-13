import type {
  EvvQueueItem,
  EvvQueueScope,
  EvvQueueStore,
} from './offline-evv-queue';

export interface CachedVisitScheduleRow {
  assignmentId: string;
  scheduledStartTime: string | null;
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

function indexKey(scope: EvvQueueScope): string {
  return `rayhealth_visit_cache_index_${safePart(scope.userId)}_${safePart(scope.agencyId)}`;
}

function rowKey(scope: EvvQueueScope, assignmentId: string): string {
  return `rayhealth_visit_cache_row_${safePart(scope.userId)}_${safePart(scope.agencyId)}_${safePart(assignmentId)}`;
}

async function readIndex(store: EvvQueueStore, scope: EvvQueueScope): Promise<string[]> {
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
  store: EvvQueueStore,
  scope: EvvQueueScope,
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
  store: EvvQueueStore,
  scope: EvvQueueScope,
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
  store: EvvQueueStore,
  scope: EvvQueueScope,
): Promise<void> {
  const ids = await readIndex(store, scope);
  for (const assignmentId of ids) {
    await store.deleteItemAsync(rowKey(scope, assignmentId));
  }
  await store.deleteItemAsync(indexKey(scope));
}

export function mergeQueuedVisitState(
  rows: CachedVisitScheduleRow[],
  queue: EvvQueueItem[],
): CachedVisitScheduleRow[] {
  const pending = queue.filter((item) => item.status === 'pending');
  return rows.map((row) => {
    const localClockIn = [...pending].reverse().find(
      (item) => item.event.type === 'clock_in' && item.event.assignmentId === row.assignmentId,
    );
    const visitId = localClockIn?.event.visitId ?? row.currentVisitId;
    if (!visitId) return row;
    const localClockOut = [...pending].reverse().find(
      (item) => item.event.type === 'clock_out' && item.event.visitId === visitId,
    );
    if (!localClockIn && !localClockOut) return row;
    return {
      ...row,
      currentVisitId: visitId,
      currentVisitStatus: localClockOut ? 'verified' : 'pending',
      currentClockInTime: localClockIn?.event.occurredAt ?? row.currentClockInTime,
      currentClockOutTime: localClockOut?.event.occurredAt ?? row.currentClockOutTime,
    };
  });
}
