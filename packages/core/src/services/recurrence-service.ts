/**
 * Recurrence expansion — the pure core of the recurring-schedule engine.
 *
 * Given a weekly pattern (days-of-week + a start/end time over a date range)
 * and a materialization window, produce the concrete occurrences that fall in
 * the window. No DB, no clock: the caller passes the window dates explicitly,
 * so the function is deterministic and unit-testable. The repository layer
 * turns each occurrence into an `assignments` row.
 */

export interface RecurrencePattern {
  daysOfWeek: number[]; // 0 = Sunday … 6 = Saturday
  startTime: string; // 'HH:MM'
  endTime: string; // 'HH:MM'
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
}

export interface Occurrence {
  date: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:MM'
  endTime: string; // 'HH:MM'
  startsAt: string; // ISO-8601 UTC
  endsAt: string; // ISO-8601 UTC
}

const DAY_MS = 86_400_000;
// Safety bound so a malformed window can never spin forever.
const MAX_DAYS = 800;

const maxDate = (a: string, b: string): string => (a >= b ? a : b);
const minDate = (a: string, b: string): string => (a <= b ? a : b);

/**
 * Expand a weekly pattern into occurrences within [windowStart, windowEnd]
 * (inclusive), clamped to the pattern's own [startDate, endDate]. Dates are
 * compared as YYYY-MM-DD strings (lexicographic === chronological) and walked
 * in UTC so day-of-week is stable regardless of server timezone.
 */
export function expandRecurrence(
  pattern: RecurrencePattern,
  windowStart: string,
  windowEnd: string,
): Occurrence[] {
  const from = maxDate(pattern.startDate, windowStart);
  const to = minDate(pattern.endDate, windowEnd);
  if (from > to) return [];

  const days = new Set(pattern.daysOfWeek);
  const occurrences: Occurrence[] = [];

  let cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  let guard = 0;

  while (cursor.getTime() <= end.getTime() && guard < MAX_DAYS) {
    guard += 1;
    if (days.has(cursor.getUTCDay())) {
      const date = cursor.toISOString().slice(0, 10);
      occurrences.push({
        date,
        startTime: pattern.startTime,
        endTime: pattern.endTime,
        startsAt: `${date}T${pattern.startTime}:00.000Z`,
        endsAt: `${date}T${pattern.endTime}:00.000Z`,
      });
    }
    cursor = new Date(cursor.getTime() + DAY_MS);
  }

  return occurrences;
}
