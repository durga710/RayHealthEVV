import { describe, expect, it } from 'vitest'
import {
  classifyRemittance,
  summarizeDenials,
  atRiskCentsOf,
  isDenialWorkStatus,
  type DenialSourceRow,
} from '../services/denial-dashboard.js'

const NOW = new Date('2026-07-21T12:00:00.000Z')

function row(partial: Partial<DenialSourceRow>): DenialSourceRow {
  // Spread, not `??`, so an explicit `postedAt: null` survives.
  return {
    id: 'r-1',
    controlNumber: 'CLM-1',
    matched: true,
    statusCode: null,
    chargeCents: 10_000,
    paidCents: 0,
    patientResponsibilityCents: 0,
    adjustments: [],
    postedAt: '2026-07-20T00:00:00.000Z',
    ...partial,
  }
}

describe('classifyRemittance', () => {
  it('classifies by CLP02 status code first', () => {
    expect(classifyRemittance(row({ statusCode: '22', paidCents: 0 }))).toBe('reversed')
    expect(classifyRemittance(row({ statusCode: '4', paidCents: 5000 }))).toBe('denied')
  })

  it('treats zero-paid on a non-zero charge as denied', () => {
    expect(classifyRemittance(row({ statusCode: '1', paidCents: 0, chargeCents: 8000 }))).toBe('denied')
  })

  it('treats a shaved payment as partial and a full payment as paid', () => {
    expect(
      classifyRemittance(row({ statusCode: '1', chargeCents: 10_000, paidCents: 7000 })),
    ).toBe('partial')
    expect(
      classifyRemittance(row({ statusCode: '1', chargeCents: 10_000, paidCents: 10_000 })),
    ).toBe('paid')
    // Paid + patient responsibility covering the charge is not a shave.
    expect(
      classifyRemittance(
        row({ statusCode: '1', chargeCents: 10_000, paidCents: 8000, patientResponsibilityCents: 2000 }),
      ),
    ).toBe('paid')
  })
})

describe('atRiskCentsOf', () => {
  it('puts the full charge at risk for denials and only the shave for partials', () => {
    const denied = row({ statusCode: '4', chargeCents: 9000, paidCents: 0 })
    expect(atRiskCentsOf(denied, 'denied')).toBe(9000)
    const partial = row({ chargeCents: 10_000, paidCents: 7000, patientResponsibilityCents: 1000 })
    expect(atRiskCentsOf(partial, 'partial')).toBe(2000)
  })
})

describe('summarizeDenials', () => {
  it('returns an all-zero summary for no rows', () => {
    const s = summarizeDenials([], NOW)
    expect(s.totalRemittances).toBe(0)
    expect(s.denialRatePct).toBe(0)
    expect(s.atRiskCents).toBe(0)
    expect(s.topReasons).toEqual([])
  })

  it('computes counts, rate, at-risk dollars, and unworked count', () => {
    const rows = [
      row({ id: 'a', statusCode: '1', chargeCents: 10_000, paidCents: 10_000 }),
      row({ id: 'b', statusCode: '4', chargeCents: 8000, paidCents: 0 }),
      row({ id: 'c', statusCode: '1', chargeCents: 10_000, paidCents: 6000, denialStatus: 'working' }),
      row({ id: 'd', statusCode: '22', chargeCents: 5000, paidCents: -5000 }),
    ]
    const s = summarizeDenials(rows, NOW)
    expect(s.paidCount).toBe(1)
    expect(s.deniedCount).toBe(1)
    expect(s.partialCount).toBe(1)
    expect(s.reversedCount).toBe(1)
    // 1 denied of 3 adjudicated (reversal excluded) = 33.3%
    expect(s.denialRatePct).toBe(33.3)
    // denied full charge (8000) + partial shave (4000)
    expect(s.atRiskCents).toBe(12_000)
    // denied row untouched -> unworked; partial row is 'working' -> not
    expect(s.unworkedCount).toBe(1)
  })

  it('aggregates reasons across denied and partial rows, ranked by dollars', () => {
    const rows = [
      row({
        id: 'a',
        statusCode: '4',
        adjustments: [{ group: 'CO', reasonCode: '197', amountCents: 8000 }],
      }),
      row({
        id: 'b',
        chargeCents: 10_000,
        paidCents: 6000,
        statusCode: '1',
        adjustments: [
          { group: 'CO', reasonCode: '45', amountCents: 3000 },
          { group: 'CO', reasonCode: '197', amountCents: 1000 },
        ],
      }),
    ]
    const s = summarizeDenials(rows, NOW)
    expect(s.topReasons[0].reasonCode).toBe('197')
    expect(s.topReasons[0].occurrences).toBe(2)
    expect(s.topReasons[0].amountCents).toBe(9000)
    // Curated CARC dictionary supplies descriptions for common codes.
    expect(s.topReasons[0].description).toBeTruthy()
  })

  it('buckets denial aging by posted date, undated rows land in 60d+', () => {
    const rows = [
      row({ id: 'a', statusCode: '4', postedAt: '2026-07-19T00:00:00.000Z' }), // 2d
      row({ id: 'b', statusCode: '4', postedAt: '2026-07-01T00:00:00.000Z' }), // 20d
      row({ id: 'c', statusCode: '4', postedAt: '2026-04-01T00:00:00.000Z' }), // 111d
      row({ id: 'd', statusCode: '4', postedAt: null }),
    ]
    const s = summarizeDenials(rows, NOW)
    const byLabel = Object.fromEntries(s.aging.map((b) => [b.label, b.count]))
    expect(byLabel['0-7d']).toBe(1)
    expect(byLabel['8-30d']).toBe(1)
    expect(byLabel['31-60d']).toBe(0)
    expect(byLabel['60d+']).toBe(2)
  })
})

describe('isDenialWorkStatus', () => {
  it('accepts known statuses and rejects everything else', () => {
    expect(isDenialWorkStatus('working')).toBe(true)
    expect(isDenialWorkStatus('written_off')).toBe(true)
    expect(isDenialWorkStatus('escalated')).toBe(false)
    expect(isDenialWorkStatus(42)).toBe(false)
  })
})
