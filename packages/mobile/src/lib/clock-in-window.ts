/**
 * Client-side mirror of the server clock-in time-window rule, for UX only
 * (disabled button + countdown); the server remains authoritative.
 *
 * KEEP IN SYNC with packages/core/src/services/clock-in-window.ts:
 * window = [scheduled start − 5 min, scheduled end], end falling back to
 * start + 4h when unset; fail-open when there is no start or the start is a
 * date-only sentinel (midnight UTC with no end).
 */

export const EARLY_CLOCK_IN_GRACE_MINUTES = 5;
export const DEFAULT_VISIT_WINDOW_HOURS = 4;

export type ClockInWindowState =
  | { state: 'open' | 'unknown' }
  | { state: 'too-early' | 'expired'; opensAt: number; closesAt: number };

/**
 * @param nowMs device now, pre-adjusted with the server clock skew when known
 *   (`Date.now() + serverSkewMs`).
 */
export function getClockInWindowState(
  nowMs: number,
  scheduledStartIso: string | undefined,
  scheduledEndIso: string | undefined
): ClockInWindowState {
  if (!scheduledStartIso) return { state: 'unknown' };
  const start = Date.parse(scheduledStartIso);
  if (Number.isNaN(start)) return { state: 'unknown' };

  const end = scheduledEndIso ? Date.parse(scheduledEndIso) : NaN;
  const hasEnd = !Number.isNaN(end);

  // Date-only sentinel (admin-created assignments): no time gating.
  if (!hasEnd && start % 86_400_000 === 0) return { state: 'unknown' };

  const opensAt = start - EARLY_CLOCK_IN_GRACE_MINUTES * 60_000;
  const closesAt = hasEnd ? end : start + DEFAULT_VISIT_WINDOW_HOURS * 3_600_000;

  if (nowMs < opensAt) return { state: 'too-early', opensAt, closesAt };
  if (nowMs > closesAt) return { state: 'expired', opensAt, closesAt };
  return { state: 'open' };
}
