import { describe, it, expect, vi } from 'vitest';
import { ScheduleRepository } from '../repositories/schedule-repository.js';

// ---------------------------------------------------------------------------
// Knex mock helpers
// ---------------------------------------------------------------------------

/**
 * Makes a self-referential chainable object: every method returns `self`
 * except `select` on the *main* query which resolves with `rows`.
 *
 * Knex is heavily chained; this mock handles both the subquery chain
 * (db('evv_visits').select().whereRaw().as()) and the main query chain
 * (db('assignments').join()...leftJoin()...where()...select()).
 *
 * We track call count so the first `select` call (subquery) returns the
 * chain itself (for further chaining), and the second `select` (main query)
 * resolves with the fixture rows.
 */
function makeKnexMock(rows: Record<string, unknown>[]) {
  let selectCallCount = 0;

  const chain: Record<string, unknown> = {};
  const self = () => chain;

  chain['join']      = vi.fn(self);
  chain['leftJoin']  = vi.fn(self);
  chain['where']     = vi.fn(self);
  chain['whereRaw']  = vi.fn(self);
  chain['as']        = vi.fn(self);

  // First call to .select() is the subquery — return chain for further chaining.
  // Second call to .select() is the main query — resolve with fixture rows.
  chain['select'] = vi.fn((..._args: unknown[]) => {
    selectCallCount++;
    if (selectCallCount === 1) return chain; // subquery: keep chaining
    return Promise.resolve(rows);            // main query: resolve
  });

  const db = vi.fn(() => chain) as any;
  db.raw = vi.fn().mockReturnValue('(today_visits.assignment_id IS NOT NULL) as clocked_in_today');

  return db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScheduleRepository.getTodaySchedule', () => {
  it('maps DB rows to TodayScheduleItem shape', async () => {
    const db = makeKnexMock([
      {
        id: 'a-1',
        caregiver_id: 'cg-1',
        visit_template_id: 'vt-1',
        first_name: 'John',
        last_name: 'Doe',
        clocked_in_today: false,
      },
    ]);

    const repo = new ScheduleRepository(db as any);
    const result = await repo.getTodaySchedule('cg-1', '2026-05-24');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'a-1',
      caregiverId: 'cg-1',
      visitTemplateId: 'vt-1',
      clientName: 'John Doe',
      scheduledTime: null,   // always null until schema migration
      clockedInToday: false,
    });
  });

  it('marks clockedInToday true when truthy DB value returned', async () => {
    const db = makeKnexMock([
      {
        id: 'a-2',
        caregiver_id: 'cg-1',
        visit_template_id: 'vt-2',
        first_name: 'Jane',
        last_name: 'Smith',
        clocked_in_today: true,
      },
    ]);

    const repo = new ScheduleRepository(db as any);
    const result = await repo.getTodaySchedule('cg-1', '2026-05-24');

    expect(result[0]?.clockedInToday).toBe(true);
  });

  it('returns empty array when no assignments found', async () => {
    const db = makeKnexMock([]);
    const repo = new ScheduleRepository(db as any);
    const result = await repo.getTodaySchedule('cg-no-assignments', '2026-05-24');
    expect(result).toEqual([]);
  });
});
