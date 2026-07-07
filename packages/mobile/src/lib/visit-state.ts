/**
 * Pure derivation of a visit's lifecycle state from the open-visit fields the
 * /api/mobile/caregiver/today endpoint returns per assignment. No React Native
 * imports, so it is unit-testable and is the single source of truth for whether
 * the dashboard shows "Clock in", "In progress" (resume), or "Completed".
 *
 * Without this, the app dropped the server's open-visit info and always offered
 * "Clock in", so a caregiver who reopened the app mid-visit could double clock
 * in and had no way to clock OUT. Resuming requires knowing the open visit id.
 */

export type VisitState = 'not_started' | 'in_progress' | 'completed';

export interface VisitStateInput {
  /** evv_visit id for today's latest visit on this assignment, if any. */
  currentVisitId?: string | null;
  currentClockInTime?: string | null;
  currentClockOutTime?: string | null;
}

/**
 * completed   → today's visit has a clock-out time
 * in_progress → clocked in, not yet out (has an open visit id to resume)
 * not_started → no visit yet today
 */
export function deriveVisitState(v: VisitStateInput): VisitState {
  if (v.currentClockOutTime) return 'completed';
  if (v.currentVisitId && v.currentClockInTime) return 'in_progress';
  return 'not_started';
}

/** The open visit to resume on the clock screen, or null when none is open. */
export function resumableVisit(
  v: VisitStateInput,
): { id: string; clockInTime: string } | null {
  if (deriveVisitState(v) !== 'in_progress') return null;
  return { id: v.currentVisitId as string, clockInTime: v.currentClockInTime as string };
}
