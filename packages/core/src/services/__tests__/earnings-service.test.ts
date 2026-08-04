import { describe, expect, it } from 'vitest'
import { buildEarningsStatement, workweekStart, type EarningsVisit } from '../earnings-service.js'

const RATE = 1800 // $18.00/hr in cents

/** A verified visit of `hours` starting at 09:00 UTC on `date`. */
function visit(date: string, hours: number, overrides: Partial<EarningsVisit> = {}): EarningsVisit {
  const start = new Date(`${date}T09:00:00.000Z`)
  const end = new Date(start.getTime() + hours * 3_600_000)
  return {
    visitId: `v-${date}-${hours}`,
    clockInTime: start.toISOString(),
    clockOutTime: end.toISOString(),
    status: 'verified',
    serviceCode: 'W1793',
    ...overrides,
  }
}

describe('workweekStart', () => {
  it('anchors to Sunday by default', () => {
    // 2026-08-04 is a Tuesday; its Sunday-start week begins 2026-08-02.
    expect(workweekStart('2026-08-04T09:00:00.000Z')).toBe('2026-08-02')
    expect(workweekStart('2026-08-02T00:30:00.000Z')).toBe('2026-08-02')
  })

  it('honors an agency that starts its week on Monday', () => {
    expect(workweekStart('2026-08-04T09:00:00.000Z', 1)).toBe('2026-08-03')
    // Sunday belongs to the week that started the previous Monday.
    expect(workweekStart('2026-08-09T09:00:00.000Z', 1)).toBe('2026-08-03')
  })
})

describe('buildEarningsStatement', () => {
  it('reports no earnings, not zero earnings, when no rate is on file', () => {
    const result = buildEarningsStatement([visit('2026-08-03', 8)], '2026-08-01', '2026-08-07')
    // Null is the honest answer: "we do not know your rate", not "you earned $0".
    expect(result.grossCents).toBeNull()
    expect(result.totalHours).toBe(8)
  })

  it('pays straight time for a normal week', () => {
    const visits = [visit('2026-08-03', 8), visit('2026-08-04', 8), visit('2026-08-05', 8)]
    const result = buildEarningsStatement(visits, '2026-08-02', '2026-08-08', { payRateCents: RATE })

    expect(result.totalHours).toBe(24)
    expect(result.overtimeMinutes).toBe(0)
    expect(result.grossCents).toBe(24 * RATE)
  })

  it('pays time-and-a-half past 40 hours in a workweek', () => {
    // 45 hours in one Sunday-start week: 40 regular + 5 overtime.
    const visits = [
      visit('2026-08-03', 9),
      visit('2026-08-04', 9),
      visit('2026-08-05', 9),
      visit('2026-08-06', 9),
      visit('2026-08-07', 9),
    ]
    const result = buildEarningsStatement(visits, '2026-08-02', '2026-08-08', { payRateCents: RATE })

    expect(result.regularMinutes).toBe(40 * 60)
    expect(result.overtimeMinutes).toBe(5 * 60)
    expect(result.grossCents).toBe(40 * RATE + Math.round(5 * RATE * 1.5))
  })

  it('does not pay overtime at exactly 40 hours', () => {
    const visits = [
      visit('2026-08-03', 10),
      visit('2026-08-04', 10),
      visit('2026-08-05', 10),
      visit('2026-08-06', 10),
    ]
    const result = buildEarningsStatement(visits, '2026-08-02', '2026-08-08', { payRateCents: RATE })

    expect(result.overtimeMinutes).toBe(0)
    expect(result.grossCents).toBe(40 * RATE)
  })

  it('computes overtime per workweek, so two 30-hour weeks owe none', () => {
    // 60 hours total, split across two weeks. A naive range-wide threshold
    // would wrongly bill 20 hours of overtime.
    const visits = [
      visit('2026-08-03', 10),
      visit('2026-08-04', 10),
      visit('2026-08-05', 10),
      visit('2026-08-10', 10),
      visit('2026-08-11', 10),
      visit('2026-08-12', 10),
    ]
    const result = buildEarningsStatement(visits, '2026-08-02', '2026-08-15', { payRateCents: RATE })

    expect(result.weeks).toHaveLength(2)
    expect(result.overtimeMinutes).toBe(0)
    expect(result.grossCents).toBe(60 * RATE)
  })

  it('splits regular and overtime per week when only one week runs long', () => {
    const visits = [
      // Week 1: 44 hours.
      visit('2026-08-03', 11),
      visit('2026-08-04', 11),
      visit('2026-08-05', 11),
      visit('2026-08-06', 11),
      // Week 2: 8 hours.
      visit('2026-08-10', 8),
    ]
    const result = buildEarningsStatement(visits, '2026-08-02', '2026-08-15', { payRateCents: RATE })

    const [first, second] = result.weeks
    expect(first.overtimeMinutes).toBe(4 * 60)
    expect(second.overtimeMinutes).toBe(0)
    expect(result.grossCents).toBe(40 * RATE + Math.round(4 * RATE * 1.5) + 8 * RATE)
  })

  it('excludes unverified and still-open visits, and says how many', () => {
    const visits = [
      visit('2026-08-03', 8),
      visit('2026-08-04', 8, { status: 'pending' }),
      visit('2026-08-05', 8, { status: 'flagged' }),
      { ...visit('2026-08-06', 8), clockOutTime: null },
    ]
    const result = buildEarningsStatement(visits, '2026-08-02', '2026-08-08', { payRateCents: RATE })

    // A caregiver should see that something is missing, not be silently short.
    expect(result.visitCount).toBe(1)
    expect(result.excludedVisits).toBe(3)
    expect(result.grossCents).toBe(8 * RATE)
  })

  it('excludes a zero-length visit rather than paying nothing for it', () => {
    const zero = visit('2026-08-03', 0)
    const result = buildEarningsStatement([zero], '2026-08-02', '2026-08-08', { payRateCents: RATE })

    expect(result.visitCount).toBe(0)
    expect(result.excludedVisits).toBe(1)
  })

  it('handles an empty period without inventing a week', () => {
    const result = buildEarningsStatement([], '2026-08-02', '2026-08-08', { payRateCents: RATE })

    expect(result).toMatchObject({
      visitCount: 0,
      totalMinutes: 0,
      totalHours: 0,
      grossCents: 0,
      excludedVisits: 0,
    })
    expect(result.weeks).toEqual([])
  })

  it('rounds a fractional visit to whole cents', () => {
    // 90 minutes at $18.00/hr = $27.00 exactly; 50 minutes = $15.00.
    const result = buildEarningsStatement(
      [visit('2026-08-03', 1.5), visit('2026-08-04', 5 / 6)],
      '2026-08-02',
      '2026-08-08',
      { payRateCents: RATE },
    )

    expect(Number.isInteger(result.grossCents)).toBe(true)
    expect(result.grossCents).toBe(4200)
  })

  it('returns visit lines sorted by date for a readable statement', () => {
    const visits = [visit('2026-08-06', 4), visit('2026-08-03', 4), visit('2026-08-05', 4)]
    const result = buildEarningsStatement(visits, '2026-08-02', '2026-08-08', { payRateCents: RATE })

    expect(result.visits.map((v) => v.date)).toEqual(['2026-08-03', '2026-08-05', '2026-08-06'])
  })

  it('always reports itself as derived, never as an authoritative paystub', () => {
    const result = buildEarningsStatement([visit('2026-08-03', 8)], '2026-08-02', '2026-08-08', {
      payRateCents: RATE,
    })
    expect(result.source).toBe('derived')
  })
})
