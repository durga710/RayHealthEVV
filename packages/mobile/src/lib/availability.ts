/**
 * Pure helpers for the availability screen. No React Native imports, so it is
 * unit-testable.
 */

export interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export type TimeOffStatus = 'requested' | 'approved' | 'denied' | 'cancelled';

export interface TimeOffRequest {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: TimeOffStatus;
  reviewNote: string | null;
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The window offered when a caregiver first switches a day on. */
export const DEFAULT_START = '09:00';
export const DEFAULT_END = '17:00';

/**
 * The weekly grid the screen edits: one optional window per weekday.
 *
 * One window per day rather than many, deliberately. A split shift is real but
 * uncommon, and a repeating add/remove UI on a phone is fiddly enough that
 * most people would abandon it. The API and storage accept several windows per
 * day, so a richer editor can land later without a migration; a caregiver who
 * already has split windows keeps them until they edit that day.
 */
export type WeekGrid = Array<{ enabled: boolean; startTime: string; endTime: string }>;

export function emptyGrid(): WeekGrid {
  return Array.from({ length: 7 }, () => ({
    enabled: false,
    startTime: DEFAULT_START,
    endTime: DEFAULT_END,
  }));
}

/** Build the editable grid from stored slots, taking the first window per day. */
export function gridFromSlots(slots: AvailabilitySlot[]): WeekGrid {
  const grid = emptyGrid();
  for (const slot of slots) {
    if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) continue;
    if (grid[slot.dayOfWeek].enabled) continue;
    grid[slot.dayOfWeek] = {
      enabled: true,
      startTime: slot.startTime,
      endTime: slot.endTime,
    };
  }
  return grid;
}

/** Flatten the grid back into the slot list the API takes. */
export function slotsFromGrid(grid: WeekGrid): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  grid.forEach((day, dayOfWeek) => {
    if (!day.enabled) return;
    slots.push({ dayOfWeek, startTime: day.startTime, endTime: day.endTime });
  });
  return slots;
}

/**
 * Validate the grid before sending. Returns the first problem in weekday
 * order so the message points at one fixable thing rather than a list.
 */
export function validateGrid(grid: WeekGrid): string | null {
  for (let day = 0; day < grid.length; day += 1) {
    const entry = grid[day];
    if (!entry.enabled) continue;
    if (entry.endTime <= entry.startTime) {
      return `${DAY_LABELS[day]}: end time must be after start time.`;
    }
  }
  return null;
}

/** Human-readable date range, collapsing a single day to one date. */
export function formatDateRange(startDate: string, endDate: string): string {
  const fmt = (ymd: string) => {
    const d = new Date(`${ymd}T12:00:00.000Z`);
    return Number.isFinite(d.getTime())
      ? d.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' })
      : ymd;
  };
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} - ${fmt(endDate)}`;
}

/** Inclusive day count for a request, for the "3 days" summary line. */
export function dayCount(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}
