import {
  DEFAULT_VISIT_WINDOW_HOURS,
  PA_EARLY_CLOCK_IN_GRACE_MINUTES
} from '../config/pennsylvania.js';

export interface ClockInWindowViolation {
  reason: 'too-early' | 'window-closed';
  /** When clock-in opens (scheduled start minus the early grace). */
  opensAt: string;
  /** When clock-in closes (scheduled end, or start + default window). */
  closesAt: string;
}

/**
 * Pure clock-in time-window check. Returns null when the punch is allowed,
 * or a violation describing why not.
 *
 * The punch time is the RESOLVED punch moment (an offline store-and-forward
 * punch carries its original capture time), so a punch captured in-window and
 * synced hours later still passes, and one captured out-of-window is refused
 * at replay.
 *
 * Fail-open cases (allowed without a check), mirroring the geofence check's
 * philosophy for clients without coordinates:
 *  - no scheduled start at all (legacy/imported assignments)
 *  - a date-only start (exactly midnight UTC) with no end: the admin web flow
 *    stores these; any wall-clock rule would misfire across timezones, so a
 *    date-only assignment stays clockable all day. (A same-calendar-day rule
 *    was rejected: an evening US punch crosses the UTC date boundary.)
 *
 * Lateness INSIDE the window is deliberately never blocked here; the
 * late-clock-in exception filed at clock-out is the compliance mechanism for
 * that, and blocking would strand genuinely late caregivers.
 */
export function checkClockInWindow(
  punchTimeIso: string,
  scheduledStartIso: string | null | undefined,
  scheduledEndIso: string | null | undefined
): ClockInWindowViolation | null {
  if (!scheduledStartIso) return null;
  const start = Date.parse(scheduledStartIso);
  if (Number.isNaN(start)) return null;

  const end = scheduledEndIso ? Date.parse(scheduledEndIso) : NaN;
  const hasEnd = !Number.isNaN(end);

  // Date-only sentinel: midnight-UTC start with no end.
  if (!hasEnd && start % 86_400_000 === 0) return null;

  const punch = Date.parse(punchTimeIso);
  if (Number.isNaN(punch)) return null;

  const opensAt = start - PA_EARLY_CLOCK_IN_GRACE_MINUTES * 60_000;
  const closesAt = hasEnd ? end : start + DEFAULT_VISIT_WINDOW_HOURS * 3_600_000;

  if (punch < opensAt) {
    return {
      reason: 'too-early',
      opensAt: new Date(opensAt).toISOString(),
      closesAt: new Date(closesAt).toISOString()
    };
  }
  if (punch > closesAt) {
    return {
      reason: 'window-closed',
      opensAt: new Date(opensAt).toISOString(),
      closesAt: new Date(closesAt).toISOString()
    };
  }
  return null;
}
