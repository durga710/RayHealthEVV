import { describe, expect, it } from 'vitest'
import { checkAvailability, minutesOfDay, weekdayOf } from '../availability-service.js'

// 2026-08-04 is a Tuesday (weekday 2).
const TUESDAY = '2026-08-04'
const SATURDAY = '2026-08-08'

const weekdaySlots = [
  { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
]

describe('minutesOfDay', () => {
  it('converts HH:MM to minutes since midnight', () => {
    expect(minutesOfDay('00:00')).toBe(0)
    expect(minutesOfDay('09:30')).toBe(570)
    expect(minutesOfDay('23:59')).toBe(1439)
  })

  it('rejects malformed or impossible times', () => {
    expect(minutesOfDay('9:00')).toBeNull()
    expect(minutesOfDay('24:00')).toBeNull()
    expect(minutesOfDay('12:60')).toBeNull()
    expect(minutesOfDay('noon')).toBeNull()
  })
})

describe('weekdayOf', () => {
  it('reads the weekday from a date string', () => {
    expect(weekdayOf(TUESDAY)).toBe(2)
    expect(weekdayOf(SATURDAY)).toBe(6)
    expect(weekdayOf('2026-08-02')).toBe(0) // Sunday
  })

  it('is not thrown off by timezone interpretation of a bare date', () => {
    // Parsed at UTC noon: midnight would render as the previous evening in a
    // negative-offset zone and report the wrong day.
    expect(weekdayOf('2026-08-03')).toBe(1)
  })

  it('rejects a malformed date', () => {
    expect(weekdayOf('08/04/2026')).toBeNull()
    expect(weekdayOf('')).toBeNull()
  })
})

describe('checkAvailability', () => {
  it('says nothing when the caregiver has declared no pattern', () => {
    // No pattern is not the same as unavailable.
    expect(checkAvailability({ visitDate: TUESDAY, slots: [] })).toEqual({ kind: 'unknown' })
  })

  it('accepts a booking inside a declared window', () => {
    const verdict = checkAvailability({
      visitDate: TUESDAY,
      startTime: '10:00',
      endTime: '14:00',
      slots: weekdaySlots,
    })
    expect(verdict.kind).toBe('inside')
  })

  it('accepts a booking exactly filling the window', () => {
    const verdict = checkAvailability({
      visitDate: TUESDAY,
      startTime: '09:00',
      endTime: '17:00',
      slots: weekdaySlots,
    })
    expect(verdict.kind).toBe('inside')
  })

  it('flags a day the caregiver never marked available', () => {
    const verdict = checkAvailability({
      visitDate: SATURDAY,
      startTime: '10:00',
      endTime: '14:00',
      slots: weekdaySlots,
    })
    expect(verdict.kind).toBe('day_unavailable')
    if (verdict.kind === 'day_unavailable') expect(verdict.message).toContain('Saturday')
  })

  it('flags a booking that runs past the declared window', () => {
    const verdict = checkAvailability({
      visitDate: TUESDAY,
      startTime: '16:00',
      endTime: '19:00',
      slots: weekdaySlots,
    })
    expect(verdict.kind).toBe('outside_hours')
    if (verdict.kind === 'outside_hours') expect(verdict.message).toContain('Tuesday')
  })

  it('flags a booking that starts before the declared window', () => {
    const verdict = checkAvailability({
      visitDate: TUESDAY,
      startTime: '07:00',
      endTime: '10:00',
      slots: weekdaySlots,
    })
    expect(verdict.kind).toBe('outside_hours')
  })

  it('accepts a booking covered by one of several windows that day', () => {
    const split = [
      { dayOfWeek: 2, startTime: '06:00', endTime: '10:00' },
      { dayOfWeek: 2, startTime: '16:00', endTime: '20:00' },
    ]
    expect(checkAvailability({ visitDate: TUESDAY, startTime: '17:00', endTime: '19:00', slots: split }).kind).toBe('inside')
    // Spanning the gap between two windows is not covered by either.
    expect(checkAvailability({ visitDate: TUESDAY, startTime: '09:00', endTime: '17:00', slots: split }).kind).toBe('outside_hours')
  })

  it('checks only the weekday when no time window was supplied', () => {
    // We cannot say anything about hours we were not given.
    expect(checkAvailability({ visitDate: TUESDAY, slots: weekdaySlots }).kind).toBe('inside')
    expect(checkAvailability({ visitDate: SATURDAY, slots: weekdaySlots }).kind).toBe('day_unavailable')
  })

  it('degrades to unknown rather than guessing on a malformed time', () => {
    const verdict = checkAvailability({
      visitDate: TUESDAY,
      startTime: '9am',
      endTime: '5pm',
      slots: weekdaySlots,
    })
    expect(verdict.kind).toBe('unknown')
  })
})
