# Sandata aggregator onboarding runbook

How to take an agency from "signed up with RayHealth" to "transmitting EVV visits to the PA Aggregator (Sandata)" for Medicaid billing.

This is the runbook for the **Sandata** branch of the PA EVV Aggregator. PA also supports the **HHAeXchange** branch — different agencies are routed to different aggregators by PA DHS, and a given agency uses one, not both. The mapping module in `packages/app/src/services/sandata-mapping.ts` is Sandata-specific; HHAeXchange uses a different column order and identity scheme and would need its own module.

---

## What the agency provides

1. **Sandata Provider ID** — 9-digit numeric string. Sandata assigns this when the agency registers with the PA Aggregator at <https://sandata.com/provider-self-service/>. Without it, no visits can be transmitted.
2. **External Worker ID per caregiver** — Sandata's stable caregiver identifier. The agency picks the scheme; common patterns are `{state-license}-{birth-year}` or `{last-4-ssn}-{birth-year}`. The ID must be unique per caregiver within the agency's Sandata account.
3. **Confirmation of service codes** — which of the PA-standard HCPCS combinations apply: T1019/U4 (personal care), T1019/U5 (respite), T1019/U7 (companion). Most personal-care agencies use only U4.

The agency does **not** need to provide HCPCS service codes themselves — those are a PA DHS standard and we ship the defaults in `PA_DEFAULT_SERVICE_MAPPINGS`.

---

## RayHealth-side configuration

Stored in `agency_sandata_config` (one row per agency). Created by migration `2026-05-11-add-agency-sandata-config.ts`.

| Column | Type | Notes |
|---|---|---|
| `agency_id` | `uuid PK FK agencies.id` | one row per agency |
| `provider_id` | `text(9) nullable` | Sandata Provider ID; null until issued |
| `timezone` | `text(64)` | default `America/New_York`; visit timestamps emitted in this zone |
| `caregiver_mappings` | `jsonb` | `[{ caregiverId, externalWorkerId }]` |
| `service_mappings` | `jsonb` | `[{ internalServiceCode, hcpcsCode, hcpcsModifier, label }]` |
| `enabled` | `boolean` | when false, the export endpoint refuses to emit rows for this agency |

The application validates both JSON blobs against `sandataConfigSchema` (Zod) before every export — invalid configs fail loudly at export time, not silently in transmission.

---

## End-to-end onboarding flow

1. **Agency signs up with RayHealth.**
2. **Agency registers with the PA Aggregator** (Sandata side). RayHealth provides them a one-page guide pointing at the Sandata provider self-service portal. This is a Sandata gate, not a RayHealth one.
3. **Sandata issues a Provider ID** (3–5 business days).
4. **Agency admin enters Provider ID** in RayHealth admin UI → Settings → Aggregator. The UI writes to `agency_sandata_config.provider_id`. The `enabled` flag stays `false`.
5. **Agency admin maps each caregiver** to an External Worker ID. Either:
   - Bulk import via CSV upload, or
   - Per-caregiver entry on the caregiver detail page.
   The UI writes to `agency_sandata_config.caregiver_mappings`.
6. **Agency admin confirms service codes** (defaults to PCS / T1019 U4 if not changed).
7. **Test transmission.** Agency admin clicks "Test Sandata export" → backend builds a CSV for a single completed visit using `buildSandataExport()`, returns it for review.
8. **Agency uploads the test CSV** to the Sandata provider portal and confirms reconciliation. If Sandata accepts the row, `enabled` flag flips to `true`.
9. **Production export.** Daily (or on-demand) export at `/api/exports/sandata.csv?from=&to=` for the agency. Skipped visits are returned in the `X-Sandata-Skipped` response header as a count, with the structured skip reasons in a paired `/api/exports/sandata.skipped.json` endpoint.

---

## Skip semantics — why a visit is dropped from a CSV

| Reason | Cause | What to do |
|---|---|---|
| `config_disabled` | `enabled = false` | Expected during onboarding. Flip the flag after the test transmission reconciles. |
| `missing_medicaid_id` | `clients.medicaid_number` is NULL | Agency must populate the client's Medicaid ID before that client's visits can be transmitted. |
| `clock_out_required` | Visit is still open (no `clock_out_time`) | Wait — incomplete visits are not transmittable. |
| `no_caregiver_mapping` | Caregiver has no entry in `caregiver_mappings` | Agency admin maps the caregiver to an External Worker ID. |
| `no_service_mapping` | Visit's `internalServiceCode` has no HCPCS entry | Agency admin adds a service mapping. |

A visit dropped for any reason is **not** marked transmitted in the audit log. Subsequent exports will reattempt the same visit once the underlying gap is fixed.

---

## Defaults shipped in code

`PA_DEFAULT_SERVICE_MAPPINGS` in `sandata-mapping.ts`:

| Internal service code | HCPCS code | Modifier | Label |
|---|---|---|---|
| `personal-care` | T1019 | U4 | Personal Care Services (PCS) |
| `respite` | T1019 | U5 | Respite Care |
| `companion` | T1019 | U7 | Companion / Homemaker Services |

These are pre-populated on new `agency_sandata_config` rows. Agency admin can edit or remove as needed.

---

## Column order

Sandata's "EVV Provider Self-Service Visit Maintenance" CSV column order, exported by `toSandataCsv()`:

```
ProviderID, ExternalWorkerID, ClientMedicaidID, ClientFirstName, ClientLastName,
VisitStart, VisitEnd, ServiceCode, Modifier,
ClockInLat, ClockInLng, ClockOutLat, ClockOutLng
```

**Do not reorder.** Sandata's importer is positional, not header-name based — re-ordering silently corrupts every row.

---

## Verification

The mapping module has a pure builder (`buildSandataRow`) and a bulk wrapper (`buildSandataExport`). Both are deterministic and side-effect-free, which makes them trivially testable:

```typescript
import { describe, expect, it } from 'vitest'
import { buildSandataExport, PA_DEFAULT_SERVICE_MAPPINGS, sandataConfigSchema } from '../sandata-mapping.js'

describe('Sandata export', () => {
  const config = sandataConfigSchema.parse({
    agencyId: 'e1c4a7e3-1cad-4001-8e0a-000000000001',
    providerId: '123456789',
    timezone: 'America/New_York',
    caregivers: [{ caregiverId: '00000000-0000-4000-8000-000000000002', externalWorkerId: 'ROMAN-1985' }],
    services: PA_DEFAULT_SERVICE_MAPPINGS,
    enabled: true,
  })

  it('skips a visit with no caregiver mapping', () => {
    const result = buildSandataExport(
      [{ visitId: 'v1', caregiverId: 'unmapped', /* ... */ } as never],
      config,
    )
    expect(result.skipped[0]?.reason).toBe('no_caregiver_mapping')
  })

  it('emits a row in the documented column order', () => {
    // ... happy path
  })
})
```

Recommended baseline coverage:
- One test per skip reason
- One happy-path test that asserts exact column order
- One test for CSV quoting (client name with comma should be quoted)
- One test for the `enabled = false` short-circuit
