/**
 * Denial dashboard: pure aggregation over posted remittance rows.
 *
 * Works entirely from `claim_remittances` data, so it functions even for
 * postings that never matched a generated claim (an agency can upload payer
 * 835s and get a denial picture before any other part of RayHealth is in
 * use — this is the standalone-dashboard wedge).
 *
 * Denial semantics are derived from stored CLP fields, not recomputed from
 * the wire format:
 *   - reversed:  status_code '22'
 *   - denied:    status_code '4', or nothing paid on a non-zero charge
 *   - partial:   something paid, but less than charge minus patient
 *                responsibility (payer shaved the claim)
 *   - paid:      everything else
 */

import { describeCarc, adjustmentGroupLabel } from './carc-rarc.js'

export const DENIAL_WORK_STATUSES = [
  'new',
  'working',
  'resubmitted',
  'appealed',
  'resolved',
  'written_off',
] as const

export type DenialWorkStatus = (typeof DENIAL_WORK_STATUSES)[number]

export function isDenialWorkStatus(v: unknown): v is DenialWorkStatus {
  return typeof v === 'string' && (DENIAL_WORK_STATUSES as readonly string[]).includes(v)
}

/** The subset of a claim_remittances row the dashboard needs. */
export interface DenialSourceRow {
  id: string
  claimId?: string | null
  controlNumber: string
  matched: boolean
  statusCode: string | null
  chargeCents: number
  paidCents: number
  patientResponsibilityCents: number
  adjustments: Array<{ group: string; reasonCode: string; amountCents: number }>
  postedAt: string | null
  denialStatus?: string | null
}

export type RemittanceKind = 'paid' | 'partial' | 'denied' | 'reversed'

export function classifyRemittance(row: DenialSourceRow): RemittanceKind {
  if (row.statusCode === '22') return 'reversed'
  if (row.statusCode === '4') return 'denied'
  if (row.paidCents === 0 && row.chargeCents > 0) return 'denied'
  if (row.paidCents > 0 && row.paidCents + row.patientResponsibilityCents < row.chargeCents) {
    return 'partial'
  }
  return 'paid'
}

export interface DenialReasonSummary {
  group: string
  groupLabel: string
  reasonCode: string
  /** CARC dictionary description; null for codes outside the curated set. */
  description: string | null
  occurrences: number
  amountCents: number
}

export interface DenialAgingBucket {
  label: '0-7d' | '8-30d' | '31-60d' | '60d+'
  count: number
  atRiskCents: number
}

export interface DenialSummary {
  totalRemittances: number
  paidCount: number
  partialCount: number
  deniedCount: number
  reversedCount: number
  /** denied / (paid + partial + denied), reversals excluded. 0 when empty. */
  denialRatePct: number
  chargeCents: number
  paidCents: number
  /** Full charge of denied rows + the shaved portion of partial rows. */
  atRiskCents: number
  /** Denied/partial rows whose worklist state is still 'new' (or untouched). */
  unworkedCount: number
  topReasons: DenialReasonSummary[]
  aging: DenialAgingBucket[]
}

/** The shaved / unpaid portion of a row that the agency could still chase. */
export function atRiskCentsOf(row: DenialSourceRow, kind: RemittanceKind): number {
  if (kind === 'denied') return row.chargeCents
  if (kind === 'partial') {
    return Math.max(0, row.chargeCents - row.paidCents - row.patientResponsibilityCents)
  }
  return 0
}

const AGING_BUCKETS: Array<{ label: DenialAgingBucket['label']; maxDays: number }> = [
  { label: '0-7d', maxDays: 7 },
  { label: '8-30d', maxDays: 30 },
  { label: '31-60d', maxDays: 60 },
  { label: '60d+', maxDays: Number.POSITIVE_INFINITY },
]

/**
 * Aggregate remittance rows into the dashboard summary. `now` is injectable
 * for deterministic aging tests. Rows with unparseable/absent postedAt land
 * in the oldest bucket — an undated denial should look urgent, not invisible.
 */
export function summarizeDenials(rows: DenialSourceRow[], now: Date = new Date()): DenialSummary {
  let paidCount = 0
  let partialCount = 0
  let deniedCount = 0
  let reversedCount = 0
  let chargeCents = 0
  let paidCents = 0
  let atRiskCents = 0
  let unworkedCount = 0

  const reasons = new Map<string, DenialReasonSummary>()
  const aging: DenialAgingBucket[] = AGING_BUCKETS.map((b) => ({
    label: b.label,
    count: 0,
    atRiskCents: 0,
  }))

  for (const row of rows) {
    const kind = classifyRemittance(row)
    chargeCents += row.chargeCents
    paidCents += row.paidCents
    if (kind === 'paid') paidCount += 1
    else if (kind === 'partial') partialCount += 1
    else if (kind === 'denied') deniedCount += 1
    else reversedCount += 1

    if (kind !== 'denied' && kind !== 'partial') continue

    const risk = atRiskCentsOf(row, kind)
    atRiskCents += risk
    const status = row.denialStatus ?? 'new'
    if (status === 'new') unworkedCount += 1

    for (const a of row.adjustments) {
      const key = `${a.group}/${a.reasonCode}`
      const existing = reasons.get(key)
      if (existing) {
        existing.occurrences += 1
        existing.amountCents += a.amountCents
      } else {
        reasons.set(key, {
          group: a.group,
          groupLabel: adjustmentGroupLabel(a.group),
          reasonCode: a.reasonCode,
          description: describeCarc(a.reasonCode),
          occurrences: 1,
          amountCents: a.amountCents,
        })
      }
    }

    const posted = row.postedAt ? Date.parse(row.postedAt) : Number.NaN
    const ageDays = Number.isNaN(posted)
      ? Number.POSITIVE_INFINITY
      : Math.max(0, (now.getTime() - posted) / 86_400_000)
    const bucket = aging[AGING_BUCKETS.findIndex((b) => ageDays <= b.maxDays)]
    bucket.count += 1
    bucket.atRiskCents += risk
  }

  const adjudicated = paidCount + partialCount + deniedCount
  const denialRatePct = adjudicated === 0 ? 0 : Math.round((deniedCount / adjudicated) * 1000) / 10

  const topReasons = [...reasons.values()]
    .sort((a, b) => b.amountCents - a.amountCents || b.occurrences - a.occurrences)
    .slice(0, 10)

  return {
    totalRemittances: rows.length,
    paidCount,
    partialCount,
    deniedCount,
    reversedCount,
    denialRatePct,
    chargeCents,
    paidCents,
    atRiskCents,
    unworkedCount,
    topReasons,
    aging,
  }
}
