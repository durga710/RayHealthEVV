/**
 * Pure schedule-conflict checker run when an assignment is created.
 *
 * Detects:
 *  - HARD: a duplicate assignment (same caregiver already on this visit
 *    template for the same date), blocked.
 *  - HARD: a true time overlap , the caregiver already has a *different*
 *    assignment whose scheduled window intersects this one. Blocked.
 *  - SOFT (warnings, non-blocking): the visit date has no covering client
 *    authorization, or the covering authorization has no units left.
 *
 * On scheduled windows: only assignments carrying BOTH a real start and end
 * participate in overlap detection. The two creation paths populate those
 * columns differently and conflating them would be a bug:
 *  - recurring materialization writes genuine windows (09:00-11:00),
 *  - manual `createAssignment` writes midnight with a NULL end, encoding a
 *    date and no time-of-day , reading that as a 00:00 booking (or worse, an
 *    all-day one) would false-positive every same-day assignment.
 * A window-less assignment therefore falls back to the duplicate rule alone.
 *
 * Credential gating stays out of scope here (see
 * CredentialComplianceService.gateForBooking, applied in the routes' shared
 * assignment checks).
 */

interface ScheduledWindow {
  scheduledStart?: string;
  scheduledEnd?: string;
}

/** Epoch-ms window, or null when the assignment carries no usable time-of-day. */
function toWindow(a: ScheduledWindow): { start: number; end: number } | null {
  if (!a.scheduledStart || !a.scheduledEnd) return null;
  const start = Date.parse(a.scheduledStart);
  const end = Date.parse(a.scheduledEnd);
  // Unparseable or inverted/zero-length: treat as "no window" rather than
  // throwing , one bad row must not break the whole booking gate.
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return { start, end };
}

/** Half-open intersection, so back-to-back visits (11:00 end, 11:00 start) don't collide. */
function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

/** "2026-06-15 10:00-12:00 UTC" , stable regardless of server timezone. */
function describeWindow(w: { start: number; end: number }): string {
  const from = new Date(w.start).toISOString();
  const to = new Date(w.end).toISOString();
  return `${from.slice(0, 10)} ${from.slice(11, 16)}-${to.slice(11, 16)} UTC`;
}

export interface ConflictAuthorization {
  serviceCode: string;
  /** YYYY-MM-DD inclusive window. */
  startDate: string;
  endDate: string;
  unitsAuthorized: number;
  /** Units left after billed claims, when computable. */
  unitsRemaining?: number;
}

export interface ConflictExistingAssignment {
  visitTemplateId: string;
  /** YYYY-MM-DD, when scheduled. */
  visitDate?: string;
  /** ISO-8601 start, when the assignment carries a real scheduled window. */
  scheduledStart?: string;
  /** ISO-8601 end. Absent on manual, day-granular bookings. */
  scheduledEnd?: string;
}

export interface ScheduleConflictInput {
  proposed: {
    visitTemplateId: string;
    visitDate?: string;
    serviceCode?: string;
    /** ISO-8601 start, when the proposed assignment has a real window. */
    scheduledStart?: string;
    /** ISO-8601 end. Overlap detection needs both bounds. */
    scheduledEnd?: string;
  };
  existingAssignments: readonly ConflictExistingAssignment[];
  authorizations: readonly ConflictAuthorization[];
}

export interface ScheduleConflictResult {
  hardConflicts: string[];
  warnings: string[];
}

export function checkScheduleConflicts(input: ScheduleConflictInput): ScheduleConflictResult {
  const hardConflicts: string[] = [];
  const warnings: string[] = [];
  const { proposed, existingAssignments, authorizations } = input;

  // HARD: duplicate assignment (same template + same date).
  const isDuplicateOf = (a: ConflictExistingAssignment): boolean =>
    a.visitTemplateId === proposed.visitTemplateId && a.visitDate === proposed.visitDate;

  if (proposed.visitDate) {
    const dup = existingAssignments.some(isDuplicateOf);
    if (dup) {
      hardConflicts.push(
        `Caregiver is already assigned to this visit on ${proposed.visitDate}.`,
      );
    }
  }

  // HARD: true time overlap against the caregiver's other assignments. This is
  // the case the duplicate rule structurally cannot see , two *different*
  // visit templates (different clients) booked at intersecting times.
  const proposedWindow = toWindow(proposed);
  if (proposedWindow) {
    for (const existing of existingAssignments) {
      // Already reported above; don't surface one booking as two conflicts.
      if (proposed.visitDate && isDuplicateOf(existing)) continue;
      const existingWindow = toWindow(existing);
      if (!existingWindow) continue;
      if (overlaps(proposedWindow, existingWindow)) {
        hardConflicts.push(
          `Caregiver is already booked ${describeWindow(existingWindow)}, which overlaps this visit.`,
        );
      }
    }
  }

  // SOFT: authorization coverage + remaining units (only when a date is set).
  if (proposed.visitDate) {
    const covering = authorizations.filter(
      (a) =>
        proposed.visitDate! >= a.startDate &&
        proposed.visitDate! <= a.endDate &&
        (!proposed.serviceCode || a.serviceCode === proposed.serviceCode),
    );
    if (covering.length === 0) {
      warnings.push(`No active authorization covers ${proposed.visitDate}.`);
    } else {
      const withRemaining = covering.filter((a) => a.unitsRemaining !== undefined);
      if (withRemaining.length > 0 && withRemaining.every((a) => (a.unitsRemaining ?? 0) <= 0)) {
        const left = Math.max(0, ...withRemaining.map((a) => a.unitsRemaining ?? 0));
        warnings.push(`Authorization units exhausted (${left} left).`);
      }
    }
  }

  return { hardConflicts, warnings };
}
