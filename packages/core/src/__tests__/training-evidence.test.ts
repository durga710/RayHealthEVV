import { describe, expect, it } from 'vitest';
import { evaluateTrainingAtTime, type CaregiverTrainingRecord } from '../services/training-evidence.js';

const VISIT_AT = '2026-06-01T14:00:00.000Z';

function record(overrides: Partial<CaregiverTrainingRecord> = {}): CaregiverTrainingRecord {
  return {
    courseId: 'course-1',
    code: 'ORIENT-PA',
    title: 'New Hire Orientation',
    required: true,
    cadence: 'one_time',
    expiresAfterDays: null,
    dueAt: null,
    completions: [],
    ...overrides,
  };
}

describe('evaluateTrainingAtTime', () => {
  it('covers a visit when the completion happened before it and never expires', () => {
    const out = evaluateTrainingAtTime(
      [record({ completions: [{ completedAt: '2026-05-01T10:00:00.000Z', score: 90 }] })],
      VISIT_AT,
    );
    expect(out.compliantAtTime).toBe(true);
    expect(out.records[0]).toMatchObject({
      coveredAtTime: true,
      coveringCompletedAt: '2026-05-01T10:00:00.000Z',
      coveringExpiresAt: null,
      score: 90,
    });
  });

  it('a completion AFTER the visit does not cover it', () => {
    const out = evaluateTrainingAtTime(
      [record({ completions: [{ completedAt: '2026-06-02T10:00:00.000Z', score: 100 }] })],
      VISIT_AT,
    );
    expect(out.compliantAtTime).toBe(false);
    expect(out.records[0].coveredAtTime).toBe(false);
    expect(out.records[0].coveringCompletedAt).toBeNull();
  });

  it('a completion that expired before the visit does not cover it', () => {
    // Completed 400 days before the visit with a 365-day validity window.
    const out = evaluateTrainingAtTime(
      [
        record({
          code: 'ANNUAL-HIPAA',
          cadence: 'annual',
          expiresAfterDays: 365,
          completions: [{ completedAt: '2025-04-27T14:00:00.000Z', score: 85 }],
        }),
      ],
      VISIT_AT,
    );
    expect(out.compliantAtTime).toBe(false);
    expect(out.records[0].coveredAtTime).toBe(false);
  });

  it('an older still-valid completion covers when the newest is after the visit', () => {
    const out = evaluateTrainingAtTime(
      [
        record({
          expiresAfterDays: 365,
          completions: [
            { completedAt: '2026-06-05T10:00:00.000Z', score: 100 }, // after visit
            { completedAt: '2026-01-15T10:00:00.000Z', score: 80 }, // covers
          ],
        }),
      ],
      VISIT_AT,
    );
    expect(out.compliantAtTime).toBe(true);
    expect(out.records[0]).toMatchObject({
      coveredAtTime: true,
      coveringCompletedAt: '2026-01-15T10:00:00.000Z',
      score: 80,
    });
    expect(out.records[0].coveringExpiresAt).toBe('2027-01-15T10:00:00.000Z');
  });

  it('an uncovered OPTIONAL course does not break compliance', () => {
    const out = evaluateTrainingAtTime(
      [
        record({ completions: [{ completedAt: '2026-05-01T10:00:00.000Z', score: 90 }] }),
        record({ courseId: 'course-2', code: 'CPR-FA', required: false, completions: [] }),
      ],
      VISIT_AT,
    );
    expect(out.compliantAtTime).toBe(true);
    expect(out.records[1].coveredAtTime).toBe(false);
  });

  it('an uncovered REQUIRED course breaks compliance', () => {
    const out = evaluateTrainingAtTime([record({ completions: [] })], VISIT_AT);
    expect(out.compliantAtTime).toBe(false);
  });

  it('reports the latest score even when uncovered', () => {
    const out = evaluateTrainingAtTime(
      [record({ completions: [{ completedAt: '2026-06-02T10:00:00.000Z', score: 95 }] })],
      VISIT_AT,
    );
    expect(out.records[0].score).toBe(95);
  });

  it('handles no enrollments at all', () => {
    expect(evaluateTrainingAtTime([], VISIT_AT)).toEqual({ compliantAtTime: true, records: [] });
  });
});
