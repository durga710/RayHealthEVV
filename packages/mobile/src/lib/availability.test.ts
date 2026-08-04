import { describe, expect, it } from 'vitest';
import {
  dayCount,
  emptyGrid,
  formatDateRange,
  gridFromSlots,
  slotsFromGrid,
  validateGrid,
} from './availability';

describe('gridFromSlots / slotsFromGrid', () => {
  it('round-trips a simple weekday pattern', () => {
    const slots = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '08:00', endTime: '12:00' },
    ];
    expect(slotsFromGrid(gridFromSlots(slots))).toEqual(slots);
  });

  it('starts from an all-off week', () => {
    const grid = emptyGrid();
    expect(grid).toHaveLength(7);
    expect(grid.every((d) => !d.enabled)).toBe(true);
    expect(slotsFromGrid(grid)).toEqual([]);
  });

  it('keeps the first window when a day has several stored', () => {
    // The phone editor holds one window per day; the extra is preserved in
    // storage until the caregiver edits that day.
    const grid = gridFromSlots([
      { dayOfWeek: 2, startTime: '06:00', endTime: '10:00' },
      { dayOfWeek: 2, startTime: '16:00', endTime: '20:00' },
    ]);
    expect(grid[2]).toEqual({ enabled: true, startTime: '06:00', endTime: '10:00' });
  });

  it('ignores an out-of-range weekday rather than crashing', () => {
    const grid = gridFromSlots([
      { dayOfWeek: 9, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: -1, startTime: '09:00', endTime: '17:00' },
    ]);
    expect(grid.every((d) => !d.enabled)).toBe(true);
  });

  it('emits slots in weekday order', () => {
    const grid = emptyGrid();
    grid[5] = { enabled: true, startTime: '09:00', endTime: '17:00' };
    grid[1] = { enabled: true, startTime: '09:00', endTime: '17:00' };
    expect(slotsFromGrid(grid).map((s) => s.dayOfWeek)).toEqual([1, 5]);
  });
});

describe('validateGrid', () => {
  it('passes a sane week', () => {
    const grid = emptyGrid();
    grid[2] = { enabled: true, startTime: '09:00', endTime: '17:00' };
    expect(validateGrid(grid)).toBeNull();
  });

  it('names the day with the problem', () => {
    const grid = emptyGrid();
    grid[4] = { enabled: true, startTime: '17:00', endTime: '09:00' };
    expect(validateGrid(grid)).toContain('Thu');
  });

  it('rejects a zero-length window', () => {
    const grid = emptyGrid();
    grid[0] = { enabled: true, startTime: '09:00', endTime: '09:00' };
    expect(validateGrid(grid)).not.toBeNull();
  });

  it('ignores a disabled day with nonsense times', () => {
    const grid = emptyGrid();
    grid[3] = { enabled: false, startTime: '20:00', endTime: '08:00' };
    expect(validateGrid(grid)).toBeNull();
  });
});

describe('formatDateRange', () => {
  it('collapses a single day', () => {
    expect(formatDateRange('2026-09-01', '2026-09-01')).toBe('Sep 1');
  });

  it('shows both ends of a range', () => {
    expect(formatDateRange('2026-09-01', '2026-09-04')).toBe('Sep 1 - Sep 4');
  });
});

describe('dayCount', () => {
  it('counts inclusively', () => {
    expect(dayCount('2026-09-01', '2026-09-01')).toBe(1);
    expect(dayCount('2026-09-01', '2026-09-03')).toBe(3);
  });

  it('spans a month boundary', () => {
    expect(dayCount('2026-08-30', '2026-09-02')).toBe(4);
  });

  it('is zero for an inverted or unparseable range', () => {
    expect(dayCount('2026-09-05', '2026-09-01')).toBe(0);
    expect(dayCount('nonsense', '2026-09-01')).toBe(0);
  });
});
