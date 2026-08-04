import { describe, expect, it } from 'vitest';
import { formatCents, formatHours, periodRange } from './earnings';

// 2026-08-05 is a Wednesday. Its Sunday-start week began 2026-08-02.
const WEDNESDAY = new Date('2026-08-05T14:30:00.000Z');

describe('periodRange', () => {
  it('runs this week from Sunday to today, not to the end of the week', () => {
    // Padding with future dates would only invite "why is Friday missing".
    expect(periodRange('thisWeek', WEDNESDAY)).toEqual({ from: '2026-08-02', to: '2026-08-05' });
  });

  it('covers the whole of last week', () => {
    expect(periodRange('lastWeek', WEDNESDAY)).toEqual({ from: '2026-07-26', to: '2026-08-01' });
  });

  it('runs this month from the first to today', () => {
    expect(periodRange('thisMonth', WEDNESDAY)).toEqual({ from: '2026-08-01', to: '2026-08-05' });
  });

  it('handles a Sunday, where this week is a single day', () => {
    const sunday = new Date('2026-08-02T09:00:00.000Z');
    expect(periodRange('thisWeek', sunday)).toEqual({ from: '2026-08-02', to: '2026-08-02' });
  });

  it('crosses a month boundary for last week without breaking', () => {
    const firstOfMonth = new Date('2026-09-01T09:00:00.000Z');
    expect(periodRange('lastWeek', firstOfMonth)).toEqual({ from: '2026-08-23', to: '2026-08-29' });
  });

  it('crosses a year boundary for last week without breaking', () => {
    const newYear = new Date('2027-01-01T09:00:00.000Z');
    expect(periodRange('lastWeek', newYear)).toEqual({ from: '2026-12-20', to: '2026-12-26' });
  });

  it('never returns a range that ends before it starts', () => {
    for (const key of ['thisWeek', 'lastWeek', 'thisMonth'] as const) {
      const r = periodRange(key, WEDNESDAY);
      expect(r.from <= r.to).toBe(true);
    }
  });
});

describe('formatCents', () => {
  it('formats whole and fractional dollars', () => {
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(1800)).toBe('$18.00');
    expect(formatCents(123456)).toBe('$1,234.56');
  });

  it('groups thousands in a large amount', () => {
    expect(formatCents(123456789)).toBe('$1,234,567.89');
  });

  it('keeps a negative amount readable', () => {
    expect(formatCents(-2550)).toBe('-$25.50');
  });
});

describe('formatHours', () => {
  it('drops the minutes on whole hours', () => {
    expect(formatHours(60)).toBe('1h');
    expect(formatHours(480)).toBe('8h');
  });

  it('shows hours and minutes together', () => {
    expect(formatHours(450)).toBe('7h 30m');
  });

  it('shows minutes alone under an hour', () => {
    expect(formatHours(0)).toBe('0m');
    expect(formatHours(45)).toBe('45m');
  });

  it('does not render a negative duration', () => {
    expect(formatHours(-30)).toBe('0m');
  });
});
