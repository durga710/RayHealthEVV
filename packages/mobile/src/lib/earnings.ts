/**
 * Pure helpers for the earnings screen: period math and display formatting.
 * No React Native imports, so it is unit-testable.
 *
 * Period boundaries are computed in UTC to match the server, which groups
 * workweeks in UTC for determinism. A caregiver near a day boundary could
 * otherwise see a visit fall outside the period the app asked for while the
 * server counted it inside.
 */

export type PeriodKey = 'thisWeek' | 'lastWeek' | 'thisMonth';

export const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'thisWeek', label: 'This week' },
  { key: 'lastWeek', label: 'Last week' },
  { key: 'thisMonth', label: 'This month' },
];

export interface DateRange {
  /** YYYY-MM-DD, inclusive. */
  from: string;
  /** YYYY-MM-DD, inclusive. */
  to: string;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Sunday of the week containing `date`, matching the server's default. */
function weekStart(date: Date): Date {
  const start = addDays(date, -date.getUTCDay());
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/**
 * Inclusive date range for a named period.
 *
 * Ranges end today rather than at the end of the calendar period: a caregiver
 * asking what they have earned this week means so far, and padding the range
 * with future dates would only invite "why is Friday missing".
 */
export function periodRange(period: PeriodKey, now: Date): DateRange {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  if (period === 'lastWeek') {
    const start = addDays(weekStart(today), -7);
    return { from: ymd(start), to: ymd(addDays(start, 6)) };
  }
  if (period === 'thisMonth') {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { from: ymd(start), to: ymd(today) };
  }
  return { from: ymd(weekStart(today)), to: ymd(today) };
}

/** Cents to a US dollar string, e.g. 123456 becomes "$1,234.56". */
export function formatCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = String(abs % 100).padStart(2, '0');
  const grouped = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}$${grouped}.${remainder}`;
}

/**
 * Minutes as compact hours, e.g. "7h 30m". Whole hours drop the minutes so
 * the common case reads cleanly.
 */
export function formatHours(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
