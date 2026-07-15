export type VisitTaskStatus = 'performed' | 'refused' | 'not_performed';

export interface VisitTaskPlanItem {
  taskCode?: string;
  taskLabel: string;
}

export interface PersistedVisitTaskCompletion extends VisitTaskPlanItem {
  clientEventId: string;
  status: VisitTaskStatus;
}

export interface VisitTaskDraftItem extends VisitTaskPlanItem {
  clientEventId?: string;
  status: VisitTaskStatus | null;
}

function key(item: VisitTaskPlanItem): string {
  return `${item.taskCode ?? ''}:${item.taskLabel.trim().toLowerCase()}`;
}

export function buildTaskDraft(
  plan: VisitTaskPlanItem[],
  completions: PersistedVisitTaskCompletion[],
): VisitTaskDraftItem[] {
  const byTask = new Map(completions.map((completion) => [key(completion), completion]));
  return plan.map((task) => {
    const persisted = byTask.get(key(task));
    return {
      ...task,
      clientEventId: persisted?.clientEventId,
      status: persisted?.status ?? null,
    };
  });
}

export function setTaskDraftStatus(
  draft: VisitTaskDraftItem[],
  index: number,
  status: VisitTaskStatus,
  clientEventId: string,
): VisitTaskDraftItem[] {
  return draft.map((task, taskIndex) =>
    taskIndex === index ? { ...task, status, clientEventId } : task,
  );
}

export function isTaskDraftComplete(draft: VisitTaskDraftItem[]): boolean {
  return draft.every((task) => task.status !== null && Boolean(task.clientEventId));
}

export function toTaskCompletionPayload(
  draft: VisitTaskDraftItem[],
): PersistedVisitTaskCompletion[] {
  if (!isTaskDraftComplete(draft)) {
    throw new Error('Every care task needs a status before submission.');
  }
  return draft.map((task) => ({
    clientEventId: task.clientEventId as string,
    ...(task.taskCode ? { taskCode: task.taskCode } : {}),
    taskLabel: task.taskLabel,
    status: task.status as VisitTaskStatus,
  }));
}

export function createClientEventId(): string {
  const cryptoApi = globalThis.crypto;
  const randomUuid = cryptoApi?.randomUUID?.bind(cryptoApi);
  if (randomUuid) return randomUuid();

  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    // This identifier is an idempotency key, not an authentication secret.
    // Older Hermes runtimes may not expose the Web Crypto API.
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
