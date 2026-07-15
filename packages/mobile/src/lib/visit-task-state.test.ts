import { describe, expect, it } from 'vitest';
import {
  buildTaskDraft,
  isTaskDraftComplete,
  setTaskDraftStatus,
  toTaskCompletionPayload,
} from './visit-task-state';

const plan = [
  { taskCode: '122', taskLabel: 'Hygiene' },
  { taskCode: '134', taskLabel: 'Bathing' },
];

describe('visit task draft state', () => {
  it('merges persisted statuses into the visit plan', () => {
    const draft = buildTaskDraft(plan, [
      {
        clientEventId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        taskCode: '122',
        taskLabel: 'Hygiene',
        status: 'performed',
      },
    ]);

    expect(draft[0]).toMatchObject({ status: 'performed' });
    expect(draft[1]).toMatchObject({ status: null });
  });

  it('assigns a new idempotency key when a task status changes', () => {
    const draft = buildTaskDraft(plan, []);
    const updated = setTaskDraftStatus(
      draft,
      1,
      'refused',
      'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    );

    expect(updated[1]).toMatchObject({
      status: 'refused',
      clientEventId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    });
    expect(draft[1].status).toBeNull();
  });

  it('only serializes a fully answered care plan', () => {
    let draft = buildTaskDraft(plan, []);
    expect(isTaskDraftComplete(draft)).toBe(false);
    expect(() => toTaskCompletionPayload(draft)).toThrow('Every care task');

    draft = setTaskDraftStatus(draft, 0, 'performed', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
    draft = setTaskDraftStatus(draft, 1, 'not_performed', 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb');

    expect(isTaskDraftComplete(draft)).toBe(true);
    expect(toTaskCompletionPayload(draft)).toEqual([
      {
        clientEventId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        taskCode: '122',
        taskLabel: 'Hygiene',
        status: 'performed',
      },
      {
        clientEventId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        taskCode: '134',
        taskLabel: 'Bathing',
        status: 'not_performed',
      },
    ]);
  });
});
