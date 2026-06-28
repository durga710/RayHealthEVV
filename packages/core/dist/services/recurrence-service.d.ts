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
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    startDate: string;
    endDate: string;
}
export interface Occurrence {
    date: string;
    startTime: string;
    endTime: string;
    startsAt: string;
    endsAt: string;
}
/**
 * Expand a weekly pattern into occurrences within [windowStart, windowEnd]
 * (inclusive), clamped to the pattern's own [startDate, endDate]. Dates are
 * compared as YYYY-MM-DD strings (lexicographic === chronological) and walked
 * in UTC so day-of-week is stable regardless of server timezone.
 */
export declare function expandRecurrence(pattern: RecurrencePattern, windowStart: string, windowEnd: string): Occurrence[];
//# sourceMappingURL=recurrence-service.d.ts.map