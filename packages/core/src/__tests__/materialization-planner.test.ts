import { describe, expect, it } from 'vitest';
import { planMaterialization } from '../services/materialization-planner.js';

const occ = (date: string, start: string, end: string) => ({
  date,
  startsAt: `${date}T${start}:00.000Z`,
  endsAt: `${date}T${end}:00.000Z`,
});

const booking = (templateId: string, date: string, start: string, end: string) => ({
  visitTemplateId: templateId,
  visitDate: date,
  scheduledStart: `${date}T${start}:00.000Z`,
  scheduledEnd: `${date}T${end}:00.000Z`,
});

describe('planMaterialization', () => {
  it('inserts every occurrence when the caregiver has nothing booked', () => {
    const plan = planMaterialization({
      visitTemplateId: 'tpl-1',
      occurrences: [occ('2026-06-15', '09:00', '11:00'), occ('2026-06-17', '09:00', '11:00')],
      booked: [],
    });
    expect(plan.insert).toHaveLength(2);
    expect(plan.skipped).toBe(0);
    expect(plan.conflicts).toEqual([]);
  });

  it('skips a date already materialized for the same template (idempotent re-run)', () => {
    const plan = planMaterialization({
      visitTemplateId: 'tpl-1',
      occurrences: [occ('2026-06-15', '09:00', '11:00'), occ('2026-06-17', '09:00', '11:00')],
      booked: [booking('tpl-1', '2026-06-15', '09:00', '11:00')],
    });
    expect(plan.skipped).toBe(1);
    expect(plan.insert.map((o) => o.date)).toEqual(['2026-06-17']);
    // A same-template repeat is a skip, never a conflict.
    expect(plan.conflicts).toEqual([]);
  });

  it('refuses an occurrence that would double-book across a different client', () => {
    // The bug this planner exists for: tpl-2 is a different client, so date
    // dedup structurally cannot see it, but 10:00-12:00 overlaps 09:00-11:00.
    const plan = planMaterialization({
      visitTemplateId: 'tpl-1',
      occurrences: [occ('2026-06-15', '09:00', '11:00')],
      booked: [booking('tpl-2', '2026-06-15', '10:00', '12:00')],
    });
    expect(plan.insert).toEqual([]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toContain('2026-06-15');
    expect(plan.conflicts[0]).toContain('overlaps');
  });

  it('still materializes the non-conflicting dates around a conflict', () => {
    const plan = planMaterialization({
      visitTemplateId: 'tpl-1',
      occurrences: [
        occ('2026-06-15', '09:00', '11:00'),
        occ('2026-06-16', '09:00', '11:00'),
        occ('2026-06-17', '09:00', '11:00'),
      ],
      booked: [booking('tpl-2', '2026-06-16', '10:00', '12:00')],
    });
    expect(plan.insert.map((o) => o.date)).toEqual(['2026-06-15', '2026-06-17']);
    expect(plan.conflicts).toHaveLength(1);
  });

  it('allows a back-to-back booking against another client', () => {
    const plan = planMaterialization({
      visitTemplateId: 'tpl-1',
      occurrences: [occ('2026-06-15', '11:00', '13:00')],
      booked: [booking('tpl-2', '2026-06-15', '09:00', '11:00')],
    });
    expect(plan.insert).toHaveLength(1);
    expect(plan.conflicts).toEqual([]);
  });

  it('takes the first occurrence on a date and skips a repeat of that date', () => {
    // expandRecurrence yields at most one occurrence per date, so this is
    // defensive: a repeated date is dedup'd (skipped), never a conflict.
    const plan = planMaterialization({
      visitTemplateId: 'tpl-1',
      occurrences: [occ('2026-06-15', '09:00', '11:00'), occ('2026-06-15', '10:00', '12:00')],
      booked: [],
    });
    expect(plan.insert).toHaveLength(1);
    expect(plan.insert[0].startsAt).toContain('09:00');
    expect(plan.skipped).toBe(1);
    expect(plan.conflicts).toEqual([]);
  });

  it('ignores a manual day-granular booking with no end time', () => {
    // createAssignment writes midnight + NULL end. That carries no
    // time-of-day, so it must not block a real 09:00-11:00 occurrence.
    const plan = planMaterialization({
      visitTemplateId: 'tpl-1',
      occurrences: [occ('2026-06-15', '09:00', '11:00')],
      booked: [
        {
          visitTemplateId: 'tpl-2',
          visitDate: '2026-06-15',
          scheduledStart: '2026-06-15T00:00:00.000Z',
        },
      ],
    });
    expect(plan.insert).toHaveLength(1);
    expect(plan.conflicts).toEqual([]);
  });

  it('returns an empty plan for no occurrences', () => {
    const plan = planMaterialization({ visitTemplateId: 'tpl-1', occurrences: [], booked: [] });
    expect(plan).toEqual({ insert: [], skipped: 0, conflicts: [] });
  });
});
