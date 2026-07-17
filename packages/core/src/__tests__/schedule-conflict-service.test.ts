import { describe, expect, it } from 'vitest';
import {
  checkScheduleConflicts,
  type ConflictAuthorization,
} from '../services/schedule-conflict-service.js';

const auth: ConflictAuthorization = {
  serviceCode: 'T1019',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  unitsAuthorized: 100,
  unitsRemaining: 40,
};

describe('checkScheduleConflicts', () => {
  it('passes cleanly for a covered, non-duplicate, in-units assignment', () => {
    const r = checkScheduleConflicts({
      proposed: { visitTemplateId: 'tpl-1', visitDate: '2026-06-15' },
      existingAssignments: [],
      authorizations: [auth],
    });
    expect(r.hardConflicts).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('hard-blocks a duplicate (same template + date)', () => {
    const r = checkScheduleConflicts({
      proposed: { visitTemplateId: 'tpl-1', visitDate: '2026-06-15' },
      existingAssignments: [{ visitTemplateId: 'tpl-1', visitDate: '2026-06-15' }],
      authorizations: [auth],
    });
    expect(r.hardConflicts).toHaveLength(1);
    expect(r.hardConflicts[0]).toContain('already assigned');
  });

  it('warns when no authorization covers the date', () => {
    const r = checkScheduleConflicts({
      proposed: { visitTemplateId: 'tpl-1', visitDate: '2026-07-15' },
      existingAssignments: [],
      authorizations: [auth],
    });
    expect(r.hardConflicts).toEqual([]);
    expect(r.warnings.some((w) => w.includes('No active authorization'))).toBe(true);
  });

  it('warns when covering authorization units are exhausted', () => {
    const r = checkScheduleConflicts({
      proposed: { visitTemplateId: 'tpl-1', visitDate: '2026-06-15' },
      existingAssignments: [],
      authorizations: [{ ...auth, unitsRemaining: 0 }],
    });
    expect(r.warnings.some((w) => w.includes('exhausted'))).toBe(true);
  });

  it('skips date-based checks when no visit date is set', () => {
    const r = checkScheduleConflicts({
      proposed: { visitTemplateId: 'tpl-1' },
      existingAssignments: [{ visitTemplateId: 'tpl-1', visitDate: '2026-06-15' }],
      authorizations: [],
    });
    expect(r.hardConflicts).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});

describe('checkScheduleConflicts , time overlap', () => {
  const window = (date: string, start: string, end: string) => ({
    scheduledStart: `${date}T${start}:00.000Z`,
    scheduledEnd: `${date}T${end}:00.000Z`,
  });

  it('hard-blocks a caregiver double-booked across two different visits', () => {
    // tpl-1 09:00-11:00 against an existing tpl-2 10:00-12:00. Different
    // templates, so the duplicate rule can never see it, but the caregiver
    // still cannot be in two places at 10:30.
    const r = checkScheduleConflicts({
      proposed: {
        visitTemplateId: 'tpl-1',
        visitDate: '2026-06-15',
        ...window('2026-06-15', '09:00', '11:00'),
      },
      existingAssignments: [
        { visitTemplateId: 'tpl-2', visitDate: '2026-06-15', ...window('2026-06-15', '10:00', '12:00') },
      ],
      authorizations: [auth],
    });
    expect(r.hardConflicts).toHaveLength(1);
    expect(r.hardConflicts[0]).toContain('overlaps');
  });

  it('allows back-to-back visits that touch but do not overlap', () => {
    // 09:00-11:00 then 11:00-13:00 is a legitimate consecutive booking.
    const r = checkScheduleConflicts({
      proposed: {
        visitTemplateId: 'tpl-1',
        visitDate: '2026-06-15',
        ...window('2026-06-15', '11:00', '13:00'),
      },
      existingAssignments: [
        { visitTemplateId: 'tpl-2', visitDate: '2026-06-15', ...window('2026-06-15', '09:00', '11:00') },
      ],
      authorizations: [auth],
    });
    expect(r.hardConflicts).toEqual([]);
  });

  it('allows the same times on a different day', () => {
    const r = checkScheduleConflicts({
      proposed: {
        visitTemplateId: 'tpl-1',
        visitDate: '2026-06-16',
        ...window('2026-06-16', '09:00', '11:00'),
      },
      existingAssignments: [
        { visitTemplateId: 'tpl-2', visitDate: '2026-06-15', ...window('2026-06-15', '09:00', '11:00') },
      ],
      authorizations: [auth],
    });
    expect(r.hardConflicts).toEqual([]);
  });

  it('flags a short visit fully enclosed by a longer one', () => {
    const r = checkScheduleConflicts({
      proposed: {
        visitTemplateId: 'tpl-1',
        visitDate: '2026-06-15',
        ...window('2026-06-15', '10:00', '10:30'),
      },
      existingAssignments: [
        { visitTemplateId: 'tpl-2', visitDate: '2026-06-15', ...window('2026-06-15', '09:00', '12:00') },
      ],
      authorizations: [auth],
    });
    expect(r.hardConflicts).toHaveLength(1);
  });

  it('ignores assignments with no scheduled window (manual, day-granular bookings)', () => {
    // createAssignment stores midnight with a NULL end. Such rows carry no
    // time-of-day information and must not be read as an all-day booking.
    const r = checkScheduleConflicts({
      proposed: {
        visitTemplateId: 'tpl-1',
        visitDate: '2026-06-15',
        ...window('2026-06-15', '09:00', '11:00'),
      },
      existingAssignments: [
        {
          visitTemplateId: 'tpl-2',
          visitDate: '2026-06-15',
          scheduledStart: '2026-06-15T00:00:00.000Z',
        },
      ],
      authorizations: [auth],
    });
    expect(r.hardConflicts).toEqual([]);
  });

  it('does not report one booking as both a duplicate and an overlap', () => {
    const r = checkScheduleConflicts({
      proposed: {
        visitTemplateId: 'tpl-1',
        visitDate: '2026-06-15',
        ...window('2026-06-15', '09:00', '11:00'),
      },
      existingAssignments: [
        { visitTemplateId: 'tpl-1', visitDate: '2026-06-15', ...window('2026-06-15', '09:00', '11:00') },
      ],
      authorizations: [auth],
    });
    expect(r.hardConflicts).toHaveLength(1);
    expect(r.hardConflicts[0]).toContain('already assigned');
  });

  it('reports every overlapping assignment, not just the first', () => {
    const r = checkScheduleConflicts({
      proposed: {
        visitTemplateId: 'tpl-1',
        visitDate: '2026-06-15',
        ...window('2026-06-15', '09:00', '13:00'),
      },
      existingAssignments: [
        { visitTemplateId: 'tpl-2', visitDate: '2026-06-15', ...window('2026-06-15', '09:30', '10:30') },
        { visitTemplateId: 'tpl-3', visitDate: '2026-06-15', ...window('2026-06-15', '11:30', '12:30') },
      ],
      authorizations: [auth],
    });
    expect(r.hardConflicts).toHaveLength(2);
  });

  it('ignores a malformed or inverted window rather than throwing', () => {
    const r = checkScheduleConflicts({
      proposed: {
        visitTemplateId: 'tpl-1',
        visitDate: '2026-06-15',
        ...window('2026-06-15', '09:00', '11:00'),
      },
      existingAssignments: [
        { visitTemplateId: 'tpl-2', visitDate: '2026-06-15', scheduledStart: 'not-a-date', scheduledEnd: 'nope' },
        {
          visitTemplateId: 'tpl-3',
          visitDate: '2026-06-15',
          scheduledStart: '2026-06-15T12:00:00.000Z',
          scheduledEnd: '2026-06-15T10:00:00.000Z',
        },
      ],
      authorizations: [auth],
    });
    expect(r.hardConflicts).toEqual([]);
  });
});
