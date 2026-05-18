import { describe, expect, it } from 'vitest'
import {
  buildSandataExport,
  buildSandataRow,
  PA_DEFAULT_SERVICE_MAPPINGS,
  sandataConfigSchema,
  SANDATA_CSV_COLUMNS,
  toSandataCsv,
  type SandataConfig,
  type SandataVisitInput,
} from '../services/sandata-mapping.js'

const AGENCY_ID = 'e1c4a7e3-1cad-4001-8e0a-000000000001'
const CAREGIVER_A = '00000000-0000-4000-8000-000000000002'
const CAREGIVER_UNMAPPED = '00000000-0000-4000-8000-0000000000aa'

function makeConfig(overrides: Partial<SandataConfig> = {}): SandataConfig {
  return sandataConfigSchema.parse({
    agencyId: AGENCY_ID,
    providerId: '123456789',
    timezone: 'America/New_York',
    caregivers: [{ caregiverId: CAREGIVER_A, externalWorkerId: 'ROMAN-1985' }],
    services: PA_DEFAULT_SERVICE_MAPPINGS,
    enabled: true,
    ...overrides,
  })
}

function makeVisit(overrides: Partial<SandataVisitInput> = {}): SandataVisitInput {
  return {
    visitId: 'v-001',
    caregiverId: CAREGIVER_A,
    clientMedicaidId: 'MA-12345678',
    clientFirstName: 'TEST-Lok',
    clientLastName: 'TEST-Ghimeray',
    clockInIso: '2026-05-11T13:00:00Z',
    clockOutIso: '2026-05-11T14:30:00Z',
    internalServiceCode: 'personal-care',
    clockInLat: 40.4659,
    clockInLng: -79.8358,
    clockOutLat: 40.4659,
    clockOutLng: -79.8358,
    ...overrides,
  }
}

describe('sandata-mapping — config validation', () => {
  it('rejects an invalid HCPCS code', () => {
    expect(() =>
      sandataConfigSchema.parse({
        agencyId: AGENCY_ID,
        providerId: '123456789',
        caregivers: [],
        services: [
          {
            internalServiceCode: 'bad',
            hcpcsCode: 'INVALID',
            hcpcsModifier: 'U4',
            label: 'bad',
          },
        ],
      }),
    ).toThrow(/HCPCS/)
  })

  it('rejects a non-9-digit provider ID', () => {
    expect(() =>
      sandataConfigSchema.parse({
        agencyId: AGENCY_ID,
        providerId: '12345',
        caregivers: [],
        services: [],
      }),
    ).toThrow(/9 digits/)
  })

  it('rejects an invalid HCPCS modifier', () => {
    expect(() =>
      sandataConfigSchema.parse({
        agencyId: AGENCY_ID,
        providerId: '123456789',
        caregivers: [],
        services: [
          {
            internalServiceCode: 'ok',
            hcpcsCode: 'T1019',
            hcpcsModifier: 'ZZ',
            label: 'bad modifier',
          },
        ],
      }),
    ).toThrow()
  })
})

describe('sandata-mapping — buildSandataRow', () => {
  it('emits a row with the documented column order', () => {
    const outcome = buildSandataRow(makeVisit(), makeConfig())
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(Object.keys(outcome.row)).toEqual([...SANDATA_CSV_COLUMNS])
    expect(outcome.row.ProviderID).toBe('123456789')
    expect(outcome.row.ExternalWorkerID).toBe('ROMAN-1985')
    expect(outcome.row.ServiceCode).toBe('T1019')
    expect(outcome.row.Modifier).toBe('U4')
    expect(outcome.row.ClockInLat).toBe('40.465900')
    expect(outcome.row.ClockInLng).toBe('-79.835800')
  })

  it('skips when config is disabled', () => {
    const outcome = buildSandataRow(makeVisit(), makeConfig({ enabled: false }))
    expect(outcome).toEqual({ ok: false, reason: 'config_disabled', visitId: 'v-001' })
  })

  it('skips when the visit has no clock-out (open visit)', () => {
    const outcome = buildSandataRow(makeVisit({ clockOutIso: null }), makeConfig())
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('clock_out_required')
  })

  it('skips when the client has no Medicaid ID', () => {
    const outcome = buildSandataRow(makeVisit({ clientMedicaidId: '' }), makeConfig())
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('missing_medicaid_id')
  })

  it('skips when the caregiver has no Sandata mapping', () => {
    const outcome = buildSandataRow(
      makeVisit({ caregiverId: CAREGIVER_UNMAPPED }),
      makeConfig(),
    )
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('no_caregiver_mapping')
    expect(outcome.details).toContain(CAREGIVER_UNMAPPED)
  })

  it('skips when the internal service code has no HCPCS mapping', () => {
    const outcome = buildSandataRow(
      makeVisit({ internalServiceCode: 'unmapped-service' }),
      makeConfig(),
    )
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('no_service_mapping')
  })

  it('emits empty clock-out lat/lng when only the clock-out time is present', () => {
    const outcome = buildSandataRow(
      makeVisit({ clockOutLat: null, clockOutLng: null }),
      makeConfig(),
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.row.ClockOutLat).toBe('')
    expect(outcome.row.ClockOutLng).toBe('')
  })
})

describe('sandata-mapping — buildSandataExport (bulk)', () => {
  it('separates rows and skips and reuses the lookup map', () => {
    const visits: SandataVisitInput[] = [
      makeVisit({ visitId: 'good-1' }),
      makeVisit({ visitId: 'no-caregiver', caregiverId: CAREGIVER_UNMAPPED }),
      makeVisit({ visitId: 'no-service', internalServiceCode: 'unmapped' }),
      makeVisit({ visitId: 'open-visit', clockOutIso: null }),
    ]
    const result = buildSandataExport(visits, makeConfig())
    expect(result.rows).toHaveLength(1)
    expect(result.skipped).toHaveLength(3)
    const reasons = result.skipped.map((s) => s.reason).sort()
    expect(reasons).toEqual(['clock_out_required', 'no_caregiver_mapping', 'no_service_mapping'])
  })
})

describe('sandata-mapping — toSandataCsv', () => {
  it('emits a header row followed by data rows in column order', () => {
    const { rows } = buildSandataExport([makeVisit()], makeConfig())
    const csv = toSandataCsv(rows)
    const [header, body] = csv.trim().split('\n')
    expect(header).toBe(SANDATA_CSV_COLUMNS.join(','))
    expect(body.startsWith('123456789,ROMAN-1985,MA-12345678,TEST-Lok,TEST-Ghimeray')).toBe(true)
  })

  it('quotes fields containing commas per RFC 4180', () => {
    const { rows } = buildSandataExport(
      [makeVisit({ clientLastName: 'Smith, Jr.' })],
      makeConfig(),
    )
    const csv = toSandataCsv(rows)
    expect(csv).toContain('"Smith, Jr."')
  })

  it('doubles internal quotes per RFC 4180', () => {
    const { rows } = buildSandataExport(
      [makeVisit({ clientFirstName: 'A "B" C' })],
      makeConfig(),
    )
    const csv = toSandataCsv(rows)
    expect(csv).toContain('"A ""B"" C"')
  })

  it('returns just a header line when given no rows', () => {
    const csv = toSandataCsv([])
    expect(csv).toBe(SANDATA_CSV_COLUMNS.join(',') + '\n')
  })
})
