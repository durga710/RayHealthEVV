/**
 * Availability matching (pure).
 *
 * Answers one question for the scheduler: does a proposed booking fall inside
 * the hours this caregiver said they normally work?
 *
 * The answer is advisory. Availability is a PREFERENCE, not a contract: real
 * agencies cover shifts outside someone's usual window constantly, and a hard
 * block would simply be worked around by editing the availability. Approved
 * time off is the thing that hard-blocks, and it lives in its own table with
 * its own approval trail.
 *
 * Pure + deterministic: no DB/IO; the caller fetches slots and hands them in.
 */

export interface AvailabilityWindow {
  /** 0 = Sunday .. 6 = Saturday, matching JavaScript's getDay(). */
  dayOfWeek: number
  /** HH:MM, 24-hour. */
  startTime: string
  endTime: string
}

export interface AvailabilityCheckInput {
  /** YYYY-MM-DD. */
  visitDate: string
  /** HH:MM pair. Omitted when the assignment has no time window yet. */
  startTime?: string
  endTime?: string
  slots: AvailabilityWindow[]
}

export type AvailabilityVerdict =
  /** No pattern on file; nothing to check against. */
  | { kind: 'unknown' }
  /** The booking sits inside a declared window. */
  | { kind: 'inside' }
  /** The caregiver declared no hours at all on that weekday. */
  | { kind: 'day_unavailable'; message: string }
  /** The day is worked, but not at this time. */
  | { kind: 'outside_hours'; message: string }

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Minutes since midnight for an HH:MM string, or null when unparseable. */
export function minutesOfDay(hhmm: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/**
 * Weekday index for a YYYY-MM-DD date.
 *
 * Parsed as UTC noon rather than midnight. A bare date string is treated as
 * UTC midnight, which in a negative-offset timezone renders as the previous
 * evening and would report the wrong weekday. Noon has no such edge.
 */
export function weekdayOf(visitDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) return null
  const date = new Date(`${visitDate}T12:00:00.000Z`)
  return Number.isFinite(date.getTime()) ? date.getUTCDay() : null
}

/**
 * Check a proposed booking against declared availability.
 *
 * With no time window supplied, only the weekday is checked: an all-day
 * assignment on a day the caregiver never works is still worth flagging, but
 * we cannot say anything about hours we were not given.
 */
export function checkAvailability(input: AvailabilityCheckInput): AvailabilityVerdict {
  if (input.slots.length === 0) return { kind: 'unknown' }

  const weekday = weekdayOf(input.visitDate)
  if (weekday == null) return { kind: 'unknown' }

  const daySlots = input.slots.filter((s) => s.dayOfWeek === weekday)
  const dayName = DAY_NAMES[weekday] ?? 'that day'
  if (daySlots.length === 0) {
    return {
      kind: 'day_unavailable',
      message: `Caregiver has not marked themselves available on ${dayName}.`,
    }
  }

  // No proposed window: the weekday is worked, which is all we can assert.
  if (!input.startTime || !input.endTime) return { kind: 'inside' }

  const start = minutesOfDay(input.startTime)
  const end = minutesOfDay(input.endTime)
  if (start == null || end == null) return { kind: 'unknown' }

  const covered = daySlots.some((slot) => {
    const slotStart = minutesOfDay(slot.startTime)
    const slotEnd = minutesOfDay(slot.endTime)
    if (slotStart == null || slotEnd == null) return false
    return start >= slotStart && end <= slotEnd
  })
  if (covered) return { kind: 'inside' }

  const windows = daySlots.map((s) => `${s.startTime}, ${s.endTime}`).join(', ')
  return {
    kind: 'outside_hours',
    message: `Booking is outside the caregiver's stated ${dayName} availability (${windows}).`,
  }
}
