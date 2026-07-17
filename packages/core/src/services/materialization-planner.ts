/**
 * Pure planner for recurring-schedule materialization: decides which
 * occurrences become assignments, which are already there, and which would
 * double-book the caregiver. Split out of RecurringScheduleRepository so the
 * decision is testable without a database , the repository keeps the I/O
 * (query the caregiver's bookings, insert the survivors) and this keeps the
 * rules, mirroring how `expandRecurrence` and `checkScheduleConflicts` already
 * sit pure alongside their callers.
 */
import {
  checkScheduleConflicts,
  type ConflictExistingAssignment,
} from './schedule-conflict-service.js';

/** An expanded occurrence. Structurally compatible with `Occurrence`. */
export interface MaterializationCandidate {
  /** YYYY-MM-DD. */
  date: string;
  /** ISO-8601 start of the occurrence. */
  startsAt: string;
  /** ISO-8601 end of the occurrence. */
  endsAt: string;
}

export interface MaterializationPlan {
  /** Occurrences to insert, in input order. */
  insert: MaterializationCandidate[];
  /** Already assigned for this caregiver + template on that date. */
  skipped: number;
  /** One reason per refused occurrence. */
  conflicts: string[];
}

export interface MaterializationPlanInput {
  /** The template this schedule materializes into. */
  visitTemplateId: string;
  occurrences: readonly MaterializationCandidate[];
  /**
   * The caregiver's existing assignments across EVERY template in the window.
   * Same-template rows drive date dedup; the others are what make cross-client
   * double-booking visible.
   */
  booked: readonly ConflictExistingAssignment[];
}

export function planMaterialization(input: MaterializationPlanInput): MaterializationPlan {
  const { visitTemplateId, occurrences, booked } = input;

  // Seeded from this template's existing dates, then grown as we plan, so a
  // re-run and a repeated date are both counted as skips, not conflicts.
  const takenDates = new Set(
    booked.filter((b) => b.visitTemplateId === visitTemplateId).map((b) => b.visitDate),
  );

  const insert: MaterializationCandidate[] = [];
  const conflicts: string[] = [];
  let skipped = 0;

  for (const o of occurrences) {
    if (takenDates.has(o.date)) {
      skipped += 1;
      continue;
    }

    // Only `booked` is compared against, never the occurrences planned in this
    // same loop: one schedule yields at most one occurrence per date (see
    // expandRecurrence) and each window is bounded inside its own day, so two
    // occurrences from one run can never overlap each other. A same-date repeat
    // is caught by the dedup above, before it ever reaches this check.
    //
    // Authorization coverage is the assignment route's concern; here we only
    // want the hard double-booking verdict, so pass none and read hardConflicts.
    const { hardConflicts } = checkScheduleConflicts({
      proposed: {
        visitTemplateId,
        visitDate: o.date,
        scheduledStart: o.startsAt,
        scheduledEnd: o.endsAt,
      },
      existingAssignments: booked,
      authorizations: [],
    });

    if (hardConflicts.length > 0) {
      conflicts.push(`${o.date}: ${hardConflicts[0]}`);
      continue;
    }

    insert.push(o);
    takenDates.add(o.date);
  }

  return { insert, skipped, conflicts };
}
