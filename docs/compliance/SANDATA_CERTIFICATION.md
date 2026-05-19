# Sandata EVV Aggregator — Vendor Certification Checklist

Sandata is the aggregator used by Pennsylvania and multiple other states. Certification
is required before any Medicaid-funded visit data we submit counts toward state compliance.

**Target state: Pennsylvania (initial)**
**Aggregator contact:** evv@sandata.com — ask for the Vendor Integration team.
**Sandata portal:** https://portal.sandata.com (requires vendor account)

---

## Phase 1 — Initial Application (Week 1)

- [ ] Register as an EVV Technology Vendor at the Sandata portal
- [ ] Sign Sandata Vendor Agreement (legal review required before signing)
- [ ] Obtain Sandata-assigned Vendor ID and sandbox credentials
- [ ] Request Pennsylvania-specific integration specification document (Sandata sends PDF)
- [ ] Schedule kickoff call with Sandata integration engineer

---

## Phase 2 — Technical Specification Review (Weeks 1–2)

All six CURES Act mandatory data elements must be captured and transmitted:

| # | Element | Where captured in RayHealth | Status |
|---|---------|----------------------------|--------|
| 1 | Type of service (HCPCS code) | `evv_visits.service_code` | captured at clock-in |
| 2 | Individual receiving service | `evv_visits.client_id` → `clients` table | present |
| 3 | Individual providing service | `evv_visits.caregiver_id` → `caregivers` table | present |
| 4 | Date of service | `evv_visits.clock_in_time` (date part) | present |
| 5 | Location of service (GPS) | `evv_visits.clock_in_lat/lng`, `clock_out_lat/lng` | present |
| 6 | Start and end times | `evv_visits.clock_in_time`, `clock_out_time` | present |

Additional PA-required fields to verify:

- [ ] Medicaid ID / MA number for each client — confirm `clients` table has this column; add if missing
- [ ] NPI for each caregiver — stored encrypted in `caregivers.npi`
- [ ] Agency Medicaid provider number — confirm `agencies` table has `medicaid_provider_id`; add if missing
- [ ] Sandata-assigned Visit ID format — confirm UUID is acceptable or if a numeric ID is required

---

## Phase 3 — API Integration (Weeks 2–5)

Sandata uses SOAP/XML for real-time submission and batch CSV for daily reconciliation.

- [ ] Review PA EVV implementation guide for required submission method (real-time vs. batch vs. both)
- [ ] Build or extend `packages/core/src/aggregators/sandata/` to generate the required XML payload
- [ ] Map `evv_visits` fields to Sandata XML schema:
  - `<VisitID>` ← `evv_visits.id`
  - `<AgencyID>` ← `agencies.medicaid_provider_id`
  - `<ClientID>` ← `clients.medicaid_id`
  - `<CaregiverID>` ← `caregivers.npi` (decrypted)
  - `<ServiceCode>` ← `evv_visits.service_code`
  - `<ClockInDateTime>` ← `evv_visits.clock_in_time` (ISO 8601)
  - `<ClockInLat>` / `<ClockInLon>` ← GPS decimal degrees
  - `<ClockOutDateTime>` ← `evv_visits.clock_out_time`
  - `<ClockOutLat>` / `<ClockOutLon>` ← GPS decimal degrees
- [ ] Implement retry with exponential back-off (Sandata SLA is 99.5%; plan for outages)
- [ ] Store Sandata's acknowledgment token in `evv_visits.sandata_confirmation_id` (add column)
- [ ] Add `sandata_status` enum to `evv_visits`: `pending | submitted | accepted | rejected`

---

## Phase 4 — Sandbox Testing (Weeks 4–6)

Sandata requires passing all test scenarios before production access is granted.

- [ ] Submit 10 valid visits — all must return `accepted`
- [ ] Submit a visit with a missing required field — must return correct error code (not 500)
- [ ] Submit a duplicate visit — must return `DUPLICATE` error
- [ ] Submit an open visit (clock-in only, no clock-out) — verify behavior matches PA spec
- [ ] Test rejected visit resubmission workflow
- [ ] Confirm GPS coordinates are in decimal degrees (Sandata rejects DMS format)

---

## Phase 5 — Documentation Submission to Sandata (Week 5)

- [ ] **System Security Summary** — summarize HIPAA controls (reference `docs/HIPAA_RISK_ANALYSIS.md`)
- [ ] **Data Flow Diagram** — mobile clock-in → Neon DB → Sandata API
- [ ] **Penetration Test Results** — Sandata requires a pen test within the prior 12 months
- [ ] **Disaster Recovery Plan** — document Neon PITR + Vercel redundancy
- [ ] **HIPAA BAA with Sandata** — Sandata is a business associate; execute their BAA

---

## Phase 6 — Production Approval (Week 6+)

- [ ] Receive production credentials from Sandata
- [ ] Switch aggregator client to production endpoint (env var `SANDATA_API_URL`)
- [ ] Submit first real visit; verify Sandata portal shows `accepted`
- [ ] Daily reconciliation alert: compare our `evv_visits` submitted count vs. Sandata's accepted count

---

## Open Technical Gaps (resolve before certification)

| Gap | Priority |
|-----|----------|
| `clients.medicaid_id` column missing | HIGH — required for every visit submission |
| `agencies.medicaid_provider_id` column missing | HIGH — required for every visit submission |
| `evv_visits.sandata_status` + `sandata_confirmation_id` columns | HIGH |
| Sandata XML builder in `aggregators/sandata/` needs XSD validation test | MEDIUM |
| Pen test not yet scheduled | MEDIUM |

## Estimated Timeline

| Week | Milestone |
|------|-----------|
| 1 | Vendor application submitted, sandbox credentials received |
| 2–3 | API integration built and unit-tested |
| 4–5 | All sandbox scenarios passing |
| 5 | Documentation package submitted to Sandata |
| 6–8 | Production approval received |

**First billable Medicaid visit through Sandata: ~8 weeks from application submission.**
