import { describe, expect, it } from 'vitest';
import { normalizeVisitTaskPlan } from '../repositories/visit-task-completion-repository.js';

describe('normalizeVisitTaskPlan', () => {
  it('maps legacy duty strings to canonical PA task codes', () => {
    expect(normalizeVisitTaskPlan(['Hygiene', 'Bathing'])).toEqual([
      { taskCode: '122', taskLabel: 'Hygiene' },
      { taskCode: '134', taskLabel: 'Bathing' },
    ]);
  });

  it('normalizes object tasks and drops malformed duplicates', () => {
    expect(normalizeVisitTaskPlan([
      { id: '122', duty: 'Hygiene' },
      { taskCode: '122', taskLabel: 'Hygiene' },
      { id: '134' },
      null,
      '',
    ])).toEqual([
      { taskCode: '122', taskLabel: 'Hygiene' },
      { taskCode: '134', taskLabel: 'Bathing' },
    ]);
  });
});
