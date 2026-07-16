/**
 * Offline store-and-forward queue for EVV punches, pure core.
 *
 * When a clock-in/out can't reach the server (dead zone, airplane mode), the
 * punch is persisted here with its original capture time and replayed in
 * order once connectivity returns. Storage and HTTP are injected so this
 * module has zero React Native imports and is fully unit-testable; the
 * AsyncStorage + apiClient wiring lives in offline-queue.ts.
 *
 * Invariants:
 *  - FIFO replay: a clock-out never replays before the clock-in it depends on.
 *  - A clock-out may reference a LOCAL visit id (its clock-in is still queued
 *    ahead of it); replay remaps the reference once the server assigns a real
 *    id (including via 409 VISIT_ALREADY_OPEN, which means an earlier retry
 *    actually landed).
 *  - Punches are EVIDENCE: only a definitive server rejection (4xx) drops
 *    one, and then it's kept in a failures list for the caregiver/office to
 *    see. Network failures, 401/403 (session refresh pending), 429 and 5xx
 *    all leave the queue untouched for a later retry.
 */

export interface QueuedLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface QueuedClockIn {
  kind: 'clock-in';
  localVisitId: string;
  assignmentId: string;
  serviceCode?: string;
  location: QueuedLocation;
  capturedAt: string;
}

/** Verification-of-service signature, same shape the clock-out API accepts. */
export interface QueuedSignature {
  strokes: [number, number][][];
  width: number;
  height: number;
  signerRole: 'client' | 'representative';
  signerName?: string;
}

export interface QueuedClockOut {
  kind: 'clock-out';
  /** Server visit id, or the localVisitId of a queued clock-in ahead of it. */
  visitRef: string;
  location: QueuedLocation;
  capturedAt: string;
  taskIds?: string[];
  note?: string;
  signature?: QueuedSignature;
}

export type QueuedPunch = QueuedClockIn | QueuedClockOut;

export interface FailedPunch {
  punch: QueuedPunch;
  status: number | null;
  message: string;
  failedAt: string;
}

export interface PersistedQueueState {
  punches: QueuedPunch[];
  failures: FailedPunch[];
}

export interface QueueStorage {
  load(): Promise<PersistedQueueState | null>;
  save(state: PersistedQueueState): Promise<void>;
}

export interface QueuePoster {
  /** Axios-shaped: rejects with err.response?.{status,data} when the server answered. */
  post(path: string, body: Record<string, unknown>): Promise<{ data: unknown }>;
}

export interface ReplayResult {
  /** drained = queue is now empty; blocked = stopped on a transient failure; busy = another replay is running. */
  outcome: 'drained' | 'blocked' | 'busy';
  /** How many punches reached the server this run. */
  synced: number;
}

export const LOCAL_VISIT_PREFIX = 'local-';

export function isLocalVisitId(id: string): boolean {
  return id.startsWith(LOCAL_VISIT_PREFIX);
}

function newLocalVisitId(): string {
  return `${LOCAL_VISIT_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const MAX_FAILURES_KEPT = 20;

interface PostError {
  response?: { status?: number; data?: { code?: string; message?: string; visit?: { id?: string } } };
}

/** Server answered and definitively refused: drop the punch. Everything else retries later. */
function isPermanentRejection(status: number | undefined): status is number {
  if (status === undefined) return false; // network failure
  if (status === 401 || status === 403 || status === 429) return false;
  return status >= 400 && status < 500;
}

export class OfflineEvvQueue {
  private state: PersistedQueueState = { punches: [], failures: [] };
  private loaded = false;
  private replaying = false;
  private listeners = new Set<() => void>();

  constructor(
    private readonly storage: QueueStorage,
    private readonly poster: QueuePoster,
  ) {}

  async init(): Promise<void> {
    if (this.loaded) return;
    try {
      const persisted = await this.storage.load();
      if (persisted && Array.isArray(persisted.punches) && Array.isArray(persisted.failures)) {
        this.state = persisted;
      }
    } catch {
      // Corrupt/unreadable persistence starts an empty queue rather than
      // crashing every EVV action; new punches re-persist immediately.
    }
    this.loaded = true;
    this.notify();
  }

  pendingCount(): number {
    return this.state.punches.length;
  }

  /** Snapshot of the queued-but-not-yet-synced punches, in replay (FIFO) order. */
  pendingPunches(): QueuedPunch[] {
    return [...this.state.punches];
  }

  failures(): FailedPunch[] {
    return [...this.state.failures];
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The queued clock-in for an assignment that has no queued clock-out yet, i.e. a locally open visit. */
  findOpenLocalClockIn(assignmentId: string): QueuedClockIn | undefined {
    const closedRefs = new Set(
      this.state.punches.filter((p): p is QueuedClockOut => p.kind === 'clock-out').map((p) => p.visitRef),
    );
    return this.state.punches.find(
      (p): p is QueuedClockIn =>
        p.kind === 'clock-in' && p.assignmentId === assignmentId && !closedRefs.has(p.localVisitId),
    );
  }

  /**
   * Queue a clock-in captured offline. Idempotent per assignment: if a queued
   * clock-in for this assignment is still open locally, that punch is
   * returned instead of a duplicate (covers app restarts while offline).
   */
  async enqueueClockIn(input: Omit<QueuedClockIn, 'kind' | 'localVisitId'>): Promise<QueuedClockIn> {
    await this.init();
    const existing = this.findOpenLocalClockIn(input.assignmentId);
    if (existing) return existing;
    const punch: QueuedClockIn = { kind: 'clock-in', localVisitId: newLocalVisitId(), ...input };
    this.state.punches.push(punch);
    await this.persist();
    return punch;
  }

  async enqueueClockOut(input: Omit<QueuedClockOut, 'kind'>): Promise<void> {
    await this.init();
    const punch: QueuedClockOut = { kind: 'clock-out', ...input };
    this.state.punches.push(punch);
    await this.persist();
  }

  /**
   * Replay queued punches in order. Stops (leaving the remainder queued) on
   * the first transient failure; drops to the failures list on a definitive
   * server rejection so one poisoned punch can't wedge the queue forever.
   */
  async replay(): Promise<ReplayResult> {
    await this.init();
    if (this.replaying) return { outcome: 'busy', synced: 0 };
    this.replaying = true;
    let synced = 0;
    try {
      while (this.state.punches.length > 0) {
        const punch = this.state.punches[0];
        let outcome: 'synced' | 'dropped' | 'blocked';
        if (punch.kind === 'clock-in') {
          outcome = await this.replayClockIn(punch);
        } else {
          outcome = await this.replayClockOut(punch);
        }
        if (outcome === 'blocked') return { outcome: 'blocked', synced };
        if (outcome === 'synced') synced += 1;
        // synced and dropped both remove the head punch (replay fns did it).
      }
      return { outcome: 'drained', synced };
    } finally {
      this.replaying = false;
      this.notify();
    }
  }

  private async replayClockIn(punch: QueuedClockIn): Promise<'synced' | 'dropped' | 'blocked'> {
    try {
      const { data } = await this.poster.post('/api/evv/clock-in', {
        assignmentId: punch.assignmentId,
        ...(punch.serviceCode ? { serviceCode: punch.serviceCode } : {}),
        location: punch.location,
        capturedAt: punch.capturedAt,
      });
      const serverId = (data as { id?: string })?.id;
      await this.resolveClockIn(punch, serverId);
      return 'synced';
    } catch (err) {
      const resp = (err as PostError).response;
      // 409 = an earlier attempt of this same punch actually landed (reply
      // was lost). The server hands back the open visit; treat as synced.
      if (resp?.status === 409 && resp.data?.code === 'VISIT_ALREADY_OPEN') {
        await this.resolveClockIn(punch, resp.data.visit?.id);
        return 'synced';
      }
      if (isPermanentRejection(resp?.status)) {
        await this.dropWithDependents(punch, resp?.status ?? null, resp?.data?.message ?? 'Rejected by server');
        return 'dropped';
      }
      return 'blocked';
    }
  }

  private async replayClockOut(punch: QueuedClockOut): Promise<'synced' | 'dropped' | 'blocked'> {
    if (isLocalVisitId(punch.visitRef)) {
      // FIFO means the owning clock-in should have resolved before we got
      // here; a still-local ref means it was dropped. Drop the orphan too.
      await this.drop(punch, null, 'Its clock-in could not be synced');
      return 'dropped';
    }
    try {
      await this.poster.post(`/api/evv/clock-out/${punch.visitRef}`, {
        location: punch.location,
        capturedAt: punch.capturedAt,
        ...(punch.taskIds && punch.taskIds.length > 0 ? { taskIds: punch.taskIds } : {}),
        ...(punch.note ? { note: punch.note } : {}),
        ...(punch.signature ? { signature: punch.signature } : {}),
      });
      this.state.punches.shift();
      await this.persist();
      return 'synced';
    } catch (err) {
      const resp = (err as PostError).response;
      if (isPermanentRejection(resp?.status)) {
        await this.drop(punch, resp?.status ?? null, resp?.data?.message ?? 'Rejected by server');
        return 'dropped';
      }
      return 'blocked';
    }
  }

  /** Remove a synced clock-in and point any queued clock-out at the real visit id. */
  private async resolveClockIn(punch: QueuedClockIn, serverId: string | undefined): Promise<void> {
    this.state.punches.shift();
    if (serverId) {
      for (const p of this.state.punches) {
        if (p.kind === 'clock-out' && p.visitRef === punch.localVisitId) p.visitRef = serverId;
      }
    }
    await this.persist();
  }

  private async drop(punch: QueuedPunch, status: number | null, message: string): Promise<void> {
    this.state.punches = this.state.punches.filter((p) => p !== punch);
    this.state.failures = [
      ...this.state.failures,
      { punch, status, message, failedAt: new Date().toISOString() },
    ].slice(-MAX_FAILURES_KEPT);
    await this.persist();
  }

  /** Drop a rejected clock-in plus any queued clock-out that depended on it. */
  private async dropWithDependents(punch: QueuedClockIn, status: number | null, message: string): Promise<void> {
    const dependents = this.state.punches.filter(
      (p): p is QueuedClockOut => p.kind === 'clock-out' && p.visitRef === punch.localVisitId,
    );
    await this.drop(punch, status, message);
    for (const dep of dependents) {
      await this.drop(dep, null, 'Its clock-in was rejected by the server');
    }
  }

  private async persist(): Promise<void> {
    try {
      await this.storage.save(this.state);
    } catch {
      // Persistence failure must not crash a punch; the in-memory queue still
      // replays this session and re-persists on the next mutation.
    }
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
