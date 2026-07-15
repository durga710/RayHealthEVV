export interface EvvQueueScope {
  userId: string;
  agencyId: string;
}

export interface EvvQueueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface OfflineEvvLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

interface OfflineEvvEventBase {
  eventId: string;
  visitId: string;
  occurredAt: string;
  location: OfflineEvvLocation;
}

export type OfflineEvvEvent =
  | (OfflineEvvEventBase & {
      type: 'clock_in';
      assignmentId: string;
      serviceCode?: string;
    })
  | (OfflineEvvEventBase & { type: 'clock_out' });

export type EvvQueueStatus = 'pending' | 'needs_attention';

export interface EvvQueueItem {
  status: EvvQueueStatus;
  event: OfflineEvvEvent;
}

interface QueueIndexItem {
  eventId: string;
  status: EvvQueueStatus;
}

const MAX_QUEUE_EVENTS = 50;

function safeScopePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function indexKey(scope: EvvQueueScope): string {
  return `rayhealth_evv_index_${safeScopePart(scope.userId)}_${safeScopePart(scope.agencyId)}`;
}

function eventKey(scope: EvvQueueScope, eventId: string): string {
  return `rayhealth_evv_event_${safeScopePart(scope.userId)}_${safeScopePart(scope.agencyId)}_${safeScopePart(eventId)}`;
}

async function readIndex(store: EvvQueueStore, scope: EvvQueueScope): Promise<QueueIndexItem[]> {
  const raw = await store.getItemAsync(indexKey(scope));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueueIndexItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) =>
      item
      && typeof item.eventId === 'string'
      && (item.status === 'pending' || item.status === 'needs_attention'));
  } catch {
    return [];
  }
}

async function writeIndex(
  store: EvvQueueStore,
  scope: EvvQueueScope,
  items: QueueIndexItem[],
): Promise<void> {
  if (items.length === 0) {
    await store.deleteItemAsync(indexKey(scope));
    return;
  }
  await store.setItemAsync(indexKey(scope), JSON.stringify(items));
}

export async function enqueueEvvEvent(
  store: EvvQueueStore,
  scope: EvvQueueScope,
  event: OfflineEvvEvent,
): Promise<void> {
  const index = await readIndex(store, scope);
  if (index.some((item) => item.eventId === event.eventId)) return;
  if (index.length >= MAX_QUEUE_EVENTS) {
    throw new Error('The offline EVV queue is full. Connect to the internet before recording more visits.');
  }

  // Payloads are stored separately so each SecureStore value stays small.
  // Write payload first: an interrupted index write can leave an unreachable
  // encrypted value, but can never expose a queue entry with missing evidence.
  await store.setItemAsync(eventKey(scope, event.eventId), JSON.stringify(event));
  await writeIndex(store, scope, [...index, { eventId: event.eventId, status: 'pending' }]);
}

export async function listEvvQueue(
  store: EvvQueueStore,
  scope: EvvQueueScope,
): Promise<EvvQueueItem[]> {
  const index = await readIndex(store, scope);
  const items: EvvQueueItem[] = [];
  for (const indexed of index) {
    const raw = await store.getItemAsync(eventKey(scope, indexed.eventId));
    if (!raw) continue;
    try {
      items.push({ status: indexed.status, event: JSON.parse(raw) as OfflineEvvEvent });
    } catch {
      // A corrupt encrypted payload is ignored here and remains visible in the
      // index for support recovery instead of being silently deleted.
    }
  }
  return items;
}

export async function removeEvvEvent(
  store: EvvQueueStore,
  scope: EvvQueueScope,
  eventId: string,
): Promise<void> {
  const index = await readIndex(store, scope);
  await store.deleteItemAsync(eventKey(scope, eventId));
  await writeIndex(store, scope, index.filter((item) => item.eventId !== eventId));
}

function isRetryable(error: unknown): boolean {
  const explicit = (error as { retryable?: unknown } | null)?.retryable;
  if (typeof explicit === 'boolean') return explicit;
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === undefined || status === 408 || status === 429 || status >= 500;
}

export async function syncEvvQueue(
  store: EvvQueueStore,
  scope: EvvQueueScope,
  send: (event: OfflineEvvEvent) => Promise<void>,
): Promise<{ synced: string[]; pending: string[]; needsAttention: string[] }> {
  let index = await readIndex(store, scope);
  const synced: string[] = [];

  for (const indexed of index) {
    if (indexed.status === 'needs_attention') continue;
    const raw = await store.getItemAsync(eventKey(scope, indexed.eventId));
    if (!raw) {
      index = index.filter((item) => item.eventId !== indexed.eventId);
      continue;
    }

    let event: OfflineEvvEvent;
    try {
      event = JSON.parse(raw) as OfflineEvvEvent;
    } catch {
      index = index.map((item) => item.eventId === indexed.eventId
        ? { ...item, status: 'needs_attention' }
        : item);
      break;
    }

    try {
      await send(event);
      synced.push(indexed.eventId);
      await store.deleteItemAsync(eventKey(scope, indexed.eventId));
      index = index.filter((item) => item.eventId !== indexed.eventId);
    } catch (error) {
      if (!isRetryable(error)) {
        index = index.map((item) => item.eventId === indexed.eventId
          ? { ...item, status: 'needs_attention' }
          : item);
      }
      // Preserve causal ordering: a clock-out must never pass its clock-in.
      break;
    }
  }

  await writeIndex(store, scope, index);
  return {
    synced,
    pending: index.filter((item) => item.status === 'pending').map((item) => item.eventId),
    needsAttention: index
      .filter((item) => item.status === 'needs_attention')
      .map((item) => item.eventId),
  };
}
