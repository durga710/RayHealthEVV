/**
 * Caregiver earnings estimate (pure).
 *
 * Turns GPS-verified EVV time into what a caregiver can expect to be paid for
 * a date range. Same integrity principle as billing and payroll export: paid
 * time comes from verified clock events, never from free-typed hours.
 *
 * WHAT THIS IS NOT. This is an estimate, not a paystub. It has no tax
 * withholding, no benefit deductions, no garnishments, no reimbursements, and
 * no employer-side adjustments. The agency's payroll provider remains the
 * authority on what actually lands in a bank account, and every surface that
 * renders this must say so. The result carries `source: 'derived'` so a real
 * imported paystub can supersede it later without changing the API shape.
 *
 * OVERTIME. Home care workers lost the FLSA companionship exemption in the
 * 2015 Home Care Rule, so hours past 40 in a workweek are owed at 1.5x. An
 * estimate that ignored that would understate a busy week's pay, which is
 * worse than showing nothing. Overtime is computed per workweek, not per
 * requested range, because that is how the rule works: asking for a
 * three-day slice cannot manufacture or erase overtime that belongs to the
 * week containing it.
 *
 * Pure + deterministic: no DB/IO; the caller fetches visits and hands them in.
 */

import { minutesBetween } from './claim-generation-service.js'

/** Standard FLSA overtime threshold, in minutes per workweek. */
const OVERTIME_THRESHOLD_MINUTES = 40 * 60
/** Overtime multiplier, expressed as a numerator/denominator to stay integral. */
const OVERTIME_NUMERATOR = 3
const OVERTIME_DENOMINATOR = 2

export interface EarningsVisit {
  visitId: string
  /** ISO-8601 clock-in. */
  clockInTime: string
  /** ISO-8601 clock-out, or null while the visit is still open. */
  clockOutTime: string | null
  status: string
  serviceCode?: string | null
}

export interface EarningsOptions {
  /** Hourly rate in cents. Null/undefined means the agency has not set one. */
  payRateCents?: number | null
  /**
   * Day the agency's workweek starts, 0 = Sunday through 6 = Saturday.
   * Default 0, the FLSA default when an employer has not designated one.
   */
  workweekStartsOn?: number
}

export interface EarningsVisitLine {
  visitId: string
  /** Local calendar date of the clock-in, YYYY-MM-DD. */
  date: string
  minutes: number
  hours: number
  serviceCode: string | null
}

export interface EarningsWeekLine {
  /** ISO date of the workweek's first day. */
  weekStart: string
  regularMinutes: number
  overtimeMinutes: number
  regularCents: number
  overtimeCents: number
}

export interface EarningsStatement {
  /** Always 'derived' today. An imported paystub would report 'imported'. */
  source: 'derived'
  periodStart: string
  periodEnd: string
  payRateCents: number | null
  visitCount: number
  totalMinutes: number
  totalHours: number
  regularMinutes: number
  overtimeMinutes: number
  /** Null when no pay rate is on file; the UI must not render 0 as earnings. */
  grossCents: number | null
  weeks: EarningsWeekLine[]
  visits: EarningsVisitLine[]
  /** Visits excluded because they were unverified or had no clock-out. */
  excludedVisits: number
}

/** Calendar date portion of an ISO timestamp, in UTC. */
function isoDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

/**
 * First day of the workweek containing `iso`, as YYYY-MM-DD.
 *
 * Uses UTC day boundaries to stay deterministic. A visit that starts late
 * evening local time can therefore land in the following UTC day; that shifts
 * which week a boundary visit is grouped under but never changes the total,
 * and the overtime threshold is weekly rather than daily.
 */
export function workweekStart(iso: string, startsOn = 0): string {
  const date = new Date(iso)
  const day = date.getUTCDay()
  const delta = (day - startsOn + 7) % 7
  const start = new Date(date)
  start.setUTCDate(date.getUTCDate() - delta)
  start.setUTCHours(0, 0, 0, 0)
  return start.toISOString().slice(0, 10)
}

/** Round a fractional cent amount the way payroll does: half up, to the cent. */
function roundCents(value: number): number {
  return Math.round(value)
}

/**
 * Build an earnings estimate for a date range.
 *
 * Only verified, clocked-out visits count. A pending or flagged visit is
 * excluded and counted in `excludedVisits`, so a caregiver can see that
 * something is missing rather than silently being short.
 */
export function buildEarningsStatement(
  visits: EarningsVisit[],
  periodStart: string,
  periodEnd: string,
  options: EarningsOptions = {},
): EarningsStatement {
  const rate = options.payRateCents ?? null
  const startsOn = options.workweekStartsOn ?? 0

  const payable: EarningsVisitLine[] = []
  let excludedVisits = 0
  const minutesByWeek = new Map<string, number>()

  for (const visit of visits) {
    if (visit.status !== 'verified' || !visit.clockOutTime) {
      excludedVisits += 1
      continue
    }
    const minutes = minutesBetween(visit.clockInTime, visit.clockOutTime)
    if (minutes <= 0) {
      excludedVisits += 1
      continue
    }
    payable.push({
      visitId: visit.visitId,
      date: isoDate(visit.clockInTime),
      minutes,
      hours: Number((minutes / 60).toFixed(2)),
      serviceCode: visit.serviceCode ?? null,
    })
    const week = workweekStart(visit.clockInTime, startsOn)
    minutesByWeek.set(week, (minutesByWeek.get(week) ?? 0) + minutes)
  }

  const weeks: EarningsWeekLine[] = []
  let regularMinutes = 0
  let overtimeMinutes = 0

  for (const week of [...minutesByWeek.keys()].sort()) {
    const total = minutesByWeek.get(week) ?? 0
    const regular = Math.min(total, OVERTIME_THRESHOLD_MINUTES)
    const overtime = Math.max(0, total - OVERTIME_THRESHOLD_MINUTES)
    regularMinutes += regular
    overtimeMinutes += overtime

    weeks.push({
      weekStart: week,
      regularMinutes: regular,
      overtimeMinutes: overtime,
      regularCents: rate == null ? 0 : roundCents((regular / 60) * rate),
      overtimeCents:
        rate == null
          ? 0
          : roundCents(((overtime / 60) * rate * OVERTIME_NUMERATOR) / OVERTIME_DENOMINATOR),
    })
  }

  const totalMinutes = regularMinutes + overtimeMinutes
  const grossCents =
    rate == null ? null : weeks.reduce((sum, w) => sum + w.regularCents + w.overtimeCents, 0)

  return {
    source: 'derived',
    periodStart,
    periodEnd,
    payRateCents: rate,
    visitCount: payable.length,
    totalMinutes,
    totalHours: Number((totalMinutes / 60).toFixed(2)),
    regularMinutes,
    overtimeMinutes,
    grossCents,
    weeks,
    visits: payable.sort((a, b) => a.date.localeCompare(b.date)),
    excludedVisits,
  }
}
